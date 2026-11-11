/**
 * EKIDOS TAXI — Service Worker
 * 
 * Strategies:
 * - Static assets (CSS, JS, images): Cache First
 * - Pages (HTML): Network First with offline fallback
 * - API calls: Network Only (never cache)
 * - Offline: Show cached shell + offline page
 */

const CACHE_NAME = 'ekidos-v2';
const OFFLINE_URL = '/offline';

// Files to precache (app shell)
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
  '/notification.mp3',
];

// ===== INSTALL — precache app shell =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell');
      return cache.addAll(PRECACHE_URLS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// ===== ACTIVATE — clean old caches =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ===== FETCH — routing strategies =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API calls — always network
  if (url.pathname.startsWith('/api/') || url.hostname !== self.location.hostname) {
    return;
  }

  // Skip socket.io
  if (url.pathname.includes('socket.io')) return;

  // For navigation requests (HTML pages): Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOffline(request));
    return;
  }

  // For static assets: Cache First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else: Network First
  event.respondWith(networkFirst(request));
});

// ===== STRATEGIES =====

async function networkFirstWithOffline(request) {
  try {
    const response = await fetch(request);
    // Cache successful page responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed — try cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // No cache — show offline page
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;

    // Ultimate fallback
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ===== HELPERS =====

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|mp3|wav)$/.test(pathname)
    || pathname.startsWith('/_next/static/');
}

// ===== PUSH EVENT — "Жаңы заказ" уведомлениеси (колдонмо фондо же жабык болсо да) =====
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }

  const title = data.title || '🚖 EKIDOS TAXI';
  const options = {
    body: data.body || 'Жаңы заказ!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [500, 200, 500, 200, 500, 200, 500],
    tag: data.tag || 'order-notification',
    renotify: true,
    requireInteraction: true,
    timestamp: Date.now(),
    data: data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Уведомлениени басканда — колдонмону ачуу (ачык болсо алдыга чыгаруу)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/driver/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && !client.url.includes('/driver/dashboard')) {
            return client.navigate(url).then((c) => (c || client).focus());
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
