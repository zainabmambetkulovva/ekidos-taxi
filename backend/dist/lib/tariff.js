"use strict";
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
 * Комиссия компании: 12 сом (кундузу 06:00-00:00), 14 сом (түнкүсү 00:00-06:00)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPANY_COMMISSION = exports.TARIFFS = void 0;
exports.getCommissionAmount = getCommissionAmount;
exports.calculatePrice = calculatePrice;
exports.calculateDistance = calculateDistance;
exports.TARIFFS = {
    Standard: { perKm: 18, minimum: 110, name: 'Стандарт' },
};
/**
 * Комиссия суммасын убакытка жараша кайтарат
 * Кыргызстан UTC+6
 * Түнкүсү (00:00 - 07:00 КГ убакыты): 14 сом
 * Кундузу (07:00 - 00:00 КГ убакыты): 12 сом
 */
function getCommissionAmount() {
    // Convert UTC to Kyrgyzstan time (UTC+6)
    const utcHour = new Date().getUTCHours();
    const kgHour = (utcHour + 6) % 24;
    return (kgHour >= 0 && kgHour < 7) ? 14 : 12;
}
exports.COMPANY_COMMISSION = 0.15; // legacy — keep for compatibility
/**
 * Баа эсептөө
 * @param distanceKm — аралык километрде
 * @param tariffKey — тариф түрү
 * @returns { total, driverEarning, companyCommission }
 */
function calculatePrice(distanceKm, tariffKey) {
    const tariff = exports.TARIFFS[tariffKey] || exports.TARIFFS.Standard;
    let total = Math.round(distanceKm * tariff.perKm);
    if (total < tariff.minimum)
        total = tariff.minimum;
    // Тегерек санга тегеректөө (10-го)
    total = Math.ceil(total / 10) * 10;
    // Убакытка жараша комиссия: кундузу 12 сом, түнкүсү 14 сом
    const commissionAmount = getCommissionAmount();
    const companyCommission = commissionAmount;
    const driverEarning = total - companyCommission;
    return {
        total,
        driverEarning,
        companyCommission,
        tariffName: tariff.name,
        perKm: tariff.perKm,
        distanceKm,
        commissionAmount,
    };
}
/**
 * Эки координат ортосундагы аралыкты эсептөө (Haversine formula)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // 1 decimal
}
