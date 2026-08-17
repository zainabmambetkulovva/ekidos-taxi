'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, MapPin, Phone, User, Loader2, Clock, SlidersHorizontal, X, Check } from 'lucide-react';
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
import { formatDate } from '@/lib/utils';
import { useLanguageStore } from '@/store/useLanguageStore';

import { ORDER_OPTIONS as OPTIONS_LIST } from '@/lib/order-options';

function OptionsBottomSheet({
  open,
  selected,
  onClose,
  onSave,
}: {
  open: boolean;
  selected: string[];
  onClose: () => void;
  onSave: (opts: string[]) => void;
}) {
  const [local, setLocal] = useState<string[]>(selected);

  // sync when reopened
  useState(() => { setLocal(selected); });

  const toggle = (id: string) => {
    setLocal(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md p-3 gap-0 bg-[#0f1720] border-[#35577D]/30">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-sm text-white">Опции к заказу</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 mb-2">
          {OPTIONS_LIST.map((opt) => {
            const isSelected = local.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border transition-all text-left ${
                  isSelected
                    ? 'bg-red-500/20 border-red-500/50 text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <span className="text-xs">{opt.emoji}</span>
                <span className="text-[11px] font-medium flex-1 leading-tight">{opt.label}</span>
                {isSelected && <Check className="w-2.5 h-2.5 text-red-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => { onSave(local); onClose(); }}
          className="w-full h-7 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-[11px] transition-all"
        >
          Сохранить{local.length > 0 ? ` (${local.length})` : ''}
        </button>
      </DialogContent>
    </Dialog>
  );
}
// ===== END OPTIONS =====

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
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderForm, setOrderForm] = useState({
    pickupAddress: '',
    destAddress: '',
    clientPhone: '',
    tariff: 'Standard',
    comment: '',
    paymentMethod: 'CASH',
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
      setOrderForm({ pickupAddress: '', destAddress: '', clientPhone: '', tariff: 'Standard', comment: '', paymentMethod: 'CASH' });
      setSelectedOptions([]);
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
    if (orderForm.destAddress && !isValidAddress(orderForm.destAddress)) {
      newErrors.destAddress = t('destAddress') + ' — кеминде 3 символ';
    }
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
    createOrderMutation.mutate({
      ...orderForm,
      clientName: orderForm.clientPhone,
      options: selectedOptions,
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
          size="lg"
          className="gap-2 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20"
        >
          <Plus className="w-5 h-5" />
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
                        {/* Show options if any */}
                        {order.options && order.options.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {order.options.map((optId: string) => {
                              const opt = OPTIONS_LIST.find(o => o.id === optId);
                              return opt ? (
                                <span key={optId} className="text-xs bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                                  {opt.emoji} {opt.label}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <p className="font-medium text-yellow-400 font-mono text-lg">{order.clientPhone}</p>
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
      <Dialog open={isOrderFormOpen} onOpenChange={(open) => { setIsOrderFormOpen(open); if (!open) setErrors({}); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('createOrder')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrder} className="space-y-4">
            {/* А точка */}
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

            {/* Б точка */}
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

            {/* Позывной */}
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

            {/* Опции */}
            <div className="space-y-2">
              <Label>Опции к заказу</Label>
              <button
                type="button"
                onClick={() => setIsOptionsOpen(true)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                  selectedOptions.length > 0
                    ? 'bg-red-500/10 border-red-500/40 text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 flex-shrink-0" />
                {selectedOptions.length > 0 ? (
                  <span className="text-sm flex-1 truncate">
                    {selectedOptions.map(id => OPTIONS_LIST.find(o => o.id === id)?.label).filter(Boolean).join(', ')}
                  </span>
                ) : (
                  <span className="text-sm flex-1">Опцияларды тандаңыз...</span>
                )}
                {selectedOptions.length > 0 && (
                  <span className="text-xs bg-red-500/30 text-red-400 px-2 py-0.5 rounded-full font-bold">{selectedOptions.length}</span>
                )}
              </button>
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

      {/* Options Bottom Sheet */}
      <OptionsBottomSheet
        open={isOptionsOpen}
        selected={selectedOptions}
        onClose={() => setIsOptionsOpen(false)}
        onSave={(opts) => setSelectedOptions(opts)}
      />
    </div>
  );
}
