'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star, Phone, Car, Calendar, Award, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguageStore } from '@/store/useLanguageStore';
import api from '@/lib/axios';

export default function ProfilePage() {
  const router = useRouter();
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguageStore();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.get('/auth/me');
        setDriver(data);
      } catch {
        const info = localStorage.getItem('driverInfo');
        if (info) setDriver(JSON.parse(info));
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!driver) {
    return <div className="p-4 text-center text-muted-foreground">Профиль жүктөлгөн жок</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">{t('profile')}</h2>

      {/* Avatar & Name */}
      <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
        <CardContent className="p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-500/20">
            <span className="text-3xl font-black text-white">
              {driver.firstName?.[0] || 'D'}
            </span>
          </div>
          <h3 className="text-xl font-bold">{driver.firstName} {driver.lastName}</h3>
          {driver.callsign && (
            <div className="mt-1 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 inline-flex items-center">
              <span className="text-red-400 font-black text-lg">#{driver.callsign}</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-1 mt-2">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <span className="text-lg font-bold">{driver.rating?.toFixed(1) || '5.0'}</span>
          </div>
          <Badge variant="success" className="mt-3">
            {driver.accountStatus === 'ACTIVE' ? 'Активен' : driver.accountStatus === 'BLOCKED' ? 'Заблокирован' : 'Ожидает'}
          </Badge>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="cursor-pointer hover:border-blue-500/30 transition-colors" onClick={() => router.push('/driver/dashboard/archive')}>
          <CardContent className="p-3 text-center">
            <Award className="w-5 h-5 text-blue-400 mx-auto mb-1" />
            <p className="text-xl font-bold">{driver.totalOrders || 0}</p>
            <p className="text-[10px] text-muted-foreground">Архив</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-green-500/30 transition-colors" onClick={() => router.push('/driver/dashboard/balance-history')}>
          <CardContent className="p-3 text-center">
            <MapPin className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold">{Number(driver.balance || 0)}</p>
            <p className="text-[10px] text-muted-foreground">Баланс</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Star className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-xl font-bold">{Number(driver.totalEarnings || 0).toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Тапкан</p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Информация</h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" /> Телефон
              </span>
              <span className="text-sm font-medium">{driver.phone}</span>
            </div>
            {driver.callsign && (
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Позывной</span>
                <span className="text-sm font-black text-red-400">#{driver.callsign}</span>
              </div>
            )}
            {driver.vehicle && (
              <>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Car className="w-4 h-4" /> Авто
                  </span>
                  <span className="text-sm font-medium">{driver.vehicle.brand} {driver.vehicle.model}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Цвет</span>
                  <span className="text-sm font-medium">{driver.vehicle.color}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Гос. номер</span>
                  <span className="text-sm font-mono font-medium">{driver.vehicle.plateNumber}</span>
                </div>
              </>
            )}
            {!driver.vehicle && (
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Car className="w-4 h-4" /> Авто
                </span>
                <span className="text-sm text-muted-foreground">Не указано</span>
              </div>
            )}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Регистрация
              </span>
              <span className="text-sm font-medium">
                {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString('ru-RU') : '—'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
