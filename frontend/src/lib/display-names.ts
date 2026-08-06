// Display diverse client names for demo/video purposes
const displayNames = [
  'Айжамал', 'Нурбек', 'Алтынай', 'Эрлан', 'Гулназ',
  'Бакыт', 'Жанара', 'Азамат', 'Динара', 'Талант',
  'Айгуль', 'Мирбек', 'Салтанат', 'Руслан', 'Бермет',
  'Жыргал', 'Назгуль', 'Кубат', 'Айнура', 'Данияр',
  'Чолпон', 'Элдияр', 'Мээрим', 'Нурлан', 'Асель',
  'Тилек', 'Жибек', 'Алмаз', 'Сезим', 'Арген',
  'Нургуль', 'Бекзат', 'Айпери', 'Максат', 'Камила',
  'Эркин', 'Зарина', 'Улан', 'Айдай', 'Санжар',
];

// Generate a consistent name based on any string (order id, index, etc.)
export function getClientDisplayName(id: string | number): string {
  if (typeof id === 'number') {
    return displayNames[id % displayNames.length];
  }
  // Hash the string to get a consistent index
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return displayNames[Math.abs(hash) % displayNames.length];
}
