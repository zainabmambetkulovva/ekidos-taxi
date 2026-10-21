"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const server_2 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Get chat messages (paginated, most recent first)
router.get('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { page = '1', limit = '50' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [messages, total] = await Promise.all([
            server_1.prisma.chatMessage.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            server_1.prisma.chatMessage.count(),
        ]);
        // Return in chronological order (oldest first) for display
        return res.json({
            messages: messages.reverse(),
            total,
            page: parseInt(page),
            limit: parseInt(limit),
        });
    }
    catch (error) {
        console.error('Get chat messages error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Send a message (driver or dispatcher)
router.post('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { text, senderType, senderId, senderName } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Message text required' });
        }
        if (!senderType || !senderId || !senderName) {
            return res.status(400).json({ error: 'Sender info required' });
        }
        const message = await server_1.prisma.chatMessage.create({
            data: {
                text: text.trim(),
                senderType,
                senderId,
                senderName,
            },
        });
        // Broadcast to all connected clients via Socket.IO
        server_2.io.emit('chat:message', message);
        return res.status(201).json(message);
    }
    catch (error) {
        console.error('Send chat message error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
