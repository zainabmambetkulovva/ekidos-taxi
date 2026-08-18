"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const server_1 = require("../server");
const server_2 = require("../server");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
/** Generate random 8-char password: digits + uppercase */
function generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pw = '';
    for (let i = 0; i < 8; i++) {
        pw += chars[Math.floor(Math.random() * chars.length)];
    }
    return pw;
}
// Get all drivers
router.get('/', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { status, accountStatus, search, page = '1', limit = '50' } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (accountStatus) {
            where.accountStatus = accountStatus;
        }
        else {
            // By default, exclude archived drivers from main list
            where.accountStatus = { not: 'ARCHIVED' };
        }
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
            ];
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [drivers, total] = await Promise.all([
            server_1.prisma.driver.findMany({
                where,
                include: { vehicle: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            server_1.prisma.driver.count({ where }),
        ]);
        // Serialize BigInt (telegramId) to string
        const serialize = (obj) => JSON.parse(JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v));
        return res.json({ drivers: serialize(drivers), total, page: parseInt(page), limit: parseInt(limit) });
    }
    catch (error) {
        console.error('Get drivers error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Search drivers by callsign (for admin balance topup)
router.get('/search/callsign', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length === 0) {
            return res.json([]);
        }
        const drivers = await server_1.prisma.driver.findMany({
            where: {
                OR: [
                    { callsign: { contains: q, mode: 'insensitive' } },
                    { firstName: { contains: q, mode: 'insensitive' } },
                    { lastName: { contains: q, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                callsign: true,
                phone: true,
                balance: true,
            },
            take: 10,
        });
        return res.json(drivers);
    }
    catch (error) {
        console.error('Search drivers error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all online/busy drivers with status info (for driver map — see other drivers)
router.get('/online-with-status', async (req, res) => {
    try {
        const drivers = await server_1.prisma.driver.findMany({
            where: {
                status: { in: ['ONLINE', 'BUSY', 'BUSY_PERSONAL'] },
                accountStatus: 'ACTIVE',
                latitude: { not: null },
                longitude: { not: null },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                callsign: true,
                status: true,
                latitude: true,
                longitude: true,
            },
        });
        return res.json(drivers.map(d => ({
            id: d.id,
            lat: d.latitude,
            lng: d.longitude,
            status: d.status,
            name: `${d.firstName} ${d.lastName}`,
            callsign: d.callsign || '',
        })));
    }
    catch (error) {
        return res.json([]);
    }
});
// Get single driver (public - for client to see accepted driver info)
router.get('/:id/public', async (req, res) => {
    try {
        const id = req.params.id;
        const driver = await server_1.prisma.driver.findUnique({
            where: { id },
            select: { firstName: true, lastName: true, phone: true, latitude: true, longitude: true, vehicle: true },
        });
        if (!driver)
            return res.status(404).json({ error: 'Driver not found' });
        return res.json(driver);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Get single driver
router.get('/:id', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const driver = await server_1.prisma.driver.findUnique({
            where: { id },
            include: { vehicle: true, documents: true, orders: { take: 20, orderBy: { createdAt: 'desc' } } },
        });
        if (!driver)
            return res.status(404).json({ error: 'Driver not found' });
        return res.json(driver);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Create driver — auto-generates password, saves hashed + plain
router.post('/', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN', 'DISPATCHER'), async (req, res) => {
    try {
        const { firstName, lastName, middleName, birthDate, phone, whatsappNumber, passportNumber, passportPhoto, licenseNumber, licensePhoto, techPassportNumber, techPassportPhoto, driverPhoto, notes, accountStatus, vehicleBrand, vehicleModel, vehicleYear, vehicleColor, plateNumber, insuranceNumber, telegramId, callsign, } = req.body;
        if (!phone)
            return res.status(400).json({ error: 'Phone number is required' });
        const existing = await server_1.prisma.driver.findUnique({ where: { phone } });
        if (existing) {
            return res.status(400).json({ error: 'Водитель с таким номером уже существует' });
        }
        // Generate unique password for this driver
        const plainPassword = generatePassword();
        const hashedPassword = await bcrypt_1.default.hash(plainPassword, 10);
        const driver = await server_1.prisma.driver.create({
            data: {
                firstName,
                lastName,
                middleName,
                birthDate: birthDate ? new Date(birthDate) : null,
                phone,
                password: hashedPassword,
                displayPassword: plainPassword, // Only visible to admin, not to driver
                whatsappNumber,
                telegramId: telegramId && telegramId.toString().trim() ? BigInt(telegramId.toString().trim()) : null,
                passportNumber,
                passportPhoto,
                licenseNumber,
                licensePhoto,
                techPassportNumber,
                techPassportPhoto,
                driverPhoto,
                notes,
                accountStatus: accountStatus || 'PENDING',
                callsign: callsign || undefined,
                vehicle: vehicleBrand ? {
                    create: {
                        brand: vehicleBrand,
                        model: vehicleModel,
                        year: parseInt(vehicleYear) || new Date().getFullYear(),
                        color: vehicleColor || '',
                        plateNumber: plateNumber || '',
                        insuranceNumber,
                    },
                } : undefined,
            },
            include: { vehicle: true },
        });
        // Notify admins of new driver registration
        server_2.io.to('admin-room').emit('notification', {
            title: 'Новый водитель',
            message: `Зарегистрирован ${firstName} ${lastName} — пароль: ${plainPassword}`,
            type: 'new_driver',
        });
        return res.status(201).json({ ...driver, plainPassword });
    }
    catch (error) {
        console.error('Create driver error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Update driver
router.put('/:id', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const { firstName, lastName, middleName, birthDate, phone, whatsappNumber, passportNumber, passportPhoto, licenseNumber, licensePhoto, techPassportNumber, techPassportPhoto, driverPhoto, notes, accountStatus, vehicleBrand, vehicleModel, vehicleYear, vehicleColor, plateNumber, insuranceNumber, telegramId, callsign, } = req.body;
        const driver = await server_1.prisma.driver.update({
            where: { id },
            data: {
                firstName,
                lastName,
                middleName,
                birthDate: birthDate ? new Date(birthDate) : undefined,
                phone,
                whatsappNumber,
                telegramId: telegramId && telegramId.toString().trim() ? BigInt(telegramId.toString().trim()) : undefined,
                passportNumber,
                passportPhoto,
                licenseNumber,
                licensePhoto,
                techPassportNumber,
                techPassportPhoto,
                driverPhoto,
                notes,
                accountStatus,
                callsign: callsign || undefined,
            },
            include: { vehicle: true },
        });
        if (vehicleBrand && driver.vehicle) {
            await server_1.prisma.vehicle.update({
                where: { id: driver.vehicle.id },
                data: {
                    brand: vehicleBrand,
                    model: vehicleModel,
                    year: parseInt(vehicleYear) || driver.vehicle.year,
                    color: vehicleColor || driver.vehicle.color,
                    plateNumber: plateNumber || driver.vehicle.plateNumber,
                    insuranceNumber,
                },
            });
        }
        else if (vehicleBrand && !driver.vehicle) {
            await server_1.prisma.vehicle.create({
                data: {
                    brand: vehicleBrand,
                    model: vehicleModel,
                    year: parseInt(vehicleYear) || new Date().getFullYear(),
                    color: vehicleColor || '',
                    plateNumber: plateNumber || '',
                    insuranceNumber,
                    driverId: driver.id,
                },
            });
        }
        const updated = await server_1.prisma.driver.findUnique({ where: { id }, include: { vehicle: true } });
        return res.json(updated);
    }
    catch (error) {
        console.error('Update driver error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete driver (soft delete — archive, not permanent)
router.delete('/:id', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const id = req.params.id;
        await server_1.prisma.driver.update({
            where: { id },
            data: {
                accountStatus: 'ARCHIVED',
                status: 'OFFLINE',
            },
        });
        return res.json({ message: 'Driver archived successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Get archived (deleted) drivers
router.get('/archived/list', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const drivers = await server_1.prisma.driver.findMany({
            where: { accountStatus: 'ARCHIVED' },
            include: { vehicle: true },
            orderBy: { updatedAt: 'desc' },
        });
        const serialize = (obj) => JSON.parse(JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v));
        return res.json({ drivers: serialize(drivers), total: drivers.length });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Restore archived driver
router.patch('/:id/restore', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const id = req.params.id;
        await server_1.prisma.driver.update({
            where: { id },
            data: { accountStatus: 'ACTIVE', status: 'OFFLINE' },
        });
        return res.json({ message: 'Driver restored successfully' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Permanently delete archived driver (only for ARCHIVED drivers)
router.delete('/:id/permanent', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN'), async (req, res) => {
    try {
        const id = req.params.id;
        const driver = await server_1.prisma.driver.findUnique({ where: { id } });
        if (!driver)
            return res.status(404).json({ error: 'Driver not found' });
        if (driver.accountStatus !== 'ARCHIVED') {
            return res.status(400).json({ error: 'Алгач архивдеп, анан гана толук өчүрүңүз' });
        }
        await server_1.prisma.driver.delete({ where: { id } });
        return res.json({ message: 'Driver permanently deleted' });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Update driver location (from driver app GPS)
router.patch('/:id/location', async (req, res) => {
    try {
        const id = req.params.id;
        const { latitude, longitude } = req.body;
        if (latitude == null || longitude == null) {
            return res.status(400).json({ error: 'latitude and longitude required' });
        }
        await server_1.prisma.driver.update({
            where: { id },
            data: { latitude, longitude, lastLocationUpdate: new Date() },
        });
        return res.json({ ok: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Update driver status
router.patch('/:id/status', auth_middleware_1.authenticateToken, async (req, res) => {
    try {
        const id = req.params.id;
        const { status } = req.body;
        const driver = await server_1.prisma.driver.update({ where: { id }, data: { status } });
        return res.json(driver);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Reset driver password — generates new random password
router.patch('/:id/reset-password', auth_middleware_1.authenticateToken, (0, auth_middleware_1.authorizeRoles)('ADMIN', 'DISPATCHER'), async (req, res) => {
    try {
        const id = req.params.id;
        const newPassword = generatePassword();
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
        await server_1.prisma.driver.update({
            where: { id },
            data: {
                password: hashedPassword,
                displayPassword: newPassword,
            },
        });
        return res.json({ password: newPassword, message: 'Пароль успешно сброшен' });
    }
    catch (error) {
        console.error('Reset password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// Direct balance topup by admin (no topup request needed)
router.patch('/:id/balance', auth_middleware_1.authenticateToken, async (req, res) => {
    // Must be authenticated admin/dispatcher — not a driver
    if (!req.user || req.user.role === 'DRIVER') {
        return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    try {
        const id = req.params.id;
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }
        const driver = await server_1.prisma.driver.update({
            where: { id },
            data: { balance: { increment: amount } },
        });
        return res.json({
            success: true,
            driverName: `${driver.firstName} ${driver.lastName}`,
            callsign: driver.callsign,
            newBalance: driver.balance,
            amount,
        });
    }
    catch (error) {
        console.error('Direct balance topup error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
