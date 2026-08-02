"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Get notifications
router.get('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const notifications = await server_1.prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            skip,
            take: parseInt(limit),
        });
        const unreadCount = await server_1.prisma.notification.count({ where: { isRead: false } });
        return res.json({ notifications, unreadCount });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark as read
router.patch('/:id/read', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        await server_1.prisma.notification.update({
            where: { id },
            data: { isRead: true },
        });
        return res.json({ message: 'Marked as read' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Mark all as read
router.patch('/read-all', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        await server_1.prisma.notification.updateMany({
            where: { isRead: false },
            data: { isRead: true },
        });
        return res.json({ message: 'All marked as read' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
