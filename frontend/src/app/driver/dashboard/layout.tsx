'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  MapPin, List, Navigation,
  UserCircle, Settings, LogOut, Menu, X,
  Star, Car, Loader2, Radio, Power, Coffee, MessageCircle,
} from 'lucide-react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useDriverStore } from '@/store/useDriverStore';
import BlockTimer from './block-timer';
import { connectSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { playWelcomeSound, playClickSound } from '@/lib/sounds';

import api from '@/lib/axios';

// Header Balance component - shows just the number in blue banner
function DriverHeaderBalance() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (typeof data.balance === 'number') setBalance(data.balance);
      } catch {}
    };
    fetchBalance();
    const iv = setInterval(fetchBalance, 30000);
    return () => clearInterval(iv);
  }, []);

  if (balance === null) return null;

  return (
    <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#7BBDE8]/20 text-[#7BBDE8]">
      {balance}
    </div>
  );
}

// Line Status Button component
function LineStatusButton({ status }: { status: 'ONLINE' | 'OFFLINE' | 'BUSY_PERSONAL' }) {
  const { lineStatus, setLineStatus } = useDriverStore();
  const isActive = lineStatus === status;

  const config = {
    ONLINE: {
      label: 'Выйти на линию',
      icon: Radio,
      color: 'green',
      activeClass: 'bg-green-500/15 text-green-400 border border-green-500/30',
    },
    BUSY_PERSONAL: {
      label: 'По делам',
      icon: Coffee,
      color: 'orange',
      activeClass: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
    },
    OFFLINE: {
      label: 'Завершить линию',
      icon: Power,
      color: 'red',
      activeClass: 'bg-red-500/15 text-red-400 border border-red-500/30',
    },
  }[status];

  const handlePress = () => {
    playWelcomeSound();
    const socket = connectSocket();
    const driverInfo = localStorage.getItem('driverInfo');
    const driverId = driverInfo ? JSON.parse(driverInfo).id : null;

    setLineStatus(status);

    if (driverId) {
      socket.emit('driver:status', { driverId, status });
    }

    if (status === 'ONLINE') {
      toast.success('Линияга чыктыңыз! Заказдар келет.');
    } else if (status === 'BUSY_PERSONAL') {
      toast('По делам. Заказдар келбейт.', { icon: '☕' });
    } else {
      toast('Линия бүттү.', { icon: '🔴' });
    }
  };

  return (
    <button
      onClick={handlePress}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isActive
          ? config.activeClass
          : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
      }`}
    >
      <config.icon className="w-5 h-5" />
      <span className="text-sm font-medium">{config.label}</span>
      {isActive && (
        <span className="ml-auto w-2 h-2 rounded-full bg-current animate-pulse" />
      )}
    </button>
  );
}

export default function DriverDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useLanguageStore();
  const [authChecked, setAuthChecked] = useState(false);

  // AUTH GUARD: check token exists, redirect to login if not
  useEffect(() => {
    const token = localStorage.getItem('token');
    const driverInfo = localStorage.getItem('driverInfo');
    if (!token || !driverInfo) {
      router.replace('/driver/login');
      return;
    }
    setAuthChecked(true);
    playWelcomeSound();
  }, [router]);

  // Connect socket immediately when driver dashboard loads
  useState(() => {
    if (typeof window !== 'undefined') {
      const socket = connectSocket();
      const driverInfo = localStorage.getItem('driverInfo');
      const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
      if (driverId) {
        socket.emit('driver:join', driverId);
        // Re-join on reconnect
        socket.on('connect', () => {
          socket.emit('driver:join', driverId);
        });
      }
    }
  });

  // Handle logout — ONLY when driver explicitly taps logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('driverInfo');
    router.replace('/driver/login');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  const driverMenu = [
    { icon: MapPin, label: t('dashboard'), href: '/driver/dashboard' },
    { icon: MessageCircle, label: 'Чат', href: '/driver/dashboard/chat' },
    { icon: List, label: t('availableOrders'), href: '/driver/dashboard/orders' },
    { icon: UserCircle, label: t('profile'), href: '/driver/dashboard/profile' },
    { icon: Settings, label: t('settings'), href: '/driver/dashboard/settings' },
  ];

  return (
    <div className="min-h-screen bg-[#141E30] flex flex-col">
      {/* Block Timer Overlay */}
      <BlockTimer />
      {/* Top Nav */}
      <header className="sticky top-0 z-[5000] bg-[#1a2740]/95 backdrop-blur-xl border-b border-[#35577D]/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 hover:bg-[#35577D]/20 rounded-lg">
              <Menu className="w-5 h-5 text-white" />
            </button>
            <h1 className="font-bold text-lg">
              <span className="text-white">EKIDOS</span>
              <span className="text-[#7BBDE8]"> {t('driver')}</span>
            </h1>
          </div>
          {/* Balance in header */}
          <DriverHeaderBalance />
        </div>
      </header>

      {/* Sidebar - z-index выше карты */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-[9998] backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-72 bg-[#0f1720] border-r border-[#35577D]/30 z-[9999] flex flex-col shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="p-5 border-b border-[#35577D]/30 flex items-center justify-between">
              <h2 className="font-bold text-lg">
                <span className="text-white">EKIDOS</span>
                <span className="text-[#7BBDE8]"> {t('driver')}</span>
              </h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#35577D]/30 flex items-center justify-center hover:bg-[#35577D]/50 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Driver info card */}
            <div className="p-4">
              <div className="bg-gradient-to-r from-[#35577D]/20 to-transparent rounded-2xl p-4 border border-[#35577D]/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#35577D] to-[#141E30] flex items-center justify-center">
                    <Car className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Водитель</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      <span className="text-xs text-muted-foreground">5.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Line Status Buttons */}
            <div className="px-3 mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider px-4 mb-2 font-semibold">Линия статусу</p>
              <div className="space-y-1.5">
                <LineStatusButton status="ONLINE" />
                <LineStatusButton status="BUSY_PERSONAL" />
                <LineStatusButton status="OFFLINE" />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1">
              {driverMenu.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => { playClickSound(); router.push(item.href); setMobileOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-[#35577D]/30 text-white border border-[#35577D]/50'
                        : 'text-gray-400 hover:text-white hover:bg-[#35577D]/15'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-[#35577D]/30">
              <button
                onClick={() => { handleLogout(); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">{t('logout')}</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Bottom Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-[5000] bg-[#1a2740]/95 backdrop-blur-xl border-t border-[#35577D]/30 px-1 py-1.5">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {driverMenu.slice(0, 4).map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => { playClickSound(); router.push(item.href); }}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
                  isActive ? 'text-[#7BBDE8]' : 'text-gray-500'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-[#7BBDE8]' : ''}`} />
                <span className="text-[9px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 pb-16">
        {children}
      </main>
    </div>
  );
}
