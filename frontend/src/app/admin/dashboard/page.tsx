'use client';

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
    { label: t('todayOrders'), value: stats?.todayOrders || 0, icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: t('todayRevenue'), value: formatCurrency(stats?.todayRevenue || 0), icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: t('monthlyRevenue'), value: formatCurrency(stats?.monthlyRevenue || 0), icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: t('onlineDrivers'), value: stats?.onlineDrivers || 0, icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: t('busyDrivers'), value: stats?.busyDrivers || 0, icon: Car, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: t('offlineDrivers'), value: stats?.offlineDrivers || 0, icon: UserX, color: 'text-gray-400', bg: 'bg-gray-500/10' },
    { label: t('totalDrivers'), value: stats?.totalDrivers || 0, icon: Users, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: t('totalClients'), value: stats?.totalClients || 0, icon: UsersRound, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
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
            <Card className="hover:border-white/20 transition-colors">
              <CardContent className="p-5">
                {statsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
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
        <Card>
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
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="orders" stroke="#ef4444" fill="url(#orderGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Weekly Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('weeklyRevenue')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={charts?.dailyOrders || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="revenue" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('monthlyRevenueChart')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={charts?.monthlyRevenue || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="month" stroke="#666" fontSize={12} />
                  <YAxis stroke="#666" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                  <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Driver Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('driverActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <div className="space-y-3">
                {(charts?.topDrivers || []).slice(0, 5).map((driver: any, idx: number) => (
                  <div key={driver.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-6">#{idx + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{driver.firstName} {driver.lastName}</p>
                        <p className="text-xs text-muted-foreground">{driver.totalOrders} orders</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-green-400">
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
