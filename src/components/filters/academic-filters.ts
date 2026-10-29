"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { FilterField, FilterOption, FilterPlacement } from "@/components/filters/filter-types";
import { LOOKUPS, useLookupOptions } from "@/components/filters/use-lookup-options";
import type { MessageKey } from "@/i18n/messages";

export interface AcademicLookups {
  universities: readonly FilterOption[];
  faculties: readonly FilterOption[];
  majors: readonly FilterOption[];
  academicYears: readonly FilterOption[];
  semesters: readonly FilterOption[];
  loading: { faculties: boolean; majors: boolean };
}

/** Placeholder with no options, for building the structure of a schema before anything is loaded. */
export const EMPTY_LOOKUPS: AcademicLookups = { universities: [], faculties: [], majors: [], academicYears: [], semesters: [], loading: { faculties: false, majors: false } };

/**
 * Loads the dropdown choices of the academic hierarchy from the existing lookup endpoints. The cascade (university ->
 * faculty -> major) follows the current URL: faculties are narrowed to the chosen university, majors to the faculty.
 */
export function useAcademicLookups(enabled = true): AcademicLookups {
  const params = useSearchParams();
  const university = params?.get("university") ?? undefined;
  const faculty = params?.get("faculty") ?? undefined;
  const universities = useLookupOptions(LOOKUPS.universities, {}, enabled);
  const faculties = useLookupOptions(LOOKUPS.faculties, { university }, enabled);
  const majors = useLookupOptions(LOOKUPS.majors, { faculty }, enabled);
  const years = useLookupOptions(LOOKUPS.academicYears, {}, enabled);
  const semesters = useLookupOptions(LOOKUPS.semesters, {}, enabled);
  return useMemo(() => ({
    universities: universities.options,
    faculties: faculties.options,
    majors: majors.options,
    academicYears: years.options,
    semesters: semesters.options,
    loading: { faculties: faculties.loading, majors: majors.loading },
  }), [universities.options, faculties.options, majors.options, years.options, semesters.options, faculties.loading, majors.loading]);
}

type Slot = "university" | "faculty" | "major" | "year" | "semester";

/**
 * The shared academic filter fields (parameter names are the list endpoints'): faculty -> major, academic_year,
 * semester inline and university (the root of the cascade) in the advanced drawer unless `placements` says otherwise.
 */
export function academicFields(t: (key: MessageKey) => string, lookups: AcademicLookups, placements: Partial<Record<Slot, FilterPlacement>> = {}): FilterField[] {
  const place = (slot: Slot, fallback: FilterPlacement) => placements[slot] ?? fallback;
  return [
    { kind: "cascading-select", key: "faculty", parent: "university", label: t("filters.faculty"), options: lookups.faculties, loading: lookups.loading.faculties, placement: place("faculty", "primary") },
    { kind: "cascading-select", key: "major", parent: "faculty", label: t("filters.major"), options: lookups.majors, loading: lookups.loading.majors, placement: place("major", "primary") },
    { kind: "select", key: "academic_year", label: t("filters.academicYear"), options: lookups.academicYears, placement: place("year", "primary") },
    { kind: "select", key: "semester", label: t("filters.semester"), options: lookups.semesters, placement: place("semester", "primary") },
    { kind: "select", key: "university", label: t("filters.university"), options: lookups.universities, placement: place("university", "advanced") },
  ];
}
