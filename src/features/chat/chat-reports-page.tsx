"use client";

import { Ban, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { StatusPill } from "@/components/shared/status-pill";
import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import { ResourceManager, type ManagerFilter, type ManagerRowAction } from "@/features/resources/resource-manager";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";

const REPORT_STATUSES = ["open", "reviewed", "dismissed", "message_deleted"] as const;
const UNRESOLVED = new Set<string>(["open", "reviewed"]);

/** Dashboard moderation of chat message reports: list (filter by status) and resolve (dismiss / delete the message). */
export function ChatReportsPage() {
  const { t, enumLabel } = useI18n();
  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "group_name" },
    { key: "message_excerpt" },
    { key: "reason" },
    { key: "status", render: (value) => <StatusPill value={value} /> },
    { key: "created_at" },
  ], []);
  const filters = useMemo<ManagerFilter[]>(() => [{ param: "status", label: t("chatReports.filter.status"), options: REPORT_STATUSES.map((value) => ({ value, label: enumLabel(value) })) }], [t, enumLabel]);
  const rowActions = useMemo<ManagerRowAction[]>(() => {
    const path = (id: unknown) => `${RESOURCE_DEFINITIONS["chat-reports"].collectionPath}${String(id)}/resolve/`;
    const group = (row: Record<string, unknown>) => String(row.group_name ?? "");
    return [
      {
        key: "dismiss",
        label: t("chatReports.dismiss"),
        icon: <Ban />,
        visible: (row) => UNRESOLVED.has(String(row.status)),
        confirm: { title: t("chatReports.dismissTitle"), description: (row) => t("chatReports.dismissBody", { group: group(row) }), confirmLabel: t("chatReports.dismiss") },
        request: (row) => ({ path: path(row.id), method: "POST", body: { action: "dismiss" } }),
      },
      {
        key: "delete_message",
        label: t("chatReports.deleteMessage"),
        icon: <Trash2 />,
        destructive: true,
        visible: (row) => UNRESOLVED.has(String(row.status)),
        confirm: { title: t("chatReports.deleteTitle"), description: (row) => t("chatReports.deleteBody", { group: group(row) }), confirmLabel: t("chatReports.deleteMessage") },
        request: (row) => ({ path: path(row.id), method: "POST", body: { action: "delete_message" } }),
      },
    ];
  }, [t]);
  return (
    <ResourceManager
      resourceKey="chat-reports"
      title={t("chatReports.title")}
      description={t("chatReports.subtitle")}
      capability={CAPABILITIES.groups}
      columns={columns}
      filters={filters}
      rowActions={rowActions}
    />
  );
}
