'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Clock } from 'lucide-react';
import api from '@/lib/axios';

export default function ArchivePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data: me } = await api.get('/auth/me');
        const { data } = await api.get(`/orders/driver/${me.id}`);
        setOrders(Array.isArray(data) ? data : []);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold">Архив</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Заказ жок</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => (
            <div key={order.id} className="bg-[#0d0d0d] border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-gray-500">#{order.orderNumber}</span>
                <span className="text-sm font-bold text-green-400">{order.price} сом</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-xs text-gray-300 truncate">{order.pickupAddress}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <p className="text-xs text-gray-300 truncate">{order.destAddress || 'Көрсөтүлгөн жок'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-600">
                  {order.createdAt ? new Date(order.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  order.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                  order.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                  order.status === 'ASSIGNED' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>{order.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
