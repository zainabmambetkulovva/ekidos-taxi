import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Get all clients
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;
    
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: { orders: { take: 5, orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.client.count({ where }),
    ]);

    return res.json({ clients, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single client
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const client = await prisma.client.findUnique({
      where: { id },
      include: { orders: { orderBy: { createdAt: 'desc' } } },
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    return res.json(client);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
