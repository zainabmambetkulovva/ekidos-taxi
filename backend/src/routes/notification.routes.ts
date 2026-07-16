import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Get notifications
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit as string),
    });

    const unreadCount = await prisma.notification.count({ where: { isRead: false } });

    return res.json({ notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark as read
router.patch('/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return res.json({ message: 'Marked as read' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all as read
router.patch('/read-all', authenticateToken, async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
    return res.json({ message: 'All marked as read' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
