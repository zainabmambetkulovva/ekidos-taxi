'use client';

import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/axios';

export default function LiveMapPage() {
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<any>(null);

  const { data: driversData } = useQuery({
    queryKey: ['map-drivers'],
    queryFn: async () => {
      const { data } = await api.get('/drivers', { params: { limit: 200 } });
      return data;
    },
    refetchInterval: 15000,
  });

  const drivers = driversData?.drivers || [];
  const onlineCount = drivers.filter((d: any) => d.status === 'ONLINE').length;
  const busyCount = drivers.filter((d: any) => d.status === 'BUSY').length;
  const offlineCount = drivers.filter((d: any) => d.status === 'OFFLINE').length;

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

  // Render map
  useEffect(() => {
    if (!mapLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById('admin-map-container');
    if (!container) return;
    container.innerHTML = '';

    const map = L.map(container, {
      center: [41.8747, 72.9422],
      zoom: 13,
      zoomControl: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    // Driver markers - car icons with color-coded status
    drivers
      .filter((d: any) => d.latitude && d.longitude)
      .forEach((driver: any) => {
        const color = driver.status === 'ONLINE' ? '#22c55e' : driver.status === 'BUSY' ? '#ef4444' : driver.status === 'BUSY_PERSONAL' ? '#f97316' : '#6b7280';
        const statusLabel = driver.status === 'ONLINE' ? 'Бош' : driver.status === 'BUSY' ? 'Заказда' : driver.status === 'BUSY_PERSONAL' ? 'По делам' : 'Оффлайн';
        const offlineTime = driver.status === 'OFFLINE' && driver.lastLocationUpdate
          ? ` (${new Date(driver.lastLocationUpdate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })})`
          : '';
        const icon = L.divIcon({
          className: '',
          html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:28px;height:28px;background:${color};border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div><div style="background:${color};color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:4px;margin-top:2px;white-space:nowrap">${driver.callsign || driver.firstName?.[0] || ''}</div></div>`,
          iconSize: [36, 42],
          iconAnchor: [18, 42],
        });
        L.marker([driver.latitude, driver.longitude], { icon }).addTo(map)
          .bindPopup(`<div style="font-family:sans-serif;min-width:140px"><b>${driver.firstName} ${driver.lastName}</b>${driver.callsign ? `<br><span style="color:#ef4444;font-weight:700">Позывной: ${driver.callsign}</span>` : ''}<br>${driver.phone || ''}<br>${driver.vehicle ? `${driver.vehicle.brand} ${driver.vehicle.model}<br><b>${driver.vehicle.plateNumber}</b>` : ''}<br><span style="color:${color};font-weight:700">${statusLabel}${offlineTime}</span></div>`);
      });

    setTimeout(() => map.invalidateSize(), 300);
    return () => { map.remove(); mapRef.current = null; };
  }, [mapLoaded, drivers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Карта</h1>
        <p className="text-muted-foreground">Айдоочуларды чыныгы убакытта байкоо</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <div><p className="text-2xl font-bold">{onlineCount}</p><p className="text-xs text-muted-foreground">Онлайн</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <div><p className="text-2xl font-bold">{busyCount}</p><p className="text-xs text-muted-foreground">Занят</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-gray-500" />
            <div><p className="text-2xl font-bold">{offlineCount}</p><p className="text-xs text-muted-foreground">Оффлайн</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 h-[600px]">
          {mapLoaded ? (
            <div id="admin-map-container" style={{ height: '100%', width: '100%', background: '#111' }} />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {drivers.filter((d: any) => d.status !== 'OFFLINE').map((driver: any) => (
          <Card key={driver.id} className="hover:border-white/20 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${driver.status === 'ONLINE' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <div>
                  <p className="text-sm font-medium">{driver.firstName} {driver.lastName}</p>
                  <p className="text-xs text-muted-foreground">{driver.vehicle?.brand} {driver.vehicle?.plateNumber}</p>
                </div>
              </div>
              <Badge variant={driver.status === 'ONLINE' ? 'success' : 'warning'}>{driver.status}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
