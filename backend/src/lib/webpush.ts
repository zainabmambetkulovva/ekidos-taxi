import { prisma } from '../server';

/**
 * Web Push — водитель башка колдонмодо турса же экраны өчүк болсо да
 * телефонуна "Жаңы заказ" деген уведомление жиберет.
 *
 * VAPID ачкычтары: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env'де болсо ошолор колдонулат,
 * болбосо биринчи жолу өзү түзүлүп, базада (app_secrets) сакталат.
 */

// Safe import — web-push орнотулбай калса да сервер иштей берет
let webpush: any = null;
try {
  webpush = require('web-push');
} catch (e) {
  console.error('web-push module failed to load — push notifications disabled:', e);
}

let publicKey: string | null = null;
let ready: Promise<boolean> | null = null;

async function init(): Promise<boolean> {
  if (!webpush) return false;
  try {
    let pub = process.env.VAPID_PUBLIC_KEY || '';
    let priv = process.env.VAPID_PRIVATE_KEY || '';

    if (!pub || !priv) {
      const rows = await prisma.appSecret.findMany({ where: { key: { in: ['vapid_public', 'vapid_private'] } } });
      pub = rows.find(r => r.key === 'vapid_public')?.value || '';
      priv = rows.find(r => r.key === 'vapid_private')?.value || '';

      if (!pub || !priv) {
        const keys = webpush.generateVAPIDKeys();
        // Эки сервер бир убакта түзбөсүн: биринчи жазган жеңет, анан базадан кайра окуйбуз
        await prisma.appSecret.createMany({
          data: [
            { key: 'vapid_public', value: keys.publicKey },
            { key: 'vapid_private', value: keys.privateKey },
          ],
          skipDuplicates: true,
        });
        const saved = await prisma.appSecret.findMany({ where: { key: { in: ['vapid_public', 'vapid_private'] } } });
        pub = saved.find(r => r.key === 'vapid_public')?.value || '';
        priv = saved.find(r => r.key === 'vapid_private')?.value || '';
        console.log('🔑 Web Push VAPID keys generated');
      }
    }

    webpush.setVapidDetails('mailto:admin@ekidos.kg', pub, priv);
    publicKey = pub;
    console.log('🔔 Web Push ready');
    return true;
  } catch (e) {
    console.error('Web Push init error:', e);
    ready = null; // кийинки чакырууда кайра аракет
    return false;
  }
}

function ensureReady(): Promise<boolean> {
  if (!ready) ready = init();
  return ready;
}

export async function getVapidPublicKey(): Promise<string | null> {
  return (await ensureReady()) ? publicKey : null;
}

export async function saveSubscription(driverId: string, sub: any, lang?: string) {
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return false;
  const safeLang = ['ru', 'kg', 'en'].includes(lang || '') ? (lang as string) : 'ru';
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { driverId, p256dh, auth, lang: safeLang },
    create: { driverId, endpoint, p256dh, auth, lang: safeLang },
  });
  return true;
}

export async function removeSubscription(endpoint: string, driverId?: string) {
  if (!endpoint) return;
  await prisma.pushSubscription.deleteMany({ where: { endpoint, ...(driverId ? { driverId } : {}) } });
}

function newOrderText(lang: string, order: any) {
  const address = order.pickupAddress || '';
  if (lang === 'kg') return { title: '🚕 Жаңы заказ!', body: `${address}\nКабыл алуу үчүн басыңыз` };
  if (lang === 'en') return { title: '🚕 New order!', body: `${address}\nTap to accept` };
  return { title: '🚕 Новый заказ!', body: `${address}\nНажмите, чтобы принять` };
}

/** Водительдин бардык телефондоруна "Жаңы заказ" уведомлениесин жиберет. */
export async function pushNewOrder(driverId: string, order: any, ttlSeconds = 25): Promise<number> {
  if (!(await ensureReady())) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { driverId } });
  if (subs.length === 0) return 0;

  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    const text = newOrderText(s.lang, order);
    const payload = JSON.stringify({
      type: 'new_order',
      title: text.title,
      body: text.body,
      orderId: order.id,
      tag: `order-${order.id}`,
      url: '/driver/dashboard',
    });
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: ttlSeconds, urgency: 'high' },
      );
      sent++;
    } catch (err: any) {
      // Жазылуу жараксыз болуп калган (колдонмо өчүрүлгөн / уруксат алынган) — өчүрөбүз
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } }).catch(() => {});
      } else {
        console.error('Push send error:', err?.statusCode || err?.message);
      }
    }
  }));
  return sent;
}
