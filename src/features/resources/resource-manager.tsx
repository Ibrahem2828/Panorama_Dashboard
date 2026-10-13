"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { ResourceTable, type ResourceColumn, type RowMenuAction } from "@/components/data-grid/resource-table";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { ResourceFormDialog, type FormBody, type ResourceFormProps } from "@/components/forms/resource-form-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import type { ResourceDefinition } from "@/contracts/types";
import type { FieldOverride } from "@/features/resources/form-schema";
import { useCan } from "@/features/session";
import { RESOURCE_FORM_POLICIES, formSpecsFor, policyAllows } from "@/features/resources/resource-form-policy";
import { createResource, deleteResource, listResource, updateResource, type EntityRecord } from "@/features/resources/resource-api";
import { useI18n } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { compactJson, humanize } from "@/lib/utils";
import { useIdempotencyKey, useMutationError } from "@/hooks/use-idempotency-key";
import { payloadSignature } from "@/lib/api/idempotency";

/** A per-row backend action (activate, publish, toggle, ...) run after a confirmation, optionally with a required reason. */
export interface ManagerRowAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  visible?: (row: EntityRecord) => boolean;
  confirm: { title: string; description: (row: EntityRecord) => string; confirmLabel?: string };
  /** Adds a required free-text field (the backend demands a reason for some actions). */
  reason?: { label: string; minLength: number; maxLength: number };
  request: (row: EntityRecord, reason?: string) => { path: string; method: "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown };
}

/** A row action that opens custom UI (members panel, preview, ...) instead of a confirmation. Shown to everyone who can open the page. */
export interface ManagerCustomAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  visible?: (row: EntityRecord) => boolean;
  onSelect: (row: EntityRecord) => void;
}

/** A select filter kept in the URL and sent to the list endpoint as a query parameter. */
export interface ManagerFilter {
  param: string;
  label: string;
  options: readonly { value: string; label: string }[];
}

const ALL_FILTER = "__all__";

type FormAction = "create" | "edit";

export function ResourceManager({
  resourceKey,
  title,
  description,
  capability,
  columns,
  readOnly = false,
  extraActions,
  allowCreate,
  allowEdit,
  allowDelete,
  fieldAllowlist,
  formOverrides,
  disabledFields,
  canEditRow,
  canDeleteRow,
  rowActions,
  customRowActions,
  filters,
  confirmSubmit,
  guardSubmit,
  createLabel,
  extraContent,
}: {
  resourceKey: keyof typeof RESOURCE_DEFINITIONS;
  title: string;
  description?: string;
  capability?: string;
  columns?: ResourceColumn[];
  readOnly?: boolean;
  extraActions?: React.ReactNode;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  fieldAllowlist?: string[];
  formOverrides?: (mode: FormAction, entity: EntityRecord | null) => Record<string, FieldOverride>;
  disabledFields?: (mode: FormAction, entity: EntityRecord | null) => string[];
  canEditRow?: (row: EntityRecord) => boolean;
  canDeleteRow?: (row: EntityRecord) => boolean;
  rowActions?: ManagerRowAction[];
  customRowActions?: ManagerCustomAction[];
  filters?: ManagerFilter[];
  confirmSubmit?: (mode: FormAction, payload: Record<string, unknown>, entity: EntityRecord | null) => string | null;
  guardSubmit?: (mode: FormAction, payload: Record<string, unknown>, entity: EntityRecord | null, rows: EntityRecord[]) => { field?: string; message: string } | null;
  createLabel?: string;
  /** Rendered between the toolbar and the table (for example a "current version" card). */
  extraContent?: React.ReactNode;
}) {
  const baseDefinition = RESOURCE_DEFINITIONS[resourceKey] as ResourceDefinition;
  const key = String(resourceKey);
  const policy = RESOURCE_FORM_POLICIES[key];
  const canAccess = useCan(capability ?? policy?.capability ?? undefined);
  // Writes need the capability the backend write endpoints demand (policy), not just whatever gates the page.
  const hasWriteCapability = useCan(policy?.capability ?? undefined);
  const { t, tOr } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState(searchParams.get("search") ?? "");
  const [selected, setSelected] = useState<EntityRecord | null>(null);
  const [formMode, setFormMode] = useState<FormAction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EntityRecord | null>(null);
  const [actionTarget, setActionTarget] = useState<{ action: ManagerRowAction; row: EntityRecord } | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 25)));
  const search = searchParams.get("search") ?? "";
  const ordering = searchParams.get("ordering") ?? "-created_at";
  const activeFilters = useMemo(
    () => Object.fromEntries((filters ?? []).map((filter) => [filter.param, searchParams.get(filter.param) ?? ""]).filter(([, value]) => value)) as Record<string, string>,
    [filters, searchParams],
  );

  const canWrite = !readOnly && canAccess && hasWriteCapability;
  const createSpecs = useMemo(
    () => formSpecsFor(key, "create", formOverrides?.("create", null), fieldAllowlist),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, fieldAllowlist],
  );
  const editSpecs = useMemo(
    () => formSpecsFor(key, "edit", formOverrides?.("edit", selected), fieldAllowlist),
    [key, fieldAllowlist, selected, formOverrides],
  );
  const activeSpecs = formMode === "edit" ? editSpecs : createSpecs;

  const updateUrl = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(name);
      else next.set(name, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  const query = useQuery({
    queryKey: ["resource", resourceKey, page, pageSize, search, ordering, activeFilters],
    queryFn: () => listResource(baseDefinition, { page, pageSize, search, ordering, filters: activeFilters }),
    enabled: canAccess,
  });

  const saveKey = useIdempotencyKey();
  const saveError = useMutationError(saveKey);
  const save = useMutation({
    mutationFn: (body: FormBody) => {
      if (formMode === "edit" && selected?.id != null) return updateResource(baseDefinition, selected.id, body, saveKey.get(payloadSignature("update", selected.id, body)));
      return createResource(baseDefinition, body, saveKey.get(payloadSignature("create", body)));
    },
    onSuccess() {
      saveKey.reset();
      toast.success(t("common.success"));
      setFormMode(null);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["resource", resourceKey] });
    },
    onError: saveError,
  });

  const removeKey = useIdempotencyKey();
  const removeError = useMutationError(removeKey);
  const remove = useMutation({
    mutationFn: () => {
      if (deleteTarget?.id == null) throw new Error("Missing resource identifier.");
      return deleteResource(baseDefinition, deleteTarget.id, removeKey.get(payloadSignature("delete", deleteTarget.id)));
    },
    onSuccess() {
      removeKey.reset();
      toast.success(t("common.success"));
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["resource", resourceKey] });
    },
    onError: removeError,
  });

  const actionKey = useIdempotencyKey();
  const actionError = useMutationError(actionKey);
  const runAction = useMutation({
    mutationFn: ({ action, row, text }: { action: ManagerRowAction; row: EntityRecord; text?: string }) => {
      const request = action.request(row, text);
      return apiFetch(request.path, { method: request.method, body: request.body, idempotencyKey: actionKey.get(payloadSignature(action.key, row.id, request.body)) });
    },
    onSuccess() {
      actionKey.reset();
      toast.success(t("common.success"));
      setActionTarget(null);
      setReason("");
      void queryClient.invalidateQueries({ queryKey: ["resource", resourceKey] });
    },
    onError: actionError,
  });

  const resolvedColumns = useMemo<ResourceColumn[]>(() => {
    if (columns?.length) return columns;
    const preferred = ["id", "name", "title", "full_name", "code", "status", "is_active", "enabled", "role", "created_at", "updated_at"];
    const sample = query.data?.results[0] ?? {};
    const keys = [...preferred.filter((name) => name in sample), ...Object.keys(sample).filter((name) => !preferred.includes(name) && !["description", "effective_capabilities", "overrides"].includes(name))].slice(0, 7);
    return (keys.length ? keys : ["id", "name", "status"]).map((name) => ({ key: name }));
  }, [columns, query.data?.results]);

  const canCreate = Boolean(canWrite && createSpecs.length && policyAllows(policy, "create") && (allowCreate ?? baseDefinition.collectionMethods.includes("post")));
  const canEdit = Boolean(canWrite && editSpecs.length && policyAllows(policy, "edit") && (allowEdit ?? (baseDefinition.detailMethods.includes("patch") || baseDefinition.detailMethods.includes("put"))));
  const canDelete = Boolean(canWrite && policyAllows(policy, "delete") && (allowDelete ?? baseDefinition.detailMethods.includes("delete")));

  const menuActions = (row: EntityRecord): RowMenuAction[] => [
    ...(customRowActions ?? []).filter((action) => !action.visible || action.visible(row)).map((action) => ({
      key: action.key,
      label: action.label,
      icon: action.icon,
      onSelect: () => action.onSelect(row),
    })),
    ...(canWrite
      ? (rowActions ?? []).filter((action) => !action.visible || action.visible(row)).map((action) => ({
        key: action.key,
        label: action.label,
        icon: action.icon,
        destructive: action.destructive,
        onSelect: () => { setReason(""); setReasonError(null); runAction.reset(); setActionTarget({ action, row }); },
      }))
      : []),
  ];

  const submitAction = () => {
    if (!actionTarget) return;
    const { action, row } = actionTarget;
    let text: string | undefined;
    if (action.reason) {
      text = reason.trim();
      if (text.length < action.reason.minLength) { setReasonError(t("validation.minLength", { n: action.reason.minLength })); return; }
      if (text.length > action.reason.maxLength) { setReasonError(t("validation.maxLength", { n: action.reason.maxLength })); return; }
    }
    setReasonError(null);
    runAction.mutate({ action, row, text });
  };

  if (!canAccess) return <AccessDenied />;
  const formTitle = `${formMode === "edit" ? t("common.edit") : t("common.create")} · ${title}`;
  const formConfirm: ResourceFormProps["confirm"] = (payload, entity) => confirmSubmit?.(formMode ?? "create", payload, entity) ?? null;
  const formGuard: ResourceFormProps["guard"] = (payload, entity) => guardSubmit?.(formMode ?? "create", payload, entity, query.data?.results ?? []) ?? null;
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        eyebrow={humanize(key)}
        actions={
          <>
            {extraActions}
            <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
            {canCreate ? <Button onClick={() => { setSelected(null); save.reset(); setFormMode("create"); }}><Plus />{createLabel ?? t("common.create")}</Button> : null}
          </>
        }
      />

      <div className="glass-panel flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:p-4">
        <form className="relative flex-1" onSubmit={(event) => { event.preventDefault(); updateUrl({ search: searchDraft, page: 1 }); }}>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t("common.searchPlaceholder")} aria-label={t("common.search")} className="h-11 ps-10" />
        </form>
        {(filters ?? []).map((filter) => (
          <Select key={filter.param} value={searchParams.get(filter.param) || ALL_FILTER} onValueChange={(next) => updateUrl({ [filter.param]: next === ALL_FILTER ? null : next, page: 1 })}>
            <SelectTrigger className="h-11 sm:w-52" aria-label={filter.label}><SelectValue placeholder={filter.label} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>{filter.label}: {t("common.all")}</SelectItem>
              {filter.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
        <Button variant="outline" onClick={() => updateUrl({ search: searchDraft, page: 1 })}><Search />{t("common.search")}</Button>
      </div>

      {extraContent}

      {query.isPending ? (
        <div className="space-y-3"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-10 rounded-xl" /></div>
      ) : query.isError ? (
        <ErrorPanel error={query.error} retry={() => query.refetch()} />
      ) : (
        <>
          <ResourceTable
            rows={query.data.results}
            columns={resolvedColumns}
            canEdit={canEdit ? (row) => canEditRow?.(row) ?? true : false}
            canDelete={canDelete ? (row) => canDeleteRow?.(row) ?? true : false}
            rowActions={menuActions}
            onView={(row) => setSelected(row)}
            onEdit={(row) => { setSelected(row); save.reset(); setFormMode("edit"); }}
            onDelete={setDeleteTarget}
            emptyMessage={search ? t("common.noSearchResults") : t("common.noRecords")}
          />
          <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} />
        </>
      )}

      {formMode ? (
        <ResourceFormDialog
          key={`${formMode}-${String(selected?.id ?? "new")}`}
          open
          onOpenChange={(open) => { if (!open) { setFormMode(null); setSelected(null); } }}
          title={formTitle}
          description={formMode === "edit" ? `#${String(selected?.id ?? "")}` : undefined}
          specs={activeSpecs}
          mode={formMode}
          entity={formMode === "edit" ? selected : null}
          crossRules={policy?.crossRules}
          pending={save.isPending}
          serverError={save.error}
          confirm={formConfirm}
          guard={formGuard}
          disabledFields={disabledFields?.(formMode, formMode === "edit" ? selected : null)}
          onSubmit={(body) => save.mutate(body)}
        />
      ) : null}

      <Dialog open={Boolean(selected && !formMode)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{t("common.details")}</DialogTitle><DialogDescription>{baseDefinition.collectionPath}</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {selected ? Object.entries(selected).map(([name, value]) => (
              <div key={name} className="rounded-xl border bg-muted/30 p-3"><div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{tOr(`field.${name}`, humanize(name))}</div><div className="mt-1 break-words text-sm">{compactJson(value)}</div></div>
            )) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !remove.isPending) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("resource.deleteDescription", { name: String(deleteTarget?.name ?? deleteTarget?.title ?? deleteTarget?.key ?? `#${String(deleteTarget?.id ?? "")}`) })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); remove.mutate(); }} className="bg-destructive text-destructive-foreground" disabled={remove.isPending}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(actionTarget)} onOpenChange={(open) => { if (!open && !runAction.isPending) setActionTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTarget?.action.confirm.title}</DialogTitle>
            <DialogDescription>{actionTarget ? actionTarget.action.confirm.description(actionTarget.row) : ""}</DialogDescription>
          </DialogHeader>
          {actionTarget?.action.reason ? (
            <div className="space-y-2">
              <Label htmlFor="action-reason">{actionTarget.action.reason.label}<span className="ms-1 text-destructive" aria-hidden="true">*</span></Label>
              <Textarea id="action-reason" value={reason} onChange={(event) => { setReason(event.target.value); setReasonError(null); }} maxLength={actionTarget.action.reason.maxLength} aria-invalid={reasonError ? true : undefined} aria-describedby={reasonError ? "action-reason-error" : undefined} aria-required />
              {reasonError ? <p id="action-reason-error" role="alert" className="text-xs font-medium text-destructive">{reasonError}</p> : null}
            </div>
          ) : null}
          {runAction.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{apiErrorText(runAction.error, t)}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)} disabled={runAction.isPending}>{t("common.cancel")}</Button>
            <Button variant={actionTarget?.action.destructive ? "destructive" : "default"} onClick={submitAction} isLoading={runAction.isPending}>{actionTarget?.action.confirm.confirmLabel ?? t("form.confirmAction")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
