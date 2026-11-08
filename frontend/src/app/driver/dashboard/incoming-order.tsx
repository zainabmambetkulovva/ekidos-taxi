'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDriverStore } from '@/store/useDriverStore';
import { playOrderAlertSound, playWelcomeSound } from '@/lib/sounds';
import { getOptionEmoji, getOptionLabel } from '@/lib/order-options';
import api from '@/lib/axios';
import { connectSocket } from '@/lib/socket';

/**
 * Жаңы заказ — толук экран сунуш.
 * layout.tsx'те турат, ошондуктан водитель кайсы бетте болбосун (чат, доступные заказы, профиль) экранга чыгат.
 */
export default function IncomingOrderOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const { setActiveOrder } = useDriverStore();
  const [incomingOrder, setIncomingOrder] = useState<any>(null);
  const [incomingTimer, setIncomingTimer] = useState(0);

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
      // Don't accept orders when balance < 12
      const info = localStorage.getItem('driverInfo');
      const bal = info ? JSON.parse(info).balance : null;
      if (bal !== null && bal < 12) return;
      
      setIncomingOrder(order);
      setIncomingTimer(20);
      // Play alert sound
      playOrderAlertSound();
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
    playWelcomeSound();
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (!driverId) return;

    const order = incomingOrder;
    // Дароо көрсөтөбүз (optimistic) — экран заматта кызыл болот
    setActiveOrder(order);
    setIncomingOrder(null);
    setIncomingTimer(0);
    if (pathname !== '/driver/dashboard') router.push('/driver/dashboard');

    try {
      const { data } = await api.patch(`/orders/${order.id}/accept`, { driverId });
      setActiveOrder(data);
      toast.success('Заказ принят!');
      // Баланс дароо жаңырат (12 / түнкүсү 14 сом алынды)
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
      // Кабыл алынбады (башка водитель алды / баланс жетишсиз) — артка кайтарабыз
      if (useDriverStore.getState().activeOrder?.id === order.id) setActiveOrder(null);
      toast.error(error?.response?.data?.error || 'Заказды кабыл алуу мүмкүн болбоду');
    }
  };

  const handleRejectIncoming = () => {
    const order = incomingOrder;
    setIncomingOrder(null);
    setIncomingTimer(0);
    // Серверге кабарлайбыз — заказ дароо кийинки водительге кетет
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
    if (order && driverId) connectSocket().emit('order:reject', { orderId: order.id, driverId });
  };

  if (!incomingOrder) return null;

  return (
    <>
      {/* FULLSCREEN INCOMING ORDER */}
      {incomingOrder && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-4">
          {/* Timer circle */}
          <div className="relative w-24 h-24 mb-6">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="#ef4444" strokeWidth="6"
                strokeDasharray={`${Math.PI * 88 * (incomingTimer / 20)} ${Math.PI * 88}`}
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

            {/* Options */}
            {incomingOrder.options && incomingOrder.options.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
                <p className="text-xs text-yellow-400 font-semibold mb-2 uppercase tracking-wide">Опции к заказу</p>
                <div className="flex flex-wrap gap-1.5">
                  {incomingOrder.options.map((optId: string) => (
                    <span
                      key={optId}
                      className="inline-flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-200 border border-yellow-500/30 px-2.5 py-1 rounded-full font-medium"
                    >
                      <span>{getOptionEmoji(optId)}</span>
                      <span>{getOptionLabel(optId)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
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
              Отклонить
            </button>
          </div>
        </div>
      )}

    </>
  );
}
