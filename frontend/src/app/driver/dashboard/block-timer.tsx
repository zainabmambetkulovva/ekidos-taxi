'use client';

import { useState, useEffect } from 'react';
import { ShieldOff, Clock } from 'lucide-react';

export default function BlockTimer() {
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('ekidos-blocked-until');
    if (stored) {
      const until = new Date(stored);
      if (until > new Date()) {
        setBlockedUntil(stored);
        setIsBlocked(true);
      } else {
        localStorage.removeItem('ekidos-blocked-until');
      }
    }
  }, []);

  useEffect(() => {
    if (!blockedUntil) return;

    const update = () => {
      const now = new Date().getTime();
      const end = new Date(blockedUntil).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setIsBlocked(false);
        setTimeLeft('');
        localStorage.removeItem('ekidos-blocked-until');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [blockedUntil]);

  if (!isBlocked) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6">
        <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto">
          <ShieldOff className="w-12 h-12 text-red-500" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-red-400">Сиз блоктолдуңуз</h1>
          <p className="text-sm text-gray-400 mt-2">Заказды аяктабай отмена кылганыңыз үчүн</p>
        </div>

        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-red-400" />
            <span className="text-sm text-red-400 font-medium">Калган убакыт</span>
          </div>
          <p className="text-5xl font-mono font-bold text-white">{timeLeft}</p>
        </div>

        <p className="text-xs text-gray-500 max-w-xs">
          Блок бүткөндө автоматтык түрдө ачылат. Же диспетчерге кайрылыңыз.
        </p>
      </div>
    </div>
  );
}
