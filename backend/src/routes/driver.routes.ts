import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../server';
import { io } from '../server';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

/** Generate random 8-char password: digits + uppercase */
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

// Get all drivers
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, accountStatus, search, page = '1', limit = '50' } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (accountStatus) where.accountStatus = accountStatus;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        include: { vehicle: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.driver.count({ where }),
    ]);

    return res.json({ drivers, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error('Get drivers error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single driver
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const driver = await prisma.driver.findUnique({
      where: { id },
      include: { vehicle: true, documents: true, orders: { take: 20, orderBy: { createdAt: 'desc' } } },
    });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    return res.json(driver);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create driver — auto-generates password, saves hashed + plain
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const {
      firstName, lastName, middleName, birthDate, phone, whatsappNumber,
      passportNumber, passportPhoto, licenseNumber, licensePhoto,
      techPassportNumber, techPassportPhoto, driverPhoto, notes, accountStatus,
      vehicleBrand, vehicleModel, vehicleYear, vehicleColor, plateNumber, insuranceNumber,
      telegramId,
    } = req.body;

    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    const existing = await prisma.driver.findUnique({ where: { phone } });
    if (existing) {
      return res.status(400).json({ error: 'Водитель с таким номером уже существует' });
    }

    // Generate unique password for this driver
    const plainPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const driver = await prisma.driver.create({
      data: {
        firstName,
        lastName,
        middleName,
        birthDate: birthDate ? new Date(birthDate) : null,
        phone,
        password: hashedPassword,
        displayPassword: plainPassword, // Only visible to admin, not to driver
        whatsappNumber,
        telegramId: telegramId ? BigInt(telegramId) : null,
        passportNumber,
        passportPhoto,
        licenseNumber,
        licensePhoto,
        techPassportNumber,
        techPassportPhoto,
        driverPhoto,
        notes,
        accountStatus: accountStatus || 'PENDING',
        vehicle: vehicleBrand ? {
          create: {
            brand: vehicleBrand,
            model: vehicleModel,
            year: parseInt(vehicleYear) || new Date().getFullYear(),
            color: vehicleColor || '',
            plateNumber: plateNumber || '',
            insuranceNumber,
          },
        } : undefined,
      },
      include: { vehicle: true },
    });

    // Notify admins of new driver registration
    io.to('admin-room').emit('notification', {
      title: 'Новый водитель',
      message: `Зарегистрирован ${firstName} ${lastName} — пароль: ${plainPassword}`,
      type: 'new_driver',
    });

    return res.status(201).json({ ...driver, plainPassword });
  } catch (error) {
    console.error('Create driver error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update driver
router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const {
      firstName, lastName, middleName, birthDate, phone, whatsappNumber,
      passportNumber, passportPhoto, licenseNumber, licensePhoto,
      techPassportNumber, techPassportPhoto, driverPhoto, notes, accountStatus,
      vehicleBrand, vehicleModel, vehicleYear, vehicleColor, plateNumber, insuranceNumber,
      telegramId,
    } = req.body;

    const driver = await prisma.driver.update({
      where: { id },
      data: {
        firstName,
        lastName,
        middleName,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        phone,
        whatsappNumber,
        telegramId: telegramId ? BigInt(telegramId) : undefined,
        passportNumber,
        passportPhoto,
        licenseNumber,
        licensePhoto,
        techPassportNumber,
        techPassportPhoto,
        driverPhoto,
        notes,
        accountStatus,
      },
      include: { vehicle: true },
    });

    if (vehicleBrand && driver.vehicle) {
      await prisma.vehicle.update({
        where: { id: driver.vehicle.id },
        data: {
          brand: vehicleBrand,
          model: vehicleModel,
          year: parseInt(vehicleYear) || driver.vehicle.year,
          color: vehicleColor || driver.vehicle.color,
          plateNumber: plateNumber || driver.vehicle.plateNumber,
          insuranceNumber,
        },
      });
    } else if (vehicleBrand && !driver.vehicle) {
      await prisma.vehicle.create({
        data: {
          brand: vehicleBrand,
          model: vehicleModel,
          year: parseInt(vehicleYear) || new Date().getFullYear(),
          color: vehicleColor || '',
          plateNumber: plateNumber || '',
          insuranceNumber,
          driverId: driver.id,
        },
      });
    }

    const updated = await prisma.driver.findUnique({ where: { id }, include: { vehicle: true } });
    return res.json(updated);
  } catch (error) {
    console.error('Update driver error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete driver
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.driver.delete({ where: { id } });
    return res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update driver status
router.patch('/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const driver = await prisma.driver.update({ where: { id }, data: { status } });
    return res.json(driver);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset driver password — generates new random password
router.patch('/:id/reset-password', authenticateToken, authorizeRoles('ADMIN', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const newPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.driver.update({
      where: { id },
      data: {
        password: hashedPassword,
        displayPassword: newPassword,
      },
    });

    return res.json({ password: newPassword, message: 'Пароль успешно сброшен' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
