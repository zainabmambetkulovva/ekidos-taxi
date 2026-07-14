import { create } from 'zustand';
import api from '@/lib/axios';

interface User {
  id: string;
  email?: string;
  firstName: string;
  lastName: string;
  role: string;
  avatar?: string;
  phone?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  driverLogin: (phone: string, code: string) => Promise<any>;
  requestOTP: (phone: string) => Promise<any>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/admin/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    set({ user: data.user, token: data.token, isAuthenticated: true });
  },

  driverLogin: async (phone: string, code: string) => {
    const { data } = await api.post('/auth/driver/verify-otp', { phone, code });
    localStorage.setItem('token', data.token);
    set({ user: { ...data.driver, role: 'DRIVER' }, token: data.token, isAuthenticated: true });
    return data;
  },

  requestOTP: async (phone: string) => {
    const { data } = await api.post('/auth/driver/request-otp', { phone });
    return data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const { data } = await api.get('/auth/me');
      set({ user: data, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
