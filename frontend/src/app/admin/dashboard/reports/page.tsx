'use client';

import { useEffect, useState } from 'react';
import { useLanguageStore } from '@/store/useLanguageStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText, Download, Calendar,
  ShoppingCart, XCircle, CheckCircle2,
} from 'lucide-react';
import { connectSocket } from '@/lib/socket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { formatCurrency, formatDate } from '@/lib/utils';

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';
type StatusFilter = 'ALL' | 'COMPLETED' | 'CANCELLED' | 'ACTIVE';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Күтүүдө',
  ASSIGNED: 'Аткарылууда',
  IN_PROGRESS: 'Аткарылууда',
  COMPLETED: 'Бүттү',
  CANCELLED: 'Отмена',
};

// Ким отмена кылды
const CANCELLED_BY_LABEL: Record<string, string> = {
  DISPATCHER: 'Диспетчер отмена кылды',
  CLIENT: 'Клиент отмена кылды',
  DRIVER: 'Водитель отмена кылды',
  SYSTEM: 'Система отмена кылды',
};
const cancelledByLabel = (v?: string | null) => (v && CANCELLED_BY_LABEL[v]) || 'Отмена (ким экени белгисиз)';

const hhmm = (d?: string | null) =>
  d ? new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

const csvCell = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default function ReportsPage() {
  const { t } = useLanguageStore();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', period],
    queryFn: async () => {
      const { data } = await api.get('/reports', { params: { type: period } });
      return data;
    },
    refetchInterval: 30000,
  });

  // Заказ түзүлсө / бүтсө / отмена болсо — отчёт дароо жаңырат
  useEffect(() => {
    const socket = connectSocket();
    socket.emit('admin:join', 'reports');
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: ['report'] });
      }, 500);
    };
    const events = ['order:new', 'order:accepted', 'order:completed', 'order:cancelled', 'order:status-changed'];
    events.forEach(e => socket.on(e, refresh));
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(e => socket.off(e, refresh));
    };
  }, [queryClient]);

  const allOrders: any[] = report?.orders || [];
  const visibleOrders = allOrders.filter(o =>
    statusFilter === 'ALL' ? true
    : statusFilter === 'ACTIVE' ? (o.status === 'PENDING' || o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS')
    : o.status === statusFilter
  );
  const cb = report?.cancelledBy || {};

  const periods: { id: PeriodType; label: string }[] = [
    { id: 'daily', label: t('daily') },
    { id: 'weekly', label: t('weekly') },
    { id: 'monthly', label: t('monthly') },
    { id: 'yearly', label: t('yearly') },
  ];

  const exportData = (format: string) => {
    // Simple CSV export
    if (format === 'csv' && report?.orders) {
      const headers = 'Заказ,Телефон,Адрес подачи,Адрес назначения,Позывной,Водитель,Статус,Ким отмена кылды,Баа,Түзүлдү,Бүттү/Отмена\n';
      const rows = report.orders.map((o: any) => [
        o.orderNumber,
        o.clientPhone,
        o.pickupAddress,
        o.destAddress,
        o.driver?.callsign || '',
        o.driver ? `${o.driver.firstName} ${o.driver.lastName}` : '',
        STATUS_LABEL[o.status] || o.status,
        o.status === 'CANCELLED' ? cancelledByLabel(o.cancelledBy) : '',
        o.price,
        formatDate(o.createdAt),
        formatDate(o.completedAt || o.cancelledAt),
      ].map(csvCell).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + headers + rows], { type: 'text/csv;charset=utf-8' });
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
          <h1 className="text-2xl font-bold">{t('reports')}</h1>
          <p className="text-muted-foreground">{t('generateReports')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData('csv')} className="gap-2">
            <Download className="w-4 h-4" />
            {t("exportCsv")}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{t("totalOrders")}</p>
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
                  <p className="text-xs text-muted-foreground">{t("completedOrders")}</p>
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
                  <p className="text-xs text-muted-foreground">{t("cancelledOrders")}</p>
                  <p className="text-2xl font-bold mt-1 text-red-400">{report?.cancelledOrders || 0}</p>
                  {(report?.cancelledOrders || 0) > 0 && (
                    <div className="mt-1 space-y-0.5 text-xs text-red-300/80">
                      {cb.DISPATCHER > 0 && <p>Диспетчер: {cb.DISPATCHER}</p>}
                      {cb.CLIENT > 0 && <p>Клиент: {cb.CLIENT}</p>}
                      {cb.DRIVER > 0 && <p>Водитель: {cb.DRIVER}</p>}
                      {cb.SYSTEM > 0 && <p>Система: {cb.SYSTEM}</p>}
                      {cb.UNKNOWN > 0 && <p>Белгисиз: {cb.UNKNOWN}</p>}
                    </div>
                  )}
                </div>
                <XCircle className="w-8 h-8 text-red-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Table */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t(period)} {t('reports')}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {([
              ['ALL', `Баары (${allOrders.length})`],
              ['COMPLETED', `Бүттү (${report?.completedOrders || 0})`],
              ['CANCELLED', `Отмена (${report?.cancelledOrders || 0})`],
              ['ACTIVE', 'Активдүү'],
            ] as [StatusFilter, string][]).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={statusFilter === key ? 'default' : 'outline'}
                className={key === 'CANCELLED' && statusFilter !== key ? 'border-red-500/40 text-red-400' : ''}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">№</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Адрес</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Телефон</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">{t('driver')}</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">{t('status')}</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Түзүлдү</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Бүттү / Отмена</th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order: any) => {
                  const cancelled = order.status === 'CANCELLED';
                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-border/50 ${cancelled ? 'bg-red-500/10 hover:bg-red-500/15' : 'hover:bg-white/5'}`}
                    >
                      <td className="p-3 font-mono text-sm text-red-400 whitespace-nowrap">{order.orderNumber}</td>
                      <td className="p-3 text-sm max-w-[240px]">
                        <p className={`truncate ${cancelled ? 'line-through text-muted-foreground' : ''}`} title={order.pickupAddress}>{order.pickupAddress}</p>
                        {order.destAddress && order.destAddress !== 'Не указано' && (
                          <p className="truncate text-xs text-muted-foreground" title={order.destAddress}>→ {order.destAddress}</p>
                        )}
                      </td>
                      <td className="p-3 text-sm font-mono whitespace-nowrap">{order.clientPhone}</td>
                      <td className="p-3 text-sm whitespace-nowrap">
                        {order.driver ? (
                          <>
                            {order.driver.callsign && <span className="font-mono font-bold mr-1.5">{order.driver.callsign}</span>}
                            {order.driver.firstName} {order.driver.lastName}
                          </>
                        ) : '—'}
                      </td>
                      <td className="p-3">
                        <Badge variant={order.status === 'COMPLETED' ? 'success' : cancelled ? 'destructive' : 'secondary'}>
                          {STATUS_LABEL[order.status] || order.status}
                        </Badge>
                        {cancelled && (
                          <p className="mt-1 text-xs font-semibold text-red-400 whitespace-nowrap">
                            <XCircle className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                            {cancelledByLabel(order.cancelledBy)}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(order.createdAt)}</td>
                      <td className={`p-3 text-xs whitespace-nowrap ${cancelled ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {cancelled ? hhmm(order.cancelledAt) : hhmm(order.completedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleOrders.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Бул мөөнөттө заказ жок</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
