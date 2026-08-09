'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Car, Mountain, Waves, TreePine, Flower2, Castle, Sun, Landmark } from 'lucide-react';
import { useRouter } from 'next/navigation';

const regions = [
  { name: 'Чүй', landmark: 'Бишкек — борбор калаа', icon: Landmark, color: 'from-red-500/20 to-red-900/10' },
  { name: 'Ош', landmark: 'Сулайман-Тоо', icon: Mountain, color: 'from-amber-500/20 to-amber-900/10' },
  { name: 'Жалал-Абад', landmark: 'Арсланбап токою', icon: TreePine, color: 'from-green-500/20 to-green-900/10' },
  { name: 'Баткен', landmark: 'Айгүл гүлү', icon: Flower2, color: 'from-pink-500/20 to-pink-900/10' },
  { name: 'Нарын', landmark: 'Тоо кыркалары', icon: Mountain, color: 'from-blue-500/20 to-blue-900/10' },
  { name: 'Талас', landmark: 'Манастын күмбөзү', icon: Castle, color: 'from-purple-500/20 to-purple-900/10' },
  { name: 'Ысык-Көл', landmark: 'Ысык-Көл — бейиш көлү', icon: Waves, color: 'from-cyan-500/20 to-cyan-900/10' },
];

export default function WelcomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('token');
    const driverInfo = localStorage.getItem('driverInfo');
    if (token && driverInfo) {
      router.replace('/driver/dashboard');
      return;
    }
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center p-4 relative overflow-hidden">
      {/* Background pattern - ethno ornament feel */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.5) 20px, rgba(255,255,255,0.5) 21px),
                          repeating-linear-gradient(-45deg, transparent, transparent 20px, rgba(255,255,255,0.5) 20px, rgba(255,255,255,0.5) 21px)`
      }} />
      <div className="absolute inset-0 bg-gradient-to-b from-red-900/10 via-transparent to-transparent" />

      {/* Logo Section */}
      <div className="relative z-10 mt-16 mb-10 text-center animate-fade-in">
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter">
          <span className="text-white">EKIDOS</span>
          <span className="text-red-500"> TAXI</span>
        </h1>
        <p className="text-gray-400 mt-3 text-sm md:text-base tracking-widest uppercase">
          Диспетчердик башкаруу системасы
        </p>
        <div className="mt-4 w-24 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent mx-auto" />
      </div>

      {/* Role Selection Cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-xl mb-12">
        <div
          onClick={() => router.push('/admin/login')}
          className="cursor-pointer group transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-red-500/40 transition-all h-full">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                <ShieldCheck className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Администратор</h2>
                <p className="text-gray-500 mt-1 text-xs">Автопаркты башкаруу</p>
              </div>
            </div>
          </div>
        </div>

        <div
          onClick={() => router.push('/driver/login')}
          className="cursor-pointer group transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-red-500/40 transition-all h-full">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                <Car className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Водитель</h2>
                <p className="text-gray-500 mt-1 text-xs">Заказ кабыл алуу</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ethno ornament divider */}
      <div className="relative z-10 w-full max-w-3xl mb-8">
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-white/20" />
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-400 uppercase tracking-[0.3em] font-medium">Кыргызстан</span>
            <Sun className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-white/20" />
        </div>
      </div>

      {/* 7 Regions of Kyrgyzstan */}
      <div className="relative z-10 w-full max-w-4xl mb-12">
        <h3 className="text-center text-lg font-bold text-white mb-6">
          7 областтын <span className="text-red-400">сулуулугу</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {regions.map((region, idx) => (
            <div
              key={region.name}
              className="group p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${region.color} flex items-center justify-center mb-3`}>
                <region.icon className="w-5 h-5 text-white/80" />
              </div>
              <h4 className="text-sm font-bold text-white">{region.name}</h4>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{region.landmark}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-auto pb-6 text-gray-600 text-xs">
        &copy; {new Date().getFullYear()} EKIDOS TAXI. Бардык укуктар корголгон.
      </p>
    </div>
  );
}
