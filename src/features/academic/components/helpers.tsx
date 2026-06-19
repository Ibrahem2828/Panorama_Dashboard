import type { AcademicEntity } from "@/features/academic/types";

export function getRelatedName(value: unknown) {
  if (!value) {
    return "-";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object" && "name" in value) {
    return String((value as AcademicEntity).name ?? "-");
  }
  return "-";
}

export function formatDate(value?: string) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
