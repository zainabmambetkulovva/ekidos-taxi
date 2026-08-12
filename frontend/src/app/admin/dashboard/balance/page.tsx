'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wallet, CheckCircle2, XCircle, Clock, User, Loader2, Search, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/axios';
import { toast } from 'sonner';
import { useLanguageStore } from '@/store/useLanguageStore';

export default function BalancePage() {
  const queryClient = useQueryClient();
  const { t } = useLanguageStore();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [amount, setAmount] = useState('');

  // Direct topup state
  const [showDirectTopup, setShowDirectTopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [directAmount, setDirectAmount] = useState('');
  const [searching, setSearching] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['topup-requests'],
    queryFn: async () => {
      const { data } = await api.get('/topup');
      return data;
    },
    refetchInterval: 10000,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const { data } = await api.patch(`/topup/${id}/approve`, { amount });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['topup-requests'] });
      setSelectedRequest(null);
      setAmount('');
      toast.success(`✅ ${data.driverName} — +${data.amount} сом. Баланс: ${data.newBalance} сом`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Ошибка');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/topup/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topup-requests'] });
      toast('Запрос отклонён');
    },
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

  const handleApprove = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      toast.error('Сумманы туура жазыңыз');
      return;
    }
    approveMutation.mutate({ id: selectedRequest.id, amount: num });
  };

  const handleDirectTopup = () => {
    const num = parseFloat(directAmount);
    if (!num || num <= 0) {
      toast.error('Сумманы туура жазыңыз');
      return;
    }
    if (!selectedDriver) {
      toast.error('Айдоочуну тандаңыз');
      return;
    }
    directTopupMutation.mutate({ driverId: selectedDriver.id, amount: num });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }
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

  const pendingRequests = requests?.filter((r: any) => r.status === 'PENDING') || [];
  const processedRequests = requests?.filter((r: any) => r.status !== 'PENDING') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-green-400" />
            Баланс толуктоо
          </h1>
          <p className="text-muted-foreground">Айдоочулардын баланс запростору</p>
        </div>

        {/* RED BUTTON - Direct topup */}
        <Button
          onClick={() => { setShowDirectTopup(true); setSelectedDriver(null); setDirectAmount(''); setSearchQuery(''); setSearchResults([]); }}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-base px-6 py-3 h-12 shadow-lg shadow-red-600/30"
        >
          <Plus className="w-5 h-5 mr-2" />
          Баланс толуктоо
        </Button>
      </div>

      {/* Pending Requests */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-400" />
          Күтүүдөгү запростор ({pendingRequests.length})
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : pendingRequests.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-400/30 mx-auto mb-1" />
              <p className="text-muted-foreground text-sm">Жаңы запрос жок</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req: any, index: number) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border-yellow-500/30 hover:border-yellow-500/50 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-yellow-400" />
                        </div>
                        <div>
                          <p className="font-semibold">{req.driverName}</p>
                          <p className="text-sm text-muted-foreground">
                            {req.driver?.phone || `TG: ${req.telegramId}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(req.createdAt).toLocaleString('ru-RU')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="lg"
                          className="bg-green-600 hover:bg-green-700 text-white font-bold"
                          onClick={() => { setSelectedRequest(req); setAmount(''); }}
                        >
                          💰 Баланс толуктоо
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => rejectMutation.mutate(req.id)}
                        >
                          <XCircle className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Тарых</h2>
          <div className="space-y-2">
            {processedRequests.slice(0, 20).map((req: any) => (
              <Card key={req.id} className="opacity-60">
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{req.driverName}</span>
                    {req.status === 'APPROVED' && (
                      <Badge variant="success">+{req.amount} сом</Badge>
                    )}
                    {req.status === 'REJECTED' && (
                      <Badge variant="destructive">Четке кагылды</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(req.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Approve Dialog (from topup requests) */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Баланс толуктоо</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="bg-muted rounded-xl p-4">
                <p className="font-semibold text-lg">{selectedRequest.driverName}</p>
                <p className="text-sm text-muted-foreground">{selectedRequest.driver?.phone}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Учурдагы баланс: <span className="font-bold text-green-400">{selectedRequest.driver?.balance || 0} сом</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Канча сом толуктоо?</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  min="1"
                  autoFocus
                  className="text-2xl font-bold h-14 text-center"
                />
              </div>

              <Button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
                className="w-full h-14 text-lg font-bold bg-green-600 hover:bg-green-700"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  `✅ Толуктоо${amount ? ` — ${amount} сом` : ''}`
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Direct Topup Dialog - with search */}
      <Dialog open={showDirectTopup} onOpenChange={setShowDirectTopup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Баланс толуктоо
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search input */}
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

            {/* Search results - driver list */}
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
                        <span className="text-sm font-bold text-green-400">
                          {driver.callsign || '?'}
                        </span>
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
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Айдоочу табылган жок</p>
              </div>
            )}

            {/* Selected driver */}
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
                  <button
                    onClick={() => setSelectedDriver(null)}
                    className="mt-2 text-xs text-red-400 hover:text-red-300"
                  >
                    ✕ Башка айдоочу тандоо
                  </button>
                </div>

                {/* Amount input */}
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

                {/* Quick amount buttons */}
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

                {/* Confirm button */}
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
