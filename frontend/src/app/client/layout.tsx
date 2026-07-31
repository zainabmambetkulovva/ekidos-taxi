'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === '/client/login';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="relative z-50 flex items-center gap-3 px-4 py-3 bg-black/90 border-b border-white/10 backdrop-blur-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="text-lg font-black tracking-tighter">
          <span className="text-white">EKIDOS</span>
          <span className="text-red-500"> TAXI</span>
        </h1>
        {!isLoginPage && (
          <span className="ml-auto text-xs text-muted-foreground">Жолоочу</span>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
