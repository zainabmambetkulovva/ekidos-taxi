const translations: Record<string, Record<string, string>> = {
  ru: {
    // Sidebar
    'Dashboard': 'Панель управления',
    'Drivers': 'Водители',
    'Rating': 'Рейтинг',
    'Tables': 'Таблицы',
    'Dispatcher': 'Диспетчер',
    'Live Map': 'Карта',
    'Reports': 'Отчёты',
    'Settings': 'Настройки',
    'Logout': 'Выход',

    // Dashboard
    'Real-time fleet overview': 'Обзор автопарка в реальном времени',
    "Today's Orders": 'Заказы сегодня',
    "Today's Revenue": 'Доход сегодня',
    'Monthly Revenue': 'Доход за месяц',
    'Online Drivers': 'Онлайн водители',
    'Busy Drivers': 'Занятые водители',
    'Offline Drivers': 'Оффлайн водители',
    'Total Drivers': 'Всего водителей',
    'Total Clients': 'Всего клиентов',
    'Daily Orders': 'Ежедневные заказы',
    'Weekly Revenue': 'Недельный доход',
    'Driver Activity': 'Активность водителей',

    // Drivers
    'Add Driver': 'Добавить водителя',
    'Manage your fleet drivers': 'Управление водителями',
    'Search drivers...': 'Поиск водителей...',
    'All Status': 'Все статусы',
    'Active': 'Активный',
    'Blocked': 'Заблокирован',
    'Pending': 'Ожидает',
    'Register New Driver': 'Регистрация нового водителя',
    'Personal Information': 'Личная информация',
    'First Name': 'Имя',
    'Last Name': 'Фамилия',
    'Middle Name': 'Отчество',
    'Birth Date': 'Дата рождения',
    'Phone Number': 'Номер телефона',
    'WhatsApp Number': 'Номер WhatsApp',
    'Documents': 'Документы',
    'Passport Number': 'Номер паспорта',
    'Driver License Number': 'Номер водительского удостоверения',
    'Technical Passport Number': 'Номер техпаспорта',
    'Insurance Number': 'Номер страховки',
    'Vehicle Information': 'Информация о транспорте',
    'Vehicle Brand': 'Марка авто',
    'Vehicle Model': 'Модель',
    'Year': 'Год',
    'Color': 'Цвет',
    'Plate Number': 'Гос. номер',
    'Account Status': 'Статус аккаунта',
    'Notes': 'Заметки',
    'Save Driver': 'Сохранить водителя',
    'Cancel': 'Отмена',

    // Dispatcher
    'Create and manage orders': 'Создание и управление заказами',
    'Add Order': 'Добавить заказ',
    'Recent Orders': 'Последние заказы',
    'Create New Order': 'Создать новый заказ',
    'Pickup Address': 'Адрес подачи',
    'Destination Address': 'Адрес назначения',
    'Client Name': 'Имя клиента',
    'Client Phone': 'Телефон клиента',
    'Tariff': 'Тариф',
    'Comment': 'Комментарий',
    'Payment Method': 'Способ оплаты',
    'Cash': 'Наличные',
    'Card': 'Карта',
    'Order Price': 'Стоимость заказа',
    'Create Order': 'Создать заказ',
    'Standard': 'Стандарт',
    'Comfort': 'Комфорт',
    'Business': 'Бизнес',
    'Minivan': 'Минивэн',

    // Status
    'Assigned': 'Назначен',
    'In Progress': 'В пути',
    'Completed': 'Выполнен',
    'Cancelled': 'Отменён',
    'Online': 'Онлайн',
    'Busy': 'Занят',
    'Offline': 'Оффлайн',

    // Tables
    'View all data in tabular format': 'Просмотр данных в таблицах',
    'Orders': 'Заказы',
    'Clients': 'Клиенты',
    'Search...': 'Поиск...',
    'Order': 'Заказ',
    'Client': 'Клиент',
    'Pickup': 'Откуда',
    'Destination': 'Куда',
    'Driver': 'Водитель',
    'Status': 'Статус',
    'Date': 'Дата',
    'Phone': 'Телефон',
    'Vehicle': 'Авто',
    'Plate': 'Номер',
    'Income': 'Доход',

    // Reports
    'Generate and export reports': 'Создание и экспорт отчётов',
    'Export CSV': 'Экспорт CSV',
    'Daily': 'Дневной',
    'Weekly': 'Недельный',
    'Monthly': 'Месячный',
    'Yearly': 'Годовой',
    'Total Orders': 'Всего заказов',
    'Revenue': 'Доход',
    'Price': 'Стоимость',

    // Settings
    'Configure your dispatch system': 'Настройка системы',
    'Company': 'Компания',
    'Company Name': 'Название компании',
    'Company Logo': 'Логотип',
    'Appearance': 'Внешний вид',
    'Theme': 'Тема',
    'Dark': 'Тёмная',
    'Light': 'Светлая',
    'Language': 'Язык',
    'Security': 'Безопасность',
    'Current Password': 'Текущий пароль',
    'New Password': 'Новый пароль',
    'Change Password': 'Сменить пароль',
    'Admin Accounts': 'Аккаунты администраторов',
    'Add Admin Account': 'Добавить аккаунт',
    'Database': 'База данных',
    'Backup Database': 'Резервная копия',
    'Restore Database': 'Восстановить базу',
    'Save Changes': 'Сохранить',
    'Save': 'Сохранить',

    // Map
    'Track your drivers in real-time': 'Отслеживание водителей в реальном времени',

    // Rating
    'Performance metrics and top drivers': 'Показатели и лучшие водители',
    'Monthly Orders': 'Заказов за месяц',
    'Active Drivers': 'Активные водители',
    'Best Driver': 'Лучший водитель',
    'Top 10 Drivers': 'Топ 10 водителей',
    'orders': 'заказов',

    // General
    'Sign In': 'Войти',
    'Email': 'Почта',
    'Password': 'Пароль',
    'Back': 'Назад',
    'Administrator Login': 'Вход администратора',
    'Administrator': 'Администратор',
    'Manage fleet & dispatch': 'Управление автопарком',
    'Accept & complete orders': 'Принимать и выполнять заказы',
    'No drivers found': 'Водители не найдены',
    'No orders yet': 'Заказов пока нет',
    'No available orders': 'Нет доступных заказов',

    // Driver app
    'Available Orders': 'Доступные заказы',
    'Current Order': 'Текущий заказ',
    'Completed Orders': 'Выполненные заказы',
    'Wallet': 'Кошелёк',
    'Profile': 'Профиль',
    'Accept': 'Принять',
    'Reject': 'Отклонить',
    'Navigate': 'Навигация',
    'Complete': 'Завершить',
  },

  kg: {
    'Dashboard': 'Башкаруу панели',
    'Drivers': 'Айдоочулар',
    'Rating': 'Рейтинг',
    'Tables': 'Таблицалар',
    'Dispatcher': 'Диспетчер',
    'Live Map': 'Карта',
    'Reports': 'Отчёттор',
    'Settings': 'Жөндөөлөр',
    'Logout': 'Чыгуу',
    'Sign In': 'Кирүү',
    'Administrator': 'Администратор',
    'Driver': 'Айдоочу',
  },

  en: {},
};

let currentLang = 'ru';

export function setLanguage(lang: string) {
  currentLang = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem('ekidos-lang', lang);
  }
}

export function getLanguage(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('ekidos-lang') || 'ru';
  }
  return currentLang;
}

export function t(key: string): string {
  const lang = getLanguage();
  if (lang === 'en') return key;
  return translations[lang]?.[key] || key;
}
