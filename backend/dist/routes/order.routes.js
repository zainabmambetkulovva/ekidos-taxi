"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const server_2 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tariff_1 = require("../lib/tariff");
// Safe import — if push module fails, orders still work
let sendPushToAllOnlineDrivers = async () => 0;
try {
    const pushModule = require('../lib/push');
    sendPushToAllOnlineDrivers = pushModule.sendPushToAllOnlineDrivers;
}
catch (e) {
    console.error('Push module failed to load:', e);
}
const router = (0, express_1.Router)();
// ===== ORDER ASSIGNMENT ENGINE =====
// Picks a random driver from nearby list, sends fullscreen order
// If not accepted in 25s → picks next random driver
// Repeats until all candidates exhausted
function startOrderAssignment(order, candidates, ioServer) {
    const triedDrivers = [];
    let currentTimeout = null;
    function assignToNext() {
        // Filter out already tried drivers
        const remaining = candidates.filter(d => !triedDrivers.includes(d.id));
        if (remaining.length === 0) {
            // All candidates exhausted — notify admin
            ioServer.to('admin-room').emit('notification', {
                title: 'Водитель табылган жок',
                message: `#${order.orderNumber} — бардык жакын водительдер четке кагышты`,
                type: 'no_drivers',
            });
            return;
        }
        // Pick random from remaining
        const selected = remaining[Math.floor(Math.random() * remaining.length)];
        triedDrivers.push(selected.id);
        console.log(`🎯 Order #${order.orderNumber} → Driver ${selected.firstName} (${(selected.distance * 1000).toFixed(0)}m)`);
        // Send FULLSCREEN order to this specific driver only
        ioServer.to(`driver:${selected.id}`).emit('order:incoming', {
            ...order,
            assignedDriverId: selected.id,
            distanceMeters: Math.round(selected.distance * 1000),
            timeoutSeconds: 20,
        });
        // Notify admin
        ioServer.to('admin-room').emit('notification', {
            title: 'Заказ жөнөтүлдү',
            message: `#${order.orderNumber} → ${selected.firstName} (${(selected.distance * 1000).toFixed(0)}м) — 20 сек`,
            type: 'auto_assigned',
        });
        // 20 second timeout — if not accepted, try next
        currentTimeout = setTimeout(async () => {
            try {
                const freshOrder = await server_1.prisma.order.findUnique({ where: { id: order.id } });
                if (freshOrder && freshOrder.status === 'PENDING') {
                    // Not accepted — notify this driver that time expired
                    ioServer.to(`driver:${selected.id}`).emit('order:expired', { orderId: order.id });
                    // Try next driver
                    assignToNext();
                }
            }
            catch { }
        }, 20000);
    }
    // Start the chain
    assignToNext();
    // Listen for acceptance (cancel the timeout)
    ioServer.on('connection', (socket) => {
        socket.on('order:accept', (data) => {
            if (data.orderId === order.id && currentTimeout) {
                clearTimeout(currentTimeout);
                currentTimeout = null;
            }
        });
    });
}
// ===== END ORDER ASSIGNMENT ENGINE =====
// Generate order number
function generateOrderNumber() {
    const date = new Date();
    const prefix = `EK${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${suffix}`;
}
// Get tariffs
router.get('/tariffs', async (req, res) => {
    return res.json({ tariffs: tariff_1.TARIFFS, commission: tariff_1.COMPANY_COMMISSION });
});
// Calculate price
router.post('/calculate-price', async (req, res) => {
    try {
        const { pickupLat, pickupLng, destLat, destLng, tariff } = req.body;
        if (pickupLat && pickupLng && destLat && destLng) {
            const distance = (0, tariff_1.calculateDistance)(pickupLat, pickupLng, destLat, destLng);
            // Road distance is ~1.4x straight-line distance
            const roadDistance = Math.round(distance * 1.4 * 10) / 10;
            const pricing = (0, tariff_1.calculatePrice)(roadDistance, tariff || 'Standard');
            return res.json(pricing);
        }
        // Default minimum price
        const pricing = (0, tariff_1.calculatePrice)(1, tariff || 'Standard');
        return res.json(pricing);
    }
    catch (error) {
        return res.status(500).json({ error: 'Calculation error' });
    }
});
// Get all orders
router.get('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { status, driverId, search, page = '1', limit = '50', dateFrom, dateTo } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (driverId)
            where.driverId = driverId;
        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { clientName: { contains: search, mode: 'insensitive' } },
                { clientPhone: { contains: search } },
                { pickupAddress: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom)
                where.createdAt.gte = new Date(dateFrom);
            if (dateTo)
                where.createdAt.lte = new Date(dateTo);
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [orders, total] = await Promise.all([
            server_1.prisma.order.findMany({
                where,
                include: { driver: { include: { vehicle: true } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            server_1.prisma.order.count({ where }),
        ]);
        return res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });
    }
    catch (error) {
        console.error('Get orders error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Get driver's orders
router.get('/driver/:driverId', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const driverId = req.params.driverId;
        const { status } = req.query;
        const where = { driverId };
        if (status)
            where.status = status;
        const orders = await server_1.prisma.order.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return res.json(orders);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Get online drivers positions (public - for client map)
router.get('/online-drivers', async (req, res) => {
    try {
        const drivers = await server_1.prisma.driver.findMany({
            where: {
                status: 'ONLINE',
                accountStatus: 'ACTIVE',
                latitude: { not: null },
                longitude: { not: null },
            },
            select: { id: true, firstName: true, latitude: true, longitude: true },
        });
        return res.json(drivers.map(d => ({ id: d.id, lat: d.latitude, lng: d.longitude, name: d.firstName })));
    }
    catch (error) {
        return res.json([]);
    }
});
// Get order status (public — for client tracking)
router.get('/:id/status', async (req, res) => {
    try {
        const id = req.params.id;
        const order = await server_1.prisma.order.findUnique({
            where: { id },
            include: {
                driver: {
                    include: { vehicle: true },
                },
            },
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        return res.json({
            status: order.status,
            driver: order.driver ? {
                id: order.driver.id,
                firstName: order.driver.firstName,
                lastName: order.driver.lastName,
                phone: order.driver.phone,
                latitude: order.driver.latitude,
                longitude: order.driver.longitude,
                vehicle: order.driver.vehicle,
            } : null,
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Get available orders for drivers (also returns online driver positions for client map)
// Clear all pending orders (for testing)
router.post('/clear-pending', async (req, res) => {
    try {
        const result = await server_1.prisma.order.updateMany({
            where: { status: 'PENDING' },
            data: { status: 'CANCELLED' },
        });
        return res.json({ cleared: result.count });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete all COMPLETED and CANCELLED orders from DB (archive cleanup)
router.delete('/clear-archive', async (req, res) => {
    try {
        // Delete payments first (FK constraint)
        await server_1.prisma.payment.deleteMany({
            where: {
                order: { status: { in: ['COMPLETED', 'CANCELLED'] } },
            },
        });
        const result = await server_1.prisma.order.deleteMany({
            where: { status: { in: ['COMPLETED', 'CANCELLED'] } },
        });
        return res.json({ deleted: result.count });
    }
    catch (error) {
        console.error('clear-archive error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete ALL orders and related data (full reset — drivers untouched)
router.delete('/clear-all', async (req, res) => {
    try {
        // 1. Delete all payments (FK)
        await server_1.prisma.payment.deleteMany({});
        // 2. Delete all orders
        const result = await server_1.prisma.order.deleteMany({});
        // 3. Reset driver stats (totalOrders, totalEarnings) — but keep drivers themselves
        await server_1.prisma.driver.updateMany({
            data: { totalOrders: 0, totalEarnings: 0 },
        });
        // 4. Reset client totalOrders count
        await server_1.prisma.client.updateMany({
            data: { totalOrders: 0 },
        });
        return res.json({ deleted: result.count, message: 'All orders and stats cleared' });
    }
    catch (error) {
        console.error('clear-all error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/driver/active', async (req, res) => {
    try {
        const driverId = req.query.driverId;
        if (!driverId)
            return res.status(400).json({ error: 'driverId required' });
        const activeOrder = await server_1.prisma.order.findFirst({
            where: { driverId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(activeOrder || null);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/available', async (req, res) => {
    try {
        const orders = await server_1.prisma.order.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(orders);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Create order
router.post('/', async (req, res) => {
    try {
        const { pickupAddress, destAddress, clientName, clientPhone, tariff, comment, paymentMethod, price, pickupLat, pickupLng, destLat, destLng, 
        // Client app sends these alternative field names:
        from, to, addressFrom, addressTo, 
        // Order options
        options, 
        // Targeted dispatch — dispatcher can specify a callsign
        targetCallsign, } = req.body;
        // Support client app format: from={lat,lng}, addressFrom="..."
        const finalPickupAddress = pickupAddress || addressFrom || '';
        const finalDestAddress = destAddress || addressTo || 'Не указано';
        const finalPickupLat = pickupLat || (from?.lat ? parseFloat(from.lat) : null);
        const finalPickupLng = pickupLng || (from?.lng ? parseFloat(from.lng) : null);
        const finalDestLat = destLat || (to?.lat ? parseFloat(to.lat) : null);
        const finalDestLng = destLng || (to?.lng ? parseFloat(to.lng) : null);
        if (!finalPickupAddress && !finalPickupLat) {
            return res.status(400).json({ error: 'Откуда жерди жазыңыз (pickupAddress)' });
        }
        // clientPhone optional — default to unknown
        const safeClientName = clientName || 'Клиент';
        const safeClientPhone = clientPhone || '—';
        // Price validation
        const inputPrice = parseFloat(price) || 0;
        if (inputPrice < 0 || inputPrice > 50000) {
            return res.status(400).json({ error: 'Цена должна быть от 0 до 50000 сом' });
        }
        const orderNumber = generateOrderNumber();
        // Skip geocoding for speed — assign order IMMEDIATELY
        let orderPrice = inputPrice;
        let driverEarning = 0;
        let companyCommission = 0;
        let distance = 0;
        // Auto-calculate price from coordinates if price not provided
        if (orderPrice === 0 && finalPickupLat && finalPickupLng && finalDestLat && finalDestLng) {
            distance = (0, tariff_1.calculateDistance)(finalPickupLat, finalPickupLng, finalDestLat, finalDestLng);
            const priceCalc = (0, tariff_1.calculatePrice)(distance, tariff || 'Standard');
            orderPrice = priceCalc.total;
            driverEarning = priceCalc.driverEarning;
            companyCommission = priceCalc.companyCommission;
        }
        else if (orderPrice === 0) {
            // No coordinates and no price — use minimum tariff
            const priceCalc = (0, tariff_1.calculatePrice)(0, tariff || 'Standard');
            orderPrice = priceCalc.total; // will be minimum (110 som)
            driverEarning = priceCalc.driverEarning;
            companyCommission = priceCalc.companyCommission;
        }
        else if (orderPrice > 0) {
            companyCommission = Math.round(orderPrice * tariff_1.COMPANY_COMMISSION);
            driverEarning = orderPrice - companyCommission;
        }
        const order = await server_1.prisma.order.create({
            data: {
                orderNumber,
                pickupAddress: finalPickupAddress || `${finalPickupLat}, ${finalPickupLng}`,
                destAddress: finalDestAddress,
                pickupLat: finalPickupLat,
                pickupLng: finalPickupLng,
                destLat: finalDestLat,
                destLng: finalDestLng,
                clientName: safeClientName,
                clientPhone: safeClientPhone,
                tariff: tariff || 'Standard',
                comment: comment || null,
                paymentMethod: paymentMethod || 'CASH',
                price: orderPrice,
                driverEarning,
                companyCommission,
                distance,
                // @ts-ignore — options field added via ALTER TABLE, Prisma client regenerated on deploy
                options: Array.isArray(options) ? options : [],
            },
        });
        // Create or update client
        try {
            await server_1.prisma.client.upsert({
                where: { phone: safeClientPhone },
                update: { name: safeClientName, totalOrders: { increment: 1 } },
                create: { name: safeClientName, phone: safeClientPhone, totalOrders: 1 },
            });
        }
        catch (e) {
            // Client creation may fail if phone format issue, non-critical
        }
        // Auto-assign: pick nearest online driver or target by callsign
        try {
            const onlineDrivers = await server_1.prisma.driver.findMany({
                where: {
                    status: 'ONLINE',
                    accountStatus: 'ACTIVE',
                },
                select: { id: true, firstName: true, lastName: true, latitude: true, longitude: true, callsign: true },
            });
            // === TARGETED DISPATCH: specific callsign ===
            if (targetCallsign && targetCallsign.trim()) {
                const targetDriver = await server_1.prisma.driver.findFirst({
                    where: { callsign: targetCallsign.trim(), accountStatus: 'ACTIVE' },
                    select: { id: true, firstName: true, lastName: true, latitude: true, longitude: true, callsign: true, status: true },
                });
                if (!targetDriver) {
                    server_2.io.to('admin-room').emit('notification', {
                        title: '⚠️ Позывной табылган жок',
                        message: `Позывной "${targetCallsign}" менен водитель жок`,
                        type: 'error',
                    });
                }
                else if (targetDriver.status !== 'ONLINE') {
                    server_2.io.to('admin-room').emit('notification', {
                        title: '⚠️ Водитель онлайн эмес',
                        message: `${targetDriver.firstName} (${targetDriver.callsign}) — статусу: ${targetDriver.status}`,
                        type: 'warning',
                    });
                    // Still send — will appear in available orders
                    server_2.io.to(`driver:${targetDriver.id}`).emit('order:available', order);
                }
                else {
                    // Check not already busy
                    const activeOrderCheck = await server_1.prisma.order.findFirst({
                        where: { driverId: targetDriver.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
                    });
                    if (activeOrderCheck) {
                        server_2.io.to('admin-room').emit('notification', {
                            title: '⚠️ Водитель башка заказда',
                            message: `${targetDriver.firstName} (${targetDriver.callsign}) — учурда башка заказда. Бошогондо жиберилет.`,
                            type: 'warning',
                        });
                    }
                    // Send to targeted driver + fallback chain if rejected
                    const candidates = [{ ...targetDriver, distance: 0 }, ...onlineDrivers
                            .filter(d => d.id !== targetDriver.id)
                            .map(d => ({ ...d, distance: 999 }))];
                    startOrderAssignment(order, candidates, server_2.io);
                    server_2.io.to('admin-room').emit('notification', {
                        title: '🎯 Заказ жөнөтүлдү',
                        message: `#${orderNumber} → ${targetDriver.firstName} (${targetDriver.callsign})`,
                        type: 'targeted_dispatch',
                    });
                }
                server_2.io.emit('order:available', order);
                return res.status(201).json(order);
            }
            if (onlineDrivers.length > 0) {
                // Filter out drivers who already have an active order
                const busyDriverIds = (await server_1.prisma.order.findMany({
                    where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
                    select: { driverId: true },
                })).map(o => o.driverId).filter(Boolean);
                const freeDrivers = onlineDrivers.filter(d => !busyDriverIds.includes(d.id));
                if (freeDrivers.length > 0) {
                    // Calculate real GPS distance for each driver
                    const candidatesWithDistance = freeDrivers.map(d => {
                        let dist = 999; // default far away
                        if (d.latitude && d.longitude && finalPickupLat && finalPickupLng) {
                            dist = (0, tariff_1.calculateDistance)(d.latitude, d.longitude, finalPickupLat, finalPickupLng);
                        }
                        return { ...d, distance: dist };
                    });
                    // Sort by distance — nearest first
                    candidatesWithDistance.sort((a, b) => a.distance - b.distance);
                    // Nearest driver threshold: 5km
                    const NEAR_THRESHOLD_KM = 5;
                    const nearDrivers = candidatesWithDistance.filter(d => d.distance <= NEAR_THRESHOLD_KM);
                    const farDrivers = candidatesWithDistance.filter(d => d.distance > NEAR_THRESHOLD_KM);
                    if (nearDrivers.length > 0) {
                        // Send to nearest drivers only
                        console.log(`🚀 Auto-assign: nearest ${nearDrivers.length} drivers for order #${orderNumber} (closest: ${(nearDrivers[0].distance).toFixed(1)}km)`);
                        startOrderAssignment(order, nearDrivers, server_2.io);
                    }
                    else {
                        // No nearby drivers — put in available orders for all drivers
                        console.log(`📋 No nearby drivers for #${orderNumber} — adding to available orders`);
                        server_2.io.to('admin-room').emit('notification', {
                            title: 'Жакын водитель жок',
                            message: `#${orderNumber} — бардык водительдер алыс. Доступные заказыга кошулду.`,
                            type: 'no_nearby_drivers',
                        });
                    }
                    // Broadcast to ALL free drivers as available order (backup)
                    freeDrivers.forEach(d => {
                        server_2.io.to(`driver:${d.id}`).emit('order:available', order);
                    });
                }
                else {
                    server_2.io.to('admin-room').emit('notification', {
                        title: 'Бош водитель жок',
                        message: `#${orderNumber} — бардык онлайн водительдер башка заказда`,
                        type: 'no_drivers',
                    });
                }
                // Also broadcast to ALL online drivers as available order (backup)
                server_2.io.emit('order:available', order);
            }
            else {
                server_2.io.to('admin-room').emit('notification', {
                    title: 'Водитель жок',
                    message: `#${orderNumber} — онлайн водитель табылган жок`,
                    type: 'no_drivers',
                });
            }
        }
        catch (e) {
            console.error('Auto-assign error:', e);
        }
        // Notify admin room
        server_2.io.to('admin-room').emit('order:new', order);
        server_2.io.to('admin-room').emit('notification', {
            title: 'New Order',
            message: `Order #${orderNumber} - ${clientName}`,
            type: 'new_order',
        });
        return res.status(201).json(order);
    }
    catch (error) {
        console.error('Create order error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Accept order
router.patch('/:id/accept', async (req, res) => {
    try {
        const id = req.params.id;
        const { driverId } = req.body;
        const order = await server_1.prisma.order.findUnique({ where: { id } });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.status !== 'PENDING') {
            return res.status(400).json({ error: 'Заказ башка водитель тарабынан алынган' });
        }
        // Check driver balance before accepting
        const driverCheck = await server_1.prisma.driver.findUnique({ where: { id: driverId } });
        if (!driverCheck)
            return res.status(404).json({ error: 'Driver not found' });
        if ((driverCheck.balance || 0) < 20) {
            return res.status(400).json({ error: 'Балансыңыз жетишсиз (20 баланс керек)' });
        }
        // Check driver does NOT already have an active order
        const activeOrder = await server_1.prisma.order.findFirst({
            where: { driverId, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
        });
        if (activeOrder) {
            return res.status(400).json({ error: 'Алгачкы заказды бүтүрүңүз, анан жаңы заказ алыңыз' });
        }
        // ATOMIC accept — only update if still PENDING (prevents race condition / double assignment)
        const updatedOrder = await server_1.prisma.order.updateMany({
            where: { id, status: 'PENDING' },
            data: {
                driverId,
                status: 'ASSIGNED',
                assignedAt: new Date(),
            },
        });
        if (updatedOrder.count === 0) {
            return res.status(400).json({ error: 'Заказ башка водитель тарабынан алынган' });
        }
        const finalOrder = await server_1.prisma.order.findUnique({
            where: { id },
            include: { driver: true },
        });
        await server_1.prisma.driver.update({
            where: { id: driverId },
            data: { status: 'BUSY' },
        });
        // Notify all to remove this order
        server_2.io.emit('order:taken', { orderId: id, driverId });
        server_2.io.to('admin-room').emit('order:taken', { orderId: id, driverId });
        server_2.io.to('admin-room').emit('order:accepted', finalOrder);
        server_2.io.to('admin-room').emit('order:status-changed', { orderId: id, status: 'ASSIGNED', order: finalOrder });
        return res.json(finalOrder);
    }
    catch (error) {
        console.error('Accept order error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Complete order
router.patch('/:id/complete', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const order = await server_1.prisma.order.findUnique({ where: { id } });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        // Calculate wait fee: if driver arrived more than 2 minutes ago, add 20 som
        let waitFee = 0;
        if (order.assignedAt) {
            const waitMs = Date.now() - new Date(order.assignedAt).getTime();
            const waitMinutes = waitMs / 60000;
            if (waitMinutes > 2) {
                waitFee = 20; // 20 som per extra wait
            }
        }
        const finalPrice = order.price + waitFee;
        const updated = await server_1.prisma.order.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                price: finalPrice,
            },
        });
        if (updated.driverId) {
            // Деduct commission from balance: 12 сом кундузу (06:00-00:00), 14 сом түнкүсү (00:00-06:00)
            const commissionAmount = (0, tariff_1.getCommissionAmount)();
            const driver = await server_1.prisma.driver.findUnique({ where: { id: updated.driverId } });
            const newBalance = Math.max(0, (driver?.balance || 0) - commissionAmount);
            await server_1.prisma.driver.update({
                where: { id: updated.driverId },
                data: {
                    status: 'ONLINE',
                    totalOrders: { increment: 1 },
                    totalEarnings: { increment: updated.driverEarning || finalPrice },
                    balance: newBalance,
                },
            });
        }
        // Create payment record
        await server_1.prisma.payment.create({
            data: {
                orderId: updated.id,
                amount: finalPrice,
                method: updated.paymentMethod,
                status: 'completed',
            },
        });
        server_2.io.to('admin-room').emit('order:completed', updated);
        return res.json({ ...updated, waitFee });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Cancel order by CLIENT — only within 14 seconds of creation
router.patch('/:id/client-cancel', async (req, res) => {
    try {
        const id = req.params.id;
        const order = await server_1.prisma.order.findUnique({ where: { id } });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        // Check if within 14 seconds
        const elapsed = Date.now() - new Date(order.createdAt).getTime();
        if (elapsed > 14000) {
            return res.status(400).json({ error: 'Отмена мөөнөтү өттү (14 секунд)', expired: true });
        }
        // Cancel the order
        await server_1.prisma.order.update({
            where: { id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        // If driver was assigned, free them
        if (order.driverId) {
            await server_1.prisma.driver.update({
                where: { id: order.driverId },
                data: { status: 'ONLINE' },
            });
            server_2.io.to(`driver:${order.driverId}`).emit('order:cancelled-by-client', { orderId: id });
        }
        // Notify everyone
        server_2.io.emit('order:cancelled', { orderId: id });
        server_2.io.to('admin-room').emit('notification', {
            title: 'Клиент отмена кылды',
            message: `#${order.orderNumber} клиент тарабынан отмена болду`,
            type: 'order_cancelled',
        });
        return res.json({ success: true, message: 'Заказ отмена кылынды' });
    }
    catch (error) {
        console.error('Client cancel error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Cancel order — 3-step warning system
router.patch('/:id/cancel', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const { driverId, cancelStep } = req.body;
        // cancelStep: 1 = first warning, 2 = second warning, 3 = block driver
        const order = await server_1.prisma.order.findUnique({ where: { id } });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        // Step 1 & 2: just return warning, don't cancel
        if (cancelStep === 1) {
            return res.json({ warning: true, step: 1, message: 'Заказ аяктаган жок! Чын эле отмена кыласызбы?' });
        }
        if (cancelStep === 2) {
            return res.json({ warning: true, step: 2, message: 'Заказды аяктаңыз! Кийинки аракетте блоктолосуз.' });
        }
        // Step 3: cancel order + block driver for 5 hours
        await server_1.prisma.order.update({
            where: { id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        const blockDriverId = driverId || order.driverId;
        // Only block driver if the cancel was initiated by the DRIVER themselves, not by admin
        if (blockDriverId && req.user?.role === 'DRIVER') {
            const blockedUntil = new Date(Date.now() + 5 * 60 * 60 * 1000); // +5 hours
            await server_1.prisma.driver.update({
                where: { id: blockDriverId },
                data: {
                    status: 'OFFLINE',
                    accountStatus: 'BLOCKED',
                    blockedUntil,
                },
            });
            server_2.io.to(`driver:${blockDriverId}`).emit('driver:blocked', {
                blockedUntil: blockedUntil.toISOString(),
                reason: 'Заказды аяктабай отмена кылдыңыз',
            });
        }
        server_2.io.emit('order:cancelled', { orderId: id });
        if (blockDriverId && req.user?.role === 'DRIVER') {
            server_2.io.to('admin-room').emit('driver:blocked-notification', {
                driverId: blockDriverId,
                blockedUntil: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
            });
        }
        return res.json({
            warning: false,
            step: 3,
            message: 'Сиз заказды аяктаган жоксуз. 5 саатка блоктолдуңуз.',
            blocked: true,
        });
    }
    catch (error) {
        console.error('Cancel order error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Unblock driver manually (admin)
router.patch('/driver/:driverId/unblock', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { driverId } = req.params;
        await server_1.prisma.driver.update({
            where: { id: driverId },
            data: { accountStatus: 'ACTIVE', blockedUntil: null },
        });
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
