'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, Loader2, Search, Plus, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/axios';
import { toast } from 'sonner';

export default function BalancePage() {
  const queryClient = useQueryClient();

  // Direct topup state
  const [showDirectTopup, setShowDirectTopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [directAmount, setDirectAmount] = useState('');
  const [searching, setSearching] = useState(false);

  // Archive of approved topups
  const { data: requests } = useQuery({
    queryKey: ['topup-requests'],
    queryFn: async () => {
      const { data } = await api.get('/topup');
      return data;
    },
    refetchInterval: 30000,
  });

  const directTopupMutation = useMutation({
    mutationFn: async ({ driverId, amount }: { driverId: string; amount: number }) => {
      const { data } = await api.patch(`/drivers/${driverId}/balance`, { amount });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['topup-requests'] });
      setShowDirectTopup(false);
      setSelectedDriver(null);
      setDirectAmount('');
      setSearchQuery('');
      setSearchResults([]);
      toast.success(`✅ ${data.driverName} (${data.callsign || ''}) — +${data.amount} сом. Баланс: ${data.newBalance} сом`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка');
    },
  });

  const handleDirectTopup = () => {
    const num = parseFloat(directAmount);
    if (!num || num <= 0) { toast.error('Сумманы туура жазыңыз'); return; }
    if (!selectedDriver) { toast.error('Айдоочуну тандаңыз'); return; }
    directTopupMutation.mutate({ driverId: selectedDriver.id, amount: num });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-green-400" />
            Баланс толуктоо
          </h1>
          <p className="text-muted-foreground">Айдоочунун балансын толуктоо</p>
        </div>
        <Button
          onClick={() => { setShowDirectTopup(true); setSelectedDriver(null); setDirectAmount(''); setSearchQuery(''); setSearchResults([]); }}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-base px-6 py-3 h-12 shadow-lg shadow-red-600/30"
        >
          <Plus className="w-5 h-5 mr-2" />
          Баланс толуктоо
        </Button>
      </div>

      {/* Archive */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#7BBDE8]" />
            Архив ({archive.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {archive.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Архив бош</p>
          ) : (
            <div className="space-y-2">
              {archive.slice(0, 30).map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                  <div>
                    <p className="font-medium text-sm">{req.driverName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <Badge variant="success">+{req.amount} сом</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direct Topup Dialog */}
      <Dialog open={showDirectTopup} onOpenChange={setShowDirectTopup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Баланс толуктоо
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Позывной менен издөө</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Позывной жазыңыз... (мис: 003)"
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
                    onClick={() => setSelectedDriver(driver)}
                    className="w-full text-left p-3 rounded-xl border border-border hover:border-green-500/50 hover:bg-green-500/5 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-green-400">{driver.callsign || '?'}</span>
                      </div>
                      <div>
                        <p className="font-medium">{driver.firstName} {driver.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          Позывной: <span className="font-bold text-green-400">{driver.callsign || '—'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">{driver.balance || 0} сом</p>
                      <p className="text-[10px] text-muted-foreground">баланс</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">Айдоочу табылган жок</p>
            )}

            {selectedDriver && (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg">{selectedDriver.firstName} {selectedDriver.lastName}</p>
                      <p className="text-sm text-muted-foreground">
                        Позывной: <span className="font-bold text-green-400">{selectedDriver.callsign || '—'}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-400">{selectedDriver.balance || 0}</p>
                      <p className="text-xs text-muted-foreground">учурдагы баланс</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedDriver(null)} className="mt-2 text-xs text-red-400 hover:text-red-300">
                    ✕ Башка айдоочу тандоо
                  </button>
                </div>

                <div className="space-y-2">
                  <Label>Канча сом толуктоо?</Label>
                  <Input
                    type="number"
                    value={directAmount}
                    onChange={(e) => setDirectAmount(e.target.value)}
                    placeholder="500"
                    min="1"
                    className="text-2xl font-bold h-14 text-center"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[100, 150, 300, 500].map(amt => (
                    <button
                      key={amt}
                      onClick={() => setDirectAmount(amt.toString())}
                      className={`py-2 rounded-lg border text-sm font-bold transition-all ${
                        directAmount === amt.toString()
                          ? 'border-green-500 bg-green-500/10 text-green-400'
                          : 'border-border hover:border-green-500/50 text-muted-foreground'
                      }`}
                    >
                      {amt}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={handleDirectTopup}
                  disabled={directTopupMutation.isPending}
                  className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700"
                >
                  {directTopupMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    `💰 Толуктоо${directAmount ? ` — ${directAmount} сом` : ''}`
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
