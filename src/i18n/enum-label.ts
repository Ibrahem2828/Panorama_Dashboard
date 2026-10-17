import type { Locale } from "@/config/constants";
import { messages } from "@/i18n/messages";
import { humanize } from "@/lib/utils";

const PREFIXES = ["status.", "enum.", "roles.", "lectures.status."] as const;

/**
 * Localized label for a raw enum/status value from the API. Looks the value up in the catalog (`status.*`, `enum.*`,
 * `roles.*`, `lectures.status.*`). In Arabic a Latin-script value without an entry is never shown raw: it falls back
 * to the Arabic "unknown" label. Values that are not Latin (numbers, Arabic text) are shown as they are.
 */
export function resolveEnumLabel(locale: Locale, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  const dictionary = messages[locale] as Record<string, string>;
  const normalized = text.toLowerCase();
  for (const candidate of [text, normalized]) {
    for (const prefix of PREFIXES) {
      const key = `${prefix}${candidate}`;
      if (Object.hasOwn(dictionary, key)) return dictionary[key]!;
    }
  }
  if (locale === "ar") return /[A-Za-z]/u.test(text) ? messages.ar["common.unknownValue"] : text;
  return humanize(text);
}
