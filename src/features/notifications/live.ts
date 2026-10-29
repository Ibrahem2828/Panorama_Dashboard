"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { InboxNotification } from "@/features/notifications/inbox";

/** The bell polls this often while the tab is visible, and rarely while it is hidden (so the tab title still updates). */
export const LIVE_POLL_VISIBLE_MS = 15_000;
export const LIVE_POLL_HIDDEN_MS = 60_000;
export const SOUND_STORAGE_KEY = "panorama.notifications.sound";

/** React Query `refetchInterval` callback: fast while the tab is visible, slow in the background. */
export function livePollInterval(): number {
  return typeof document !== "undefined" && document.visibilityState === "hidden" ? LIVE_POLL_HIDDEN_MS : LIVE_POLL_VISIBLE_MS;
}

/** `"(3) Title"`: the same title with the unread count in front. Idempotent, and 0 removes the prefix. */
export function withUnreadBadge(title: string, unread: number): string {
  const base = title.replace(/^\(\d+\+?\)\s*/u, "");
  if (unread <= 0) return base;
  return `(${unread > 99 ? "99+" : unread}) ${base}`;
}

/**
 * Unread notifications newer than the last one already shown. The first call (`lastSeenId === null`) only sets the
 * baseline, so opening the dashboard never toasts the whole backlog. Oldest first, so toasts read in order.
 */
export function newArrivals(items: readonly InboxNotification[], lastSeenId: number | null): { fresh: InboxNotification[]; highestId: number | null } {
  const highestId = items.reduce<number | null>((max, item) => (max === null || item.id > max ? item.id : max), lastSeenId);
  if (lastSeenId === null) return { fresh: [], highestId };
  const fresh = items.filter((item) => item.id > lastSeenId && !item.is_read).sort((a, b) => a.id - b.id);
  return { fresh, highestId };
}

export function readSoundEnabled(): boolean {
  try { return window.localStorage.getItem(SOUND_STORAGE_KEY) !== "off"; } catch { return true; }
}
export function writeSoundEnabled(value: boolean) {
  try { window.localStorage.setItem(SOUND_STORAGE_KEY, value ? "on" : "off"); } catch { /* storage blocked: the choice lasts for this page only */ }
}

/** A short two-note chime generated with WebAudio (no audio asset). Silently does nothing where audio is unavailable or blocked. */
export function playChime() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    const start = context.currentTime;
    [[880, 0], [1318.5, 0.14]].forEach(([frequency, offset]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency as number;
      gain.gain.setValueAtTime(0.0001, start + (offset as number));
      gain.gain.exponentialRampToValueAtTime(0.12, start + (offset as number) + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (offset as number) + 0.35);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + (offset as number));
      oscillator.stop(start + (offset as number) + 0.4);
    });
    window.setTimeout(() => void context.close().catch(() => undefined), 1000);
  } catch { /* autoplay policy or no audio device */ }
}

/** User-mutable sound preference, remembered in localStorage. */
export function useSoundPreference() {
  // Lazy initial read: this only renders after the client-side session check, so there is no server HTML to mismatch.
  const [enabled, setEnabled] = useState(readSoundEnabled);
  const update = useCallback((value: boolean) => { setEnabled(value); writeSoundEnabled(value); }, []);
  return [enabled, update] as const;
}

export type BrowserPermission = "unsupported" | NotificationPermission;

export function readBrowserPermission(): BrowserPermission {
  return typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "unsupported";
}

/** Browser (OS-level) notification opt-in: the permission is only ever requested from an explicit click. */
export function useBrowserNotifications() {
  const [permission, setPermission] = useState<BrowserPermission>(readBrowserPermission);
  const request = useCallback(async () => {
    if (readBrowserPermission() === "unsupported") return;
    try { setPermission(await window.Notification.requestPermission()); } catch { setPermission(readBrowserPermission()); }
  }, []);
  return { permission, request };
}

/** Keeps the unread count in the tab title, surviving the title changes made by route navigation. */
export function useTitleBadge(unread: number) {
  useEffect(() => {
    const apply = () => {
      const next = withUnreadBadge(document.title, unread);
      if (next !== document.title) document.title = next;
    };
    apply();
    const target = document.querySelector("title") ?? document.head;
    const observer = new MutationObserver(apply);
    observer.observe(target, { subtree: true, childList: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = withUnreadBadge(document.title, 0);
    };
  }, [unread]);
}

/**
 * Reacts to notifications that arrive while the dashboard is open: calls `onArrival` once per new unread item
 * (after the first load). The caller decides what an arrival looks like (toast, chime, OS notification).
 */
export function useArrivalWatcher(items: readonly InboxNotification[] | undefined, onArrival: (item: InboxNotification, batch: readonly InboxNotification[]) => void) {
  const lastSeen = useRef<number | null>(null);
  const callback = useRef(onArrival);
  useEffect(() => { callback.current = onArrival; });
  useEffect(() => {
    if (!items) return;
    const { fresh, highestId } = newArrivals(items, lastSeen.current);
    lastSeen.current = highestId ?? lastSeen.current ?? 0;
    fresh.forEach((item) => callback.current(item, fresh));
  }, [items]);
}
