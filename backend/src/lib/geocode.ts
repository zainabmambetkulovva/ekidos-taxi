import axios from 'axios';

/**
 * Адрестен координата табуу (OpenStreetMap Nominatim — бекер)
 * "ул. Ленина 45, Токтогул" → { lat: 41.875, lng: 72.942 }
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Токтогул шаарын кошуп издөө
    const query = address.includes('Токтогул') ? address : `${address}, Токтогул, Кыргызстан`;
    
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: 1,
      },
      headers: {
        'User-Agent': 'EKIDOS-Taxi-App/1.0',
      },
    });

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }

    // Fallback: Токтогулдун борборуна жакын random координата
    return {
      lat: 41.8747 + (Math.random() - 0.5) * 0.01,
      lng: 72.9422 + (Math.random() - 0.5) * 0.01,
    };
  } catch (error) {
    // Geocoding иштебесе — Токтогулдун ичинде random
    return {
      lat: 41.8747 + (Math.random() - 0.5) * 0.01,
      lng: 72.9422 + (Math.random() - 0.5) * 0.01,
    };
  }
}
