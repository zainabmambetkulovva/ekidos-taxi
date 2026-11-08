'use client';

import dynamic from 'next/dynamic';
import { Clock, CheckCircle2, Navigation, Phone, MapPin as MapPinIcon, Car, XCircle } from 'lucide-react';
import { useDriverStore } from '@/store/useDriverStore';
import { getClientDisplayName } from '@/lib/display-names';
import { useLanguageStore } from '@/store/useLanguageStore';
import { playWelcomeSound } from '@/lib/sounds';
import { ORDER_OPTIONS, getOptionEmoji, getOptionLabel } from '@/lib/order-options';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { connectSocket } from '@/lib/socket';

// Active Order Card with step-by-step flow
function ActiveOrderCard({ order, onComplete, onCancel }: { order: any; onComplete: () => void; onCancel: () => void }) {
  const [step, setStep] = useState<'driving' | 'arrived' | 'client_in_car'>('driving');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [countdown, setCountdown] = useState(120);
  const [extraCharge, setExtraCharge] = useState(0);

  useEffect(() => {
    if (step !== 'arrived') return;
    setCountdown(120);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setExtraCharge(50);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const handleArrived = () => {
    playWelcomeSound();
    const socket = connectSocket();
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (driverId && order.id) {
      socket.emit('driver:arrived', { orderId: order.id, driverId });
    }
    setStep('arrived');
    toast.success('Клиент уведомлён!');
  };

  const handleClientInCar = () => {
    playWelcomeSound();
    setStep('client_in_car');
    toast.success('В пути!');
  };

  const handleComplete = () => {
    playWelcomeSound();
    onComplete();
  };

  return (
    <div className="bg-[#0d0d0d] border border-green-500/30 rounded-2xl p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
          {step === 'driving' && 'Еду к клиенту'}
          {step === 'arrived' && 'На месте'}
          {step === 'client_in_car' && 'В пути'}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-500/20 flex-shrink-0" />
          <p className="text-sm text-white leading-tight">{order.pickupAddress}</p>
        </div>
        <div className="ml-[4px] border-l-2 border-dashed border-white/10 h-3" />
        <div className="flex items-start gap-2.5">
          <div className="mt-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-500/20 flex-shrink-0" />
          <p className="text-sm text-white leading-tight">{order.destAddress}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 bg-white/5 rounded-xl px-3 py-2">
        <span className="text-xs text-gray-400">Клиент: <span className="text-white font-medium">{order.clientName}</span></span>
        {order.clientPhone && (
          <a href={`tel:${order.clientPhone}`} className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Phone className="w-3.5 h-3.5 text-blue-400" />
          </a>
        )}
      </div>

      {/* Order options */}
      {order.options && order.options.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {order.options.map((optId: string) => (
            <span
              key={optId}
              className="inline-flex items-center gap-1 text-xs bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 px-2 py-1 rounded-full font-medium"
            >
              <span>{getOptionEmoji(optId)}</span>
              <span>{getOptionLabel(optId)}</span>
            </span>
          ))}
        </div>
      )}

      {step === 'driving' && (
        <div className="flex gap-2">
          <button
            onClick={() => window.open(`yandexnavi://build_route_on_map?lat_to=${encodeURIComponent(order.pickupLat || '')}&lon_to=${encodeURIComponent(order.pickupLng || '')}&appmetrica_tracking_id=1178268795219780096`, '_blank') || window.open(`https://yandex.com/maps/?rtext=~${order.pickupLat},${order.pickupLng}&rtt=auto`, '_blank')}
            className="flex-1 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
          >
            <Navigation className="w-4 h-4" />
            Навигация
          </button>
          <button
            onClick={handleArrived}
            className="flex-1 h-11 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
          >
            <MapPinIcon className="w-4 h-4" />
            Я подъехал
          </button>
        </div>
      )}

      {step === 'arrived' && (
        <button
          onClick={handleClientInCar}
          className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
        >
          <Car className="w-5 h-5" />
          Клиент в машине
        </button>
      )}

      {step === 'client_in_car' && (
        <button
          onClick={handleComplete}
          className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-lg shadow-green-500/20"
        >
          <CheckCircle2 className="w-5 h-5" />
          Завершить заказ
        </button>
      )}

      {/* Отмена — заказ башка водительдерге кетет */}
      {confirmCancel ? (
        <div className="mt-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
          <p className="text-xs text-red-200 text-center mb-2">Заказды чын эле отмена кыласызбы? Заказ башка водительге берилет.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmCancel(false)}
              className="flex-1 h-10 rounded-lg bg-white/10 text-white text-xs font-bold active:scale-[0.97] transition-all"
            >
              Жок
            </button>
            <button
              onClick={() => { setConfirmCancel(false); onCancel(); }}
              className="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold active:scale-[0.97] transition-all"
            >
              Ооба, отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmCancel(true)}
          className="mt-2 w-full h-10 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
        >
          <XCircle className="w-4 h-4" />
          Отмена
        </button>
      )}
    </div>
  );
}

const DriverMap = dynamic(() => import('./driver-map'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-black/50 animate-pulse flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function DriverHomePage() {
  const { isOnline, activeOrder, lineStatus, setLineStatus, setActiveOrder } = useDriverStore();
  const { t } = useLanguageStore();
  const toktogulCenter: [number, number] = [41.8747, 72.9422];
  const [balance, setBalance] = useState<number | null>(null);

  // Fetch driver balance — read from localStorage (layout.tsx syncs via API)
  useEffect(() => {
    const syncBalance = () => {
      try {
        const info = localStorage.getItem('driverInfo');
        if (info) {
          const b = JSON.parse(info).balance;
          if (typeof b === 'number') setBalance(b);
        }
      } catch {}
    };
    syncBalance();
    // layout.tsx баланс өзгөргөндө дароо кабарлайт
    const onBalance = (e: Event) => {
      const b = (e as CustomEvent).detail;
      if (typeof b === 'number') setBalance(b);
    };
    window.addEventListener('driverBalance', onBalance);
    const iv = setInterval(syncBalance, 15000);
    return () => {
      clearInterval(iv);
      window.removeEventListener('driverBalance', onBalance);
    };
  }, []);

  // Listen for new orders on dashboard (play sound)
  useEffect(() => {
    if (lineStatus !== 'ONLINE') return;
    const socket = connectSocket();
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (driverId) socket.emit('driver:join', driverId);

    const handleNewOrder = () => {
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    };
    socket.on('order:available', handleNewOrder);
    return () => { socket.off('order:available', handleNewOrder); };
  }, [lineStatus]);

  // GPS location broadcasting when online or busy_personal
  useEffect(() => {
    if (lineStatus === 'OFFLINE') return;
    const socket = connectSocket();
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (!driverId) return;

    let watchId: number | null = null;

    // Send location every position change
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          socket.emit('driver:location', { driverId, lat: latitude, lng: longitude });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }

    // Also send periodically via API (backup)
    const iv = setInterval(() => {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          socket.emit('driver:location', { driverId, lat: latitude, lng: longitude });
          // Also save to backend directly
          api.patch(`/drivers/${driverId}/location`, { latitude, longitude }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }, 10000); // every 10s

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(iv);
    };
  }, [lineStatus]);

  const handleCompleteOrder = async () => {
    if (!activeOrder) return;
    const orderId = activeOrder.id;
    // Дароо бошотобуз — экран заматта жашыл болот
    setActiveOrder(null);
    toast.success('Заказ выполнен! Молодец!');
    api.patch(`/orders/${orderId}/complete`).catch(() => {
      // Тармак катасы — бир жолу кайра аракет
      setTimeout(() => api.patch(`/orders/${orderId}/complete`).catch(() => {}), 2000);
    });
  };

  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    const order = activeOrder;
    // Дароо бошотобуз — экран заматта жашыл болот
    setActiveOrder(null);
    try {
      const { data } = await api.patch(`/orders/${order.id}/driver-cancel`);
      toast('Заказ отмена болду. Башка водительге берилди.', { icon: '↩️' });
      if (typeof data?.newBalance === 'number') {
        try {
          const info = localStorage.getItem('driverInfo');
          if (info) {
            const parsed = JSON.parse(info);
            parsed.balance = data.newBalance;
            localStorage.setItem('driverInfo', JSON.stringify(parsed));
          }
        } catch {}
        window.dispatchEvent(new CustomEvent('driverBalance', { detail: data.newBalance }));
      }
    } catch (error: any) {
      // Отмена болбоду — заказды кайра көрсөтөбүз
      if (!useDriverStore.getState().activeOrder) setActiveOrder(order);
      toast.error(error?.response?.data?.error || 'Отмена кылуу мүмкүн болбоду');
    }
  };

  return (
    <div className="relative h-[calc(100vh-120px)]">
      {/* LOW BALANCE WARNING - shown when balance < 12 */}
      {balance !== null && balance < 12 && !activeOrder && (
        <div className="absolute inset-0 z-[9998] bg-black/95 flex flex-col items-center justify-center p-6">
          <div className="w-32 h-32 rounded-full border-4 border-red-500 flex flex-col items-center justify-center mb-6 shadow-lg shadow-red-500/30">
            <span className="text-3xl font-black text-red-500">{balance}</span>
            <span className="text-xs text-gray-400 mt-1">сом</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-3 text-center">Балансыңызды толуктаңыз!</h1>
          <p className="text-gray-400 text-sm text-center mb-6 max-w-xs leading-relaxed">
            Заказ кабыл алуу үчүн балансыңыз кем дегенде <span className="text-yellow-400 font-bold">12 сом</span> болушу керек.
          </p>
          <div className="bg-white/5 border border-red-500/30 rounded-2xl p-5 w-full max-w-xs space-y-2">
            <p className="text-sm text-white text-center font-semibold">Кантип толуктоо керек?</p>
            <p className="text-xs text-gray-400 text-center">Telegram ботко өтүп, чек жөнөтүңүз.</p>
            <p className="text-xs text-gray-400 text-center">Канча сом салсаңыз — ошончо баланс болот.</p>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="absolute inset-0" style={{ minHeight: '400px' }}>
        <DriverMap center={toktogulCenter} showMarker={lineStatus !== 'OFFLINE'} />
      </div>

      {/* Balance gauge removed - balance shown in header */}

      {/* Location button */}
      <button
        onClick={() => {
          navigator.geolocation?.getCurrentPosition((pos) => {
            window.dispatchEvent(new CustomEvent('driverCenterMap', {
              detail: { lat: pos.coords.latitude, lng: pos.coords.longitude }
            }));
          }, () => {}, { enableHighAccuracy: true });
        }}
        className="absolute top-28 right-4 z-[1000] w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        aria-label="My location"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12,2 19,21 12,17 5,21" />
        </svg>
      </button>

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">

        {/* Active order card */}
        {isOnline && activeOrder && (
          <div className="px-3 pb-2">
            <ActiveOrderCard key={activeOrder.id} order={activeOrder} onComplete={handleCompleteOrder} onCancel={handleCancelOrder} />
          </div>
        )}
      </div>
    </div>
  );
}
