import { create } from 'zustand';

// Driver line statuses:
// ONLINE - на линии, принимает заказы
// OFFLINE - завершил линию
// BUSY - выполняет заказ (автоматически)
// BUSY_PERSONAL - по делам (не принимает заказы, оранжевый на карте)
export type DriverLineStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'BUSY_PERSONAL';

interface DriverState {
  isOnline: boolean;
  lineStatus: DriverLineStatus;
  activeOrder: any | null;
  setOnline: (value: boolean) => void;
  setLineStatus: (status: DriverLineStatus) => void;
  setActiveOrder: (order: any | null) => void;
}

// Restore state from localStorage on init
const getInitialState = () => {
  if (typeof window === 'undefined') return { isOnline: false, lineStatus: 'OFFLINE' as DriverLineStatus, activeOrder: null };
  try {
    const online = localStorage.getItem('ekidos-driver-online') === 'true';
    const lineStatus = (localStorage.getItem('ekidos-driver-line-status') || 'OFFLINE') as DriverLineStatus;
    const order = localStorage.getItem('ekidos-driver-order');
    return {
      isOnline: online,
      lineStatus,
      activeOrder: order ? JSON.parse(order) : null,
    };
  } catch {
    return { isOnline: false, lineStatus: 'OFFLINE' as DriverLineStatus, activeOrder: null };
  }
};

export const useDriverStore = create<DriverState>((set) => ({
  ...getInitialState(),
  setOnline: (value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ekidos-driver-online', String(value));
      if (!value) {
        localStorage.removeItem('ekidos-driver-order');
        localStorage.setItem('ekidos-driver-line-status', 'OFFLINE');
      } else {
        localStorage.setItem('ekidos-driver-line-status', 'ONLINE');
      }
    }
    set({ isOnline: value, lineStatus: value ? 'ONLINE' : 'OFFLINE', ...(value ? {} : { activeOrder: null }) });
  },
  setLineStatus: (status) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ekidos-driver-line-status', status);
      if (status === 'ONLINE') {
        localStorage.setItem('ekidos-driver-online', 'true');
      } else if (status === 'OFFLINE') {
        localStorage.setItem('ekidos-driver-online', 'false');
        localStorage.removeItem('ekidos-driver-order');
      }
    }
    set({
      lineStatus: status,
      isOnline: status === 'ONLINE' || status === 'BUSY' || status === 'BUSY_PERSONAL',
      ...(status === 'OFFLINE' ? { activeOrder: null } : {}),
    });
  },
  setActiveOrder: (order) => {
    if (typeof window !== 'undefined') {
      if (order) {
        localStorage.setItem('ekidos-driver-order', JSON.stringify(order));
      } else {
        localStorage.removeItem('ekidos-driver-order');
      }
    }
    set({ activeOrder: order });
  },
}));
