'use client';

import { useState } from 'react';
import { Wallet, ArrowUpRight, Clock, CreditCard, Banknote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const transactions = [
  { id: '1', type: 'income', title: 'Заказ #EK2607-1234', amount: 250, date: '04.07.2026 10:30' },
  { id: '2', type: 'income', title: 'Заказ #EK2607-5678', amount: 800, date: '04.07.2026 09:15' },
  { id: '3', type: 'withdraw', title: 'Вывод на карту', amount: -1000, date: '03.07.2026 18:00' },
  { id: '4', type: 'income', title: 'Заказ #EK2607-3456', amount: 180, date: '03.07.2026 14:20' },
];

export default function WalletPage() {
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const balance = 12500;

  const handleWithdraw = () => {
    toast.success('Заявка на вывод отправлена. Средства поступят в течение 24 часов.');
    setShowWithdraw(false);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Кошелёк</h2>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-red-600/20 via-red-900/10 to-black border-red-500/20 shadow-xl shadow-red-500/5">
        <CardContent className="p-6 text-center">
          <Wallet className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Доступный баланс</p>
          <p className="text-4xl font-black mt-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            {balance.toLocaleString()} сом
          </p>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={() => setShowWithdraw(!showWithdraw)}
          className="h-16 rounded-2xl bg-green-600 hover:bg-green-700 flex-col gap-1"
        >
          <ArrowUpRight className="w-6 h-6" />
          <span className="text-xs">Вывести</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowHistory(!showHistory)}
          className="h-16 rounded-2xl flex-col gap-1 border-white/10"
        >
          <Clock className="w-6 h-6 text-blue-400" />
          <span className="text-xs">История</span>
        </Button>
      </div>

      {/* Withdraw form */}
      {showWithdraw && (
        <Card className="border-green-500/20">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Вывод средств</h3>
            <div className="space-y-2">
              <input
                type="number"
                placeholder="Сумма вывода"
                className="w-full h-12 rounded-xl bg-white/5 border border-border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <input
                type="text"
                placeholder="Номер карты или Mbank"
                className="w-full h-12 rounded-xl bg-white/5 border border-border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <Button onClick={handleWithdraw} className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700">
              Подтвердить вывод
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      {showHistory && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">История операций</h3>
          {transactions.map((tx) => (
            <Card key={tx.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    tx.type === 'income' ? 'bg-green-500/10' : 'bg-orange-500/10'
                  }`}>
                    {tx.type === 'income' ? (
                      <Banknote className="w-5 h-5 text-green-400" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-orange-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{tx.title}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-orange-400'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount} сом
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!showHistory && !showWithdraw && (
        <p className="text-center text-xs text-muted-foreground pt-4">
          Нажмите "Вывести" или "История" для действий
        </p>
      )}
    </div>
  );
}
