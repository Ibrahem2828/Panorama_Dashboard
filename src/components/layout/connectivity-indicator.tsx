"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/i18n/provider";

export function ConnectivityIndicator() {
  const [online, setOnline] = useState(true);
  const { t } = useI18n();
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return (
    <div className="hidden items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground xl:flex" title={online ? t("common.online") : t("common.offline")}>
      {online ? <Wifi className="size-3.5 text-emerald-500" /> : <WifiOff className="size-3.5 text-destructive" />}
      {online ? t("common.online") : t("common.offline")}
    </div>
  );
}
