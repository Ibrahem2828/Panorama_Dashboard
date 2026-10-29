"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ATTACHMENT_QUERY, revokeAttachmentUrl } from "@/features/chat/chat-attachment";
import { SenderAvatar, formatClock } from "@/features/chat/chat-bubbles";
import { isUnread } from "@/features/chat/chat-logic";
import { ChatThread } from "@/features/chat/chat-thread";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";
import { cn } from "@/lib/utils";

interface ChatGroup {
  id: number; name: string; subject_name: string | null; faculty_name: string | null; is_active: boolean;
  members: number; last_message_at: string | null; last_message_excerpt: string | null; open_reports: number;
}

const POLL_MS = 15000;
const SEEN_KEY = "panorama.chat-console.seen";

// "Last seen per chat" lives in localStorage; a tiny external store keeps every render (and other tabs) in sync.
const seenListeners = new Set<() => void>();
const EMPTY_SEEN = "{}";
function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { seenListeners.delete(listener); window.removeEventListener("storage", listener); };
}
function readSeenRaw(): string {
  try { return window.localStorage.getItem(SEEN_KEY) ?? EMPTY_SEEN; } catch { return EMPTY_SEEN; }
}
function parseSeen(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch { return {}; }
}
function writeSeen(groupId: number, at: string) {
  const current = parseSeen(readSeenRaw());
  if (current[String(groupId)] === at) return;
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ...current, [String(groupId)]: at })); } catch { /* storage unavailable: the badge just resets */ }
  seenListeners.forEach((listener) => listener());
}

/** Short time for the list: clock for today, otherwise the day. */
function listTime(value: string | null, locale: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return formatClock(value, locale);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SY" : "en-GB", { day: "numeric", month: "short" }).format(date);
}

/** Staff chat console: a WhatsApp-style two-pane view of every group chat (list on the start side, thread beside it). */
export function ChatConsolePage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ChatGroup | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false);
  const seenRaw = useSyncExternalStore(subscribeSeen, readSeenRaw, () => EMPTY_SEEN);
  const seen = useMemo(() => parseSeen(seenRaw), [seenRaw]);
  const [hidden, setHidden] = useState(false);
  const search = useDebouncedValue(searchDraft);

  useEffect(() => queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "removed" && event.query.queryKey[0] === ATTACHMENT_QUERY) revokeAttachmentUrl(event.query.state.data);
  }), [queryClient]);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const groups = useQuery({
    queryKey: ["chat-console-groups", search, reportedOnly],
    refetchInterval: hidden ? false : POLL_MS,
    queryFn: async () => {
      const params = new URLSearchParams({ page_size: "100" });
      if (search) params.set("search", search);
      if (reportedOnly) params.set("reported", "1");
      return normalizeCollection<ChatGroup>(await apiFetch(`/api/v1/dashboard/chat/groups/?${params}`));
    },
  });

  const markSeen = writeSeen;
  const onActivity = useCallback(() => { void queryClient.invalidateQueries({ queryKey: ["chat-console-groups"] }); }, [queryClient]);
  const rows = groups.data?.results ?? [];
  // Keep the open conversation's header fresh (member count, status) from the polled list.
  const current = selected ? rows.find((group) => group.id === selected.id) ?? selected : null;

  return (
    <CapabilityGate capability={CAPABILITIES.groups}>
      <PageHeader title={t("chatConsole.title")} description={t("chatConsole.subtitle")} />
      <Card className="mt-4 grid h-[calc(100dvh-13rem)] min-h-[32rem] grid-cols-1 overflow-hidden lg:grid-cols-[22rem_1fr]">
        <section className={cn("min-h-0 flex-col border-e", current ? "hidden lg:flex" : "flex")} aria-label={t("chatConsole.listLabel")}>
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" />
              <Input className="ps-9" type="search" aria-label={t("chatConsole.search")} placeholder={t("chatConsole.search")} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
            </div>
            <Button type="button" size="sm" className="w-full" variant={reportedOnly ? "default" : "outline"} aria-pressed={reportedOnly} onClick={() => setReportedOnly((value) => !value)}>
              {t("chatConsole.reportedOnly")}
            </Button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {groups.isPending ? <li className="space-y-2 p-3"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></li> : null}
            {groups.isError ? <li className="p-3"><ErrorPanel error={groups.error} retry={() => void groups.refetch()} /></li> : null}
            {groups.isSuccess && rows.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">{search || reportedOnly ? t("common.noSearchResults") : t("chatConsole.noGroups")}</li> : null}
            {rows.map((group) => {
              const unread = isUnread(group, seen, selected?.id ?? null);
              return (
                <li key={group.id}>
                  <button
                    type="button" onClick={() => setSelected(group)} aria-current={current?.id === group.id ? "true" : undefined}
                    className={cn("flex w-full items-center gap-3 border-b px-3 py-2.5 text-start transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none", current?.id === group.id && "bg-muted")}
                  >
                    <SenderAvatar name={group.name} staff={false} className="size-11 text-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-sm", unread ? "font-black" : "font-semibold")}>{group.name}</span>
                        <time className={cn("shrink-0 text-xs", unread ? "font-bold text-primary" : "text-muted-foreground")} dateTime={group.last_message_at ?? undefined}>{listTime(group.last_message_at, locale)}</time>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-xs", unread ? "text-foreground" : "text-muted-foreground")} dir="auto">{group.last_message_excerpt || t("chatConsole.noMessages")}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {group.open_reports > 0 ? <span className="rounded-full bg-destructive px-1.5 text-xs font-bold text-white" aria-label={t("chatConsole.openReports", { count: group.open_reports })} title={t("chatConsole.openReports", { count: group.open_reports })}>{group.open_reports}</span> : null}
                          {unread ? <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{t("chatConsole.new")}</span> : null}
                        </span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{[group.subject_name, t("chatConsole.members", { count: group.members })].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={cn("min-h-0 min-w-0", current ? "block" : "hidden lg:block")} aria-label={t("chatConsole.threadPane")}>
          {current ? (
            <ChatThread key={current.id} group={current} onBack={() => setSelected(null)} onActivity={onActivity} onSeen={markSeen} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <MessageSquareText className="size-10" aria-hidden />
              <p className="text-sm">{t("chatConsole.pick")}</p>
            </div>
          )}
        </section>
      </Card>
    </CapabilityGate>
  );
}
