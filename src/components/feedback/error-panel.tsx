"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/provider";
import { AppApiError, idempotencyConflict } from "@/lib/api/errors";
import { STATUS_MESSAGE_KEYS } from "@/lib/api/error-message";

export function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useI18n();
  const apiError = error instanceof AppApiError ? error : null;
  const conflict = idempotencyConflict(error);
  const translated = conflict === "reused"
    ? t("idempotency.reused")
    : conflict === "in-progress"
      ? t("idempotency.inProgress")
      : apiError
        ? apiError.code === "BACKEND_NETWORK_UNAVAILABLE" ? t("errors.network") : t(STATUS_MESSAGE_KEYS[apiError.status] ?? "errors.500")
        : t("common.unknownError");
  // API errors carry the request id; render errors carry the Next.js digest. Either lets support find the failure.
  const digest = !apiError && error && typeof error === "object" && "digest" in error && typeof error.digest === "string" ? error.digest : undefined;
  const reference = apiError?.requestId ?? digest;
  return (
    <Card className="border-destructive/25 bg-destructive/5">
      <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{translated}</p>
          {reference ? <p className="mt-1 break-all font-mono text-xs text-muted-foreground" dir="ltr">{t("common.requestId")}: {reference}</p> : null}
        </div>
        {retry ? <Button variant="outline" onClick={retry}><RotateCcw />{t("common.retry")}</Button> : null}
      </CardContent>
    </Card>
  );
}
