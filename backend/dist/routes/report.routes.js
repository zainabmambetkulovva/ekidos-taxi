"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Get reports
router.get('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { type = 'daily', dateFrom, dateTo } = req.query;
        const today = new Date();
        let startDate;
        let endDate = new Date();
        switch (type) {
            case 'daily':
                startDate = new Date(today);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
                startDate = new Date(today);
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'monthly':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'yearly':
                startDate = new Date(today.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(today);
                startDate.setHours(0, 0, 0, 0);
        }
        if (dateFrom)
            startDate = new Date(dateFrom);
        if (dateTo)
            endDate = new Date(dateTo);
        const range = { createdAt: { gte: startDate, lte: endDate } };
        const [totalOrders, completedOrders, cancelledOrders, revenue, cancelGroups, orders] = await Promise.all([
            server_1.prisma.order.count({ where: range }),
            server_1.prisma.order.count({ where: { ...range, status: 'COMPLETED' } }),
            server_1.prisma.order.count({ where: { ...range, status: 'CANCELLED' } }),
            server_1.prisma.order.aggregate({ where: { ...range, status: 'COMPLETED' }, _sum: { price: true } }),
            server_1.prisma.order.groupBy({ by: ['cancelledBy'], where: { ...range, status: 'CANCELLED' }, _count: { _all: true } }),
            server_1.prisma.order.findMany({
                where: range,
                include: {
                    driver: { select: { id: true, firstName: true, lastName: true, callsign: true, phone: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        // Ким канча отмена кылды: { DISPATCHER: 3, CLIENT: 1, DRIVER: 0, UNKNOWN: 2 }
        const cancelledBy = { DISPATCHER: 0, CLIENT: 0, DRIVER: 0, SYSTEM: 0, UNKNOWN: 0 };
        cancelGroups.forEach(g => {
            cancelledBy[g.cancelledBy || 'UNKNOWN'] = (cancelledBy[g.cancelledBy || 'UNKNOWN'] || 0) + g._count._all;
        });
        return res.json({
            period: type,
            startDate,
            endDate,
            totalOrders,
            completedOrders,
            cancelledOrders,
            cancelledBy,
            revenue: revenue._sum.price || 0,
            orders,
        });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
