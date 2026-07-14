import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// Get settings
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({ data: {} });
    }
    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update settings
router.put('/', authenticateToken, authorizeRoles('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { companyName, companyLogo, theme, language, currency } = req.body;
    
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = await prisma.settings.create({
        data: { companyName, companyLogo, theme, language, currency },
      });
    } else {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: { companyName, companyLogo, theme, language, currency },
      });
    }

    return res.json(settings);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
