import { useLanguageStore } from '@/store/useLanguageStore';
import type { Lang } from '@/lib/translations';

/**
 * Жөндөөдө тандалган тилге жараша сөз: tx('орусча', 'кыргызча', 'english').
 * "Отмена" сөзү бардык тилде "Отмена" бойдон калат.
 */
export function pick(lang: Lang, ru: string, kg: string, en: string): string {
  return lang === 'kg' ? kg : lang === 'en' ? en : ru;
}

export function useTx() {
  const lang = useLanguageStore(s => s.lang);
  return (ru: string, kg: string, en: string) => pick(lang, ru, kg, en);
}

/** Заказдын статусу */
export function orderStatusLabel(lang: Lang, status: string): string {
  switch (status) {
    case 'PENDING': return pick(lang, 'Ожидает', 'Күтүүдө', 'Pending');
    case 'ASSIGNED': return pick(lang, 'Принят', 'Алынды', 'Accepted');
    case 'IN_PROGRESS': return pick(lang, 'В пути', 'Жолдо', 'In progress');
    case 'COMPLETED': return pick(lang, 'Выполнен', 'Бүттү', 'Completed');
    case 'CANCELLED': return 'Отмена';
    default: return status;
  }
}

/** Ким отмена кылды */
export function cancelledByLabel(lang: Lang, by?: string | null): string {
  switch (by) {
    case 'DISPATCHER': return pick(lang, 'Отмена — диспетчер', 'Отмена — диспетчер', 'Отмена — dispatcher');
    case 'CLIENT': return pick(lang, 'Отмена — клиент', 'Отмена — клиент', 'Отмена — client');
    case 'DRIVER': return pick(lang, 'Отмена — водитель', 'Отмена — айдоочу', 'Отмена — driver');
    case 'SYSTEM': return pick(lang, 'Отмена — система', 'Отмена — система', 'Отмена — system');
    default: return 'Отмена';
  }
}

/** Водительдин статусу (картада) */
export function driverStatusLabel(lang: Lang, status: string): string {
  switch (status) {
    case 'ONLINE': return pick(lang, 'Свободен', 'Бош', 'Free');
    case 'BUSY': return pick(lang, 'На заказе', 'Заказда', 'On order');
    case 'BUSY_PERSONAL': return pick(lang, 'Занят', 'Занят', 'Busy');
    case 'OFFLINE': return pick(lang, 'Оффлайн', 'Оффлайн', 'Offline');
    default: return status;
  }
}
