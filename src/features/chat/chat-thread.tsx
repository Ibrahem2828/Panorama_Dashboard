"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, ChevronDown, ChevronUp, Info, Loader2, Paperclip, Search, Send, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ErrorPanel } from "@/components/feedback/error-panel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatInfoPanel, type InfoGroup } from "@/features/chat/chat-info-panel";
import { DaySeparator, MessageBubble, SystemRow } from "@/features/chat/chat-bubbles";
import {
  buildMessageFormData, buildTimeline, classifyAttachment, countNewIncoming, mergeMessages, pollDelay, searchMessageIds,
  type AttachmentKind, type ChatMessage,
} from "@/features/chat/chat-logic";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/i18n/provider";
import { apiFetch, apiUpload, normalizeCollection } from "@/lib/api/browser-client";
import { apiErrorText } from "@/lib/api/error-message";
import { formatFileSize } from "@/lib/utils";

const POLL_MS = 5000;
const PAGE_SIZE = 50;
const NEAR_BOTTOM_PX = 120;

/** Hidden tab = no polling (react-query already pauses unfocused tabs; this also covers minimised windows). */
function useTabHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

interface PendingFile { file: File; kind: AttachmentKind }

/** One open conversation. Mount it with `key={group.id}` so scroll, search and draft state reset per group. */
export function ChatThread({ group, onBack, onActivity, onSeen }: { group: InfoGroup; onBack: () => void; onActivity: () => void; onSeen: (groupId: number, at: string) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const hidden = useTabHidden();
  const idleStreak = useRef(0);
  const newestSeen = useRef<number | null>(null);

  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [olderPages, setOlderPages] = useState(0);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const query = useDebouncedValue(searchDraft, 200);
  const [matchIndex, setMatchIndex] = useState(0);
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<ChatMessage | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [seenNewest, setSeenNewest] = useState<number | null>(null);

  const scroller = useRef<HTMLDivElement | null>(null);
  const stick = useRef(true);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const latest = useQuery({
    queryKey: ["chat-console-thread", group.id],
    refetchInterval: () => pollDelay(POLL_MS, idleStreak.current, hidden),
    queryFn: async () => {
      const page = await normalizeCollection<ChatMessage>(await apiFetch(`/api/v1/groups/${group.id}/messages/?ordering=-created_at&page_size=${PAGE_SIZE}`));
      const newest = page.results.reduce((max, message) => Math.max(max, message.id), 0);
      idleStreak.current = newest === newestSeen.current ? idleStreak.current + 1 : 0;
      newestSeen.current = newest;
      return page;
    },
  });

  const messages = useMemo(() => mergeMessages(older, latest.data?.results ?? []), [older, latest.data]);
  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const hasMore = hasMoreOlder ?? (latest.data?.next != null);
  const matches = useMemo(() => searchMessageIds(messages, searchOpen ? query : ""), [messages, query, searchOpen]);
  const activeId = matches.length ? matches[Math.min(matchIndex, matches.length - 1)] : null;
  const newestId = messages.length ? (messages[messages.length - 1]?.id ?? null) : null;
  const newestAt = messages.length ? (messages[messages.length - 1]?.created_at ?? null) : null;
  const newCount = atBottom ? 0 : countNewIncoming(messages, seenNewest);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    stick.current = true;
    setAtBottom(true);
    setSeenNewest(newestId);
  }, [newestId]);

  // Keep the view pinned to the latest message while the reader is at the bottom; otherwise leave it alone.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (anchor.current) {
      el.scrollTop = el.scrollHeight - anchor.current.height + anchor.current.top;
      anchor.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
      setSeenNewest(newestId);
    }
  }, [messages, newestId]);

  useEffect(() => { if (newestAt) onSeen(group.id, newestAt); }, [group.id, newestAt, onSeen]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    const el = scroller.current;
    setLoadingOlder(true);
    setOlderError(false);
    try {
      const page = olderPages + 2;
      const result = await normalizeCollection<ChatMessage>(await apiFetch(`/api/v1/groups/${group.id}/messages/?ordering=-created_at&page_size=${PAGE_SIZE}&page=${page}`));
      if (el) anchor.current = { height: el.scrollHeight, top: el.scrollTop };
      stick.current = false;
      setOlder((current) => mergeMessages(current, result.results));
      setOlderPages(olderPages + 1);
      setHasMoreOlder(result.next !== null);
    } catch {
      setOlderError(true);
    } finally {
      setLoadingOlder(false);
    }
  }, [group.id, hasMore, loadingOlder, olderPages]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stick.current = near;
    setAtBottom(near);
    if (near) setSeenNewest(newestId);
    if (el.scrollTop < 60 && hasMore && !loadingOlder && !olderError) void loadOlder();
  };

  // In-thread search: jump to the active match.
  useEffect(() => {
    if (activeId === null) return;
    stick.current = false;
    scroller.current?.querySelector(`[data-message-id="${activeId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["chat-console-thread", group.id] });
    onActivity();
  };

  const send = useMutation({
    mutationFn: async () => {
      const content = text.trim();
      if (pendingFile) {
        const controller = new AbortController();
        abort.current = controller;
        setProgress(0);
        return apiUpload(`/api/v1/groups/${group.id}/messages/`, buildMessageFormData(content, pendingFile.file, pendingFile.kind), { signal: controller.signal, onProgress: (loaded, total) => setProgress(total ? loaded / total : 0) });
      }
      return apiFetch(`/api/v1/groups/${group.id}/messages/`, { method: "POST", body: { content } });
    },
    onSuccess: async () => {
      setText(""); setPendingFile(null); setProgress(null); stick.current = true;
      await refresh();
    },
    onError: (error) => {
      setProgress(null);
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(apiErrorText(error, t));
    },
    onSettled: () => { abort.current = null; },
  });

  const remove = useMutation({
    mutationFn: async (message: ChatMessage) => apiFetch(`/api/v1/groups/${group.id}/messages/${message.id}/`, { method: "DELETE" }),
    onSuccess: async (_data, message) => {
      toast.success(t("common.success"));
      setOlder((current) => current.filter((item) => item.id !== message.id));
      setToDelete(null);
      await refresh();
    },
    onError: (error) => { setToDelete(null); toast.error(apiErrorText(error, t)); },
  });

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const { kind, problem } = classifyAttachment(file);
    if (problem) { toast.error(t(`chatConsole.attachProblem.${problem}` as "chatConsole.attachProblem.type")); return; }
    setPendingFile({ file, kind });
  };

  const canSend = (text.trim().length > 0 || pendingFile !== null) && !send.isPending;
  const submit = () => { if (canSend) send.mutate(); };
  const deleteRequest = useCallback((message: ChatMessage) => setToDelete(message), []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b bg-card p-2">
        <Button type="button" size="icon" variant="ghost" className="lg:hidden" aria-label={t("chatConsole.back")} onClick={onBack}><ArrowRight className="rtl:rotate-0 ltr:rotate-180" /></Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold">{group.name}</h2>
          <p className="truncate text-xs text-muted-foreground">{[group.subject_name, t("chatConsole.members", { count: group.members })].filter(Boolean).join(" · ")}</p>
        </div>
        <Button type="button" size="icon" variant={searchOpen ? "secondary" : "ghost"} aria-pressed={searchOpen} aria-label={t("chatConsole.searchThread")} onClick={() => { setSearchOpen((open) => !open); setSearchDraft(""); setMatchIndex(0); }}><Search /></Button>
        <Button type="button" size="icon" variant="ghost" aria-label={t("chatConsole.groupInfo")} onClick={() => setInfoOpen(true)}><Info /></Button>
      </header>

      {searchOpen ? (
        <div className="flex items-center gap-2 border-b bg-muted/40 p-2">
          <Input
            autoFocus value={searchDraft} placeholder={t("chatConsole.searchThreadPlaceholder")} aria-label={t("chatConsole.searchThread")}
            onChange={(event) => { setSearchDraft(event.target.value); setMatchIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches.length) { event.preventDefault(); setMatchIndex((index) => (index + (event.shiftKey ? -1 : 1) + matches.length) % matches.length); }
              if (event.key === "Escape") { setSearchOpen(false); setSearchDraft(""); }
            }}
          />
          <span className="whitespace-nowrap text-xs text-muted-foreground" aria-live="polite">
            {query.trim() ? (matches.length ? t("chatConsole.matchCount", { current: Math.min(matchIndex, matches.length - 1) + 1, total: matches.length }) : t("chatConsole.noMatches")) : ""}
          </span>
          <Button type="button" size="icon" variant="ghost" aria-label={t("chatConsole.prevMatch")} disabled={!matches.length} onClick={() => setMatchIndex((index) => (index - 1 + matches.length) % matches.length)}><ChevronUp /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label={t("chatConsole.nextMatch")} disabled={!matches.length} onClick={() => setMatchIndex((index) => (index + 1) % matches.length)}><ChevronDown /></Button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 bg-muted/30">
        <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto py-2" role="log" aria-live="off" aria-label={t("chatConsole.threadLabel", { name: group.name })} tabIndex={0}>
          {hasMore || loadingOlder ? (
            <div className="flex justify-center py-2">
              <Button type="button" size="sm" variant="outline" disabled={loadingOlder} onClick={() => void loadOlder()}>
                {loadingOlder ? <Loader2 className="animate-spin" /> : null}{olderError ? t("chatConsole.loadOlderRetry") : t("chatConsole.loadOlder")}
              </Button>
            </div>
          ) : messages.length > 0 ? <p className="py-2 text-center text-xs text-muted-foreground">{t("chatConsole.startOfConversation")}</p> : null}
          {latest.isPending ? <div className="space-y-3 p-4"><Skeleton className="h-14 w-2/3" /><Skeleton className="ms-auto h-14 w-1/2" /><Skeleton className="h-14 w-3/5" /></div> : null}
          {latest.isError && messages.length === 0 ? <div className="p-4"><ErrorPanel error={latest.error} retry={() => void latest.refetch()} /></div> : null}
          {latest.isSuccess && messages.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">{t("chatConsole.emptyThread")}</p> : null}
          {timeline.map((item) => {
            if (item.kind === "day") return <DaySeparator key={item.key} date={item.date} />;
            if (item.kind === "system") return <SystemRow key={item.key} message={item.message} />;
            return <MessageBubble key={item.key} groupId={group.id} item={item} query={searchOpen ? query : ""} active={item.message.id === activeId} canDelete deleting={remove.isPending && toDelete?.id === item.message.id} onDelete={deleteRequest} />;
          })}
        </div>
        {!atBottom ? (
          <Button type="button" size="sm" className="absolute bottom-3 end-3 rounded-full shadow-lg" onClick={() => scrollToBottom(true)} aria-label={t("chatConsole.jumpLatest")}>
            <ArrowDown />{newCount > 0 ? t("chatConsole.newMessages", { count: newCount }) : t("chatConsole.jumpLatest")}
          </Button>
        ) : null}
      </div>

      <form className="space-y-2 border-t bg-card p-2" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        {pendingFile ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
            <Paperclip className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate" dir="auto">{pendingFile.file.name}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(pendingFile.file.size)}</span>
            {progress !== null ? <span className="text-xs font-semibold" role="status">{Math.round(progress * 100)}%</span> : null}
            <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={send.isPending ? t("chatConsole.cancelUpload") : t("chatConsole.removeAttachment")} onClick={() => { if (send.isPending) abort.current?.abort(); else setPendingFile(null); }}><X /></Button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <input ref={fileInput} type="file" hidden accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => { pickFile(event.target.files?.[0]); event.target.value = ""; }} />
          <Button type="button" size="icon" variant="ghost" aria-label={t("chatConsole.attach")} disabled={send.isPending} onClick={() => fileInput.current?.click()}><Paperclip /></Button>
          <textarea
            value={text} maxLength={4000} rows={1} dir="auto" aria-label={t("chatConsole.write")} placeholder={t("chatConsole.write")}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }}
          />
          <Button type="submit" disabled={!canSend}>{send.isPending ? <Loader2 className="animate-spin" /> : <Send className="rtl:-scale-x-100" />}{t("chatConsole.send")}</Button>
        </div>
      </form>

      <ChatInfoPanel group={group} messages={messages} open={infoOpen} onOpenChange={setInfoOpen} />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => { if (!open && !remove.isPending) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("chatConsole.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("chatConsole.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" disabled={remove.isPending} onClick={(event) => { event.preventDefault(); if (toDelete) remove.mutate(toDelete); }}>{t("chatConsole.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
