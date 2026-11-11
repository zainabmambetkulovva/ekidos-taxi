"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const server_1 = require("../server");
const presence_1 = require("../lib/presence");
const orders_1 = require("../lib/orders");
// Safe import — if push module fails, socket still works
let sendPushToAllOnlineDrivers = async () => 0;
try {
    const pushModule = require('../lib/push');
    sendPushToAllOnlineDrivers = pushModule.sendPushToAllOnlineDrivers;
}
catch (e) {
    console.error('Push module failed to load in socket:', e);
}
function setupSocketHandlers(io) {
    // Track socket → driverId mapping (логдор үчүн)
    const socketToDriver = new Map();
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);
        // Driver joins their room
        socket.on('driver:join', (driverId) => {
            if (!driverId)
                return;
            const room = `driver:${driverId}`;
            const alreadyJoined = socket.rooms.has(room);
            const wasConnected = (0, orders_1.isDriverConnected)(driverId);
            socket.join(room);
            socketToDriver.set(socket.id, driverId);
            if (!alreadyJoined)
                (0, presence_1.setSocketPresence)(socket.id, driverId, true);
            // Жаңы туташуу (чалуудан кийин / колдонмого кайтканда): азыркы сунушту кайра көрсөтөбүз
            if (!alreadyJoined) {
                (0, orders_1.onDriverConnected)(driverId, (event, data) => socket.emit(event, data));
                if (!wasConnected)
                    console.log(`🔄 Driver ${driverId} reconnected`);
            }
        });
        // Колдонмо экранда ачыкпы же фондобу (push жиберүү керекпи — ушуга жараша)
        socket.on('driver:visibility', (data) => {
            if (!data?.driverId)
                return;
            socket.join(`driver:${data.driverId}`);
            (0, presence_1.setSocketPresence)(socket.id, data.driverId, !!data.visible);
        });
        // Admin/Dispatcher joins
        socket.on('admin:join', (adminId) => {
            socket.join('admin-room');
            console.log(`👨‍💼 Admin ${adminId} joined`);
        });
        // Driver location update — 1 запрос, 1 broadcast
        socket.on('driver:location', async (data) => {
            try {
                if (!data?.driverId || typeof data.lat !== 'number' || typeof data.lng !== 'number')
                    return;
                const driver = await server_1.prisma.driver.update({
                    where: { id: data.driverId },
                    data: {
                        latitude: data.lat,
                        longitude: data.lng,
                        lastLocationUpdate: new Date(),
                    },
                    select: { status: true, firstName: true, lastName: true, callsign: true, phone: true },
                });
                // Админ жана башка водительдер (io.emit admin-room'ду да камтыйт)
                io.emit('driver:location-updated', {
                    ...data,
                    status: driver.status,
                    name: `${driver.firstName} ${driver.lastName}`,
                    callsign: driver.callsign || '',
                    phone: driver.phone || '',
                });
                // Broadcast to all clients watching this driver (via active order)
                io.emit('driver:location-live', { driverId: data.driverId, lat: data.lat, lng: data.lng });
            }
            catch (error) {
                console.error('Location update error:', error);
            }
        });
        // Телефон кайра ачылганда линия статусун калыбына келтирүү.
        // Серверде OFFLINE болуп калса гана өзгөртөт; заказда болсо BUSY калат. Админге билдирүү спам жок.
        socket.on('driver:restore-status', async (data) => {
            try {
                if (!data?.driverId || !['ONLINE', 'BUSY_PERSONAL'].includes(data.status))
                    return;
                const driver = await server_1.prisma.driver.findUnique({
                    where: { id: data.driverId },
                    select: { status: true, accountStatus: true },
                });
                if (!driver || driver.accountStatus !== 'ACTIVE' || driver.status !== 'OFFLINE')
                    return;
                const activeOrder = await server_1.prisma.order.findFirst({
                    where: { driverId: data.driverId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
                    select: { id: true },
                });
                const status = activeOrder ? 'BUSY' : data.status;
                const updated = await server_1.prisma.driver.updateMany({
                    where: { id: data.driverId, status: 'OFFLINE' },
                    data: { status },
                });
                if (updated.count > 0) {
                    io.emit('driver:status-changed', { driverId: data.driverId, status });
                    console.log(`🔁 Driver ${data.driverId} status restored → ${status}`);
                }
            }
            catch (error) {
                console.error('Restore status error:', error);
            }
        });
        // Driver status change
        socket.on('driver:status', async (data) => {
            try {
                // Map BUSY_PERSONAL to BUSY_PERSONAL in DB, rest as before
                const validStatuses = ['ONLINE', 'OFFLINE', 'BUSY', 'BUSY_PERSONAL'];
                const status = validStatuses.includes(data.status) ? data.status : 'OFFLINE';
                await Promise.all([
                    server_1.prisma.driver.update({
                        where: { id: data.driverId },
                        data: { status: status },
                    }),
                    server_1.prisma.driverStatusLog.create({
                        data: {
                            driverId: data.driverId,
                            status: status,
                        },
                    }),
                ]);
                // Admin + бардык водительдер картада дароо көрсүн
                io.emit('driver:status-changed', { ...data, status });
                io.to('admin-room').emit('notification', {
                    title: status === 'ONLINE' ? 'Линияга чыкты' :
                        status === 'BUSY_PERSONAL' ? 'По делам' :
                            status === 'OFFLINE' ? 'Линияны бүтүрдү' : 'Статус өзгөрдү',
                    message: `Driver status: ${status}`,
                    type: 'driver_status',
                });
            }
            catch (error) {
                console.error('Status update error:', error);
            }
        });
        // New order broadcast
        socket.on('order:new', (order) => {
            // Send to all online drivers via socket
            io.emit('order:available', order);
            io.to('admin-room').emit('notification', {
                title: 'New Order',
                message: `New order #${order.orderNumber} created`,
                type: 'new_order',
            });
            // Send PUSH notification to all online drivers (background/killed state)
            const pushPayload = {
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
        // Driver accepts order (HTTP менен бирдей логика — атомдук, баланс текшерилет)
        socket.on('order:accept', async (data) => {
            try {
                const result = await (0, orders_1.acceptOrder)(data?.orderId, data?.driverId);
                if (!result.ok)
                    socket.emit('order:accept-error', result.body);
            }
            catch (error) {
                console.error('Order accept error:', error);
            }
        });
        // Driver rejects order
        socket.on('order:reject', (data) => {
            if (data?.orderId && data?.driverId)
                (0, orders_1.rejectOffer)(data.orderId, data.driverId);
            io.to('admin-room').emit('order:rejected', data);
            io.to('admin-room').emit('notification', {
                title: 'Order Rejected',
                message: `A driver rejected order`,
                type: 'order_rejected',
            });
        });
        // Order completed
        socket.on('order:complete', async (data) => {
            try {
                const result = await (0, orders_1.completeOrder)(data?.orderId);
                if (result.ok)
                    io.to(`driver:${data.driverId}`).emit('order:completed-confirmation', result.order);
            }
            catch (error) {
                console.error('Order complete error:', error);
            }
        });
        // Driver arrived at pickup point - notify client
        socket.on('driver:arrived', async (data) => {
            try {
                const order = await server_1.prisma.order.findUnique({ where: { id: data.orderId } });
                const driver = await server_1.prisma.driver.findUnique({
                    where: { id: data.driverId },
                    include: { vehicle: true },
                });
                if (!order || !driver)
                    return;
                // Mark arrived time for 2-min free wait tracking (assignedAt — кабыл алган убакыт сакталат)
                await server_1.prisma.order.update({
                    where: { id: data.orderId },
                    data: { arrivedAt: new Date() },
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
            }
            catch (error) {
                console.error('Driver arrived error:', error);
            }
        });
        // Client joins order room
        socket.on('join-order', (orderId) => {
            socket.join(`order:${orderId}`);
        });
        // ===== CHAT =====
        // Real-time chat message via socket (alternative to REST)
        socket.on('chat:send', async (data) => {
            try {
                if (!data.text || !data.text.trim())
                    return;
                const message = await server_1.prisma.chatMessage.create({
                    data: {
                        text: data.text.trim(),
                        senderType: data.senderType,
                        senderId: data.senderId,
                        senderName: data.senderName,
                    },
                });
                // Broadcast to everyone
                io.emit('chat:message', message);
            }
            catch (error) {
                console.error('Chat socket error:', error);
            }
        });
        // Join chat room
        socket.on('chat:join', () => {
            socket.join('chat-room');
        });
        // ===== END CHAT =====
        // ===== DIRECT MESSAGES =====
        // User joins their personal DM room
        socket.on('dm:join', (userId) => {
            socket.join(`user:${userId}`);
            console.log(`💬 User ${userId} joined DM room`);
        });
        // Send a direct message via socket
        socket.on('dm:send', async (data) => {
            try {
                if (!data.text || !data.text.trim())
                    return;
                if (!data.senderId || !data.receiverId)
                    return;
                const conversationId = [data.senderId, data.receiverId].sort().join('_');
                const message = await server_1.prisma.directMessage.create({
                    data: {
                        text: data.text.trim(),
                        senderId: data.senderId,
                        senderName: data.senderName,
                        senderType: data.senderType,
                        receiverId: data.receiverId,
                        receiverName: data.receiverName,
                        receiverType: data.receiverType,
                        conversationId,
                    },
                });
                // Send to receiver's room
                io.to(`user:${data.receiverId}`).emit('dm:message', message);
                // Send to sender's room (other tabs/devices)
                io.to(`user:${data.senderId}`).emit('dm:message', message);
            }
            catch (error) {
                console.error('DM socket error:', error);
            }
        });
        // Mark DM as read via socket
        socket.on('dm:read', async (data) => {
            try {
                await server_1.prisma.directMessage.updateMany({
                    where: {
                        conversationId: data.conversationId,
                        receiverId: data.userId,
                        isRead: false,
                    },
                    data: { isRead: true },
                });
                // Notify the sender that messages were read
                io.to(`user:${data.userId}`).emit('dm:read-confirmed', { conversationId: data.conversationId });
            }
            catch (error) {
                console.error('DM read socket error:', error);
            }
        });
        // ===== END DIRECT MESSAGES =====
        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
            // Водитель линиядан АВТОМАТТЫК ТҮРДӨ ЧЫГАРЫЛБАЙТ.
            // Телефонго чалуу келсе, башка колдонмого өтсө же экран өчсө да — ал линияда калат,
            // картада көрүнөт. Линиядан өзү "Завершить линию" басканда гана чыгат.
            socketToDriver.delete(socket.id);
            (0, presence_1.removeSocketPresence)(socket.id);
        });
    });
}
