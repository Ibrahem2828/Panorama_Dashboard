import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/config/constants";
import { messages, type MessageKey } from "@/i18n/messages";

export function normalizeLocale(value: string | undefined): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

export function getServerTranslator(locale: Locale) {
  return (key: MessageKey, values?: Record<string, string | number>) => {
    const template = messages[locale][key];
    if (!values) return template;
    return Object.entries(values).reduce(
      (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
      template,
    );
  };
}
