import { Server, Socket } from 'socket.io';
import { prisma } from '../server';

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
      // Send to all online drivers
      io.emit('order:available', order);
      io.to('admin-room').emit('notification', {
        title: 'New Order',
        message: `New order #${order.orderNumber} created`,
        type: 'new_order',
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

        await prisma.driver.update({
          where: { id: data.driverId },
          data: {
            status: 'ONLINE',
            totalOrders: { increment: 1 },
            totalEarnings: { increment: order.price },
          },
        });

        io.to('admin-room').emit('order:completed', order);
        io.to(`driver:${data.driverId}`).emit('order:completed-confirmation', order);
      } catch (error) {
        console.error('Order complete error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
}
