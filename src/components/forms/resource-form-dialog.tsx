"use client";

import { useCallback, useMemo, useState } from "react";

import { ContractFieldInput } from "@/components/forms/contract-field";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  changedFields, formatFieldError, hasFile, initialFormValues, mapServerErrors, toFormData, validateForm,
  type CrossRule, type FieldErrors, type FieldSpec, type FormMode,
} from "@/features/resources/form-schema";
import { useI18n } from "@/i18n/provider";
import type { MessageKey } from "@/i18n/messages";
import { AppApiError } from "@/lib/api/errors";

export type FormBody = FormData | Record<string, unknown>;

export interface ResourceFormProps {
  specs: readonly FieldSpec[];
  mode: FormMode;
  entity?: Record<string, unknown> | null;
  crossRules?: readonly CrossRule[];
  pending?: boolean;
  /** The last failed save (field errors and 403/409 are shown inline). */
  serverError?: unknown;
  submitLabel?: string;
  /** When it returns a description, the user must confirm it before the request is sent. */
  confirm?: (payload: Record<string, unknown>, entity: Record<string, unknown> | null) => string | null;
  /** Last client-side check with context the specs do not have; returns a field (optional) and a message. */
  guard?: (payload: Record<string, unknown>, entity: Record<string, unknown> | null) => { field?: string; message: string } | null;
  onSubmit: (body: FormBody) => void;
  /** Omit to hide the cancel button (inline panels). */
  onCancel?: () => void;
  /** Per-field disabled flags (for example the role of the signed-in user's own row). */
  disabledFields?: readonly string[];
  /** Extra content rendered between the fields and the buttons. */
  children?: React.ReactNode;
}

/** The form itself (fields, zod validation, inline errors, confirmation, buttons); used by dialogs and by inline panels. */
export function ResourceForm({ specs, mode, entity = null, crossRules, pending, serverError, submitLabel, confirm, guard, onSubmit, onCancel, disabledFields, children }: ResourceFormProps) {
  const { t } = useI18n();
  const translate = useCallback((key: string, values?: Record<string, string | number>) => t(key as MessageKey, values), [t]);
  const [values, setValues] = useState<Record<string, unknown>>(() => initialFormValues(specs, entity));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [noChanges, setNoChanges] = useState(false);
  const [awaiting, setAwaiting] = useState<{ body: FormBody; description: string } | null>(null);
  const [cleared, setCleared] = useState<{ error: unknown; names: string[] }>({ error: null, names: [] });

  const names = useMemo(() => specs.map((spec) => spec.name), [specs]);
  const server = useMemo(() => (serverError instanceof AppApiError ? mapServerErrors(serverError.errors, names) : { fields: {}, general: null }), [names, serverError]);
  const clearedNames = cleared.error === serverError ? cleared.names : [];
  const fieldError = (name: string): string | undefined => {
    if (errors[name]) return formatFieldError(errors[name], translate);
    if (server.fields[name] && !clearedNames.includes(name)) return server.fields[name];
    return undefined;
  };

  const banner = (() => {
    if (!(serverError instanceof AppApiError)) return null;
    if (serverError.status === 403) return t("form.forbidden");
    if (serverError.status === 409) return `${t("form.conflict")} ${server.general ?? serverError.message}`.trim();
    if (server.general) return server.general;
    if (Object.keys(server.fields).length) return t("form.fixFields");
    return serverError.message;
  })();

  const focusFirst = (problems: FieldErrors) => {
    const first = names.find((name) => problems[name]);
    if (first) setTimeout(() => document.getElementById(`field-${first}`)?.focus(), 0);
  };

  const update = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
    setNoChanges(false);
    setErrors((current) => {
      if (!(name in current)) return current;
      const { [name]: _removed, ...rest } = current;
      void _removed;
      return rest;
    });
    setCleared((current) => ({ error: serverError, names: current.error === serverError ? [...current.names, name] : [name] }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const result = validateForm(specs, values, mode, crossRules);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirst(result.errors);
      return;
    }
    let payload = result.payload;
    if (mode === "edit" && entity) {
      payload = changedFields(specs, payload, entity);
      if (!Object.keys(payload).length) {
        setErrors({});
        setNoChanges(true);
        return;
      }
    }
    const problem = guard?.(payload, entity);
    if (problem) {
      const found: FieldErrors = problem.field ? { [problem.field]: problem.message } : {};
      setErrors(found);
      if (!problem.field) setNoChanges(false);
      focusFirst(found);
      return;
    }
    setErrors({});
    const body: FormBody = hasFile(payload) ? toFormData(payload) : payload;
    const description = confirm?.(payload, entity) ?? null;
    if (description) setAwaiting({ body, description });
    else onSubmit(body);
  };

  return (
    <form onSubmit={submit} noValidate aria-busy={pending || undefined}>
      {banner ? <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{banner}</p> : null}
      <div className="grid gap-5 py-4 sm:grid-cols-2">
        {specs.map((spec) => (
          <div key={spec.name} className={spec.kind === "textarea" || spec.kind === "file" ? "sm:col-span-2" : ""}>
            <ContractFieldInput spec={spec} value={values[spec.name]} error={fieldError(spec.name)} disabled={pending || disabledFields?.includes(spec.name)} onChange={(value) => update(spec.name, value)} />
          </div>
        ))}
      </div>
      {children}
      {noChanges ? <p role="status" className="mb-3 text-sm text-muted-foreground">{t("form.noChanges")}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel ? <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>{t("common.cancel")}</Button> : null}
        <Button type="submit" isLoading={pending}>{submitLabel ?? t("common.save")}</Button>
      </div>
      <AlertDialog open={Boolean(awaiting)} onOpenChange={(open) => { if (!open) setAwaiting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("form.confirmTitle")}</AlertDialogTitle><AlertDialogDescription>{awaiting?.description}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (awaiting) onSubmit(awaiting.body); setAwaiting(null); }}>{t("form.confirmAction")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

export interface ResourceFormDialogProps extends Omit<ResourceFormProps, "onCancel"> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
}

export function ResourceFormDialog({ open, onOpenChange, title, description, ...form }: ResourceFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!form.pending) onOpenChange(next); }}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description ?? title}</DialogDescription>
        </DialogHeader>
        <ResourceForm {...form} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
