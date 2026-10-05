"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, ServerCrash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/browser-client";
import { useI18n } from "@/i18n/provider";

export function BackendReadinessBanner() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["global-backend-readiness"],
    queryFn: () => apiFetch("/api/v1/health/ready/"),
    retry: false,
    refetchInterval: 60_000,
  });
  if (query.isPending || query.isSuccess) return null;
  const status = typeof query.error === "object" && query.error && "status" in query.error ? Number(query.error.status) : 0;
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100 sm:px-5 lg:px-7">
      <div className="mx-auto flex max-w-[var(--app-content-max-width)] items-center gap-3 text-sm">
        {status === 503 ? <ServerCrash className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
        <p className="min-w-0 flex-1 font-semibold">{status === 503 ? t("dashboard.backendDegraded") : t("errors.503")}</p>
        <Button size="sm" variant="ghost" onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.retry")}</Button>
      </div>
    </div>
  );
}
