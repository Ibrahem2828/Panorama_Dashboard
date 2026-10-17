import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { messages } from "@/i18n/messages";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/gu, (character) => character.toUpperCase());
}

export function formatDate(value: unknown, locale = "ar") {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SY" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatNumber(value: unknown, locale = "ar") {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat(locale === "ar" ? "ar-SY" : "en-US").format(number) : "—";
}

/** Human readable size with localized units: 842 بايت, 12.0 ك.ب, 3.4 م.ب, 1.2 غ.ب (B / KB / MB / GB in English). */
export function formatFileSize(bytes: unknown, locale = "ar"): string {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "—";
  const dictionary = messages[locale === "ar" ? "ar" : "en"];
  const number = (value: number, digits: number) => new Intl.NumberFormat(locale === "ar" ? "ar-SY" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  if (size < 1024) return `${number(size, 0)} ${dictionary["common.unit.bytes"]}`;
  if (size < 1024 * 1024) return `${number(size / 1024, 1)} ${dictionary["common.unit.kb"]}`;
  if (size < 1024 * 1024 * 1024) return `${number(size / (1024 * 1024), 1)} ${dictionary["common.unit.mb"]}`;
  return `${number(size / (1024 * 1024 * 1024), 1)} ${dictionary["common.unit.gb"]}`;
}

export function compactJson(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
