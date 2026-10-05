"use client";

import { useState } from "react";

import { ContractFieldInput } from "@/components/forms/contract-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ResourceDefinition } from "@/contracts/types";
import { useI18n } from "@/i18n/provider";

function initialValues(definition: ResourceDefinition, entity?: Record<string, unknown> | null): Record<string, unknown> {
  return Object.fromEntries(definition.fields.map((field) => [field.name, entity?.[field.name] ?? field.defaultValue ?? (field.input === "switch" ? false : "")]));
}

function preparePayload(definition: ResourceDefinition, values: Record<string, unknown>) {
  const hasFile = definition.fields.some((field) => field.input === "file" && values[field.name] instanceof File);
  if (hasFile) {
    const form = new FormData();
    for (const field of definition.fields) {
      const value = values[field.name];
      if (value === undefined || value === null || value === "") continue;
      if (value instanceof File) form.append(field.name, value);
      else if (field.input === "json") form.append(field.name, typeof value === "string" ? value : JSON.stringify(value));
      else form.append(field.name, String(value));
    }
    return form;
  }

  return Object.fromEntries(definition.fields.flatMap((field) => {
    let value = values[field.name];
    if (value === "" && !field.required) value = null;
    if (field.input === "json" && typeof value === "string" && value.trim()) {
      try { value = JSON.parse(value); } catch { /* The BFF returns a safe field error. */ }
    }
    return [[field.name, value]];
  }));
}

export function ResourceFormDialog({
  open,
  onOpenChange,
  definition,
  entity,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: ResourceDefinition;
  entity?: Record<string, unknown> | null;
  pending?: boolean;
  onSubmit: (body: FormData | Record<string, unknown>) => void;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, unknown>>(() => initialValues(definition, entity));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entity ? t("common.edit") : t("common.create")} · {definition.key}</DialogTitle>
          <DialogDescription>{entity ? `#${String(entity.id ?? "")}` : definition.collectionPath}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(preparePayload(definition, values)); }}>
          <div className="grid gap-5 py-4 sm:grid-cols-2">
            {definition.fields.map((field) => (
              <div key={field.name} className={field.input === "textarea" || field.input === "json" || field.input === "file" ? "sm:col-span-2" : ""}>
                <ContractFieldInput field={field} value={values[field.name]} onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))} />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" isLoading={pending}>{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
