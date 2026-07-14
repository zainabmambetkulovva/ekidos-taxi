import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Get dashboard stats
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todayOrders,
      todayRevenue,
      monthlyRevenue,
      onlineDrivers,
      busyDrivers,
      offlineDrivers,
      totalDrivers,
      totalClients,
      monthlyOrders,
    ] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.aggregate({ where: { createdAt: { gte: today }, status: 'COMPLETED' }, _sum: { price: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, status: 'COMPLETED' }, _sum: { price: true } }),
      prisma.driver.count({ where: { status: 'ONLINE' } }),
      prisma.driver.count({ where: { status: 'BUSY' } }),
      prisma.driver.count({ where: { status: 'OFFLINE' } }),
      prisma.driver.count(),
      prisma.client.count(),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    return res.json({
      todayOrders,
      todayRevenue: todayRevenue._sum.price || 0,
      monthlyRevenue: monthlyRevenue._sum.price || 0,
      onlineDrivers,
      busyDrivers,
      offlineDrivers,
      totalDrivers,
      totalClients,
      monthlyOrders,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get chart data
router.get('/charts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);

    // Daily orders for last 7 days
    const dailyOrders = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);

      const count = await prisma.order.count({
        where: { createdAt: { gte: date, lt: nextDay } },
      });

      const revenue = await prisma.order.aggregate({
        where: { createdAt: { gte: date, lt: nextDay }, status: 'COMPLETED' },
        _sum: { price: true },
      });

      dailyOrders.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        orders: count,
        revenue: revenue._sum.price || 0,
      });
    }

    // Monthly revenue for last 6 months
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);

      const revenue = await prisma.order.aggregate({
        where: { createdAt: { gte: monthStart, lte: monthEnd }, status: 'COMPLETED' },
        _sum: { price: true },
      });

      const orders = await prisma.order.count({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
      });

      monthlyRevenue.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        revenue: revenue._sum.price || 0,
        orders,
      });
    }

    // Top drivers
    const topDrivers = await prisma.driver.findMany({
      take: 10,
      orderBy: { totalEarnings: 'desc' },
      include: { vehicle: true },
    });

    return res.json({ dailyOrders, monthlyRevenue, topDrivers });
  } catch (error) {
    console.error('Charts error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Rating stats
router.get('/rating', authenticateToken, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayOrders, monthlyOrders, todayRevenue, monthlyRevenue, activeDrivers, onlineDrivers] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.order.aggregate({ where: { createdAt: { gte: today }, status: 'COMPLETED' }, _sum: { price: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, status: 'COMPLETED' }, _sum: { price: true } }),
      prisma.driver.count({ where: { accountStatus: 'ACTIVE' } }),
      prisma.driver.count({ where: { status: 'ONLINE' } }),
    ]);

    const bestDriver = await prisma.driver.findFirst({
      orderBy: { rating: 'desc' },
      include: { vehicle: true },
    });

    const topDrivers = await prisma.driver.findMany({
      take: 10,
      orderBy: [{ totalOrders: 'desc' }, { rating: 'desc' }],
      include: { vehicle: true },
    });

    return res.json({
      todayOrders,
      monthlyOrders,
      todayRevenue: todayRevenue._sum.price || 0,
      monthlyRevenue: monthlyRevenue._sum.price || 0,
      activeDrivers,
      onlineDrivers,
      bestDriver,
      topDrivers,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
