import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Get reports
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { type = 'daily', dateFrom, dateTo } = req.query;
    
    const today = new Date();
    let startDate: Date;
    let endDate = new Date();

    switch (type) {
      case 'daily':
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'yearly':
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
    }

    if (dateFrom) startDate = new Date(dateFrom as string);
    if (dateTo) endDate = new Date(dateTo as string);

    const [totalOrders, completedOrders, cancelledOrders, revenue] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
      prisma.order.count({ where: { createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' } }),
      prisma.order.count({ where: { createdAt: { gte: startDate, lte: endDate }, status: 'CANCELLED' } }),
      prisma.order.aggregate({ where: { createdAt: { gte: startDate, lte: endDate }, status: 'COMPLETED' }, _sum: { price: true } }),
    ]);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { driver: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      period: type,
      startDate,
      endDate,
      totalOrders,
      completedOrders,
      cancelledOrders,
      revenue: revenue._sum.price || 0,
      orders,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
