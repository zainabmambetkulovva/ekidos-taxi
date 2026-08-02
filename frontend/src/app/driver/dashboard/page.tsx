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
        <span className="text-xl font-black text-green-400">{order.price} сом</span>
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
  const { isOnline, activeOrder, setOnline, setActiveOrder } = useDriverStore();
  const { t } = useLanguageStore();
  const toktogulCenter: [number, number] = [41.8747, 72.9422];
  const [balance, setBalance] = useState<number | null>(null);

  // Fetch driver balance
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const { data } = await api.get('/auth/me');
        setBalance(data.balance ?? 0);
      } catch {
        const info = localStorage.getItem('driverInfo');
        if (info) setBalance(JSON.parse(info).balance ?? 0);
      }
    };
    fetchBalance();
    const iv = setInterval(fetchBalance, 30000); // refresh every 30s
    return () => clearInterval(iv);
  }, []);

  // Block screen if balance is 0
  if (balance !== null && balance <= 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white px-8 text-center gap-6">
        <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center">
          <span className="text-4xl font-black text-red-500">0</span>
        </div>
        <h2 className="text-2xl font-bold text-red-600">
          {t('balanceEmpty') || 'Balance is empty!'}
        </h2>
        <p className="text-gray-600 text-sm">
          {t('balanceEmptyDesc') || 'Top up your balance via Telegram bot to continue accepting orders.'}
        </p>
        <div className="text-xs text-gray-400 mt-4">
          Telegram: @ekidos_bot
        </div>
      </div>
    );
  }

  const handleToggleOnline = () => {
    if (!isOnline) {
      if (balance !== null && balance <= 0) {
        toast.error('Balance is 0! Top up via Telegram bot.');
        return;
      }
      setOnline(true);
      toast.success(t('onLine') + '. ' + t('waitingOrders'));
    } else {
      setOnline(false);
      setActiveOrder(null);
      toast(t('endShift'));
    }
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
      {/* Map */}
      <div className="absolute inset-0" style={{ minHeight: '400px' }}>
        <DriverMap center={toktogulCenter} showMarker={isOnline} />
      </div>

      {/* Balance circle - top right */}
      {balance !== null && balance > 0 && (
        <div className="absolute top-4 right-4 z-[1000] w-14 h-14 rounded-full bg-[#0d0d0d] border-2 border-green-500/50 flex items-center justify-center shadow-lg">
          <span className="text-xs font-bold text-green-400">{balance}</span>
        </div>
      )}

      {/* Location button */}
      <button
        onClick={() => {
          navigator.geolocation?.getCurrentPosition((pos) => {
            const map = document.querySelector('[class*="leaflet"]');
            if (map && (window as any).L) {
              // Dispatch via custom event
              window.dispatchEvent(new CustomEvent('driverCenterMap', {
                detail: { lat: pos.coords.latitude, lng: pos.coords.longitude }
              }));
            }
          });
        }}
        className="absolute top-24 right-4 z-[1000] w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
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
        {isOnline && !activeOrder && (
          <div className="px-3 pb-2">
            <div className="bg-[#111]/90 border border-white/10 rounded-2xl p-3 text-center backdrop-blur-sm">
              <Clock className="w-5 h-5 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-400">{t('waitingOrders')}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{t('availableOrders')}</p>
            </div>
          </div>
        )}

        {/* Toggle button */}
        <div className="flex justify-center py-3 px-4">
          <button
            onClick={handleToggleOnline}
            className={`px-8 py-3 rounded-full text-sm font-bold shadow-xl transition-all active:scale-95 ${
              isOnline
                ? 'bg-red-500 text-white shadow-red-500/30'
                : 'bg-yellow-400 text-black shadow-yellow-400/30'
            }`}
          >
            {isOnline ? t('endShift') : t('goOnline')}
          </button>
        </div>
      </div>
    </div>
  );
}
