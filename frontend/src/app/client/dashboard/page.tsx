'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Navigation,
  Search,
  Loader2,
  X,
  Star,
  Phone,
  Car,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/axios';
import { connectSocket, getSocket, disconnectSocket } from '@/lib/socket';
import { toast } from 'sonner';

const ClientMap = dynamic(() => import('./client-map'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-black/50 animate-pulse flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatLng { lat: number; lng: number }

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface Tariff {
  id: string;
  label: string;
  icon: string;
  basePrice: number;
  pricePerKm: number;
}

interface Order {
  id: string;
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  price: number;
  pickupAddress: string;
  destAddress: string;
  driver?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    rating?: number;
    vehicle?: string;
    vehiclePlate?: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TARIFFS: Tariff[] = [
  { id: 'STANDARD',  label: 'Стандарт', icon: '🚗', basePrice: 60,  pricePerKm: 12 },
  { id: 'COMFORT',   label: 'Комфорт',  icon: '🚙', basePrice: 90,  pricePerKm: 18 },
  { id: 'BUSINESS',  label: 'Бизнес',   icon: '🏎️', basePrice: 130, pricePerKm: 25 },
  { id: 'MINIVAN',   label: 'Минивэн',  icon: '🚐', basePrice: 100, pricePerKm: 20 },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING:     'Айдоочу издөөдө…',
  ASSIGNED:    'Айдоочу жолдо',
  IN_PROGRESS: 'Жол жүрүүдө',
  COMPLETED:   'Жеткирилди!',
  CANCELLED:   'Жокко чыгарылды',
};

function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Address search hook ───────────────────────────────────────────────────

function useAddressSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim() || q.length < 3) { setResults([]); return; }

    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ' Toktogul Kyrgyzstan')}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'ky,ru' } });
        const data: NominatimResult[] = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return { query, results, searching, search, clear };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientDashboardPage() {
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem('client-token');
    if (!token) {
      router.replace('/client/login');
    }
  }, [router]);

  // Map points
  const [pointA, setPointA] = useState<LatLng | null>(null);
  const [pointB, setPointB] = useState<LatLng | null>(null);
  const [addressA, setAddressA] = useState('');
  const [addressB, setAddressB] = useState('');
  const [selectingPoint, setSelectingPoint] = useState<'A' | 'B'>('A');

  // Address search
  const searchA = useAddressSearch();
  const searchB = useAddressSearch();
  const [focusedField, setFocusedField] = useState<'A' | 'B' | null>(null);

  // Tariff
  const [tariff, setTariff] = useState<Tariff>(TARIFFS[0]);

  // Order
  const [order, setOrder] = useState<Order | null>(null);
  const [placing, setPlacing] = useState(false);

  // Driver live location
  const [driverLocation, setDriverLocation] = useState<LatLng | null>(null);

  // Bottom sheet
  const [sheetExpanded, setSheetExpanded] = useState(true);

  // Computed price
  const price = (() => {
    if (!pointA || !pointB) return tariff.basePrice;
    const km = haversineKm(pointA, pointB);
    return Math.round(tariff.basePrice + km * tariff.pricePerKm);
  })();

  // Reverse-geocode helper
  const reverseGeocode = useCallback(async (pos: LatLng): Promise<string> => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lng}&format=json&accept-language=ky,ru`;
      const res = await fetch(url);
      const data = await res.json();
      return data.display_name?.split(',').slice(0, 3).join(', ') ?? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    } catch {
      return `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    }
  }, []);

  const handleSelectA = useCallback(async (pos: LatLng) => {
    setPointA(pos);
    setSelectingPoint('B');
    const addr = await reverseGeocode(pos);
    setAddressA(addr);
    searchA.clear();
  }, [reverseGeocode, searchA]);

  const handleSelectB = useCallback(async (pos: LatLng) => {
    setPointB(pos);
    setSelectingPoint('A');
    const addr = await reverseGeocode(pos);
    setAddressB(addr);
    searchB.clear();
  }, [reverseGeocode, searchB]);

  const handlePickNominatim = useCallback(async (result: NominatimResult, field: 'A' | 'B') => {
    const pos: LatLng = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    const addr = result.display_name.split(',').slice(0, 3).join(', ');
    if (field === 'A') {
      setPointA(pos);
      setAddressA(addr);
      searchA.clear();
      setSelectingPoint('B');
    } else {
      setPointB(pos);
      setAddressB(addr);
      searchB.clear();
      setSelectingPoint('A');
    }
    setFocusedField(null);
  }, [searchA, searchB]);

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem('client-token');
    if (!token) return;
    const socket = connectSocket();
    socket.auth = { token };

    socket.on('order:status-updated', (data: any) => {
      setOrder(prev => {
        if (!prev || prev.id !== data.orderId) return prev;
        const updated: Order = { ...prev, status: data.status };
        if (data.driver) updated.driver = data.driver;
        return updated;
      });

      const label = STATUS_LABELS[data.status] ?? data.status;
      toast(label, { icon: data.status === 'COMPLETED' ? '✅' : '🚗' });

      if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
        setTimeout(() => {
          setOrder(null);
          setPointA(null);
          setPointB(null);
          setAddressA('');
          setAddressB('');
          setDriverLocation(null);
        }, 3000);
      }
    });

    socket.on('driver:location-updated', (data: any) => {
      if (order && data.orderId === order.id) {
        setDriverLocation({ lat: data.lat, lng: data.lng });
      }
    });

    return () => {
      socket.off('order:status-updated');
      socket.off('driver:location-updated');
    };
  }, [order?.id]);

  // Place order
  const handlePlaceOrder = async () => {
    if (!pointA) {
      toast.error('А точканы тандаңыз (жүрүш жери)');
      return;
    }
    const token = localStorage.getItem('client-token');
    if (!token) {
      router.replace('/client/login');
      return;
    }

    setPlacing(true);
    try {
      const payload = {
        pickupAddress: addressA || `${pointA.lat.toFixed(5)}, ${pointA.lng.toFixed(5)}`,
        pickupLat: pointA.lat,
        pickupLng: pointA.lng,
        destAddress: addressB || (pointB ? `${pointB.lat.toFixed(5)}, ${pointB.lng.toFixed(5)}` : ''),
        destLat: pointB?.lat ?? null,
        destLng: pointB?.lng ?? null,
        tariff: tariff.id,
        price,
      };

      // Use client token for this request
      const { data } = await api.post('/orders', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setOrder(data.order ?? data);
      setSheetExpanded(false);
      toast.success('Заказ жөнөтүлдү! Айдоочу издөөдө…');

      // Join order room via socket
      const socket = getSocket();
      socket.emit('order:join', { orderId: (data.order ?? data).id });
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Заказ берүү мүмкүн болбоду';
      toast.error(msg);
    } finally {
      setPlacing(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      const token = localStorage.getItem('client-token');
      await api.patch(`/orders/${order.id}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrder(null);
      setDriverLocation(null);
      toast('Заказ жокко чыгарылды');
    } catch {
      setOrder(null);
      setDriverLocation(null);
    }
  };

  const canOrder = !!pointA && !order;

  return (
    <div className="relative flex flex-col h-[calc(100vh-56px)]">
      {/* Map layer */}
      <div className="absolute inset-0">
        <ClientMap
          pointA={pointA}
          pointB={pointB}
          onSelectA={handleSelectA}
          onSelectB={handleSelectB}
          selectingPoint={selectingPoint}
          orderId={order?.id}
          driverLocation={driverLocation}
        />
      </div>

      {/* Map tap hint */}
      {!order && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs text-white/80">
            {selectingPoint === 'A' ? '📍 А точканы тандаңыз' : '🏁 Б точканы тандаңыз'}
          </div>
        </div>
      )}

      {/* Bottom Sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">

        {/* Active order card */}
        {order && (
          <div className="px-3 pb-3">
            <div className="bg-[#0d0d0d] border border-red-500/30 rounded-2xl p-4 shadow-2xl">
              {/* Status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    order.status === 'PENDING' ? 'bg-yellow-400 animate-pulse' :
                    order.status === 'ASSIGNED' || order.status === 'IN_PROGRESS' ? 'bg-blue-400 animate-pulse' :
                    order.status === 'COMPLETED' ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  <span className="text-sm font-medium text-white">
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                </div>
                <span className="text-xl font-black text-red-400">{order.price} с</span>
              </div>

              {/* Route summary */}
              <div className="space-y-1.5 mb-3 bg-white/5 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <div className="mt-1 w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <p className="text-xs text-gray-300 leading-tight line-clamp-1">{order.pickupAddress}</p>
                </div>
                {order.destAddress && (
                  <>
                    <div className="ml-[3px] border-l border-dashed border-white/10 h-2" />
                    <div className="flex items-start gap-2">
                      <div className="mt-1 w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      <p className="text-xs text-gray-300 leading-tight line-clamp-1">{order.destAddress}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Driver info */}
              {order.driver && (
                <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Car className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {order.driver.firstName} {order.driver.lastName ?? ''}
                      </p>
                      {order.driver.vehicle && (
                        <p className="text-[10px] text-gray-400">
                          {order.driver.vehicle} {order.driver.vehiclePlate ?? ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.driver.rating && (
                      <div className="flex items-center gap-0.5 text-yellow-400">
                        <Star className="w-3 h-3 fill-current" />
                        <span className="text-xs">{order.driver.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {order.driver.phone && (
                      <a
                        href={`tel:${order.driver.phone}`}
                        className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center"
                      >
                        <Phone className="w-3.5 h-3.5 text-green-400" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Pending spinner */}
              {order.status === 'PENDING' && (
                <div className="flex items-center justify-center gap-2 py-1 mb-3">
                  <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                  <span className="text-xs text-yellow-400">Айдоочу издөөдө…</span>
                </div>
              )}

              {/* Cancel button */}
              {(order.status === 'PENDING' || order.status === 'ASSIGNED') && (
                <button
                  onClick={handleCancelOrder}
                  className="w-full h-10 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium active:scale-[0.97] transition-all"
                >
                  Жокко чыгаруу
                </button>
              )}

              {order.status === 'COMPLETED' && (
                <div className="flex items-center justify-center gap-2 text-green-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-semibold">Жеткирилди!</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Booking sheet */}
        {!order && (
          <div className="bg-[#0d0d0d] border-t border-white/10 rounded-t-2xl shadow-2xl">
            {/* Sheet handle */}
            <button
              onClick={() => setSheetExpanded(v => !v)}
              className="w-full flex items-center justify-center py-3"
            >
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </button>

            <div className={`overflow-hidden transition-all duration-300 ${sheetExpanded ? 'max-h-[600px]' : 'max-h-0'}`}>
              <div className="px-4 pb-4 space-y-3">

                {/* Address A */}
                <div className="relative">
                  <div
                    className={`flex items-center gap-2 h-12 px-3 rounded-xl border ${
                      focusedField === 'A' || selectingPoint === 'A'
                        ? 'border-green-500/60 bg-green-500/5'
                        : 'border-white/10 bg-white/5'
                    } cursor-text`}
                    onClick={() => { setFocusedField('A'); setSelectingPoint('A'); }}
                  >
                    <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                    <input
                      className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                      placeholder="А точка — жүрүш жери"
                      value={focusedField === 'A' ? searchA.query : addressA}
                      onChange={e => { setFocusedField('A'); setSelectingPoint('A'); searchA.search(e.target.value); }}
                      onFocus={() => { setFocusedField('A'); setSelectingPoint('A'); if (addressA) searchA.search(addressA); }}
                    />
                    {addressA && focusedField !== 'A' ? (
                      <button onClick={e => { e.stopPropagation(); setPointA(null); setAddressA(''); searchA.clear(); }}>
                        <X className="w-4 h-4 text-gray-500 hover:text-white" />
                      </button>
                    ) : searchA.searching ? (
                      <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  {/* A suggestions */}
                  {focusedField === 'A' && searchA.results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#181818] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                      {searchA.results.map(r => (
                        <button
                          key={r.place_id}
                          className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                          onMouseDown={e => { e.preventDefault(); handlePickNominatim(r, 'A'); }}
                        >
                          <MapPin className="w-3 h-3 text-green-500 inline mr-1.5 flex-shrink-0" />
                          {r.display_name.split(',').slice(0, 3).join(', ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Address B */}
                <div className="relative">
                  <div
                    className={`flex items-center gap-2 h-12 px-3 rounded-xl border ${
                      focusedField === 'B' || selectingPoint === 'B'
                        ? 'border-red-500/60 bg-red-500/5'
                        : 'border-white/10 bg-white/5'
                    } cursor-text`}
                    onClick={() => { setFocusedField('B'); setSelectingPoint('B'); }}
                  >
                    <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                    <input
                      className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                      placeholder="Б точка — жай жери (милдеттүү эмес)"
                      value={focusedField === 'B' ? searchB.query : addressB}
                      onChange={e => { setFocusedField('B'); setSelectingPoint('B'); searchB.search(e.target.value); }}
                      onFocus={() => { setFocusedField('B'); setSelectingPoint('B'); if (addressB) searchB.search(addressB); }}
                    />
                    {addressB && focusedField !== 'B' ? (
                      <button onClick={e => { e.stopPropagation(); setPointB(null); setAddressB(''); searchB.clear(); }}>
                        <X className="w-4 h-4 text-gray-500 hover:text-white" />
                      </button>
                    ) : searchB.searching ? (
                      <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  {/* B suggestions */}
                  {focusedField === 'B' && searchB.results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#181818] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                      {searchB.results.map(r => (
                        <button
                          key={r.place_id}
                          className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-white/10 transition-colors border-b border-white/5 last:border-0"
                          onMouseDown={e => { e.preventDefault(); handlePickNominatim(r, 'B'); }}
                        >
                          <MapPin className="w-3 h-3 text-red-500 inline mr-1.5 flex-shrink-0" />
                          {r.display_name.split(',').slice(0, 3).join(', ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tariff selector */}
                <div className="grid grid-cols-4 gap-2">
                  {TARIFFS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTariff(t)}
                      className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all active:scale-[0.96] ${
                        tariff.id === t.id
                          ? 'bg-red-500/20 border-red-500/60 text-white'
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      <span className="text-lg leading-none">{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>

                {/* Price & order button */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-white/5 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-gray-500">Баасы</p>
                    <p className="text-lg font-black text-white">{price} <span className="text-sm font-normal text-gray-400">сом</span></p>
                  </div>
                  <button
                    onClick={() => { setFocusedField(null); handlePlaceOrder(); }}
                    disabled={!canOrder || placing}
                    className="flex-[2] h-14 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base active:scale-[0.97] transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                  >
                    {placing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <MapPin className="w-5 h-5" />
                        Заказ жиберүү
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsed peek */}
            {!sheetExpanded && (
              <div
                className="flex items-center justify-between px-4 pb-4 cursor-pointer"
                onClick={() => setSheetExpanded(true)}
              >
                <span className="text-sm text-gray-400">Такси заказоо</span>
                <ChevronUp className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
