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
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Driver joins their room
    socket.on('driver:join', (driverId: string) => {
      socket.join(`driver:${driverId}`);
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
        // Broadcast to admin room
        io.to('admin-room').emit('driver:location-updated', data);
        
        // Broadcast to ALL connected clients (other drivers see each other)
        io.emit('driver:location-updated', data);
        
        // Broadcast to all clients watching this driver (via active order)
        io.emit('driver:location-live', { driverId: data.driverId, lat: data.lat, lng: data.lng });
      } catch (error) {
        console.error('Location update error:', error);
      }
    });

    // Driver status change
    socket.on('driver:status', async (data: { driverId: string; status: string }) => {
      try {
        await prisma.driver.update({
          where: { id: data.driverId },
          data: { status: data.status as any },
        });
        
        await prisma.driverStatusLog.create({
          data: {
            driverId: data.driverId,
            status: data.status as any,
          },
        });

        io.to('admin-room').emit('driver:status-changed', data);
        io.to('admin-room').emit('notification', {
          title: data.status === 'ONLINE' ? 'Driver Online' : 'Driver Offline',
          message: `Driver status changed to ${data.status}`,
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

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
}
