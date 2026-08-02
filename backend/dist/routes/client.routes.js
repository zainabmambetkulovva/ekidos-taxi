"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const server_1 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Get all clients
router.get('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { search, page = '1', limit = '50' } = req.query;
        const where = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
            ];
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [clients, total] = await Promise.all([
            server_1.prisma.client.findMany({
                where,
                include: { orders: { take: 5, orderBy: { createdAt: 'desc' } } },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            server_1.prisma.client.count({ where }),
        ]);
        return res.json({ clients, total, page: parseInt(page), limit: parseInt(limit) });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Get single client
router.get('/:id', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const client = await server_1.prisma.client.findUnique({
            where: { id },
            include: { orders: { orderBy: { createdAt: 'desc' } } },
        });
        if (!client)
            return res.status(404).json({ error: 'Client not found' });
        return res.json(client);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
