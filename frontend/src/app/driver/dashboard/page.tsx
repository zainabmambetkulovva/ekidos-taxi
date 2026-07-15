'use client';

import dynamic from 'next/dynamic';
import { Clock, CheckCircle2, Navigation, Phone } from 'lucide-react';
import { useDriverStore } from '@/store/useDriverStore';
import api from '@/lib/axios';
import { toast } from 'sonner';

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
  const toktogulCenter: [number, number] = [41.8747, 72.9422];

  const handleToggleOnline = () => {
    if (!isOnline) {
      setOnline(true);
      toast.success('Вы на линии. Ожидайте заказы.');
    } else {
      setOnline(false);
      setActiveOrder(null);
      toast('Смена завершена.');
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

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">

        {/* Active order card */}
        {isOnline && activeOrder && (
          <div className="px-3 pb-2">
            <div className="bg-[#0d0d0d] border border-green-500/30 rounded-2xl p-4 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Активный заказ</span>
                <span className="text-xl font-black text-green-400">{activeOrder.price} сом</span>
              </div>

              {/* Route */}
              <div className="space-y-2 mb-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-500/20 flex-shrink-0" />
                  <p className="text-sm text-white leading-tight">{activeOrder.pickupAddress}</p>
                </div>
                <div className="ml-[4px] border-l-2 border-dashed border-white/10 h-3" />
                <div className="flex items-start gap-2.5">
                  <div className="mt-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-500/20 flex-shrink-0" />
                  <p className="text-sm text-white leading-tight">{activeOrder.destAddress}</p>
                </div>
              </div>

              {/* Client info */}
              <div className="flex items-center justify-between mb-3 bg-white/5 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-400">Клиент: <span className="text-white font-medium">{activeOrder.clientName}</span></span>
                {activeOrder.clientPhone && (
                  <a href={`tel:${activeOrder.clientPhone}`} className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Phone className="w-3.5 h-3.5 text-blue-400" />
                  </a>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeOrder.destAddress)}`, '_blank')}
                  className="flex-1 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
                >
                  <Navigation className="w-4 h-4" />
                  Навигация
                </button>
                <button
                  onClick={handleCompleteOrder}
                  className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all shadow-lg shadow-green-500/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Завершить заказ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Waiting state */}
        {isOnline && !activeOrder && (
          <div className="px-3 pb-2">
            <div className="bg-[#111]/90 border border-white/10 rounded-2xl p-3 text-center backdrop-blur-sm">
              <Clock className="w-5 h-5 text-gray-500 mx-auto mb-1" />
              <p className="text-xs text-gray-400">Ожидание заказов...</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Заказы появятся в разделе "Заказы"</p>
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
            {isOnline ? 'Завершить смену' : 'Выйти на линию'}
          </button>
        </div>
      </div>
    </div>
  );
}
