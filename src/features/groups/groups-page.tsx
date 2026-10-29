"use client";

import { useQueries } from "@tanstack/react-query";
import { Archive, ArchiveRestore, MessageCircle, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { academicFields, useAcademicLookups } from "@/components/filters/academic-filters";
import type { FilterSegment } from "@/components/filters/filter-bar";
import { readValues, toQueryString, toRequestParams } from "@/components/filters/filter-state";
import { LOOKUPS, useLookupOptions } from "@/components/filters/use-lookup-options";
import { RelationValue } from "@/components/shared/relation-value";
import { StatusPill } from "@/components/shared/status-pill";
import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { GroupMembersDialog } from "@/features/groups/group-members-dialog";
import { GroupWhatsappDialog } from "@/features/groups/group-whatsapp-dialog";
import { GROUP_COUNT_OMIT, GROUP_DEFAULT_SORT, GROUP_KINDS, KIND_LABEL_KEY, groupFields, groupSchema, groupSortOptions, type GroupKind } from "@/features/groups/groups-filters";
import { ResourceManager, type ManagerCustomAction, type ManagerFilterBar, type ManagerRowAction } from "@/features/resources/resource-manager";
import type { EntityRecord } from "@/features/resources/resource-api";
import { useCan } from "@/features/session";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";

interface GroupRef { id: number; name: string; has_whatsapp_channel?: boolean }
const asGroup = (row: EntityRecord): GroupRef => ({ id: Number(row.id), name: String(row.name ?? `#${String(row.id)}`), has_whatsapp_channel: Boolean(row.has_whatsapp_channel) });

/** Groups: create / edit / archive through the contract-driven manager, plus the members panel and the WhatsApp channel. */
export function GroupsPage() {
  const { t, tOr } = useI18n();
  const canChannels = useCan(CAPABILITIES.externalChannels);
  const canList = useCan(CAPABILITIES.groups);
  const [membersOf, setMembersOf] = useState<GroupRef | null>(null);
  const [channelOf, setChannelOf] = useState<GroupRef | null>(null);

  const columns = useMemo<ResourceColumn[]>(() => [
    { key: "id", label: "#" },
    { key: "name" },
    { key: "university", render: (value) => <RelationValue field="university" value={value} /> },
    { key: "faculty", render: (value) => <RelationValue field="faculty" value={value} /> },
    { key: "major", render: (value) => <RelationValue field="major" value={value} /> },
    { key: "subject", render: (value) => <RelationValue field="subject" value={value} /> },
    { key: "kind", render: (value) => (value ? t(KIND_LABEL_KEY[value as GroupKind] ?? "groups.kind.general") : "—") },
    { key: "members_count" },
    { key: "pending_requests_count", label: t("groups.col.pending"), render: (value) => (Number(value) > 0 ? <span className="font-bold text-amber-600 dark:text-amber-400">{String(value)}</span> : "0") },
    { key: "requires_approval", render: (value) => (value ? t("common.yes") : t("common.no")) },
    { key: "send_messages_permission", render: (value) => tOr(`enum.${String(value)}`, String(value ?? "—")) },
    { key: "has_whatsapp", label: t("groups.col.whatsapp"), render: (value, row) => (value ?? row.has_whatsapp_channel ? t("common.yes") : "—") },
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

  // Lookups: the hierarchy loads at once; the (long) subjects list only when the advanced drawer is opened or a subject is chosen.
  const searchParams = useSearchParams();
  const [moreOpened, setMoreOpened] = useState(false);
  const academic = useAcademicLookups();
  const subjects = useLookupOptions(LOOKUPS.subjects, {}, moreOpened || Boolean(searchParams?.get("subject")));
  const fields = useMemo(() => groupFields(t, academicFields(t, academic), subjects.options), [t, academic, subjects.options]);
  const schema = useMemo(() => groupSchema(fields), [fields]);

  // Counts on the kind tabs: one cheap request per kind, honouring every other active filter.
  const searchText = searchParams?.toString() ?? "";
  const countParams = useMemo(() => toRequestParams(readValues(new URLSearchParams(searchText), schema), schema, GROUP_COUNT_OMIT), [searchText, schema]);
  const counts = useQueries({
    queries: ["", ...GROUP_KINDS].map((kind) => ({
      queryKey: ["groups-kind-count", kind, countParams],
      queryFn: async () => (await normalizeCollection(await apiFetch(`/api/v1/dashboard/groups/?${toQueryString(kind ? { ...countParams, kind } : countParams, { page_size: 1 })}`))).count,
      enabled: canList,
      staleTime: 15_000,
    })),
    combine: (results) => results.map((result) => result.data),
  });
  const segments = useMemo<FilterSegment[]>(() => [
    { value: "", label: t("groups.kind.all"), count: counts[0] },
    ...GROUP_KINDS.map((kind, index) => ({ value: kind, label: t(KIND_LABEL_KEY[kind]), count: counts[index + 1] })),
  ], [t, counts]);

  const filterBar = useMemo<ManagerFilterBar>(() => ({
    fields, segments, segmentParam: "kind", sortOptions: groupSortOptions(t), defaultSort: GROUP_DEFAULT_SORT,
    searchPlaceholder: t("groups.searchPlaceholder"), onMoreOpenChange: (open) => { if (open) setMoreOpened(true); },
  }), [fields, segments, t]);

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
        filterBar={filterBar}
        createLabel={t("groups.create")}
      />
      <GroupMembersDialog group={membersOf} onOpenChange={(open) => { if (!open) setMembersOf(null); }} />
      <GroupWhatsappDialog group={channelOf} onOpenChange={(open) => { if (!open) setChannelOf(null); }} />
    </>
  );
}
