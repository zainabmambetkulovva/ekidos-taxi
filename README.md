# EKIDOS TAXI - Dispatch Management System

A production-ready taxi dispatch and fleet management system with real-time capabilities.

## Tech Stack

### Frontend
- Next.js 15 + React 19
- TypeScript
- Tailwind CSS + Shadcn UI
- Framer Motion
- React Hook Form + Zod
- Zustand (state management)
- TanStack Query
- Socket.IO Client
- React Leaflet + OpenStreetMap
- Recharts
- Lucide React Icons

### Backend
- Node.js + Express.js
- Prisma ORM + PostgreSQL
- Socket.IO
- JWT Authentication + bcrypt
- Cloudinary + Multer

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- npm or yarn

### 1. Clone and Install

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Database Setup

Make sure PostgreSQL is running, then:

```bash
cd backend

# Create database
# In psql: CREATE DATABASE ekidos_taxi;

# Run migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed default admin account


```

### 3. Environment Variables

Backend `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ekidos_taxi"
JWT_SECRET="ekidos-taxi-jwt-secret-2025-production"
JWT_REFRESH_SECRET="ekidos-taxi-refresh-secret-2025-production"
PORT=5000
CLIENT_URL="http://localhost:3000"
```

Frontend `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### 4. Run Development

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 5. Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Default Admin Account
- Email: `admin@ekidos.kg`
- Password: `EKIDOS@2025`

---

## Project Structure

```
ekidos-taxi/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── socket/
│   │   └── server.ts
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/
│   │   │   ├── driver/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   └── providers.tsx
│   │   ├── lib/
│   │   ├── store/
│   │   └── ...
│   └── package.json
└── README.md
```

## Features

- Real-time order dispatching via Socket.IO
- Admin dashboard with live statistics
- Driver registration and management
- Live map with driver tracking
- Order lifecycle management
- Financial reports and exports
- OTP-based driver authentication
- Premium dark UI with glassmorphism
- Fully responsive design


src/app/
│
├── (admin)/                 <-- Кашаа менен ач. Бул компьютер үчүн дизайн
│   ├── admin-dashboard/     <-- Ичине кадимки папка: page.tsx (Админдин башкы бети)
│   ├── dispatcher/          <-- Ичине кадимки папка: page.tsx (Диспетчердин бети)
│   ├── layout.tsx           <-- Бул жерге компьютердин каптал менюсун (Sidebar) жазасың
│   └── page.tsx             <-- Бул жалпы кирүү (Login) бети болушу мүмкүн
│
└── (driver)/                <-- Кашаа менен ач. Бул телефондор үчүн дизайн
    ├── driver-dashboard/    <-- Ичине кадимки папка: page.tsx (Айдоочунун башкы бети)
    ├── orders/              <-- Ичине кадимки папка: page.tsx (Заказдар тизмеси)
    └── layout.tsx           <-- Бул жерге телефондун астындагы менюсун (Bottom Nav) жазасың