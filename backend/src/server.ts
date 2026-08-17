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
import chatRoutes from './routes/chat.routes';
import dmRoutes from './routes/dm.routes';
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
app.use('/api/chat', chatRoutes);
app.use('/api/dm', dmRoutes);

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
    console.error('Topup create error:', error) 
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

    let driver;
    try {
      driver = await prisma.driver.findFirst({
        where: { callsign: callsign.toString().trim() },
        include: { vehicle: true },
      });
    } catch (dbErr: any) {
      console.error('DB query error in callsign-login:', dbErr.message);
      return res.status(500).json({ error: 'Database error', detail: dbErr.message });
    }

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
  } catch (error: any) {
    console.error('Callsign login error:', error.message, error.stack);
    return res.status(500).json({ error: 'Internal server error', detail: error.message });
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

// ===== SAVE PUSH TOKEN =====
app.patch('/api/drivers/:id/push-token', async (req: Request, res: Response) => {
  try {
    const { pushToken } = req.body;
    const { id } = req.params;
    if (!pushToken) return res.status(400).json({ error: 'pushToken required' });
    // TODO: Enable after pushToken field added to production DB
    // await prisma.driver.update({ where: { id }, data: { pushToken } });
    console.log(`📱 Push token received for driver ${id} (not saved - field not in DB yet)`);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// ===== END PUSH TOKEN =====

// ===== CLIENT AUTH (email + password) =====
app.post('/api/auth/client/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email туура эмес' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль минимум 6 символ' });
    if (!name) return res.status(400).json({ error: 'Аты-жөнү керек' });

    const clientPhone = phone || `email:${email.toLowerCase().trim()}`;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if client exists - if yes, update their password and let them in
    let client = await prisma.client.findUnique({ where: { phone: clientPhone } });

    if (client) {
      // Update name and set/update password
      client = await prisma.client.update({ where: { phone: clientPhone }, data: { name } });
      // Upsert password in OTP table
      const existingPw = await prisma.oTP.findFirst({ where: { phone: clientPhone, isUsed: false } });
      if (existingPw) {
        await prisma.oTP.update({ where: { id: existingPw.id }, data: { code: hashedPassword } });
      } else {
        await prisma.oTP.create({ data: { phone: clientPhone, code: hashedPassword, expiresAt: new Date('2099-01-01'), isUsed: false } });
      }
    } else {
      // Create new client
      await prisma.oTP.create({ data: { phone: clientPhone, code: hashedPassword, expiresAt: new Date('2099-01-01'), isUsed: false } });
      client = await prisma.client.create({ data: { name, phone: clientPhone } });
    }

    const token = jwt.sign(
      { id: client.id, phone: client.phone, role: 'CLIENT' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    return res.json({ token, client: { id: client.id, name: client.name, phone: clientPhone, email } });
  } catch (error: any) {
    console.error('Client register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/client/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email жана пароль керек' });

    const clientPhone = `email:${email.toLowerCase().trim()}`;
    const client = await prisma.client.findUnique({ where: { phone: clientPhone } });
    if (!client) return res.status(404).json({ error: 'Аккаунт табылган жок. Катталыңыз.' });

    // Find password hash from OTP table
    const otpRecord = await prisma.oTP.findFirst({
      where: { phone: clientPhone, isUsed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otpRecord) return res.status(401).json({ error: 'Пароль туура эмес' });

    const isValid = await bcrypt.compare(password, otpRecord.code);
    if (!isValid) return res.status(401).json({ error: 'Пароль туура эмес' });

    const token = jwt.sign(
      { id: client.id, phone: client.phone, role: 'CLIENT' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' }
    );

    return res.json({ token, client: { id: client.id, name: client.name, phone: clientPhone, email } });
  } catch (error: any) {
    console.error('Client login error:', error);
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

    // Save rating to order comment field (rating field not in DB yet)
    await prisma.order.update({
      where: { id: id as string },
      data: { comment: `rating:${rating}${comment ? ' ' + comment : ''}` },
    });

    return res.json({ success: true });
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
  // TODO: Enable after tariffs field added to settings table
  return res.json({ success: true, message: 'Tariff update not yet available' });
});
// ===== END TARIFF MANAGEMENT =====

app.get('/api/health', async (_, res) => {
  try {
    // Test database connection
    const driverCount = await prisma.driver.count();
    const orderCount = await prisma.order.count();
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      db: { drivers: driverCount, orders: orderCount },
    });
  } catch (dbError: any) {
    res.json({ 
      status: 'db_error', 
      timestamp: new Date().toISOString(),
      error: dbError.message,
    });
  }
});

// Socket.IO
setupSocketHandlers(io);

const PORT: number = parseInt(process.env.PORT || '5000', 10);

// ===== PENDING ORDER REASSIGNMENT ENGINE =====
// Every 5 seconds: find PENDING orders with no active assignment chain, dispatch to ONLINE drivers
// Tracks which orders are already being dispatched to avoid duplicate chains
const activeDispatchOrders = new Set<string>();

async function dispatchPendingOrders() {
  try {
    const pendingOrders = await prisma.order.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });

    if (pendingOrders.length === 0) return;

    const onlineDrivers = await prisma.driver.findMany({
      where: { status: 'ONLINE', accountStatus: 'ACTIVE' },  // Only ONLINE, not BUSY
      select: { id: true, firstName: true, lastName: true, latitude: true, longitude: true },
    });

    if (onlineDrivers.length === 0) return;

    for (const order of pendingOrders) {
      // Skip if already being dispatched
      if (activeDispatchOrders.has(order.id)) continue;

      activeDispatchOrders.add(order.id);
      console.log(`🔄 Re-dispatching PENDING order #${order.orderNumber} to ${onlineDrivers.length} drivers`);

      const candidates = onlineDrivers.map(d => ({ ...d, distance: 0 }));

      // Pick a random driver and send fullscreen order
      let triedDrivers: string[] = [];

      function assignToNext() {
        const remaining = candidates.filter(d => !triedDrivers.includes(d.id));
        if (remaining.length === 0) {
          activeDispatchOrders.delete(order.id);
          return;
        }

        const selected = remaining[Math.floor(Math.random() * remaining.length)];
        triedDrivers.push(selected.id);

        // Skip if driver became BUSY since we fetched the list
        prisma.driver.findUnique({ where: { id: selected.id }, select: { status: true } })
          .then(freshDriver => {
            if (freshDriver && freshDriver.status !== 'ONLINE') {
              assignToNext();
              return;
            }

            io.to(`driver:${selected.id}`).emit('order:incoming', {
              ...order,
              assignedDriverId: selected.id,
              distanceMeters: 0,
              timeoutSeconds: 20,
            });

            io.to('admin-room').emit('notification', {
              title: 'Заказ кайра жөнөтүлдү',
              message: `#${order.orderNumber} → ${selected.firstName} — 20 сек`,
              type: 'auto_assigned',
            });

            const t = setTimeout(async () => {
              try {
                const fresh = await prisma.order.findUnique({ where: { id: order.id } });
                if (fresh && fresh.status === 'PENDING') {
                  io.to(`driver:${selected.id}`).emit('order:expired', { orderId: order.id });
                  assignToNext();
                } else {
                  activeDispatchOrders.delete(order.id);
                }
              } catch {
                activeDispatchOrders.delete(order.id);
              }
            }, 20000);

            const cleanupHandler = (data: any) => {
              if (data.orderId === order.id) {
                clearTimeout(t);
                activeDispatchOrders.delete(order.id);
                io.off('order:accepted', cleanupHandler);
              }
            };
            io.on('order:accepted', cleanupHandler);
          })
          .catch(() => assignToNext());
      }

      assignToNext();
    }
  } catch (e) {
    console.error('dispatchPendingOrders error:', e);
  }
}

// Run every 5 seconds
setInterval(dispatchPendingOrders, 5000);
// ===== END PENDING ORDER REASSIGNMENT ENGINE =====

// ===== AUTO MIGRATION: add options column if missing =====
async function ensureOptionsColumn() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS options TEXT[] DEFAULT '{}';
    `);
    console.log('✅ options column ensured');
  } catch (e) {
    console.error('Migration options column error:', e);
  }
}
ensureOptionsColumn();
// ===== END AUTO MIGRATION =====

// @ts-ignore
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 EKIDOS TAXI Server running on 0.0.0.0:${PORT}`);
  console.log(`📡 Socket.IO ready`);
});

process.on('SIGINT', async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
