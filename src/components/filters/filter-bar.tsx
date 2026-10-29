"use client";

import { ArrowDownUp, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterFieldControl, isSelectLike } from "@/components/filters/filter-fields";
import { activeChips, activeFieldCount, advancedActiveCount } from "@/components/filters/filter-state";
import type { FilterField, FilterOption } from "@/components/filters/filter-types";
import type { FilterState } from "@/components/filters/use-filter-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/provider";
import { cn, formatNumber } from "@/lib/utils";

export interface FilterSegment extends FilterOption {
  /** Live count shown on the tab; omitted while it is still loading or unknown. */
  count?: number | null;
}

function dateLabel(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SY" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

/**
 * The shared filter bar: quick segments with counts, search, primary filters, a drawer for advanced filters, removable
 * chips, "clear all", the result count and the sort control. All state lives in the URL (see useFilterState).
 */
export function FilterBar({ state, fields, segments, sortOptions, searchPlaceholder, resultCount, loading, className, onMoreOpenChange, compact = false }: {
  state: FilterState;
  /** Fields with their loaded options. Defaults to the fields the state was created with. */
  fields?: readonly FilterField[];
  /** First option should be the "all" segment (value ""). */
  segments?: readonly FilterSegment[];
  sortOptions?: readonly FilterOption[];
  searchPlaceholder?: string;
  resultCount?: number | null;
  loading?: boolean;
  className?: string;
  /** Lets a page load heavy advanced lookups (for example every group) only once the drawer is opened. */
  onMoreOpenChange?: (open: boolean) => void;
  /** For narrow panes (the chat list): search and one "Filters" button; every field and the sort control live in the drawer. */
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const [drawer, setDrawerState] = useState(false);
  const setDrawer = (open: boolean) => { setDrawerState(open); onMoreOpenChange?.(open); };
  const { values } = state;
  const schema = useMemo(() => (fields ? { ...state.schema, fields } : state.schema), [fields, state.schema]);
  const primary = compact ? [] : schema.fields.filter((field) => (field.placement ?? "primary") === "primary");
  // The drawer holds the advanced fields, or in compact mode every field.
  const advanced = compact ? schema.fields : schema.fields.filter((field) => field.placement === "advanced");
  const advancedActive = compact ? activeFieldCount(values, schema) : advancedActiveCount(values, schema);
  const sortControl = (variant: "bar" | "drawer") => (sortParam && sortOptions?.length ? (
    <Select value={state.ordering || undefined} onValueChange={(next) => state.setValue(sortParam, next === schema.defaultSort ? null : next)}>
      <SelectTrigger className={cn("h-10 shrink-0", variant === "bar" ? "w-full sm:w-48" : "w-full")} aria-label={t("filters.sort")}>
        <ArrowDownUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <SelectValue placeholder={t("filters.sort")} />
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  ) : null);
  const chips = useMemo(
    () => activeChips(values, schema, {
      yes: t("common.yes"), no: t("common.no"), from: t("filters.from"), to: t("filters.to"), min: t("filters.min"), max: t("filters.max"),
      number: (value) => formatNumber(value, locale), date: (value) => dateLabel(value, locale),
    }),
    [values, schema, t, locale],
  );
  const segmentParam = schema.segmentParam;
  const sortParam = schema.sortParam;
  const searchParam = schema.searchParam;
  const clearChip = (clear: string[]) => state.setValues(Object.fromEntries(clear.map((name) => [name, null])));
  const countText = resultCount === null || resultCount === undefined ? "" : t("filters.results", { count: formatNumber(resultCount, locale) });

  const renderField = (field: FilterField, variant: "inline" | "drawer") => (
    <FilterFieldControl field={field} values={values} onChange={state.setValues} variant={variant} />
  );

  return (
    <section aria-label={t("filters.label")} className={cn(compact ? "space-y-2" : "glass-panel space-y-3 rounded-2xl border p-3 sm:p-4", className)}>
      {segmentParam && segments?.length ? (
        <div role="group" aria-label={t("filters.segments")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {segments.map((segment) => {
            const active = (values[segmentParam] ?? "") === segment.value;
            return (
              <button
                key={segment.value || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => state.setValue(segmentParam, segment.value || null)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {segment.label}
                {segment.count !== undefined && segment.count !== null ? (
                  <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-primary-foreground/20" : "bg-muted")} data-testid="segment-count">{formatNumber(segment.count, locale)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={cn("flex gap-2", compact ? "items-center" : "flex-col lg:flex-row lg:flex-wrap lg:items-end")}>
        {searchParam ? (
          <div className="relative min-w-0 flex-1 lg:min-w-[16rem]">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={state.searchDraft}
              onChange={(event) => state.setSearchDraft(event.target.value)}
              placeholder={searchPlaceholder ?? t("filters.searchPlaceholder")}
              aria-label={t("common.search")}
              className="h-10 ps-10 pe-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {state.searchDraft ? (
              <button type="button" onClick={() => state.setSearchDraft("")} aria-label={t("filters.clearSearch")} className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="size-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        ) : null}

        {primary.map((field) => (
          isSelectLike(field)
            ? <div key={field.key} className="w-full sm:w-auto">{renderField(field, "inline")}</div>
            : (
              <div key={field.key} className="w-full space-y-1 sm:w-auto sm:min-w-44">
                <div className="text-xs font-semibold text-muted-foreground">{field.label}</div>
                {renderField(field, "inline")}
              </div>
            )
        ))}

        {advanced.length ? (
          <Button type="button" variant="outline" className="h-10 shrink-0" onClick={() => setDrawer(true)} aria-haspopup="dialog">
            <SlidersHorizontal aria-hidden />
            {compact ? t("common.filters") : t("filters.more")}
            {advancedActive ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground" aria-label={t("filters.activeInMore", { count: advancedActive })}>{formatNumber(advancedActive, locale)}</span> : null}
          </Button>
        ) : null}

        {compact ? null : sortControl("bar")}
      </div>

      {chips.length || state.hasFilters || countText ? (
        <div className="flex flex-wrap items-center gap-2">
          {chips.length ? (
            <ul aria-label={t("filters.active")} className="flex flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <li key={chip.id}>
                  <button
                    type="button"
                    onClick={() => clearChip(chip.clear)}
                    aria-label={t("filters.remove", { label: `${chip.label}: ${chip.value}` })}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full border bg-muted/60 ps-3 pe-2 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-muted-foreground">{chip.label}:</span>
                    <span>{chip.value}</span>
                    <X className="size-3.5 text-muted-foreground" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {state.hasFilters ? <Button type="button" variant="ghost" size="sm" onClick={state.reset}>{t("filters.clearAll")}</Button> : null}
          <p className="ms-auto text-sm text-muted-foreground" role="status" aria-live="polite" aria-busy={loading || undefined}>{loading ? t("filters.updating") : countText}</p>
        </div>
      ) : null}

      {advanced.length ? (
        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetContent side="end" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
            <SheetHeader className="border-b p-5 pe-12">
              <SheetTitle>{compact ? t("common.filters") : t("filters.moreTitle")}</SheetTitle>
              <SheetDescription>{t("filters.moreHint")}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-5 p-5">
              {compact && sortOptions?.length ? (
                <div className="space-y-2">
                  <div className="text-sm font-bold">{t("filters.sort")}</div>
                  {sortControl("drawer")}
                </div>
              ) : null}
              {advanced.map((field) => (
                <div key={field.key} className="space-y-2">
                  <div className="text-sm font-bold">{field.label}</div>
                  {renderField(field, "drawer")}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t p-4">
              <Button type="button" className="flex-1" onClick={() => setDrawer(false)}>{resultCount === null || resultCount === undefined ? t("filters.done") : t("filters.showResults", { count: formatNumber(resultCount, locale) })}</Button>
              {state.hasFilters ? <Button type="button" variant="outline" onClick={state.reset}>{t("filters.clearAll")}</Button> : null}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </section>
  );
}

/** Empty-result block shown inside a list: explains why nothing matches and offers one way out. */
export function FilterEmptyState({ state, message }: { state: Pick<FilterState, "hasFilters" | "reset">; message?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center" data-testid="filter-empty">
      <p className="text-sm text-muted-foreground">{state.hasFilters ? t("filters.noMatches") : (message ?? t("common.noRecords"))}</p>
      {state.hasFilters ? <Button type="button" variant="outline" onClick={state.reset}>{t("filters.clearFilters")}</Button> : null}
    </div>
  );
}
