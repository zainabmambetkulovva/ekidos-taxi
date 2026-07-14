import { create } from 'zustand';

interface DriverState {
  isOnline: boolean;
  activeOrder: any | null;
  token: string | null;
  setOnline: (v: boolean) => void;
  setActiveOrder: (o: any | null) => void;
  setToken: (t: string | null) => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  isOnline: false,
  activeOrder: null,
  token: null,
  setOnline: (v) => set({ isOnline: v }),
  setActiveOrder: (o) => set({ activeOrder: o }),
  setToken: (t) => set({ token: t }),
}));
