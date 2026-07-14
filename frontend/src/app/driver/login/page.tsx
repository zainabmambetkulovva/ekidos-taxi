'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DriverLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // Временно: пропускаем логин, сразу заходим как водитель
    localStorage.setItem('token', 'demo-driver-token');
    router.push('/driver/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/bg-taxi-city.jpg)' }} />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
