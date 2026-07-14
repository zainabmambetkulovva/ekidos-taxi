import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { io } from '../server';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Generate order number
function generateOrderNumber(): string {
  const date = new Date();
  const prefix = `EK${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

// Get all orders
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, driverId, search, page = '1', limit = '50', dateFrom, dateTo } = req.query;
    
    const where: any = {};
    
    if (status) where.status = status;
    if (driverId) where.driverId = driverId;
    if (search) {
      where.OR = [
        { orderNumber: { contains: search as string, mode: 'insensitive' } },
        { clientName: { contains: search as string, mode: 'insensitive' } },
        { clientPhone: { contains: search as string } },
        { pickupAddress: { contains: search as string, mode: 'insensitive' } },
      ];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom as string);
      if (dateTo) where.createdAt.lte = new Date(dateTo as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { driver: { include: { vehicle: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.order.count({ where }),
    ]);

    return res.json({ orders, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (error) {
    console.error('Get orders error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get driver's orders
router.get('/driver/:driverId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const driverId = req.params.driverId as string;
    const { status } = req.query;
    const where: any = { driverId };
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available orders for drivers
router.get('/available', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create order
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { pickupAddress, destAddress, clientName, clientPhone, tariff, comment, paymentMethod, price } = req.body;

    if (!pickupAddress || !destAddress || !clientName || !clientPhone) {
      return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    const orderNumber = generateOrderNumber();

    // Geocode addresses
    const { geocodeAddress } = await import('../lib/geocode');
    const [pickupCoords, destCoords] = await Promise.all([
      geocodeAddress(pickupAddress),
      geocodeAddress(destAddress),
    ]);

    const order = await prisma.order.create({
      data: {
        orderNumber,
        pickupAddress,
        destAddress,
        pickupLat: pickupCoords?.lat || null,
        pickupLng: pickupCoords?.lng || null,
        destLat: destCoords?.lat || null,
        destLng: destCoords?.lng || null,
        clientName,
        clientPhone,
        tariff: tariff || 'Standard',
        comment: comment || null,
        paymentMethod: paymentMethod || 'CASH',
        price: parseFloat(price) || 0,
      },
    });

    // Create or update client
    try {
      await prisma.client.upsert({
        where: { phone: clientPhone },
        update: { name: clientName, totalOrders: { increment: 1 } },
        create: { name: clientName, phone: clientPhone, totalOrders: 1 },
      });
    } catch (e) {
      // Client creation may fail if phone format issue, non-critical
    }

    // Broadcast to all connected drivers
    io.emit('order:available', order);
    
    // Notify admin room
    io.to('admin-room').emit('order:new', order);
    io.to('admin-room').emit('notification', {
      title: 'New Order',
      message: `Order #${orderNumber} - ${clientName}`,
      type: 'new_order',
    });

    return res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept order
router.patch('/:id/accept', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { driverId } = req.body;

    const order = await prisma.order.findUnique({ where: { id } });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ error: 'Order is no longer available' });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        driverId,
        status: 'ASSIGNED',
        assignedAt: new Date(),
      },
      include: { driver: true },
    });

    await prisma.driver.update({
      where: { id: driverId },
      data: { status: 'BUSY' },
    });

    // Notify all to remove this order
    io.emit('order:taken', { orderId: id, driverId });
    io.to('admin-room').emit('order:accepted', updatedOrder);

    return res.json(updatedOrder);
  } catch (error) {
    console.error('Accept order error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete order
router.patch('/:id/complete', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    if (order.driverId) {
      await prisma.driver.update({
        where: { id: order.driverId },
        data: {
          status: 'ONLINE',
          totalOrders: { increment: 1 },
          totalEarnings: { increment: order.price },
        },
      });
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.price,
        method: order.paymentMethod,
        status: 'completed',
      },
    });

    io.to('admin-room').emit('order:completed', order);

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel order
router.patch('/:id/cancel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    if (order.driverId) {
      await prisma.driver.update({
        where: { id: order.driverId },
        data: { status: 'ONLINE' },
      });
    }

    io.emit('order:cancelled', { orderId: id });

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
