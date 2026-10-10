"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Pagination } from "@/components/data-grid/pagination";
import { ResourceTable, type ResourceColumn } from "@/components/data-grid/resource-table";
import { AccessDenied } from "@/components/feedback/access-denied";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { ResourceFormDialog } from "@/components/forms/resource-form-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import type { ResourceDefinition } from "@/contracts/types";
import { useCan } from "@/features/session";
import { RESOURCE_FORM_POLICIES, formDefinition } from "@/features/resources/resource-form-policy";
import { createResource, deleteResource, listResource, updateResource, type EntityRecord } from "@/features/resources/resource-api";
import { useI18n } from "@/i18n/provider";
import { compactJson, humanize } from "@/lib/utils";

function intersectFields(policyFields: readonly string[], pageFields?: string[]) {
  return pageFields?.length ? policyFields.filter((field) => pageFields.includes(field)) : policyFields;
}

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
}) {
  const baseDefinition = RESOURCE_DEFINITIONS[resourceKey] as ResourceDefinition;
  const policy = RESOURCE_FORM_POLICIES[String(resourceKey)];
  const canAccess = useCan(capability ?? policy?.capability ?? undefined);
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [searchDraft, setSearchDraft] = useState(searchParams.get("search") ?? "");
  const [selected, setSelected] = useState<EntityRecord | null>(null);
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EntityRecord | null>(null);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("page_size") ?? 25)));
  const search = searchParams.get("search") ?? "";
  const ordering = searchParams.get("ordering") ?? "-created_at";

  const createDefinition = useMemo(
    () => formDefinition(baseDefinition, intersectFields(policy?.allowedCreateFields ?? [], fieldAllowlist)),
    [baseDefinition, fieldAllowlist, policy?.allowedCreateFields],
  );
  const updateDefinition = useMemo(
    () => formDefinition(baseDefinition, intersectFields(policy?.allowedUpdateFields ?? [], fieldAllowlist)),
    [baseDefinition, fieldAllowlist, policy?.allowedUpdateFields],
  );
  const activeFormDefinition = formMode === "edit" ? updateDefinition : createDefinition;

  const updateUrl = (changes: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  const query = useQuery({
    queryKey: ["resource", resourceKey, page, pageSize, search, ordering],
    queryFn: () => listResource(baseDefinition, { page, pageSize, search, ordering }),
    enabled: canAccess,
  });

  const save = useMutation({
    mutationFn: (body: FormData | Record<string, unknown>) => {
      if (formMode === "edit" && selected?.id != null) return updateResource(baseDefinition, selected.id, body);
      return createResource(baseDefinition, body);
    },
    onSuccess() {
      toast.success(t("common.success"));
      setFormMode(null);
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: ["resource", resourceKey] });
    },
    onError(error: Error) { toast.error(error.message); },
  });

  const remove = useMutation({
    mutationFn: () => {
      if (deleteTarget?.id == null) throw new Error("Missing resource identifier.");
      return deleteResource(baseDefinition, deleteTarget.id);
    },
    onSuccess() {
      toast.success(t("common.success"));
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["resource", resourceKey] });
    },
    onError(error: Error) { toast.error(error.message); },
  });

  const resolvedColumns = useMemo<ResourceColumn[]>(() => {
    if (columns?.length) return columns;
    const preferred = ["id", "name", "title", "full_name", "code", "status", "is_active", "enabled", "role", "created_at", "updated_at"];
    const sample = query.data?.results[0] ?? {};
    const keys = [...preferred.filter((key) => key in sample), ...Object.keys(sample).filter((key) => !preferred.includes(key) && !["description", "effective_capabilities", "overrides"].includes(key))].slice(0, 7);
    return (keys.length ? keys : ["id", "name", "status"]).map((key) => ({ key }));
  }, [columns, query.data?.results]);

  const canCreate = Boolean(!readOnly && canAccess && createDefinition.fields.length && (allowCreate ?? baseDefinition.collectionMethods.includes("post")));
  const canEdit = Boolean(!readOnly && canAccess && updateDefinition.fields.length && (allowEdit ?? (baseDefinition.detailMethods.includes("patch") || baseDefinition.detailMethods.includes("put"))));
  // Destructive generic CRUD remains fail-closed until the final contract has action-specific gates.
  const canDelete = Boolean(!readOnly && canAccess && allowDelete === true && policy?.mutationMethod !== null);

  if (!canAccess) return <AccessDenied />;
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        eyebrow={humanize(String(resourceKey))}
        actions={
          <>
            {extraActions}
            <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />{t("common.refresh")}</Button>
            {canCreate ? <Button onClick={() => { setSelected(null); setFormMode("create"); }}><Plus />{t("common.create")}</Button> : null}
          </>
        }
      />

      <div className="glass-panel flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center sm:p-4">
        <form className="relative flex-1" onSubmit={(event) => { event.preventDefault(); updateUrl({ search: searchDraft, page: 1 }); }}>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t("common.searchPlaceholder")} className="h-11 ps-10" />
        </form>
        <Button variant="outline" onClick={() => updateUrl({ search: searchDraft, page: 1 })}><Search />{t("common.search")}</Button>
      </div>

      {query.isPending ? (
        <div className="space-y-3"><Skeleton className="h-14 rounded-xl" /><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-10 rounded-xl" /></div>
      ) : query.isError ? (
        <ErrorPanel error={query.error} retry={() => query.refetch()} />
      ) : (
        <>
          <ResourceTable
            rows={query.data.results}
            columns={resolvedColumns}
            canEdit={canEdit}
            canDelete={canDelete}
            onView={(row) => setSelected(row)}
            onEdit={(row) => { setSelected(row); setFormMode("edit"); }}
            onDelete={setDeleteTarget}
            emptyMessage={search ? t("common.noSearchResults") : t("common.noRecords")}
          />
          <Pagination page={page} pageSize={pageSize} count={query.data.count} onPage={(next) => updateUrl({ page: next })} onPageSize={(next) => updateUrl({ page_size: next, page: 1 })} />
        </>
      )}

      <ResourceFormDialog
        key={`${formMode ?? "closed"}-${String(selected?.id ?? "new")}-${activeFormDefinition.fields.map((field) => field.name).join("-")}`}
        open={Boolean(formMode)}
        onOpenChange={(open) => { if (!open) { setFormMode(null); setSelected(null); } }}
        definition={activeFormDefinition}
        entity={formMode === "edit" ? selected : null}
        pending={save.isPending}
        onSubmit={(body) => save.mutate(body)}
      />

      <Dialog open={Boolean(selected && !formMode)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{t("common.details")}</DialogTitle><DialogDescription>{baseDefinition.collectionPath}</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {selected ? Object.entries(selected).map(([key, value]) => (
              <div key={key} className="rounded-xl border bg-muted/30 p-3"><div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{humanize(key)}</div><div className="mt-1 break-words text-sm">{compactJson(value)}</div></div>
            )) : null}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("common.destructiveWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => remove.mutate()} className="bg-destructive text-destructive-foreground" disabled={remove.isPending}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
