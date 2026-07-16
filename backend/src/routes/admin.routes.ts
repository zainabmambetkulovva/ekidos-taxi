import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../server';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';

const router = Router();

// Get all admins
router.get('/', authenticateToken, authorizeRoles('ADMIN'), async (req: Request, res: Response) => {
  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true, email: true, firstName: true,
        lastName: true, role: true, isActive: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(admins);
  } catch (error) {
    console.error('Admin GET error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create/Update admin
router.post('/', authenticateToken, authorizeRoles('ADMIN'), async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Введите корректный email' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Заполните имя и фамилию' });
    }

    // Check if email exists in admins table
    const existingAdmin = await prisma.admin.findUnique({ where: { email } });

    if (!existingAdmin) {
      return res.status(404).json({
        error: 'not_found',
        message: `Пользователь с email "${email}" не найден в системе. Администратором можно назначить только зарегистрированного пользователя.`,
      });
    }

    // User exists — update role and credentials
    const hashedPassword = await bcrypt.hash(password, 12);

    const updatedAdmin = await prisma.admin.update({
      where: { email },
      data: {
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'ADMIN',
        isActive: true,
      },
      select: {
        id: true, email: true, firstName: true,
        lastName: true, role: true, isActive: true, createdAt: true,
      },
    });

    return res.json({ ...updatedAdmin, updated: true });
  } catch (error) {
    console.error('Admin POST error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete admin
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.admin.delete({ where: { id } });
    return res.json({ message: 'Admin deleted' });
  } catch (error) {
    console.error('Admin DELETE error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
