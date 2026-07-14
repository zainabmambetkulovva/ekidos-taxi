'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Banknote, CreditCard, CheckCircle2, XCircle, Phone } from 'lucide-react';
import { useDriverStore } from '@/store/useDriverStore';
import { toast } from 'sonner';

const demoOrders = [
  {
    id: '1',
    orderNumber: 'EK2607-1234',
    pickupAddress: 'ул. Ленина 45, Токтогул',
    destAddress: 'ул. Фрунзе 12, Токтогул',
    clientName: 'Айбек',
    clientPhone: '+996555111222',
    price: 150,
    tariff: 'Стандарт',
    paymentMethod: 'CASH',
  },
  {
    id: '2',
    orderNumber: 'EK2607-5678',
    pickupAddress: 'Автовокзал, Токтогул',
    destAddress: 'с. Кара-Суу',
    clientName: 'Марат',
    clientPhone: '+996700333444',
    price: 500,
    tariff: 'Междугород',
    paymentMethod: 'CASH',
  },
];

export default function DriverOrdersPage() {
  const router = useRouter();
  const { isOnline, setActiveOrder } = useDriverStore();
  const [orders, setOrders] = useState(demoOrders);

  const handleAccept = (order: any) => {
    // Заказ кабыл алынды — баардык заказ тизмеси тазаланат, active order сакталат
    setActiveOrder(order);
    setOrders([]);
    toast.success('Заказ принят! Направляйтесь к клиенту.');
    // Картага кайтабыз
    router.push('/driver/dashboard');
  };

  const handleReject = (id: string) => {
    setOrders(orders.filter(o => o.id !== id));
    toast('Заказ отклонён');
  };

  if (!isOnline) {
    return (
      <div className="p-4 text-center py-20">
        <Clock className="w-16 h-16 mx-auto text-gray-700 mb-4" />
        <h3 className="text-lg font-medium text-gray-400">Вы не на линии</h3>
        <p className="text-sm text-gray-600 mt-1">Выйдите на линию чтобы получать заказы</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Доступные заказы</h2>
        <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full font-bold">{orders.length}</span>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-14 h-14 mx-auto text-gray-700 mb-3" />
          <h3 className="text-base font-medium text-gray-400">Нет доступных заказов</h3>
          <p className="text-xs text-gray-600 mt-1">Новые заказы появятся автоматически</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="font-mono text-[10px] text-gray-500">#{order.orderNumber}</span>
                <span className="text-xl font-black text-green-400">{order.price} сом</span>
              </div>

              {/* Route */}
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

              {/* Client row */}
              <div className="px-4 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-gray-300">{order.clientName[0]}</span>
                  </div>
                  <span className="text-xs text-gray-400">{order.clientName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-gray-400">{order.tariff}</span>
                  {order.paymentMethod === 'CASH' ? (
                    <Banknote className="w-4 h-4 text-green-400" />
                  ) : (
                    <CreditCard className="w-4 h-4 text-blue-400" />
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 px-4 pb-4">
                <button
                  onClick={() => handleAccept(order)}
                  className="flex-1 h-10 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Принять
                </button>
                <button
                  onClick={() => handleReject(order.id)}
                  className="h-10 w-10 rounded-xl bg-white/5 border border-red-500/30 flex items-center justify-center active:scale-95 transition-transform"
                >
                  <XCircle className="w-5 h-5 text-red-400" />
                </button>
                <a
                  href={`tel:${order.clientPhone}`}
                  className="h-10 w-10 rounded-xl bg-white/5 border border-blue-500/30 flex items-center justify-center active:scale-95 transition-transform"
                >
                  <Phone className="w-5 h-5 text-blue-400" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
