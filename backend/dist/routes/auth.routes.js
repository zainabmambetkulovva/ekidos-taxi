"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const server_1 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Admin login
router.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        const admin = await server_1.prisma.admin.findUnique({ where: { email } });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isValidPassword = await bcrypt_1.default.compare(password, admin.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!admin.isActive) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }
        const token = jsonwebtoken_1.default.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
        const refreshToken = jsonwebtoken_1.default.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_REFRESH_SECRET || 'refresh-secret', { expiresIn: '7d' });
        return res.json({
            token,
            refreshToken,
            user: {
                id: admin.id,
                email: admin.email,
                firstName: admin.firstName,
                lastName: admin.lastName,
                role: admin.role,
                avatar: admin.avatar,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Driver login (OTP)
router.post('/driver/request-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        const driver = await server_1.prisma.driver.findUnique({ where: { phone } });
        if (!driver) {
            return res.status(404).json({
                error: 'Сиз биздин базада жоксуз. Сураныч диспетчерге кайрылыңыз.'
            });
        }
        if (driver.accountStatus === 'BLOCKED') {
            return res.status(403).json({ error: 'Your account is blocked. Contact dispatcher.' });
        }
        // Generate OTP
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await server_1.prisma.oTP.create({
            data: {
                phone,
                code,
                expiresAt,
                driverId: driver.id,
            },
        });
        // In production, send via WhatsApp API
        console.log(`📱 OTP for ${phone}: ${code}`);
        return res.json({ message: 'OTP sent successfully', phone });
    }
    catch (error) {
        console.error('OTP request error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Driver login with phone + password
router.post('/driver/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password) {
            return res.status(400).json({ error: 'Телефон жана пароль жазылышы керек' });
        }
        // Check if input looks like a callsign (not a phone number)
        if (!phone.startsWith('+') && !phone.startsWith('0') && !phone.startsWith('996')) {
            // Try to find driver by callsign
            const callsignDriver = await server_1.prisma.driver.findFirst({
                where: { callsign: phone },
                include: { vehicle: true },
            });
            if (callsignDriver) {
                if (callsignDriver.accountStatus === 'BLOCKED') {
                    return res.status(403).json({ error: 'Аккаунтуңуз бөгөттөлгөн. Диспетчерге кайрылыңыз.' });
                }
                if (!callsignDriver.password) {
                    return res.status(400).json({ error: 'Пароль дагы орнотулган эмес. Диспетчерге кайрылыңыз.' });
                }
                const isValidCallsign = await bcrypt_1.default.compare(password, callsignDriver.password);
                if (!isValidCallsign) {
                    return res.status(401).json({ error: 'Пароль туура эмес' });
                }
                const callsignToken = jsonwebtoken_1.default.sign({ id: callsignDriver.id, phone: callsignDriver.phone, role: 'DRIVER' }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
                return res.json({
                    token: callsignToken,
                    driver: {
                        id: callsignDriver.id,
                        firstName: callsignDriver.firstName,
                        lastName: callsignDriver.lastName,
                        phone: callsignDriver.phone,
                        status: callsignDriver.status,
                        accountStatus: callsignDriver.accountStatus,
                        vehicle: callsignDriver.vehicle,
                        rating: callsignDriver.rating,
                        totalEarnings: callsignDriver.totalEarnings,
                        totalOrders: callsignDriver.totalOrders,
                    },
                });
            }
        }
        // Normalize phone: remove spaces, add +996 if needed
        let normalizedPhone = phone.replace(/\s+/g, '');
        if (normalizedPhone.startsWith('0')) {
            normalizedPhone = '+996' + normalizedPhone.slice(1);
        }
        if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = '+' + normalizedPhone;
        }
        // Try exact match first, then normalized
        let driver = await server_1.prisma.driver.findUnique({
            where: { phone: normalizedPhone },
            include: { vehicle: true },
        });
        // Try with spaces (how admin might have saved it)
        if (!driver) {
            const withSpace = normalizedPhone.replace('+996', '+996 ');
            driver = await server_1.prisma.driver.findUnique({
                where: { phone: withSpace },
                include: { vehicle: true },
            });
        }
        // Try original input
        if (!driver) {
            driver = await server_1.prisma.driver.findUnique({
                where: { phone },
                include: { vehicle: true },
            });
        }
        if (!driver) {
            return res.status(404).json({
                error: 'Сиз биздин базада жоксуз. Сураныч диспетчерге кайрылыңыз.',
            });
        }
        if (driver.accountStatus === 'BLOCKED') {
            return res.status(403).json({ error: 'Аккаунтуңуз бөгөттөлгөн. Диспетчерге кайрылыңыз.' });
        }
        if (!driver.password) {
            return res.status(400).json({ error: 'Пароль дагы орнотулган эмес. Диспетчерге кайрылыңыз.' });
        }
        const isValid = await bcrypt_1.default.compare(password, driver.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Пароль туура эмес' });
        }
        const token = jsonwebtoken_1.default.sign({ id: driver.id, phone: driver.phone, role: 'DRIVER' }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
        return res.json({
            token,
            driver: {
                id: driver.id,
                firstName: driver.firstName,
                lastName: driver.lastName,
                phone: driver.phone,
                status: driver.status,
                accountStatus: driver.accountStatus,
                vehicle: driver.vehicle,
                rating: driver.rating,
                totalEarnings: driver.totalEarnings,
                totalOrders: driver.totalOrders,
            },
        });
    }
    catch (error) {
        console.error('Driver login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Verify OTP
router.post('/driver/verify-otp', async (req, res) => {
    try {
        const { phone, code } = req.body;
        if (!phone || !code) {
            return res.status(400).json({ error: 'Phone and OTP code are required' });
        }
        const otp = await server_1.prisma.oTP.findFirst({
            where: {
                phone,
                code,
                isUsed: false,
                expiresAt: { gte: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!otp) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }
        // Mark OTP as used
        await server_1.prisma.oTP.update({
            where: { id: otp.id },
            data: { isUsed: true },
        });
        const driver = await server_1.prisma.driver.findUnique({
            where: { phone },
            include: { vehicle: true },
        });
        if (!driver) {
            return res.status(404).json({ error: 'Driver not found' });
        }
        const token = jsonwebtoken_1.default.sign({ id: driver.id, phone: driver.phone, role: 'DRIVER' }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
        return res.json({
            token,
            driver: {
                id: driver.id,
                firstName: driver.firstName,
                lastName: driver.lastName,
                phone: driver.phone,
                status: driver.status,
                accountStatus: driver.accountStatus,
                vehicle: driver.vehicle,
                rating: driver.rating,
                totalEarnings: driver.totalEarnings,
                totalOrders: driver.totalOrders,
            },
        });
    }
    catch (error) {
        console.error('OTP verify error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Get current user
router.get('/me', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role === 'DRIVER') {
            const driver = await server_1.prisma.driver.findUnique({
                where: { id: req.user.id },
                include: { vehicle: true },
            });
            return res.json(driver);
        }
        const admin = await server_1.prisma.admin.findUnique({
            where: { id: req.user.id },
        });
        if (admin) {
            const { password, ...adminData } = admin;
            return res.json(adminData);
        }
        return res.status(404).json({ error: 'User not found' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh-secret');
        const token = jsonwebtoken_1.default.sign({ id: decoded.id, email: decoded.email, role: decoded.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '24h' });
        return res.json({ token });
    }
    catch (error) {
        return res.status(403).json({ error: 'Invalid refresh token' });
    }
});
exports.default = router;
