"use client";

import { ImageOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { displayServerMessage } from "@/features/printing/server-errors";
import { statusLabelKey, statusTone, storeErrorKey, storeImageSrc, type StatusTone, type StockLevel } from "@/features/store/store-rules";
import { useI18n } from "@/i18n/provider";
import { apiErrorText, fieldError } from "@/lib/api/error-message";
import { AppApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<StatusTone, string> = {
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  muted: "border-border bg-muted/60 text-muted-foreground",
  danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
};

/** Order status as a coloured pill with its own Arabic/English wording. */
export function StoreStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 font-semibold", TONE_CLASS[statusTone(status)])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(statusLabelKey(status))}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useI18n();
  return <Badge variant="outline" className={cn("whitespace-nowrap rounded-full", active ? TONE_CLASS.success : TONE_CLASS.muted)}>{active ? t("common.active") : t("store.inactive")}</Badge>;
}

export function StockBadge({ stock, level }: { stock: number; level: StockLevel }) {
  const { t, locale } = useI18n();
  const number = new Intl.NumberFormat(locale === "ar" ? "ar-SY-u-nu-latn" : "en-US").format(stock);
  const tone: StatusTone = level === "out" ? "danger" : level === "low" ? "warning" : "success";
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap rounded-full tabular-nums", TONE_CLASS[tone])}>
      <bdi>{number}</bdi>
      {level === "out" ? <span>{t("store.stock.out")}</span> : level === "low" ? <span>{t("store.stock.low")}</span> : null}
    </Badge>
  );
}

/** A store picture through the BFF (same origin, session token added there); a neutral tile when there is none or it fails to load. */
export function StoreImage({ url, alt = "", className, rounded = "rounded-lg" }: { url: string | null | undefined; alt?: string; className?: string; rounded?: string }) {
  const src = storeImageSrc(url);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = src === null || failedSrc === src;
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden border bg-muted/40 text-muted-foreground", rounded, className)}>
      {failed ? <ImageOff className="size-1/3 min-h-4 min-w-4" aria-hidden="true" /> : (
        // eslint-disable-next-line @next/next/no-img-element -- the BFF streams an authenticated picture; next/image cannot add the session
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailedSrc(src)} />
      )}
    </span>
  );
}

/** Label + control + hint/error, the same shape as the sibling forms. */
export function Field({ label, htmlFor, hint, error, optional, children, className }: { label: string; htmlFor?: string; hint?: string; error?: string | null; optional?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}{optional ? <span className="ms-2 text-xs font-normal text-muted-foreground">{optional}</span> : null}</Label>
      {children}
      {error ? <p role="alert" className="text-xs font-medium text-destructive">{error}</p> : hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Whole-message text of a failed store request: a store code gets its own explanation, anything else the generic HTTP sentence. */
export function useStoreErrorText() {
  const { t } = useI18n();
  return (error: unknown): string => {
    const key = error instanceof AppApiError ? storeErrorKey(error.code) : null;
    return key ? t(key) : apiErrorText(error, t);
  };
}

export function useStoreErrorToast() {
  const text = useStoreErrorText();
  return (error: unknown) => { toast.error(text(error)); };
}

/** Server messages of the named fields of a 400 (shown as is in English, replaced by a generic Arabic line in Arabic). */
export function useServerFieldErrors() {
  const { t, locale } = useI18n();
  return (error: unknown, fields: readonly string[]): Record<string, string> => {
    const found: Record<string, string> = {};
    for (const field of fields) {
      const message = displayServerMessage(fieldError(error, field), locale, t("store.problem.server"));
      if (message) found[field] = message;
    }
    return found;
  };
}
