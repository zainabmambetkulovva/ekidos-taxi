'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/axios';
import { toast } from 'sonner';

export default function ClientLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('+996');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phone.trim();
    if (!cleaned || cleaned === '+996') {
      return toast.error('Телефон номерди жазыңыз');
    }
    setIsLoading(true);
    setErrorMsg('');

    try {
      await api.post('/auth/driver/request-otp', { phone: cleaned });
      toast.success('Код жөнөтүлдү');
      setStep('otp');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Код жөнөтүү мүмкүн болбоду';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 4) {
      return toast.error('4 санды жазыңыз');
    }
    setIsLoading(true);
    setErrorMsg('');

    try {
      const { data } = await api.post('/auth/driver/verify-otp', {
        phone: phone.trim(),
        code: otp.trim(),
      });

      // Store client token and info separately from driver token
      localStorage.setItem('client-token', data.token);
      localStorage.setItem('clientInfo', JSON.stringify(data.driver ?? data.user ?? { phone: phone.trim() }));

      toast.success('Кош келиңиз!');
      router.push('/client/dashboard');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Код туура эмес';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/bg-taxi-city.jpg)' }}
      />
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Артка</span>
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter">
            <span className="text-white">EKIDOS</span>
            <span className="text-red-500 neon-text"> TAXI</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">Жолоочу кириши</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`flex-1 h-1 rounded-full ${step === 'phone' ? 'bg-red-500' : 'bg-red-500'}`} />
            <div className={`flex-1 h-1 rounded-full ${step === 'otp' ? 'bg-red-500' : 'bg-white/10'}`} />
          </div>

          {step === 'phone' ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              <div className="space-y-2">
                <Label>Телефон номер</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="+996 700 000 000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Кыргызстандын номерин жазыңыз (+996 формат)
                </p>
              </div>

              {errorMsg && (
                <div className="text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-300">
                  {errorMsg}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-red-600 hover:bg-red-700"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Код жөнөтүү'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2">
                <Label>SMS Код</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="4 санды жазыңыз"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="pl-10 text-center text-2xl tracking-[0.5em] font-bold"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {phone} номерине код жөнөтүлдү
                </p>
              </div>

              {errorMsg && (
                <div className="text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-300">
                  {errorMsg}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-red-600 hover:bg-red-700"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ырастоо'}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtp('');
                  setErrorMsg('');
                }}
                className="w-full text-sm text-muted-foreground hover:text-white transition-colors text-center py-1"
              >
                Номерди өзгөртүү
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
