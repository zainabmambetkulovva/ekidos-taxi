import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { authenticateToken, authorizeRoles, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

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

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    return res.json(driver);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create driver
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'DISPATCHER'), async (req: Request, res: Response) => {
  try {
    const {
      firstName, lastName, middleName, birthDate, phone, whatsappNumber,
      passportNumber, passportPhoto, licenseNumber, licensePhoto,
      techPassportNumber, techPassportPhoto, driverPhoto, notes, accountStatus,
      vehicleBrand, vehicleModel, vehicleYear, vehicleColor, plateNumber, insuranceNumber,
    } = req.body;

    // Check if phone already exists
    const existing = await prisma.driver.findUnique({ where: { phone } });
    if (existing) {
      return res.status(400).json({ error: 'Driver with this phone number already exists' });
    }

    const driver = await prisma.driver.create({
      data: {
        firstName,
        lastName,
        middleName,
        birthDate: birthDate ? new Date(birthDate) : null,
        phone,
        whatsappNumber,
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

    return res.status(201).json(driver);
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

    // Update vehicle if exists
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

    const updatedDriver = await prisma.driver.findUnique({
      where: { id },
      include: { vehicle: true },
    });

    return res.json(updatedDriver);
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
    const driver = await prisma.driver.update({
      where: { id },
      data: { status },
    });
    return res.json(driver);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
