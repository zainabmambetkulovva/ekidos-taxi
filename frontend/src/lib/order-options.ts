export const ORDER_OPTIONS = [
  { id: 'baggage_roof',   label: 'Багажник на крыше', emoji: '🚗' },
  { id: 'mbank',          label: 'Мбанк',             emoji: '💳' },
  { id: 'foreign_car',    label: 'Иномарка',          emoji: '🚙' },
  { id: 'pump',           label: 'Насос',             emoji: '🔧' },
  { id: 'tow',            label: 'Буксировка',        emoji: '🔗' },
  { id: 'sheep',          label: 'Кой',               emoji: '🐑' },
  { id: 'rope',           label: 'Тросс',             emoji: '🪢' },
  { id: 'large_luggage',  label: 'Кенен багаж',       emoji: '🧳' },
  { id: 'jumper',         label: 'Прикуритель',       emoji: '⚡' },
  { id: 'fuel_delivery',  label: 'Доставка бензин',  emoji: '⛽' },
] as const;

export type OrderOptionId = typeof ORDER_OPTIONS[number]['id'];

export function getOptionLabel(id: string): string {
  return ORDER_OPTIONS.find(o => o.id === id)?.label ?? id;
}

export function getOptionEmoji(id: string): string {
  return ORDER_OPTIONS.find(o => o.id === id)?.emoji ?? '•';
}
