'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus, Search, Car, Phone, Loader2, Filter,
  Pencil, Trash2, ShieldOff, ShieldCheck, KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { toast } from 'sonner';

const emptyForm = {
  firstName: '', lastName: '', middleName: '', birthDate: '',
  phone: '', whatsappNumber: '', passportNumber: '',
  licenseNumber: '', techPassportNumber: '', insuranceNumber: '',
  vehicleBrand: '', vehicleModel: '', vehicleYear: '', vehicleColor: '',
  plateNumber: '', notes: '', accountStatus: 'ACTIVE', telegramId: '',
};

export default function DriversPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', search, statusFilter],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter && statusFilter !== 'ALL') params.accountStatus = statusFilter;
      const { data } = await api.get('/drivers', { params });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (d: any) => {
      if (editingDriver) {
        const { data } = await api.put(`/drivers/${editingDriver.id}`, d);
        return data;
      }
      const { data } = await api.post('/drivers', d);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setIsFormOpen(false);
      setEditingDriver(null);
      setFormData({ ...emptyForm });
      if (data.plainPassword && !editingDriver) {
        // Show generated password to admin
        toast.success(
          `Водитель добавлен! Пароль: ${data.plainPassword}`,
          { duration: 15000, description: `Телефон: ${data.phone} • Пароль: ${data.plainPassword}` }
        );
      } else {
        toast.success(editingDriver ? 'Водитель обновлён' : 'Водитель добавлен');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка');
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.put(`/drivers/${id}`, { accountStatus: status });
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success(vars.status === 'BLOCKED' ? 'Водитель заблокирован' : 'Водитель разблокирован');
    },
    onError: () => toast.error('Ошибка'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/drivers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setDeleteConfirm(null);
      toast.success('Водитель удалён');
    },
    onError: () => toast.error('Ошибка удаления'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/drivers/${id}/reset-password`);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Новый пароль: ${data.password}`, { duration: 15000, description: 'Скопируйте и передайте водителю' });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: () => toast.error('Ошибка сброса пароля'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.birthDate) {
      const birth = new Date(formData.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      if (age < 18) return toast.error('Водитель должен быть старше 18 лет');
    }
    createMutation.mutate(formData);
  };

  const openEdit = (driver: any) => {
    setEditingDriver(driver);
    setFormData({
      firstName: driver.firstName || '',
      lastName: driver.lastName || '',
      middleName: driver.middleName || '',
      birthDate: driver.birthDate ? driver.birthDate.split('T')[0] : '',
      phone: driver.phone || '',
      whatsappNumber: driver.whatsappNumber || '',
      passportNumber: driver.passportNumber || '',
      licenseNumber: driver.licenseNumber || '',
      techPassportNumber: driver.techPassportNumber || '',
      insuranceNumber: driver.vehicle?.insuranceNumber || '',
      vehicleBrand: driver.vehicle?.brand || '',
      vehicleModel: driver.vehicle?.model || '',
      vehicleYear: driver.vehicle?.year?.toString() || '',
      vehicleColor: driver.vehicle?.color || '',
      plateNumber: driver.vehicle?.plateNumber || '',
      notes: driver.notes || '',
      accountStatus: driver.accountStatus || 'ACTIVE',
      telegramId: driver.telegramId ? String(driver.telegramId) : '',
    });
    setIsFormOpen(true);
  };

  const openAdd = () => {
    setEditingDriver(null);
    setFormData({ ...emptyForm });
    setIsFormOpen(true);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') return <Badge variant="success">Активный</Badge>;
    if (status === 'BLOCKED') return <Badge variant="destructive">Заблокирован</Badge>;
    return <Badge variant="warning">Ожидает</Badge>;
  };

  const getOnlineStatus = (status: string) => {
    if (status === 'ONLINE') return <span className="flex items-center gap-1.5 text-green-400"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Онлайн</span>;
    if (status === 'BUSY') return <span className="flex items-center gap-1.5 text-yellow-400"><span className="w-2 h-2 rounded-full bg-yellow-500" />Занят</span>;
    return <span className="flex items-center gap-1.5 text-gray-400"><span className="w-2 h-2 rounded-full bg-gray-500" />Офлайн</span>;
  };

  const f = (key: keyof typeof emptyForm, val: string) => setFormData(p => ({ ...p, [key]: val }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Водители</h1>
          <p className="text-muted-foreground">Управление водителями</p>
        </div>
        <Button onClick={openAdd} size="lg" className="gap-2">
          <Plus className="w-5 h-5" />
          Добавить водителя
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Все статусы</SelectItem>
            <SelectItem value="ACTIVE">Активные</SelectItem>
            <SelectItem value="BLOCKED">Заблокированные</SelectItem>
            <SelectItem value="PENDING">Ожидающие</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.drivers?.map((driver: any, index: number) => (
            <motion.div key={driver.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
              <Card className={`hover:border-white/20 transition-all ${driver.accountStatus === 'BLOCKED' ? 'border-red-500/30' : ''}`}>
                <CardContent className="p-5">
                  {/* Top */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full border flex items-center justify-center ${driver.accountStatus === 'BLOCKED' ? 'bg-red-500/20 border-red-500/40' : 'bg-red-500/10 border-red-500/20'}`}>
                        <span className="text-lg font-bold text-red-400">{driver.firstName?.[0]}{driver.lastName?.[0]}</span>
                      </div>
                      <div>
                        <p className="font-semibold">{driver.firstName} {driver.lastName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{driver.phone}</p>
                      </div>
                    </div>
                    {getStatusBadge(driver.accountStatus)}
                  </div>

                  {driver.vehicle && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Car className="w-4 h-4" />
                      <span>{driver.vehicle.brand} {driver.vehicle.model} • {driver.vehicle.plateNumber}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                    <span className="text-sm">{getOnlineStatus(driver.status)}</span>
                    <span className="text-xs text-muted-foreground">{driver.totalOrders} заказов</span>
                  </div>

                  {/* Password — only visible to admin */}
                  {driver.displayPassword && (
                    <div className="mt-2 flex items-center gap-2">
                      <KeyRound className="w-3 h-3 text-blue-400" />
                      <span className="text-xs font-mono text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">{driver.displayPassword}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => openEdit(driver)}>
                      <Pencil className="w-3.5 h-3.5" />
                      Изменить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                      onClick={() => resetPasswordMutation.mutate(driver.id)}
                      disabled={resetPasswordMutation.isPending}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`gap-1.5 text-xs ${driver.accountStatus === 'BLOCKED' ? 'text-green-400 border-green-500/30 hover:bg-green-500/10' : 'text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10'}`}
                      onClick={() => blockMutation.mutate({ id: driver.id, status: driver.accountStatus === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED' })}
                      disabled={blockMutation.isPending}
                    >
                      {driver.accountStatus === 'BLOCKED' ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                      onClick={() => setDeleteConfirm(driver.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {(!data?.drivers || data.drivers.length === 0) && (
            <div className="col-span-full text-center py-16">
              <Car className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Водители не найдены</h3>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(o) => { setIsFormOpen(o); if (!o) { setEditingDriver(null); setFormData({ ...emptyForm }); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDriver ? 'Изменить водителя' : 'Добавить водителя'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Личная информация</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Имя *</Label><Input value={formData.firstName} onChange={e => f('firstName', e.target.value)} required /></div>
                <div className="space-y-1.5"><Label>Фамилия *</Label><Input value={formData.lastName} onChange={e => f('lastName', e.target.value)} required /></div>
                <div className="space-y-1.5"><Label>Отчество</Label><Input value={formData.middleName} onChange={e => f('middleName', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                <div className="space-y-1.5"><Label>Дата рождения</Label><Input type="date" value={formData.birthDate} onChange={e => f('birthDate', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Телефон *</Label><Input value={formData.phone} onChange={e => f('phone', e.target.value)} placeholder="+996..." required /></div>
                <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={formData.whatsappNumber} onChange={e => f('whatsappNumber', e.target.value)} placeholder="+996..." /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5"><Label>Telegram ID</Label><Input value={formData.telegramId} onChange={e => f('telegramId', e.target.value)} placeholder="123456789" /></div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Документы</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Паспорт</Label><Input value={formData.passportNumber} onChange={e => f('passportNumber', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Вод. удостоверение</Label><Input value={formData.licenseNumber} onChange={e => f('licenseNumber', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Техпаспорт</Label><Input value={formData.techPassportNumber} onChange={e => f('techPassportNumber', e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Страховка</Label><Input value={formData.insuranceNumber} onChange={e => f('insuranceNumber', e.target.value)} /></div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Транспорт</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label>Марка</Label><Input value={formData.vehicleBrand} onChange={e => f('vehicleBrand', e.target.value)} placeholder="Toyota" /></div>
                <div className="space-y-1.5"><Label>Модель</Label><Input value={formData.vehicleModel} onChange={e => f('vehicleModel', e.target.value)} placeholder="Camry" /></div>
                <div className="space-y-1.5"><Label>Год</Label><Input value={formData.vehicleYear} onChange={e => f('vehicleYear', e.target.value)} placeholder="2020" /></div>
                <div className="space-y-1.5"><Label>Цвет</Label><Input value={formData.vehicleColor} onChange={e => f('vehicleColor', e.target.value)} placeholder="Белый" /></div>
                <div className="space-y-1.5"><Label>Гос. номер</Label><Input value={formData.plateNumber} onChange={e => f('plateNumber', e.target.value)} placeholder="01KG123AAA" /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Статус аккаунта</Label>
                <Select value={formData.accountStatus} onValueChange={v => f('accountStatus', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Активный</SelectItem>
                    <SelectItem value="BLOCKED">Заблокирован</SelectItem>
                    <SelectItem value="PENDING">Ожидает</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Заметки</Label><Textarea value={formData.notes} onChange={e => f('notes', e.target.value)} placeholder="Доп. информация..." /></div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Отмена</Button>
              <Button type="submit" disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingDriver ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить водителя?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Это действие нельзя отменить. Все данные водителя будут удалены.</p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Отмена</Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Удалить'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
