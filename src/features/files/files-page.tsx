"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Layers, RotateCw, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type { FilterField } from "@/components/filters/filter-types";
import { LOOKUPS, useLookupOptions } from "@/components/filters/use-lookup-options";
import { toast } from "sonner";

import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { RelationValue } from "@/components/shared/relation-value";
import { Ltr } from "@/components/shared/ltr";
import { StatusPill } from "@/components/shared/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BulkUploadDialog } from "@/features/files/bulk-upload";
import { FilePreviewDialog, type PreviewTarget } from "@/features/files/file-preview-dialog";
import { protectedSources } from "@/features/files/protected-preview";
import type { FieldOverride } from "@/features/resources/form-schema";
import type { EntityRecord } from "@/features/resources/resource-api";
import { ResourceManager, type ManagerCustomAction, type ManagerFilterBar, type ManagerRowAction } from "@/features/resources/resource-manager";
import { useI18n } from "@/i18n/provider";
import { apiFetch, unwrap } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatFileSize } from "@/lib/utils";
import type { MessageKey } from "@/i18n/messages";
import type { FilterOption } from "@/components/filters/filter-types";

export const PROCESSING_STATUSES = ["pending", "queued", "scanning", "converting", "extracting", "rendering", "ready", "failed", "quarantined"] as const;
const REPROCESSABLE = new Set(["pending", "failed", "queued"]);

/** How many library files are in each viewer-processing state, with one-click bulk reprocessing. */
function ProcessingSummary() {
  const { t, enumLabel } = useI18n();
  const queryClient = useQueryClient();
  const summary = useQuery({
    queryKey: ["file-processing-summary"],
    refetchInterval: 15000,
    queryFn: async () => unwrap(apiFetch<Record<string, number>>("/api/v1/dashboard/files/processing-summary/")),
  });
  const bulk = useMutation({
    mutationFn: async (scope: "unprocessed" | "failed") =>
      unwrap(apiFetch<{ queued: number }>("/api/v1/dashboard/files/reprocess-bulk/", { method: "POST", body: { scope } })),
    onSuccess: async (result) => {
      toast.success(t("filesProcessing.queued", { count: result.queued }));
      await queryClient.invalidateQueries({ queryKey: ["file-processing-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["resource", "files"] });
    },
    onError: () => toast.error(t("filesProcessing.failed")),
  });
  const counts = summary.data ?? {};

  return (
    <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
      <span className="text-sm font-semibold">{t("filesProcessing.title")}</span>
      {PROCESSING_STATUSES.filter((status) => (counts[status] ?? 0) > 0).map((status) => (
        <span key={status} className="flex items-center gap-1 text-sm">
          <StatusPill value={status} label={enumLabel(status)} />
          <span dir="ltr">{counts[status]}</span>
        </span>
      ))}
      <span className="ms-auto flex gap-2">
        <Button size="sm" variant="outline" disabled={bulk.isPending || !((counts.pending ?? 0) > 0)} onClick={() => bulk.mutate("unprocessed")}>
          <RotateCw className="size-4" />{t("filesProcessing.processPending", { count: counts.pending ?? 0 })}
        </Button>
        <Button size="sm" variant="outline" disabled={bulk.isPending || !((counts.failed ?? 0) > 0)} onClick={() => bulk.mutate("failed")}>
          {t("filesProcessing.retryFailed", { count: counts.failed ?? 0 })}
        </Button>
      </span>
    </Card>
  );
}

/** Library filters: visibility and processing state inline; the rest (and the long subject/group lists) in the drawer. */
export function fileFields({ t, tOr, enumLabel, subjects, groups }: {
  t: (key: MessageKey) => string;
  tOr: (key: string, fallback: string) => string;
  enumLabel: (value: unknown) => string;
  subjects: readonly FilterOption[];
  groups: readonly FilterOption[];
}): FilterField[] {
  return [
    { kind: "select", key: "visibility", label: t("field.visibility"), options: FILE_VISIBILITIES.map((value) => ({ value, label: tOr(`enum.${value}`, value) })), placement: "primary" },
    { kind: "select", key: "processing_status", label: t("filesProcessing.status"), options: PROCESSING_STATUSES.map((value) => ({ value, label: enumLabel(value) })), placement: "primary" },
    { kind: "select", key: "subject", label: t("filters.subject"), options: subjects, placement: "advanced" },
    { kind: "select", key: "group", label: t("filters.group"), options: groups, placement: "advanced" },
    { kind: "boolean", key: "is_active", label: t("common.status"), yesLabel: t("common.active"), noLabel: t("common.inactive"), placement: "advanced" },
    { kind: "boolean", key: "is_printable", label: t("field.is_printable"), placement: "advanced" },
    { kind: "date-range", key: "created", fromKey: "created_after", toKey: "created_before", label: t("filters.createdRange"), placement: "advanced" },
  ];
}

export const FILE_VISIBILITIES = ["public", "students_only", "verified_students_only", "major_only", "group_only", "admin_only"] as const;

/** The library: upload / edit metadata / replace / soft-delete via the contract-driven manager, plus a protected preview. */
export function FilesPage() {
  const { t, tOr, locale, enumLabel } = useI18n();
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const [bulk, setBulk] = useState(false);

  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "title" },
    { key: "file_type" },
    { key: "processing_status", render: (value) => <StatusPill value={String(value ?? "pending")} label={enumLabel(String(value ?? "pending"))} /> },
    { key: "failure_message", render: (value) => (value ? String(value) : "—") },
    { key: "pages_count", render: (value) => (value === null || value === undefined ? "—" : String(value)) },
    { key: "file_size", render: (value) => <Ltr as="span">{formatFileSize(value, locale)}</Ltr> },
    { key: "visibility", render: (value) => enumLabel(value) },
    { key: "group", render: (value) => <RelationValue field="group" value={value} /> },
    { key: "subject", render: (value) => <RelationValue field="subject" value={value} /> },
    { key: "is_printable", render: (value) => (value ? t("common.yes") : t("common.no")) },
    { key: "is_active", render: (value) => <StatusPill value={value ? "active" : "inactive"} label={value ? t("common.active") : t("common.inactive")} /> },
    { key: "uploaded_by_name" },
    { key: "created_at" },
  ], [t, locale, enumLabel]);

  const customRowActions = useMemo<ManagerCustomAction[]>(() => [
    {
      key: "preview",
      label: t("files.preview"),
      icon: <Eye />,
      visible: (row) => row.is_active !== false,
      onSelect: (row: EntityRecord) => setPreview({ source: protectedSources.libraryFile(Number(row.id)), title: String(row.title ?? `#${String(row.id)}`), file_type: typeof row.file_type === "string" ? row.file_type : undefined }),
    },
  ], [t]);

  const rowActions = useMemo<ManagerRowAction[]>(() => [
    {
      key: "reprocess",
      label: t("filesProcessing.reprocess"),
      icon: <RotateCw />,
      visible: (row) => REPROCESSABLE.has(String(row.processing_status)),
      confirm: { title: t("filesProcessing.reprocessTitle"), description: (row) => t("filesProcessing.reprocessBody", { title: String(row.title ?? "") }), confirmLabel: t("filesProcessing.reprocess") },
      request: (row) => ({ path: `/api/v1/dashboard/files/${String(row.id)}/reprocess/`, method: "POST", body: {} }),
    },
  ], [t]);

  // Subjects and groups are long lists: they load only when the advanced drawer opens (or a link already filters by them).
  const searchParams = useSearchParams();
  const [moreOpened, setMoreOpened] = useState(false);
  const subjects = useLookupOptions(LOOKUPS.subjects, {}, moreOpened || Boolean(searchParams?.get("subject")));
  const groups = useLookupOptions(LOOKUPS.groups, {}, moreOpened || Boolean(searchParams?.get("group")));
  const filterBar = useMemo<ManagerFilterBar>(() => ({
    fields: fileFields({ t, tOr, enumLabel, subjects: subjects.options, groups: groups.options }),
    searchPlaceholder: t("files.searchPlaceholder"),
    onMoreOpenChange: (open) => { if (open) setMoreOpened(true); },
  }), [t, tOr, enumLabel, subjects.options, groups.options]);

  return (
    <>
      <ProcessingSummary />
      <ResourceManager
        resourceKey="files"
        title={t("files.title")}
        description={t("files.subtitle")}
        capability={CAPABILITIES.files}
        columns={columns}
        customRowActions={customRowActions}
        rowActions={rowActions}
        extraActions={<>
          <Button asChild variant="outline"><Link href={`/${locale}/dashboard/files/templates`}><Layers className="size-4" />{t("files.templates.title")}</Link></Button>
          <Button variant="outline" onClick={() => setBulk(true)}><UploadCloud className="size-4" />{t("files.bulk.title")}</Button>
        </>}
        filterBar={filterBar}
        createLabel={t("files.upload")}
        formOverrides={(mode): Record<string, FieldOverride> => (mode === "edit" ? { file: { hint: "files.replaceHint", required: false } } : {})}
      />
      {bulk ? <BulkUploadDialog onClose={() => setBulk(false)} /> : null}
      <FilePreviewDialog target={preview} onOpenChange={(open) => { if (!open) setPreview(null); }} />
    </>
  );
}
