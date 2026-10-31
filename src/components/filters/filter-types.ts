/** Typed filter-definition API: a page is described by a list of fields, the FilterBar and the URL logic do the rest. */

export interface FilterOption {
  value: string;
  label: string;
}

/** Where a field lives: always visible in the bar, or inside the "more filters" drawer. */
export type FilterPlacement = "primary" | "advanced";

interface FieldBase {
  /** Stable id of the field. For single-parameter kinds it is also the query-string parameter. */
  key: string;
  label: string;
  placement?: FilterPlacement;
}

export interface SelectField extends FieldBase {
  kind: "select";
  options: readonly FilterOption[];
  loading?: boolean;
}

/** A select whose choices depend on another field (`parent` = that field's key). Changing the parent clears this field. */
export interface CascadingSelectField extends FieldBase {
  kind: "cascading-select";
  parent: string;
  options: readonly FilterOption[];
  loading?: boolean;
}

/** Several values at once; sent as a comma separated list. */
export interface MultiSelectField extends FieldBase {
  kind: "multi-select";
  options: readonly FilterOption[];
}

/** Tri-state: all (no parameter) / yes (`true`) / no (`false`). */
export interface BooleanField extends FieldBase {
  kind: "boolean";
  yesLabel?: string;
  noLabel?: string;
}

/** One date (YYYY-MM-DD), for example "active since". */
export interface DateField extends FieldBase {
  kind: "date";
}

/** Inclusive date range sent as two YYYY-MM-DD parameters. */
export interface DateRangeField extends FieldBase {
  kind: "date-range";
  fromKey: string;
  toKey: string;
}

/** Inclusive numeric range sent as two integer parameters. */
export interface NumberRangeField extends FieldBase {
  kind: "number-range";
  minKey: string;
  maxKey: string;
}

/** One non-negative integer (for example "inactive for N days"). */
export interface NumberField extends FieldBase {
  kind: "number";
  unit?: string;
}

/** Free text (for example a URL path); sent as typed after trimming. */
export interface TextField extends FieldBase {
  kind: "text";
  placeholder?: string;
}

export type FilterField = TextField | SelectField | CascadingSelectField | MultiSelectField | BooleanField | DateField | DateRangeField | NumberRangeField | NumberField;

export interface FilterSchema {
  fields: readonly FilterField[];
  /** Query parameter of the free-text box. Omit for pages without search. */
  searchParam?: string;
  /** Query parameter of the quick segments (tabs). */
  segmentParam?: string;
  /** Query parameter of the sort control. */
  sortParam?: string;
  defaultSort?: string;
}

export type FilterValues = Record<string, string>;

/** One removable chip in the active-filter row. */
export interface ActiveFilter {
  id: string;
  label: string;
  value: string;
  /** Query parameters this chip clears. */
  clear: string[];
}

export interface FilterChipLabels {
  yes: string;
  no: string;
  from: string;
  to: string;
  min: string;
  max: string;
  /** Formats a number or a date for display (locale aware). */
  number: (value: string) => string;
  date: (value: string) => string;
}
