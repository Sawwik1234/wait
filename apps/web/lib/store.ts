'use client';

import { create } from 'zustand';

export interface Me {
  id: string;
  username: string;
  role: string;
  xp: number;
  streak: number;
  level: { level: number; into: number; need: number; progress: number };
  balance: { amount: number } | null;
}

export interface Toast {
  id: number;
  kind: 'ok' | 'err' | 'info';
  text: string;
}

export type Lang = 'ru' | 'en';

interface AppState {
  me: Me | null;
  authReady: boolean;
  unread: number;
  lang: Lang;
  toasts: Toast[];
  setMe: (me: Me | null) => void;
  setAuthReady: () => void;
  setUnread: (n: number) => void;
  setBalance: (n: number) => void;
  setLang: (l: Lang) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dropToast: (id: number) => void;
}

export const useStore = create<AppState>((set) => ({
  me: null,
  authReady: false,
  unread: 0,
  lang: 'ru',
  toasts: [],
  setMe: (me) => set({ me, authReady: true }),
  setAuthReady: () => set({ authReady: true }),
  setUnread: (unread) => set({ unread }),
  setBalance: (n) =>
    set((s) => (s.me?.balance ? { me: { ...s.me, balance: { amount: n } } } : {})),
  setLang: (lang) => {
    set({ lang });
    try {
      document.cookie = `ca_lang=${lang};path=/;max-age=31536000`;
    } catch {}
  },
  toast: (text, kind = 'info') =>
    set((s) => ({ toasts: [...s.toasts, { id: Date.now() + Math.random(), kind, text }] })),
  dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const fmt = (n: number): string =>
  n >= 10_000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(Math.round(n));

export const RARITY_COLOR: Record<string, string> = {
  COMMON: '#9aa4b2',
  UNCOMMON: '#4ade80',
  RARE: '#38bdf8',
  EPIC: '#a855f7',
  MYTHIC: '#f43f5e',
};
