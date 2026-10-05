"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { AppApiError } from "@/lib/api/errors";

const STATUS_MESSAGE_KEYS: Partial<Record<number, MessageKey>> = {
  400: "errors.400",
  401: "errors.401",
  403: "errors.403",
  404: "errors.404",
  409: "errors.409",
  413: "errors.413",
  426: "errors.426",
  429: "errors.429",
  500: "errors.500",
  502: "errors.502",
  503: "errors.503",
  504: "errors.504",
};

export function ErrorPanel({ error, retry }: { error: unknown; retry?: () => void }) {
  const { t } = useI18n();
  const apiError = error instanceof AppApiError ? error : null;
  const translated = apiError
    ? t(STATUS_MESSAGE_KEYS[apiError.status] ?? "errors.500")
    : t("common.unknownError");
  return (
    <Card className="border-destructive/25 bg-destructive/5">
      <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{translated}</p>
          {apiError?.requestId ? <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{t("common.requestId")}: {apiError.requestId}</p> : null}
        </div>
        {retry ? <Button variant="outline" onClick={retry}><RotateCcw />{t("common.retry")}</Button> : null}
      </CardContent>
    </Card>
  );
}
