"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCheck, Search, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CapabilityGate } from "@/components/feedback/capability-gate";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";
import { CAPABILITIES } from "@/lib/auth/capabilities";

interface ChatGroup {
  id: number; name: string; subject_name: string | null; faculty_name: string | null; is_active: boolean;
  members: number; last_message_at: string | null; last_message_excerpt: string | null; open_reports: number;
}
interface ChatMessage {
  id: number; content: string; message_type: string; has_attachment: boolean; created_at: string;
  sender_detail: { id: number; full_name: string; is_staff: boolean; real_name?: string };
  reactions: { emoji: string; count: number }[];
  delivery: { state: "sent" | "delivered" | "read" } | null;
  attachment_meta: { name: string } | null;
}

const POLL_MS = 5000;

/** Staff chat console: every group chat in one place, readable and writable with the staff position title. */
export function ChatConsolePage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ChatGroup | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [text, setText] = useState("");
  const search = useDebouncedValue(searchDraft);

  const groups = useQuery({
    queryKey: ["chat-console-groups", search, reportedOnly],
    refetchInterval: POLL_MS * 3,
    queryFn: async () => {
      const params = new URLSearchParams({ page_size: "100" });
      if (search) params.set("search", search);
      if (reportedOnly) params.set("reported", "1");
      return normalizeCollection<ChatGroup>(await apiFetch(`/api/v1/dashboard/chat/groups/?${params}`));
    },
  });

  const thread = useQuery({
    queryKey: ["chat-console-thread", selected?.id],
    enabled: selected !== null,
    refetchInterval: POLL_MS,
    queryFn: async () => normalizeCollection<ChatMessage>(
      await apiFetch(`/api/v1/groups/${selected?.id}/messages/?ordering=-created_at&page_size=50`),
    ),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["chat-console-thread", selected?.id] });
    await queryClient.invalidateQueries({ queryKey: ["chat-console-groups"] });
  };
  const send = useMutation({
    mutationFn: async () => apiFetch(`/api/v1/groups/${selected?.id}/messages/`, { method: "POST", body: { content: text.trim() } }),
    onSuccess: async () => { setText(""); await refresh(); },
    onError: () => toast.error(t("chatConsole.failed")),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => apiFetch(`/api/v1/groups/${selected?.id}/messages/${id}/`, { method: "DELETE" }),
    onSuccess: async () => { toast.success(t("common.success")); await refresh(); },
    onError: () => toast.error(t("chatConsole.failed")),
  });

  const messages = [...(thread.data?.results ?? [])].reverse();
  const clock = (value: string) => new Date(value).toLocaleString(locale === "ar" ? "ar" : "en", { dateStyle: "short", timeStyle: "short" });

  return (
    <CapabilityGate capability={CAPABILITIES.groups}>
      <PageHeader title={t("chatConsole.title")} description={t("chatConsole.subtitle")} />
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card className="flex max-h-[70vh] flex-col gap-3 overflow-hidden p-3">
          <div className="relative">
            <Search className="absolute start-3 top-3 size-4 text-muted-foreground" />
            <Input className="ps-9" placeholder={t("chatConsole.search")} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
          </div>
          <Button size="sm" variant={reportedOnly ? "default" : "outline"} onClick={() => setReportedOnly((value) => !value)}>
            {t("chatConsole.reportedOnly")}
          </Button>
          <div className="flex-1 space-y-1 overflow-y-auto">
            {groups.isLoading ? <Skeleton className="h-24 w-full" /> : null}
            {groups.error ? <ErrorPanel error={groups.error} retry={() => void groups.refetch()} /> : null}
            {groups.data?.results.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelected(group)}
                className={`w-full rounded-md border p-2 text-start transition-colors hover:bg-muted ${selected?.id === group.id ? "border-primary bg-muted" : "border-transparent"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{group.name}</span>
                  {group.open_reports > 0 ? <span className="rounded-full bg-destructive px-2 text-xs text-white">{group.open_reports}</span> : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">{group.last_message_excerpt || t("chatConsole.noMessages")}</div>
                <div className="text-xs text-muted-foreground">{t("chatConsole.members", { count: group.members })}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex max-h-[70vh] min-h-[24rem] flex-col overflow-hidden">
          {!selected ? (
            <div className="m-auto p-6 text-sm text-muted-foreground">{t("chatConsole.pick")}</div>
          ) : (
            <>
              <div className="border-b p-3 font-semibold">{selected.name}</div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {thread.isLoading ? <Skeleton className="h-24 w-full" /> : null}
                {messages.map((message) => (
                  <div key={message.id} className="group rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1 font-semibold">
                        {message.sender_detail.is_staff ? <ShieldCheck className="size-3.5 text-primary" /> : null}
                        {message.sender_detail.full_name}
                        {message.sender_detail.real_name ? <span className="font-normal text-muted-foreground">({message.sender_detail.real_name})</span> : null}
                      </span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {clock(message.created_at)}
                        {message.delivery ? (message.delivery.state === "sent" ? <Check className="size-3.5" /> : <CheckCheck className={`size-3.5 ${message.delivery.state === "read" ? "text-blue-600" : ""}`} />) : null}
                        <Button size="icon" variant="ghost" className="size-6" aria-label={t("chatConsole.delete")} disabled={remove.isPending} onClick={() => remove.mutate(message.id)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </span>
                    </div>
                    {message.content ? <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p> : null}
                    {message.has_attachment ? <p className="text-xs text-muted-foreground">{message.attachment_meta?.name || t("chatConsole.attachment")}</p> : null}
                    {message.reactions.length > 0 ? <p className="text-sm">{message.reactions.map((reaction) => `${reaction.emoji} ${reaction.count}`).join("  ")}</p> : null}
                  </div>
                ))}
              </div>
              <form
                className="flex gap-2 border-t p-3"
                onSubmit={(event) => { event.preventDefault(); if (text.trim()) send.mutate(); }}
              >
                <Input value={text} maxLength={4000} placeholder={t("chatConsole.write")} onChange={(event) => setText(event.target.value)} />
                <Button type="submit" disabled={!text.trim() || send.isPending}><Send className="size-4" />{t("chatConsole.send")}</Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </CapabilityGate>
  );
}
