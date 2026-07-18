'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Car, Star, TableProperties, Phone,
  Map, BarChart3, Settings, LogOut, Menu, X, Wallet,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { toast } from 'sonner';

const menuKeys = [
  { icon: LayoutDashboard, key: 'dashboard', href: '/admin/dashboard' },
  { icon: Car, key: 'drivers', href: '/admin/dashboard/drivers' },
  { icon: Star, key: 'rating', href: '/admin/dashboard/rating' },
  { icon: TableProperties, key: 'tables', href: '/admin/dashboard/tables' },
  { icon: Wallet, key: 'balance', href: '/admin/dashboard/balance' },
  { icon: Phone, key: 'dispatcher', href: '/admin/dashboard/dispatcher' },
  { icon: Map, key: 'liveMap', href: '/admin/dashboard/map' },
  { icon: BarChart3, key: 'reports', href: '/admin/dashboard/reports' },
  { icon: Settings, key: 'settings', href: '/admin/dashboard/settings' },
];

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const { t } = useLanguageStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = menuKeys.map(item => ({ ...item, label: t(item.key) }));

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/admin/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const socket = connectSocket();
      socket.emit('admin:join', user.id);

      socket.on('notification', (data: any) => {
        addNotification(data);
        toast(data.title, { description: data.message });
      });

      socket.on('order:new', () => {
        // Play notification sound
        try {
          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}
      });

      return () => {
        disconnectSocket();
      };
    }
  }, [isAuthenticated, user, addNotification]);

  const handleLogout = () => {
    logout();
    disconnectSocket();
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Background - Ethno dark */}
      <div className="fixed inset-0 ethno-bg -z-10" />
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-full ethno-sidebar z-40 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="p-5 border-b" style={{ borderColor: 'var(--ethno-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)' }}>
              <Car className="w-5 h-5" style={{ color: 'var(--ethno-gold)' }} />
            </div>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h2 className="ethno-sidebar-logo text-lg">
                  EKIDOS <span className="accent" style={{ color: 'var(--ethno-gold)' }}>Admin</span>
                </h2>
              </motion.div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`ethno-nav-item w-full flex items-center gap-3 px-3 py-2.5 ${isActive ? 'active' : ''}`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 ethno-sidebar-footer">
          <button
            onClick={handleLogout}
            className="ethno-nav-item w-full flex items-center gap-3 px-3 py-2.5"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">{t('logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[9998] lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-[9999] lg:hidden flex flex-col"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-lg">
                  <span className="text-white">EKIDOS</span>
                  <span className="text-red-500"> Admin</span>
                </h2>
                <button onClick={() => setMobileOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <button
                      key={item.href}
                      onClick={() => { router.push(item.href); setMobileOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive ? 'bg-red-500/10 text-red-400' : 'text-muted-foreground hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-border">
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-red-400 transition-all">
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">Выход</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 hover:bg-white/5 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden lg:block p-2 hover:bg-white/5 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4">
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

