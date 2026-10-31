/** @vitest-environment jsdom */
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTO_REFRESH_INTERVAL_MS, countsForIndicator, isAutoRefreshable, isDialogOpen, readPaused, refreshTick, resetLastRefresh, resetPausedCache, setPaused,
} from "@/lib/api/auto-refresh";
import { createQueryClient } from "@/lib/api/query-client";

const key = (...parts: unknown[]) => ({ queryKey: parts, meta: undefined });

describe("auto refresh settings", () => {
  beforeEach(() => { window.localStorage.clear(); resetPausedCache(); resetLastRefresh(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("refreshes every 30 seconds", () => {
    expect(AUTO_REFRESH_INTERVAL_MS).toBe(30_000);
  });

  it("remembers the pause across reloads", () => {
    expect(readPaused()).toBe(false);
    setPaused(true);
    expect(window.localStorage.getItem("panorama.autoRefresh.paused")).toBe("1");
    resetPausedCache(); // a new page load
    expect(readPaused()).toBe(true);
    setPaused(false);
    resetPausedCache();
    expect(readPaused()).toBe(false);
  });

  it("works without localStorage (private window)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    resetPausedCache();
    expect(readPaused()).toBe(false);
    expect(() => setPaused(true)).not.toThrow();
    expect(readPaused()).toBe(true);
  });

  it("opts out sessions, wizards, file viewers and form lookups, but not ordinary data", () => {
    for (const excluded of [["session"], ["capabilities"], ["term-whatsapp-list", 4], ["term-semester-options"], ["protected-preview", "x"], ["chat-attachment", 1], ["reference-options", "/x"], ["counter-quote", "k"]]) {
      expect(isAutoRefreshable(key(...excluded))).toBe(false);
    }
    for (const data of [["students", {}, 1], ["resource", "audit-logs", 1], ["system-activity", {}], ["finance-summary"]]) {
      expect(isAutoRefreshable(key(...data))).toBe(true);
    }
    expect(isAutoRefreshable({ queryKey: ["anything"], meta: { autoRefresh: false } })).toBe(false);
  });

  it("does not let background plumbing move the last-updated time", () => {
    expect(countsForIndicator(key("inbox-summary"))).toBe(false);
    expect(countsForIndicator(key("session"))).toBe(false);
    expect(countsForIndicator(key("students"))).toBe(true);
  });

  it("sets defaults: focus refetch follows the pause and the opt-outs, hidden tabs never poll", () => {
    const defaults = createQueryClient().getDefaultOptions().queries!;
    expect(defaults.refetchIntervalInBackground).toBe(false);
    const focus = defaults.refetchOnWindowFocus as unknown as (query: unknown) => boolean;
    expect(focus(key("students"))).toBe(true);
    expect(focus(key("session"))).toBe(false);
    setPaused(true);
    expect(focus(key("students"))).toBe(false);
  });
});

describe("refresh tick", () => {
  beforeEach(() => { window.localStorage.clear(); resetPausedCache(); document.body.innerHTML = ""; });

  async function setup() {
    const client = new QueryClient();
    const fetches: Record<string, number> = {};
    const mount = async (name: string, options: { meta?: Record<string, unknown>; refetchInterval?: number } = {}) => {
      fetches[name] = 0;
      const observer = new QueryObserver(client, { queryKey: [name], queryFn: async () => { fetches[name] += 1; return fetches[name]; }, staleTime: 0, ...options });
      observer.subscribe(() => undefined);
      await observer.refetch();
      fetches[name] = 0;
    };
    return { client, fetches, mount };
  }
  const later = () => Date.now() + 60_000;

  it("re-reads idle, mounted data queries", async () => {
    const { client, fetches, mount } = await setup();
    await mount("students");
    expect(await refreshTick(client, { now: later() })).toBe(true);
    expect(fetches.students).toBe(1);
  });

  it("skips opted-out queries, queries with their own faster poll, and fresh data", async () => {
    const { client, fetches, mount } = await setup();
    await mount("session");
    await mount("opted", { meta: { autoRefresh: false } });
    await mount("chat", { refetchInterval: 5000 });
    await mount("students");
    await refreshTick(client, { now: Date.now() + 5_000 });
    expect(fetches).toEqual({ session: 0, opted: 0, chat: 0, students: 0 });
    await refreshTick(client, { now: later() });
    expect(fetches).toEqual({ session: 0, opted: 0, chat: 0, students: 1 });
  });

  it("does nothing while paused, while the tab is hidden, while a dialog is open or while a write is running", async () => {
    const { client, fetches, mount } = await setup();
    await mount("students");
    setPaused(true);
    expect(await refreshTick(client, { now: later() })).toBe(false);
    setPaused(false);
    expect(await refreshTick(client, { now: later(), hidden: true })).toBe(false);
    document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
    expect(isDialogOpen()).toBe(true);
    expect(await refreshTick(client, { now: later() })).toBe(false);
    document.body.innerHTML = "";
    const mutation = client.getMutationCache().build(client, { mutationFn: () => new Promise(() => undefined) });
    void mutation.execute(undefined).catch(() => undefined);
    expect(await refreshTick(client, { now: later() })).toBe(false);
    expect(fetches.students).toBe(0);
  });

  it("the manual refresh (force) ignores pause and age but keeps the opt-outs", async () => {
    const { client, fetches, mount } = await setup();
    await mount("students");
    await mount("session");
    setPaused(true);
    await refreshTick(client, { force: true });
    expect(fetches).toEqual({ students: 1, session: 0 });
  });
});
