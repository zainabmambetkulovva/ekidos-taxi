'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Banknote, CreditCard, CheckCircle2, XCircle, Phone } from 'lucide-react';
import { useDriverStore } from '@/store/useDriverStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import api from '@/lib/axios';
import { toast } from 'sonner';

export default function DriverOrdersPage() {
  const router = useRouter();
  const { isOnline, setActiveOrder } = useDriverStore();
  const { t } = useLanguageStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const prevOrderCountRef = useRef(0);

  // Play notification sound and show browser notification
  const notifyNewOrder = (count: number) => {
    // Vibrate
    if (navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 300]);
    }
    // Generate beep sound programmatically (no file needed)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        // Beep 1
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 880;
        gain1.gain.value = 0.5;
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.2);
        // Beep 2
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 1100;
        gain2.gain.value = 0.5;
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.25);
        osc2.stop(ctx.currentTime + 0.45);
        // Beep 3
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.value = 1320;
        gain3.gain.value = 0.5;
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(ctx.currentTime + 0.5);
        osc3.stop(ctx.currentTime + 0.7);
        setTimeout(() => ctx.close(), 1000);
      }
    } catch {}
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('EKIDOS TAXI', {
        body: t('availableOrders') + ` (${count})`,
        icon: '/icon-192.png',
        tag: 'new-order',
        renotify: true,
      });
    }
  };

  // Socket.IO real-time: listen for new orders
  useEffect(() => {
    if (!isOnline) return;

    const socket = connectSocket();
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;

    if (driverId) {
      socket.emit('driver:join', driverId);
    }

    // New order arrives in real-time
    socket.on('order:available', (order: any) => {
      setOrders(prev => {
        const exists = prev.find(o => o.id === order.id);
        if (exists) return prev;
        notifyNewOrder(prev.length + 1);
        return [order, ...prev];
      });
    });

    // Order taken by another driver — remove from list
    socket.on('order:taken', ({ orderId }: { orderId: string }) => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    });

    return () => {
      socket.off('order:available');
      socket.off('order:taken');
    };
  }, [isOnline]);

  // Fetch available orders from backend (polling as backup)
  useEffect(() => {
    if (!isOnline) { setOrders([]); setLoading(false); return; }

    const fetchOrders = async () => {
      try {
        const { data } = await api.get('/orders/available');
        const newOrders = Array.isArray(data) ? data : [];

        // Play sound if new orders arrived (from polling)
        if (newOrders.length > prevOrderCountRef.current) {
          notifyNewOrder(newOrders.length);
        }
        prevOrderCountRef.current = newOrders.length;
        setOrders(newOrders);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    fetchOrders();
    const interval = setInterval(fetchOrders, 8000);
    return () => clearInterval(interval);
  }, [isOnline]);

  const handleAccept = async (order: any) => {
    try {
      const driverInfo = localStorage.getItem('driverInfo');
      const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
      if (!driverId) { toast.error('Кирүү керек'); return; }

      await api.patch(`/orders/${order.id}/accept`, { driverId });
      setActiveOrder(order);
      setOrders([]);
      toast.success('Заказ принят! Направляйтесь к клиенту.');
      router.push('/driver/dashboard');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Ошибка');
    }
  };

  const handleReject = (id: string) => {
    setOrders(orders.filter(o => o.id !== id));
    toast('Заказ отклонён');
  };

  if (!isOnline) {
    return (
      <div className="p-4 text-center py-20">
        <Clock className="w-16 h-16 mx-auto text-gray-700 mb-4" />
        <h3 className="text-lg font-medium text-gray-400">Сиз линияда эмессиз</h3>
        <p className="text-sm text-gray-600 mt-1">Заказ алуу үчүн линияга чыгыңыз</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('availableOrders')}</h2>
        <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full font-bold">{orders.length}</span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-14 h-14 mx-auto text-gray-700 mb-3" />
          <h3 className="text-base font-medium text-gray-400">{t('noOrders')}</h3>
          <p className="text-xs text-gray-600 mt-1">Диспетчер заказ жазганда автоматтуу пайда болот</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="font-mono text-[10px] text-gray-500">#{order.orderNumber}</span>
                <span className="text-xl font-black text-green-400">{order.price} сом</span>
              </div>

              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-green-500/20" />
                  <p className="text-sm text-gray-200">{order.pickupAddress}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-500/20" />
                  <p className="text-sm text-gray-200">{order.destAddress}</p>
                </div>
              </div>

              <div className="px-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{order.clientName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-400">{order.tariff}</span>
                  {order.paymentMethod === 'CASH' ? <Banknote className="w-4 h-4 text-green-400" /> : <CreditCard className="w-4 h-4 text-blue-400" />}
                </div>
              </div>

              <div className="flex items-center gap-2 px-4 pb-4">
                <button
                  onClick={() => handleAccept(order)}
                  className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t('accept')}
                </button>
                <button
                  onClick={() => handleReject(order.id)}
                  className="h-10 w-10 rounded-xl bg-white/5 border border-red-500/30 flex items-center justify-center active:scale-95"
                >
                  <XCircle className="w-5 h-5 text-red-400" />
                </button>
                {order.clientPhone && (
                  <a
                    href={`tel:${order.clientPhone}`}
                    className="h-10 w-10 rounded-xl bg-white/5 border border-blue-500/30 flex items-center justify-center"
                  >
                    <Phone className="w-5 h-5 text-blue-400" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
