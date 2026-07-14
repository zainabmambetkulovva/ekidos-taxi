'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText, Download, Calendar, DollarSign,
  ShoppingCart, XCircle, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { formatCurrency, formatDate } from '@/lib/utils';

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function ReportsPage() {
  const [period, setPeriod] = useState<PeriodType>('daily');

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', period],
    queryFn: async () => {
      const { data } = await api.get('/reports', { params: { type: period } });
      return data;
    },
  });

  const periods: { id: PeriodType; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
  ];

  const exportData = (format: string) => {
    // Simple CSV export
    if (format === 'csv' && report?.orders) {
      const headers = 'Order,Client,Phone,Pickup,Destination,Status,Price,Date\n';
      const rows = report.orders.map((o: any) =>
        `${o.orderNumber},${o.clientName},${o.clientPhone},"${o.pickupAddress}","${o.destAddress}",${o.status},${o.price},${formatDate(o.createdAt)}`
      ).join('\n');
      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Отчёты</h1>
          <p className="text-muted-foreground">Создание и экспорт отчётов</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData('csv')} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {periods.map((p) => (
          <Button
            key={p.id}
            variant={period === p.id ? 'default' : 'outline'}
            onClick={() => setPeriod(p.id)}
            size="sm"
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold mt-1">{report?.totalOrders || 0}</p>
                </div>
                <ShoppingCart className="w-8 h-8 text-blue-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold mt-1 text-green-400">{report?.completedOrders || 0}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{report?.cancelledOrders || 0}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold mt-1 text-green-400">{formatCurrency(report?.revenue || 0)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {period.charAt(0).toUpperCase() + period.slice(1)} Report
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Order</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Driver</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Price</th>
                  <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                </tr>
              </thead>
              <tbody>
                {report?.orders?.map((order: any) => (
                  <tr key={order.id} className="border-b border-border/50 hover:bg-white/5">
                    <td className="p-4 font-mono text-sm text-red-400">{order.orderNumber}</td>
                    <td className="p-4 text-sm">{order.clientName}</td>
                    <td className="p-4 text-sm">{order.driver ? `${order.driver.firstName} ${order.driver.lastName}` : '—'}</td>
                    <td className="p-4">
                      <Badge variant={order.status === 'COMPLETED' ? 'success' : order.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm font-medium">{formatCurrency(order.price)}</td>
                    <td className="p-4 text-xs text-muted-foreground">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!report?.orders || report.orders.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No data for this period</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
