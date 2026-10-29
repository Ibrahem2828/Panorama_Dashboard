"use client";

import { useEffect, useRef, useState } from "react";

import type { FilterField, FilterValues } from "@/components/filters/filter-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export type ApplyChanges = (changes: Record<string, string | null>) => void;

const ALL = "__all__";

/** A text/number box that edits locally and writes to the URL after a short pause (no request per key). */
function DraftInput({ id, value, onCommit, className, ...rest }: { id: string; value: string; onCommit: (value: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);
  useEffect(() => {
    if (value !== committed.current) { committed.current = value; setDraft(value); }
  }, [value]);
  const settled = useDebouncedValue(draft, 450);
  useEffect(() => {
    if (settled !== draft || settled === committed.current) return;
    committed.current = settled;
    onCommit(settled);
  }, [draft, onCommit, settled]);
  return <Input id={id} value={draft} onChange={(event) => setDraft(event.target.value)} className={className} {...rest} />;
}

function SelectControl({ field, value, onChange, variant }: { field: Extract<FilterField, { kind: "select" | "cascading-select" }>; value: string; onChange: ApplyChanges; variant: "inline" | "drawer" }) {
  const { t } = useI18n();
  const known = field.options.some((option) => option.value === value);
  return (
    <Select value={value || ALL} onValueChange={(next) => onChange({ [field.key]: next === ALL ? null : next })}>
      <SelectTrigger id={`filter-${field.key}`} className={cn("h-10", variant === "inline" ? "w-full sm:w-44" : "w-full")} aria-label={field.label} aria-busy={field.loading || undefined}>
        <SelectValue placeholder={field.label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{variant === "inline" ? t("filters.allOf", { label: field.label }) : t("common.all")}</SelectItem>
        {field.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        {value && !known ? <SelectItem value={value}>{value}</SelectItem> : null}
      </SelectContent>
    </Select>
  );
}

/** Tri-state toggle: all / yes / no. */
function TriState({ field, value, onChange }: { field: Extract<FilterField, { kind: "boolean" }>; value: string; onChange: ApplyChanges }) {
  const { t } = useI18n();
  const choices = [{ value: "", label: t("common.all") }, { value: "true", label: field.yesLabel ?? t("common.yes") }, { value: "false", label: field.noLabel ?? t("common.no") }];
  return (
    <div role="radiogroup" aria-label={field.label} className="inline-flex w-full rounded-lg border bg-muted/40 p-0.5">
      {choices.map((choice) => (
        <button
          key={choice.value || "all"}
          type="button"
          role="radio"
          aria-checked={value === choice.value}
          onClick={() => onChange({ [field.key]: choice.value || null })}
          className={cn("min-h-9 flex-1 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", value === choice.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function MultiToggle({ field, value, onChange }: { field: Extract<FilterField, { kind: "multi-select" }>; value: string; onChange: ApplyChanges }) {
  const selected = value ? value.split(",") : [];
  const toggle = (option: string) => {
    const next = selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
    onChange({ [field.key]: next.length ? next.join(",") : null });
  };
  return (
    <div role="group" aria-label={field.label} className="flex flex-wrap gap-1.5">
      {field.options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={selected.includes(option.value)}
          onClick={() => toggle(option.value)}
          className={cn("min-h-9 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected.includes(option.value) ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PairInputs({ idBase, label, first, second, values, onChange, type }: { idBase: string; label: string; first: { key: string; label: string }; second: { key: string; label: string }; values: FilterValues; onChange: ApplyChanges; type: "date" | "number" }) {
  const inputProps = type === "number" ? { type: "number" as const, inputMode: "numeric" as const, min: 0 } : { type: "date" as const };
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-${first.key}`} className="text-xs text-muted-foreground">{first.label}</Label>
        {type === "date"
          ? <Input id={`${idBase}-${first.key}`} {...inputProps} value={values[first.key] ?? ""} max={values[second.key] || undefined} onChange={(event) => onChange({ [first.key]: event.target.value || null })} className="h-10" />
          : <DraftInput id={`${idBase}-${first.key}`} {...inputProps} value={values[first.key] ?? ""} onCommit={(next) => onChange({ [first.key]: next || null })} className="h-10" />}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idBase}-${second.key}`} className="text-xs text-muted-foreground">{second.label}</Label>
        {type === "date"
          ? <Input id={`${idBase}-${second.key}`} {...inputProps} value={values[second.key] ?? ""} min={values[first.key] || undefined} onChange={(event) => onChange({ [second.key]: event.target.value || null })} className="h-10" />
          : <DraftInput id={`${idBase}-${second.key}`} {...inputProps} value={values[second.key] ?? ""} onCommit={(next) => onChange({ [second.key]: next || null })} className="h-10" />}
      </div>
    </div>
  );
}

/** Renders one field with the control that fits its kind. `variant` picks the compact inline form or the roomy drawer form. */
export function FilterFieldControl({ field, values, onChange, variant }: { field: FilterField; values: FilterValues; onChange: ApplyChanges; variant: "inline" | "drawer" }) {
  const { t } = useI18n();
  switch (field.kind) {
    case "select":
    case "cascading-select":
      return <SelectControl field={field} value={values[field.key] ?? ""} onChange={onChange} variant={variant} />;
    case "boolean":
      return <TriState field={field} value={values[field.key] ?? ""} onChange={onChange} />;
    case "multi-select":
      return <MultiToggle field={field} value={values[field.key] ?? ""} onChange={onChange} />;
    case "date-range":
      return <PairInputs idBase={`filter-${field.key}`} label={field.label} first={{ key: field.fromKey, label: t("filters.from") }} second={{ key: field.toKey, label: t("filters.to") }} values={values} onChange={onChange} type="date" />;
    case "number-range":
      return <PairInputs idBase={`filter-${field.key}`} label={field.label} first={{ key: field.minKey, label: t("filters.min") }} second={{ key: field.maxKey, label: t("filters.max") }} values={values} onChange={onChange} type="number" />;
    case "date":
      return <Input id={`filter-${field.key}`} type="date" aria-label={field.label} value={values[field.key] ?? ""} onChange={(event) => onChange({ [field.key]: event.target.value || null })} className="h-10" />;
    case "number":
      return (
        <div className="flex items-center gap-2">
          <DraftInput id={`filter-${field.key}`} type="number" inputMode="numeric" min={0} aria-label={field.label} value={values[field.key] ?? ""} onCommit={(next) => onChange({ [field.key]: next || null })} className="h-10" />
          {field.unit ? <span className="shrink-0 text-sm text-muted-foreground">{field.unit}</span> : null}
        </div>
      );
    default:
      return null;
  }
}

/** Whether a field is a plain select (rendered inline without its own visible label). */
export function isSelectLike(field: FilterField): boolean {
  return field.kind === "select" || field.kind === "cascading-select";
}

