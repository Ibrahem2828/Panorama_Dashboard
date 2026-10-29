import type { FilterField, FilterOption, FilterSchema } from "@/components/filters/filter-types";
import type { MessageKey } from "@/i18n/messages";

export const GROUP_KINDS = ["subject", "faculty", "general"] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const KIND_LABEL_KEY: Record<GroupKind, MessageKey> = {
  subject: "groups.kind.subject",
  faculty: "groups.kind.faculty",
  general: "groups.kind.general",
};

export const GROUP_DEFAULT_SORT = "-created_at";
export const GROUP_SORTS = [GROUP_DEFAULT_SORT, "name", "-members_count", "-pending_requests_count"] as const;
const SORT_KEYS: Record<(typeof GROUP_SORTS)[number], MessageKey> = {
  "-created_at": "groups.sort.newest",
  name: "groups.sort.name",
  "-members_count": "groups.sort.members",
  "-pending_requests_count": "groups.sort.pending",
};

export function groupSortOptions(t: (key: MessageKey) => string): FilterOption[] {
  return GROUP_SORTS.map((value) => ({ value, label: t(SORT_KEYS[value]) }));
}

/** Filters of `dashboard/groups/`: hierarchy cascade inline, the rest in the drawer. The group kind is the segment tabs. */
export function groupFields(t: (key: MessageKey) => string, academic: readonly FilterField[], subjects: readonly FilterOption[]): FilterField[] {
  return [
    ...academic,
    { kind: "select", key: "subject", label: t("filters.subject"), options: subjects, placement: "advanced" },
    { kind: "boolean", key: "is_active", label: t("filters.status"), yesLabel: t("common.active"), noLabel: t("groups.archived"), placement: "advanced" },
    { kind: "boolean", key: "requires_approval", label: t("groups.filter.requiresApproval"), placement: "advanced" },
    { kind: "boolean", key: "has_whatsapp", label: t("groups.filter.hasWhatsapp"), placement: "advanced" },
    { kind: "boolean", key: "has_pending_requests", label: t("groups.filter.hasPending"), placement: "advanced" },
    {
      kind: "select", key: "send_messages_permission", label: t("groups.filter.sendPermission"), placement: "advanced",
      options: [{ value: "all_members", label: t("enum.all_members") }, { value: "admins_only", label: t("enum.admins_only") }],
    },
    { kind: "number-range", key: "members", minKey: "members_min", maxKey: "members_max", label: t("groups.filter.members"), placement: "advanced" },
    { kind: "date-range", key: "created", fromKey: "created_after", toKey: "created_before", label: t("filters.createdRange"), placement: "advanced" },
  ];
}

export function groupSchema(fields: readonly FilterField[]): FilterSchema {
  return { fields, searchParam: "search", segmentParam: "kind", sortParam: "ordering", defaultSort: GROUP_DEFAULT_SORT };
}

/** The per-kind counts ignore the kind itself and the sort. */
export const GROUP_COUNT_OMIT = ["kind", "ordering"] as const;
