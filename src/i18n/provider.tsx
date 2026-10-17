"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Locale } from "@/config/constants";
import { messages, type MessageKey } from "@/i18n/messages";
import { resolveEnumLabel } from "@/i18n/enum-label";

interface I18nContextValue {
  locale: Locale;
  direction: "rtl" | "ltr";
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
  /** Translation lookup for keys built at run time (e.g. contract field names); returns `fallback` when none exists. */
  tOr: (key: string, fallback: string) => string;
  /** Localized label for a raw API enum/status value; never returns a raw English value in Arabic. */
  enumLabel: (value: unknown) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, values?: Record<string, string | number>) {
  if (!values) return template;
  return Object.entries(values).reduce(
    (value, [key, replacement]) => value.replaceAll(`{${key}}`, String(replacement)),
    template,
  );
}

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: locale === "ar" ? "rtl" : "ltr",
      t: (key, values) => interpolate(messages[locale][key], values),
      enumLabel: (value) => resolveEnumLabel(locale, value),
      tOr: (key, fallback) => (Object.hasOwn(messages[locale], key) ? messages[locale][key as MessageKey] : fallback),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Like `useI18n` but returns null outside a provider (low-level UI primitives that must still render). */
export function useOptionalI18n() {
  return useContext(I18nContext);
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
