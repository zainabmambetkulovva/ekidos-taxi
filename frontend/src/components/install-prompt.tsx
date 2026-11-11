'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';
import { useTx } from '@/lib/tx';

/**
 * Сайтка киргенде "EKIDOS — Установить" карточкасы.
 * Android/Chrome: "Установить" баскычы браузердин орнотуу терезесин ачат.
 * iPhone (Safari): автоматтык орнотуу жок — кантип кошуу керектиги көрсөтүлөт.
 * Колдонмо орнотулган болсо (же өзүнчө терезеде ачылса) карточка чыкпайт.
 */

const DISMISS_KEY = 'ekidos-install-dismissed-at';
const DISMISS_HOURS = 24;

type Mode = 'native' | 'ios' | 'manual';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const tx = useTx();
  const [deferred, setDeferred] = useState<any>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMobile = isIOS || /Android|Mobile/i.test(ua);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setMode('native');
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // iPhone'до орнотуу терезеси жок — нускама көрсөтөбүз.
    // Башка мобилдик браузерлерде 3 сек ичинде терезе даяр болбосо — менюдан орнотуу нускамасы.
    const timer = setTimeout(() => {
      if (isIOS) {
        setMode('ios');
        setVisible(true);
      } else if (isMobile) {
        setMode(m => m || 'manual');
        setVisible(true);
      }
    }, isIOS ? 1500 : 3000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    try {
      deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice?.outcome === 'accepted') setVisible(false);
      else dismiss();
    } catch {
      dismiss();
    }
  };

  if (!visible || !mode) return null;

  return (
    <div className="fixed inset-x-3 top-3 z-[9500] mx-auto max-w-md animate-in fade-in slide-in-from-top-4">
      <div className="relative rounded-2xl border border-white/10 bg-[#0f1720]/95 p-4 shadow-2xl shadow-black/60 backdrop-blur">
        <button
          onClick={dismiss}
          aria-label={tx('Закрыть', 'Жабуу', 'Close')}
          className="absolute right-2 top-2 rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 pr-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="EKIDOS" className="h-14 w-14 flex-shrink-0 rounded-2xl" />
          <div className="min-w-0">
            <p className="text-lg font-black leading-tight text-white">
              EKIDOS <span className="text-red-500">TAXI</span>
            </p>
            <p className="text-xs leading-snug text-gray-400">
              {tx(
                'Установите приложение на телефон — открывается быстрее, заказы приходят на экран.',
                'Колдонмону телефонго орнотуңуз — тез ачылат, заказдар экранга чыгат.',
                'Install the app on your phone — opens faster, orders pop up on screen.',
              )}
            </p>
          </div>
        </div>

        {mode === 'native' && (
          <button
            onClick={install}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-base font-bold text-white shadow-lg shadow-red-600/30 transition-all hover:bg-red-700 active:scale-[0.98]"
          >
            <Download className="h-5 w-5" />
            {tx('Установить', 'Установить', 'Install')}
          </button>
        )}

        {mode === 'ios' && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-white/5 p-3 text-sm text-gray-200">
            <p className="flex items-center gap-2">
              1. {tx('Нажмите', 'Басыңыз', 'Tap')} <Share className="h-4 w-4 text-blue-400" /> <b>{tx('Поделиться', 'Бөлүшүү', 'Share')}</b>
            </p>
            <p className="flex items-center gap-2">
              2. {tx('Выберите', 'Тандаңыз', 'Choose')} <PlusSquare className="h-4 w-4 text-blue-400" /> <b>{tx('На экран «Домой»', '«Домой» экранына', 'Add to Home Screen')}</b>
            </p>
          </div>
        )}

        {mode === 'manual' && (
          <div className="mt-3 rounded-xl bg-white/5 p-3 text-sm text-gray-200">
            {tx(
              'Откройте меню браузера (⋮) и выберите «Установить приложение» или «Добавить на главный экран».',
              'Браузердин менюсун (⋮) ачып, «Установить приложение» же «Добавить на главный экран» дегенди тандаңыз.',
              'Open the browser menu (⋮) and choose “Install app” or “Add to Home screen”.',
            )}
          </div>
        )}
      </div>
    </div>
  );
}
