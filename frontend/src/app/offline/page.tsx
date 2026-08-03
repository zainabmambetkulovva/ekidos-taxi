'use client';

import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      {/* Logo */}
      <div className="mb-8">
        <h1 className="text-4xl font-black tracking-tighter">
          <span className="text-white">EKIDOS</span>
          <span className="text-red-500"> TAXI</span>
        </h1>
      </div>

      {/* Offline icon */}
      <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6">
        <WifiOff className="w-10 h-10 text-red-400" />
      </div>

      {/* Message */}
      <h2 className="text-xl font-bold text-white mb-2">Интернет жок</h2>
      <p className="text-gray-400 text-sm mb-8 max-w-xs">
        Интернет байланышыңызды текшерип, кайра аракет кылыңыз
      </p>

      {/* Retry button */}
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all active:scale-95"
      >
        <RefreshCw className="w-4 h-4" />
        Кайра жүктөө
      </button>

      {/* Status hint */}
      <p className="text-gray-600 text-xs mt-12">
        Акыркы жолу онлайн: {new Date().toLocaleString('ru-RU')}
      </p>
    </div>
  );
}
