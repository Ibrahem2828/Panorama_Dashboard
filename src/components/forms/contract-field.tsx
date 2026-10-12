"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ContractField } from "@/contracts/types";
import { REFERENCE_ENDPOINTS } from "@/features/resources/reference-options";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { acceptAttribute, effectiveMaxBytes, uploadPolicyForField, validateUpload, type UploadProblem } from "@/lib/uploads";
import { humanize } from "@/lib/utils";

/** Localized label for a contract field name; unknown names fall back to a humanized form of the name. */
function useFieldLabel() {
  const { tOr } = useI18n();
  return (name: string) => tOr(`field.${name}`, humanize(name));
}

function FileInput({ field, onChange }: { field: ContractField; onChange: (value: unknown) => void }) {
  const { t } = useI18n();
  const [problem, setProblem] = useState<UploadProblem | null>(null);
  const policy = uploadPolicyForField(field.name);
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
        id={`field-${field.name}`}
        type="file"
        accept={acceptAttribute(policy)}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `field-${field.name}-error` : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          const found = file ? validateUpload(file, policy) : null;
          setProblem(found);
          if (found) event.target.value = "";
          onChange(found ? null : file);
        }}
      />
      {message ? <p id={`field-${field.name}-error`} role="alert" className="text-xs text-destructive">{message}</p> : null}
    </>
  );
}

function ReferenceSelect({ field, value, onChange }: { field: ContractField; value: unknown; onChange: (value: unknown) => void }) {
  const fieldLabel = useFieldLabel();
  const endpoint = REFERENCE_ENDPOINTS[field.name];
  const query = useQuery({
    queryKey: ["reference-options", endpoint],
    queryFn: async () => (await normalizeCollection<Record<string, unknown>>(await apiFetch(`${endpoint}?page_size=200`))).results,
    enabled: Boolean(endpoint),
    staleTime: 5 * 60_000,
  });
  if (!endpoint) return null;
  return (
    <Select value={value === null || value === undefined || value === "" ? "__none__" : String(value)} onValueChange={(next) => onChange(next === "__none__" ? null : Number(next))}>
      <SelectTrigger><SelectValue placeholder={fieldLabel(field.name)} /></SelectTrigger>
      <SelectContent>
        {!field.required ? <SelectItem value="__none__">—</SelectItem> : null}
        {(query.data ?? []).map((item) => (
          <SelectItem key={String(item.id)} value={String(item.id)}>
            {String(item.name ?? item.full_name ?? item.title ?? item.email ?? item.id)}{item.code ? ` · ${String(item.code)}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ContractFieldInput({ field, value, onChange }: { field: ContractField; value: unknown; onChange: (value: unknown) => void }) {
  const { t } = useI18n();
  const label = useFieldLabel()(field.name);
  const reference = REFERENCE_ENDPOINTS[field.name];
  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.name}`}>{label}{field.required ? <span className="ms-1 text-destructive">*</span> : null}</Label>
      {reference ? <ReferenceSelect field={field} value={value} onChange={onChange} /> : field.input === "switch" ? (
        <div className="flex h-10 items-center justify-between rounded-lg border px-3"><span className="text-sm text-muted-foreground">{value ? t("common.enabled") : t("common.disabled")}</span><Switch id={`field-${field.name}`} checked={Boolean(value)} onCheckedChange={onChange} /></div>
      ) : field.input === "select" && field.enum ? (
        <Select value={value === null || value === undefined || value === "" ? "__none__" : String(value)} onValueChange={(next) => onChange(next === "__none__" ? null : next)}>
          <SelectTrigger id={`field-${field.name}`}><SelectValue placeholder={label} /></SelectTrigger>
          <SelectContent>{!field.required ? <SelectItem value="__none__">—</SelectItem> : null}{field.enum.filter((item) => item !== null).map((item) => <SelectItem key={String(item)} value={String(item)}>{humanize(String(item))}</SelectItem>)}</SelectContent>
        </Select>
      ) : field.input === "textarea" || field.input === "json" ? (
        <Textarea id={`field-${field.name}`} value={typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2)} onChange={(event) => onChange(event.target.value)} rows={field.input === "json" ? 6 : 4} placeholder={field.description ?? label} />
      ) : field.input === "file" ? (
        <FileInput field={field} onChange={onChange} />
      ) : (
        <Input
          id={`field-${field.name}`}
          type={field.input}
          value={value === null || value === undefined ? "" : String(value)}
          min={field.minimum ?? undefined}
          max={field.maximum ?? undefined}
          minLength={field.minLength ?? undefined}
          maxLength={field.maxLength ?? undefined}
          pattern={field.pattern ?? undefined}
          required={field.required}
          onChange={(event) => onChange(field.input === "number" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value)}
          placeholder={field.description ?? label}
        />
      )}
      {field.description ? <p className="text-xs leading-5 text-muted-foreground">{field.description}</p> : null}
    </div>
  );
}
