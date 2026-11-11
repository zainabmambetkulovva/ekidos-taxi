import api from '@/lib/axios';

/**
 * Web Push жазылуу — водитель башка колдонмодо турса да "Жаңы заказ" уведомлениеси келиши үчүн.
 */

export function pushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported';
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Уруксат берилген болсо — телефонду серверге жазат. Ар бир киргенде чакырса болот. */
export async function ensurePushSubscription(): Promise<boolean> {
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return false;
    const reg = await navigator.serviceWorker.ready;
    const { data } = await api.get('/push/public-key');
    if (!data?.publicKey) return false;
    const appKey = urlBase64ToUint8Array(data.publicKey);

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey as BufferSource });
      } catch {
        // Эски ачкыч менен жазылган болушу мүмкүн — тазалап кайра жазабыз
        const old = await reg.pushManager.getSubscription();
        if (old) await old.unsubscribe();
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey as BufferSource });
      }
    }
    const lang = localStorage.getItem('ekidos-lang') || 'ru';
    await api.post('/push/subscribe', { subscription: sub.toJSON(), lang });
    return true;
  } catch (e) {
    console.log('[Push] subscribe failed:', e);
    return false;
  }
}

/** Колдонуучунун басуусунан кийин чакырылат (браузерлер ошону талап кылат). */
export async function requestPushPermission(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const result = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    if (result !== 'granted') return false;
    return ensurePushSubscription();
  } catch {
    return false;
  }
}

/** Аккаунттан чыкканда — бул телефонго мындан ары уведомление келбейт. */
export async function removePushSubscription(): Promise<void> {
  try {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch {}
}
