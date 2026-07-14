'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, ShoppingCart, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { formatCurrency } from '@/lib/utils';

export default function IncomePage() {
  const { user } = useAuthStore();

  const { data: driver, isLoading } = useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: async () => {
      const { data } = await api.get(`/drivers/${user?.id}`);
      return data;
    },
    enabled: !!user?.id,
  });

  const stats = [
    { label: 'Total Earnings', value: formatCurrency(driver?.totalEarnings || 0), icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Total Orders', value: driver?.totalOrders || 0, icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Rating', value: driver?.rating?.toFixed(1) || '5.0', icon: TrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Income</h2>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold mt-1">{stat.value}</p>
                  </div>
                  <div className={`w-14 h-14 rounded-2xl ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-7 h-7 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
