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

type TabType = 'orders' | 'drivers' | 'clients';

export default function TablesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('orders');
  const [search, setSearch] = useState('');

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
  });

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['table-clients', search],
    queryFn: async () => {
      const { data } = await api.get('/clients', { params: { search, limit: 100 } });
      return data;
    },
    enabled: activeTab === 'clients',
  });

  const tabs = [
    { id: 'orders' as TabType, label: 'Orders', icon: ShoppingCart },
    { id: 'drivers' as TabType, label: 'Drivers', icon: Car },
    { id: 'clients' as TabType, label: 'Clients', icon: UsersRound },
  ];

  const getStatusBadge = (status: string) => {
    const map: Record<string, any> = {
      PENDING: <Badge variant="warning">Pending</Badge>,
      ASSIGNED: <Badge variant="info">Assigned</Badge>,
      IN_PROGRESS: <Badge variant="info">In Progress</Badge>,
      COMPLETED: <Badge variant="success">Completed</Badge>,
      CANCELLED: <Badge variant="destructive">Cancelled</Badge>,
      ONLINE: <Badge variant="success">Online</Badge>,
      BUSY: <Badge variant="warning">Busy</Badge>,
      OFFLINE: <Badge variant="secondary">Offline</Badge>,
      ACTIVE: <Badge variant="success">Active</Badge>,
      BLOCKED: <Badge variant="destructive">Blocked</Badge>,
    };
    return map[status] || <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden">
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Таблицы</h1>
        <p className="text-muted-foreground">Просмотр данных в таблицах</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-3">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            onClick={() => { setActiveTab(tab.id); setSearch(''); }}
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
          placeholder="Search..."
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
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Order</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Pickup</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Destination</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Driver</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Tariff</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ordersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={8} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
                    ))
                  ) : (
                    ordersData?.orders?.map((order: any) => (
                      <tr key={order.id} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono text-sm text-red-400">{order.orderNumber}</td>
                        <td className="p-4">
                          <div>
                            <p className="text-sm font-medium">{order.clientName}</p>
                            <p className="text-xs text-muted-foreground">{order.clientPhone}</p>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground max-w-[150px] truncate">{order.pickupAddress}</td>
                        <td className="p-4 text-sm text-muted-foreground max-w-[150px] truncate">{order.destAddress}</td>
                        <td className="p-4 text-sm">{order.driver ? `${order.driver.firstName} ${order.driver.lastName}` : '—'}</td>
                        <td className="p-4 text-sm">{order.tariff}</td>
                        <td className="p-4">{getStatusBadge(order.status)}</td>
                        <td className="p-4 text-xs text-muted-foreground">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {ordersData?.orders?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No orders found</div>
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
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Driver</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Phone</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Vehicle</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Plate</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Online</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Orders</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Income</th>
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
                        <td className="p-4 text-sm text-green-400">{formatCurrency(driver.totalEarnings)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {driversData?.drivers?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">No drivers found</div>
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
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Client</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Phone</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Total Orders</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Favorite Address</th>
                    <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Registered</th>
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
                        <td className="p-4 font-medium text-sm">{client.name}</td>
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
                <div className="text-center py-12 text-muted-foreground">No clients found</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}


