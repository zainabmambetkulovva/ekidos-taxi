'use client';

import { Star, Phone, Car, Calendar, MapPin, Award } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ProfilePage() {
  const driver = {
    firstName: 'Водитель',
    lastName: 'EKIDOS',
    phone: '+996 XXX XXX XXX',
    status: 'ACTIVE',
    rating: 5.0,
    totalOrders: 0,
    totalEarnings: 0,
    vehicle: {
      brand: 'Не указано',
      model: '',
      year: 2024,
      color: '—',
      plateNumber: '—',
    },
    joined: '2026',
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Профиль</h2>

      {/* Avatar & Name */}
      <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
        <CardContent className="p-6 text-center">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-500/20">
            <span className="text-3xl font-black text-white">
              {driver.firstName[0]}
            </span>
          </div>
          <h3 className="text-xl font-bold">{driver.firstName} {driver.lastName}</h3>
          <div className="flex items-center justify-center gap-1 mt-2">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <span className="text-lg font-bold">{driver.rating.toFixed(1)}</span>
          </div>
          <Badge variant="success" className="mt-3">Активен</Badge>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="w-6 h-6 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold">{driver.totalOrders}</p>
            <p className="text-xs text-muted-foreground">Заказов</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MapPin className="w-6 h-6 text-green-400 mx-auto mb-1" />
            <p className="text-2xl font-bold">{driver.totalEarnings} сом</p>
            <p className="text-xs text-muted-foreground">Заработано</p>
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
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Регистрация
              </span>
              <span className="text-sm font-medium">{driver.joined}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
