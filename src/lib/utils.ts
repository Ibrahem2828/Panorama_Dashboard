import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function compactJson(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
