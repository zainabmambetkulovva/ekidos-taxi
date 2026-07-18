import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// GET /api/topup — get all topup requests (admin)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const where: any = {};
    if (status) where.status = status;

    const requests = await prisma.topupRequest.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            balance: true,
            telegramId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(requests);
  } catch (error) {
    console.error('Get topup requests error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/topup — create topup request (from bot)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { telegramId, driverName, photoUrl } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }

    // Find driver by telegramId
    const driver = await prisma.driver.findFirst({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found with this telegramId' });
    }

    const request = await prisma.topupRequest.create({
      data: {
        driverId: driver.id,
        telegramId: BigInt(telegramId),
        driverName: driverName || `${driver.firstName} ${driver.lastName}`,
        photoUrl: photoUrl || null,
        status: 'PENDING',
      },
    });

    return res.json({ id: request.id, status: 'PENDING' });
  } catch (error) {
    console.error('Create topup request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/topup/:id/approve — approve and add balance (admin)
router.patch('/:id/approve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const request = await prisma.topupRequest.findUnique({ where: { id } });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request already processed' });
    }

    // Update request status
    await prisma.topupRequest.update({
      where: { id },
      data: { status: 'APPROVED', amount },
    });

    // Add balance to driver
    const driver = await prisma.driver.update({
      where: { id: request.driverId },
      data: { balance: { increment: amount } },
    });

    return res.json({
      success: true,
      driverName: `${driver.firstName} ${driver.lastName}`,
      newBalance: driver.balance,
      amount,
    });
  } catch (error) {
    console.error('Approve topup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/topup/:id/reject — reject request (admin)
router.patch('/:id/reject', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.topupRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Reject topup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
