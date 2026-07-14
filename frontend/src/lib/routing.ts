/**
 * Geocoding — адресті координатқа айландыруу (Nominatim OSM — бекер)
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = address.includes('Токтогул') || address.includes('Кыргызстан')
      ? address
      : `${address}, Токтогул, Кыргызстан`;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'EKIDOS-Taxi/1.0' } }
    );
    const data = await res.json();

    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Маршрутизация — A точкадан B точкага жол тартуу (OSRM — бекер)
 * @returns массив координаталар [[lat, lng], ...] — полилиния
 */
export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<{ coordinates: [number, number][]; distance: number; duration: number } | null> {
  try {
    // OSRM API: longitude,latitude формат
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      // GeoJSON coordinates [lng, lat] → [lat, lng] for Leaflet
      const coordinates: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]]
      );
      return {
        coordinates,
        distance: Math.round(route.distance / 1000 * 10) / 10, // km
        duration: Math.round(route.duration / 60), // minutes
      };
    }
    return null;
  } catch {
    return null;
  }
}
