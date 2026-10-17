import { z } from "zod";

import type { ContractField, ResourceDefinition } from "@/contracts/types";
import { REFERENCE_ENDPOINTS } from "@/features/resources/reference-options";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime";

/**
 * Field model of the generic resource forms. A `FieldSpec` is derived from the generated OpenAPI contract field
 * (type/format/required/limits) and refined by a hand-written per-resource override (policy), so the forms stay
 * contract-driven while knowing the backend rules the OpenAPI cannot express (real integer ranges, relations, ...).
 *
 * Validation messages are i18n keys (`validation.*`, optionally `key:arg`); `formatFieldError` renders them.
 */
export type FieldKind = "text" | "textarea" | "integer" | "decimal" | "boolean" | "select" | "relation" | "datetime" | "date" | "url" | "file";

export interface FieldSpec {
  name: string;
  kind: FieldKind;
  required: boolean;
  /** An emptied optional field is sent as null on edit (clears it) instead of being left out. */
  nullable: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  options?: readonly string[];
  /** Decimal only: how many digits after the point are accepted (default 2). */
  decimalPlaces?: number;
  /** Select only: the empty value is a real choice (for example "all platforms"). */
  allowBlank?: boolean;
  relationEndpoint?: string;
  /** The options of this relation are narrowed by another field of the same form (e.g. majors of the selected faculty). */
  relationFilter?: { param: string; from: string };
  defaultValue?: unknown;
  readOnly?: boolean;
  /** i18n key of a help text rendered under the input. */
  hint?: string;
  /** i18n key overriding the generic `field.<name>` label. */
  label?: string;
}

export type FieldOverride = Partial<Omit<FieldSpec, "name">>;
export type FormMode = "create" | "edit";
export type FieldErrors = Record<string, string>;

/** A rule across several fields, checked only when every field is valid. Returns the offending field and message key. */
export interface CrossRule {
  check: (values: Record<string, unknown>) => { field: string; error: string } | null;
}

const MAX_POSITIVE_INTEGER = 2_147_483_647;
const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/u;
const INTEGER_PATTERN = /^-?\d+$/u;
export const DECIMAL_MAX_INTEGER_DIGITS = 10;
export const DECIMAL_MAX_PLACES = 2;

function deriveKind(field: ContractField): FieldKind {
  if (field.input === "switch") return "boolean";
  if (field.input === "file") return "file";
  if (field.input === "select" && field.enum) return "select";
  if (REFERENCE_ENDPOINTS[field.name] && field.type === "integer") return "relation";
  if (field.format === "decimal") return "decimal";
  if (field.format === "uri") return "url";
  if (field.input === "date") return "date";
  if (field.input === "datetime-local") return "datetime";
  if (field.type === "integer") return "integer";
  if (field.input === "textarea" || field.input === "json") return "textarea";
  return "text";
}

export function specFromContract(field: ContractField, override: FieldOverride = {}): FieldSpec {
  const kind = override.kind ?? deriveKind(field);
  const spec: FieldSpec = {
    name: field.name,
    kind,
    required: field.required,
    nullable: field.nullable,
    minLength: field.minLength ?? undefined,
    maxLength: field.maxLength ?? undefined,
    options: field.enum ? field.enum.filter((item): item is string => typeof item === "string") : undefined,
    relationEndpoint: kind === "relation" ? REFERENCE_ENDPOINTS[field.name] : undefined,
    defaultValue: field.name === "is_active" ? true : field.defaultValue ?? undefined,
  };
  if (kind === "integer") {
    // The generated contract declares int64; the real model columns are far smaller, so clamp to a sane bound.
    spec.min = field.minimum ?? undefined;
    spec.max = field.maximum !== null && field.maximum < MAX_POSITIVE_INTEGER ? field.maximum : MAX_POSITIVE_INTEGER;
  }
  return { ...spec, ...override, name: field.name };
}

/** Specs for `names` (in that order), each overridden by `overrides[name]`; unknown contract fields are skipped. */
export function resolveFieldSpecs(definition: Pick<ResourceDefinition, "fields">, names: readonly string[], overrides: Record<string, FieldOverride> = {}): FieldSpec[] {
  const byName = new Map(definition.fields.map((field) => [field.name, field]));
  return names.flatMap((name) => {
    const field = byName.get(name);
    return field ? [specFromContract(field, overrides[name])] : [];
  });
}

/** `YYYY-MM-DD` that is a real calendar day (the format a date-only API field expects). */
export function isCalendarDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function isEmpty(raw: unknown) {
  return raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "");
}

type Parsed = { ok: true; value: unknown } | { ok: false; error: string };
const fail = (error: string): Parsed => ({ ok: false, error });
const pass = (value: unknown): Parsed => ({ ok: true, value });

/** Validates one raw form value. `value === undefined` means "leave this field out of the request". */
export function parseField(spec: FieldSpec, raw: unknown, mode: FormMode): Parsed {
  if (spec.kind === "boolean") return pass(Boolean(raw));
  if (spec.kind === "file") {
    if (typeof File !== "undefined" && raw instanceof File) return pass(raw);
    return spec.required && mode === "create" ? fail("validation.required") : pass(undefined);
  }
  if (isEmpty(raw)) {
    if (spec.kind === "select" && spec.allowBlank && typeof raw === "string") return pass("");
    if (spec.required) return fail("validation.required");
    if (mode === "create") return pass(undefined);
    if (spec.kind === "text" || spec.kind === "textarea" || spec.kind === "url") return pass(spec.nullable ? null : "");
    return pass(spec.nullable ? null : undefined);
  }
  const text = typeof raw === "string" ? raw.trim() : String(raw);
  switch (spec.kind) {
    case "text":
    case "textarea": {
      if (spec.minLength !== undefined && text.length < spec.minLength) return fail(`validation.minLength:${spec.minLength}`);
      if (spec.maxLength !== undefined && text.length > spec.maxLength) return fail(`validation.maxLength:${spec.maxLength}`);
      if (spec.pattern && !new RegExp(spec.pattern, "u").test(text)) return fail("validation.pattern");
      return pass(text);
    }
    case "url": {
      if (spec.maxLength !== undefined && text.length > spec.maxLength) return fail(`validation.maxLength:${spec.maxLength}`);
      try {
        const url = new URL(text);
        if (url.protocol !== "https:" && url.protocol !== "http:") return fail("validation.url");
      } catch {
        return fail("validation.url");
      }
      return pass(text);
    }
    case "integer": {
      if (!INTEGER_PATTERN.test(text)) return fail("validation.integer");
      const value = Number(text);
      if (!Number.isSafeInteger(value)) return fail("validation.integer");
      if (spec.min !== undefined && value < spec.min) return fail(`validation.min:${spec.min}`);
      if (spec.max !== undefined && value > spec.max) return fail(`validation.max:${spec.max}`);
      return pass(value);
    }
    case "relation": {
      if (!/^\d+$/u.test(text) || Number(text) < 1) return fail("validation.relation");
      return pass(Number(text));
    }
    case "decimal": {
      if (text.startsWith("-")) return fail("validation.nonNegative");
      if (!DECIMAL_PATTERN.test(text)) return fail("validation.decimal");
      const [whole = "", fraction = ""] = text.split(".");
      const places = spec.decimalPlaces ?? DECIMAL_MAX_PLACES;
      if (fraction.length > places) return fail(`validation.decimalPlaces:${places}`);
      if (whole.replace(/^0+(?=\d)/u, "").length > DECIMAL_MAX_INTEGER_DIGITS) return fail(`validation.decimalDigits:${DECIMAL_MAX_INTEGER_DIGITS}`);
      return pass(text);
    }
    case "select": {
      if (!spec.options?.includes(text)) return fail("validation.option");
      return pass(text);
    }
    case "date": {
      return isCalendarDate(text) ? pass(text) : fail("validation.date");
    }
    case "datetime": {
      const iso = localInputToIso(text);
      return iso ? pass(iso) : fail("validation.datetime");
    }
  }
  return pass(text);
}

/** Cross-field rule: `end` must come after `start` (or equal, when `allowEqual`). Both are parsed ISO instants. */
export function endAfterStart(start: string, end: string, allowEqual = false): CrossRule {
  return {
    check(values) {
      const from = typeof values[start] === "string" ? Date.parse(values[start] as string) : Number.NaN;
      const to = typeof values[end] === "string" ? Date.parse(values[end] as string) : Number.NaN;
      if (Number.isNaN(from) || Number.isNaN(to)) return null;
      return (allowEqual ? to < from : to <= from) ? { field: end, error: "validation.endAfterStart" } : null;
    },
  };
}

export type ValidationResult = { ok: true; payload: Record<string, unknown> } | { ok: false; errors: FieldErrors };

/** Validates every field (zod schema built from the specs) plus cross rules; returns the typed payload or per-field message keys. */
export function validateForm(specs: readonly FieldSpec[], values: Record<string, unknown>, mode: FormMode, crossRules: readonly CrossRule[] = []): ValidationResult {
  const active = specs.filter((spec) => !spec.readOnly);
  const shape: Record<string, z.ZodType> = {};
  for (const spec of active) {
    shape[spec.name] = z.unknown().transform((raw, ctx) => {
      const parsed = parseField(spec, raw, mode);
      if (!parsed.ok) {
        ctx.addIssue({ code: "custom", message: parsed.error });
        return z.NEVER;
      }
      return parsed.value;
    });
  }
  const schema = z.object(shape).superRefine((parsed, ctx) => {
    for (const rule of crossRules) {
      const problem = rule.check(parsed as Record<string, unknown>);
      if (problem) ctx.addIssue({ code: "custom", path: [problem.field], message: problem.error });
    }
  });
  const input = Object.fromEntries(active.map((spec) => [spec.name, values[spec.name] ?? undefined]));
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !(field in errors)) errors[field] = issue.message;
    }
    return { ok: false, errors };
  }
  const payload = Object.fromEntries(Object.entries(result.data as Record<string, unknown>).filter(([, value]) => value !== undefined));
  return { ok: true, payload };
}

/** Initial raw form values: the record's values (dates converted for datetime-local inputs) or the spec defaults. */
export function initialFormValues(specs: readonly FieldSpec[], entity?: Record<string, unknown> | null): Record<string, unknown> {
  return Object.fromEntries(specs.map((spec) => {
    const source = entity ? entity[spec.name] : spec.defaultValue;
    switch (spec.kind) {
      case "boolean": return [spec.name, Boolean(source)];
      case "datetime": return [spec.name, isoToLocalInput(source)];
      case "date": return [spec.name, source === "today" ? localToday() : typeof source === "string" ? source.slice(0, 10) : ""];
      case "file": return [spec.name, null];
      case "relation": case "integer": case "decimal": case "select":
        return [spec.name, source === null || source === undefined ? "" : String(source)];
      default: return [spec.name, typeof source === "string" ? source : source == null ? "" : String(source)];
    }
  }));
}

function sameValue(spec: FieldSpec, next: unknown, original: unknown): boolean {
  if (spec.kind === "file") return false;
  if (spec.kind === "datetime") {
    const left = typeof next === "string" ? Date.parse(next) : null;
    const right = typeof original === "string" ? Date.parse(original) : null;
    return left === right;
  }
  if (spec.kind === "decimal" || spec.kind === "integer" || spec.kind === "relation") {
    if (next === null || next === undefined || original === null || original === undefined) return (next ?? null) === (original ?? null);
    return Number(next) === Number(original);
  }
  if (spec.kind === "boolean") return Boolean(next) === Boolean(original);
  return (next ?? "") === (original ?? "");
}

/** PATCH payload: only the fields whose validated value differs from the stored record. */
export function changedFields(specs: readonly FieldSpec[], payload: Record<string, unknown>, entity: Record<string, unknown>): Record<string, unknown> {
  const byName = new Map(specs.map((spec) => [spec.name, spec]));
  return Object.fromEntries(Object.entries(payload).filter(([name, value]) => {
    const spec = byName.get(name);
    return spec ? !sameValue(spec, value, entity[name]) : true;
  }));
}

/** Multipart body for payloads that carry a file; JSON-incompatible `null`s are left out (multipart cannot express them). */
export function toFormData(payload: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (typeof File !== "undefined" && value instanceof File) form.append(name, value);
    else form.append(name, typeof value === "boolean" ? (value ? "true" : "false") : String(value));
  }
  return form;
}

export function hasFile(payload: Record<string, unknown>): boolean {
  return typeof File !== "undefined" && Object.values(payload).some((value) => value instanceof File);
}

/**
 * Maps a backend validation error body (`{ field: ["msg"], non_field_errors: [...], detail: "..." }`) to the form: messages
 * for fields on the form are attached to them, everything else becomes one general message.
 */
export function mapServerErrors(errors: unknown, fieldNames: readonly string[]): { fields: FieldErrors; general: string | null } {
  const fields: FieldErrors = {};
  const general: string[] = [];
  const text = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" ");
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).map(text).filter(Boolean).join(" ");
    return "";
  };
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
      const message = text(value);
      if (!message) continue;
      if (fieldNames.includes(key)) fields[key] = message;
      else general.push(key === "detail" || key === "non_field_errors" ? message : `${key}: ${message}`);
    }
  } else {
    const message = text(errors);
    if (message) general.push(message);
  }
  return { fields, general: general.length ? general.join(" ") : null };
}

/** Renders a validation message: `validation.*[:arg]` keys through the translator, anything else (server text) as is. */
export function formatFieldError(message: string, translate: (key: string, values?: Record<string, string | number>) => string): string {
  if (!message.startsWith("validation.")) return message;
  const separator = message.indexOf(":");
  const key = separator === -1 ? message : message.slice(0, separator);
  const arg = separator === -1 ? undefined : message.slice(separator + 1);
  return translate(key, arg === undefined ? undefined : { n: arg });
}
