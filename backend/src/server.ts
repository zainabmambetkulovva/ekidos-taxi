import express from 'express';
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
app.use(helmet({ contentSecurityPolicy: false })); // Security headers
app.use(cors({
  origin: true,
  credentials: true,
}));

// Rate limiting — login endpoints
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute
  message: { error: 'Слишком много попыток. Подождите 1 минуту.' },
  standardHeaders: true,
});
app.use('/api/auth/admin/login', loginLimiter);
app.use('/api/auth/driver/login', loginLimiter);

// General rate limit
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100, // 100 requests per minute
});
app.use('/api', generalLimiter);

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

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
setupSocketHandlers(io);

const PORT = parseInt(process.env.PORT || '5000', 10);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 EKIDOS TAXI Server running on 0.0.0.0:${PORT}`);
  console.log(`📡 Socket.IO ready`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

