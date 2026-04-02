import { create } from 'zustand';
import api from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('hhl_user') || 'null'),
  token: localStorage.getItem('hhl_token'),
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('hhl_token', data.token);
      localStorage.setItem('hhl_user', JSON.stringify(data.user));
      set({ user: data.user, token: data.token, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    localStorage.removeItem('hhl_token');
    localStorage.removeItem('hhl_user');
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('hhl_token');
    if (!token) return;
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, token });
    } catch {
      localStorage.removeItem('hhl_token');
      localStorage.removeItem('hhl_user');
      set({ user: null, token: null });
    }
  },

  hasRole: (role: string) => {
    return get().user?.roles?.includes(role) ?? false;
  },

  hasPermission: (permission: string) => {
    return get().user?.permissions?.includes(permission) ?? false;
  },
}));
