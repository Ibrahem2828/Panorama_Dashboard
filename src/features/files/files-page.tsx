"use client";

import { Eye } from "lucide-react";
import { useMemo, useState } from "react";

import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { RelationValue } from "@/components/shared/relation-value";
import { StatusPill } from "@/components/shared/status-pill";
import { FilePreviewDialog, type PreviewTarget } from "@/features/files/file-preview-dialog";
import { protectedSources } from "@/features/files/protected-preview";
import type { FieldOverride } from "@/features/resources/form-schema";
import type { EntityRecord } from "@/features/resources/resource-api";
import { ResourceManager, type ManagerCustomAction, type ManagerFilter } from "@/features/resources/resource-manager";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { formatFileSize } from "@/lib/utils";

export const FILE_VISIBILITIES = ["public", "students_only", "verified_students_only", "major_only", "group_only", "admin_only"] as const;

/** The library: upload / edit metadata / replace / soft-delete via the contract-driven manager, plus a protected preview. */
export function FilesPage() {
  const { t, tOr } = useI18n();
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "title" },
    { key: "file_type" },
    { key: "pages_count", render: (value) => (value === null || value === undefined ? "—" : String(value)) },
    { key: "file_size", render: (value) => formatFileSize(value) },
    { key: "visibility", render: (value) => tOr(`enum.${String(value)}`, String(value ?? "—")) },
    { key: "group", render: (value) => <RelationValue field="group" value={value} /> },
    { key: "subject", render: (value) => <RelationValue field="subject" value={value} /> },
    { key: "is_printable", render: (value) => (value ? t("common.yes") : t("common.no")) },
    { key: "is_active", render: (value) => <StatusPill value={value ? "active" : "inactive"} label={value ? t("common.active") : t("common.inactive")} /> },
    { key: "uploaded_by_name" },
    { key: "created_at" },
  ], [t, tOr]);

  const customRowActions = useMemo<ManagerCustomAction[]>(() => [
    {
      key: "preview",
      label: t("files.preview"),
      icon: <Eye />,
      visible: (row) => row.is_active !== false,
      onSelect: (row: EntityRecord) => setPreview({ source: protectedSources.libraryFile(Number(row.id)), title: String(row.title ?? `#${String(row.id)}`), file_type: typeof row.file_type === "string" ? row.file_type : undefined }),
    },
  ], [t]);

  const filters = useMemo<ManagerFilter[]>(() => [
    { param: "visibility", label: t("field.visibility"), options: FILE_VISIBILITIES.map((value) => ({ value, label: tOr(`enum.${value}`, value) })) },
    { param: "is_active", label: t("common.status"), options: [{ value: "true", label: t("common.active") }, { value: "false", label: t("common.inactive") }] },
    { param: "is_printable", label: t("field.is_printable"), options: [{ value: "true", label: t("common.yes") }, { value: "false", label: t("common.no") }] },
  ], [t, tOr]);

  return (
    <>
      <ResourceManager
        resourceKey="files"
        title={t("files.title")}
        description={t("files.subtitle")}
        capability={CAPABILITIES.files}
        columns={columns}
        customRowActions={customRowActions}
        filters={filters}
        createLabel={t("files.upload")}
        formOverrides={(mode): Record<string, FieldOverride> => (mode === "edit" ? { file: { hint: "files.replaceHint", required: false } } : {})}
      />
      <FilePreviewDialog target={preview} onOpenChange={(open) => { if (!open) setPreview(null); }} />
    </>
  );
}
