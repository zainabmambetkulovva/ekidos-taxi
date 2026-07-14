'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Car } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background - Ethno style */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/bg-ethno.jpg)' }} />
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[3px]" />

      {/* Logo */}
      <div className="relative z-10 mb-12 text-center animate-fade-in">
        <div className="relative">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter">
            <span className="text-white">EKIDOS</span>
            <span className="text-red-500 neon-text"> TAXI</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-lg tracking-widest uppercase">
            Dispatch Management System
          </p>
        </div>
      </div>

      {/* Role Selection Cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Administrator Card */}
        <div
          onClick={() => router.push('/admin/login')}
          className="cursor-pointer group transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 active:scale-[0.98]"
        >
          <div className="relative p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-red-500/50 hover:bg-red-500/5 transition-all duration-300 h-full">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                <ShieldCheck className="w-10 h-10 text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Administrator</h2>
                <p className="text-muted-foreground mt-1 text-sm">Manage fleet & dispatch</p>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Card */}
        <div
          onClick={() => router.push('/driver/login')}
          className="cursor-pointer group transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 active:scale-[0.98]"
        >
          <div className="relative p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-red-500/50 hover:bg-red-500/5 transition-all duration-300 h-full">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                <Car className="w-10 h-10 text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Driver</h2>
                <p className="text-muted-foreground mt-1 text-sm">Accept & complete orders</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-12 text-muted-foreground/50 text-sm">
        &copy; {new Date().getFullYear()} EKIDOS TAXI. All rights reserved.
      </p>
    </div>
  );
}
