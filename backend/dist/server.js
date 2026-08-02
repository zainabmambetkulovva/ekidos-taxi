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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const driver_routes_1 = __importDefault(require("./routes/driver.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const client_routes_1 = __importDefault(require("./routes/client.routes"));
const stats_routes_1 = __importDefault(require("./routes/stats.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const socket_1 = require("./socket");
dotenv_1.default.config();
// BigInt JSON serialization support
BigInt.prototype.toJSON = function () {
    return this.toString();
};
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
exports.prisma = new client_1.PrismaClient();
exports.io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        credentials: true,
    },
});
// Middleware
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, cors_1.default)({ origin: true, credentials: true }));
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, max: 5,
    message: { error: 'Слишком много попыток. Подождите 1 минуту.' },
    standardHeaders: true,
});
app.use('/api/auth/admin/login', loginLimiter);
app.use('/api/auth/driver/login', loginLimiter);
app.use('/api', (0, express_rate_limit_1.default)({ windowMs: 60 * 1000, max: 100 }));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Routes
app.use('/api/auth', auth_routes_1.default);
app.use('/api/drivers', driver_routes_1.default);
app.use('/api/orders', order_routes_1.default);
app.use('/api/clients', client_routes_1.default);
app.use('/api/stats', stats_routes_1.default);
app.use('/api/settings', settings_routes_1.default);
app.use('/api/upload', upload_routes_1.default);
app.use('/api/reports', report_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use('/api/admins', admin_routes_1.default);
// ===== INLINE TOPUP ROUTES =====
// POST /api/topup — from bot
app.post('/api/topup', async (req, res) => {
    try {
        const { telegramId, driverName, photoUrl } = req.body;
        if (!telegramId)
            return res.status(400).json({ error: 'telegramId is required' });
        const driver = await exports.prisma.driver.findFirst({
            where: { telegramId: BigInt(telegramId.toString()) },
        });
        if (!driver)
            return res.status(404).json({ error: 'Driver not found with this telegramId' });
        const request = await exports.prisma.topupRequest.create({
            data: {
                driverId: driver.id,
                telegramId: BigInt(telegramId.toString()),
                driverName: driverName || `${driver.firstName} ${driver.lastName}`,
                photoUrl: photoUrl || null,
                status: 'PENDING',
            },
        });
        return res.json({ id: request.id, status: 'PENDING' });
    }
    catch (error) {
        console.error('Topup create error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/topup — admin panel
app.get('/api/topup', async (req, res) => {
    try {
        const requests = await exports.prisma.topupRequest.findMany({
            include: {
                driver: { select: { id: true, firstName: true, lastName: true, phone: true, balance: true, telegramId: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(requests);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PATCH /api/topup/:id/approve — admin approves
app.patch('/api/topup/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;
        if (!amount || amount <= 0)
            return res.status(400).json({ error: 'Valid amount required' });
        const request = await exports.prisma.topupRequest.findUnique({ where: { id: id } });
        if (!request)
            return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'PENDING')
            return res.status(400).json({ error: 'Already processed' });
        await exports.prisma.topupRequest.update({ where: { id: id }, data: { status: 'APPROVED', amount } });
        const driver = await exports.prisma.driver.update({
            where: { id: request.driverId },
            data: { balance: { increment: amount } },
        });
        return res.json({ success: true, driverName: `${driver.firstName} ${driver.lastName}`, newBalance: driver.balance, amount });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// PATCH /api/topup/:id/reject
app.patch('/api/topup/:id/reject', async (req, res) => {
    try {
        await exports.prisma.topupRequest.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ===== END TOPUP ROUTES =====
// ===== INCOMING CALL WEBHOOK (from Tasker) =====
// POST /api/incoming-call — Tasker жиберет чалуу болгондо
app.post('/api/incoming-call', (req, res) => {
    const { phone } = req.body;
    if (!phone)
        return res.status(400).json({ error: 'phone required' });
    const cleaned = phone.toString().trim();
    console.log(`📞 Incoming call from: ${cleaned}`);
    // Socket.IO аркылуу бардык диспетчерлерге жибер
    exports.io.to('admin-room').emit('incoming:call', { phone: cleaned, time: new Date().toISOString() });
    return res.json({ success: true, phone: cleaned });
});
// ===== END INCOMING CALL =====
// ===== CALLSIGN LOGIN (inline to bypass Railway cache) =====
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
app.post('/api/auth/callsign-login', async (req, res) => {
    try {
        const { callsign, password } = req.body;
        if (!callsign || !password)
            return res.status(400).json({ error: 'Позывной жана пароль керек' });
        const driver = await exports.prisma.driver.findFirst({
            where: { callsign: callsign.toString().trim() },
            include: { vehicle: true },
        });
        if (!driver)
            return res.status(404).json({ error: 'Позывной табылган жок. Диспетчерге кайрылыңыз.' });
        if (driver.accountStatus === 'BLOCKED')
            return res.status(403).json({ error: 'Аккаунтуңуз бөгөттөлгөн' });
        if (!driver.password)
            return res.status(400).json({ error: 'Пароль дагы орнотулган эмес' });
        const isValid = await bcrypt_1.default.compare(password, driver.password);
        if (!isValid)
            return res.status(401).json({ error: 'Пароль туура эмес' });
        const token = jsonwebtoken_1.default.sign({ id: driver.id, phone: driver.phone, role: 'DRIVER' }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
        return res.json({
            token,
            driver: {
                id: driver.id, firstName: driver.firstName, lastName: driver.lastName,
                phone: driver.phone, callsign: driver.callsign, status: driver.status,
                accountStatus: driver.accountStatus, vehicle: driver.vehicle,
                rating: driver.rating, totalEarnings: driver.totalEarnings, totalOrders: driver.totalOrders,
            },
        });
    }
    catch (error) {
        console.error('Callsign login error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ===== SAVE CALLSIGN (inline) =====
app.patch('/api/drivers/:id/callsign', async (req, res) => {
    try {
        const { callsign } = req.body;
        const { id } = req.params;
        await exports.prisma.driver.update({ where: { id: id }, data: { callsign: callsign || null } });
        return res.json({ success: true });
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ===== CLIENT AUTH (email + OTP password) =====
app.post('/api/auth/client/request-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@'))
            return res.status(400).json({ error: 'Email туура эмес' });
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const phone = `email:${email.toLowerCase().trim()}`;
        await exports.prisma.oTP.create({ data: { phone, code, expiresAt } });
        console.log(`📧 Client OTP for ${email}: ${code}`);
        // Send email via Resend (lazy init)
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
            try {
                const { Resend } = await Promise.resolve().then(() => __importStar(require('resend')));
                const resendClient = new Resend(resendKey);
                await resendClient.emails.send({
                    from: 'EKIDOS TAXI <onboarding@resend.dev>',
                    to: email,
                    subject: 'EKIDOS TAXI — Кирүү коду',
                    html: `<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px"><h1 style="color:#ef4444;font-size:28px;font-weight:900;margin:0">EKIDOS<span style="color:#111"> TAXI</span></h1><p style="color:#666;font-size:14px;margin-top:4px">Токтогул</p><hr style="border:none;border-top:1px solid #eee;margin:20px 0"/><p style="color:#333;font-size:16px">Кирүү үчүн кодуңуз:</p><div style="background:#f5f5f5;border-radius:12px;padding:20px;text-align:center;margin:16px 0"><span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#ef4444">${code}</span></div><p style="color:#999;font-size:12px">Код 10 мүнөттүн ичинде жараксыз болот.</p></div>`,
                });
            }
            catch (emailErr) {
                console.error('Email send error:', emailErr);
            }
        }
        return res.json({ message: 'Код жөнөтүлдү', email });
    }
    catch (error) {
        console.error('Client OTP error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/api/auth/client/verify-otp', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code)
            return res.status(400).json({ error: 'Email жана код керек' });
        const phone = `email:${email.toLowerCase().trim()}`;
        const otp = await exports.prisma.oTP.findFirst({
            where: { phone, code, isUsed: false, expiresAt: { gte: new Date() } },
            orderBy: { createdAt: 'desc' },
        });
        if (!otp)
            return res.status(401).json({ error: 'Код туура эмес же мөөнөтү өттү' });
        await exports.prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } });
        let client = await exports.prisma.client.findUnique({ where: { phone } });
        if (!client)
            client = await exports.prisma.client.create({ data: { name: email, phone } });
        const token = (await Promise.resolve().then(() => __importStar(require('jsonwebtoken')))).default.sign({ id: client.id, phone: client.phone, role: 'CLIENT' }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
        return res.json({ token, client: { id: client.id, phone: client.phone, name: client.name, email } });
    }
    catch (error) {
        console.error('Client verify error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ===== END CLIENT AUTH =====
app.get('/api/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Socket.IO
(0, socket_1.setupSocketHandlers)(exports.io);
const PORT = parseInt(process.env.PORT || '5000', 10);
// @ts-ignore
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 EKIDOS TAXI Server running on 0.0.0.0:${PORT}`);
    console.log(`📡 Socket.IO ready`);
});
process.on('SIGINT', async () => { await exports.prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await exports.prisma.$disconnect(); process.exit(0); });
