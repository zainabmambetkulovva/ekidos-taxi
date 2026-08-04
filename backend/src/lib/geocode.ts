import axios from 'axios';

/**
 * Токтогул шаарынын жергиликтүү көчөлөрүнүн координаттары.
 * Nominatim Токтогулдун көчөлөрүн начар тааныгандыктан,
 * жергиликтүү базаны колдонобуз.
 * 
 * Координаттар: шаардын борбору 41.8747, 72.9422
 */

interface StreetEntry {
  names: string[];       // Ар кандай жазылыштар
  lat: number;
  lng: number;
}

// Токтогул шаарынын негизги көчөлөрү жана кварталдары
const TOKTOGUL_STREETS: StreetEntry[] = [
  // === НЕГИЗГИ КӨЧӨЛӨР ===
  { names: ['токтогул', 'токтогула', 'toktogul'], lat: 41.8747, lng: 72.9422 },
  { names: ['ленин', 'ленина', 'lenin'], lat: 41.8755, lng: 72.9410 },
  { names: ['совет', 'советская', 'советтик'], lat: 41.8740, lng: 72.9435 },
  { names: ['фрунзе', 'frunze'], lat: 41.8735, lng: 72.9400 },
  { names: ['кирова', 'киров', 'kirov'], lat: 41.8760, lng: 72.9450 },
  { names: ['калинин', 'калинина'], lat: 41.8730, lng: 72.9380 },
  { names: ['молодёжная', 'молодежная', 'жаштар'], lat: 41.8770, lng: 72.9460 },
  { names: ['интернациональная', 'интернац', 'эл аралык'], lat: 41.8725, lng: 72.9370 },
  { names: ['комсомольская', 'комсомол'], lat: 41.8765, lng: 72.9440 },
  { names: ['первомайская', 'первомай', '1 май'], lat: 41.8750, lng: 72.9390 },
  { names: ['октябрьская', 'октябрь'], lat: 41.8742, lng: 72.9465 },
  { names: ['пушкин', 'пушкина'], lat: 41.8758, lng: 72.9405 },
  { names: ['горький', 'горького'], lat: 41.8738, lng: 72.9415 },
  { names: ['маяковск', 'маяковского'], lat: 41.8752, lng: 72.9445 },
  { names: ['гагарин', 'гагарина'], lat: 41.8768, lng: 72.9430 },
  { names: ['мира', 'тынчтык'], lat: 41.8745, lng: 72.9475 },
  { names: ['победа', 'жениш', 'победы'], lat: 41.8755, lng: 72.9485 },
  { names: ['дружба', 'достук', 'дружбы'], lat: 41.8732, lng: 72.9395 },
  { names: ['свобод', 'эркиндик'], lat: 41.8748, lng: 72.9455 },
  { names: ['осмонов', 'осмонова'], lat: 41.8760, lng: 72.9470 },
  { names: ['бекмат', 'бекматов', 'бекматова'], lat: 41.8772, lng: 72.9415 },
  { names: ['абай', 'абая'], lat: 41.8735, lng: 72.9440 },
  { names: ['суеркулов', 'суеркулова'], lat: 41.8778, lng: 72.9405 },
  { names: ['ашимов', 'ашимова', 'ашыров'], lat: 41.8728, lng: 72.9460 },
  { names: ['малдыбаев', 'малдыбаева'], lat: 41.8720, lng: 72.9430 },
  { names: ['боконбаев', 'боконбаева'], lat: 41.8762, lng: 72.9380 },
  { names: ['исанов', 'исанова'], lat: 41.8740, lng: 72.9360 },
  { names: ['жибек жолу', 'жибек'], lat: 41.8752, lng: 72.9500 },
  { names: ['манас', 'манаса'], lat: 41.8745, lng: 72.9350 },
  
  // === МИКРОРАЙОНДОР / КВАРТАЛДАР ===
  { names: ['данканай', 'данканаи', 'dankanay'], lat: 41.8710, lng: 72.9350 },
  { names: ['новостройка', 'жаны конуш', 'жаңы конуш'], lat: 41.8790, lng: 72.9480 },
  { names: ['старый город', 'эски шаар'], lat: 41.8730, lng: 72.9400 },
  { names: ['кара-жыгач', 'карагач', 'кара жыгач'], lat: 41.8680, lng: 72.9380 },
  { names: ['жаны-жол', 'жаңы жол', 'новый путь'], lat: 41.8800, lng: 72.9450 },
  { names: ['аламедин', 'аламүдүн'], lat: 41.8715, lng: 72.9490 },
  { names: ['кызыл-туу', 'кызыл туу'], lat: 41.8690, lng: 72.9420 },
  { names: ['ак-терек', 'актерек', 'ак терек'], lat: 41.8810, lng: 72.9400 },
  
  // === МААНИЛҮҮ ЖЕРЛЕР ===
  { names: ['базар', 'рынок', 'центральный рынок', 'борбор базар'], lat: 41.8748, lng: 72.9425 },
  { names: ['автовокзал', 'автостанция', 'автобекет'], lat: 41.8755, lng: 72.9380 },
  { names: ['больница', 'аурукана', 'госпиталь', 'поликлиника'], lat: 41.8770, lng: 72.9440 },
  { names: ['школа', 'мектеп'], lat: 41.8745, lng: 72.9430 },
  { names: ['акимат', 'мэрия', 'администрация', 'акиматчылык'], lat: 41.8750, lng: 72.9420 },
  { names: ['стадион', 'стадиондор'], lat: 41.8760, lng: 72.9395 },
  { names: ['парк', 'сквер'], lat: 41.8742, lng: 72.9418 },
  { names: ['мечеть', 'мечит', 'масжид'], lat: 41.8738, lng: 72.9428 },
  { names: ['аптека', 'дарыкана'], lat: 41.8750, lng: 72.9432 },
  { names: ['почта', 'почтамт'], lat: 41.8747, lng: 72.9415 },
  { names: ['банк', 'банкомат'], lat: 41.8752, lng: 72.9420 },
  { names: ['магазин', 'дукан', 'дүкөн'], lat: 41.8745, lng: 72.9425 },
  { names: ['кафе', 'ресторан', 'столовая', 'ашкана'], lat: 41.8748, lng: 72.9430 },
  { names: ['заправка', 'бензин', 'азс', 'газ'], lat: 41.8720, lng: 72.9360 },
  { names: ['бишкек-ош', 'трасса', 'магистраль'], lat: 41.8780, lng: 72.9500 },
];

/**
 * Жергиликтүү базадан адресди издөө (fuzzy matching)
 */
function findLocalAddress(address: string): { lat: number; lng: number } | null {
  const normalized = address.toLowerCase()
    .replace(/[.,\-\/\\()'"!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let bestMatch: StreetEntry | null = null;
  let bestScore = 0;

  for (const street of TOKTOGUL_STREETS) {
    for (const name of street.names) {
      if (normalized.includes(name)) {
        // Score based on how much of the name matches
        const score = name.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = street;
        }
      }
    }
  }

  if (bestMatch) {
    // Extract house number if present for slight position offset
    const houseMatch = normalized.match(/(\d+)/);
    let offsetLat = 0;
    let offsetLng = 0;
    
    if (houseMatch) {
      const houseNum = parseInt(houseMatch[1]);
      // Offset slightly based on house number (every 10 houses ≈ 50m)
      // Direction alternates to spread markers
      offsetLat = ((houseNum % 50) - 25) * 0.00004;
      offsetLng = ((houseNum % 30) - 15) * 0.00005;
    }

    return {
      lat: bestMatch.lat + offsetLat,
      lng: bestMatch.lng + offsetLng,
    };
  }

  return null;
}

/**
 * Адрестен координата табуу
 * 1. Алгач жергиликтүү базадан издейт (Токтогул көчөлөрү)
 * 2. Табылбаса — Nominatim API менен аракет кылат
 * 3. Ал да жок болсо — шаар борборуна жакын коёт
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  // 1. Жергиликтүү база
  const localResult = findLocalAddress(address);
  if (localResult) {
    return localResult;
  }

  // 2. Nominatim API (fallback)
  try {
    const query = address.includes('Токтогул') ? address : `${address}, Токтогул, Кыргызстан`;
    
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        limit: 1,
        countrycodes: 'kg',
        viewbox: '72.90,41.90,72.98,41.85',
        bounded: 1,
      },
      headers: {
        'User-Agent': 'EKIDOS-Taxi-App/1.0',
      },
      timeout: 3000, // 3 sec timeout — don't block order creation
    });

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      
      // Verify the result is within Toktogul area (not some random place)
      if (lat > 41.85 && lat < 41.90 && lng > 72.90 && lng < 72.98) {
        return { lat, lng };
      }
    }
  } catch {
    // Nominatim timeout or error — use city center
  }

  // 3. Борбор координата (random эмес — так бир жер)
  // Базардын жанында — заказдарды көрүүгө жардамдаш
  return {
    lat: 41.8747,
    lng: 72.9422,
  };
}
