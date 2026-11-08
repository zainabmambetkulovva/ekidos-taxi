'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, MapPin, Phone, User, Loader2, Clock, SlidersHorizontal, X, Check, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/axios';
import { connectSocket } from '@/lib/socket';
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

  useEffect(() => { if (open) setLocal(selected); }, [open]);

  const toggle = (id: string) => {
    setLocal(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="bg-[#0f1720] border-[#35577D]/30 p-4 gap-0"
        style={{ width: '520px', maxWidth: '90vw' }}
      >
        <DialogHeader className="pb-3">
          <DialogTitle className="text-base text-white">Опции к заказу</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {OPTIONS_LIST.map((opt) => {
            const isSelected = local.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(opt.id); }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left cursor-pointer ${
                  isSelected
                    ? 'bg-red-500/20 border-red-500/50 text-white'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                }`}
              >
                <span className="text-base">{opt.emoji}</span>
                <span className="text-sm font-medium flex-1 leading-tight">{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 text-red-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSave(local); onClose(); }}
          className="w-full h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-all cursor-pointer"
        >
          Сохранить{local.length > 0 ? ` (${local.length})` : ''}
        </button>
      </DialogContent>
    </Dialog>
  );
}
// ===== END OPTIONS =====

/**
 * Номер талаасы: "+996" ар дайым башында турат, диспетчер калган 9 санды жазат.
 * Кандай жазса да (0995576660, 995 576 660, +996995576660 ж.б.) — 9 сан гана калат.
 */
const PHONE_PREFIX = '+996';

function toLocalPhoneDigits(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (raw.trim().startsWith(PHONE_PREFIX)) {
    d = d.slice(3);
  } else if (raw.includes('+') && d.length <= 3 && '996'.startsWith(d)) {
    // "+996" префиксин өчүрүп жатат
    d = '';
  }
  // +996 кайра чапталса (мис. "+996 +996995576660")
  while (d.length > 9 && d.startsWith('996')) d = d.slice(3);
  // 0995576660 → 995576660
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 9);
}

function formatPhoneInput(local: string): string {
  const groups = [local.slice(0, 3), local.slice(3, 6), local.slice(6, 9)].filter(Boolean);
  return `${PHONE_PREFIX} ${groups.join(' ')}`.trimEnd() + (local.length === 0 ? ' ' : '');
}

/** Талаа өзгөргөндө: бош орун же "+996" өчүрүлсө — сандар бузулбайт. */
function nextLocalPhone(raw: string, current: string, caret: number | null): string {
  const prev = formatPhoneInput(current);
  // "+996" префиксинен бир белги өчүрүлдү — префикс өзгөрбөйт
  if (raw.length === prev.length - 1 && !raw.startsWith(PHONE_PREFIX)) return current;
  let next = toLocalPhoneDigits(raw);
  // Сандардын ортосундагы бош орун өчүрүлдү — анын алдындагы санды өчүрөбүз
  if (raw.length < prev.length && next === current && current.length > 0) {
    const pos = caret ?? raw.length;
    const digitsBefore = raw.slice(0, pos).replace(/\D/g, '').length - 3;
    const idx = Math.min(current.length, digitsBefore) - 1;
    if (idx >= 0) next = current.slice(0, idx) + current.slice(idx + 1);
  }
  return next;
}

function validateLocalPhone(local: string): string | null {
  if (local.length === 0) return 'Номер жазыңыз';
  if (local.length < 9) return `Номер толук эмес: +996 XXX XXX XXX (дагы ${9 - local.length} сан керек)`;
  return null;
}

// Отмена болгон заказдар бүгүн гана тизмеде калат
function isToday(d?: string | null): boolean {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

const CANCELLED_BY_TEXT: Record<string, string> = {
  DISPATCHER: 'Диспетчер отмена кылды',
  CLIENT: 'Клиент отмена кылды',
  DRIVER: 'Водитель отмена кылды',
  SYSTEM: 'Система отмена кылды',
};

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
    targetCallsign: '',
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
    refetchInterval: 3000, // poll every 3s — reliable fallback
  });

  // Realtime socket updates — заказ кабыл алынса/бүтсө дароо жаңырсын
  useEffect(() => {
    const socket = connectSocket();

    // Join admin room (belt-and-suspenders — layout also does this)
    const adminInfo = typeof window !== 'undefined' ? localStorage.getItem('adminInfo') : null;
    const adminId = adminInfo ? JSON.parse(adminInfo || '{}').id || 'admin' : 'admin';
    socket.emit('admin:join', adminId);
    // Re-join on reconnect
    const rejoin = () => socket.emit('admin:join', adminId);
    socket.on('connect', rejoin);

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['dispatcher-orders'] });

    // Backend жиберген бардык order event'терди тыңша
    socket.on('order:accepted', refresh);
    socket.on('order:completed', refresh);
    socket.on('order:cancelled', refresh);
    socket.on('order:new', refresh);
    socket.on('order:taken', refresh);
    socket.on('order:assigned', refresh);
    socket.on('order:status-changed', refresh);
    socket.on('notification', (data: any) => {
      if (data.type === 'order_accepted' || data.type === 'order_completed' || data.type === 'auto_assigned' || data.type === 'targeted_dispatch') {
        refresh();
      }
    });

    return () => {
      socket.off('connect', rejoin);
      socket.off('order:accepted', refresh);
      socket.off('order:completed', refresh);
      socket.off('order:cancelled', refresh);
      socket.off('order:new', refresh);
      socket.off('order:taken', refresh);
      socket.off('order:assigned', refresh);
      socket.off('order:status-changed', refresh);
      socket.off('notification');
    };
  }, [queryClient]);

  const createOrderMutation = useMutation({
    mutationFn: async (order: any) => {
      const { data } = await api.post('/orders', order);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatcher-orders'] });
      setIsOrderFormOpen(false);
      setOrderForm({ pickupAddress: '', destAddress: '', clientPhone: '', targetCallsign: '', tariff: 'Standard', comment: '', paymentMethod: 'CASH' });
      setSelectedOptions([]);
      setErrors({});
      toast.success(t('createOrder') + ' ✓');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to create order');
    },
  });

  // Заказды отмена кылуу (клиент кайра чалып отмена кылганда)
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data } = await api.patch(`/orders/${orderId}/dispatcher-cancel`);
      return data;
    },
    onMutate: async (orderId: string) => {
      // Тизмеден дароо алып салабыз
      setConfirmCancelId(null);
      await queryClient.cancelQueries({ queryKey: ['dispatcher-orders'] });
      const prev = queryClient.getQueryData(['dispatcher-orders']);
      queryClient.setQueryData(['dispatcher-orders'], (old: any) =>
        old?.orders ? { ...old, orders: old.orders.map((o: any) => (o.id === orderId ? { ...o, status: 'CANCELLED', cancelledBy: 'DISPATCHER', cancelledAt: new Date().toISOString() } : o)) } : old
      );
      return { prev };
    },
    onSuccess: (data) => {
      toast.success(data?.refunded > 0 ? `Заказ отмена болду. Водительге ${data.refunded} сом кайтарылды.` : 'Заказ отмена болду');
    },
    onError: (error: any, _id, ctx: any) => {
      if (ctx?.prev) queryClient.setQueryData(['dispatcher-orders'], ctx.prev);
      toast.error(error.response?.data?.error || 'Отмена кылуу мүмкүн болбоду');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatcher-orders'] });
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
    const phoneError = validateLocalPhone(orderForm.clientPhone);
    if (phoneError) {
      newErrors.clientPhone = phoneError;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    const phone = `${PHONE_PREFIX}${orderForm.clientPhone}`;
    createOrderMutation.mutate({
      ...orderForm,
      clientPhone: phone,
      clientName: phone,
      options: selectedOptions,
      targetCallsign: orderForm.targetCallsign.trim() || undefined,
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
            {ordersData?.orders?.filter((order: any) => order.status !== 'COMPLETED' && (order.status !== 'CANCELLED' || isToday(order.cancelledAt || order.createdAt))).map((order: any, index: number) => (
              <motion.div key={order.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.03 }}>
                <Card className={`transition-all ${order.status === 'CANCELLED' ? 'border-red-500/40 bg-red-500/[0.06] opacity-80' : 'hover:border-white/20'}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-red-400">#{order.orderNumber}</span>
                          {order.status === 'CANCELLED' ? (
                            <Badge variant="destructive">Заказ отмена болду</Badge>
                          ) : getStatusBadge(order.status)}
                          {order.status === 'CANCELLED' && (
                            <span className="text-xs font-semibold text-red-400">
                              {CANCELLED_BY_TEXT[order.cancelledBy] || 'Отмена болду'}
                              {order.cancelledAt && ` · ${new Date(order.cancelledAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
                            </span>
                          )}
                          {order.status === 'PENDING' && order.targetCallsign && (
                            <Badge variant="info">🎯 {order.targetCallsign} гана</Badge>
                          )}
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
                        {order.status === 'CANCELLED' ? null : confirmCancelId === order.id ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={cancelOrderMutation.isPending}
                              onClick={() => cancelOrderMutation.mutate(order.id)}
                            >
                              Ооба, отмена
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmCancelId(null)}>
                              Жок
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => setConfirmCancelId(order.id)}
                          >
                            <XCircle className="w-4 h-4" />
                            Отмена
                          </Button>
                        )}
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

            {/* Позывной (опционально) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Позывной водителя
                <span className="text-xs text-muted-foreground font-normal">(милдеттүү эмес)</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <Input
                  value={orderForm.targetCallsign}
                  onChange={(e) => setOrderForm({...orderForm, targetCallsign: e.target.value})}
                  placeholder="Мисалы: 001, 003..."
                  className="pl-10"
                />
              </div>
              {orderForm.targetCallsign.trim() && (
                <p className="text-xs text-blue-400">⚡ Заказ позывной <b>{orderForm.targetCallsign.trim()}</b> дегенге гана жиберилет</p>
              )}
            </div>

            {/* Номер */}
            <div className="space-y-2">
              <Label>Номер *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400" />
                <Input
                  value={formatPhoneInput(orderForm.clientPhone)}
                  onChange={(e) => { setOrderForm({...orderForm, clientPhone: nextLocalPhone(e.target.value, orderForm.clientPhone, e.target.selectionStart)}); setErrors({...errors, clientPhone: ''}); }}
                  type="tel"
                  inputMode="tel"
                  placeholder="+996"
                  className={`pl-10 font-mono ${errors.clientPhone ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              {errors.clientPhone && <p className="text-xs text-red-400">{errors.clientPhone}</p>}
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
