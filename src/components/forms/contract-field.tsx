"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { FieldSpec } from "@/features/resources/form-schema";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { acceptAttribute, effectiveMaxBytes, uploadPolicyForField, validateUpload, type UploadProblem } from "@/lib/uploads";
import { humanize } from "@/lib/utils";

const BLANK = "__blank__";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

/** Localized label for a field; `spec.label` (an i18n key) wins, then `field.<name>`, then a humanized name. */
export function useFieldLabel() {
  const { tOr } = useI18n();
  return (spec: Pick<FieldSpec, "name" | "label">) => tOr(spec.label ?? `field.${spec.name}`, tOr(`field.${spec.name}`, humanize(spec.name)));
}

/** Localized option label: a role, a known enum value, or the humanized raw value. */
export function useOptionLabel() {
  const { enumLabel } = useI18n();
  return (_fieldName: string, value: string) => enumLabel(value);
}

/** Reads a dashboard collection completely (100 per page, at most 1000 rows), since pickers need every candidate. */
export async function fetchAllPages(endpoint: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const collection = await normalizeCollection<Record<string, unknown>>(await apiFetch(`${endpoint}${separator}page=${page}&page_size=${PAGE_SIZE}`));
    rows.push(...collection.results);
    if (rows.length >= collection.count || collection.results.length < PAGE_SIZE) break;
  }
  return rows;
}

/** One-line label of a related record: name/title, its code, and its parent's name when the API provides it. */
export function relationLabel(item: Record<string, unknown>): string {
  const main = String(item.name ?? item.full_name ?? item.title ?? item.email ?? item.id);
  const code = item.code ? ` · ${String(item.code)}` : "";
  const parent = item.university_name ?? item.faculty_name ?? item.major_name;
  return `${main}${code}${parent ? ` — ${String(parent)}` : ""}`;
}

function FileInput({ spec, id, invalid, describedBy, onChange }: { spec: FieldSpec; id: string; invalid: boolean; describedBy?: string; onChange: (value: unknown) => void }) {
  const { t } = useI18n();
  const [problem, setProblem] = useState<UploadProblem | null>(null);
  const policy = uploadPolicyForField(spec.name);
  const message = problem === "type"
    ? t("upload.type", { types: policy.extensions.map((extension) => extension.toUpperCase()).join(", ") })
    : problem === "size"
      ? t("upload.size", { max: Math.floor(effectiveMaxBytes(policy) / (1024 * 1024)) })
      : problem === "empty"
        ? t("upload.empty")
        : null;
  return (
    <>
      <Input
        id={id}
        type="file"
        accept={acceptAttribute(policy)}
        aria-invalid={invalid || Boolean(problem) ? true : undefined}
        aria-describedby={problem ? `${id}-upload-error` : describedBy}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          const found = file ? validateUpload(file, policy) : null;
          setProblem(found);
          if (found) event.target.value = "";
          onChange(found ? null : file);
        }}
      />
      {message ? <p id={`${id}-upload-error`} role="alert" className="text-xs text-destructive">{message}</p> : null}
    </>
  );
}

function RelationSelect({ spec, id, value, invalid, describedBy, disabled, filterValue, onChange }: { spec: FieldSpec; id: string; value: string; invalid: boolean; describedBy?: string; disabled?: boolean; filterValue?: string; onChange: (value: string) => void }) {
  const { t } = useI18n();
  const label = useFieldLabel()(spec);
  const baseEndpoint = spec.relationEndpoint;
  // A dependent relation (e.g. majors) waits for its parent (the faculty) and then lists only that parent's records.
  const waitingForParent = Boolean(spec.relationFilter) && !filterValue;
  const endpoint = baseEndpoint && spec.relationFilter && filterValue ? `${baseEndpoint}?${spec.relationFilter.param}=${encodeURIComponent(filterValue)}` : baseEndpoint;
  const query = useQuery({
    queryKey: ["reference-options", endpoint],
    queryFn: () => fetchAllPages(endpoint ?? ""),
    enabled: Boolean(endpoint) && !waitingForParent,
    staleTime: 60_000,
  });
  if (!endpoint) return null;
  const options = query.data ?? [];
  // A stored value that is not on the loaded list (inactive or beyond the cap) must still render as selected.
  const known = !value || options.some((item) => String(item.id) === value);
  return (
    <Select value={value === "" ? BLANK : value} onValueChange={(next) => onChange(next === BLANK ? "" : next)} disabled={disabled || waitingForParent}>
      <SelectTrigger id={id} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} aria-busy={query.isPending && !waitingForParent}>
        <SelectValue placeholder={waitingForParent ? t("form.pickParentFirst") : query.isPending ? t("common.loading") : label} />
      </SelectTrigger>
      <SelectContent>
        {!spec.required ? <SelectItem value={BLANK}>—</SelectItem> : null}
        {!known ? <SelectItem value={value}>#{value}</SelectItem> : null}
        {options.map((item) => <SelectItem key={String(item.id)} value={String(item.id)}>{relationLabel(item)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

interface FieldInputProps {
  spec: FieldSpec;
  value: unknown;
  /** Already localized error message for this field, if any. */
  error?: string;
  /** Current value of the field this relation depends on (see FieldSpec.relationFilter). */
  filterValue?: string;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

/** One form control with its label, help text and inline error (aria-invalid / aria-describedby wired up). */
export function ContractFieldInput({ spec, value, error, disabled, filterValue, onChange }: FieldInputProps) {
  const { t, tOr } = useI18n();
  const label = useFieldLabel()(spec);
  const optionLabel = useOptionLabel();
  const id = `field-${spec.name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const invalid = Boolean(error);
  const describedBy = [error ? errorId : null, spec.hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const text = value === null || value === undefined ? "" : String(value);
  const isDisabled = disabled || spec.readOnly;

  let control: React.ReactNode;
  switch (spec.kind) {
    case "boolean":
      control = (
        <div className="flex h-10 items-center justify-between rounded-lg border px-3">
          <span className="text-sm text-muted-foreground">{value ? t("common.enabled") : t("common.disabled")}</span>
          <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} disabled={isDisabled} aria-describedby={describedBy} />
        </div>
      );
      break;
    case "select":
      control = (
        <Select value={text === "" ? BLANK : text} onValueChange={(next) => onChange(next === BLANK ? "" : next)} disabled={isDisabled}>
          <SelectTrigger id={id} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy}><SelectValue placeholder={label} /></SelectTrigger>
          <SelectContent>
            {spec.allowBlank ? <SelectItem value={BLANK}>{tOr("form.all", "All")}</SelectItem> : !spec.required ? <SelectItem value={BLANK}>—</SelectItem> : null}
            {(spec.options ?? []).map((item) => <SelectItem key={item} value={item}>{optionLabel(spec.name, item)}</SelectItem>)}
          </SelectContent>
        </Select>
      );
      break;
    case "relation":
      control = <RelationSelect spec={spec} id={id} value={text} invalid={invalid} describedBy={describedBy} disabled={isDisabled} filterValue={filterValue} onChange={onChange} />;
      break;
    case "textarea":
      control = <Textarea id={id} value={text} onChange={(event) => onChange(event.target.value)} rows={4} maxLength={spec.maxLength} disabled={isDisabled} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} aria-required={spec.required || undefined} />;
      break;
    case "file":
      control = <FileInput spec={spec} id={id} invalid={invalid} describedBy={describedBy} onChange={onChange} />;
      break;
    case "datetime":
      control = <Input id={id} type="datetime-local" value={text} onChange={(event) => onChange(event.target.value)} disabled={isDisabled} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} aria-required={spec.required || undefined} />;
      break;
    case "date":
      control = <Input id={id} type="date" value={text} onChange={(event) => onChange(event.target.value)} disabled={isDisabled} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} aria-required={spec.required || undefined} />;
      break;
    case "integer":
      control = <Input id={id} type="text" inputMode="numeric" autoComplete="off" value={text} onChange={(event) => onChange(event.target.value)} disabled={isDisabled} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} aria-required={spec.required || undefined} />;
      break;
    case "decimal":
      control = <Input id={id} type="text" inputMode="decimal" autoComplete="off" dir="ltr" value={text} onChange={(event) => onChange(event.target.value)} disabled={isDisabled} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} aria-required={spec.required || undefined} />;
      break;
    case "url":
      control = <Input id={id} type="url" inputMode="url" dir="ltr" value={text} onChange={(event) => onChange(event.target.value)} maxLength={spec.maxLength} disabled={isDisabled} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} aria-required={spec.required || undefined} />;
      break;
    default:
      control = <Input id={id} type="text" value={text} onChange={(event) => onChange(event.target.value)} maxLength={spec.maxLength} disabled={isDisabled} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} aria-required={spec.required || undefined} />;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}{spec.required ? <span className="ms-1 text-destructive" aria-hidden="true">*</span> : null}</Label>
      {control}
      {spec.hint ? <p id={hintId} className="text-xs leading-5 text-muted-foreground">{tOr(spec.hint, "")}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
