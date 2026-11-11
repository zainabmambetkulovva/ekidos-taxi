'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Loader2, Search, Plus, Minus, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/axios';
import { useTx } from '@/lib/tx';
import { toast } from 'sonner';

type Mode = 'topup' | 'withdraw';

export default function BalancePage() {
  const queryClient = useQueryClient();
  const tx = useTx();

  // Dialog state: толуктоо же баланстан алуу
  const [mode, setMode] = useState<Mode>('topup');
  const [showDialog, setShowDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [directAmount, setDirectAmount] = useState('');
  const [searching, setSearching] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const isWithdraw = mode === 'withdraw';

  // Archive of approved topups / withdrawals
  const { data: requests } = useQuery({
    queryKey: ['topup-requests'],
    queryFn: async () => {
      const { data } = await api.get('/topup');
      return data;
    },
    refetchInterval: 30000,
  });

  const resetDialog = () => {
    setSelectedDriver(null);
    setDirectAmount('');
    setSearchQuery('');
    setSearchResults([]);
    setConfirmWithdraw(false);
  };

  const openDialog = (m: Mode) => {
    setMode(m);
    resetDialog();
    setShowDialog(true);
  };

  const balanceMutation = useMutation({
    mutationFn: async ({ driverId, amount, kind }: { driverId: string; amount: number; kind: Mode }) => {
      const url = kind === 'withdraw' ? `/drivers/${driverId}/balance-withdraw` : `/drivers/${driverId}/balance`;
      const { data } = await api.patch(url, { amount });
      return { ...data, kind };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['topup-requests'] });
      setShowDialog(false);
      resetDialog();
      const who = `${data.driverName}${data.callsign ? ` (${data.callsign})` : ''}`;
      if (data.kind === 'withdraw') {
        toast.success(tx(
          `${who} — снято ${data.amount} сом. Баланс: ${data.newBalance} сом`,
          `${who} — ${data.amount} сом алынды. Баланс: ${data.newBalance} сом`,
          `${who} — ${data.amount} som withdrawn. Balance: ${data.newBalance} som`,
        ));
      } else {
        toast.success(`✅ ${who} — +${data.amount} ${tx('сом', 'сом', 'som')}. ${tx('Баланс', 'Баланс', 'Balance')}: ${data.newBalance}`);
      }
    },
    onError: (error: any) => {
      setConfirmWithdraw(false);
      toast.error(error.response?.data?.error || tx('Ошибка', 'Ката', 'Error'));
    },
  });

  const handleSubmit = () => {
    const num = parseFloat(directAmount);
    if (!num || num <= 0) { toast.error(tx('Введите сумму правильно', 'Сумманы туура жазыңыз', 'Enter a valid amount')); return; }
    if (!selectedDriver) { toast.error(tx('Выберите водителя', 'Айдоочуну тандаңыз', 'Select a driver')); return; }
    if (isWithdraw) {
      const current = selectedDriver.balance || 0;
      if (num > current) {
        toast.error(tx(
          `На балансе только ${current} сом`,
          `Балансында болгону ${current} сом бар`,
          `Balance is only ${current} som`,
        ));
        return;
      }
      // Баланстан алуу — бир жолу ырастоо керек
      if (!confirmWithdraw) { setConfirmWithdraw(true); return; }
    }
    balanceMutation.mutate({ driverId: selectedDriver.id, amount: num, kind: mode });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length === 0) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/drivers/search/callsign?q=${encodeURIComponent(query.trim())}`);
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const archive = (requests || []).filter((r: any) => r.status === 'APPROVED');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-green-400" />
            {tx('Баланс', 'Баланс', 'Balance')}
          </h1>
          <p className="text-muted-foreground">
            {tx('Пополнение и списание баланса водителя', 'Айдоочунун балансын толуктоо жана баланстан алуу', "Top up or withdraw a driver's balance")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => openDialog('withdraw')}
            variant="outline"
            className="border-orange-500/60 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 font-bold text-base px-6 py-3 h-12"
          >
            <Minus className="w-5 h-5 mr-2" />
            {tx('Снять с баланса', 'Баланстан алуу', 'Withdraw')}
          </Button>
          <Button
            onClick={() => openDialog('topup')}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-base px-6 py-3 h-12 shadow-lg shadow-red-600/30"
          >
            <Plus className="w-5 h-5 mr-2" />
            {tx('Пополнить баланс', 'Баланс толуктоо', 'Top up')}
          </Button>
        </div>
      </div>

      {/* Archive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#7BBDE8]" />
            {tx('Архив', 'Архив', 'History')} ({archive.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {archive.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">{tx('Архив пуст', 'Архив бош', 'No history yet')}</p>
          ) : (
            <div className="space-y-2">
              {archive.slice(0, 30).map((req: any) => {
                const withdrawn = (req.amount || 0) < 0;
                return (
                  <div key={req.id} className={`flex items-center justify-between p-3 rounded-xl ${withdrawn ? 'bg-orange-500/10' : 'bg-white/5'}`}>
                    <div>
                      <p className="font-medium text-sm">{req.driverName || (req.driver ? `${req.driver.firstName} ${req.driver.lastName}` : '')}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.createdAt).toLocaleString('ru-RU')}
                        {withdrawn && ` · ${tx('Снято админом', 'Админ тарабынан алынды', 'Withdrawn by admin')}`}
                      </p>
                    </div>
                    {withdrawn ? (
                      <Badge className="border-transparent bg-orange-500/20 text-orange-400">{req.amount} {tx('сом', 'сом', 'som')}</Badge>
                    ) : (
                      <Badge variant="success">+{req.amount} {tx('сом', 'сом', 'som')}</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Topup / Withdraw Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) setConfirmWithdraw(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isWithdraw ? 'text-orange-400' : 'text-red-500'}`}>
              {isWithdraw ? <Minus className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
              {isWithdraw ? tx('Снять с баланса', 'Баланстан алуу', 'Withdraw from balance') : tx('Пополнить баланс', 'Баланс толуктоо', 'Top up balance')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{tx('Поиск по позывному', 'Позывной менен издөө', 'Search by callsign')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder={tx('Введите позывной... (напр.: 003)', 'Позывной жазыңыз... (мис: 003)', 'Type a callsign... (e.g. 003)')}
                  className="pl-10 h-12 text-lg"
                  autoFocus
                />
              </div>
            </div>

            {searching && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searching && searchResults.length > 0 && !selectedDriver && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((driver: any) => (
                  <button
                    key={driver.id}
                    onClick={() => { setSelectedDriver(driver); setConfirmWithdraw(false); }}
                    className={`w-full text-left p-3 rounded-xl border border-border transition-all flex items-center justify-between ${
                      isWithdraw ? 'hover:border-orange-500/50 hover:bg-orange-500/5' : 'hover:border-green-500/50 hover:bg-green-500/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-green-400">{driver.callsign || '?'}</span>
                      </div>
                      <div>
                        <p className="font-medium">{driver.firstName} {driver.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx('Позывной', 'Позывной', 'Callsign')}: <span className="font-bold text-green-400">{driver.callsign || '—'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">{driver.balance || 0} {tx('сом', 'сом', 'som')}</p>
                      <p className="text-[10px] text-muted-foreground">{tx('баланс', 'баланс', 'balance')}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">{tx('Водитель не найден', 'Айдоочу табылган жок', 'Driver not found')}</p>
            )}

            {selectedDriver && (
              <div className="space-y-4">
                <div className={`rounded-xl p-4 border ${isWithdraw ? 'bg-orange-500/10 border-orange-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">{selectedDriver.firstName} {selectedDriver.lastName}</p>
                      <p className="text-sm text-muted-foreground">
                        {tx('Позывной', 'Позывной', 'Callsign')}: <span className="font-bold text-green-400">{selectedDriver.callsign || '—'}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-400">{selectedDriver.balance || 0}</p>
                      <p className="text-xs text-muted-foreground">{tx('текущий баланс', 'учурдагы баланс', 'current balance')}</p>
                    </div>
                  </div>
                  <button onClick={() => { setSelectedDriver(null); setConfirmWithdraw(false); }} className="mt-2 text-xs text-red-400 hover:text-red-300">
                    ✕ {tx('Выбрать другого водителя', 'Башка айдоочу тандоо', 'Choose another driver')}
                  </button>
                </div>

                <div className="space-y-2">
                  <Label>
                    {isWithdraw
                      ? tx('Сколько сом снять?', 'Канча сом алуу керек?', 'How much to withdraw?')
                      : tx('Сколько сом пополнить?', 'Канча сом толуктоо?', 'How much to add?')}
                  </Label>
                  <Input
                    type="number"
                    value={directAmount}
                    onChange={(e) => { setDirectAmount(e.target.value); setConfirmWithdraw(false); }}
                    placeholder={isWithdraw ? '50' : '500'}
                    min="1"
                    className="text-2xl font-bold h-14 text-center"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {(isWithdraw ? [12, 50, 100, 200] : [100, 150, 300, 500]).map(amt => (
                    <button
                      key={amt}
                      onClick={() => { setDirectAmount(amt.toString()); setConfirmWithdraw(false); }}
                      className={`py-2 rounded-lg border text-sm font-bold transition-all ${
                        directAmount === amt.toString()
                          ? (isWithdraw ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-green-500 bg-green-500/10 text-green-400')
                          : (isWithdraw ? 'border-border hover:border-orange-500/50 text-muted-foreground' : 'border-border hover:border-green-500/50 text-muted-foreground')
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>

                {isWithdraw && confirmWithdraw && (
                  <p className="text-sm text-center text-orange-300 bg-orange-500/10 border border-orange-500/30 rounded-lg p-2">
                    {tx(
                      `Точно снять ${directAmount} сом у ${selectedDriver.firstName}? Нажмите ещё раз для подтверждения.`,
                      `${selectedDriver.firstName} айдоочунун балансынан ${directAmount} сом чын эле алынсынбы? Ырастоо үчүн дагы бир жолу басыңыз.`,
                      `Withdraw ${directAmount} som from ${selectedDriver.firstName}? Press again to confirm.`,
                    )}
                  </p>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={balanceMutation.isPending}
                  className={`w-full h-14 text-lg font-bold ${isWithdraw ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  {balanceMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isWithdraw ? (
                    confirmWithdraw
                      ? `✔ ${tx('Подтвердить', 'Ырастоо', 'Confirm')}: −${directAmount} ${tx('сом', 'сом', 'som')}`
                      : `➖ ${tx('Снять', 'Баланстан алуу', 'Withdraw')}${directAmount ? ` — ${directAmount} ${tx('сом', 'сом', 'som')}` : ''}`
                  ) : (
                    `💰 ${tx('Пополнить', 'Толуктоо', 'Top up')}${directAmount ? ` — ${directAmount} ${tx('сом', 'сом', 'som')}` : ''}`
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
