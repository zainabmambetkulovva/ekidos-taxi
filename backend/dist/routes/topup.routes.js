"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// GET /api/topup — get all topup requests (admin)
router.get('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status)
            where.status = status;
        const requests = await server_1.prisma.topupRequest.findMany({
            where,
            include: {
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        balance: true,
                        telegramId: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(requests);
    }
    catch (error) {
        console.error('Get topup requests error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/topup — create topup request (from bot)
router.post('/', async (req, res) => {
    try {
        const { telegramId, driverName, photoUrl, callsign } = req.body;
        if (!telegramId) {
            return res.status(400).json({ error: 'telegramId is required' });
        }
        // Find driver by telegramId OR callsign
        let driver = await server_1.prisma.driver.findFirst({
            where: { telegramId: BigInt(telegramId) },
        });
        // If not found by telegramId, try callsign and link telegramId
        if (!driver && callsign) {
            driver = await server_1.prisma.driver.findFirst({
                where: { callsign: callsign },
            });
            if (driver) {
                // Link telegramId to this driver
                await server_1.prisma.driver.update({
                    where: { id: driver.id },
                    data: { telegramId: BigInt(telegramId) },
                });
            }
        }
        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        const request = await server_1.prisma.topupRequest.create({
            data: {
                driverId: driver.id,
                telegramId: BigInt(telegramId),
                driverName: driverName || `${driver.firstName} ${driver.lastName}`,
                photoUrl: photoUrl || null,
                status: 'PENDING',
            },
        });
        return res.json({ id: request.id, status: 'PENDING', driverName: `${driver.firstName} ${driver.lastName}` });
    }
    catch (error) {
        console.error('Create topup request error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PATCH /api/topup/:id/approve — approve and add balance (admin)
router.patch('/:id/approve', auth_middleware_1.authenticateToken, async (req, res) => {
    // Allow any authenticated admin/dispatcher
    if (!req.user || !['ADMIN', 'DISPATCHER', 'SUPER_ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    try {
        const { id } = req.params;
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }
        const request = await server_1.prisma.topupRequest.findUnique({ where: { id: id } });
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }
        if (request.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request already processed' });
        }
        // Update request status
        await server_1.prisma.topupRequest.update({
            where: { id: id },
            data: { status: 'APPROVED', amount },
        });
        // Add balance to driver
        const driver = await server_1.prisma.driver.update({
            where: { id: request.driverId },
            data: { balance: { increment: amount } },
        });
        return res.json({
            success: true,
            driverName: `${driver.firstName} ${driver.lastName}`,
            newBalance: driver.balance,
            amount,
        });
    }
    catch (error) {
        console.error('Approve topup error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PATCH /api/topup/:id/reject — reject request (admin)
router.patch('/:id/reject', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await server_1.prisma.topupRequest.update({
            where: { id: id },
            data: { status: 'REJECTED' },
        });
        return res.json({ success: true });
    }
    catch (error) {
        console.error('Reject topup error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
