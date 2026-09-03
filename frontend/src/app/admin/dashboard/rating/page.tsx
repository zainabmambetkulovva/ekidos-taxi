'use client';

import { useLanguageStore } from '@/store/useLanguageStore';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ShoppingCart, TrendingUp, Users, UserCheck, Star, Medal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function RatingPage() {
  const { t } = useLanguageStore();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['rating-stats'],
    queryFn: async () => {
      const { data } = await api.get('/stats/rating');
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: charts } = useQuery({
    queryKey: ['rating-charts'],
    queryFn: async () => {
      const { data } = await api.get('/stats/charts');
      return data;
    },
    refetchInterval: 60000,
  });

  const statCards = [
    { label: t('todayOrders'), value: stats?.todayOrders ?? 0, icon: ShoppingCart },
    { label: t('monthlyOrders'), value: stats?.monthlyOrders ?? 0, icon: TrendingUp },
    { label: t('activeDrivers'), value: stats?.activeDrivers ?? 0, icon: Users },
    { label: t('onlineDrivers'), value: stats?.onlineDrivers ?? 0, icon: UserCheck },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Рейтинг</h1>
        <p className="text-muted-foreground">Көрсөткүчтөр жана мыкты айдоочулар</p>
      </div>

      {/* Stats Grid — 2x2 */}
      <div className="grid grid-cols-2 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="hover:border-[#35577D]/50 transition-colors border-[#35577D]/20">
              <CardContent className="p-5">
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-[#35577D]/20 flex items-center justify-center">
                      <stat.icon className="w-5 h-5 text-[#7BBDE8]" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Orders Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Заказдар</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={charts?.dailyOrders || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#35577D30" />
              <XAxis dataKey="date" stroke="#7BBDE8" fontSize={12} />
              <YAxis stroke="#7BBDE8" fontSize={12} />
              <Tooltip contentStyle={{ background: '#141E30', border: '1px solid #35577D', borderRadius: '8px' }} />
              <Bar dataKey="orders" fill="#35577D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 10 Drivers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Medal className="w-5 h-5 text-yellow-400" />
            Топ 10 Айдоочулар
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(stats?.topDrivers || []).map((driver: any, idx: number) => (
              <motion.div
                key={driver.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-lg font-bold w-8 ${idx < 3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                    #{idx + 1}
                  </span>
                  <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <span className="text-sm font-bold text-red-400">
                      {driver.firstName?.[0]}{driver.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{driver.firstName} {driver.lastName}</p>
                    <p className="text-xs text-muted-foreground">
                      {driver.vehicle?.brand} {driver.vehicle?.model} • {driver.vehicle?.plateNumber}
                    </p>
                    {/* Show rating only if > 0 (client has rated) */}
                    {driver.rating > 0 && (
                      <p className="text-xs text-yellow-400 flex items-center gap-1 mt-0.5">
                        <Star className="w-3 h-3 fill-yellow-400" />
                        {driver.rating.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{driver.totalOrders} заказ</p>
                </div>
              </motion.div>
            ))}

            {(!stats?.topDrivers || stats.topDrivers.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Маалымат жок</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
