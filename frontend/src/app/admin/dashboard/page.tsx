'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ShoppingCart, DollarSign, TrendingUp, Users,
  UserCheck, UserX, Car, UsersRound,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { formatCurrency } from '@/lib/utils';
import { useLanguageStore } from '@/store/useLanguageStore';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLanguageStore();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data } = await api.get('/stats/dashboard');
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: async () => {
      const { data } = await api.get('/stats/charts');
      return data;
    },
    refetchInterval: 60000,
  });

  const statCards = [
    { label: t('todayOrders'), value: stats?.todayOrders || 0, icon: ShoppingCart },
    { label: t('todayRevenue'), value: formatCurrency(stats?.todayRevenue || 0), icon: DollarSign },
    { label: t('monthlyRevenue'), value: formatCurrency(stats?.monthlyRevenue || 0), icon: TrendingUp },
    { label: t('onlineDrivers'), value: stats?.onlineDrivers || 0, icon: UserCheck },
    { label: t('busyDrivers'), value: stats?.busyDrivers || 0, icon: Car },
    { label: t('offlineDrivers'), value: stats?.offlineDrivers || 0, icon: UserX },
    { label: t('totalDrivers'), value: stats?.totalDrivers || 0, icon: Users },
    { label: t('totalClients'), value: stats?.totalClients || 0, icon: UsersRound },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
        <p className="text-muted-foreground">{t('realtimeOverview')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="hover:border-[#35577D]/50 transition-all border-[#35577D]/20">
              <CardContent className="p-5">
                {statsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-[#35577D]/30 flex items-center justify-center">
                      <stat.icon className="w-5 h-5 text-[#7BBDE8]" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Orders */}
        <Card className="border-[#35577D]/20">
          <CardHeader>
            <CardTitle className="text-base">{t('dailyOrders')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={charts?.dailyOrders || []}>
                  <defs>
                    <linearGradient id="orderGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7BBDE8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7BBDE8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#35577D30" />
                  <XAxis dataKey="date" stroke="#7BBDE8" fontSize={12} />
                  <YAxis stroke="#7BBDE8" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: '#141E30', border: '1px solid #35577D', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: any) => [value, 'Заказы']}
                  />
                  <Area type="monotone" dataKey="orders" name="Заказы" stroke="#7BBDE8" fill="url(#orderGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Weekly Revenue */}
        <Card className="border-[#35577D]/20">
          <CardHeader>
            <CardTitle className="text-base">{t('weeklyRevenue')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={charts?.dailyOrders || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#35577D30" />
                  <XAxis dataKey="date" stroke="#7BBDE8" fontSize={12} />
                  <YAxis stroke="#7BBDE8" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: '#141E30', border: '1px solid #35577D', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: any) => [value, 'Доход']}
                  />
                  <Bar dataKey="revenue" name="Доход" fill="#35577D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card className="border-[#35577D]/20">
          <CardHeader>
            <CardTitle className="text-base">{t('monthlyRevenueChart')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={charts?.monthlyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#35577D30" />
                  <XAxis dataKey="month" stroke="#7BBDE8" fontSize={12} />
                  <YAxis stroke="#7BBDE8" fontSize={12} domain={[0, 100000]} ticks={[0, 10000, 20000, 40000, 60000, 80000, 100000]} />
                  <Tooltip
                    contentStyle={{ background: '#141E30', border: '1px solid #35577D', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                    formatter={(value: any, name: string) => [value, name === 'revenue' ? 'Доход' : 'Заказы']}
                  />
                  <Line type="monotone" dataKey="revenue" name="Доход" stroke="#7BBDE8" strokeWidth={2} dot={{ fill: '#7BBDE8' }} />
                  <Line type="monotone" dataKey="orders" name="Заказы" stroke="#35577D" strokeWidth={2} dot={{ fill: '#35577D' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Driver Activity */}
        <Card className="border-[#35577D]/20">
          <CardHeader>
            <CardTitle className="text-base">{t('driverActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <div className="space-y-3">
                {(charts?.topDrivers || []).slice(0, 5).map((driver: any, idx: number) => (
                  <div
                    key={driver.id}
                    onClick={() => router.push('/admin/dashboard/drivers')}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#35577D]/10 cursor-pointer hover:bg-[#35577D]/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-500 w-6">#{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-white">{driver.firstName} {driver.lastName}</p>
                        <p className="text-xs text-gray-400">{driver.totalOrders} заказов</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#7BBDE8]">
                      {formatCurrency(driver.totalEarnings)}
                    </span>
                  </div>
                ))}
                {(!charts?.topDrivers || charts.topDrivers.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Нет данных по водителям</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
