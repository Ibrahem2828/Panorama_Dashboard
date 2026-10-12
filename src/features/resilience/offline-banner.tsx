"use client";

import { WifiOff } from "lucide-react";

import { useOnline } from "@/hooks/use-online";
import { useI18n } from "@/i18n/provider";

/** React Query's onlineManager is the single source of truth: it also pauses queries/mutations while offline. */
export function OfflineBanner() {
  const online = useOnline();
  const { t } = useI18n();
  if (online) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-black">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      {t("resilience.offline.banner")}
    </div>
  );
}
