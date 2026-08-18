'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDriverStore } from '@/store/useDriverStore';

interface DriverMapProps {
  center: [number, number];
  showMarker: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ekidos-taxi-production-587e.up.railway.app';

export default function DriverMap({ center, showMarker }: DriverMapProps) {
  const [mapReady, setMapReady] = useState(false);
  const [myLocation, setMyLocation] = useState<[number, number]>(center);
  const { activeOrder } = useDriverStore();
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const orderMarkersRef = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const initedRef = useRef(false);

  // Load Leaflet CSS and JS once
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
      script.onload = () => setMapReady(true);
      document.head.appendChild(script);
    } else {
      setMapReady(true);
    }
  }, []);

  // Initialize map ONCE
  useEffect(() => {
    if (!mapReady || initedRef.current || !containerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(containerRef.current, {
      center: myLocation,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM',
    }).addTo(map);

    mapRef.current = map;
    initedRef.current = true;

    // Listen for center event from location button
    const handleCenter = (e: Event) => {
      const { lat, lng } = (e as CustomEvent).detail;
      if (mapRef.current) {
        mapRef.current.setView([lat, lng], 16, { animate: true });
      }
    };
    window.addEventListener('driverCenterMap', handleCenter);

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      window.removeEventListener('driverCenterMap', handleCenter);
      map.remove();
      mapRef.current = null;
      initedRef.current = false;
    };
  }, [mapReady]);

  // GPS tracking — update marker position without recreating map
  useEffect(() => {
    if (!showMarker || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLoc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setMyLocation(newLoc);

        const L = (window as any).L;
        const map = mapRef.current;
        if (!L || !map) return;

        if (markerRef.current) {
          markerRef.current.setLatLng(newLoc);
        } else {
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:18px;height:18px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5)"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });
          markerRef.current = L.marker(newLoc, { icon }).addTo(map);
        }

        // Don't auto-pan - only pan when location button is pressed

        // Send location to backend via HTTP
        try {
          const driverInfo = localStorage.getItem('driverInfo');
          const driverId = driverInfo ? JSON.parse(driverInfo).id : null;
          if (driverId) {
            const token = localStorage.getItem('token');
            fetch(`${API_URL}/api/drivers/${driverId}/location`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ latitude: newLoc[0], longitude: newLoc[1] }),
            }).catch(() => {});
          }
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (markerRef.current && mapRef.current) {
        mapRef.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [showMarker, mapReady]);

  // Remove driver marker when offline
  useEffect(() => {
    if (!showMarker && markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [showMarker]);

  // Show route line when active order exists (pickup → destination)
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;

    // Clean previous route
    if ((map as any)._routeLine) {
      map.removeLayer((map as any)._routeLine);
      (map as any)._routeLine = null;
    }
    if ((map as any)._routeMarkers) {
      (map as any)._routeMarkers.forEach((m: any) => map.removeLayer(m));
      (map as any)._routeMarkers = null;
    }

    if (!activeOrder) return;

    const pickupLat = activeOrder.pickupLat;
    const pickupLng = activeOrder.pickupLng;
    const destLat = activeOrder.destLat;
    const destLng = activeOrder.destLng;

    if (!pickupLat || !pickupLng) return;

    const points: [number, number][] = [[pickupLat, pickupLng]];
    if (destLat && destLng) points.push([destLat, destLng]);

    if (points.length >= 2) {
      // Draw route line
      const line = L.polyline(points, {
        color: '#7BBDE8',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 8',
      }).addTo(map);
      (map as any)._routeLine = line;

      // Add markers for pickup (green) and destination (red)
      const pickupIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const destIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const markers = [
        L.marker([pickupLat, pickupLng], { icon: pickupIcon }).addTo(map),
        L.marker([destLat, destLng], { icon: destIcon }).addTo(map),
      ];
      (map as any)._routeMarkers = markers;

      // Fit map to show the route
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    } else if (points.length === 1) {
      // Only pickup - just show marker
      const pickupIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:#22c55e;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const m = L.marker([pickupLat, pickupLng], { icon: pickupIcon }).addTo(map);
      (map as any)._routeMarkers = [m];
      map.setView([pickupLat, pickupLng], 15);
    }

    return () => {
      if ((map as any)._routeLine) { map.removeLayer((map as any)._routeLine); (map as any)._routeLine = null; }
      if ((map as any)._routeMarkers) { (map as any)._routeMarkers.forEach((m: any) => map.removeLayer(m)); (map as any)._routeMarkers = null; }
    };
  }, [activeOrder, mapReady]);

  // Fetch and show order markers
  useEffect(() => {
    if (!showMarker || activeOrder) return;
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;

    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/orders/available`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        const orders = Array.isArray(data) ? data : [];

        // Clear old markers
        orderMarkersRef.current.forEach(m => map.removeLayer(m));
        orderMarkersRef.current = [];

        // Add new markers
        orders.forEach((order: any) => {
          if (!order.pickupLat || !order.pickupLng) return;
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:20px;height:20px;background:#ef4444;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          });
          const m = L.marker([order.pickupLat, order.pickupLng], { icon }).addTo(map)
            .bindPopup(
              `<div style="font-family:sans-serif;min-width:180px;font-size:13px">` +
              `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">` +
              `<span style="width:10px;height:10px;border-radius:50%;background:#22c55e;display:inline-block;flex-shrink:0"></span>` +
              `<span><b>Алынуучу жер:</b> ${order.pickupAddress}</span>` +
              `</div>` +
              `<div style="display:flex;align-items:center;gap:6px">` +
              `<span style="width:10px;height:10px;border-radius:50%;background:#ef4444;display:inline-block;flex-shrink:0"></span>` +
              `<span><b>Барылуучу жер:</b> ${order.destAddress || 'Көрсөтүлгөн жок'}</span>` +
              `</div>` +
              `</div>`
            );
          orderMarkersRef.current.push(m);
        });
      } catch {}
    };

    fetchOrders();
    const iv = setInterval(fetchOrders, 15000);
    return () => {
      clearInterval(iv);
      orderMarkersRef.current.forEach(m => map?.removeLayer(m));
      orderMarkersRef.current = [];
    };
  }, [showMarker, activeOrder, mapReady]);

  // Show OTHER online drivers on map (real-time via socket) with color-coded status
  useEffect(() => {
    if (!showMarker || !mapReady) return;
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;

    const { connectSocket } = require('@/lib/socket');
    const socket = connectSocket();
    const driverInfo = localStorage.getItem('driverInfo');
    const myDriverId = driverInfo ? JSON.parse(driverInfo).id : null;

    // Store other driver markers and their status: { driverId: { marker, status, name, callsign } }
    const otherDrivers: Record<string, { marker: any; status: string; name: string; callsign: string }> = {};

    // Color based on status
    const getDriverColor = (status: string) => {
      switch (status) {
        case 'BUSY': return '#ef4444'; // red
        case 'ONLINE': return '#22c55e'; // green
        case 'BUSY_PERSONAL': return '#f97316'; // orange
        default: return '#6b7280'; // gray
      }
    };

    const getStatusLabel = (status: string) => {
      switch (status) {
        case 'BUSY': return 'Заказда';
        case 'ONLINE': return 'Бош';
        case 'BUSY_PERSONAL': return 'По делам';
        default: return status;
      }
    };

    // Create or update marker for a driver
    const createOrUpdateMarker = (driverId: string, lat: number, lng: number, status?: string, name?: string, callsign?: string) => {
      if (driverId === myDriverId) return;
      if (!lat || !lng) return;

      const existing = otherDrivers[driverId];
      const driverStatus = status || existing?.status || 'ONLINE';
      const driverName = name || existing?.name || '';
      const driverCallsign = callsign || existing?.callsign || '';
      const color = getDriverColor(driverStatus);
      // Show callsign or first letter
      const label = driverCallsign || (driverName ? driverName.charAt(0) : '?');
      // Adjust font size based on label length
      const fontSize = label.length <= 2 ? '12px' : label.length <= 4 ? '10px' : '8px';
      // Wider pill shape if callsign is long, circle if short
      const isLong = label.length > 2;

      const makeIconHtml = () =>
        isLong
          ? `<div style="min-width:36px;height:24px;background:${color};border-radius:12px;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-size:${fontSize};font-weight:900;color:white;font-family:sans-serif;padding:0 5px;white-space:nowrap">${label}</div>`
          : `<div style="width:30px;height:30px;background:${color};border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-size:${fontSize};font-weight:900;color:white;font-family:sans-serif">${label}</div>`;

      const makePopup = () =>
        `<div style="font-family:sans-serif;min-width:100px">` +
        `<b>${driverName}</b>` +
        `${driverCallsign ? `<br><span style="color:#ef4444;font-weight:700">#${driverCallsign}</span>` : ''}` +
        `<br><span style="color:${color};font-weight:600">${getStatusLabel(driverStatus)}</span>` +
        `</div>`;

      if (existing?.marker) {
        existing.marker.setLatLng([lat, lng]);
        if (status && status !== existing.status) {
          const newIcon = L.divIcon({ className: '', html: makeIconHtml(), iconSize: isLong ? [Math.max(36, label.length * 9), 24] : [30, 30], iconAnchor: isLong ? [Math.max(18, label.length * 4.5), 12] : [15, 15] });
          existing.marker.setIcon(newIcon);
          existing.marker.setPopupContent(makePopup());
          existing.status = driverStatus;
          if (name) existing.name = name;
          if (callsign) existing.callsign = callsign;
        }
      } else {
        const icon = L.divIcon({ className: '', html: makeIconHtml(), iconSize: isLong ? [Math.max(36, label.length * 9), 24] : [30, 30], iconAnchor: isLong ? [Math.max(18, label.length * 4.5), 12] : [15, 15] });
        const marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(makePopup());
        otherDrivers[driverId] = { marker, status: driverStatus, name: driverName, callsign: driverCallsign };
      }
    };

    // Fetch initial driver positions from API
    const fetchDrivers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/drivers/online-with-status`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const drivers = await res.json();
          drivers.forEach((d: any) => {
            if (d.id !== myDriverId && d.lat && d.lng) {
              createOrUpdateMarker(d.id, d.lat, d.lng, d.status, d.name, d.callsign);
            }
          });
        }
      } catch {}
    };
    fetchDrivers();
    const fetchIv = setInterval(fetchDrivers, 30000);

    // Listen for location updates from other drivers
    const handleDriverLocation = (data: { driverId: string; lat: number; lng: number }) => {
      createOrUpdateMarker(data.driverId, data.lat, data.lng);
    };

    socket.on('driver:location-updated', handleDriverLocation);

    // Handle status changes — update color or remove if OFFLINE
    const handleStatusChange = (data: { driverId: string; status: string }) => {
      if (data.driverId === myDriverId) return;
      
      if (data.status === 'OFFLINE') {
        // Remove marker
        if (otherDrivers[data.driverId]) {
          map.removeLayer(otherDrivers[data.driverId].marker);
          delete otherDrivers[data.driverId];
        }
      } else {
        // Update marker color
        const existing = otherDrivers[data.driverId];
        if (existing) {
          createOrUpdateMarker(data.driverId, existing.marker.getLatLng().lat, existing.marker.getLatLng().lng, data.status);
        }
      }
    };
    socket.on('driver:status-changed', handleStatusChange);

    return () => {
      clearInterval(fetchIv);
      socket.off('driver:location-updated', handleDriverLocation);
      socket.off('driver:status-changed', handleStatusChange);
      // Clean up all other driver markers
      Object.values(otherDrivers).forEach((d: any) => map?.removeLayer(d.marker));
    };
  }, [showMarker, mapReady]);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', minHeight: '300px', background: '#111' }}
    />
  );
}
