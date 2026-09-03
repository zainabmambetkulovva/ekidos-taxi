'use client';

import { useState } from 'react';
import { Bell, Globe, Volume2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useLanguageStore } from '@/store/useLanguageStore';

export default function DriverSettingsPage() {
  const { lang, setLang, t } = useLanguageStore();
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`w-12 h-7 rounded-full transition-colors relative ${value ? 'bg-green-500' : 'bg-muted'}`}
    >
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">{t('settings')}</h2>

      <div className="space-y-3">
        {/* Notifications */}
        <Card className="hover:border-white/20 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {lang === 'ru' ? 'Уведомления' : lang === 'kg' ? 'Билдирмелер' : 'Notifications'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === 'ru' ? 'Push-уведомления о заказах' : lang === 'kg' ? 'Заказ жөнүндө билдирмелер' : 'Order push notifications'}
                </p>
              </div>
            </div>
            <Toggle value={notifications} onChange={() => { setNotifications(!notifications); toast(notifications ? (lang === 'kg' ? 'Өчүрүлдү' : 'Выключено') : (lang === 'kg' ? 'Күйгүзүлдү' : 'Включено')); }} />
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
                <p className="text-sm font-medium">
                  {lang === 'ru' ? 'Звук' : lang === 'kg' ? 'Үн' : 'Sound'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === 'ru' ? 'Звуковое оповещение' : lang === 'kg' ? 'Үндүк эскертме' : 'Sound alert'}
                </p>
              </div>
            </div>
            <Toggle value={sound} onChange={() => { setSound(!sound); toast(sound ? (lang === 'kg' ? 'Үн өчүрүлдү' : 'Звук выключен') : (lang === 'kg' ? 'Үн күйгүзүлдү' : 'Звук включен')); }} />
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
                <p className="text-sm font-medium">{t('language')}</p>
                <p className="text-xs text-muted-foreground">
                  {lang === 'ru' ? 'Язык интерфейса' : lang === 'kg' ? 'Интерфейс тили' : 'Interface language'}
                </p>
              </div>
            </div>
            <select
              value={lang}
              onChange={(e) => {
                setLang(e.target.value as any);
                toast.success(e.target.value === 'kg' ? 'Тил өзгөртүлдү' : e.target.value === 'en' ? 'Language changed' : 'Язык изменён');
              }}
              className="bg-white/5 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            >
              <option value="ru">Русский</option>
              <option value="kg">Кыргызча</option>
              <option value="en">English</option>
            </select>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-4">
        EKIDOS TAXI Driver v1.0.0
      </p>
    </div>
  );
}
