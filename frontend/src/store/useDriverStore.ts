import { create } from 'zustand';

interface DriverState {
  isOnline: boolean;
  activeOrder: any | null;
  setOnline: (value: boolean) => void;
  setActiveOrder: (order: any | null) => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  isOnline: false,
  activeOrder: null,
  setOnline: (value) => set({ isOnline: value }),
  setActiveOrder: (order) => set({ activeOrder: order }),
}));
