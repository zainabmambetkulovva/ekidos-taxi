import { Router, Request, Response } from 'express';
import { prisma } from '../server';
import { io } from '../server';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import { calculatePrice, calculateDistance, TARIFFS, COMPANY_COMMISSION } from '../lib/tariff';

// Safe import — if push module fails, orders still work
let sendPushToAllOnlineDrivers: any = async () => 0;
try {
  const pushModule = require('../lib/push');
  sendPushToAllOnlineDrivers = pushModule.sendPushToAllOnlineDrivers;
} catch (e) {
  console.error('Push module failed to load:', e);
}

const router = Router();

// ===== ORDER ASSIGNMENT ENGINE =====
// Picks a random driver from nearby list, sends fullscreen order
// If not accepted in 25s → picks next random driver
// Repeats until all candidates exhausted

function startOrderAssignment(order: any, candidates: any[], ioServer: any) {
  const triedDrivers: string[] = [];
  let currentTimeout: NodeJS.Timeout | null = null;

  function assignToNext() {
    // Filter out already tried drivers
    const remaining = candidates.filter(d => !triedDrivers.includes(d.id));
    
    if (remaining.length === 0) {
      // All candidates exhausted — notify admin
      ioServer.to('admin-room').emit('notification', {
        title: 'Водитель табылган жок',
        message: `#${order.orderNumber} — бардык жакын водительдер четке кагышты`,
        type: 'no_drivers',
      });
      return;
    }

    // Pick random from remaining
    const selected = remaining[Math.floor(Math.random() * remaining.length)];
    triedDrivers.push(selected.id);

    console.log(`🎯 Order #${order.orderNumber} → Driver ${selected.firstName} (${(selected.distance * 1000).toFixed(0)}m)`);

    // Send FULLSCREEN order to this specific driver only
    ioServer.to(`driver:${selected.id}`).emit('order:incoming', {
      ...order,
      assignedDriverId: selected.id,
      distanceMeters: Math.round(selected.distance * 1000),
      timeoutSeconds: 20,
    });

    // Notify admin
    ioServer.to('admin-room').emit('notification', {
      title: 'Заказ жөнөтүлдү',
      message: `#${order.orderNumber} → ${selected.firstName} (${(selected.distance * 1000).toFixed(0)}м) — 20 сек`,
      type: 'auto_assigned',
    });

    // 20 second timeout — if not accepted, try next
    currentTimeout = setTimeout(async () => {
      try {
        const freshOrder = await prisma.order.findUnique({ where: { id: order.id } });
        if (freshOrder && freshOrder.status === 'PENDING') {
          // Not accepted — notify this driver that time expired
          ioServer.to(`driver:${selected.id}`).emit('order:expired', { orderId: order.id });
          // Try next driver
          assignToNext();
        }
      } catch {}
    }, 20000);
  }

  // Start the chain
  assignToNext();

  // Listen for acceptance (cancel the timeout)
  ioServer.on('connection', (socket: any) => {
    socket.on('order:accept', (data: any) => {
      if (data.orderId === order.id && currentTimeout) {
        clearTimeout(currentTimeout);
        currentTimeout = null;
      }
    });
  });
}
// ===== END ORDER ASSIGNMENT ENGINE =====

// Generate order number
function generateOrderNumber(): string {
  const date = new Date();
  const prefix = `EK${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

// Get tariffs
router.get('/tariffs', async (req: Request, res: Response) => {
  return res.json({ tariffs: TARIFFS, commission: COMPANY_COMMISSION });
});

// Calculate price
router.post('/calculate-price', async (req: Request, res: Response) => {
  try {
    const { pickupLat, pickupLng, destLat, destLng, tariff } = req.body;

    if (pickupLat && pickupLng && destLat && destLng) {
      const distance = calculateDistance(pickupLat, pickupLng, destLat, destLng);
      // Road distance is ~1.4x straight-line distance
      const roadDistance = Math.round(distance * 1.4 * 10) / 10;
      const pricing = calculatePrice(roadDistance, tariff || 'Standard');
      return res.json(pricing);
    }

    // Default minimum price
    const pricing = calculatePrice(1, tariff || 'Standard');
    return res.json(pricing);
  } catch (error) {
    return res.status(500).json({ error: 'Calculation error' });
  }
});

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
router.get('/driver/:driverId', authenticateToken, async (req: AuthRequest, res: Response) => {
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

// Get online drivers positions (public - for client map)
router.get('/online-drivers', async (req: Request, res: Response) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: {
        status: 'ONLINE',
        accountStatus: 'ACTIVE',
        latitude: { not: null },
        longitude: { not: null },
      },
      select: { id: true, firstName: true, latitude: true, longitude: true },
    });
    return res.json(drivers.map(d => ({ id: d.id, lat: d.latitude, lng: d.longitude, name: d.firstName })));
  } catch (error) {
    return res.json([]);
  }
});

// Get order status (public — for client tracking)
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        driver: {
          include: { vehicle: true },
        },
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    return res.json({
      status: order.status,
      driver: order.driver ? {
        id: order.driver.id,
        firstName: order.driver.firstName,
        lastName: order.driver.lastName,
        phone: order.driver.phone,
        latitude: order.driver.latitude,
        longitude: order.driver.longitude,
        vehicle: order.driver.vehicle,
      } : null,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available orders for drivers (also returns online driver positions for client map)
router.get('/available', async (req: Request, res: Response) => {
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
router.post('/', async (req: Request, res: Response) => {
  try {
    const { pickupAddress, destAddress, clientName, clientPhone, tariff, comment, paymentMethod, price, pickupLat, pickupLng, destLat, destLng,
      // Client app sends these alternative field names:
      from, to, addressFrom, addressTo,
    } = req.body;

    // Support client app format: from={lat,lng}, addressFrom="..."
    const finalPickupAddress = pickupAddress || addressFrom || '';
    const finalDestAddress = destAddress || addressTo || 'Не указано';
    const finalPickupLat = pickupLat || (from?.lat ? parseFloat(from.lat) : null);
    const finalPickupLng = pickupLng || (from?.lng ? parseFloat(from.lng) : null);
    const finalDestLat = destLat || (to?.lat ? parseFloat(to.lat) : null);
    const finalDestLng = destLng || (to?.lng ? parseFloat(to.lng) : null);

    if (!finalPickupAddress && !finalPickupLat) {
      return res.status(400).json({ error: 'Откуда жерди жазыңыз (pickupAddress)' });
    }
    // clientPhone optional — default to unknown
    const safeClientName  = clientName  || 'Клиент';
    const safeClientPhone = clientPhone || '—';

    // Price validation
    const inputPrice = parseFloat(price) || 0;
    if (inputPrice < 0 || inputPrice > 50000) {
      return res.status(400).json({ error: 'Цена должна быть от 0 до 50000 сом' });
    }

    const orderNumber = generateOrderNumber();

    // Skip geocoding for speed — assign order IMMEDIATELY
    let orderPrice = inputPrice;
    let driverEarning = 0;
    let companyCommission = 0;
    let distance = 0;

    // Auto-calculate price from coordinates if price not provided
    if (orderPrice === 0 && finalPickupLat && finalPickupLng && finalDestLat && finalDestLng) {
      distance = calculateDistance(finalPickupLat, finalPickupLng, finalDestLat, finalDestLng);
      const priceCalc = calculatePrice(distance, tariff || 'Standard');
      orderPrice = priceCalc.total;
      driverEarning = priceCalc.driverEarning;
      companyCommission = priceCalc.companyCommission;
    } else if (orderPrice > 0) {
      companyCommission = Math.round(orderPrice * COMPANY_COMMISSION);
      driverEarning = orderPrice - companyCommission;
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        pickupAddress: finalPickupAddress || `${finalPickupLat}, ${finalPickupLng}`,
        destAddress: finalDestAddress,
        pickupLat: finalPickupLat,
        pickupLng: finalPickupLng,
        destLat: finalDestLat,
        destLng: finalDestLng,
        clientName: safeClientName,
        clientPhone: safeClientPhone,
        tariff: tariff || 'Standard',
        comment: comment || null,
        paymentMethod: paymentMethod || 'CASH',
        price: orderPrice,
        driverEarning,
        companyCommission,
        distance,
      },
    });

    // Create or update client
    try {
      await prisma.client.upsert({
        where: { phone: safeClientPhone },
        update: { name: safeClientName, totalOrders: { increment: 1 } },
        create: { name: safeClientName, phone: safeClientPhone, totalOrders: 1 },
      });
    } catch (e) {
      // Client creation may fail if phone format issue, non-critical
    }

    // Auto-assign: pick random online driver (exclude BUSY_PERSONAL and BUSY)
    try {
      const onlineDrivers = await prisma.driver.findMany({
        where: {
          status: 'ONLINE',
          accountStatus: 'ACTIVE',
        },
        select: { id: true, firstName: true, lastName: true, latitude: true, longitude: true },
      });

      if (onlineDrivers.length > 0) {
        // Calculate distance if coords available, otherwise distance=0
        const candidates = onlineDrivers.map(d => ({
          ...d,
          distance: 0,
        }));

        startOrderAssignment(order, candidates, io);
      } else {
        io.to('admin-room').emit('notification', {
          title: 'Водитель жок',
          message: `#${orderNumber} — онлайн водитель табылган жок`,
          type: 'no_drivers',
        });
      }
    } catch (e) {
      console.error('Auto-assign error:', e);
    }
    
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
      return res.status(400).json({ error: 'Заказ башка водитель тарабынан алынган' });
    }

    // Check driver balance before accepting
    const driverCheck = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driverCheck) return res.status(404).json({ error: 'Driver not found' });
    if ((driverCheck.balance || 0) < 20) {
      return res.status(400).json({ error: 'Балансыңыз жетишсиз (20 баланс керек)' });
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
      data: {
        status: 'BUSY',
      },
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
router.patch('/:id/complete', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Calculate wait fee: if driver arrived more than 2 minutes ago, add 20 som
    let waitFee = 0;
    if (order.assignedAt) {
      const waitMs = Date.now() - new Date(order.assignedAt).getTime();
      const waitMinutes = waitMs / 60000;
      if (waitMinutes > 2) {
        waitFee = 20; // 20 som per extra wait
      }
    }

    const finalPrice = order.price + waitFee;

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        price: finalPrice,
      },
    });

    if (updated.driverId) {
      // Deduct 12 from balance, but never go below 0
      const driver = await prisma.driver.findUnique({ where: { id: updated.driverId } });
      const newBalance = Math.max(0, (driver?.balance || 0) - 12);

      await prisma.driver.update({
        where: { id: updated.driverId },
        data: {
          status: 'ONLINE',
          totalOrders: { increment: 1 },
          totalEarnings: { increment: updated.driverEarning || finalPrice },
          balance: newBalance,
        },
      });
    }

    // Create payment record
    await prisma.payment.create({
      data: {
        orderId: updated.id,
        amount: finalPrice,
        method: updated.paymentMethod,
        status: 'completed',
      },
    });

    io.to('admin-room').emit('order:completed', updated);

    return res.json({ ...updated, waitFee });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel order by CLIENT — only within 14 seconds of creation
router.patch('/:id/client-cancel', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Check if within 14 seconds
    const elapsed = Date.now() - new Date(order.createdAt).getTime();
    if (elapsed > 14000) {
      return res.status(400).json({ error: 'Отмена мөөнөтү өттү (14 секунд)', expired: true });
    }

    // Cancel the order
    await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    // If driver was assigned, free them
    if (order.driverId) {
      await prisma.driver.update({
        where: { id: order.driverId },
        data: { status: 'ONLINE' },
      });
      io.to(`driver:${order.driverId}`).emit('order:cancelled-by-client', { orderId: id });
    }

    // Notify everyone
    io.emit('order:cancelled', { orderId: id });
    io.to('admin-room').emit('notification', {
      title: 'Клиент отмена кылды',
      message: `#${order.orderNumber} клиент тарабынан отмена болду`,
      type: 'order_cancelled',
    });

    return res.json({ success: true, message: 'Заказ отмена кылынды' });
  } catch (error) {
    console.error('Client cancel error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel order — 3-step warning system
router.patch('/:id/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { driverId, cancelStep } = req.body;
    // cancelStep: 1 = first warning, 2 = second warning, 3 = block driver

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Step 1 & 2: just return warning, don't cancel
    if (cancelStep === 1) {
      return res.json({ warning: true, step: 1, message: 'Заказ аяктаган жок! Чын эле отмена кыласызбы?' });
    }
    if (cancelStep === 2) {
      return res.json({ warning: true, step: 2, message: 'Заказды аяктаңыз! Кийинки аракетте блоктолосуз.' });
    }

    // Step 3: cancel order + block driver for 5 hours
    await prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const blockDriverId = driverId || order.driverId;
    if (blockDriverId) {
      const blockedUntil = new Date(Date.now() + 5 * 60 * 60 * 1000); // +5 hours
      await prisma.driver.update({
        where: { id: blockDriverId },
        data: {
          status: 'OFFLINE',
          accountStatus: 'BLOCKED',
          blockedUntil,
        },
      });

      io.to(`driver:${blockDriverId}`).emit('driver:blocked', {
        blockedUntil: blockedUntil.toISOString(),
        reason: 'Заказды аяктабай отмена кылдыңыз',
      });
    }

    io.emit('order:cancelled', { orderId: id });
    io.to('admin-room').emit('driver:blocked-notification', {
      driverId: blockDriverId,
      blockedUntil: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    });

    return res.json({
      warning: false,
      step: 3,
      message: 'Сиз заказды аяктаган жоксуз. 5 саатка блоктолдуңуз.',
      blocked: true,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Unblock driver manually (admin)
router.patch('/driver/:driverId/unblock', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { driverId } = req.params;
    await prisma.driver.update({
      where: { id: driverId as string },
      data: { accountStatus: 'ACTIVE', blockedUntil: null },
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
