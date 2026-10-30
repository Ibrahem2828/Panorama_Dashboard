import type { FilterField, FilterOption } from "@/components/filters/filter-types";
import type { MessageKey } from "@/i18n/messages";

export const SUBJECT_DEFAULT_SORT = "-created_at";
export const SUBJECT_SORTS = [SUBJECT_DEFAULT_SORT, "name", "code", "-groups_count"] as const;

const SORT_KEYS: Record<(typeof SUBJECT_SORTS)[number], MessageKey> = {
  "-created_at": "subjects.sort.newest",
  name: "subjects.sort.name",
  code: "subjects.sort.code",
  "-groups_count": "subjects.sort.mostGroups",
};

export function subjectSortOptions(t: (key: MessageKey) => string): FilterOption[] {
  return SUBJECT_SORTS.map((value) => ({ value, label: t(SORT_KEYS[value]) }));
}

/** Filters of `dashboard/subjects/` beyond the academic hierarchy (university -> faculty -> major, year, semester). */
export function subjectFields(t: (key: MessageKey) => string, academic: readonly FilterField[]): FilterField[] {
  return [
    ...academic,
    { kind: "boolean", key: "is_active", label: t("subjects.filter.active"), yesLabel: t("common.active"), noLabel: t("common.inactive"), placement: "advanced" },
    { kind: "boolean", key: "has_groups", label: t("subjects.filter.hasGroups"), placement: "advanced" },
    { kind: "boolean", key: "has_lectures", label: t("subjects.filter.hasLectures"), placement: "advanced" },
    { kind: "boolean", key: "has_files", label: t("subjects.filter.hasFiles"), placement: "advanced" },
  ];
}
