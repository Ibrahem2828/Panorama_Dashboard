/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createContext, useContext, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EndTermWizard } from "@/features/academic-term/end-term-wizard";
import { WhatsappRemovals } from "@/features/academic-term/whatsapp-removals";
import { I18nProvider } from "@/i18n/provider";

const calls: { path: string; init?: { method?: string; body?: unknown; idempotencyKey?: string } }[] = [];
const json = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { "content-type": "application/json" } });

const PREVIEW = {
  groups: [
    { group_id: 1, name: "رياضيات 1", subject: "رياضيات", whatsapp_active: true, members_to_remove: 30 },
    { group_id: 2, name: "فيزياء 1", subject: "فيزياء", whatsapp_active: false, members_to_remove: 12 },
  ],
  total_memberships: 42,
  total_students: 25,
};

vi.mock("@/lib/api/browser-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/browser-client")>("@/lib/api/browser-client");
  return {
    ...actual,
    apiFetch: vi.fn(async (path: string, init?: { method?: string; body?: unknown; idempotencyKey?: string }) => {
      calls.push({ path, init });
      if (path.includes("/dashboard/semesters/")) return json({ count: 2, results: [{ id: 5, name: "الفصل الأول", order: 1 }, { id: 6, name: "الفصل الثاني", order: 2 }] });
      if (path.endsWith("/end-term/preview/")) return json(PREVIEW);
      if (path.endsWith("/dashboard/academic/end-term/")) return json({ rollover_id: 9, removed: 42, groups: PREVIEW.groups });
      if (path.includes("/whatsapp-list/")) return json({ groups: [{ group_id: 1, name: "رياضيات 1", members: [{ full_name: "علي", phone_number: "+963911" }] }, { group_id: 2, name: "فارغة", members: [] }] });
      return json({});
    }),
  };
});

// Radix Select needs pointer APIs jsdom lacks: a native-ish stand-in keeps the test about the wizard, not the widget.
const SelectContext = createContext<(value: string) => void>(() => undefined);
vi.mock("@/components/ui/select", () => ({
  Select: ({ onValueChange, children }: { onValueChange: (value: string) => void; children: ReactNode }) => <SelectContext.Provider value={onValueChange}><div>{children}</div></SelectContext.Provider>,
  SelectTrigger: ({ children, id }: { children: ReactNode; id?: string }) => <div id={id}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div role="listbox">{children}</div>,
  SelectItem: function Item({ value, children }: { value: string; children: ReactNode }) {
    const onChange = useContext(SelectContext);
    return <button type="button" role="option" aria-selected={false} onClick={() => onChange(value)}>{children}</button>;
  },
}));

function renderWithProviders(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><I18nProvider locale="ar">{node}</I18nProvider></QueryClientProvider>);
}

const current = { semester: { id: 5, name: "الفصل الأول", order: 1 }, other_semester: null, term_started_at: "2026-02-01T00:00:00Z", term_label: "ربيع 2026" };

beforeEach(() => { calls.length = 0; });
afterEach(cleanup);

describe("end-term wizard", () => {
  it("needs the next semester and label, shows a read-only preview, and executes only after the typed confirmation", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    renderWithProviders(<EndTermWizard open onOpenChange={() => undefined} current={current} onDone={onDone} />);

    // Step 1: validation blocks the preview.
    await user.click(await screen.findByRole("button", { name: /عرض المعاينة/u }));
    expect(calls.some((call) => call.path.endsWith("/end-term/preview/"))).toBe(false);
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);

    await user.click(await screen.findByRole("option", { name: "الفصل الثاني" }));
    await user.type(screen.getByLabelText("اسم الفترة"), "خريف 2026");
    await user.click(screen.getByRole("button", { name: /عرض المعاينة/u }));

    // Step 2: the server preview table, with nothing executed yet.
    expect(await screen.findByText("رياضيات 1")).toBeTruthy();
    expect(screen.getByText("فيزياء 1")).toBeTruthy();
    expect(calls.some((call) => call.path.endsWith("/dashboard/academic/end-term/") && call.init?.method === "POST")).toBe(false);
    await user.click(screen.getByRole("button", { name: /متابعة إلى التأكيد/u }));

    // Step 3: the destructive button stays disabled until the confirmation matches.
    const endButton = screen.getByRole("button", { name: /أنهِ الفصل الآن/u });
    expect((endButton as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByLabelText(/للتأكيد اكتب/u), "7");
    expect((endButton as HTMLButtonElement).disabled).toBe(true);
    await user.clear(screen.getByLabelText(/للتأكيد اكتب/u));
    await user.type(screen.getByLabelText(/للتأكيد اكتب/u), "إنهاء");
    expect((endButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(endButton);

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    const execute = calls.find((call) => call.path.endsWith("/dashboard/academic/end-term/") && call.init?.method === "POST");
    expect(execute?.init?.body).toEqual({ confirm: true, next_semester: 6, label: "خريف 2026", disable_whatsapp_links: true });
    expect(execute?.init?.idempotencyKey).toBeTruthy();
    expect(onDone.mock.calls[0]?.[0]).toMatchObject({ rollover_id: 9, removed: 42 });
  });
});

describe("whatsapp removal list", () => {
  it("lists members per group with a copy button, hides empty groups, and offers the CSV", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    // user-event installs its own clipboard stub; replace it after setup.
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithProviders(<WhatsappRemovals rolloverId={9} />);

    expect(await screen.findByText("علي")).toBeTruthy();
    expect(screen.queryByText("فارغة")).toBeNull();
    expect(screen.getByRole("button", { name: /تنزيل CSV/u })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /نسخ قائمة رياضيات 1/u }));
    expect(writeText).toHaveBeenCalledWith("رياضيات 1\nعلي\t+963911");
  });
});
