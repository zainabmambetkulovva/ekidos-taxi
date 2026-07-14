'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus, MapPin, Phone, User, CreditCard, Banknote,
  Loader2, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function DispatcherPage() {
  const queryClient = useQueryClient();
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    pickupAddress: '',
    destAddress: '',
    clientName: '',
    clientPhone: '',
    tariff: 'Standard',
    comment: '',
    paymentMethod: 'CASH',
    price: '',
  });

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['dispatcher-orders'],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: { limit: 50 } });
      return data;
    },
    refetchInterval: 10000,
  });

  const createOrderMutation = useMutation({
    mutationFn: async (order: any) => {
      const { data } = await api.post('/orders', order);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatcher-orders'] });
      setIsOrderFormOpen(false);
      setOrderForm({
        pickupAddress: '', destAddress: '', clientName: '',
        clientPhone: '', tariff: 'Standard', comment: '',
        paymentMethod: 'CASH', price: '',
      });
      toast.success('Order created and sent to drivers');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create order');
    },
  });

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation for required fields
    if (!orderForm.pickupAddress.trim()) {
      toast.error('Pickup address is required');
      return;
    }
    if (!orderForm.destAddress.trim()) {
      toast.error('Destination address is required');
      return;
    }
    if (!orderForm.clientName.trim()) {
      toast.error('Client name is required');
      return;
    }
    if (!orderForm.clientPhone.trim()) {
      toast.error('Client phone is required');
      return;
    }

    createOrderMutation.mutate(orderForm);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge variant="warning">Pending</Badge>;
      case 'ASSIGNED': return <Badge variant="info">Assigned</Badge>;
      case 'IN_PROGRESS': return <Badge variant="info">In Progress</Badge>;
      case 'COMPLETED': return <Badge variant="success">Completed</Badge>;
      case 'CANCELLED': return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Диспетчер</h1>
          <p className="text-muted-foreground">Создание и управление заказами</p>
        </div>
      </div>

      {/* Large Add Order Button */}
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={() => setIsOrderFormOpen(true)}
          size="xl"
          className="w-full h-20 text-xl font-bold gap-3 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20"
        >
          <Plus className="w-7 h-7" />
          Добавить заказ
        </Button>
      </motion.div>

      {/* Recent Orders */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Последние заказы</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {ordersData?.orders?.map((order: any, index: number) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card className="hover:border-white/20 transition-all">
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-red-400">#{order.orderNumber}</span>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{order.pickupAddress}</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{order.destAddress}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <p className="font-medium">{order.clientName}</p>
                          <p className="text-muted-foreground">{order.clientPhone}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{formatCurrency(order.price)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                    {order.driver && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>Driver: {order.driver.firstName} {order.driver.lastName}</span>
                        {order.driver.vehicle && (
                          <span>• {order.driver.vehicle.brand} {order.driver.vehicle.plateNumber}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {(!ordersData?.orders || ordersData.orders.length === 0) && (
              <div className="text-center py-16">
                <Clock className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">No orders yet</h3>
                <p className="text-sm text-muted-foreground/60 mt-1">Create your first order to start dispatching</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Order Dialog */}
      <Dialog open={isOrderFormOpen} onOpenChange={setIsOrderFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Создать новый заказ</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            <div className="space-y-2">
              <Label>Pickup Address *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                <Input
                  value={orderForm.pickupAddress}
                  onChange={(e) => setOrderForm({...orderForm, pickupAddress: e.target.value})}
                  placeholder="From where?"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Destination Address *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                <Input
                  value={orderForm.destAddress}
                  onChange={(e) => setOrderForm({...orderForm, destAddress: e.target.value})}
                  placeholder="To where?"
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client Name *</Label>
                <Input
                  value={orderForm.clientName}
                  onChange={(e) => setOrderForm({...orderForm, clientName: e.target.value})}
                  placeholder="Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Client Phone *</Label>
                <Input
                  value={orderForm.clientPhone}
                  onChange={(e) => setOrderForm({...orderForm, clientPhone: e.target.value})}
                  placeholder="+996..."
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tariff</Label>
                <Select value={orderForm.tariff} onValueChange={(v) => setOrderForm({...orderForm, tariff: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Comfort">Comfort</SelectItem>
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Minivan">Minivan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={orderForm.paymentMethod} onValueChange={(v) => setOrderForm({...orderForm, paymentMethod: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Order Price (сом)</Label>
              <Input
                type="number"
                value={orderForm.price}
                onChange={(e) => setOrderForm({...orderForm, price: e.target.value})}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Comment</Label>
              <Textarea
                value={orderForm.comment}
                onChange={(e) => setOrderForm({...orderForm, comment: e.target.value})}
                placeholder="Additional info..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsOrderFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createOrderMutation.isPending} className="gap-2">
                {createOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Order
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
