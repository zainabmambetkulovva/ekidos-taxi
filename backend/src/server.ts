import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import authRoutes from './routes/auth.routes';
import driverRoutes from './routes/driver.routes';
import orderRoutes from './routes/order.routes';
import clientRoutes from './routes/client.routes';
import statsRoutes from './routes/stats.routes';
import settingsRoutes from './routes/settings.routes';
import uploadRoutes from './routes/upload.routes';
import reportRoutes from './routes/report.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import { setupSocketHandlers } from './socket';

dotenv.config();

// BigInt JSON serialization support
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();
const httpServer = createServer(app);

export const prisma = new PrismaClient();

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  },
});

// Middleware
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, max: 5,
  message: { error: 'Слишком много попыток. Подождите 1 минуту.' },
  standardHeaders: true,
});
app.use('/api/auth/admin/login', loginLimiter);
app.use('/api/auth/driver/login', loginLimiter);
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 100 }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admins', adminRoutes);

// ===== INLINE TOPUP ROUTES =====
// POST /api/topup — from bot
app.post('/api/topup', async (req: Request, res: Response) => {
  try {
    const { telegramId, driverName, photoUrl } = req.body;
    if (!telegramId) return res.status(400).json({ error: 'telegramId is required' });

    const driver = await prisma.driver.findFirst({
      where: { telegramId: BigInt(telegramId.toString()) },
    });
    if (!driver) return res.status(404).json({ error: 'Driver not found with this telegramId' });

    const request = await prisma.topupRequest.create({
      data: {
        driverId: driver.id,
        telegramId: BigInt(telegramId.toString()),
        driverName: driverName || `${driver.firstName} ${driver.lastName}`,
        photoUrl: photoUrl || null,
        status: 'PENDING',
      },
    });
    return res.json({ id: request.id, status: 'PENDING' });
  } catch (error) {
    console.error('Topup create error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/topup — admin panel
app.get('/api/topup', async (req: Request, res: Response) => {
  try {
    const requests = await prisma.topupRequest.findMany({
      include: {
        driver: { select: { id: true, firstName: true, lastName: true, phone: true, balance: true, telegramId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/topup/:id/approve — admin approves
app.patch('/api/topup/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const request = await prisma.topupRequest.findUnique({ where: { id: id as string } });
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Already processed' });

    await prisma.topupRequest.update({ where: { id: id as string }, data: { status: 'APPROVED', amount } });
    const driver = await prisma.driver.update({
      where: { id: request.driverId },
      data: { balance: { increment: amount } },
    });
    return res.json({ success: true, driverName: `${driver.firstName} ${driver.lastName}`, newBalance: driver.balance, amount });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/topup/:id/reject
app.patch('/api/topup/:id/reject', async (req: Request, res: Response) => {
  try {
    await prisma.topupRequest.update({ where: { id: req.params.id as string }, data: { status: 'REJECTED' } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// ===== END TOPUP ROUTES =====

// ===== INCOMING CALL WEBHOOK (from Tasker) =====
// POST /api/incoming-call — Tasker жиберет чалуу болгондо
app.post('/api/incoming-call', (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const cleaned = phone.toString().trim();
  console.log(`📞 Incoming call from: ${cleaned}`);

  // Socket.IO аркылуу бардык диспетчерлерге жибер
  io.to('admin-room').emit('incoming:call', { phone: cleaned, time: new Date().toISOString() });

  return res.json({ success: true, phone: cleaned });
});
// ===== END INCOMING CALL =====

// ===== CALLSIGN LOGIN (inline to bypass Railway cache) =====
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

app.post('/api/auth/callsign-login', async (req: Request, res: Response) => {
  try {
    const { callsign, password } = req.body;
    if (!callsign || !password) return res.status(400).json({ error: 'Позывной жана пароль керек' });

    const driver = await prisma.driver.findFirst({
      where: { callsign: callsign.toString().trim() },
      include: { vehicle: true },
    });

    if (!driver) return res.status(404).json({ error: 'Позывной табылган жок. Диспетчерге кайрылыңыз.' });
    if (driver.accountStatus === 'BLOCKED') return res.status(403).json({ error: 'Аккаунтуңуз бөгөттөлгөн' });
    if (!driver.password) return res.status(400).json({ error: 'Пароль дагы орнотулган эмес' });

    const isValid = await bcrypt.compare(password, driver.password);
    if (!isValid) return res.status(401).json({ error: 'Пароль туура эмес' });

    const token = jwt.sign(
      { id: driver.id, phone: driver.phone, role: 'DRIVER' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      driver: {
        id: driver.id, firstName: driver.firstName, lastName: driver.lastName,
        phone: driver.phone, callsign: driver.callsign, status: driver.status,
        accountStatus: driver.accountStatus, vehicle: driver.vehicle,
        rating: driver.rating, totalEarnings: driver.totalEarnings, totalOrders: driver.totalOrders,
      },
    });
  } catch (error) {
    console.error('Callsign login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== SAVE CALLSIGN (inline) =====
app.patch('/api/drivers/:id/callsign', async (req: Request, res: Response) => {
  try {
    const { callsign } = req.body;
    const { id } = req.params;
    await prisma.driver.update({ where: { id: id as string }, data: { callsign: callsign || null } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== CLIENT AUTH (email + OTP password) =====
app.post('/api/auth/client/request-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email туура эмес' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const phone = `email:${email.toLowerCase().trim()}`;

    await prisma.oTP.create({ data: { phone, code, expiresAt } });
    console.log(`📧 Client OTP for ${email}: ${code}`);

    // Send email via Resend (lazy init)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const { Resend } = await import('resend');
        const resendClient = new Resend(resendKey);
        await resendClient.emails.send({
          from: 'EKIDOS TAXI <onboarding@resend.dev>',
          to: email,
          subject: 'EKIDOS TAXI — Кирүү коду',
          html: `<div style="font-family:Arial,sans-serif;max-width:400px;margin:0 auto;padding:24px"><h1 style="color:#ef4444;font-size:28px;font-weight:900;margin:0">EKIDOS<span style="color:#111"> TAXI</span></h1><p style="color:#666;font-size:14px;margin-top:4px">Токтогул</p><hr style="border:none;border-top:1px solid #eee;margin:20px 0"/><p style="color:#333;font-size:16px">Кирүү үчүн кодуңуз:</p><div style="background:#f5f5f5;border-radius:12px;padding:20px;text-align:center;margin:16px 0"><span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#ef4444">${code}</span></div><p style="color:#999;font-size:12px">Код 10 мүнөттүн ичинде жараксыз болот.</p></div>`,
        });
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
      }
    }

    return res.json({ message: 'Код жөнөтүлдү', email });
  } catch (error) {
    console.error('Client OTP error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/client/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Email жана код керек' });

    const phone = `email:${email.toLowerCase().trim()}`;
    const otp = await prisma.oTP.findFirst({
      where: { phone, code, isUsed: false, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) return res.status(401).json({ error: 'Код туура эмес же мөөнөтү өттү' });

    await prisma.oTP.update({ where: { id: otp.id }, data: { isUsed: true } });

    let client = await prisma.client.findUnique({ where: { phone } });
    if (!client) client = await prisma.client.create({ data: { name: email, phone } });

    const token = (await import('jsonwebtoken')).default.sign(
      { id: client.id, phone: client.phone, role: 'CLIENT' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    return res.json({ token, client: { id: client.id, phone: client.phone, name: client.name, email } });
  } catch (error) {
    console.error('Client verify error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// ===== END CLIENT AUTH =====

// ===== RATING =====
app.post('/api/orders/:id/rate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be 1-5' });
    }

    const order = await prisma.order.findUnique({ where: { id: id as string } });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!order.driverId) return res.status(400).json({ error: 'No driver assigned' });

    // Save rating to order
    await prisma.order.update({
      where: { id: id as string },
      data: { rating: rating, comment: comment || null },
    });

    // Update driver average rating
    const driverOrders = await prisma.order.findMany({
      where: { driverId: order.driverId, rating: { not: null } },
      select: { rating: true },
    });

    const avgRating = driverOrders.reduce((sum, o) => sum + (o.rating || 0), 0) / driverOrders.length;

    await prisma.driver.update({
      where: { id: order.driverId },
      data: { rating: Math.round(avgRating * 10) / 10 },
    });

    return res.json({ success: true, averageRating: avgRating });
  } catch (error) {
    console.error('Rating error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// ===== END RATING =====

// ===== TARIFF MANAGEMENT =====
app.get('/api/tariffs', (req: Request, res: Response) => {
  const { TARIFFS, COMPANY_COMMISSION } = require('./lib/tariff');
  return res.json({ tariffs: TARIFFS, commission: COMPANY_COMMISSION });
});

app.put('/api/tariffs', async (req: Request, res: Response) => {
  try {
    const { tariffs, commission } = req.body;
    // Save to settings
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({ data: { tariffs: JSON.stringify(tariffs), commission: commission } });
    } else {
      await prisma.settings.update({
        where: { id: settings.id },
        data: { tariffs: JSON.stringify(tariffs), commission: commission },
      });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Tariff update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// ===== END TARIFF MANAGEMENT =====

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
setupSocketHandlers(io);

const PORT: number = parseInt(process.env.PORT || '5000', 10);

// @ts-ignore
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 EKIDOS TAXI Server running on 0.0.0.0:${PORT}`);
  console.log(`📡 Socket.IO ready`);
});

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
