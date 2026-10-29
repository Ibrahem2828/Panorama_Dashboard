import { describe, expect, it } from "vitest";

import {
  attachmentMessages, buildMessageFormData, buildTimeline, classifyAttachment, countNewIncoming, dayLabel, initials, isUnread, mergeMessages,
  pollDelay, searchMessageIds, senderDisplay, type ChatMessage,
} from "@/features/chat/chat-logic";

const message = (id: number, createdAt: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id, content: `m${id}`, message_type: "text", has_attachment: false, created_at: createdAt,
  sender_detail: { id: 7, full_name: "Student", is_staff: false }, ...over,
});

describe("mergeMessages", () => {
  it("de-duplicates by id (latest wins) and sorts oldest first", () => {
    const merged = mergeMessages([message(3, "2026-10-01T10:00:00Z"), message(2, "2026-10-01T09:00:00Z")], [message(2, "2026-10-01T09:00:00Z", { content: "edited" }), message(1, "2026-10-01T08:00:00Z")]);
    expect(merged.map((m) => m.id)).toEqual([1, 2, 3]);
    expect(merged[1]?.content).toBe("edited");
  });
});

describe("buildTimeline", () => {
  it("adds a day separator per calendar day and groups runs of one sender", () => {
    const items = buildTimeline([
      message(1, "2026-10-01T10:00:00"),
      message(2, "2026-10-01T10:01:00"),
      message(3, "2026-10-01T10:02:00", { sender_detail: { id: 9, full_name: "Admin", is_staff: true } }),
      message(4, "2026-10-02T10:02:00", { sender_detail: { id: 9, full_name: "Admin", is_staff: true } }),
    ]);
    expect(items.map((i) => i.kind)).toEqual(["day", "message", "message", "message", "day", "message"]);
    const flags = items.filter((i) => i.kind === "message").map((i) => (i.kind === "message" ? [i.groupStart, i.staffSide] : []));
    expect(flags).toEqual([[true, false], [false, false], [true, true], [true, true]]);
  });

  it("starts a new run after a long silence and renders system messages as their own rows", () => {
    const items = buildTimeline([message(1, "2026-10-01T10:00:00"), message(2, "2026-10-01T10:30:00"), message(3, "2026-10-01T10:31:00", { message_type: "system", sender_detail: null })]);
    expect(items.map((i) => i.kind)).toEqual(["day", "message", "message", "system"]);
    expect(items[2]).toMatchObject({ groupStart: true });
  });
});

describe("dayLabel", () => {
  const labels = { today: "اليوم", yesterday: "أمس" };
  const now = new Date(2026, 9, 15, 12);
  it("labels today, yesterday and older days", () => {
    expect(dayLabel(new Date(2026, 9, 15, 1).toISOString(), now, labels, () => "x")).toBe("اليوم");
    expect(dayLabel(new Date(2026, 9, 14, 23).toISOString(), now, labels, () => "x")).toBe("أمس");
    expect(dayLabel(new Date(2026, 9, 1).toISOString(), now, labels, () => "formatted")).toBe("formatted");
    expect(dayLabel("not a date", now, labels, () => "x")).toBe("");
  });
});

describe("senderDisplay", () => {
  const role = (staff: boolean) => (staff ? "فريق" : "طالب");
  it("prefers the job title, falls back to the role label", () => {
    expect(senderDisplay({ id: 1, full_name: "Ali", is_staff: false, job_title: "ممثل الدفعة", user_id: 55 }, "؟", role)).toEqual({ name: "Ali", title: "ممثل الدفعة", userId: 55 });
    expect(senderDisplay({ id: 1, full_name: "Ali", is_staff: false }, "؟", role)).toEqual({ name: "Ali", title: "طالب", userId: 1 });
  });
  it("shows the real name of staff with their position as the title", () => {
    expect(senderDisplay({ id: 2, full_name: "بانوراما أدمن", real_name: "Sara", is_staff: true }, "؟", role)).toMatchObject({ name: "Sara", title: "بانوراما أدمن" });
    expect(senderDisplay({ id: 2, full_name: "بانوراما أدمن", is_staff: true }, "؟", role)).toMatchObject({ name: "بانوراما أدمن", title: "فريق" });
  });
  it("handles a missing sender", () => {
    expect(senderDisplay(null, "مستخدم", role)).toEqual({ name: "مستخدم", title: "", userId: null });
  });
});

describe("initials", () => {
  it("returns up to two initials", () => {
    expect(initials("Ali Hassan Omar")).toBe("AO");
    expect(initials("محمد")).toBe("م");
    expect(initials("  ")).toBe("؟");
  });
});

describe("searchMessageIds", () => {
  const list = [
    message(1, "2026-10-01T10:00:00Z", { content: "مرحبا بالجميع" }),
    message(2, "2026-10-01T10:01:00Z", { content: "Hello" }),
    message(3, "2026-10-01T10:02:00Z", { content: "x", has_attachment: true, attachment_meta: { name: "Exam.pdf" } }),
    message(4, "2026-10-01T10:03:00Z", { content: "hello", is_deleted: true }),
  ];
  it("matches content and attachment names case-insensitively and ignores deleted messages", () => {
    expect(searchMessageIds(list, "hello")).toEqual([2]);
    expect(searchMessageIds(list, "exam")).toEqual([3]);
    expect(searchMessageIds(list, "مرحبا")).toEqual([1]);
    expect(searchMessageIds(list, "   ")).toEqual([]);
  });
});

describe("isUnread", () => {
  const group = { id: 1, last_message_at: "2026-10-01T10:00:00Z" };
  it("is unread when the last message is newer than the last seen time", () => {
    expect(isUnread(group, {}, null)).toBe(true);
    expect(isUnread(group, { "1": "2026-10-01T09:00:00Z" }, null)).toBe(true);
    expect(isUnread(group, { "1": "2026-10-01T10:00:00Z" }, null)).toBe(false);
    expect(isUnread(group, {}, 1)).toBe(false);
    expect(isUnread({ id: 1, last_message_at: null }, {}, null)).toBe(false);
  });
});

describe("pollDelay", () => {
  it("pauses while hidden and slows down when nothing changes", () => {
    expect(pollDelay(5000, 0, true)).toBe(false);
    expect(pollDelay(5000, 0, false)).toBe(5000);
    expect(pollDelay(5000, 6, false)).toBe(10000);
    expect(pollDelay(5000, 20, false)).toBe(20000);
  });
});

describe("classifyAttachment", () => {
  it("accepts images and PDFs within the size limit", () => {
    expect(classifyAttachment({ name: "a.PNG", type: "image/png", size: 10 })).toEqual({ kind: "image", problem: null });
    expect(classifyAttachment({ name: "a.pdf", type: "application/pdf", size: 10 })).toEqual({ kind: "file", problem: null });
    expect(classifyAttachment({ name: "a.pdf", type: "", size: 10 }).problem).toBeNull();
  });
  it("rejects other types, mismatched mime types, empty and oversized files", () => {
    expect(classifyAttachment({ name: "a.docx", type: "application/msword", size: 10 }).problem).toBe("type");
    expect(classifyAttachment({ name: "a.png", type: "application/pdf", size: 10 }).problem).toBe("type");
    expect(classifyAttachment({ name: "a.png", type: "image/png", size: 0 }).problem).toBe("empty");
    expect(classifyAttachment({ name: "a.png", type: "image/png", size: 26 * 1024 * 1024 }).problem).toBe("size");
  });
});

describe("buildMessageFormData", () => {
  it("uses the same multipart fields as the mobile app", () => {
    const form = buildMessageFormData("  hi ", new File(["x"], "a.png", { type: "image/png" }), "image");
    expect(form.get("content")).toBe("hi");
    expect(form.get("message_type")).toBe("image");
    expect((form.get("attachment") as File).name).toBe("a.png");
    expect(buildMessageFormData("  ", new File(["x"], "a.pdf"), "file").has("content")).toBe(false);
  });
});

describe("countNewIncoming / attachmentMessages", () => {
  it("counts only newer student messages", () => {
    const list = [message(1, "2026-10-01T10:00:00Z"), message(2, "2026-10-01T10:00:00Z"), message(3, "2026-10-01T10:00:00Z", { sender_detail: { id: 9, full_name: "A", is_staff: true } })];
    expect(countNewIncoming(list, 1)).toBe(1);
    expect(countNewIncoming(list, null)).toBe(0);
  });
  it("lists attachments newest first", () => {
    const list = [message(1, "2026-10-01T10:00:00Z", { has_attachment: true }), message(2, "2026-10-01T10:00:00Z"), message(3, "2026-10-01T10:00:00Z", { has_attachment: true })];
    expect(attachmentMessages(list).map((m) => m.id)).toEqual([3, 1]);
  });
});
