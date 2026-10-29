/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DaySeparator, MessageBubble } from "@/features/chat/chat-bubbles";
import type { ChatMessage, TimelineItem } from "@/features/chat/chat-logic";
import { I18nProvider } from "@/i18n/provider";

afterEach(cleanup);

const base: ChatMessage = {
  id: 5, content: "مرحبا يا شباب", message_type: "text", has_attachment: false, created_at: "2026-10-15T10:00:00",
  sender_detail: { id: 3, user_id: 41, full_name: "Ali", is_staff: false, job_title: "ممثل الدفعة" },
};
type Row = Extract<TimelineItem, { kind: "message" }>;
const row = (over: Partial<ChatMessage> = {}, staffSide = false, groupStart = true): Row => ({ kind: "message", key: "m-5", message: { ...base, ...over }, staffSide, groupStart });

function renderBubble(item: Row, props: { onDelete?: (m: ChatMessage) => void; query?: string } = {}) {
  return render(
    <I18nProvider locale="ar">
      <QueryClientProvider client={new QueryClient()}>
        <MessageBubble groupId={1} item={item} query={props.query ?? ""} active={false} canDelete deleting={false} onDelete={props.onDelete ?? vi.fn()} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("MessageBubble", () => {
  it("shows the sender name with job title and links the name and avatar to the profile page", () => {
    renderBubble(row());
    expect(screen.getByText("ممثل الدفعة")).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.length).toBe(2);
    for (const link of links) expect(link.getAttribute("href")).toBe("/ar/dashboard/users/41");
  });

  it("falls back to the role label when there is no job title", () => {
    renderBubble(row({ sender_detail: { id: 3, full_name: "Ali", is_staff: false } }));
    expect(screen.getByText("طالب")).toBeTruthy();
  });

  it("aligns staff messages to the start side and students to the end side", () => {
    const staff = renderBubble(row({ sender_detail: { id: 9, full_name: "Admin", is_staff: true } }, true));
    expect(staff.container.firstElementChild?.className).toContain("justify-start");
    cleanup();
    const student = renderBubble(row());
    expect(student.container.firstElementChild?.className).toContain("justify-end");
  });

  it("renders delivery ticks, reactions and the reply quote", () => {
    renderBubble(row({ delivery: { state: "read" }, reactions: [{ emoji: "👍", count: 3 }], reply_to_detail: { id: 1, sender_name: "Sara", preview: "الأصل" } }, true));
    expect(screen.getByRole("img", { name: "قُرئت" })).toBeTruthy();
    expect(screen.getByText("👍")).toBeTruthy();
    expect(screen.getByText("الأصل")).toBeTruthy();
  });

  it("highlights search matches and asks to delete", () => {
    const onDelete = vi.fn();
    const { container } = renderBubble(row(), { query: "شباب", onDelete });
    expect(container.querySelector("mark")?.textContent).toBe("شباب");
    fireEvent.click(screen.getByRole("button", { name: "حذف الرسالة" }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it("shows a deleted placeholder instead of the content", () => {
    renderBubble(row({ is_deleted: true }));
    expect(screen.getByText("تم حذف هذه الرسالة")).toBeTruthy();
    expect(screen.queryByText("مرحبا يا شباب")).toBeNull();
    expect(screen.queryByRole("button", { name: "حذف الرسالة" })).toBeNull();
  });
});

describe("DaySeparator", () => {
  it("labels today", () => {
    render(<I18nProvider locale="ar"><DaySeparator date={new Date().toISOString()} /></I18nProvider>);
    expect(screen.getByText("اليوم")).toBeTruthy();
  });
});
