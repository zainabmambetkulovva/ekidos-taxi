import { Server, Socket } from 'socket.io';
import { prisma } from '../server';

// Safe import — if push module fails, socket still works
let sendPushToAllOnlineDrivers: any = async () => 0;
try {
  const pushModule = require('../lib/push');
  sendPushToAllOnlineDrivers = pushModule.sendPushToAllOnlineDrivers;
} catch (e) {
  console.error('Push module failed to load in socket:', e);
}

interface OrderPushPayload {
  orderId: string;
  orderNumber: string;
  pickupAddress: string;
  destAddress: string;
  price: number;
  clientName: string;
  clientPhone: string;
  type: 'new_order';
}

export function setupSocketHandlers(io: Server) {
  // Track socket → driverId mapping for auto-offline on disconnect
  const socketToDriver: Map<string, string> = new Map();
  // Track disconnect timeouts so we can cancel if they reconnect quickly
  const disconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Driver joins their room
    socket.on('driver:join', (driverId: string) => {
      socket.join(`driver:${driverId}`);
      
      // Map this socket to the driver
      socketToDriver.set(socket.id, driverId);
      
      // Cancel any pending auto-offline timeout (driver reconnected)
      const existingTimeout = disconnectTimeouts.get(driverId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        disconnectTimeouts.delete(driverId);
        console.log(`🔄 Driver ${driverId} reconnected — cancelled auto-offline`);
      }
      console.log(`🚖 Driver ${driverId} joined`);
    });

    // Admin/Dispatcher joins
    socket.on('admin:join', (adminId: string) => {
      socket.join('admin-room');
      console.log(`👨‍💼 Admin ${adminId} joined`);
    });

    // Driver location update
    socket.on('driver:location', async (data: { driverId: string; lat: number; lng: number }) => {
      try {
        await prisma.driver.update({
          where: { id: data.driverId },
          data: {
            latitude: data.lat,
            longitude: data.lng,
            lastLocationUpdate: new Date(),
          },
        });
        
        // Fetch driver status/name for broadcast
        const driver = await prisma.driver.findUnique({
          where: { id: data.driverId },
          select: { status: true, firstName: true, lastName: true, callsign: true },
        });
        
        const broadcastData = {
          ...data,
          status: driver?.status || 'ONLINE',
          name: driver ? `${driver.firstName} ${driver.lastName}` : '',
          callsign: driver?.callsign || '',
        };
        
        // Broadcast to admin room
        io.to('admin-room').emit('driver:location-updated', broadcastData);
        
        // Broadcast to ALL connected clients (other drivers see each other)
        io.emit('driver:location-updated', broadcastData);
        
        // Broadcast to all clients watching this driver (via active order)
        io.emit('driver:location-live', { driverId: data.driverId, lat: data.lat, lng: data.lng });
      } catch (error) {
        console.error('Location update error:', error);
      }
    });

    // Driver status change
    socket.on('driver:status', async (data: { driverId: string; status: string }) => {
      try {
        // Map BUSY_PERSONAL to BUSY_PERSONAL in DB, rest as before
        const validStatuses = ['ONLINE', 'OFFLINE', 'BUSY', 'BUSY_PERSONAL'];
        const status = validStatuses.includes(data.status) ? data.status : 'OFFLINE';
        
        await prisma.driver.update({
          where: { id: data.driverId },
          data: { status: status as any },
        });
        
        await prisma.driverStatusLog.create({
          data: {
            driverId: data.driverId,
            status: status as any,
          },
        });

        io.to('admin-room').emit('driver:status-changed', { ...data, status });
        // Broadcast to all drivers so they see updated status on map
        io.emit('driver:status-changed', { ...data, status });
        io.to('admin-room').emit('notification', {
          title: status === 'ONLINE' ? 'Линияга чыкты' : 
                 status === 'BUSY_PERSONAL' ? 'По делам' :
                 status === 'OFFLINE' ? 'Линияны бүтүрдү' : 'Статус өзгөрдү',
          message: `Driver status: ${status}`,
          type: 'driver_status',
        });
      } catch (error) {
        console.error('Status update error:', error);
      }
    });

    // New order broadcast
    socket.on('order:new', (order: any) => {
      // Send to all online drivers via socket
      io.emit('order:available', order);
      io.to('admin-room').emit('notification', {
        title: 'New Order',
        message: `New order #${order.orderNumber} created`,
        type: 'new_order',
      });

      // Send PUSH notification to all online drivers (background/killed state)
      const pushPayload: OrderPushPayload = {
        orderId: order.id || order.orderId || '',
        orderNumber: order.orderNumber || '',
        pickupAddress: order.pickupAddress || '',
        destAddress: order.destAddress || '',
        price: order.price || 0,
        clientName: order.clientName || 'Клиент',
        clientPhone: order.clientPhone || '',
        type: 'new_order',
      };
      sendPushToAllOnlineDrivers(pushPayload).catch(err => {
        console.error('Push notification error:', err);
      });
    });

    // Driver accepts order
    socket.on('order:accept', async (data: { orderId: string; driverId: string }) => {
      try {
        const order = await prisma.order.update({
          where: { id: data.orderId },
          data: {
            driverId: data.driverId,
            status: 'ASSIGNED',
            assignedAt: new Date(),
          },
          include: { driver: true },
        });

        await prisma.driver.update({
          where: { id: data.driverId },
          data: { status: 'BUSY' },
        });

        // Notify all drivers to remove this order
        io.emit('order:taken', { orderId: data.orderId, driverId: data.driverId });
        
        // Notify client who placed this order (broadcast with order details + driver info)
        io.emit('order:accepted', order);
        
        // Notify admin
        io.to('admin-room').emit('order:accepted', order);
        io.to('admin-room').emit('notification', {
          title: 'Order Accepted',
          message: `Order #${order.orderNumber} accepted by ${order.driver?.firstName}`,
          type: 'order_accepted',
        });
      } catch (error) {
        console.error('Order accept error:', error);
      }
    });

    // Driver rejects order
    socket.on('order:reject', (data: { orderId: string; driverId: string }) => {
      io.to('admin-room').emit('order:rejected', data);
      io.to('admin-room').emit('notification', {
        title: 'Order Rejected',
        message: `A driver rejected order`,
        type: 'order_rejected',
      });
    });

    // Order completed
    socket.on('order:complete', async (data: { orderId: string; driverId: string }) => {
      try {
        const order = await prisma.order.update({
          where: { id: data.orderId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        // Deduct 12, never below 0
        const driverData = await prisma.driver.findUnique({ where: { id: data.driverId } });
        const newBalance = Math.max(0, (driverData?.balance || 0) - 12);

        await prisma.driver.update({
          where: { id: data.driverId },
          data: {
            status: 'ONLINE',
            totalOrders: { increment: 1 },
            totalEarnings: { increment: order.price },
            balance: newBalance,
          },
        });

        io.to('admin-room').emit('order:completed', order);
        io.to(`driver:${data.driverId}`).emit('order:completed-confirmation', order);
      } catch (error) {
        console.error('Order complete error:', error);
      }
    });

    // Driver arrived at pickup point - notify client
    socket.on('driver:arrived', async (data: { orderId: string; driverId: string }) => {
      try {
        const order = await prisma.order.findUnique({ where: { id: data.orderId } });
        const driver = await prisma.driver.findUnique({
          where: { id: data.driverId },
          include: { vehicle: true },
        });
        if (!order || !driver) return;

        // Update order - mark arrived time for 2-min free wait tracking
        await prisma.order.update({
          where: { id: data.orderId },
          data: { assignedAt: new Date() }, // reuse assignedAt as arrivedAt
        });

        // Emit to ALL connected clients (they filter by orderId)
        io.emit('driver:arrived', {
          orderId: data.orderId,
          driverName: `${driver.firstName} ${driver.lastName}`,
          car: driver.vehicle ? `${driver.vehicle.brand} ${driver.vehicle.model}` : '',
          plate: driver.vehicle?.plateNumber || '',
          phone: driver.phone,
          price: order.price,
        });

        io.to('admin-room').emit('notification', {
          title: 'Driver Arrived',
          message: `${driver.firstName} arrived at pickup for #${order.orderNumber}`,
          type: 'driver_arrived',
        });
      } catch (error) {
        console.error('Driver arrived error:', error);
      }
    });

    // Client joins order room
    socket.on('join-order', (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    // ===== CHAT =====
    // Real-time chat message via socket (alternative to REST)
    socket.on('chat:send', async (data: { text: string; senderType: string; senderId: string; senderName: string }) => {
      try {
        if (!data.text || !data.text.trim()) return;
        
        const message = await prisma.chatMessage.create({
          data: {
            text: data.text.trim(),
            senderType: data.senderType,
            senderId: data.senderId,
            senderName: data.senderName,
          },
        });

        // Broadcast to everyone
        io.emit('chat:message', message);
      } catch (error) {
        console.error('Chat socket error:', error);
      }
    });

    // Join chat room
    socket.on('chat:join', () => {
      socket.join('chat-room');
    });
    // ===== END CHAT =====

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
      
      // Check if this socket was a driver
      const driverId = socketToDriver.get(socket.id);
      socketToDriver.delete(socket.id);
      
      if (driverId) {
        // Check if driver has other active sockets (multiple tabs/devices)
        const driverRoom = io.sockets.adapter.rooms.get(`driver:${driverId}`);
        if (driverRoom && driverRoom.size > 0) {
          // Driver still connected on another socket — don't auto-offline
          return;
        }

        // Set 30-second timeout before going offline
        // If driver reconnects within 30 sec, the timeout gets cancelled
        const timeout = setTimeout(async () => {
          disconnectTimeouts.delete(driverId);
          
          try {
            // Check current status — only auto-offline if ONLINE or BUSY_PERSONAL
            const driver = await prisma.driver.findUnique({
              where: { id: driverId },
              select: { status: true },
            });
            
            if (!driver) return;
            
            // Don't auto-offline if driver is BUSY (executing an order)
            if (driver.status === 'BUSY') return;
            
            // Only auto-offline if currently ONLINE or BUSY_PERSONAL
            if (driver.status === 'ONLINE' || driver.status === 'BUSY_PERSONAL') {
              await prisma.driver.update({
                where: { id: driverId },
                data: { status: 'OFFLINE' },
              });

              await prisma.driverStatusLog.create({
                data: { driverId, status: 'OFFLINE' },
              });

              // Notify admin and other drivers
              io.to('admin-room').emit('driver:status-changed', { driverId, status: 'OFFLINE' });
              io.emit('driver:status-changed', { driverId, status: 'OFFLINE' });
              io.to('admin-room').emit('notification', {
                title: 'Автоматтык оффлайн',
                message: `Водитель приложениядан чыкты — линиядан алынды`,
                type: 'driver_status',
              });

              console.log(`⏰ Driver ${driverId} auto-offline (disconnected 30s ago)`);
            }
          } catch (error) {
            console.error('Auto-offline error:', error);
          }
        }, 30000); // 30 seconds

        disconnectTimeouts.set(driverId, timeout);
        console.log(`⏳ Driver ${driverId} disconnected — 30s auto-offline timer started`);
      }
    });
  });
}
