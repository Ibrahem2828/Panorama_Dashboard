import type { ActiveFilter, FilterChipLabels, FilterField, FilterSchema, FilterValues } from "@/components/filters/filter-types";

/** The reserved paging parameters: they are not filters, but any filter change must reset `page`. */
export const PAGE_PARAM = "page";
export const PAGE_SIZE_PARAM = "page_size";

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INTEGER = /^\d{1,9}$/u;
const TOKEN = /^[\w.-]{1,64}$/u;

interface ParamsLike { get(name: string): string | null }

/** Query parameters a field owns. */
export function fieldParams(field: FilterField): string[] {
  if (field.kind === "date-range") return [field.fromKey, field.toKey];
  if (field.kind === "number-range") return [field.minKey, field.maxKey];
  return [field.key];
}

/** Every parameter the bar owns (fields, search, segment, sort). */
export function schemaParams(schema: FilterSchema): string[] {
  return [
    ...schema.fields.flatMap(fieldParams),
    ...(schema.searchParam ? [schema.searchParam] : []),
    ...(schema.segmentParam ? [schema.segmentParam] : []),
    ...(schema.sortParam ? [schema.sortParam] : []),
  ];
}

/** Parameters that count as "filters" (everything except sorting): used for "clear all" and the empty state. */
export function filterParams(schema: FilterSchema): string[] {
  return schemaParams(schema).filter((name) => name !== schema.sortParam);
}

function sanitize(field: FilterField, raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  switch (field.kind) {
    case "boolean": return value === "true" || value === "false" ? value : "";
    case "date-range": return DATE.test(value) ? value : "";
    case "number-range":
    case "number": return INTEGER.test(value) ? value : "";
    case "multi-select": return value.split(",").map((item) => item.trim()).filter((item) => TOKEN.test(item)).join(",");
    default: return TOKEN.test(value) ? value : "";
  }
}

/** Reads the URL into filter values. Unknown parameters are ignored and malformed values dropped, so a hand-edited link is harmless. */
export function readValues(params: ParamsLike, schema: FilterSchema): FilterValues {
  const values: FilterValues = {};
  for (const field of schema.fields) {
    for (const param of fieldParams(field)) {
      const value = sanitize(field, params.get(param) ?? "");
      if (value) values[param] = value;
    }
  }
  if (schema.searchParam) {
    const search = (params.get(schema.searchParam) ?? "").trim().slice(0, 200);
    if (search) values[schema.searchParam] = search;
  }
  if (schema.segmentParam) {
    const segment = (params.get(schema.segmentParam) ?? "").trim();
    if (TOKEN.test(segment)) values[schema.segmentParam] = segment;
  }
  if (schema.sortParam) {
    const sort = (params.get(schema.sortParam) ?? "").trim();
    if (/^-?\w{1,40}$/u.test(sort)) values[schema.sortParam] = sort;
  }
  return values;
}

/** Keys of the fields that (transitively) depend on any of `changed`. */
export function dependants(schema: FilterSchema, changed: readonly string[]): string[] {
  const reset = new Set<string>();
  let frontier = [...changed];
  while (frontier.length) {
    const next: string[] = [];
    for (const field of schema.fields) {
      if (field.kind === "cascading-select" && frontier.includes(field.parent) && !reset.has(field.key)) {
        reset.add(field.key);
        next.push(field.key);
      }
    }
    frontier = next;
  }
  return [...reset];
}

/**
 * Applies changes to the current query string: an empty/null value removes the parameter, dependants of changed
 * cascading parents are cleared, and `page` is reset (unless the change itself sets it). Unrelated parameters stay.
 */
export function applyChanges(current: string | URLSearchParams, schema: FilterSchema, changes: Record<string, string | null | undefined>): URLSearchParams {
  const next = new URLSearchParams(typeof current === "string" ? current : current.toString());
  const touched = Object.keys(changes);
  for (const [name, value] of Object.entries(changes)) {
    if (value === null || value === undefined || value === "") next.delete(name);
    else next.set(name, value);
  }
  for (const key of dependants(schema, touched)) {
    if (!(key in changes)) next.delete(key);
  }
  if (!touched.includes(PAGE_PARAM) && !touched.includes(PAGE_SIZE_PARAM)) next.delete(PAGE_PARAM);
  return next;
}

/** Removes every filter (search and segment included) but keeps sorting and the page size. */
export function clearAll(current: string | URLSearchParams, schema: FilterSchema): URLSearchParams {
  const next = new URLSearchParams(typeof current === "string" ? current : current.toString());
  for (const name of filterParams(schema)) next.delete(name);
  next.delete(PAGE_PARAM);
  return next;
}

/** The query parameters to send to the list endpoint: everything the bar owns that has a value (plus the default sort). */
export function toRequestParams(values: FilterValues, schema: FilterSchema, omit: readonly string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of schemaParams(schema)) {
    if (omit.includes(name)) continue;
    const value = values[name];
    if (value) out[name] = value;
  }
  if (schema.sortParam && !omit.includes(schema.sortParam) && !out[schema.sortParam] && schema.defaultSort) out[schema.sortParam] = schema.defaultSort;
  return out;
}

/** Number of active field filters (search, segment and sort are shown elsewhere and are not counted). */
export function activeFieldCount(values: FilterValues, schema: FilterSchema): number {
  return schema.fields.filter((field) => fieldParams(field).some((param) => values[param])).length;
}

/** Whether anything at all narrows the result (fields, search or segment). */
export function hasAnyFilter(values: FilterValues, schema: FilterSchema): boolean {
  return filterParams(schema).some((name) => Boolean(values[name]));
}

/** Number of advanced-placement fields that are active (badge on the "more filters" button). */
export function advancedActiveCount(values: FilterValues, schema: FilterSchema): number {
  return schema.fields.filter((field) => field.placement === "advanced" && fieldParams(field).some((param) => values[param])).length;
}

/** One chip per active field, with a human readable value. */
export function activeChips(values: FilterValues, schema: FilterSchema, labels: FilterChipLabels): ActiveFilter[] {
  const chips: ActiveFilter[] = [];
  for (const field of schema.fields) {
    const params = fieldParams(field);
    if (!params.some((param) => values[param])) continue;
    let text = "";
    if (field.kind === "select" || field.kind === "cascading-select") {
      const raw = values[field.key] ?? "";
      text = field.options.find((option) => option.value === raw)?.label ?? raw;
    } else if (field.kind === "multi-select") {
      text = (values[field.key] ?? "").split(",").map((item) => field.options.find((option) => option.value === item)?.label ?? item).join("، ");
    } else if (field.kind === "boolean") {
      text = values[field.key] === "true" ? (field.yesLabel ?? labels.yes) : (field.noLabel ?? labels.no);
    } else if (field.kind === "date-range") {
      const parts: string[] = [];
      if (values[field.fromKey] ?? "") parts.push(`${labels.from} ${labels.date(values[field.fromKey] ?? "")}`);
      if (values[field.toKey] ?? "") parts.push(`${labels.to} ${labels.date(values[field.toKey] ?? "")}`);
      text = parts.join(" ");
    } else if (field.kind === "number-range") {
      const parts: string[] = [];
      if (values[field.minKey] ?? "") parts.push(`${labels.min} ${labels.number(values[field.minKey] ?? "")}`);
      if (values[field.maxKey] ?? "") parts.push(`${labels.max} ${labels.number(values[field.maxKey] ?? "")}`);
      text = parts.join(" ");
    } else {
      text = `${labels.number(values[field.key] ?? "")}${field.unit ? ` ${field.unit}` : ""}`;
    }
    chips.push({ id: field.key, label: field.label, value: text, clear: params });
  }
  return chips;
}

/** Positive integer from a query parameter, or `fallback`. */
export function readPositiveInt(params: ParamsLike, name: string, fallback: number): number {
  const raw = Number(params.get(name));
  return Number.isInteger(raw) && raw >= 1 ? raw : fallback;
}

/** Query string of a list request: the filter parameters plus paging. */
export function toQueryString(params: Record<string, string>, extra: Record<string, string | number> = {}): string {
  const query = new URLSearchParams(params);
  for (const [name, value] of Object.entries(extra)) query.set(name, String(value));
  return query.toString();
}
