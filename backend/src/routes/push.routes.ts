import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { getVapidPublicKey, saveSubscription, removeSubscription } from '../lib/webpush';

const router = Router();

// Браузер жазылуу үчүн ачык ачкыч
router.get('/public-key', async (_req, res: Response) => {
  try {
    const key = await getVapidPublicKey();
    if (!key) return res.status(503).json({ error: 'Push is not available' });
    return res.json({ publicKey: key });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Водительдин телефонун жазуу
router.post('/subscribe', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'DRIVER') return res.status(403).json({ error: 'Водитель гана' });
    const ok = await saveSubscription(req.user.id, req.body?.subscription, req.body?.lang);
    if (!ok) return res.status(400).json({ error: 'Invalid subscription' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Push subscribe error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Жазылууну өчүрүү (аккаунттан чыкканда)
router.post('/unsubscribe', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await removeSubscription(req.body?.endpoint, req.user?.role === 'DRIVER' ? req.user.id : undefined);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
