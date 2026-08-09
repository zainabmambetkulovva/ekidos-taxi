'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, MapPin, Phone, User, Loader2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useLanguageStore } from '@/store/useLanguageStore';

// Phone validation: +996 7XX XXX XXX
function isValidKyrgyzPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (/^\+996[57]\d{8}$/.test(cleaned)) return true;
  if (/^0[57]\d{8}$/.test(cleaned)) return true;
  if (/^996[57]\d{8}$/.test(cleaned)) return true;
  return false;
}

function isValidAddress(address: string): boolean {
  const trimmed = address.trim();
  if (trimmed.length < 3) return false;
  if (!/[a-zA-Zа-яА-ЯёЁүҮөӨңҢ]/.test(trimmed)) return false;
  return true;
}

export default function DispatcherPage() {
  const queryClient = useQueryClient();
  const { t } = useLanguageStore();
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderForm, setOrderForm] = useState({
    pickupAddress: '',
    destAddress: '',
    clientPhone: '',    // Позывной (3 цифра) же телефон
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
      setOrderForm({ pickupAddress: '', destAddress: '', clientPhone: '', tariff: 'Standard', comment: '', paymentMethod: 'CASH', price: '' });
      setErrors({});
      toast.success(t('createOrder') + ' ✓');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create order');
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!isValidAddress(orderForm.pickupAddress)) {
      newErrors.pickupAddress = t('pickupAddress') + ' — кеминде 3 символ';
    }
    // Б точка — милдеттүү эмес, бирок жазылса текшерилет
    if (orderForm.destAddress && !isValidAddress(orderForm.destAddress)) {
      newErrors.destAddress = t('destAddress') + ' — кеминде 3 символ';
    }
    // Позывной: 3 цифра же телефон номер
    const callsign = orderForm.clientPhone.trim();
    if (!callsign) {
      newErrors.clientPhone = 'Позывной же телефон жазыңыз';
    } else if (!/^\d{3}$/.test(callsign) && !isValidKyrgyzPhone(callsign)) {
      newErrors.clientPhone = '3 цифра (позывной) же +996 7XX XXX XXX';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    // clientName = позывной жана телефон
    createOrderMutation.mutate({
      ...orderForm,
      clientName: orderForm.clientPhone, // позывной же номер катары
    });
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, any> = {
      PENDING: <Badge variant="warning">{t('pending')}</Badge>,
      ASSIGNED: <Badge variant="info">{t('assigned')}</Badge>,
      IN_PROGRESS: <Badge variant="info">{t('inProgress')}</Badge>,
      COMPLETED: <Badge variant="success">{t('completed')}</Badge>,
      CANCELLED: <Badge variant="destructive">{t('cancelled')}</Badge>,
    };
    return map[status] || <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dispatcher')}</h1>
        <p className="text-muted-foreground">{t('createDispatch')}</p>
      </div>

      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={() => setIsOrderFormOpen(true)}
          size="xl"
          className="w-full h-20 text-xl font-bold gap-3 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20"
        >
          <Plus className="w-7 h-7" />
          {t('addOrder')}
        </Button>
      </motion.div>

      {/* Recent Orders */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('recentOrders')}</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {ordersData?.orders?.filter((order: any) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED').map((order: any, index: number) => (
              <motion.div key={order.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}>
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
                        {order.destAddress && (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{order.destAddress}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <p className="font-medium text-yellow-400 font-mono text-lg">{order.clientPhone}</p>
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
                        <span>{t('driver')}: {order.driver.firstName} {order.driver.lastName}</span>
                        {order.driver.vehicle && <span>• {order.driver.vehicle.plateNumber}</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {(!ordersData?.orders || ordersData.orders.length === 0) && (
              <div className="text-center py-16">
                <Clock className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">{t('noOrdersYet')}</h3>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Order Dialog */}
      <Dialog open={isOrderFormOpen} onOpenChange={setIsOrderFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('createOrder')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            {/* А точка — милдеттүү */}
            <div className="space-y-2">
              <Label>{t('pickupAddress')} *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                <Input
                  value={orderForm.pickupAddress}
                  onChange={(e) => { setOrderForm({...orderForm, pickupAddress: e.target.value}); setErrors({...errors, pickupAddress: ''}); }}
                  placeholder={t('pickupAddress')}
                  className={`pl-10 ${errors.pickupAddress ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              {errors.pickupAddress && <p className="text-xs text-red-400">{errors.pickupAddress}</p>}
            </div>

            {/* Б точка — милдеттүү ЭМЕС */}
            <div className="space-y-2">
              <Label>{t('destAddress')} <span className="text-muted-foreground text-xs">(милдеттүү эмес)</span></Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400" />
                <Input
                  value={orderForm.destAddress}
                  onChange={(e) => { setOrderForm({...orderForm, destAddress: e.target.value}); setErrors({...errors, destAddress: ''}); }}
                  placeholder={t('destAddress')}
                  className={`pl-10 ${errors.destAddress ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.destAddress && <p className="text-xs text-red-400">{errors.destAddress}</p>}
            </div>

            {/* Позывной же телефон */}
            <div className="space-y-2">
              <Label>Позывной же телефон *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400" />
                <Input
                  value={orderForm.clientPhone}
                  onChange={(e) => { setOrderForm({...orderForm, clientPhone: e.target.value}); setErrors({...errors, clientPhone: ''}); }}
                  placeholder="123 же +996 7XX XXX XXX"
                  className={`pl-10 ${errors.clientPhone ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              {errors.clientPhone && <p className="text-xs text-red-400">{errors.clientPhone}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('tariff')}</Label>
                <Select value={orderForm.tariff} onValueChange={(v) => setOrderForm({...orderForm, tariff: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Comfort">Comfort</SelectItem>
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Minivan">Minivan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('paymentMethod')}</Label>
                <Select value={orderForm.paymentMethod} onValueChange={(v) => setOrderForm({...orderForm, paymentMethod: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">{t('cash')}</SelectItem>
                    <SelectItem value="CARD">{t('card')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('price')}</Label>
              <Input type="number" value={orderForm.price} onChange={(e) => setOrderForm({...orderForm, price: e.target.value})} placeholder="0" min="0" />
            </div>

            <div className="space-y-2">
              <Label>{t('comment')}</Label>
              <Textarea value={orderForm.comment} onChange={(e) => setOrderForm({...orderForm, comment: e.target.value})} placeholder={t('comment')} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => { setIsOrderFormOpen(false); setErrors({}); }}>{t('cancel')}</Button>
              <Button type="submit" disabled={createOrderMutation.isPending} className="gap-2">
                {createOrderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t('addOrder')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
