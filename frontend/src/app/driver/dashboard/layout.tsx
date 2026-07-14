'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  MapPin, List, Navigation,
  UserCircle, Settings, LogOut, Menu, X,
  Star, Car,
} from 'lucide-react';

const driverMenu = [
  { icon: MapPin, label: 'Главная', href: '/driver/dashboard' },
  { icon: List, label: 'Заказы', href: '/driver/dashboard/orders' },
  { icon: Navigation, label: 'Текущий заказ', href: '/driver/dashboard/current' },
  { icon: UserCircle, label: 'Профиль', href: '/driver/dashboard/profile' },
  { icon: Settings, label: 'Настройки', href: '/driver/dashboard/settings' },
];

export default function DriverDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Nav */}
      <header className="sticky top-0 z-[5000] bg-card/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 hover:bg-white/5 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg">
              <span className="text-white">EKIDOS</span>
              <span className="text-red-500"> Driver</span>
            </h1>
          </div>
        </div>
      </header>

      {/* Sidebar - z-index выше карты */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-[9998] backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-72 bg-[#0a0a0a] border-r border-white/10 z-[9999] flex flex-col shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-bold text-lg">
                <span className="text-white">EKIDOS</span>
                <span className="text-red-500"> Driver</span>
              </h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Driver info card */}
            <div className="p-4">
              <div className="bg-gradient-to-r from-red-500/10 to-transparent rounded-2xl p-4 border border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
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

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1">
              {driverMenu.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => { router.push(item.href); setMobileOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-white/10">
              <button
                onClick={() => { router.push('/'); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">Выход</span>
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Bottom Tab Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-[5000] bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10 px-1 py-1.5">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {driverMenu.slice(0, 4).map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
                  isActive ? 'text-red-400' : 'text-gray-500'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-red-400' : ''}`} />
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
