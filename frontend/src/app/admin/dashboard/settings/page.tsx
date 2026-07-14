'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2, Lock, Save, Loader2, Users, Globe,
  Plus, Trash2, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { Lang } from '@/lib/translations';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { lang, setLang } = useLanguageStore();
  const [companyName, setCompanyName] = useState('');
  const [language, setLanguage] = useState(lang);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'ADMIN' });
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { const { data } = await api.get('/settings'); return data; },
  });

  const { data: admins = [], refetch: refetchAdmins } = useQuery({
    queryKey: ['admins'],
    queryFn: async () => { const { data } = await api.get('/admins'); return data; },
  });

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || '');
      setLanguage(settings.language || 'ru');
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (d: any) => { const res = await api.put('/settings', d); return res.data; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Сохранено'); },
    onError: () => toast.error('Ошибка сохранения'),
  });

  const handleAddAdmin = async (forceUpdate = false) => {
    if (!newAdmin.email || !newAdmin.password || !newAdmin.firstName || !newAdmin.lastName) {
      return toast.error('Заполните все поля');
    }
    if (newAdmin.password.length < 6) {
      return toast.error('Пароль минимум 6 символов');
    }
    setAddingAdmin(true);
    try {
      const res = await api.post('/admins', newAdmin);
      const isUpdated = res.data.updated;
      toast.success(isUpdated
        ? `Аккаунт ${res.data.email} обновлён и назначен администратором`
        : `Аккаунт ${res.data.email} успешно создан`
      );
      setIsAddAdminOpen(false);
      setNewAdmin({ email: '', password: '', firstName: '', lastName: '', role: 'ADMIN' });
      refetchAdmins();
    } catch (e: any) {
      const errorCode = e?.response?.data?.error;
      const msg = e?.response?.data?.message || e?.response?.data?.error || 'Ошибка';

      if (errorCode === 'not_found') {
        // Чёткое сообщение — жасалма email жаздырбоо
        toast.error(msg, { duration: 6000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id: string, email: string) => {
    if (email === user?.email) return toast.error('Нельзя удалить свой аккаунт');
    setDeletingId(id);
    try {
      await api.delete(`/admins/${id}`);
      toast.success('Аккаунт удалён');
      refetchAdmins();
    } catch {
      toast.error('Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-muted-foreground">Настройка системы</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-red-400" />
              Компания
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Название компании</Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="EKIDOS TAXI" />
            </div>
            <Button onClick={() => updateMutation.mutate({ companyName, language })} disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Сохранить
            </Button>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Язык
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Язык интерфейса</Label>
              <Select value={language} onValueChange={(v) => { setLanguage(v); setLang(v as Lang); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="kg">Кыргызча</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => updateMutation.mutate({ companyName, language })} disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Применить
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-5 h-5 text-yellow-400" />
              Безопасность
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Текущий пароль</Label>
              <Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Введите текущий пароль" />
            </div>
            <div className="space-y-2">
              <Label>Новый пароль</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Введите новый пароль" />
            </div>
            <Button variant="outline" className="gap-2">
              <Lock className="w-4 h-4" />
              Сменить пароль
            </Button>
          </CardContent>
        </Card>

        {/* Admin Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              Аккаунты администраторов
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Existing admins list */}
            {(Array.isArray(admins) ? admins : []).map((admin: any) => (
              <div key={admin.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-red-400">{admin.firstName?.[0]}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{admin.firstName} {admin.lastName}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-white/5 px-2 py-1 rounded text-muted-foreground">{admin.role}</span>
                  {admin.email !== user?.email && (
                    <button
                      onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                      disabled={deletingId === admin.id}
                      className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                    >
                      {deletingId === admin.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Trash2 className="w-3.5 h-3.5 text-red-400" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <Button variant="outline" className="w-full gap-2 mt-2" onClick={() => setIsAddAdminOpen(true)}>
              <Plus className="w-4 h-4" />
              Добавить аккаунт
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Add Admin Dialog */}
      <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить администратора</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Имя *</Label>
                <Input value={newAdmin.firstName} onChange={e => setNewAdmin({ ...newAdmin, firstName: e.target.value })} placeholder="Имя" />
              </div>
              <div className="space-y-2">
                <Label>Фамилия *</Label>
                <Input value={newAdmin.lastName} onChange={e => setNewAdmin({ ...newAdmin, lastName: e.target.value })} placeholder="Фамилия" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={newAdmin.email} onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })} placeholder="admin@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Пароль *</Label>
              <Input type="password" value={newAdmin.password} onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })} placeholder="Минимум 6 символов" />
            </div>
            <div className="space-y-2">
              <Label>Роль</Label>
              <Select value={newAdmin.role} onValueChange={v => setNewAdmin({ ...newAdmin, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Администратор</SelectItem>
                  <SelectItem value="DISPATCHER">Диспетчер</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsAddAdminOpen(false)}>Отмена</Button>
              <Button className="flex-1 gap-2" onClick={() => handleAddAdmin()} disabled={addingAdmin}>
                {addingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
