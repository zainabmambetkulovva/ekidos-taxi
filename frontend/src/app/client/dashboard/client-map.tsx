'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';

interface LatLng {
  lat: number;
  lng: number;
}

interface ClientMapProps {
  pointA: LatLng | null;
  pointB: LatLng | null;
  onSelectA: (pos: LatLng) => void;
  onSelectB: (pos: LatLng) => void;
  selectingPoint: 'A' | 'B';
  orderId?: string | null;
  driverLocation?: LatLng | null;
}

const TOKTOGUL: [number, number] = [41.8747, 72.9422];

export default function ClientMap({
  pointA,
  pointB,
  onSelectA,
  onSelectB,
  selectingPoint,
  orderId,
  driverLocation,
}: ClientMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const initedRef = useRef(false);
  const markerARef = useRef<any>(null);
  const markerBRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Load Leaflet CSS + JS
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

  // Initialize map once
  useEffect(() => {
    if (!mapReady || initedRef.current || !containerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(containerRef.current, {
      center: TOKTOGUL,
      zoom: 14,
      zoomControl: true,
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

  // Handle map click to set A or B
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    const handleClick = (e: any) => {
      const pos: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (selectingPoint === 'A') {
        onSelectA(pos);
      } else {
        onSelectB(pos);
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [mapReady, selectingPoint, onSelectA, onSelectB]);

  // Update A marker
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    if (pointA) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;background:#22c55e;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(34,197,94,0.5);display:flex;align-items:center;justify-content:center">
                 <span style="transform:rotate(45deg);color:white;font-weight:900;font-size:12px">А</span>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      if (markerARef.current) {
        markerARef.current.setLatLng([pointA.lat, pointA.lng]);
      } else {
        markerARef.current = L.marker([pointA.lat, pointA.lng], { icon }).addTo(map);
      }
      map.panTo([pointA.lat, pointA.lng], { animate: true, duration: 0.5 });
    } else {
      if (markerARef.current) {
        map.removeLayer(markerARef.current);
        markerARef.current = null;
      }
    }
  }, [pointA, mapReady]);

  // Update B marker
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    if (pointB) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:32px;height:32px;background:#ef4444;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center">
                 <span style="transform:rotate(45deg);color:white;font-weight:900;font-size:12px">Б</span>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      if (markerBRef.current) {
        markerBRef.current.setLatLng([pointB.lat, pointB.lng]);
      } else {
        markerBRef.current = L.marker([pointB.lat, pointB.lng], { icon }).addTo(map);
      }
    } else {
      if (markerBRef.current) {
        map.removeLayer(markerBRef.current);
        markerBRef.current = null;
      }
    }
  }, [pointB, mapReady]);

  // Update driver marker from prop
  useEffect(() => {
    const map = mapRef.current;
    const L = (window as any).L;
    if (!map || !L) return;

    if (driverLocation) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6)"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverLocation.lat, driverLocation.lng]);
      } else {
        driverMarkerRef.current = L.marker([driverLocation.lat, driverLocation.lng], { icon })
          .addTo(map)
          .bindPopup('🚗 Айдоочу');
      }
    } else {
      if (driverMarkerRef.current) {
        map.removeLayer(driverMarkerRef.current);
        driverMarkerRef.current = null;
      }
    }
  }, [driverLocation, mapReady]);

  // Listen to socket for driver location
  useEffect(() => {
    if (!orderId) return;
    const socket = getSocket();

    const handleDriverLocation = (data: any) => {
      if (data.orderId && data.orderId !== orderId) return;
      const map = mapRef.current;
      const L = (window as any).L;
      if (!map || !L) return;

      const pos: [number, number] = [data.lat, data.lng];
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:20px;height:20px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.6)"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng(pos);
      } else {
        driverMarkerRef.current = L.marker(pos, { icon }).addTo(map).bindPopup('🚗 Айдоочу');
      }
      map.panTo(pos, { animate: true, duration: 0.8 });
    };

    socket.on('driver:location-updated', handleDriverLocation);
    return () => {
      socket.off('driver:location-updated', handleDriverLocation);
    };
  }, [orderId]);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', minHeight: '300px', background: '#111' }}
    />
  );
}
