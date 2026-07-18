'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDriverStore } from '@/store/useDriverStore';

interface DriverMapProps {
  center: [number, number];
  showMarker: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL
  || (typeof window !== 'undefined' ? `http://${window.location.hostname}:5000` : 'http://localhost:5000');

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

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
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

        map.panTo(newLoc, { animate: true, duration: 0.5 });
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

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', minHeight: '300px', background: '#111' }}
    />
  );
}
