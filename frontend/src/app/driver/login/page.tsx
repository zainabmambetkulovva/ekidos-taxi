'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/axios';
import { toast } from 'sonner';

export default function DriverLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [checking, setChecking] = useState(true);

  // AUTO-REDIRECT: if already logged in, go to dashboard
  useEffect(() => {
    const token = localStorage.getItem('token');
    const driverInfo = localStorage.getItem('driverInfo');
    if (token && driverInfo) {
      // Verify token is still valid
      api.get('/auth/me')
        .then(() => {
          router.replace('/driver/dashboard');
        })
        .catch(() => {
          // Token expired — clear and show login
          setChecking(false);
        });
    } else {
      setChecking(false);
    }
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      return toast.error('Позывной жана паролду жазыңыз');
    }
    setIsLoading(true);
    setErrorMsg('');

    try {
      // Try callsign login first, fallback to phone login
      let data;
      const input = phone.trim();
      if (/^\d{1,4}$/.test(input)) {
        // Looks like callsign (1-4 digits)
        const resp = await api.post('/auth/callsign-login', { callsign: input, password: password.trim() });
        data = resp.data;
      } else {
        // Phone number
        const resp = await api.post('/auth/driver/login', { phone: input, password: password.trim() });
        data = resp.data;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('driverInfo', JSON.stringify(data.driver));
      toast.success(`Кош келиңиз, ${data.driver.firstName}!`);
      router.push('/driver/dashboard');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Кирүү мүмкүн болбоду';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/bg-taxi-city.jpg)' }} />
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />

      <div className="relative z-10 w-full max-w-md">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Артка</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter">
            <span className="text-white">EKIDOS</span>
            <span className="text-red-500 neon-text"> TAXI</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Айдоочу кириши</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Телефон номер / Позывной</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Позывной же телефон"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Паролуңузду жазыңыз"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">Позывной жана пароль диспетчер тарабынан берилет</p>
            </div>

            {errorMsg && (
              <div className="text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-300">
                {errorMsg}
              </div>
            )}

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Кирүү'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
