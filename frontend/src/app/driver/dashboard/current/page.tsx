'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  MapPin, Phone, User, Navigation, CheckCircle2,
  Clock, Banknote, CreditCard,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

export default function CurrentOrderPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['driver-current-order', user?.id],
    queryFn: async () => {
      const { data } = await api.get(`/orders/driver/${user?.id}`, {
        params: { status: 'ASSIGNED' },
      });
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 10000,
  });

  const completeMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.patch(`/orders/${orderId}/complete`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-current-order'] });
      toast.success('Order completed! Great job!');
    },
    onError: () => {
      toast.error('Failed to complete order');
    },
  });

  const currentOrder = orders?.[0];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Current Order</h2>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!currentOrder) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Current Order</h2>
        <div className="text-center py-20">
          <Navigation className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No active order</h3>
          <p className="text-sm text-muted-foreground/60 mt-1">Accept an order to start driving</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Current Order</h2>
        <Badge variant="info">In Progress</Badge>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-red-500/30">
          <CardContent className="p-5 space-y-4">
            {/* Order Number */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-red-400">#{currentOrder.orderNumber}</span>
              <span className="text-2xl font-bold text-green-400">{formatCurrency(currentOrder.price)}</span>
            </div>

            {/* Route */}
            <div className="space-y-3 py-3 border-y border-border">
              <div className="flex items-start gap-3">
                <div className="mt-1 w-4 h-4 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium">{currentOrder.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 w-4 h-4 rounded-full bg-red-500 flex-shrink-0 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="font-medium">{currentOrder.destAddress}</p>
                </div>
              </div>
            </div>

            {/* Client Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{currentOrder.clientName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <a href={`tel:${currentOrder.clientPhone}`} className="text-sm text-red-400 hover:underline">
                  {currentOrder.clientPhone}
                </a>
              </div>
            </div>

            {/* Payment Info */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {currentOrder.paymentMethod === 'CASH' ? (
                  <Banknote className="w-4 h-4 text-green-400" />
                ) : (
                  <CreditCard className="w-4 h-4 text-blue-400" />
                )}
                <span>{currentOrder.paymentMethod}</span>
              </div>
              <Badge variant="outline">{currentOrder.tariff}</Badge>
            </div>

            {/* Comment */}
            {currentOrder.comment && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Comment</p>
                <p className="text-sm mt-1">{currentOrder.comment}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentOrder.destAddress)}`, '_blank');
                }}
              >
                <Navigation className="w-4 h-4" />
                Navigate
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => completeMutation.mutate(currentOrder.id)}
                disabled={completeMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
