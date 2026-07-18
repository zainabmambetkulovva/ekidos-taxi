'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Wallet, CheckCircle2, XCircle, Clock, User, Loader2 } from 'lucide-react';
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

  const handleApprove = () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      toast.error('Сумманы туура жазыңыз');
      return;
    }
    approveMutation.mutate({ id: selectedRequest.id, amount: num });
  };

  const pendingRequests = requests?.filter((r: any) => r.status === 'PENDING') || [];
  const processedRequests = requests?.filter((r: any) => r.status !== 'PENDING') || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6 text-green-400" />
          Баланс толуктоо
        </h1>
        <p className="text-muted-foreground">Айдоочулардын баланс запростору</p>
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
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-400/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Жаңы запрос жок</p>
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

      {/* Approve Dialog */}
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
    </div>
  );
}
