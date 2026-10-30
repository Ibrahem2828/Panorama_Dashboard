"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { fetchAllPages } from "@/components/forms/contract-field";
import type { FilterOption } from "@/components/filters/filter-types";

export const LOOKUPS = {
  universities: "/api/v1/dashboard/universities/",
  faculties: "/api/v1/dashboard/faculties/",
  majors: "/api/v1/dashboard/majors/",
  academicYears: "/api/v1/dashboard/academic-years/",
  semesters: "/api/v1/dashboard/semesters/",
  subjects: "/api/v1/dashboard/subjects/",
  groups: "/api/v1/dashboard/groups/",
} as const;

/** Appends non-empty parameters to an endpoint. */
export function withQuery(endpoint: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) if (value) query.set(name, value);
  const text = query.toString();
  return text ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}${text}` : endpoint;
}

/** Display name of a lookup record for a dropdown. */
export function lookupLabel(item: Record<string, unknown>): string {
  return String(item.name ?? item.title ?? item.full_name ?? item.id);
}

/**
 * Dropdown choices from one of the existing lookup endpoints (cached for 5 minutes, shared between pages).
 * `params` narrows the list for a cascade (for example `faculties/?university=3`).
 */
export function useLookupOptions(endpoint: string, params: Record<string, string | undefined> = {}, enabled = true): { options: FilterOption[]; loading: boolean } {
  const url = withQuery(endpoint, params);
  const query = useQuery({ queryKey: ["filter-lookup", url], queryFn: () => fetchAllPages(url), staleTime: 5 * 60_000, enabled });
  const options = useMemo(
    () => (query.data ?? []).filter((item) => item.id !== null && item.id !== undefined).map((item) => ({ value: String(item.id), label: lookupLabel(item) })),
    [query.data],
  );
  return { options, loading: query.isPending && enabled };
}
