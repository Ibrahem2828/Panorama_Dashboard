"use client";

import { useOptionalI18n } from "@/i18n/provider";

/** Screen-reader text of the dialog/sheet close button, localized (Arabic when no provider is mounted). */
export function CloseLabel() {
  const i18n = useOptionalI18n();
  return <span className="sr-only">{i18n ? i18n.t("common.close") : "إغلاق"}</span>;
}
