'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, MapPin, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function CompletedOrdersPage() {
  const { user } = useAuthStore();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['driver-completed', user?.id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/driver/${user?.id}`, {
        params: { status: 'COMPLETED' },
      });
      return data;
    },
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Completed Orders</h2>
        <Badge variant="success">{orders?.length || 0} orders</Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : orders?.length === 0 ? (
        <div className="text-center py-20">
          <CheckCircle2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No completed orders</h3>
          <p className="text-sm text-muted-foreground/60 mt-1">Completed orders will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders?.map((order: any, index: number) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className="hover:border-white/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono text-xs text-muted-foreground">#{order.orderNumber}</span>
                    <span className="text-lg font-bold text-green-400">{formatCurrency(order.price)}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-muted-foreground">{order.pickupAddress}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">{order.destAddress}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">{order.clientName}</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(order.completedAt || order.createdAt)}
                    </span>
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
