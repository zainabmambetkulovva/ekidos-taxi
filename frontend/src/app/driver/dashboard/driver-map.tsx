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
            html: `<div style="width:28px;height:28px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:9px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${order.price}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          const m = L.marker([order.pickupLat, order.pickupLng], { icon }).addTo(map)
            .bindPopup(`<b>${order.pickupAddress}</b><br>→ ${order.destAddress}<br><b style="color:#22c55e">${order.price} сом</b>`);
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

      if (existing?.marker) {
        // Update position
        existing.marker.setLatLng([lat, lng]);
        // Update icon if status changed
        if (status && status !== existing.status) {
          const newIcon = L.divIcon({
            className: '',
            html: `<div style="width:28px;height:28px;background:${color};border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });
          existing.marker.setIcon(newIcon);
          // Update popup
          existing.marker.setPopupContent(
            `<div style="font-family:sans-serif;min-width:120px">` +
            `<b>${driverName}</b>` +
            `${driverCallsign ? `<br><span style="color:#ef4444;font-weight:700">№${driverCallsign}</span>` : ''}` +
            `<br><span style="color:${color};font-weight:600">${getStatusLabel(driverStatus)}</span>` +
            `</div>`
          );
          existing.status = driverStatus;
          if (name) existing.name = name;
          if (callsign) existing.callsign = callsign;
        }
      } else {
        // Create new marker
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;background:${color};border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const marker = L.marker([lat, lng], { icon }).addTo(map)
          .bindPopup(
            `<div style="font-family:sans-serif;min-width:120px">` +
            `<b>${driverName}</b>` +
            `${driverCallsign ? `<br><span style="color:#ef4444;font-weight:700">№${driverCallsign}</span>` : ''}` +
            `<br><span style="color:${color};font-weight:600">${getStatusLabel(driverStatus)}</span>` +
            `</div>`
          );
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
