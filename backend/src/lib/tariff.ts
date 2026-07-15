/**
 * Тариф калькулятору — аралык боюнча баа эсептейт
 * 
 * Тарифтер (сом/км):
 * - Standard: 15 сом/км, минимум 80 сом
 * - Comfort: 20 сом/км, минимум 120 сом
 * - Business: 30 сом/км, минимум 200 сом
 * - Minivan: 25 сом/км, минимум 150 сом
 * - Междугород: 12 сом/км, минимум 300 сом
 * 
 * Комиссия компании: 15%
 */

export interface TariffConfig {
  perKm: number;
  minimum: number;
  name: string;
}

export const TARIFFS: Record<string, TariffConfig> = {
  Standard: { perKm: 15, minimum: 80, name: 'Стандарт' },
  Comfort: { perKm: 20, minimum: 120, name: 'Комфорт' },
  Business: { perKm: 30, minimum: 200, name: 'Бизнес' },
  Minivan: { perKm: 25, minimum: 150, name: 'Минивэн' },
  Intercity: { perKm: 12, minimum: 300, name: 'Междугород' },
};

export const COMPANY_COMMISSION = 0.15; // 15%

/**
 * Баа эсептөө
 * @param distanceKm — аралык километрде
 * @param tariffKey — тариф түрү
 * @returns { total, driverEarning, companyCommission }
 */
export function calculatePrice(distanceKm: number, tariffKey: string) {
  const tariff = TARIFFS[tariffKey] || TARIFFS.Standard;

  let total = Math.round(distanceKm * tariff.perKm);
  if (total < tariff.minimum) total = tariff.minimum;

  // Тегерек санга тегеректөө (10-го)
  total = Math.ceil(total / 10) * 10;

  const companyCommission = Math.round(total * COMPANY_COMMISSION);
  const driverEarning = total - companyCommission;

  return {
    total,
    driverEarning,
    companyCommission,
    tariffName: tariff.name,
    perKm: tariff.perKm,
    distanceKm,
  };
}

/**
 * Эки координат ортосундагы аралыкты эсептөө (Haversine formula)
 */
export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal
}
