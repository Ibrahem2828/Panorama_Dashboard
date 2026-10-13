"use client";

import { Archive, ArchiveRestore, MessageCircle, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { RelationValue } from "@/components/shared/relation-value";
import { StatusPill } from "@/components/shared/status-pill";
import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { GroupMembersDialog } from "@/features/groups/group-members-dialog";
import { GroupWhatsappDialog } from "@/features/groups/group-whatsapp-dialog";
import { ResourceManager, type ManagerCustomAction, type ManagerFilter, type ManagerRowAction } from "@/features/resources/resource-manager";
import type { EntityRecord } from "@/features/resources/resource-api";
import { useCan } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { CAPABILITIES } from "@/lib/auth/capabilities";

interface GroupRef { id: number; name: string; has_whatsapp_channel?: boolean }
const asGroup = (row: EntityRecord): GroupRef => ({ id: Number(row.id), name: String(row.name ?? `#${String(row.id)}`), has_whatsapp_channel: Boolean(row.has_whatsapp_channel) });

/** Groups: create / edit / archive through the contract-driven manager, plus the members panel and the WhatsApp channel. */
export function GroupsPage() {
  const { t, tOr } = useI18n();
  const canChannels = useCan(CAPABILITIES.externalChannels);
  const [membersOf, setMembersOf] = useState<GroupRef | null>(null);
  const [channelOf, setChannelOf] = useState<GroupRef | null>(null);

  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "name" },
    { key: "university", render: (value) => <RelationValue field="university" value={value} /> },
    { key: "faculty", render: (value) => <RelationValue field="faculty" value={value} /> },
    { key: "major", render: (value) => <RelationValue field="major" value={value} /> },
    { key: "subject", render: (value) => <RelationValue field="subject" value={value} /> },
    { key: "members_count" },
    { key: "requires_approval", render: (value) => (value ? t("common.yes") : t("common.no")) },
    { key: "send_messages_permission", render: (value) => tOr(`enum.${String(value)}`, String(value ?? "—")) },
    { key: "has_whatsapp_channel", render: (value) => (value ? t("common.yes") : "—") },
    { key: "is_active", render: (value) => <StatusPill value={value ? "active" : "inactive"} label={value ? t("common.active") : t("groups.archived")} /> },
    { key: "created_at" },
  ], [t, tOr]);

  const customRowActions = useMemo<ManagerCustomAction[]>(() => [
    { key: "members", label: t("groups.members.action"), icon: <Users />, onSelect: (row) => setMembersOf(asGroup(row)) },
    ...(canChannels ? [{ key: "whatsapp", label: t("groups.whatsapp.action"), icon: <MessageCircle />, onSelect: (row: EntityRecord) => setChannelOf(asGroup(row)) }] : []),
  ], [canChannels, t]);

  const rowActions = useMemo<ManagerRowAction[]>(() => [
    {
      key: "archive",
      label: t("groups.archive"),
      icon: <Archive />,
      destructive: true,
      visible: (row) => row.is_active !== false,
      confirm: { title: t("groups.archiveTitle"), description: (row) => t("groups.archiveDescription", { name: String(row.name ?? row.id) }), confirmLabel: t("groups.archive") },
      request: (row) => ({ path: `/api/v1/dashboard/groups/${row.id}/`, method: "PATCH", body: { is_active: false } }),
    },
    {
      key: "restore",
      label: t("groups.restore"),
      icon: <ArchiveRestore />,
      visible: (row) => row.is_active === false,
      confirm: { title: t("groups.restoreTitle"), description: (row) => t("groups.restoreDescription", { name: String(row.name ?? row.id) }), confirmLabel: t("groups.restore") },
      request: (row) => ({ path: `/api/v1/dashboard/groups/${row.id}/`, method: "PATCH", body: { is_active: true } }),
    },
  ], [t]);

  const filters = useMemo<ManagerFilter[]>(() => [
    { param: "is_active", label: t("common.status"), options: [{ value: "true", label: t("common.active") }, { value: "false", label: t("groups.archived") }] },
  ], [t]);

  return (
    <>
      <ResourceManager
        resourceKey="groups"
        title={t("groups.title")}
        description={t("groups.subtitle")}
        capability={CAPABILITIES.groups}
        columns={columns}
        allowDelete={false}
        customRowActions={customRowActions}
        rowActions={rowActions}
        filters={filters}
        createLabel={t("groups.create")}
      />
      <GroupMembersDialog group={membersOf} onOpenChange={(open) => { if (!open) setMembersOf(null); }} />
      <GroupWhatsappDialog group={channelOf} onOpenChange={(open) => { if (!open) setChannelOf(null); }} />
    </>
  );
}
