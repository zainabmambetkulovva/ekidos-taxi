'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ShoppingCart, DollarSign, TrendingUp, Users,
  UserCheck, Star, Trophy, Medal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { formatCurrency } from '@/lib/utils';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';

export default function RatingPage() {
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
    { label: "Today's Orders", value: stats?.todayOrders || 0, icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Monthly Orders', value: stats?.monthlyOrders || 0, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: "Today's Revenue", value: formatCurrency(stats?.todayRevenue || 0), icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Monthly Revenue', value: formatCurrency(stats?.monthlyRevenue || 0), icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Active Drivers', value: stats?.activeDrivers || 0, icon: Users, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Online Drivers', value: stats?.onlineDrivers || 0, icon: UserCheck, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Рейтинг</h1>
        <p className="text-muted-foreground">Показатели и лучшие водители</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="hover:border-white/20 transition-colors">
              <CardContent className="p-5">
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
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

      {/* Best Driver */}
      {stats?.bestDriver && (
        <Card className="border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-yellow-400 font-medium">Best Driver</p>
                <p className="text-xl font-bold">{stats.bestDriver.firstName} {stats.bestDriver.lastName}</p>
                <p className="text-sm text-muted-foreground">
                  {stats.bestDriver.totalOrders} orders • Rating: {stats.bestDriver.rating.toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={charts?.monthlyRevenue || []}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revenueGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={charts?.dailyOrders || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#666" fontSize={12} />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} />
                <Bar dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Drivers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Medal className="w-5 h-5 text-yellow-400" />
            Top 10 Drivers
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
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{driver.totalOrders} orders</p>
                  <p className="text-sm text-green-400">{formatCurrency(driver.totalEarnings)}</p>
                </div>
              </motion.div>
            ))}

            {(!stats?.topDrivers || stats.topDrivers.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No driver data available yet</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
