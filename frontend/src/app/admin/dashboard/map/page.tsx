'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Maximize2, Minimize2, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';
import { connectSocket } from '@/lib/socket';

// Түстөр: заказда — кызыл, бош — жашыл, занят — оранжевый
const STATUS_COLOR: Record<string, string> = {
  ONLINE: '#22c55e',
  BUSY: '#ef4444',
  BUSY_PERSONAL: '#f97316',
  OFFLINE: '#6b7280',
};
const STATUS_LABEL: Record<string, string> = {
  ONLINE: 'Бош',
  BUSY: 'Заказда',
  BUSY_PERSONAL: 'Занят',
  OFFLINE: 'Оффлайн',
};

const ORDER_STATUS: Record<string, { label: string; row: string; text: string }> = {
  PENDING: { label: 'Күтүүдө', row: 'bg-yellow-500/10 hover:bg-yellow-500/20', text: 'text-yellow-400' },
  ASSIGNED: { label: 'Алынды', row: 'bg-red-500/10 hover:bg-red-500/20', text: 'text-red-400' },
  IN_PROGRESS: { label: 'Жолдо', row: 'bg-red-500/10 hover:bg-red-500/20', text: 'text-red-400' },
  COMPLETED: { label: 'Бүттү', row: 'bg-green-500/10 hover:bg-green-500/20', text: 'text-green-400' },
  CANCELLED: { label: 'Отмена', row: 'bg-white/[0.03] hover:bg-white/[0.06] opacity-60', text: 'text-gray-400' },
};

const FILTERS = [
  { key: 'ALL', label: 'Баары' },
  { key: 'PENDING', label: 'Күтүүдө' },
  { key: 'ACTIVE', label: 'Аткарылууда' },
  { key: 'COMPLETED', label: 'Бүттү' },
  { key: 'CANCELLED', label: 'Отмена' },
];

const hhmm = (d?: string | null) =>
  d ? new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

const minutesBetween = (from?: string | null, to?: string | number | null) => {
  if (!from || !to) return '';
  const m = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));
  return `${m}м`;
};

const callsignLabel = (d: any) =>
  d?.callsign ? String(parseInt(d.callsign, 10) || d.callsign) : (d?.firstName?.[0] || '?');

const escapeHtml = (s: any) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

interface LiveDriver {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  callsign?: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  vehicle?: any;
}

export default function LiveMapPage() {
  const queryClient = useQueryClient();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showOffline, setShowOffline] = useState(false);
  const [fullMap, setFullMap] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [drivers, setDrivers] = useState<Record<string, LiveDriver>>({});

  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const driverMarkersRef = useRef<Record<string, any>>({});
  const orderMarkersRef = useRef<Record<string, any>>({});
  const fittedRef = useRef(false);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: driversData } = useQuery({
    queryKey: ['map-drivers'],
    queryFn: async () => (await api.get('/drivers', { params: { limit: 500 } })).data,
    refetchInterval: 30000,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['map-orders', todayStart],
    queryFn: async () => (await api.get('/orders', { params: { limit: 300, dateFrom: todayStart } })).data,
    refetchInterval: 15000,
  });

  // API'ден келген водительдер — жергиликтүү абалга
  useEffect(() => {
    if (!driversData?.drivers) return;
    const next: Record<string, LiveDriver> = {};
    driversData.drivers.forEach((d: any) => { next[d.id] = d; });
    setDrivers(next);
  }, [driversData]);

  // Убакыт эсептегичтер ("5м") жаңырып турсун
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(iv);
  }, []);

  // Realtime: GPS жана статус — картаны кайра жүктөбөй түз жаңыртабыз
  useEffect(() => {
    const socket = connectSocket();
    const join = () => socket.emit('admin:join', 'map');
    join();
    socket.on('connect', join);

    let ordersTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshOrders = () => {
      if (ordersTimer) return;
      ordersTimer = setTimeout(() => {
        ordersTimer = null;
        queryClient.invalidateQueries({ queryKey: ['map-orders'] });
      }, 300);
    };

    const onLocation = (data: { driverId: string; lat: number; lng: number; status?: string }) => {
      setDrivers(prev => {
        const d = prev[data.driverId];
        if (!d) return prev;
        return { ...prev, [data.driverId]: { ...d, latitude: data.lat, longitude: data.lng, status: data.status || d.status } };
      });
    };
    const onStatus = (data: { driverId: string; status: string }) => {
      setDrivers(prev => {
        const d = prev[data.driverId];
        if (!d || d.status === data.status) return prev;
        return { ...prev, [data.driverId]: { ...d, status: data.status } };
      });
    };
    const onDriverCreated = () => queryClient.invalidateQueries({ queryKey: ['map-drivers'] });

    socket.on('driver:location-updated', onLocation);
    socket.on('driver:status-changed', onStatus);
    socket.on('driver:created', onDriverCreated);
    const orderEvents = ['order:new', 'order:accepted', 'order:completed', 'order:cancelled', 'order:status-changed', 'order:taken'];
    orderEvents.forEach(e => socket.on(e, refreshOrders));

    return () => {
      if (ordersTimer) clearTimeout(ordersTimer);
      socket.off('connect', join);
      socket.off('driver:location-updated', onLocation);
      socket.off('driver:status-changed', onStatus);
      socket.off('driver:created', onDriverCreated);
      orderEvents.forEach(e => socket.off(e, refreshOrders));
    };
  }, [queryClient]);

  // Load Leaflet
  useEffect(() => {
    if (!document.querySelector('link[href*="leaflet@1.9.4"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!(window as any).L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setMapLoaded(true);
      document.head.appendChild(script);
    } else {
      setMapLoaded(true);
    }
  }, []);

  // Картаны БИР ЖОЛУ түзөбүз
  useEffect(() => {
    if (!mapLoaded || !containerRef.current || mapRef.current) return;
    const L = (window as any).L;
    const map = L.map(containerRef.current, { center: [41.8747, 72.9422], zoom: 13, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 300);
    return () => {
      map.remove();
      mapRef.current = null;
      driverMarkersRef.current = {};
      orderMarkersRef.current = {};
      fittedRef.current = false;
    };
  }, [mapLoaded]);

  useEffect(() => {
    setTimeout(() => mapRef.current?.invalidateSize(), 250);
  }, [fullMap]);

  const orders: any[] = ordersData?.orders || [];

  // Водительдин учурдагы заказы (popup үчүн)
  const activeOrderByDriver = useMemo(() => {
    const m: Record<string, any> = {};
    orders.forEach(o => {
      if (o.driverId && (o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS')) m[o.driverId] = o;
    });
    return m;
  }, [orders]);

  // Водитель маркерлерин жаңыртуу (кошуу / жылдыруу / түс / өчүрүү)
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;

    const seen = new Set<string>();
    Object.values(drivers).forEach(d => {
      if (!d.latitude || !d.longitude) return;
      if (d.status === 'OFFLINE' && !showOffline) return;
      seen.add(d.id);

      const color = STATUS_COLOR[d.status] || STATUS_COLOR.OFFLINE;
      const label = escapeHtml(callsignLabel(d));
      const w = Math.max(34, label.length * 10 + 14);
      const html = `<div style="min-width:${w}px;height:30px;background:${color};border-radius:15px;border:2.5px solid #fff;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.45);font:900 12px sans-serif;color:#fff;padding:0 6px;white-space:nowrap">${label}</div>`;
      const order = activeOrderByDriver[d.id];
      const popup =
        `<div style="font-family:sans-serif;min-width:170px">` +
        `<b>${escapeHtml(d.firstName)} ${escapeHtml(d.lastName)}</b>` +
        (d.callsign ? `<br><span style="color:#ef4444;font-weight:700">Позывной: ${escapeHtml(d.callsign)}</span>` : '') +
        (d.phone ? `<br>${escapeHtml(d.phone)}` : '') +
        (d.vehicle ? `<br>${escapeHtml(d.vehicle.brand)} ${escapeHtml(d.vehicle.model)} <b>${escapeHtml(d.vehicle.plateNumber)}</b>` : '') +
        `<br><span style="color:${color};font-weight:700">${STATUS_LABEL[d.status] || d.status}</span>` +
        (order ? `<br><span style="font-size:12px">🚕 ${escapeHtml(order.pickupAddress)} — алды ${hhmm(order.assignedAt)}</span>` : '') +
        `</div>`;

      const existing = driverMarkersRef.current[d.id];
      if (existing) {
        existing.setLatLng([d.latitude, d.longitude]);
        if (existing._ekHtml !== html) {
          existing.setIcon(L.divIcon({ className: '', html, iconSize: [w, 30], iconAnchor: [w / 2, 15] }));
          existing._ekHtml = html;
        }
        existing.setPopupContent(popup);
      } else {
        const marker = L.marker([d.latitude, d.longitude], {
          icon: L.divIcon({ className: '', html, iconSize: [w, 30], iconAnchor: [w / 2, 15] }),
          zIndexOffset: d.status === 'BUSY' ? 500 : 0,
        }).addTo(map).bindPopup(popup);
        marker._ekHtml = html;
        driverMarkersRef.current[d.id] = marker;
      }
    });

    Object.keys(driverMarkersRef.current).forEach(id => {
      if (!seen.has(id)) {
        map.removeLayer(driverMarkersRef.current[id]);
        delete driverMarkersRef.current[id];
      }
    });

    // Биринчи жолу бардык водительдерди көрсөтүү
    if (!fittedRef.current && seen.size > 0) {
      const pts = Array.from(seen).map(id => driverMarkersRef.current[id].getLatLng());
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
      fittedRef.current = true;
    }
  }, [drivers, showOffline, activeOrderByDriver, mapLoaded]);

  // Активдүү заказдардын (координаты бар) маркерлери
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;
    const seen = new Set<string>();
    orders.forEach(o => {
      if (!o.pickupLat || !o.pickupLng) return;
      if (o.status !== 'PENDING' && o.status !== 'ASSIGNED' && o.status !== 'IN_PROGRESS') return;
      seen.add(o.id);
      const color = o.status === 'PENDING' ? '#eab308' : '#ef4444';
      const html = `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px ${color}55"></div>`;
      const popup = `<div style="font-family:sans-serif"><b>#${escapeHtml(o.orderNumber)}</b><br>${escapeHtml(o.pickupAddress)}<br>${ORDER_STATUS[o.status]?.label || o.status}</div>`;
      const existing = orderMarkersRef.current[o.id];
      if (existing) {
        existing.setIcon(L.divIcon({ className: '', html, iconSize: [16, 16], iconAnchor: [8, 8] }));
        existing.setPopupContent(popup);
      } else {
        orderMarkersRef.current[o.id] = L.marker([o.pickupLat, o.pickupLng], {
          icon: L.divIcon({ className: '', html, iconSize: [16, 16], iconAnchor: [8, 8] }),
        }).addTo(map).bindPopup(popup);
      }
    });
    Object.keys(orderMarkersRef.current).forEach(id => {
      if (!seen.has(id)) {
        map.removeLayer(orderMarkersRef.current[id]);
        delete orderMarkersRef.current[id];
      }
    });
  }, [orders, mapLoaded]);

  const focusDriver = useCallback((driverId?: string | null) => {
    if (!driverId) return;
    const marker = driverMarkersRef.current[driverId];
    if (marker && mapRef.current) {
      mapRef.current.setView(marker.getLatLng(), 16, { animate: true });
      marker.openPopup();
    }
  }, []);

  const driverList = Object.values(drivers);
  const counts = {
    ONLINE: driverList.filter(d => d.status === 'ONLINE').length,
    BUSY: driverList.filter(d => d.status === 'BUSY').length,
    BUSY_PERSONAL: driverList.filter(d => d.status === 'BUSY_PERSONAL').length,
    OFFLINE: driverList.filter(d => d.status === 'OFFLINE').length,
  };

  const filteredOrders = orders.filter(o => {
    if (filter === 'PENDING' && o.status !== 'PENDING') return false;
    if (filter === 'ACTIVE' && o.status !== 'ASSIGNED' && o.status !== 'IN_PROGRESS') return false;
    if (filter === 'COMPLETED' && o.status !== 'COMPLETED') return false;
    if (filter === 'CANCELLED' && o.status !== 'CANCELLED') return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${o.orderNumber} ${o.pickupAddress} ${o.destAddress} ${o.clientPhone} ${o.driver?.callsign || ''} ${o.driver?.firstName || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const orderCounts = {
    PENDING: orders.filter(o => o.status === 'PENDING').length,
    ACTIVE: orders.filter(o => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS').length,
    COMPLETED: orders.filter(o => o.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Карта</h1>
          <p className="text-muted-foreground text-sm">Бүгүнкү заказдар жана водительдер — чыныгы убакытта</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {(['ONLINE', 'BUSY', 'BUSY_PERSONAL', 'OFFLINE'] as const).map(s => (
            <div key={s} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: STATUS_COLOR[s] }} />
              <span className="font-bold">{counts[s]}</span>
              <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Заказдар таблицасы */}
      {!fullMap && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3 border-b border-white/10">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  filter === f.key ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {f.label}
                {f.key === 'PENDING' && orderCounts.PENDING > 0 && ` (${orderCounts.PENDING})`}
                {f.key === 'ACTIVE' && orderCounts.ACTIVE > 0 && ` (${orderCounts.ACTIVE})`}
                {f.key === 'COMPLETED' && orderCounts.COMPLETED > 0 && ` (${orderCounts.COMPLETED})`}
              </button>
            ))}
            <div className="relative ml-auto w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Адрес, позывной, номер..." className="h-8 pl-8 text-xs" />
            </div>
          </div>
          <div className="max-h-[42vh] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[#0f1720] text-gray-400">
                <tr className="text-left">
                  <th className="px-2 py-2 font-semibold">Адрес подачи</th>
                  <th className="px-2 py-2 font-semibold">Адрес назначения</th>
                  <th className="px-2 py-2 font-semibold">Түзүлдү</th>
                  <th className="px-2 py-2 font-semibold" title="Заказ алынганга чейин күтүү">Күтүү</th>
                  <th className="px-2 py-2 font-semibold">Позывной</th>
                  <th className="px-2 py-2 font-semibold">Водитель</th>
                  <th className="px-2 py-2 font-semibold">Алды</th>
                  <th className="px-2 py-2 font-semibold">Бүттү</th>
                  <th className="px-2 py-2 font-semibold" title="Алгандан бүткөнгө чейин">Убакыт</th>
                  <th className="px-2 py-2 font-semibold text-right">Баа</th>
                  <th className="px-2 py-2 font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody>
                {ordersLoading && (
                  <tr><td colSpan={11} className="p-3"><Skeleton className="h-6 w-full" /></td></tr>
                )}
                {!ordersLoading && filteredOrders.length === 0 && (
                  <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Бүгүн заказ жок</td></tr>
                )}
                {filteredOrders.map(o => {
                  const st = ORDER_STATUS[o.status] || ORDER_STATUS.PENDING;
                  const target = !o.driver && o.targetDriverId ? drivers[o.targetDriverId] : null;
                  const waitEnd = o.assignedAt || (o.status === 'PENDING' ? now : o.cancelledAt);
                  const tripEnd = o.completedAt || ((o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS') ? now : null);
                  return (
                    <tr
                      key={o.id}
                      onClick={() => focusDriver(o.driverId || o.targetDriverId)}
                      className={`border-b border-white/5 cursor-pointer transition-colors ${st.row}`}
                    >
                      <td className="px-2 py-1.5 font-medium text-white max-w-[220px] truncate" title={o.pickupAddress}>{o.pickupAddress}</td>
                      <td className="px-2 py-1.5 text-gray-300 max-w-[180px] truncate" title={o.destAddress}>{o.destAddress === 'Не указано' ? '' : o.destAddress}</td>
                      <td className="px-2 py-1.5 font-mono">{hhmm(o.createdAt)}</td>
                      <td className="px-2 py-1.5 font-mono text-yellow-300">{minutesBetween(o.createdAt, waitEnd)}</td>
                      <td className="px-2 py-1.5 font-mono font-bold">
                        {o.driver ? (
                          <span className="text-white">{callsignLabel(o.driver)}</span>
                        ) : (target || o.targetCallsign) ? (
                          <span className="text-blue-400" title="Диспетчер ушул водительге берди">🎯 {target ? callsignLabel(target) : o.targetCallsign}</span>
                        ) : ''}
                      </td>
                      <td className="px-2 py-1.5 text-gray-300 whitespace-nowrap">{o.driver ? `${o.driver.firstName} ${o.driver.lastName?.[0] || ''}.` : ''}</td>
                      <td className="px-2 py-1.5 font-mono">{hhmm(o.assignedAt)}</td>
                      <td className="px-2 py-1.5 font-mono">{hhmm(o.completedAt)}</td>
                      <td className="px-2 py-1.5 font-mono">{o.assignedAt ? minutesBetween(o.assignedAt, tripEnd) : ''}</td>
                      <td className="px-2 py-1.5 font-mono text-right">{o.price ? Math.round(o.price) : 0}</td>
                      <td className={`px-2 py-1.5 font-semibold whitespace-nowrap ${st.text}`}>{st.label}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Чоң карта */}
      <Card className="overflow-hidden relative">
        <div className="absolute top-3 right-3 z-[1000] flex gap-2">
          <label className="flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs text-white cursor-pointer">
            <input type="checkbox" checked={showOffline} onChange={e => setShowOffline(e.target.checked)} />
            Оффлайн
          </label>
          <button
            onClick={() => setFullMap(v => !v)}
            className="rounded-md bg-black/70 p-1.5 text-white hover:bg-black"
            title={fullMap ? 'Таблицаны көрсөтүү' : 'Картаны чоңойтуу'}
          >
            {fullMap ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
        <CardContent className={`p-0 ${fullMap ? 'h-[calc(100vh-180px)]' : 'h-[70vh]'} min-h-[420px]`}>
          {mapLoaded ? (
            <div ref={containerRef} style={{ height: '100%', width: '100%', background: '#111' }} />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
