/**
 * Pure helpers of the chat console (kept free of React so they are unit-tested directly).
 * Conventions mirror the mobile app (`mobile-prod/src/features/chat/logic`): day separators, runs of one
 * sender share one name/avatar, staff messages sit on the "own" side and students on the other.
 */

export interface ChatSender {
  id: number;
  full_name: string;
  is_staff: boolean;
  real_name?: string;
  job_title?: string;
  user_id?: number;
}
export interface ChatReaction { emoji: string; count: number }
export interface ChatMessage {
  id: number;
  content: string;
  message_type: "text" | "image" | "file" | "system" | string;
  has_attachment: boolean;
  created_at: string;
  is_deleted?: boolean;
  sender_detail: ChatSender | null;
  reactions?: ChatReaction[];
  delivery?: { state: "sent" | "delivered" | "read" } | null;
  attachment_meta?: { name: string; size?: number | null } | null;
  reply_to?: number | null;
  reply_to_detail?: { id: number; is_deleted?: boolean; sender_name?: string; preview?: string } | null;
}

export type TimelineItem =
  | { kind: "day"; key: string; date: string }
  | { kind: "system"; key: string; message: ChatMessage }
  | { kind: "message"; key: string; message: ChatMessage; staffSide: boolean; groupStart: boolean };

/** A new sender run starts after this much silence even from the same person (same as mobile). */
export const GROUP_GAP_MS = 5 * 60 * 1000;

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Merges pages of messages (latest page + older pages), de-duplicated by id and sorted oldest first. */
export function mergeMessages(...lists: ReadonlyArray<readonly ChatMessage[]>): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();
  for (const list of lists) for (const message of list) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** Oldest first, with day separators and `groupStart` marking the first message of a run by one sender. */
export function buildTimeline(messages: readonly ChatMessage[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let previousDay: string | null = null;
  let previousSender: string | null = null;
  let previousTime = 0;
  for (const message of messages) {
    const date = new Date(message.created_at);
    const valid = !Number.isNaN(date.getTime());
    const day = valid ? dayKey(date) : "unknown";
    const newDay = day !== previousDay;
    if (newDay) items.push({ kind: "day", key: `d-${day}`, date: message.created_at });
    if (message.message_type === "system") {
      previousDay = day; previousSender = null;
      items.push({ kind: "system", key: `m-${message.id}`, message });
      continue;
    }
    const sender = `u-${message.sender_detail?.id ?? "unknown"}`;
    const time = valid ? date.getTime() : previousTime;
    const groupStart = newDay || sender !== previousSender || time - previousTime > GROUP_GAP_MS;
    previousDay = day; previousSender = sender; previousTime = time;
    items.push({ kind: "message", key: `m-${message.id}`, message, staffSide: message.sender_detail?.is_staff === true, groupStart });
  }
  return items;
}

/** Today / yesterday / formatted date. `format` is injected so this stays locale-free. */
export function dayLabel(value: string, now: Date, labels: { today: string; yesterday: string }, format: (date: Date) => string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diff === 0) return labels.today;
  if (diff === 1) return labels.yesterday;
  return format(date);
}

/** Name shown on a bubble and the secondary line (job title, falling back to the role label). */
export function senderDisplay(sender: ChatSender | null, fallbackName: string, roleLabel: (staff: boolean) => string): { name: string; title: string; userId: number | null } {
  if (!sender) return { name: fallbackName, title: "", userId: null };
  const name = (sender.is_staff && sender.real_name ? sender.real_name : sender.full_name) || fallbackName;
  const jobTitle = sender.job_title?.trim();
  // For staff the public `full_name` is the position title; when a real name exists the title is already known.
  const title = jobTitle || (sender.is_staff && sender.real_name && sender.full_name !== name ? sender.full_name : roleLabel(sender.is_staff));
  return { name, title, userId: sender.user_id ?? sender.id ?? null };
}

/** Up to two initials for the avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return "؟";
  const first = Array.from(parts[0] ?? "")[0] ?? "";
  const second = parts.length > 1 ? Array.from(parts[parts.length - 1] ?? "")[0] ?? "" : "";
  return `${first}${second}`.toUpperCase();
}

/** Messages whose text, attachment name or sender matches `query` (case-insensitive, whitespace-trimmed). */
export function searchMessageIds(messages: readonly ChatMessage[], query: string): number[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  return messages
    .filter((message) => message.message_type !== "system" && !message.is_deleted)
    .filter((message) => [message.content, message.attachment_meta?.name, message.sender_detail?.full_name, message.sender_detail?.real_name]
      .some((value) => typeof value === "string" && value.toLocaleLowerCase().includes(needle)))
    .map((message) => message.id);
}

/** A group is "new" when its last message is newer than what this browser last saw there. */
export function isUnread(group: { id: number; last_message_at: string | null }, seen: Readonly<Record<string, string>>, selectedId: number | null): boolean {
  if (!group.last_message_at || group.id === selectedId) return false;
  const last = Date.parse(group.last_message_at);
  if (Number.isNaN(last)) return false;
  const seenAt = Date.parse(seen[String(group.id)] ?? "");
  return Number.isNaN(seenAt) || last > seenAt;
}

/** Poll cadence: base while active, slower after a long run of identical answers, none while the tab is hidden. */
export function pollDelay(baseMs: number, idleStreak: number, hidden: boolean): number | false {
  if (hidden) return false;
  if (idleStreak >= 20) return baseMs * 4;
  if (idleStreak >= 6) return baseMs * 2;
  return baseMs;
}

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
const IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"];

export type AttachmentProblem = "type" | "size" | "empty";
export type AttachmentKind = "image" | "file";

/** Same policy as the mobile app and the backend upload validator: png/jpg/webp images or PDF, up to 25 MB. */
export function classifyAttachment(file: { name: string; type: string; size: number }): { kind: AttachmentKind; problem: AttachmentProblem | null } {
  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase() : "";
  const mime = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const isImage = IMAGE_EXTENSIONS.includes(extension);
  const isPdf = extension === "pdf";
  const kind: AttachmentKind = isImage ? "image" : "file";
  if (!isImage && !isPdf) return { kind, problem: "type" };
  if (mime && mime !== "application/octet-stream" && !(isImage ? IMAGE_MIME : ["application/pdf", "application/x-pdf"]).includes(mime)) return { kind, problem: "type" };
  if (file.size <= 0) return { kind, problem: "empty" };
  if (file.size > MAX_ATTACHMENT_BYTES) return { kind, problem: "size" };
  return { kind, problem: null };
}

/** Multipart body for `POST /groups/{id}/messages/` (same field names as the mobile app). */
export function buildMessageFormData(content: string, file: File, kind: AttachmentKind): FormData {
  const form = new FormData();
  if (content.trim()) form.append("content", content.trim());
  form.append("message_type", kind);
  form.append("attachment", file, file.name);
  return form;
}

/** Counts messages from non-staff senders newer than `previousNewestId` (for the jump-to-latest badge). */
export function countNewIncoming(messages: readonly ChatMessage[], previousNewestId: number | null): number {
  if (previousNewestId === null) return 0;
  return messages.filter((message) => message.id > previousNewestId && message.message_type !== "system" && message.sender_detail?.is_staff !== true).length;
}

/** Messages with a downloadable attachment, newest first (media/files tab of the info panel). */
export function attachmentMessages(messages: readonly ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => message.has_attachment && !message.is_deleted).sort((a, b) => b.id - a.id);
}
