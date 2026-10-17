"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchAllPages, relationLabel } from "@/components/forms/contract-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n/provider";

export const FACULTIES_ENDPOINT = "/api/v1/dashboard/faculties/";
/** Radix Select cannot hold an empty string, so "all faculties" is this sentinel in the UI and "" in form values. */
export const ALL_FACULTIES = "__all__";

export function useFaculties() {
  return useQuery({ queryKey: ["reference-options", FACULTIES_ENDPOINT], queryFn: () => fetchAllPages(FACULTIES_ENDPOINT), staleTime: 60_000 });
}

/**
 * Faculty picker. With `allowAll` the first option is "كل الكليات" (value ""), otherwise a faculty must be chosen.
 * `value` is a faculty id as string, "" meaning no faculty / all faculties.
 */
export function FacultySelect({ id, value, onChange, allowAll, disabled, faculties, placeholder, invalid, describedBy }: {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  allowAll: boolean;
  disabled?: boolean;
  faculties: { data?: Record<string, unknown>[]; isPending: boolean; isError: boolean };
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { t } = useI18n();
  return (
    <>
      <Select value={value || (allowAll ? ALL_FACULTIES : "")} onValueChange={(next) => onChange(next === ALL_FACULTIES ? "" : next)} disabled={disabled}>
        <SelectTrigger id={id} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} aria-busy={faculties.isPending}>
          <SelectValue placeholder={faculties.isPending ? t("common.loading") : placeholder ?? t("lectures.faculty.placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {allowAll ? <SelectItem value={ALL_FACULTIES}>{t("lectures.faculty.all")}</SelectItem> : null}
          {(faculties.data ?? []).map((item) => <SelectItem key={String(item.id)} value={String(item.id)}>{relationLabel(item)}</SelectItem>)}
          {value && !(faculties.data ?? []).some((item) => String(item.id) === value) ? <SelectItem value={value}>#{value}</SelectItem> : null}
        </SelectContent>
      </Select>
      {faculties.isError ? <p role="alert" className="text-xs font-medium text-destructive">{t("lectures.faculty.failed")}</p> : null}
    </>
  );
}
