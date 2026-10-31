/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilesPage } from "@/features/files/files-page";
import { GroupMembersDialog } from "@/features/groups/group-members-dialog";
import { GroupsPage } from "@/features/groups/groups-page";
import type { ManagerCustomAction, ManagerFilterBar, ManagerRowAction } from "@/features/resources/resource-manager";
import { I18nProvider } from "@/i18n/provider";
import { apiFetch } from "@/lib/api/browser-client";

// jsdom has no ResizeObserver, which Radix uses.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const granted = new Set<string>();
const captured: { custom: ManagerCustomAction[]; rows: ManagerRowAction[]; filterBar?: ManagerFilterBar; createLabel?: string } = { custom: [], rows: [] };

vi.mock("@/features/session", () => ({
  useCan: (capability?: string) => !capability || granted.has(capability),
  useSession: () => ({ user: { id: 1, role: "admin" } }),
}));
vi.mock("@/features/resources/resource-manager", () => ({
  ResourceManager: (props: { customRowActions?: ManagerCustomAction[]; rowActions?: ManagerRowAction[]; filterBar?: ManagerFilterBar; createLabel?: string }) => {
    captured.custom = props.customRowActions ?? [];
    captured.rows = props.rowActions ?? [];
    captured.filterBar = props.filterBar;
    captured.createLabel = props.createLabel;
    return null;
  },
}));
vi.mock("@/lib/api/browser-client", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/api/browser-client")>()), apiFetch: vi.fn() }));

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
const wrap = (node: React.ReactNode, locale: "en" | "ar" = "en") => (
  <I18nProvider locale={locale}><QueryClientProvider client={client()}>{node}</QueryClientProvider></I18nProvider>
);

beforeEach(() => {
  granted.clear();
  captured.custom = []; captured.rows = []; captured.filterBar = undefined; captured.createLabel = undefined;
  vi.mocked(apiFetch).mockReset();
});
afterEach(cleanup);

describe("groups page wiring", () => {
  it("always offers the members panel but the WhatsApp action only with groups.external_channels.manage", () => {
    granted.add("groups.manage");
    const { unmount } = render(wrap(<GroupsPage />));
    expect(captured.custom.map((action) => action.key)).toEqual(["members"]);
    unmount();
    granted.add("groups.external_channels.manage");
    render(wrap(<GroupsPage />));
    expect(captured.custom.map((action) => action.key)).toEqual(["members", "whatsapp"]);
  });

  it("archives active groups and restores archived ones through PATCH is_active (never a delete)", () => {
    granted.add("groups.manage");
    render(wrap(<GroupsPage />));
    const archive = captured.rows.find((action) => action.key === "archive")!;
    const restore = captured.rows.find((action) => action.key === "restore")!;
    expect(archive.visible?.({ id: 1, is_active: true })).toBe(true);
    expect(archive.visible?.({ id: 1, is_active: false })).toBe(false);
    expect(restore.visible?.({ id: 1, is_active: false })).toBe(true);
    expect(archive.destructive).toBe(true);
    expect(archive.request({ id: 4 })).toEqual({ path: "/api/v1/dashboard/groups/4/", method: "PATCH", body: { is_active: false } });
    expect(restore.request({ id: 4 })).toEqual({ path: "/api/v1/dashboard/groups/4/", method: "PATCH", body: { is_active: true } });
    expect(captured.rows.some((action) => action.request({ id: 4 }).method === "DELETE")).toBe(false);
  });

  it("localizes the archive confirmation in Arabic", () => {
    granted.add("groups.manage");
    render(wrap(<GroupsPage />, "ar"));
    const archive = captured.rows.find((action) => action.key === "archive")!;
    expect(archive.confirm.description({ id: 1, name: "مجموعة" })).toContain("مجموعة");
    expect(archive.label).toBe("أرشفة المجموعة");
  });
});

describe("files page wiring", () => {
  it("labels the create action as an upload and offers the library filter bar", () => {
    granted.add("files.manage");
    render(wrap(<FilesPage />));
    expect(captured.createLabel).toBe("Upload file");
    const fields = captured.filterBar!.fields;
    expect(fields.map((field) => field.key)).toEqual(["visibility", "processing_status", "subject", "group", "is_active", "is_printable", "created"]);
    const visibility = fields[0]!;
    expect(visibility.kind === "select" && visibility.options.map((option) => option.value)).toEqual(["public", "students_only", "verified_students_only", "major_only", "group_only", "admin_only"]);
    expect(fields.filter((field) => field.placement === "primary").map((field) => field.key)).toEqual(["visibility", "processing_status"]);
  });

  it("offers the protected preview only for active files", () => {
    granted.add("files.manage");
    render(wrap(<FilesPage />));
    const preview = captured.custom.find((action) => action.key === "preview")!;
    expect(preview.visible?.({ id: 1, is_active: true })).toBe(true);
    expect(preview.visible?.({ id: 1, is_active: false })).toBe(false);
  });
});

describe("members panel", () => {
  const request = { id: 31, user: 9, user_name: "Ola Student", role: "member", status: "pending", joined_at: null, reviewed_at: null, created_at: "2026-10-01T10:00:00Z" };
  const approved = { ...request, id: 32, user_name: "Sam Member", status: "approved" };
  const listing = (results: object[]) => ({ data: { count: results.length, next: null, previous: null, results } });
  const ok = () => ({ json: async () => ({ success: true }), headers: new Headers() }) as unknown as Response;

  it("no longer reviews join requests inside the dialog: the requests tab points to the dedicated screen", async () => {
    granted.add("groups.manage");
    vi.mocked(apiFetch).mockImplementation(async () => listing([approved]) as never);
    render(wrap(<GroupMembersDialog group={{ id: 5, name: "CS" }} onOpenChange={() => undefined} />));
    const row = await screen.findByTestId("membership-32");
    expect(within(row).getByText("Approved")).toBeTruthy();
    expect(String(vi.mocked(apiFetch).mock.calls[0]?.[0])).toContain("/api/v1/dashboard/groups/5/memberships/");
    await userEvent.click(screen.getByRole("tab", { name: "Join requests" }));
    const link = await screen.findByRole("link", { name: /Open join requests for this group/u });
    expect(link.getAttribute("href")).toContain("/dashboard/groups/requests?group=5");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(vi.mocked(apiFetch).mock.calls.some(([path]) => String(path).includes("/join-requests/"))).toBe(false);
  });

  it("asks before removing a member and only then calls reject", async () => {
    granted.add("groups.manage");
    vi.mocked(apiFetch).mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === "POST") return ok();
      return listing(String(path).includes("join-requests") ? [] : [approved]) as never;
    });
    render(wrap(<GroupMembersDialog group={{ id: 5, name: "CS" }} onOpenChange={() => undefined} />));
    await userEvent.click(await screen.findByRole("tab", { name: "Members" }));
    const row = await screen.findByTestId("membership-32");
    await userEvent.click(within(row).getByRole("button", { name: "Remove" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toContain("Sam Member");
    expect(vi.mocked(apiFetch).mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    await userEvent.click(within(confirm).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(vi.mocked(apiFetch).mock.calls.some(([path]) => path === "/api/v1/dashboard/group-memberships/32/reject/")).toBe(true));
  });

  it("does not load anything without groups.manage", () => {
    render(wrap(<GroupMembersDialog group={{ id: 5, name: "CS" }} onOpenChange={() => undefined} />));
    expect(vi.mocked(apiFetch)).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });
});
