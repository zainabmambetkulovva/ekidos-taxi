'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Wallet } from 'lucide-react';
import api from '@/lib/axios';

export default function BalanceHistoryPage() {
  const router = useRouter();
  const [topups, setTopups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: me } = await api.get('/auth/me');
        setBalance(me.balance || 0);
        // Get topup requests for this driver
        const { data } = await api.get('/topup');
        const myTopups = Array.isArray(data) ? data.filter((t: any) => t.driverId === me.id) : [];
        setTopups(myTopups);
      } catch {
        setTopups([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-xl font-bold">Баланс</h2>
      </div>

      {/* Current balance */}
      <div className="bg-gradient-to-r from-green-500/10 to-transparent border border-green-500/20 rounded-2xl p-5 text-center">
        <p className="text-sm text-gray-400">Учурдагы баланс</p>
        <p className="text-4xl font-black text-green-400 mt-1">{balance}</p>
        <p className="text-xs text-gray-500 mt-1">баланс</p>
      </div>

      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Толуктоо тарыхы</h3>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : topups.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Толуктоо жок</p>
          <p className="text-xs text-gray-600 mt-1">Telegram бот аркылуу баланс толуктаңыз</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topups.map((t: any) => (
            <div key={t.id} className="bg-[#0d0d0d] border border-white/10 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    t.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' :
                    t.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>{t.status === 'APPROVED' ? 'Толукталды' : t.status === 'REJECTED' ? 'Четке кагылды' : 'Күтүүдө'}</span>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">
                  {t.createdAt ? new Date(t.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
              <div className="text-right">
                {t.amount && <p className="text-sm font-bold text-green-400">+{t.amount}</p>}
                <p className="text-[10px] text-gray-500">баланс</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
