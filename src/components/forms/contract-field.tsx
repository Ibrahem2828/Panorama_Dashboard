"use client";

import { useQuery } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ContractField } from "@/contracts/types";
import { REFERENCE_ENDPOINTS } from "@/features/resources/reference-options";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { humanize } from "@/lib/utils";

function ReferenceSelect({ field, value, onChange }: { field: ContractField; value: unknown; onChange: (value: unknown) => void }) {
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
      <SelectTrigger><SelectValue placeholder={humanize(field.name)} /></SelectTrigger>
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
  const label = humanize(field.name);
  const reference = REFERENCE_ENDPOINTS[field.name];
  return (
    <div className="space-y-2">
      <Label htmlFor={`field-${field.name}`}>{label}{field.required ? <span className="ms-1 text-destructive">*</span> : null}</Label>
      {reference ? <ReferenceSelect field={field} value={value} onChange={onChange} /> : field.input === "switch" ? (
        <div className="flex h-10 items-center justify-between rounded-lg border px-3"><span className="text-sm text-muted-foreground">{Boolean(value) ? "Enabled" : "Disabled"}</span><Switch checked={Boolean(value)} onCheckedChange={onChange} /></div>
      ) : field.input === "select" && field.enum ? (
        <Select value={value === null || value === undefined || value === "" ? "__none__" : String(value)} onValueChange={(next) => onChange(next === "__none__" ? null : next)}>
          <SelectTrigger id={`field-${field.name}`}><SelectValue placeholder={label} /></SelectTrigger>
          <SelectContent>{!field.required ? <SelectItem value="__none__">—</SelectItem> : null}{field.enum.filter((item) => item !== null).map((item) => <SelectItem key={String(item)} value={String(item)}>{humanize(String(item))}</SelectItem>)}</SelectContent>
        </Select>
      ) : field.input === "textarea" || field.input === "json" ? (
        <Textarea id={`field-${field.name}`} value={typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2)} onChange={(event) => onChange(event.target.value)} rows={field.input === "json" ? 6 : 4} placeholder={field.description ?? label} />
      ) : field.input === "file" ? (
        <Input id={`field-${field.name}`} type="file" onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
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
