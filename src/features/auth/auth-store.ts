"use client";

import { create } from "zustand";

import { clearSession, getAccessToken, getRefreshToken, getUser, setTokens, setUser } from "@/lib/auth/token-storage";
import type { AuthTokens, User } from "@/types/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  hydrate: () => void;
  setSession: (tokens: AuthTokens, user: User) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  hydrate: () => {
    const user = getUser();
    const hasTokens = Boolean(getAccessToken() && getRefreshToken());
    set({
      user,
      isAuthenticated: hasTokens,
      isHydrated: true,
    });
  },
  setSession: (tokens, user) => {
    setTokens(tokens);
    setUser(user);
    set({ user, isAuthenticated: true, isHydrated: true });
  },
  setUser: (user) => {
    setUser(user);
    set({ user });
  },
  clear: () => {
    clearSession();
    set({ user: null, isAuthenticated: false, isHydrated: true });
  },
}));
