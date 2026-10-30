import type { FilterField, FilterOption, FilterSchema } from "@/components/filters/filter-types";
import type { MessageKey } from "@/i18n/messages";

export const CHAT_DEFAULT_SORT = "-last_message_at";
export const CHAT_SORTS = [CHAT_DEFAULT_SORT, "-open_reports", "-members"] as const;

const SORT_KEYS: Record<(typeof CHAT_SORTS)[number], MessageKey> = {
  "-last_message_at": "chatConsole.sort.latest",
  "-open_reports": "chatConsole.sort.reports",
  "-members": "chatConsole.sort.members",
};

export function chatSortOptions(t: (key: MessageKey) => string): FilterOption[] {
  return CHAT_SORTS.map((value) => ({ value, label: t(SORT_KEYS[value]) }));
}

/**
 * Filters of `dashboard/chat/groups/`. Faculty, major, year and semester come from the shared academic fields (the
 * endpoint has no university filter, so that field is dropped); the drawer shows all of them.
 */
export function chatFields(t: (key: MessageKey) => string, academic: readonly FilterField[], subjects: readonly FilterOption[]): FilterField[] {
  return [
    {
      kind: "select", key: "kind", label: t("chatConsole.filter.kind"),
      options: [{ value: "subject", label: t("groups.kind.subject") }, { value: "faculty", label: t("groups.kind.faculty") }, { value: "general", label: t("groups.kind.general") }],
    },
    ...academic.filter((field) => field.key !== "university"),
    { kind: "select", key: "subject", label: t("filters.subject"), options: subjects },
    { kind: "boolean", key: "has_messages", label: t("chatConsole.filter.hasMessages") },
    { kind: "date", key: "active_after", label: t("chatConsole.filter.activeSince") },
  ];
}

/** The "reported only" quick toggle is the `has_open_reports` segment (value `true`). */
export function chatSchema(fields: readonly FilterField[]): FilterSchema {
  return { fields, searchParam: "search", segmentParam: "has_open_reports", sortParam: "ordering", defaultSort: CHAT_DEFAULT_SORT };
}

/**
 * Query of the conversation list. `has_open_reports` is the new name; the legacy `reported=1` is sent alongside so
 * the quick toggle keeps working against a backend that has not been updated yet (unknown parameters are ignored).
 */
export function chatListParams(requestParams: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams({ page_size: "100", ...requestParams });
  if (requestParams.has_open_reports === "true") params.set("reported", "1");
  return params;
}
