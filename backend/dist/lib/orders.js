"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAFE_DRIVER_SELECT = void 0;
exports.stopDispatch = stopDispatch;
exports.dispatchOrder = dispatchOrder;
exports.rejectOffer = rejectOffer;
exports.dispatchPendingOrders = dispatchPendingOrders;
exports.acceptOrder = acceptOrder;
exports.completeOrder = completeOrder;
exports.releaseDriver = releaseDriver;
exports.findDriverByCallsign = findDriverByCallsign;
const server_1 = require("../server");
const tariff_1 = require("./tariff");
/**
 * Заказ логикасы бир жерде:
 *  - dispatchOrder: заказды водительге толук экранда жиберүү (20 сек), кабыл албаса — кийинкисине
 *  - acceptOrder:   атомдук кабыл алуу + баланстан 12/14 сом дароо чегерүү
 *  - completeOrder: заказды бүтүрүү, водительди кайра ONLINE кылуу
 *
 * Позывной менен берилген заказ (targetDriverId) ЭЧ КАЧАН башка водительге кетпейт.
 */
// Водитель тууралуу коопсуз талаалар (пароль, паспорт ж.б. жиберилбейт)
exports.SAFE_DRIVER_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    phone: true,
    callsign: true,
    status: true,
    latitude: true,
    longitude: true,
    vehicle: true,
};
const ACTIVE_STATUSES = ['ASSIGNED', 'IN_PROGRESS'];
const OFFER_SECONDS = 20;
const NEAR_THRESHOLD_KM = 5;
// Бардык водительдер четке каккандан кийин кайра сунуштоого чейин күтүү
const RETRY_COOLDOWN_MS = 30000;
const activeDispatches = new Map();
const exhaustedAt = new Map();
const notifiedNoDriver = new Set();
function stopDispatch(orderId) {
    const state = activeDispatches.get(orderId);
    if (state?.timeout)
        clearTimeout(state.timeout);
    activeDispatches.delete(orderId);
    exhaustedAt.delete(orderId);
    notifiedNoDriver.delete(orderId);
}
async function getBusyDriverIds() {
    const rows = await server_1.prisma.order.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        select: { driverId: true },
    });
    return new Set(rows.map(r => r.driverId).filter(Boolean));
}
async function getCandidates(order) {
    const where = { status: 'ONLINE', accountStatus: 'ACTIVE' };
    // Позывной менен берилген заказ — ошол водитель ГАНА
    if (order.targetDriverId)
        where.id = order.targetDriverId;
    const [drivers, busy] = await Promise.all([
        server_1.prisma.driver.findMany({
            where,
            select: { id: true, firstName: true, lastName: true, latitude: true, longitude: true, callsign: true },
        }),
        getBusyDriverIds(),
    ]);
    return drivers
        .filter(d => !busy.has(d.id))
        .map(d => {
        let distance = 999;
        if (d.latitude && d.longitude && order.pickupLat && order.pickupLng) {
            distance = (0, tariff_1.calculateDistance)(d.latitude, d.longitude, order.pickupLat, order.pickupLng);
        }
        return { ...d, distance };
    })
        .sort((a, b) => a.distance - b.distance);
}
function notifyNoDriverOnce(order, message) {
    if (notifiedNoDriver.has(order.id))
        return;
    notifiedNoDriver.add(order.id);
    server_1.io.to('admin-room').emit('notification', {
        title: order.targetDriverId ? '⚠️ Водитель кабыл алган жок' : 'Водитель табылган жок',
        message,
        type: 'no_drivers',
    });
}
/** Заказды водительдерге сунуштоо чынжырын баштайт (эгер азыр иштеп жатпаса). */
async function dispatchOrder(order) {
    if (activeDispatches.has(order.id))
        return;
    const cooldownStart = exhaustedAt.get(order.id);
    if (cooldownStart && Date.now() - cooldownStart < RETRY_COOLDOWN_MS)
        return;
    const state = { timeout: null, tried: new Set(), currentDriverId: null, offerNext: async () => { } };
    activeDispatches.set(order.id, state);
    exhaustedAt.delete(order.id);
    const offerNext = async () => {
        if (activeDispatches.get(order.id) !== state)
            return;
        try {
            const fresh = await server_1.prisma.order.findUnique({ where: { id: order.id } });
            if (!fresh || fresh.status !== 'PENDING') {
                stopDispatch(order.id);
                return;
            }
            const candidates = (await getCandidates(fresh)).filter(c => !state.tried.has(c.id));
            const near = candidates.filter(c => c.distance <= NEAR_THRESHOLD_KM);
            const pool = near.length > 0 ? near : candidates;
            if (pool.length === 0) {
                activeDispatches.delete(order.id);
                // Сунуш берилип четке кагылса гана күтөбүз; эч ким жок болсо — 5 сек кийин кайра текшерилет
                if (state.tried.size > 0)
                    exhaustedAt.set(order.id, Date.now());
                notifyNoDriverOnce(fresh, fresh.targetDriverId
                    ? `#${fresh.orderNumber} — позывной боюнча водитель азыр кабыл ала албайт. Заказ ошол водительде күтүүдө.`
                    : `#${fresh.orderNumber} — бош водитель жок, кайра аракет кылынат`);
                return;
            }
            const selected = pool[Math.floor(Math.random() * pool.length)];
            state.tried.add(selected.id);
            state.currentDriverId = selected.id;
            server_1.io.to(`driver:${selected.id}`).emit('order:incoming', {
                ...fresh,
                assignedDriverId: selected.id,
                distanceMeters: selected.distance < 999 ? Math.round(selected.distance * 1000) : 0,
                timeoutSeconds: OFFER_SECONDS,
            });
            server_1.io.to('admin-room').emit('notification', {
                title: fresh.targetDriverId ? '🎯 Заказ жөнөтүлдү' : 'Заказ жөнөтүлдү',
                message: `#${fresh.orderNumber} → ${selected.callsign ? `${selected.callsign} ` : ''}${selected.firstName} — ${OFFER_SECONDS} сек`,
                type: 'auto_assigned',
            });
            state.timeout = setTimeout(() => {
                if (activeDispatches.get(order.id) !== state)
                    return;
                state.timeout = null;
                server_1.io.to(`driver:${selected.id}`).emit('order:expired', { orderId: order.id });
                offerNext();
            }, OFFER_SECONDS * 1000);
        }
        catch (e) {
            console.error('dispatch error:', e);
            activeDispatches.delete(order.id);
        }
    };
    state.offerNext = offerNext;
    await offerNext();
}
/** Водитель "Отклонить" басты — 20 сек күтпөй дароо кийинкисине. */
function rejectOffer(orderId, driverId) {
    const state = activeDispatches.get(orderId);
    if (!state || state.currentDriverId !== driverId)
        return;
    if (state.timeout)
        clearTimeout(state.timeout);
    state.timeout = null;
    state.currentDriverId = null;
    state.offerNext();
}
/** Ар 5 секундда: PENDING заказдарды бош водительдерге кайра сунуштайт. */
async function dispatchPendingOrders() {
    try {
        const pending = await server_1.prisma.order.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
        });
        for (const order of pending) {
            if (!activeDispatches.has(order.id))
                dispatchOrder(order);
        }
    }
    catch (e) {
        console.error('dispatchPendingOrders error:', e);
    }
}
const fail = (status, body) => ({ ok: false, status, body });
const TAKEN_ERROR = 'Заказ башка водитель тарабынан алынган';
function lowBalanceBody(required, current) {
    return {
        error: `Балансыңыз жетишсиз. Кеминде ${required} сом болушу керек. Азыр: ${current} сом`,
        balanceLow: true,
        required,
        current,
    };
}
/**
 * Водитель заказды кабыл алат.
 * Комиссия (07:00–00:00 — 12 сом, 00:00–07:00 — 14 сом) ДАРОО балансынан алынат.
 */
async function acceptOrder(orderId, driverId) {
    if (!orderId || !driverId)
        return fail(400, { error: 'orderId жана driverId керек' });
    const [order, driver, activeOrder] = await Promise.all([
        server_1.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, price: true, targetDriverId: true } }),
        server_1.prisma.driver.findUnique({ where: { id: driverId }, select: { id: true, balance: true } }),
        server_1.prisma.order.findFirst({ where: { driverId, status: { in: ACTIVE_STATUSES } }, select: { id: true } }),
    ]);
    if (!order)
        return fail(404, { error: 'Order not found' });
    if (!driver)
        return fail(404, { error: 'Driver not found' });
    if (order.status !== 'PENDING')
        return fail(400, { error: TAKEN_ERROR });
    if (order.targetDriverId && order.targetDriverId !== driverId) {
        return fail(403, { error: 'Бул заказ диспетчер тарабынан башка водительге (позывной) берилген' });
    }
    if (activeOrder)
        return fail(400, { error: 'Алгачкы заказды бүтүрүңүз, анан жаңы заказ алыңыз' });
    const commission = (0, tariff_1.getCommissionAmount)();
    if ((driver.balance || 0) < commission)
        return fail(400, lowBalanceBody(commission, driver.balance));
    // 1) Заказды атомдук түрдө ээлөө — эки водитель бир заказды ала албайт
    const claimed = await server_1.prisma.order.updateMany({
        where: { id: orderId, status: 'PENDING', OR: [{ targetDriverId: null }, { targetDriverId: driverId }] },
        data: {
            driverId,
            status: 'ASSIGNED',
            assignedAt: new Date(),
            companyCommission: commission,
            driverEarning: Math.max(0, (order.price || 0) - commission),
        },
    });
    if (claimed.count === 0)
        return fail(400, { error: TAKEN_ERROR });
    // 2) Комиссияны атомдук түрдө чегерүү (баланс жетиштүү болсо гана)
    const charged = await server_1.prisma.driver.updateMany({
        where: { id: driverId, balance: { gte: commission } },
        data: { balance: { decrement: commission }, status: 'BUSY' },
    });
    if (charged.count === 0) {
        // Баланс ушул аралыкта азайып кетти — заказды кайра бошотобуз
        await server_1.prisma.order.updateMany({
            where: { id: orderId, driverId, status: 'ASSIGNED' },
            data: { driverId: null, status: 'PENDING', assignedAt: null },
        });
        const now = await server_1.prisma.driver.findUnique({ where: { id: driverId }, select: { balance: true } });
        return fail(400, lowBalanceBody(commission, now?.balance ?? 0));
    }
    stopDispatch(orderId);
    const [finalOrder, balanceRow] = await Promise.all([
        server_1.prisma.order.findUnique({
            where: { id: orderId },
            include: { driver: { select: exports.SAFE_DRIVER_SELECT } },
        }),
        server_1.prisma.driver.findUnique({ where: { id: driverId }, select: { balance: true } }),
    ]);
    const newBalance = balanceRow?.balance ?? 0;
    // Водитель балансты дароо көрөт
    server_1.io.to(`driver:${driverId}`).emit('balance:updated', { balance: newBalance });
    const nextMin = (0, tariff_1.getCommissionAmount)();
    if (newBalance < nextMin) {
        server_1.io.to(`driver:${driverId}`).emit('balance:low', {
            balance: newBalance,
            required: nextMin,
            message: `Балансыңыз аз калды: ${newBalance} сом. Толуктаңыз!`,
        });
    }
    server_1.io.emit('order:taken', { orderId, driverId });
    server_1.io.emit('order:accepted', finalOrder);
    server_1.io.emit('driver:status-changed', { driverId, status: 'BUSY' });
    server_1.io.to('admin-room').emit('order:status-changed', { orderId, status: 'ASSIGNED', order: finalOrder });
    server_1.io.to('admin-room').emit('notification', {
        title: 'Заказ кабыл алынды',
        message: `#${finalOrder?.orderNumber} — ${finalOrder?.driver?.callsign ? `${finalOrder.driver.callsign} ` : ''}${finalOrder?.driver?.firstName || ''}`,
        type: 'order_accepted',
    });
    return { ok: true, order: finalOrder, balance: newBalance };
}
// ===== COMPLETE =====
async function completeOrder(orderId) {
    const order = await server_1.prisma.order.findUnique({ where: { id: orderId } });
    if (!order)
        return fail(404, { error: 'Order not found' });
    if (order.status === 'COMPLETED')
        return { ok: true, order: { ...order, waitFee: 0 } };
    if (order.status === 'CANCELLED')
        return fail(400, { error: 'Заказ отмена болгон' });
    // Күтүү акысы: водитель келгенден (arrivedAt) 2 мүнөттөн ашса +20 сом
    let waitFee = 0;
    const waitStart = order.arrivedAt || order.assignedAt;
    if (waitStart && (Date.now() - new Date(waitStart).getTime()) / 60000 > 2) {
        waitFee = 20;
    }
    const finalPrice = order.price + waitFee;
    const updated = await server_1.prisma.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED', completedAt: new Date(), price: finalPrice },
    });
    if (updated.driverId) {
        // Баланс accept'те чегерилди — бул жерде статус жана статистика гана
        await Promise.all([
            server_1.prisma.driver.update({
                where: { id: updated.driverId },
                data: {
                    totalOrders: { increment: 1 },
                    totalEarnings: { increment: updated.driverEarning || finalPrice },
                },
            }),
            server_1.prisma.driver.updateMany({
                where: { id: updated.driverId, status: 'BUSY' },
                data: { status: 'ONLINE' },
            }),
            server_1.prisma.payment.upsert({
                where: { orderId: updated.id },
                update: { amount: finalPrice, status: 'completed' },
                create: { orderId: updated.id, amount: finalPrice, method: updated.paymentMethod, status: 'completed' },
            }),
        ]);
        server_1.io.to(`driver:${updated.driverId}`).emit('order:completed', updated);
        server_1.io.emit('driver:status-changed', { driverId: updated.driverId, status: 'ONLINE' });
    }
    server_1.io.to('admin-room').emit('order:completed', updated);
    server_1.io.to('admin-room').emit('order:status-changed', { orderId, status: 'COMPLETED', order: updated });
    return { ok: true, order: { ...updated, waitFee } };
}
/** Водительди заказдан бошотот (отмена болгондо). */
async function releaseDriver(driverId, orderId) {
    const res = await server_1.prisma.driver.updateMany({
        where: { id: driverId, status: 'BUSY' },
        data: { status: 'ONLINE' },
    });
    server_1.io.to(`driver:${driverId}`).emit('order:cancelled', { orderId });
    if (res.count > 0)
        server_1.io.emit('driver:status-changed', { driverId, status: 'ONLINE' });
}
/** Позывной боюнча водитель табуу: "001" = "1" = "01". */
async function findDriverByCallsign(raw) {
    const callsign = raw.toString().trim();
    if (!callsign)
        return null;
    const select = { id: true, firstName: true, lastName: true, callsign: true, status: true, accountStatus: true };
    const exact = await server_1.prisma.driver.findFirst({
        where: { callsign, accountStatus: { not: 'ARCHIVED' } },
        select,
    });
    if (exact)
        return exact;
    const num = parseInt(callsign, 10);
    if (isNaN(num))
        return null;
    const all = await server_1.prisma.driver.findMany({
        where: { callsign: { not: null }, accountStatus: { not: 'ARCHIVED' } },
        select,
    });
    return all.find(d => parseInt(d.callsign, 10) === num) || null;
}
