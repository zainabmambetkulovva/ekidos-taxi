import { create } from 'zustand';

interface DriverState {
  isOnline: boolean;
  activeOrder: any | null;
  setOnline: (value: boolean) => void;
  setActiveOrder: (order: any | null) => void;
}

// Restore state from localStorage on init
const getInitialState = () => {
  if (typeof window === 'undefined') return { isOnline: false, activeOrder: null };
  try {
    const online = localStorage.getItem('ekidos-driver-online') === 'true';
    const order = localStorage.getItem('ekidos-driver-order');
    return {
      isOnline: online,
      activeOrder: order ? JSON.parse(order) : null,
    };
  } catch {
    return { isOnline: false, activeOrder: null };
  }
};

export const useDriverStore = create<DriverState>((set) => ({
  ...getInitialState(),
  setOnline: (value) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ekidos-driver-online', String(value));
      if (!value) localStorage.removeItem('ekidos-driver-order');
    }
    set({ isOnline: value, ...(value ? {} : { activeOrder: null }) });
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
