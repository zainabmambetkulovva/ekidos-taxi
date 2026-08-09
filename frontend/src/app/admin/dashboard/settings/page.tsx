'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Lock, Save, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useLanguageStore } from '@/store/useLanguageStore';
import { Lang } from '@/lib/translations';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { lang, setLang, t } = useLanguageStore();
  const [companyName, setCompanyName] = useState('');
  const [language, setLanguage] = useState(lang);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { const { data } = await api.get('/settings'); return data; },
  });

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || '');
      setLanguage(settings.language || 'ru');
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (d: any) => { const res = await api.put('/settings', d); return res.data; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success(t('saveChanges') + ' ✓');
    },
    onError: () => toast.error('Error'),
  });

  const handleSaveCompany = () => {
    updateMutation.mutate({ companyName, language });
  };

  const handleSaveLanguage = () => {
    setLang(language as Lang);
    updateMutation.mutate({ companyName, language });
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      toast.error(t('currentPassword') + ' & ' + t('newPassword'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Min 6 symbols');
      return;
    }
    try {
      await api.patch('/admins/change-password', { oldPassword, newPassword });
      toast.success(t('changePassword') + ' ✓');
      setOldPassword('');
      setNewPassword('');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('settingsTitle')}</h1>
        <p className="text-muted-foreground">{t('settingsDesc')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#7BBDE8]" />
              {t('company')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('companyName')}</Label>
              <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="EKIDOS TAXI" />
            </div>
            <Button onClick={handleSaveCompany} className="gap-2">
              <Save className="w-4 h-4" />
              {t('saveChanges')}
            </Button>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#7BBDE8]" />
              {t('language')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('language')}</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as Lang)}>
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
            <Button onClick={handleSaveLanguage} className="gap-2">
              <Save className="w-4 h-4" />
              {t('saveChanges')}
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#7BBDE8]" />
              {t('security')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('currentPassword')}</Label>
              <Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('newPassword')}</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <Button variant="outline" className="gap-2" onClick={handleChangePassword}>
              <Lock className="w-4 h-4" />
              {t('changePassword')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
