'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, ShoppingCart, Users, Car, UsersRound,
  Phone, MapPin, Calendar, Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useLanguageStore } from '@/store/useLanguageStore';
import { getClientDisplayName } from '@/lib/display-names';

type TabType = 'orders' | 'drivers' | 'clients';

export default function TablesPage() {
  const { t } = useLanguageStore();
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['table-orders', search],
    queryFn: async () => {
      const { data } = await api.get('/orders', { params: { search, limit: 100 } });
      return data;
    },
    enabled: activeTab === 'orders',
  });

  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ['table-drivers', search],
    queryFn: async () => {
      const { data } = await api.get('/drivers', { params: { search, limit: 100 } });
      return data;
    },
    enabled: activeTab === 'drivers',
    refetchInterval: 10000,
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['table-clients', search],
    queryFn: async () => {
      const { data } = await api.get('/clients', { params: { search, limit: 100 } });
      return data;
    },
    enabled: activeTab === 'clients',
    refetchInterval: 10000,
  });

  const tabs = [
    { id: 'orders' as TabType, label: t('todayOrders').split(' ')[0] || 'Заказы', icon: ShoppingCart },
    { id: 'drivers' as TabType, label: t('drivers'), icon: Car },
    { id: 'clients' as TabType, label: t('totalClients').replace('Всего ', '').replace('Бардык ', '') || 'Клиенты', icon: UsersRound },
  ];

  const getStatusBadge = (status: string) => {
    const map: Record<string, any> = {
      PENDING: <Badge variant="warning">{t('pending')}</Badge>,
      ASSIGNED: <Badge variant="info">{t('assigned')}</Badge>,
      IN_PROGRESS: <Badge variant="info">{t('inProgress')}</Badge>,
      COMPLETED: <Badge variant="success">{t('completed')}</Badge>,
      CANCELLED: <Badge variant="destructive">{t('cancelled')}</Badge>,
      ONLINE: <Badge variant="success">{t('online')}</Badge>,
      BUSY: <Badge variant="warning">{t('busy')}</Badge>,
      OFFLINE: <Badge variant="secondary">{t('offline')}</Badge>,
      ACTIVE: <Badge variant="success">{t('active')}</Badge>,
      BLOCKED: <Badge variant="destructive">{t('blocked')}</Badge>,
    };
    return map[status] || <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden">
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('tables')}</h1>
        <p className="text-muted-foreground">{t('viewTables')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-3">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => { setActiveTab(tab.id); setSearch(''); setPage(1); }}
            className="gap-2"
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Orders Table */}
      {activeTab === 'orders' && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">№</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('client')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('pickup')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('destination')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('driver')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('status')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={8} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
                    ))
                  ) : (
                    ordersData?.orders?.slice(0, page * PER_PAGE).map((order: any) => (
                      <tr key={order.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono text-sm text-red-400">{order.orderNumber}</td>
                        <td className="p-4">
                          <div>
                            <p className="text-sm font-medium">{getClientDisplayName(order.id)}</p>
                            <p className="text-xs text-muted-foreground">{order.clientPhone}</p>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground max-w-[150px] truncate">{order.pickupAddress}</td>
                        <td className="p-4 text-sm text-muted-foreground max-w-[150px] truncate">{order.destAddress}</td>
                        <td className="p-4 text-sm">{order.driver ? `${order.driver.firstName} ${order.driver.lastName}` : '—'}</td>
                        <td className="p-4">{getStatusBadge(order.status)}</td>
                        <td className="p-4 text-xs text-muted-foreground">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {ordersData?.orders?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">{t('noOrdersYet')}</div>
              )}
              {ordersData?.orders && ordersData.orders.length > page * PER_PAGE && (
                <div className="text-center py-4 border-t border-border">
                  <button
                    onClick={() => setPage(p => p + 1)}
                    className="text-sm font-medium text-[#7BBDE8] hover:text-white transition-colors"
                  >
                    Дальше →
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drivers Table */}
      {activeTab === 'drivers' && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('driver')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('phone')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('vehicle')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('plateNumber')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('status')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('online')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('orders')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('income')}</th>
                  </tr>
                </thead>
                <tbody>
                  {driversLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={8} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
                    ))
                  ) : (
                    driversData?.drivers?.map((driver: any) => (
                      <tr key={driver.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-medium text-sm">{driver.firstName} {driver.lastName}</td>
                        <td className="p-4 text-sm text-muted-foreground">{driver.phone}</td>
                        <td className="p-4 text-sm">{driver.vehicle ? `${driver.vehicle.brand} ${driver.vehicle.model}` : '—'}</td>
                        <td className="p-4 text-sm font-mono">{driver.vehicle?.plateNumber || '—'}</td>
                        <td className="p-4">{getStatusBadge(driver.accountStatus)}</td>
                        <td className="p-4">{getStatusBadge(driver.status)}</td>
                        <td className="p-4 text-sm">{driver.totalOrders}</td>
                        <td className="p-4 text-sm text-[#7BBDE8]">{formatCurrency(driver.totalEarnings)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {driversData?.drivers?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">{t('noDriversFound')}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients Table */}
      {activeTab === 'clients' && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('client')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('phone')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('totalOrders')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('destination')}</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">{t('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={5} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
                    ))
                  ) : (
                    clientsData?.clients?.map((client: any) => (
                      <tr key={client.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-medium text-sm">{getClientDisplayName(client.id)}</td>
                        <td className="p-4 text-sm text-muted-foreground">{client.phone}</td>
                        <td className="p-4 text-sm">{client.totalOrders}</td>
                        <td className="p-4 text-sm text-muted-foreground">{client.favoriteAddress || '—'}</td>
                        <td className="p-4 text-xs text-muted-foreground">{formatDate(client.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {clientsData?.clients?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">{t('noOrdersYet')}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
