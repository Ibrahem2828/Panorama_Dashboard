"use client";

import { create } from "zustand";

import type { DashboardSession, SessionUser } from "@/types/auth";

interface AuthState {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  hydrate: () => void;
  setSession: (session: DashboardSession) => void;
  setUser: (user: SessionUser) => void;
  clear: () => void;
}

/** Compatibility store: in-memory user display state only. No credentials persist here. */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  hydrate: () => set({ isHydrated: true }),
  setSession: (session) => set({ user: session.user, isAuthenticated: true, isHydrated: true }),
  setUser: (user) => set({ user }),
  clear: () => set({ user: null, isAuthenticated: false, isHydrated: true }),
}));
