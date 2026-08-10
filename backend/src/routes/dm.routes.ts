import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { io } from '../server';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

// DM Routes - Direct Messages between users
const router = Router();

// Helper: create conversationId from two user IDs (sorted so it's always the same)
function makeConversationId(id1: string, id2: string): string {
  return [id1, id2].sort().join('_');
}

// GET /api/dm/conversations — list all conversations for current user
router.get('/conversations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Find all conversations where this user is sender or receiver
    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group by conversationId and get last message + unread count
    const conversationMap = new Map<string, {
      conversationId: string;
      lastMessage: typeof messages[0];
      unreadCount: number;
      partnerId: string;
      partnerName: string;
      partnerType: string;
    }>();

    for (const msg of messages) {
      if (!conversationMap.has(msg.conversationId)) {
        const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        const partnerName = msg.senderId === userId ? msg.receiverName : msg.senderName;
        const partnerType = msg.senderId === userId ? msg.receiverType : msg.senderType;

        conversationMap.set(msg.conversationId, {
          conversationId: msg.conversationId,
          lastMessage: msg,
          unreadCount: 0,
          partnerId,
          partnerName,
          partnerType,
        });
      }

      // Count unread (messages sent TO this user that are not read)
      if (msg.receiverId === userId && !msg.isRead) {
        const conv = conversationMap.get(msg.conversationId)!;
        conv.unreadCount++;
      }
    }

    const conversations = Array.from(conversationMap.values());
    return res.json(conversations);
  } catch (error) {
    console.error('Get DM conversations error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dm/messages/:conversationId — get messages for a conversation
router.get('/messages/:conversationId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const page = parseInt((req.query.page as string) || '1');
    const limit = parseInt((req.query.limit as string) || '50');
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.directMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.directMessage.count({ where: { conversationId } }),
    ]);

    return res.json({
      messages: messages.reverse(), // chronological order
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Get DM messages error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dm/send — send a direct message
router.post('/send', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { text, senderId, senderName, senderType, receiverId, receiverName, receiverType } = req.body;

    if (!text || !text.trim()) return res.status(400).json({ error: 'Message text required' });
    if (!senderId || !senderName || !senderType) return res.status(400).json({ error: 'Sender info required' });
    if (!receiverId || !receiverName || !receiverType) return res.status(400).json({ error: 'Receiver info required' });

    const conversationId = makeConversationId(senderId, receiverId);

    const message = await prisma.directMessage.create({
      data: {
        text: text.trim(),
        senderId,
        senderName,
        senderType,
        receiverId,
        receiverName,
        receiverType,
        conversationId,
      },
    });

    // Emit to receiver's personal room
    io.to(`user:${receiverId}`).emit('dm:message', message);
    // Also emit to sender (so other tabs get it)
    io.to(`user:${senderId}`).emit('dm:message', message);

    return res.status(201).json(message);
  } catch (error) {
    console.error('Send DM error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/dm/read/:conversationId — mark messages as read
router.patch('/read/:conversationId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const conversationId = req.params.conversationId as string;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    await prisma.directMessage.updateMany({
      where: {
        conversationId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dm/unread-count — total unread for a user
router.get('/unread-count', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const count = await prisma.directMessage.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });

    return res.json({ unreadCount: count });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
