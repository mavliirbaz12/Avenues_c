"use client";

import { create } from "zustand";

/** Transient UI state: overlays and toasts. Never persisted. */

export type Toast = {
  id: string;
  title: string;
  description?: string;
  tone?: "default" | "success" | "danger";
};

type UIState = {
  cartOpen: boolean;
  searchOpen: boolean;
  menuOpen: boolean;
  toasts: Toast[];

  openCart: () => void;
  closeCart: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  closeAll: () => void;

  toast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
};

let toastSeq = 0;

export const useUI = create<UIState>()((set) => ({
  cartOpen: false,
  searchOpen: false,
  menuOpen: false,
  toasts: [],

  openCart: () => set({ cartOpen: true, searchOpen: false, menuOpen: false }),
  closeCart: () => set({ cartOpen: false }),
  openSearch: () => set({ searchOpen: true, cartOpen: false, menuOpen: false }),
  closeSearch: () => set({ searchOpen: false }),
  openMenu: () => set({ menuOpen: true, cartOpen: false, searchOpen: false }),
  closeMenu: () => set({ menuOpen: false }),
  closeAll: () => set({ cartOpen: false, searchOpen: false, menuOpen: false }),

  toast: (t) => {
    const id = `t${++toastSeq}`;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    // Auto-dismiss. The Toaster also renders a manual close.
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    }, 4200);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
