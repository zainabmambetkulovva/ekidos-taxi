"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const server_2 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tariff_1 = require("../lib/tariff");
const router = (0, express_1.Router)();
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
// Get available orders for drivers (also returns online driver positions for client map)
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
        const { pickupAddress, destAddress, clientName, clientPhone, tariff, comment, paymentMethod, price } = req.body;
        if (!pickupAddress) {
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
        // Geocode addresses
        const { geocodeAddress } = await Promise.resolve().then(() => __importStar(require('../lib/geocode')));
        const [pickupCoords, destCoords] = await Promise.all([
            geocodeAddress(pickupAddress),
            geocodeAddress(destAddress),
        ]);
        // Calculate price automatically if coordinates available
        let orderPrice = inputPrice;
        let driverEarning = 0;
        let companyCommission = 0;
        let distance = 0;
        if (pickupCoords && destCoords) {
            const dist = (0, tariff_1.calculateDistance)(pickupCoords.lat, pickupCoords.lng, destCoords.lat, destCoords.lng);
            distance = Math.round(dist * 1.4 * 10) / 10; // road distance estimate
            if (orderPrice === 0) {
                // Auto-calculate if no manual price given
                const pricing = (0, tariff_1.calculatePrice)(distance, tariff || 'Standard');
                orderPrice = pricing.total;
                driverEarning = pricing.driverEarning;
                companyCommission = pricing.companyCommission;
            }
            else {
                // Manual price — still calculate commission
                companyCommission = Math.round(orderPrice * 0.15);
                driverEarning = orderPrice - companyCommission;
            }
        }
        else if (orderPrice > 0) {
            companyCommission = Math.round(orderPrice * 0.15);
            driverEarning = orderPrice - companyCommission;
        }
        const order = await server_1.prisma.order.create({
            data: {
                orderNumber,
                pickupAddress,
                destAddress: destAddress || 'Не указано',
                pickupLat: pickupCoords?.lat || null,
                pickupLng: pickupCoords?.lng || null,
                destLat: destCoords?.lat || null,
                destLng: destCoords?.lng || null,
                clientName: safeClientName,
                clientPhone: safeClientPhone,
                tariff: tariff || 'Standard',
                comment: comment || null,
                paymentMethod: paymentMethod || 'CASH',
                price: orderPrice,
                driverEarning,
                companyCommission,
                distance,
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
        // Auto-assign nearest driver within 500m
        if (pickupCoords) {
            try {
                const onlineDrivers = await server_1.prisma.driver.findMany({
                    where: {
                        status: 'ONLINE',
                        accountStatus: 'ACTIVE',
                        latitude: { not: null },
                        longitude: { not: null },
                    },
                    select: { id: true, firstName: true, lastName: true, latitude: true, longitude: true },
                });
                // Filter drivers within 500m (0.5 km)
                const nearby = onlineDrivers
                    .map(d => ({
                    ...d,
                    distance: (0, tariff_1.calculateDistance)(pickupCoords.lat, pickupCoords.lng, d.latitude, d.longitude),
                }))
                    .filter(d => d.distance <= 0.5);
                if (nearby.length > 0) {
                    // Random selection from nearby drivers
                    const selected = nearby[Math.floor(Math.random() * nearby.length)];
                    // Assign order to selected driver
                    await server_1.prisma.order.update({
                        where: { id: order.id },
                        data: { driverId: selected.id, status: 'ASSIGNED', assignedAt: new Date() },
                    });
                    await server_1.prisma.driver.update({
                        where: { id: selected.id },
                        data: { status: 'BUSY' },
                    });
                    // Notify the selected driver
                    server_2.io.to(`driver:${selected.id}`).emit('order:assigned', { ...order, driverId: selected.id, status: 'ASSIGNED' });
                    server_2.io.to('admin-room').emit('notification', {
                        title: 'Auto-Assigned',
                        message: `Order #${orderNumber} assigned to ${selected.firstName} (${(selected.distance * 1000).toFixed(0)}m)`,
                        type: 'auto_assigned',
                    });
                    console.log(`✅ Auto-assigned #${orderNumber} to ${selected.firstName} (${(selected.distance * 1000).toFixed(0)}m)`);
                }
                else {
                    // No nearby drivers — broadcast to all
                    server_2.io.emit('order:available', order);
                }
            }
            catch (e) {
                // Auto-assign failed — fallback to broadcast
                server_2.io.emit('order:available', order);
            }
        }
        else {
            // No coordinates — broadcast to all
            server_2.io.emit('order:available', order);
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
router.patch('/:id/accept', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const { driverId } = req.body;
        const order = await server_1.prisma.order.findUnique({ where: { id } });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        if (order.status !== 'PENDING') {
            return res.status(400).json({ error: 'Order is no longer available' });
        }
        const updatedOrder = await server_1.prisma.order.update({
            where: { id },
            data: {
                driverId,
                status: 'ASSIGNED',
                assignedAt: new Date(),
            },
            include: { driver: true },
        });
        await server_1.prisma.driver.update({
            where: { id: driverId },
            data: { status: 'BUSY' },
        });
        // Notify all to remove this order
        server_2.io.emit('order:taken', { orderId: id, driverId });
        server_2.io.to('admin-room').emit('order:accepted', updatedOrder);
        return res.json(updatedOrder);
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
            await server_1.prisma.driver.update({
                where: { id: updated.driverId },
                data: {
                    status: 'ONLINE',
                    totalOrders: { increment: 1 },
                    totalEarnings: { increment: updated.driverEarning || finalPrice },
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
        if (blockDriverId) {
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
        server_2.io.to('admin-room').emit('driver:blocked-notification', {
            driverId: blockDriverId,
            blockedUntil: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        });
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
