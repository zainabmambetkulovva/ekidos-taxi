'use client';

import { useEffect, useState, useRef } from 'react';
import { useDriverStore } from '@/store/useDriverStore';
import { getRoute } from '@/lib/routing';

interface DriverMapProps {
  center: [number, number];
  showMarker: boolean;
}

const API_URL = typeof window !== 'undefined'
  ? `http://${window.location.hostname}:5000`
  : 'http://localhost:5000';

export default function DriverMap({ center, showMarker }: DriverMapProps) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const { activeOrder } = useDriverStore();
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  // Load Leaflet via CDN
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

  // Fetch orders when online
  useEffect(() => {
    if (!showMarker) { setOrders([]); return; }
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/orders/available`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch { setOrders([]); }
    };
    fetchOrders();
    const iv = setInterval(fetchOrders, 15000);
    return () => clearInterval(iv);
  }, [showMarker]);

  // Draw route when activeOrder exists
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !activeOrder) {
      // Remove old route
      if (routeLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      return;
    }

    const drawRoute = async () => {
      const L = (window as any).L;
      if (!L) return;

      // Remove old route
      if (routeLayerRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
      }

      const from = { lat: center[0], lng: center[1] };
      let to = { lat: center[0] + 0.005, lng: center[1] + 0.005 };

      // Use order coordinates if available
      if (activeOrder.pickupLat && activeOrder.pickupLng) {
        to = { lat: activeOrder.pickupLat, lng: activeOrder.pickupLng };
      }

      const route = await getRoute(from, to);
      if (route && route.coordinates.length > 0) {
        const polyline = L.polyline(route.coordinates, {
          color: '#ef4444',
          weight: 5,
          opacity: 0.8,
          dashArray: '10, 10',
        }).addTo(mapRef.current);

        routeLayerRef.current = polyline;
        mapRef.current.fitBounds(polyline.getBounds(), { padding: [50, 50] });

        // Add destination marker
        const destIcon = L.divIcon({
          className: '',
          html: `<div style="width:20px;height:20px;background:#ef4444;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        L.marker([to.lat, to.lng], { icon: destIcon }).addTo(mapRef.current)
          .bindPopup(`<b>${activeOrder.pickupAddress}</b><br>${route.distance} км • ~${route.duration} мин`);
      }
    };

    drawRoute();
  }, [activeOrder, mapLoaded]);

  // Render map
  useEffect(() => {
    if (!mapLoaded) return;
    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById('driver-map-container');
    if (!container) return;
    container.innerHTML = '';

    const map = L.map(container, { center, zoom: 15, zoomControl: false });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    // Driver position marker
    if (showMarker) {
      const driverIcon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(59,130,246,0.5)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker(center, { icon: driverIcon }).addTo(map);
    }

    // Order markers (when no active order)
    if (showMarker && !activeOrder && orders.length > 0) {
      orders.forEach((order) => {
        if (!order.pickupLat || !order.pickupLng) return;
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:30px;height:30px;background:#ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:10px;border:2px solid white;box-shadow:0 2px 8px rgba(239,68,68,0.5)">${order.price}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        L.marker([order.pickupLat, order.pickupLng], { icon }).addTo(map)
          .bindPopup(`<b>${order.pickupAddress}</b><br>→ ${order.destAddress}<br><span style="color:#22c55e;font-weight:700">${order.price} сом</span>`);
      });
    }

    setTimeout(() => map.invalidateSize(), 300);

    return () => { map.remove(); mapRef.current = null; };
  }, [mapLoaded, showMarker, orders, activeOrder]);

  return (
    <div id="driver-map-container" style={{ height: '100%', width: '100%', minHeight: '300px', background: '#111' }} />
  );
}
