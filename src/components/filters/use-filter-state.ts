"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  PAGE_PARAM, PAGE_SIZE_PARAM, activeFieldCount, applyChanges, clearAll, hasAnyFilter, readPositiveInt, readValues, toRequestParams,
} from "@/components/filters/filter-state";
import type { FilterSchema, FilterValues } from "@/components/filters/filter-types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export interface FilterState {
  schema: FilterSchema;
  /** Current value per query parameter (only non-empty ones). */
  values: FilterValues;
  page: number;
  pageSize: number;
  /** Active sort (the URL value or the schema default). */
  ordering: string;
  /** Parameters to send to the list endpoint, sort included. */
  requestParams: Record<string, string>;
  /** Request parameters without `omit` (for example summary counts that must ignore the segment). */
  requestParamsWithout: (omit: readonly string[]) => Record<string, string>;
  activeCount: number;
  hasFilters: boolean;
  /** Text of the search box (updates on every key; the URL follows after a short pause). */
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  /** Sets several parameters in one navigation (cascading dependants are cleared, page reset). */
  setValues: (changes: Record<string, string | null | undefined>) => void;
  setValue: (name: string, value: string | null) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  /** "Clear all": filters, search and segment; sorting and page size stay. */
  reset: () => void;
}

/**
 * URL-backed filter state: the query string is the single source of truth (shareable, back/forward safe).
 * Search typing is debounced into the URL; every filter change returns to page 1.
 */
export function useFilterState(schema: FilterSchema, options: { debounceMs?: number } = {}): FilterState {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams?.toString() ?? "";
  // Event handlers read the latest URL and schema through refs (kept current after every commit, never read while rendering).
  const schemaRef = useRef(schema);
  const queryRef = useRef(queryString);
  useEffect(() => { schemaRef.current = schema; queryRef.current = queryString; });

  const values = readValues(new URLSearchParams(queryString), schema);
  const page = readPositiveInt(new URLSearchParams(queryString), PAGE_PARAM, 1);
  const rawSize = readPositiveInt(new URLSearchParams(queryString), PAGE_SIZE_PARAM, 25);
  const pageSize = Math.min(100, Math.max(10, rawSize));

  const push = useCallback((next: URLSearchParams) => {
    const text = next.toString();
    queryRef.current = text;
    router.replace(text ? `?${text}` : "?", { scroll: false });
  }, [router]);

  const setValues = useCallback((changes: Record<string, string | null | undefined>) => {
    push(applyChanges(queryRef.current, schemaRef.current, changes));
  }, [push]);
  const setValue = useCallback((name: string, value: string | null) => setValues({ [name]: value }), [setValues]);
  const setPage = useCallback((next: number) => setValues({ [PAGE_PARAM]: next <= 1 ? null : String(next) }), [setValues]);
  const setPageSize = useCallback((size: number) => setValues({ [PAGE_SIZE_PARAM]: String(size), [PAGE_PARAM]: null }), [setValues]);
  const reset = useCallback(() => push(clearAll(queryRef.current, schemaRef.current)), [push]);

  const searchParam = schema.searchParam;
  const urlSearch = searchParam ? values[searchParam] ?? "" : "";
  const [searchDraft, setSearchDraft] = useState(urlSearch);
  const pushedSearch = useRef(urlSearch);
  const debouncedDraft = useDebouncedValue(searchDraft, options.debounceMs ?? 300);
  useEffect(() => {
    // Only a settled draft reaches the URL (after an external reset the debounced value still lags behind the box).
    // An external URL change is still being copied into the box (the sync effect below): do not push the stale draft over it.
    if (!searchParam || debouncedDraft !== searchDraft || urlSearch !== pushedSearch.current) return;
    const next = debouncedDraft.trim();
    if (next === pushedSearch.current) return;
    pushedSearch.current = next;
    setValues({ [searchParam]: next || null });
  }, [debouncedDraft, searchDraft, searchParam, setValues, urlSearch]);

  // The URL changed from outside (back/forward, chip removal, "clear all"): show it in the box.
  useEffect(() => {
    if (urlSearch !== pushedSearch.current) {
      pushedSearch.current = urlSearch;
      setSearchDraft(urlSearch);
    }
  }, [urlSearch]);
  const ordering = (schema.sortParam ? values[schema.sortParam] : undefined) ?? schema.defaultSort ?? "";
  const requestParams = toRequestParams(values, schema);
  const requestParamsWithout = (omit: readonly string[]) => toRequestParams(values, schema, omit);

  return {
    schema,
    values,
    page,
    pageSize,
    ordering,
    requestParams,
    requestParamsWithout,
    activeCount: activeFieldCount(values, schema),
    hasFilters: hasAnyFilter(values, schema),
    searchDraft,
    setSearchDraft,
    setValues,
    setValue,
    setPage,
    setPageSize,
    reset,
  };
}
