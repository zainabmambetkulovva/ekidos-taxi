# EKIDOS TAXI — Dispatch Management System

Токтогул шаары үчүн толук такси диспетчердик системасы.

---

## 🛠 ТЕХНОЛОГИЯЛАР (Tech Stack)

### Backend — `backend/`
**Тил: TypeScript (Node.js)**

| Технология | Версия | Эмне үчүн |
|------------|--------|-----------|
| **Node.js** | 18+ | JavaScript серверде иштетүү платформасы |
| **Express.js** | 4.21 | HTTP API маршруттары жана middleware |
| **TypeScript** | 5.6 | Типтик коопсуздук, ката табуу оңоюраак |
| **Prisma ORM** | 5.22 | PostgreSQL базасы менен иштөө (SQL жазбай) |
| **PostgreSQL** | 15 | Негизги маалымат базасы (15 таблица) |
| **Socket.IO** | 4.8 | WebSocket — реалтайм байланыш (заказ, чат, GPS) |
| **JWT** | 9.0 | Аутентификация токендери (30 күнгө) |
| **bcrypt** | 6.0 | Паролдарды шифрлөө (hash) |
| **Cloudinary** | 1.41 | Сүрөт сактоо сервиси (чектер, документтер) |
| **Resend** | 6.18 | Email жөнөтүү (OTP коддор) |
| **Helmet** | 8.3 | HTTP коопсуздук header'лери |
| **Rate Limit** | 8.5 | Логинге 5 аракет/мүнөт чектөө |
| **Multer** | 1.4 | Файл жүктөө (form-data) |

**Башкы файлдар:**
```
backend/src/
├── server.ts           ← БАШКЫ ФАЙЛ — бардыгын иштетет
├── socket/index.ts     ← WebSocket обработчиктери
├── routes/
│   ├── auth.routes.ts      ← Кирүү/Чыгуу (admin, driver, client)
│   ├── order.routes.ts     ← Заказдар (түзүү, кабыл алуу, бүтүрүү)
│   ├── driver.routes.ts    ← Водителдер (CRUD, баланс, GPS)
│   ├── chat.routes.ts      ← Жалпы группа чат
│   ├── dm.routes.ts        ← Жеке билдирүүлөр (DM)
│   ├── stats.routes.ts     ← Dashboard статистика + графиктер
│   ├── report.routes.ts    ← Отчёттор (CSV экспорт)
│   ├── settings.routes.ts  ← Система жөндөөлөрү
│   └── topup.routes.ts     ← Баланс толуктоо запростору
├── lib/
│   └── tariff.ts           ← Баа эсептөө (18 сом/км, мин 110 сом)
└── middleware/
    └── auth.middleware.ts  ← JWT токен текшерүү
```

---

### Frontend — `frontend/`
**Тил: TypeScript + TSX (React)**

| Технология | Версия | Эмне үчүн |
|------------|--------|-----------|
| **Next.js** | 15.0 | React фреймворк (SSR, routing, API) |
| **React** | 19.0 | UI компоненттер библиотекасы |
| **TypeScript** | 5.6 | Типтик коопсуздук |
| **Tailwind CSS** | 3.4 | Utility-first CSS стилдөө |
| **Shadcn UI** | — | Radix UI негизинде UI компоненттер |
| **Framer Motion** | 11.0 | Анимациялар жана өтүүлөр |
| **Socket.IO Client** | 4.8 | WebSocket байланышы |
| **React Leaflet** | 4.2 | OpenStreetMap интерактивдүү карталар |
| **Zustand** | 5.0 | Global state (driver status, auth) |
| **TanStack Query** | 5.61 | Серверден маалымат алуу + кэш |
| **Recharts** | 2.13 | Графиктер жана диаграммалар |
| **Axios** | 1.7 | HTTP клиент (API чалуулар) |
| **Zod** | 3.23 | Form валидация схемалары |
| **React Hook Form** | 7.53 | Form башкаруу |
| **Lucide React** | 0.460 | Иконкалар |
| **Sonner** | 1.7 | Toast уведомлениялар |

**Башкы файлдар:**
```
frontend/src/
├── app/
│   ├── admin/dashboard/
│   │   ├── layout.tsx      ← Админ sidebar + navigation
│   │   ├── page.tsx        ← Dashboard (статистика + графиктер)
│   │   ├── drivers/        ← Водителдерди башкаруу (CRUD)
│   │   ├── dispatcher/     ← Заказ кошуу + тизмеси
│   │   ├── map/            ← Жандуу карта (GPS трекинг)
│   │   ├── balance/        ← Баланс толуктоо запростору
│   │   ├── chat/           ← Жалпы чат + жеке DM
│   │   ├── rating/         ← Рейтинг + графиктер
│   │   ├── reports/        ← Отчёттор + CSV экспорт
│   │   ├── archive/        ← Аткарылган заказдар тарыхы
│   │   └── settings/       ← Тил, компания, пароль
│   │
│   └── driver/dashboard/
│       ├── layout.tsx      ← Водитель header + bottom tabs (НЕОН статус)
│       ├── page.tsx        ← GPS карта + заказ кабыл алуу
│       ├── chat/           ← Жалпы чат + жеке DM
│       ├── orders/         ← Жеткиликтүү заказдар
│       ├── archive/        ← Аткарылган заказдар
│       └── profile/        ← Профиль
│
├── lib/
│   ├── sounds.ts           ← Звук эффекттери (WAV генерация)
│   ├── translations.ts     ← 3 тил: Орусча, Кыргызча, Англисча
│   ├── axios.ts            ← HTTP клиент (JWT auto-header)
│   └── socket.ts           ← Socket.IO конфигурация
│
└── store/
    ├── useDriverStore.ts   ← Водитель статусу, активдүү заказ
    └── useLanguageStore.ts ← Тил тандоо
```

---

### Mobile — `mobile/`
**Тил: TypeScript (React Native)**

| Технология | Версия | Эмне үчүн |
|------------|--------|-----------|
| **React Native** | 0.86 | Кросс-платформа мобилдик (Android/iOS) |
| **Expo** | 57 | Development жана build тездетүү |
| **expo-notifications** | 57 | Firebase Push уведомлениялар |
| **expo-location** | 57 | GPS геолокация |
| **react-native-webview** | 13 | Frontend'ти мобилдик аппта ачуу |

**Башкы файл:** `mobile/app/index.tsx`
- Frontend URL'ди WebView аркылуу ачат
- Push notifications'ды кабыл алат
- GPS'ти frontend'ке жиберет
- Жаңы заказда телефон дирилдейт

---

### Bot — `bot/`
**Тил: Python 3**

| Технология | Версия | Эмне үчүн |
|------------|--------|-----------|
| **aiogram** | 3.x | Telegram Bot Framework |
| **aiohttp** | 3.x | Async HTTP Backend'ке запрос |

**Башкы файл:** `bot/bot.py`
- Водитель `/start` жиберет → позывной сурайт
- Чек сүрөтүн жөнөтөт → бот текстти окуйт
- "Нурияз,М" алуучу + бүгүнкү дата текшерет
- Туура болсо → backend'ке топап запросу жиберет
- Айдоочунун балансы чыга түшөт

---

### ekidos-client — `ekidos-client/`
**Тил: TypeScript + TSX**

| Технология | Версия | Эмне үчүн |
|------------|--------|-----------|
| **Next.js** | 15.5 | Клиент веб-тиркемеси |
| **Leaflet** | 1.9 | Карта (откуда/куда тандоо) |
| **Socket.IO** | 4.8 | Реалтайм водитель жайгашуусу |

---

## 🗄️ МААЛЫМАТ БАЗАСЫ (15 таблица)

```
admins          — Администраторлор
drivers         — Водителдер (GPS, баланс, рейтинг, позывной)
vehicles        — Унаалар (марка, модель, номер)
orders          — Заказдар (маршрут, баа, статус)
clients         — Клиенттер
payments        — Төлөмдөр
documents       — Документтер (права, паспорт фото)
notifications   — Уведомлениялар
reports         — Отчёттор
driver_status_logs — Статус тарыхы
otps            — OTP коддор + клиент паролдор
settings        — Система жөндөөлөрү
topup_requests  — Баланс толуктоо запростору
chat_messages   — Жалпы чат билдирүүлөр
direct_messages — Жеке билдирүүлөр (DM)
```

---

## 🚀 ДЕПЛОЙ

| Сервис | Эмне | URL |
|--------|------|-----|
| **Railway** | Backend + PostgreSQL | ekidos-taxi-production-587e.up.railway.app |
| **Vercel** | Frontend (admin+driver) | ekidos-taxi-frontend.vercel.app |
| **Vercel** | Client app | ekidos-client.vercel.app |
| **Expo EAS** | Android APK | com.ekidos.driver |
| **Cloudinary** | Сүрөт сактоо | — |

---

## ⚙️ ЛОКАЛДУУ ИШТЕТҮҮ

```bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev  # localhost:5000

# Frontend
cd frontend
npm install
npm run dev  # localhost:3000
```

**Default Admin:**
- Email: `admin@ekidos.kg`
- Password: `EKIDOS@2025`
