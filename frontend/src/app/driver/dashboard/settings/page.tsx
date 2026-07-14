'use client';

import { useState } from 'react';
import { Bell, Globe, Moon, Shield, Smartphone, Volume2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function DriverSettingsPage() {
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [language, setLanguage] = useState('ru');
  const [theme, setTheme] = useState('dark');

  const toggleNotifications = () => {
    setNotifications(!notifications);
    toast(notifications ? 'Уведомления выключены' : 'Уведомления включены');
  };

  const toggleSound = () => {
    setSound(!sound);
    toast(sound ? 'Звук выключен' : 'Звук включен');
  };

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`w-12 h-7 rounded-full transition-colors relative ${value ? 'bg-green-500' : 'bg-muted'}`}
    >
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
        value ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  );

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Настройки</h2>

      <div className="space-y-3">
        {/* Notifications */}
        <Card className="hover:border-white/20 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Уведомления</p>
                <p className="text-xs text-muted-foreground">Push-уведомления о заказах</p>
              </div>
            </div>
            <Toggle value={notifications} onChange={toggleNotifications} />
          </CardContent>
        </Card>

        {/* Sound */}
        <Card className="hover:border-white/20 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Звук</p>
                <p className="text-xs text-muted-foreground">Звуковое оповещение</p>
              </div>
            </div>
            <Toggle value={sound} onChange={toggleSound} />
          </CardContent>
        </Card>

        {/* Language */}
        <Card className="hover:border-white/20 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Язык</p>
                <p className="text-xs text-muted-foreground">Язык интерфейса</p>
              </div>
            </div>
            <select
              value={language}
              onChange={(e) => { setLanguage(e.target.value); toast.success('Язык изменён'); }}
              className="bg-white/5 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="ru">Русский</option>
              <option value="kg">Кыргызча</option>
              <option value="en">English</option>
            </select>
          </CardContent>
        </Card>

        {/* Theme */}
        <Card className="hover:border-white/20 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Moon className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Тема</p>
                <p className="text-xs text-muted-foreground">Оформление приложения</p>
              </div>
            </div>
            <select
              value={theme}
              onChange={(e) => { setTheme(e.target.value); toast.success('Тема изменена'); }}
              className="bg-white/5 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="dark">Тёмная</option>
              <option value="light">Светлая</option>
            </select>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="hover:border-white/20 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Безопасность</p>
                <p className="text-xs text-muted-foreground">OTP аутентификация</p>
              </div>
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-0">Активно</Badge>
          </CardContent>
        </Card>

        {/* Device */}
        <Card className="hover:border-white/20 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Устройство</p>
                <p className="text-xs text-muted-foreground">Текущая сессия</p>
              </div>
            </div>
            <Badge className="bg-blue-500/20 text-blue-400 border-0">Активно</Badge>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-4">
        EKIDOS TAXI Driver v1.0.0
      </p>
    </div>
  );
}
