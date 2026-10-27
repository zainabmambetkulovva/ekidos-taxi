"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const server_2 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const tariff_1 = require("../lib/tariff");
const orders_1 = require("../lib/orders");
const router = (0, express_1.Router)();
// Токен болсо — водительдин id'син кайтарат (милдеттүү эмес авторизация)
function optionalDriverId(req) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token)
        return null;
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'secret');
        return decoded?.role === 'DRIVER' ? decoded.id : null;
    }
    catch {
        return null;
    }
}
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
                include: { driver: { select: orders_1.SAFE_DRIVER_SELECT } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            server_1.prisma.order.count({ where }),
        ]);
        // Позывной менен берилген (али алына элек) заказдарга позывнойду кошобуз
        const targetIds = Array.from(new Set(orders.filter(o => !o.driverId && o.targetDriverId).map(o => o.targetDriverId)));
        const targets = targetIds.length
            ? await server_1.prisma.driver.findMany({ where: { id: { in: targetIds } }, select: { id: true, callsign: true } })
            : [];
        const callsignById = new Map(targets.map(t => [t.id, t.callsign]));
        const withTargets = orders.map(o => (o.targetDriverId && !o.driverId ? { ...o, targetCallsign: callsignById.get(o.targetDriverId) || null } : o));
        return res.json({ orders: withTargets, total, page: parseInt(page), limit: parseInt(limit) });
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
        // Позывной менен берилген заказды ошол водитель гана көрөт
        const driverId = optionalDriverId(req) || req.query.driverId || null;
        const orders = await server_1.prisma.order.findMany({
            where: {
                status: 'PENDING',
                OR: driverId ? [{ targetDriverId: null }, { targetDriverId: driverId }] : [{ targetDriverId: null }],
            },
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
        // Позывной көрсөтүлсө — алгач водительди табабыз. Табылбаса заказ түзүлбөйт.
        let targetDriver = null;
        if (targetCallsign && targetCallsign.toString().trim()) {
            targetDriver = await (0, orders_1.findDriverByCallsign)(targetCallsign);
            if (!targetDriver) {
                return res.status(400).json({ error: `Позывной "${targetCallsign}" менен водитель табылган жок` });
            }
            if (targetDriver.accountStatus !== 'ACTIVE') {
                return res.status(400).json({ error: `Позывной ${targetDriver.callsign} — аккаунт активдүү эмес (${targetDriver.accountStatus})` });
            }
        }
        const orderNumber = generateOrderNumber();
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
                targetDriverId: targetDriver?.id || null,
                // @ts-ignore — options field added via ALTER TABLE, Prisma client regenerated on deploy
                options: Array.isArray(options) ? options : [],
            },
        });
        // Жоопту дароо кайтарабыз — калганы фондо
        res.status(201).json(order);
        // Create or update client (non-critical)
        server_1.prisma.client.upsert({
            where: { phone: safeClientPhone },
            update: { name: safeClientName, totalOrders: { increment: 1 } },
            create: { name: safeClientName, phone: safeClientPhone, totalOrders: 1 },
        }).catch(() => { });
        server_2.io.to('admin-room').emit('order:new', order);
        if (targetDriver) {
            // === TARGETED DISPATCH: ошол позывнойго ГАНА ===
            server_2.io.to(`driver:${targetDriver.id}`).emit('order:available', order);
            if (targetDriver.status !== 'ONLINE') {
                server_2.io.to('admin-room').emit('notification', {
                    title: '⚠️ Водитель онлайн эмес',
                    message: `#${orderNumber} → ${targetDriver.callsign} ${targetDriver.firstName} (${targetDriver.status}). Линияга чыкканда ага гана жиберилет.`,
                    type: 'warning',
                });
            }
            else {
                server_2.io.to('admin-room').emit('notification', {
                    title: '🎯 Заказ жөнөтүлдү',
                    message: `#${orderNumber} → ${targetDriver.callsign} ${targetDriver.firstName} (башка водительге кетпейт)`,
                    type: 'targeted_dispatch',
                });
            }
            (0, orders_1.dispatchOrder)(order).catch(e => console.error('Targeted dispatch error:', e));
            return;
        }
        // === AUTO DISPATCH: жакын бош водительдер ===
        server_2.io.emit('order:available', order);
        (0, orders_1.dispatchOrder)(order).catch(e => console.error('Auto-assign error:', e));
        server_2.io.to('admin-room').emit('notification', {
            title: 'New Order',
            message: `Order #${orderNumber} - ${safeClientName}`,
            type: 'new_order',
        });
    }
    catch (error) {
        console.error('Create order error:', error);
        if (!res.headersSent)
            return res.status(500).json({ error: 'Internal server error' });
    }
});
// Accept order — баланстан 12 сом (00:00–07:00 — 14 сом) дароо алынат
router.patch('/:id/accept', async (req, res) => {
    try {
        const result = await (0, orders_1.acceptOrder)(req.params.id, req.body.driverId);
        if (!result.ok)
            return res.status(result.status).json(result.body);
        return res.json({ ...result.order, newBalance: result.balance });
    }
    catch (error) {
        console.error('Accept order error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Complete order
router.patch('/:id/complete', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const result = await (0, orders_1.completeOrder)(req.params.id);
        if (!result.ok)
            return res.status(result.status).json(result.body);
        return res.json(result.order);
    }
    catch (error) {
        console.error('Complete order error:', error);
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
        (0, orders_1.stopDispatch)(id);
        // If driver was assigned, free them
        if (order.driverId) {
            await (0, orders_1.releaseDriver)(order.driverId, id);
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
        (0, orders_1.stopDispatch)(id);
        const blockDriverId = driverId || order.driverId;
        // Диспетчер отмена кылса — водитель кайра бош (ONLINE) болот
        if (order.driverId && req.user?.role !== 'DRIVER') {
            await (0, orders_1.releaseDriver)(order.driverId, id);
        }
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
            server_2.io.emit('driver:status-changed', { driverId: blockDriverId, status: 'OFFLINE' });
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
