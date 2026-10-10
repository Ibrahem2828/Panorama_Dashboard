"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
  density: "comfortable" | "compact";
  reduceMotion: boolean;
  sidebarCollapsed: boolean;
  setDensity: (density: PreferencesState["density"]) => void;
  setReduceMotion: (value: boolean) => void;
  toggleSidebar: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      density: "comfortable",
      reduceMotion: false,
      sidebarCollapsed: false,
      setDensity: (density) => set({ density }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    { name: "panorama.ui.preferences", version: 1 },
  ),
);
