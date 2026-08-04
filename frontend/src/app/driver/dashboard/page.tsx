'use client';

import dynamic from 'next/dynamic';
import { Clock, CheckCircle2, Navigation, Phone, MapPin as MapPinIcon, Car } from 'lucide-react';
import { useDriverStore } from '@/store/useDriverStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { connectSocket } from '@/lib/socket';

// Active Order Card with step-by-step flow
function ActiveOrderCard({ order, onComplete }: { order: any; onComplete: () => void }) {
  const [step, setStep] = useState<'driving' | 'arrived' | 'client_in_car'>('driving');
  const [countdown, setCountdown] = useState(120); // 2 minutes in seconds
  const [extraCharge, setExtraCharge] = useState(0);

  // Countdown timer when arrived
  useEffect(() => {
    if (step !== 'arrived') return;
    setCountdown(120);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Time's up - add 50 som
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
    // Emit socket event to notify client
    const socket = connectSocket();
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (driverId && order.id) {
      socket.emit('driver:arrived', { orderId: order.id, driverId });
    }
    setStep('arrived');
    toast.success('Клиентке кабар берилди!');
  };

  const handleClientInCar = () => {
    setStep('client_in_car');
    toast.success('Жолго!');
  };

  return (
    <div className="bg-[#0d0d0d] border border-green-500/30 rounded-2xl p-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
          {step === 'driving' && 'Еду к клиенту'}
          {step === 'arrived' && 'На месте'}
          {step === 'client_in_car' && 'В пути'}
        </span>
        <span className="text-xl font-black text-green-400">{order.price + extraCharge} сом</span>
      </div>

      {/* Route */}
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

      {/* Client info */}
      <div className="flex items-center justify-between mb-3 bg-white/5 rounded-xl px-3 py-2">
        <span className="text-xs text-gray-400">Клиент: <span className="text-white font-medium">{order.clientName}</span></span>
        {order.clientPhone && (
          <a href={`tel:${order.clientPhone}`} className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Phone className="w-3.5 h-3.5 text-blue-400" />
          </a>
        )}
      </div>

      {/* Step-by-step action buttons */}
      {step === 'driving' && (
        <div className="flex gap-2">
          <button
            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.pickupAddress)}`, '_blank')}
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
        <div className="space-y-2">
          {/* Countdown timer */}
          <div className="text-center py-2">
            <span className={`text-lg font-bold ${countdown > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
              {countdown > 0 ? `${Math.floor(countdown/60)}:${(countdown%60).toString().padStart(2,'0')}` : '+50 сом'}
            </span>
            <p className="text-[10px] text-gray-500">
              {countdown > 0 ? 'Бесплатно күтүү' : 'Кошумча акы кошулду'}
            </p>
          </div>
          {extraCharge > 0 && (
            <div className="text-center text-xs text-red-400 font-medium">
              Кошумча: +{extraCharge} сом (жалпы: {order.price + extraCharge} сом)
            </div>
          )}
          <button
            onClick={handleClientInCar}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
          >
            <Car className="w-5 h-5" />
            Клиент в машине
          </button>
        </div>
      )}

      {step === 'client_in_car' && (
        <button
          onClick={onComplete}
          className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-all shadow-lg shadow-green-500/20"
        >
          <CheckCircle2 className="w-5 h-5" />
          Завершить заказ
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
  const [incomingOrder, setIncomingOrder] = useState<any>(null);
  const [incomingTimer, setIncomingTimer] = useState(0);

  // Fetch driver balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const { data } = await api.get('/auth/me');
        const b = data.balance;
        if (typeof b === 'number') {
          setBalance(b);
          // Update localStorage with fresh balance
          const info = localStorage.getItem('driverInfo');
          if (info) {
            const parsed = JSON.parse(info);
            parsed.balance = b;
            localStorage.setItem('driverInfo', JSON.stringify(parsed));
          }
        }
      } catch {
        // Don't set balance to 0 on error - keep null (loading)
      }
    };
    fetchBalance();
    const iv = setInterval(fetchBalance, 30000);
    return () => clearInterval(iv);
  }, []);

  // Listen for INCOMING ORDER (fullscreen) — ALWAYS active when logged in
  useEffect(() => {
    const socket = connectSocket();
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (!driverId) return;

    // Make sure we're in the room
    socket.emit('driver:join', driverId);

    const handleIncomingOrder = (order: any) => {
      if (order.assignedDriverId !== driverId) return;
      // Don't accept orders when BUSY_PERSONAL
      const currentStatus = localStorage.getItem('ekidos-driver-line-status');
      if (currentStatus === 'BUSY_PERSONAL') return;
      
      setIncomingOrder(order);
      setIncomingTimer(25);
      // Aggressive vibrate
      if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500, 200, 500]);
      // Alarm sound
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.value = 800;
          osc.connect(ctx.destination);
          osc.start();
          setTimeout(() => { osc.frequency.value = 1000; }, 300);
          setTimeout(() => { osc.frequency.value = 1200; }, 600);
          setTimeout(() => { osc.frequency.value = 800; }, 900);
          setTimeout(() => { osc.frequency.value = 1200; }, 1200);
          setTimeout(() => { osc.stop(); ctx.close(); }, 1500);
        }
      } catch {}
    };

    const handleExpired = () => {
      setIncomingOrder(null);
      setIncomingTimer(0);
    };

    socket.on('order:incoming', handleIncomingOrder);
    socket.on('order:expired', handleExpired);

    return () => {
      socket.off('order:incoming', handleIncomingOrder);
      socket.off('order:expired', handleExpired);
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

  // Countdown timer for incoming order
  useEffect(() => {
    if (!incomingOrder || incomingTimer <= 0) return;
    const iv = setInterval(() => {
      setIncomingTimer(prev => {
        if (prev <= 1) {
          setIncomingOrder(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [incomingOrder]);

  const handleAcceptIncoming = async () => {
    if (!incomingOrder) return;
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (!driverId) return;

    try {
      await api.patch(`/orders/${incomingOrder.id}/accept`, { driverId });
      setActiveOrder(incomingOrder);
      setIncomingOrder(null);
      setIncomingTimer(0);
      toast.success('Заказ кабыл алынды!');
    } catch {
      toast.error('Ката — кайра аракет кылыңыз');
    }
  };

  const handleRejectIncoming = () => {
    setIncomingOrder(null);
    setIncomingTimer(0);
    // Server will auto-timeout and send to next driver
  };

  const handleCompleteOrder = async () => {
    if (!activeOrder) return;
    try {
      await api.patch(`/orders/${activeOrder.id}/complete`);
      setActiveOrder(null);
      toast.success('Заказ выполнен! Молодец!');
    } catch {
      // Even if API fails, clear locally
      setActiveOrder(null);
      toast.success('Заказ выполнен!');
    }
  };

  return (
    <div className="relative h-[calc(100vh-120px)]">
      {/* BALANCE BLOCK SCREEN - only when balance confirmed 0 from server */}
      {balance !== null && balance <= 0 && !incomingOrder && !activeOrder && (
        <div className="absolute inset-0 z-[9998] bg-black flex flex-col items-center justify-center p-6">
          <div className="w-32 h-32 rounded-full border-4 border-red-500 flex flex-col items-center justify-center mb-6">
            <span className="text-3xl font-black text-red-500">0</span>
            <span className="text-xs text-gray-500">баланс</span>
          </div>
          <h1 className="text-2xl font-black text-white mb-2 text-center">Баланс толуктаңыз!</h1>
          <p className="text-gray-400 text-sm text-center mb-8 max-w-xs">
            Балансыңыз түгөндү. Заказ кабыл алуу үчүн балансыңызды толуктаңыз.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 w-full max-w-xs space-y-3">
            <p className="text-sm text-gray-300 text-center font-medium">Толуктоо:</p>
            <p className="text-xs text-gray-500 text-center">Telegram ботко чекти жөнөтүңүз.</p>
            <p className="text-xs text-gray-500 text-center">Канча сом салсаңыз — ошончо баланс болот.</p>
          </div>
        </div>
      )}

      {/* FULLSCREEN INCOMING ORDER */}
      {incomingOrder && (
        <div className="absolute inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-4">
          {/* Timer circle */}
          <div className="relative w-24 h-24 mb-6">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="#ef4444" strokeWidth="6"
                strokeDasharray={`${Math.PI * 88 * (incomingTimer / 25)} ${Math.PI * 88}`}
                strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-black text-white">{incomingTimer}</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-black text-white mb-2">ЖАҢЫ ЗАКАЗ!</h1>
          <p className="text-sm text-gray-400 mb-6">{incomingOrder.distanceMeters}м алыстыкта</p>

          {/* Order card */}
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-3xl p-6 space-y-4 mb-8">
            {/* Price */}
            <div className="text-center">
              <span className="text-4xl font-black text-green-400">{incomingOrder.price}</span>
              <span className="text-lg text-green-400 ml-1">сом</span>
            </div>

            {/* Route */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                <p className="text-sm text-white">{incomingOrder.pickupAddress}</p>
              </div>
              <div className="ml-1 border-l-2 border-dashed border-white/10 h-4" />
              <div className="flex items-start gap-3">
                <div className="mt-1 w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                <p className="text-sm text-white">{incomingOrder.destAddress}</p>
              </div>
            </div>

            {/* Client */}
            <div className="bg-white/5 rounded-xl px-4 py-2">
              <span className="text-xs text-gray-400">Клиент: </span>
              <span className="text-sm text-white font-medium">{incomingOrder.clientName}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={handleAcceptIncoming}
              className="w-full h-16 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-xl font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-green-600/30"
            >
              <CheckCircle2 className="w-7 h-7" />
              ПРИНЯТЬ
            </button>
            <button
              onClick={handleRejectIncoming}
              className="w-full h-12 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-sm font-medium active:scale-95 transition-all"
            >
              Четке кагуу
            </button>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="absolute inset-0" style={{ minHeight: '400px' }}>
        <DriverMap center={toktogulCenter} showMarker={lineStatus !== 'OFFLINE'} />
      </div>

      {/* Balance gauge - top right - ALWAYS visible */}
      {balance !== null && (
        <div className="absolute top-4 right-4 z-[1000]">
          <div className="relative w-20 h-20">
            {/* Background circle */}
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              {/* Track (gray background arc) */}
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
                strokeDasharray={`${Math.PI * 84 * 0.75} ${Math.PI * 84 * 0.25}`}
                strokeLinecap="round"
              />
              {/* Filled arc based on balance (max 1000 for full) */}
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke={balance > 200 ? '#22c55e' : balance > 50 ? '#eab308' : '#ef4444'}
                strokeWidth="8"
                strokeDasharray={`${Math.PI * 84 * 0.75 * Math.max(0, Math.min(balance / 1000, 1))} ${Math.PI * 84}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-base font-black ${balance > 200 ? 'text-green-400' : balance > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {balance}
              </span>
              <span className="text-[7px] text-gray-500 font-medium">баланс</span>
            </div>
            {/* Needle/arrow indicator */}
            <div
              className="absolute top-1/2 left-1/2 origin-bottom transition-transform duration-1000"
              style={{
                width: '2px',
                height: '18px',
                marginLeft: '-1px',
                marginTop: '-18px',
                transform: `rotate(${-135 + (270 * Math.max(0, Math.min(balance / 1000, 1)))}deg)`,
              }}
            >
              <div
                className={`w-0 h-0 border-l-[3px] border-r-[3px] border-b-[8px] border-l-transparent border-r-transparent ${
                  balance > 200 ? 'border-b-green-400' : balance > 50 ? 'border-b-yellow-400' : 'border-b-red-400'
                }`}
              />
            </div>
          </div>
        </div>
      )}

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
            <ActiveOrderCard order={activeOrder} onComplete={handleCompleteOrder} />
          </div>
        )}

        {/* Waiting state */}
        {lineStatus === 'ONLINE' && !activeOrder && (
          <div className="px-3 pb-2">
            <div className="bg-[#111]/90 border border-white/10 rounded-2xl p-3 text-center backdrop-blur-sm">
              <Clock className="w-5 h-5 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-400">{t('waitingOrders')}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{t('availableOrders')}</p>
            </div>
          </div>
        )}

        {/* BUSY_PERSONAL state */}
        {lineStatus === 'BUSY_PERSONAL' && !activeOrder && (
          <div className="px-3 pb-2">
            <div className="bg-[#111]/90 border border-orange-500/30 rounded-2xl p-3 text-center backdrop-blur-sm">
              <span className="text-lg">☕</span>
              <p className="text-xs text-orange-400 font-medium mt-1">По делам</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Заказдар келбейт</p>
            </div>
          </div>
        )}

        {/* Status indicator bar */}
        <div className="flex justify-center py-3 px-4">
          <div className={`px-6 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 ${
            lineStatus === 'ONLINE' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            lineStatus === 'BUSY_PERSONAL' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
            lineStatus === 'BUSY' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              lineStatus === 'ONLINE' ? 'bg-green-400 animate-pulse' :
              lineStatus === 'BUSY_PERSONAL' ? 'bg-orange-400' :
              lineStatus === 'BUSY' ? 'bg-red-400 animate-pulse' :
              'bg-gray-400'
            }`} />
            {lineStatus === 'ONLINE' && 'Линияда'}
            {lineStatus === 'BUSY_PERSONAL' && 'По делам'}
            {lineStatus === 'BUSY' && 'Заказ аткарууда'}
            {lineStatus === 'OFFLINE' && 'Оффлайн'}
          </div>
        </div>
      </div>
    </div>
  );
}
