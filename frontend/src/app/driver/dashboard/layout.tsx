'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  MapPin, List, Navigation,
  UserCircle, Settings, LogOut, Menu, X,
  Star, Car, Loader2, Radio, Power, Coffee, MessageCircle,
} from 'lucide-react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useDriverStore } from '@/store/useDriverStore';
import BlockTimer from './block-timer';
import IncomingOrderOverlay from './incoming-order';
import { useTx } from '@/lib/tx';
import { connectSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { playWelcomeSound, playClickSound, playOrderAlertSound } from '@/lib/sounds';

import api from '@/lib/axios';

// Header Balance component - shows just the number in blue banner
function DriverHeaderBalance() {
  const [balance, setBalance] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const info = localStorage.getItem('driverInfo');
      if (info) {
        const b = JSON.parse(info).balance;
        if (typeof b === 'number') return b;
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (typeof data.balance === 'number') {
          // Sync to localStorage
          try {
            const info = localStorage.getItem('driverInfo');
            if (info) {
              const parsed = JSON.parse(info);
              parsed.balance = data.balance;
              localStorage.setItem('driverInfo', JSON.stringify(parsed));
            }
          } catch {}
          setBalance(data.balance);
          window.dispatchEvent(new CustomEvent('driverBalance', { detail: data.balance }));
        }
      } catch {
        // fallback: read from localStorage only (no secondary API call)
        try {
          const info = localStorage.getItem('driverInfo');
          if (info) {
            const b = JSON.parse(info).balance;
            if (typeof b === 'number') setBalance(b);
          }
        } catch {}
      }
    };
    fetchBalance();
    // Негизги жаңылоо socket аркылуу (дароо). Бул — резерв гана.
    const iv = setInterval(fetchBalance, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') fetchBalance(); };
    document.addEventListener('visibilitychange', onVisible);

    // Realtime balance update via socket
    const socket = connectSocket();

    // Make sure driver is in their room to receive balance:updated
    try {
      const info = localStorage.getItem('driverInfo');
      const driverId = info ? JSON.parse(info).id : null;
      if (driverId) {
        socket.emit('driver:join', driverId);
      }
    } catch {}
    // Кайра туташканда балансты дароо текшерүү
    socket.on('connect', fetchBalance);

    const handleBalanceUpdate = (data: { balance: number }) => {
      if (typeof data.balance === 'number') {
        setBalance(data.balance);
        window.dispatchEvent(new CustomEvent('driverBalance', { detail: data.balance }));
        try {
          const info = localStorage.getItem('driverInfo');
          if (info) {
            const parsed = JSON.parse(info);
            parsed.balance = data.balance;
            localStorage.setItem('driverInfo', JSON.stringify(parsed));
          }
        } catch {}
      }
    };
    socket.on('balance:updated', handleBalanceUpdate);

    // Low balance warning
    const handleBalanceLow = (data: { balance: number; required: number; message: string }) => {
      import('sonner').then(({ toast }) => {
        toast.warning(`⚠️ ${data.message}`, { duration: 8000 });
      });
    };
    socket.on('balance:low', handleBalanceLow);

    // Заказ кабыл алынганда жооптон келген баланс (page.tsx жиберет)
    const handleLocalBalance = (e: Event) => {
      const b = (e as CustomEvent).detail;
      if (typeof b === 'number') setBalance(b);
    };
    window.addEventListener('driverBalance', handleLocalBalance);

    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('driverBalance', handleLocalBalance);
      socket.off('balance:updated', handleBalanceUpdate);
      socket.off('balance:low', handleBalanceLow);
      socket.off('connect', fetchBalance);
    };
  }, []);

  if (balance === null) return null;

  return (
    <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#7BBDE8]/20 text-[#7BBDE8]">
      {balance}
    </div>
  );
}

// Line Status Button component
function LineStatusButton({ status }: { status: 'ONLINE' | 'OFFLINE' | 'BUSY_PERSONAL' }) {
  const { lineStatus, setLineStatus } = useDriverStore();
  const isActive = lineStatus === status;

  const config = {
    ONLINE: {
      label: 'Выйти на линию',
      icon: Radio,
      activeClass: 'bg-green-500/30 text-green-300 border-2 border-green-400 shadow-lg shadow-green-500/30',
      inactiveClass: 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent',
    },
    BUSY_PERSONAL: {
      label: 'Занят',
      icon: Coffee,
      activeClass: 'bg-orange-500/30 text-orange-300 border-2 border-orange-400 shadow-lg shadow-orange-500/30',
      inactiveClass: 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent',
    },
    OFFLINE: {
      label: 'Завершить линию',
      icon: Power,
      activeClass: 'bg-red-500/30 text-red-300 border-2 border-red-400 shadow-lg shadow-red-500/20',
      inactiveClass: 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent',
    },
  }[status];

  const handlePress = () => {
    playWelcomeSound();
    const socket = connectSocket();
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;

    setLineStatus(status);

    if (driverId) {
      socket.emit('driver:status', { driverId, status });
    }

    if (status === 'ONLINE') {
      toast.success('Линияга чыктыңыз! Заказдар келет.');
    } else if (status === 'BUSY_PERSONAL') {
      toast('Занят. Заказдар келбейт.', { icon: '☕' });
    } else {
      toast('Линия бүттү.', { icon: '🔴' });
    }
  };

  return (
    <button
      onClick={handlePress}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isActive ? config.activeClass : config.inactiveClass
      }`}
    >
      <config.icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_6px_currentColor]' : ''}`} />
      <span className="text-sm font-semibold">{config.label}</span>
      {isActive && (
        <span className="ml-auto w-2.5 h-2.5 rounded-full bg-current animate-pulse shadow-[0_0_8px_currentColor]" />
      )}
    </button>
  );
}

export default function DriverDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguageStore();
  const { lineStatus, activeOrder, setActiveOrder, setLineStatus } = useDriverStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<any>(null);
  const tx = useTx();

  // AUTH GUARD: check token exists, redirect to login if not
  useEffect(() => {
    const token = localStorage.getItem('token');
    const driverInfo = localStorage.getItem('driverInfo');
    if (!token || !driverInfo) {
      router.replace('/driver/login');
      return;
    }
    setAuthChecked(true);
    // Play welcome sound on first user interaction (browser requires it)
    const playOnce = () => {
      playWelcomeSound();
      document.removeEventListener('touchstart', playOnce);
      document.removeEventListener('click', playOnce);
    };
    document.addEventListener('touchstart', playOnce, { once: true });
    document.addEventListener('click', playOnce, { once: true });
  }, [router]);

  // Активдүү заказ (ASSIGNED / IN_PROGRESS) — сервер + socket менен синхрон
  useEffect(() => {
    if (!authChecked) return;
    const driverInfo = localStorage.getItem('driverInfo');
    const myId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (!myId) return;

    const checkActiveOrder = async () => {
      try {
        const { data } = await api.get('/orders/driver/active', { params: { driverId: myId } });
        const has = !!(data && data.id);
        setHasActiveOrder(has);
        // Диспетчер/сервер тараптан келген заказ — картада да көрүнсүн
        const current = useDriverStore.getState().activeOrder;
        if (has && !current) setActiveOrder(data);
        // Телефон өчүк турганда заказ бүтүп/отмена болсо — эски заказды тазалайбыз
        if (!has && current?.id) {
          const { data: st } = await api.get(`/orders/${current.id}/status`).catch(() => ({ data: null }));
          if ((st?.status === 'COMPLETED' || st?.status === 'CANCELLED') && useDriverStore.getState().activeOrder?.id === current.id) {
            setActiveOrder(null);
            // Телефон өчүк турганда отмена болгон — кабарды көрсөтөбүз
            if (st?.status === 'CANCELLED') {
              setCancelNotice({ orderId: current.id, orderNumber: current.orderNumber, pickupAddress: current.pickupAddress, destAddress: current.destAddress, by: 'dispatcher' });
            }
          }
        }
      } catch {}
    };
    checkActiveOrder();
    const iv = setInterval(checkActiveOrder, 15000);

    const socket = connectSocket();
    const onAccepted = (order: any) => {
      if (order?.driverId !== myId) return;
      setHasActiveOrder(true);
      if (!useDriverStore.getState().activeOrder) setActiveOrder(order);
    };
    const onFinished = (payload: any) => {
      const orderId = payload?.orderId || payload?.id;
      const current = useDriverStore.getState().activeOrder;
      const mine = payload?.driverId === myId || (current && current.id === orderId);
      if (!mine) return;
      setHasActiveOrder(false);
      if (current && current.id === orderId) setActiveOrder(null);
    };
    const onCancelled = (payload: any) => {
      const current = useDriverStore.getState().activeOrder;
      if (current && current.id === payload?.orderId) {
        setActiveOrder(null);
        setHasActiveOrder(false);
      }
    };
    // Диспетчер (же клиент) отмена кылды — экранга чоң кабар
    const onCancelNotice = (notice: any) => {
      const current = useDriverStore.getState().activeOrder;
      if (current && current.id === notice?.orderId) {
        setActiveOrder(null);
        setHasActiveOrder(false);
      }
      setCancelNotice(notice);
      try { playOrderAlertSound(); } catch {}
      if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
    };
    socket.on('order:cancelled-notice', onCancelNotice);
    socket.on('order:accepted', onAccepted);
    socket.on('order:completed', onFinished);
    socket.on('order:cancelled', onCancelled);
    socket.on('connect', checkActiveOrder);

    return () => {
      clearInterval(iv);
      socket.off('order:accepted', onAccepted);
      socket.off('order:completed', onFinished);
      socket.off('order:cancelled', onCancelled);
      socket.off('order:cancelled-notice', onCancelNotice);
      socket.off('connect', checkActiveOrder);
    };
  }, [authChecked, setActiveOrder]);

  // Listen for incoming DMs and count unread
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const driverInfo = localStorage.getItem('driverInfo');
    const myId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (!myId) return;

    const socket = connectSocket();
    socket.emit('dm:join', myId);

    const handleDm = (msg: any) => {
      // Only count if not on chat page and message is for me
      if (msg.receiverId === myId && !window.location.pathname.includes('/chat')) {
        setUnreadCount(prev => prev + 1);
      }
    };
    socket.on('dm:message', handleDm);
    return () => { socket.off('dm:message', handleDm); };
  }, [authChecked]);

  // Connect socket immediately when driver dashboard loads
  useState(() => {
    if (typeof window !== 'undefined') {
      const socket = connectSocket();
      const driverInfo = localStorage.getItem('driverInfo');
      const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
      if (driverId) {
        // Телефондун экраны өчүп/браузер фонго кетип байланыш үзүлсө, сервер водительди
        // OFFLINE кылат. Кайра ачылганда линия статусун калыбына келтиребиз — заказдар кайра келет.
        const restoreLine = () => {
          const line = localStorage.getItem('ekidos-driver-line-status');
          if (line === 'ONLINE' || line === 'BUSY_PERSONAL') {
            socket.emit('driver:restore-status', { driverId, status: line });
          }
        };
        socket.emit('driver:join', driverId);
        restoreLine();
        // Re-join on reconnect
        socket.on('connect', () => {
          socket.emit('driver:join', driverId);
          restoreLine();
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            if (!socket.connected) socket.connect();
            else restoreLine();
          }
        });
      }
    }
  });

  // Handle logout — ONLY when driver explicitly taps logout
  const handleLogout = () => {
    // Аккаунттан чыгуу — линияны да бүтүрөт (сервер водительди өзү оффлайн кылбайт)
    try {
      const info = localStorage.getItem('driverInfo');
      const driverId = info ? JSON.parse(info).id : null;
      if (driverId) connectSocket().emit('driver:status', { driverId, status: 'OFFLINE' });
    } catch {}
    setLineStatus('OFFLINE');
    localStorage.removeItem('token');
    localStorage.removeItem('driverInfo');
    router.replace('/driver/login');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  // Неон түсү: заказ бар — КЫЗЫЛ, бош (линияда) — ЖАШЫЛ, занят — ОРАНЖЕВЫЙ
  const hasOrder = !!activeOrder || hasActiveOrder;
  const glow: 'order' | 'free' | 'busy' | null =
    hasOrder && lineStatus !== 'OFFLINE' ? 'order'
    : lineStatus === 'ONLINE' ? 'free'
    : lineStatus === 'BUSY_PERSONAL' ? 'busy'
    : null;

  const driverMenu = [
    { icon: MapPin, label: t('dashboard'), href: '/driver/dashboard' },
    { icon: MessageCircle, label: 'Чат', href: '/driver/dashboard/chat' },
    { icon: List, label: t('availableOrders'), href: '/driver/dashboard/orders' },
    { icon: UserCircle, label: t('profile'), href: '/driver/dashboard/profile' },
    { icon: Settings, label: t('settings'), href: '/driver/dashboard/settings' },
  ];

  return (
    <div className="min-h-screen bg-[#141E30] flex flex-col">
      {/* Block Timer Overlay */}
      <BlockTimer />
      {/* Жаңы заказ — бардык беттерде экранга чыгат */}
      <IncomingOrderOverlay />
      {/* Заказ отмена болду — толук экран кабар */}
      {cancelNotice && (
        <div className="fixed inset-0 z-[10000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-sm rounded-3xl border-2 border-red-500 bg-[#1a0d0d] p-6 text-center shadow-2xl shadow-red-500/30">
            <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
              <X className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">{tx('ЗАКАЗ — ОТМЕНА', 'ЗАКАЗ ОТМЕНА БОЛДУ', 'ORDER — ОТМЕНА')}</h2>
            <p className="text-base text-red-200 mb-4">
              {cancelNotice.by === 'client'
                ? tx('Клиент сделал отмену заказа', 'Клиент заказды отмена кылды', 'The client made an Отмена')
                : tx('Этот заказ — отмена от диспетчера', 'Бул заказ диспетчер тарабынан отмена болду', 'Отмена by the dispatcher')}
            </p>
            {(cancelNotice.pickupAddress || cancelNotice.orderNumber) && (
              <div className="rounded-xl bg-white/5 px-4 py-3 mb-5 text-left space-y-1">
                {cancelNotice.orderNumber && <p className="text-xs text-gray-400">#{cancelNotice.orderNumber}</p>}
                {cancelNotice.pickupAddress && <p className="text-sm text-white">📍 {cancelNotice.pickupAddress}</p>}
                {cancelNotice.destAddress && cancelNotice.destAddress !== 'Не указано' && (
                  <p className="text-sm text-gray-300">🏁 {cancelNotice.destAddress}</p>
                )}
              </div>
            )}
            <button
              onClick={() => setCancelNotice(null)}
              className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-lg font-black active:scale-95 transition-all"
            >
              {tx('ПОНЯТНО', 'ТҮШҮНДҮМ', 'OK')}
            </button>
          </div>
        </div>
      )}
      {/* Top Nav - neon glow when on duty */}
      <header className="sticky top-0 z-[5000] px-4 py-3"
      style={
        glow === 'order'
          ? {
              background: 'linear-gradient(180deg, #2e0d0d 0%, #1a2740 100%)',
              borderBottom: '4px solid #ff0000',
              boxShadow: '0 0 50px #ff0000cc, 0 0 100px #ff000077, 0 8px 40px #ff0000bb, inset 0 -3px 25px #ff000066'
            }
          : glow === 'free'
          ? {
              background: 'linear-gradient(180deg, #0d2e0d 0%, #1a2740 100%)',
              borderBottom: '4px solid #00ff00',
              boxShadow: '0 0 50px #00ff00cc, 0 0 100px #00ff0077, 0 8px 40px #00ff00bb, inset 0 -3px 25px #00ff0066'
            }
          : glow === 'busy'
          ? {
              background: 'linear-gradient(180deg, #2e1a00 0%, #1a2740 100%)',
              borderBottom: '4px solid #ff9500',
              boxShadow: '0 0 50px #ff9500cc, 0 0 100px #ff950077, 0 8px 40px #ff9500bb, inset 0 -3px 25px #ff950066'
            }
          : { background: '#1a2740', borderBottom: '1px solid rgba(53,87,125,0.3)' }
      }>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 hover:bg-[#35577D]/20 rounded-lg">
              <Menu className="w-5 h-5 text-white" />
            </button>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <span className="text-white">EKIDOS</span>
              <span className="text-[#7BBDE8]"> {t('driver')}</span>
              <DriverHeaderBalance />
            </h1>
          </div>
        </div>
      </header>

      {/* Sidebar - z-index выше карты */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-[9998] backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-72 bg-[#0f1720] border-r border-[#35577D]/30 z-[9999] flex flex-col shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="p-5 border-b border-[#35577D]/30 flex items-center justify-between">
              <h2 className="font-bold text-lg">
                <span className="text-white">EKIDOS</span>
                <span className="text-[#7BBDE8]"> {t('driver')}</span>
              </h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#35577D]/30 flex items-center justify-center hover:bg-[#35577D]/50 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Driver info card */}
            <div className="p-4">
              <div className="bg-gradient-to-r from-[#35577D]/20 to-transparent rounded-2xl p-4 border border-[#35577D]/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#35577D] to-[#141E30] flex items-center justify-center">
                    <Car className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Водитель</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-xs text-muted-foreground">5.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Status Buttons */}
            <div className="px-3 mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider px-4 mb-2 font-semibold">Линия статусу</p>
              <div className="space-y-1.5 rounded-2xl p-2 bg-[#1e3a5f]">
                <LineStatusButton status="ONLINE" />
                <LineStatusButton status="BUSY_PERSONAL" />
                <LineStatusButton status="OFFLINE" />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1">
              {driverMenu.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => { playClickSound(); router.push(item.href); setMobileOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[#35577D]/30 text-white border border-[#35577D]/50'
                        : 'text-gray-400 hover:text-white hover:bg-[#35577D]/15'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-[#35577D]/30">
              <button
                onClick={() => { handleLogout(); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">{t('logout')}</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Bottom Tab Navigation */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[5000] px-1 py-1.5"
        style={
          glow === 'order'
            ? {
                background: 'linear-gradient(0deg, #2e0d0d 0%, #1a2740 100%)',
                borderTop: '4px solid #ff0000',
                boxShadow: '0 0 50px #ff0000cc, 0 0 100px #ff000077, 0 -8px 40px #ff0000bb, inset 0 3px 25px #ff000066'
              }
            : glow === 'free'
            ? {
                background: 'linear-gradient(0deg, #0d2e0d 0%, #1a2740 100%)',
                borderTop: '4px solid #00ff00',
                boxShadow: '0 0 50px #00ff00cc, 0 0 100px #00ff0077, 0 -8px 40px #00ff00bb, inset 0 3px 25px #00ff0066'
              }
            : glow === 'busy'
            ? {
                background: 'linear-gradient(0deg, #2e1a00 0%, #1a2740 100%)',
                borderTop: '4px solid #ff9500',
                boxShadow: '0 0 50px #ff9500cc, 0 0 100px #ff950077, 0 -8px 40px #ff9500bb, inset 0 3px 25px #ff950066'
              }
            : { background: '#1a2740', borderTop: '1px solid rgba(53,87,125,0.3)' }
        }
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {driverMenu.slice(0, 4).map((item) => {
            const isActive = pathname === item.href;
            const isChatTab = item.href === '/driver/dashboard/chat';
            return (
              <button
                key={item.href}
                onClick={() => {
                  playClickSound();
                  if (isChatTab) setUnreadCount(0);
                  router.push(item.href);
                }}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all relative ${
                  isActive
                    ? glow === 'order' ? 'text-[#ff3333]' : glow === 'free' ? 'text-[#39ff14]' : glow === 'busy' ? 'text-[#ff6a00]' : 'text-[#7BBDE8]'
                    : 'text-gray-400'
                }`}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {isChatTab && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 pb-16">
        {children}
      </main>
    </div>
  );
}
