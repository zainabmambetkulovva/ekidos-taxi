'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered:', reg.scope);

          // Check for updates every 60 seconds
          setInterval(() => {
            reg.update();
          }, 60000);
        })
        .catch((err) => {
          console.error('[PWA] SW registration failed:', err);
        });
    }
  }, []);

  return null;
}
