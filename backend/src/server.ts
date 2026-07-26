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

// Health check
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
