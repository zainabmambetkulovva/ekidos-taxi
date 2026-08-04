import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { io } from '../server';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Get chat messages (paginated, most recent first)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.chatMessage.count(),
    ]);

    // Return in chronological order (oldest first) for display
    return res.json({
      messages: messages.reverse(),
      total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    console.error('Get chat messages error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a message (driver or dispatcher)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { text, senderType, senderId, senderName } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text required' });
    }
    if (!senderType || !senderId || !senderName) {
      return res.status(400).json({ error: 'Sender info required' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        text: text.trim(),
        senderType,
        senderId,
        senderName,
      },
    });

    // Broadcast to all connected clients via Socket.IO
    io.emit('chat:message', message);

    return res.status(201).json(message);
  } catch (error) {
    console.error('Send chat message error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
