"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const server_1 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Get all admins
router.get('/', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const admins = await server_1.prisma.admin.findMany({
            select: {
                id: true, email: true, firstName: true,
                lastName: true, role: true, isActive: true, createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(admins);
    }
    catch (error) {
        console.error('Admin GET error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Create/Update admin
router.post('/', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const { email, password, firstName, lastName, role } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Введите корректный email' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Пароль минимум 6 символов' });
        }
        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'Заполните имя и фамилию' });
        }
        // Check if email exists in admins table
        const existingAdmin = await server_1.prisma.admin.findUnique({ where: { email } });
        if (!existingAdmin) {
            return res.status(404).json({
                error: 'not_found',
                message: `Пользователь с email "${email}" не найден в системе. Администратором можно назначить только зарегистрированного пользователя.`,
            });
        }
        // User exists — update role and credentials
        const hashedPassword = await bcrypt_1.default.hash(password, 12);
        const updatedAdmin = await server_1.prisma.admin.update({
            where: { email },
            data: {
                password: hashedPassword,
                firstName,
                lastName,
                role: role || 'ADMIN',
                isActive: true,
            },
            select: {
                id: true, email: true, firstName: true,
                lastName: true, role: true, isActive: true, createdAt: true,
            },
        });
        return res.json({ ...updatedAdmin, updated: true });
    }
    catch (error) {
        console.error('Admin POST error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete admin
router.delete('/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const id = req.params.id;
        await server_1.prisma.admin.delete({ where: { id } });
        return res.json({ message: 'Admin deleted' });
    }
    catch (error) {
        console.error('Admin DELETE error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
