"use client";

import { Check, CheckCheck, ShieldCheck, Trash2 } from "lucide-react";
import { memo, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { MessageAttachment } from "@/features/chat/chat-attachment";
import { dayLabel, initials, senderDisplay, type ChatMessage, type TimelineItem } from "@/features/chat/chat-logic";
import { UserLink } from "@/features/users/user-link";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";

const clockFormats = new Map<string, Intl.DateTimeFormat>();
export function formatClock(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  let formatter = clockFormats.get(locale);
  if (!formatter) { formatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-SY" : "en-GB", { hour: "2-digit", minute: "2-digit" }); clockFormats.set(locale, formatter); }
  return formatter.format(date);
}

export function formatDay(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SY" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

export const DaySeparator = memo(function DaySeparator({ date }: { date: string }) {
  const { t, locale } = useI18n();
  const label = useMemo(() => dayLabel(date, new Date(), { today: t("chatConsole.today"), yesterday: t("chatConsole.yesterday") }, (value) => formatDay(value, locale)), [date, locale, t]);
  return (
    <div className="flex justify-center py-2" role="separator" aria-label={label}>
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">{label}</span>
    </div>
  );
});

export function SenderAvatar({ name, staff, className }: { name: string; staff: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", staff ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground", className)}>
      {initials(name)}
    </span>
  );
}

function Ticks({ state }: { state: "sent" | "delivered" | "read" }) {
  const { t } = useI18n();
  return (
    <span role="img" aria-label={t(`chatConsole.ticks.${state}` as "chatConsole.ticks.sent")} className="inline-flex">
      {state === "sent" ? <Check className="size-4 text-muted-foreground" /> : <CheckCheck className={cn("size-4", state === "read" ? "text-sky-600" : "text-muted-foreground")} />}
    </span>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const lower = text.toLocaleLowerCase();
  const target = needle.toLocaleLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let index = lower.indexOf(target, from);
  while (index !== -1) {
    if (index > from) parts.push(text.slice(from, index));
    parts.push(<mark key={index} className="rounded bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40">{text.slice(index, index + target.length)}</mark>);
    from = index + target.length;
    index = lower.indexOf(target, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

export const MessageBubble = memo(function MessageBubble({ groupId, item, query, active, canDelete, deleting, onDelete }: {
  groupId: number;
  item: Extract<TimelineItem, { kind: "message" }>;
  query: string;
  active: boolean;
  canDelete: boolean;
  deleting: boolean;
  onDelete: (message: ChatMessage) => void;
}) {
  const { t, locale } = useI18n();
  const { message, staffSide, groupStart } = item;
  const display = senderDisplay(message.sender_detail, t("chatConsole.unnamed"), (staff) => (staff ? t("chatConsole.roleStaff") : t("chatConsole.roleStudent")));
  const time = formatClock(message.created_at, locale);
  const reply = message.reply_to_detail;
  const deleted = message.is_deleted === true;

  const bubble = (
    <div
      data-message-id={message.id}
      className={cn(
        "group/bubble relative max-w-[82%] min-w-0 space-y-1 rounded-2xl border px-3 py-2 text-sm shadow-sm",
        staffSide ? "border-primary/40 bg-primary/10" : "bg-card",
        active && "ring-2 ring-yellow-400",
        groupStart && "rounded-ss-sm",
      )}
    >
      {groupStart || staffSide ? (
        <div className="flex flex-wrap items-center gap-x-2 text-xs">
          {staffSide ? <ShieldCheck className="size-3.5 text-primary" aria-label={t("chatConsole.roleStaff")} /> : null}
          <UserLink userId={display.userId} name={display.name} className="font-bold text-primary">{display.name}</UserLink>
          {display.title ? <span className="text-muted-foreground">{display.title}</span> : null}
        </div>
      ) : null}
      {reply ? (
        <div className="rounded-lg border-s-4 border-primary/60 bg-muted/60 px-2 py-1 text-xs">
          <div className="font-semibold">{reply.sender_name ?? ""}</div>
          <div className="truncate text-muted-foreground">{reply.is_deleted ? t("chatConsole.deletedMessage") : reply.preview ?? ""}</div>
        </div>
      ) : null}
      {deleted ? <p className="italic text-muted-foreground">{t("chatConsole.deletedMessage")}</p> : null}
      {!deleted && message.content ? <p className="whitespace-pre-wrap break-words" dir="auto"><Highlight text={message.content} query={query} /></p> : null}
      {!deleted && message.has_attachment ? <MessageAttachment groupId={groupId} message={message} /> : null}
      {message.reactions && message.reactions.length > 0 ? (
        <ul className="flex flex-wrap gap-1" aria-label={t("chatConsole.reactions")}>
          {message.reactions.map((reaction) => (
            <li key={reaction.emoji} className="flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 text-xs"><span>{reaction.emoji}</span><span className="font-bold text-muted-foreground">{reaction.count}</span></li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        {time ? <time dateTime={message.created_at}>{time}</time> : null}
        {message.delivery ? <Ticks state={message.delivery.state} /> : null}
        {canDelete && !deleted ? (
          <Button type="button" size="icon" variant="ghost" className="size-6 opacity-0 focus-visible:opacity-100 group-hover/bubble:opacity-100" aria-label={t("chatConsole.delete")} disabled={deleting} onClick={() => onDelete(message)}>
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className={cn("flex px-3", staffSide ? "justify-start" : "justify-end", groupStart ? "mt-3" : "mt-0.5")}>
      <div className={cn("flex min-w-0 max-w-full items-end gap-2", staffSide ? "flex-row" : "flex-row-reverse")}>
        {groupStart ? (
          <UserLink userId={display.userId} name={display.name} className="shrink-0"><SenderAvatar name={display.name} staff={staffSide} /></UserLink>
        ) : <span className="size-8 shrink-0" aria-hidden />}
        {bubble}
      </div>
    </div>
  );
});

export const SystemRow = memo(function SystemRow({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  return (
    <div className="flex justify-center px-3 py-1">
      <span className="max-w-[90%] rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground" dir="auto">{message.content || t("chatConsole.systemMessage")}</span>
    </div>
  );
});
