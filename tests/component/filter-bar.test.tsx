/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilterBar, FilterEmptyState } from "@/components/filters/filter-bar";
import type { FilterField } from "@/components/filters/filter-types";
import { useFilterState } from "@/components/filters/use-filter-state";
import { I18nProvider } from "@/i18n/provider";
import { createNavigationStore } from "../helpers/navigation-mock";

const nav = vi.hoisted(() => ({ store: null as null | { search: string; set: (next: string) => void; subscribe: (listener: () => void) => () => void } }));
vi.mock("next/navigation", async () => {
  const react = await import("react");
  return {
    useSearchParams: () => {
      const text = react.useSyncExternalStore((listener) => nav.store!.subscribe(listener), () => nav.store!.search, () => nav.store!.search);
      return new URLSearchParams(text);
    },
    useRouter: () => ({ replace: (url: string) => nav.store!.set(url), push: vi.fn() }),
  };
});

const universities = [{ value: "1", label: "Damascus" }, { value: "2", label: "Aleppo" }];
const faculties = [{ value: "10", label: "Informatics" }, { value: "11", label: "Law" }];

function Harness() {
  const fields = useMemo<FilterField[]>(() => [
    { kind: "cascading-select", key: "faculty", parent: "university", label: "Faculty", options: faculties, placement: "primary" },
    { kind: "select", key: "university", label: "University", options: universities, placement: "advanced" },
    { kind: "boolean", key: "is_active", label: "Account status", yesLabel: "Active", noLabel: "Disabled", placement: "advanced" },
    { kind: "date-range", key: "registered", fromKey: "registered_after", toKey: "registered_before", label: "Registered", placement: "advanced" },
  ], []);
  const state = useFilterState({ fields, searchParam: "search", segmentParam: "verification_status", sortParam: "ordering", defaultSort: "-created_at" }, { debounceMs: 20 });
  return (
    <>
      <FilterBar
        state={state}
        segments={[{ value: "", label: "All", count: 30 }, { value: "approved", label: "Verified", count: 20 }, { value: "pending", label: "Pending", count: 10 }]}
        sortOptions={[{ value: "-created_at", label: "Newest" }, { value: "full_name", label: "Name" }]}
        resultCount={12}
      />
      <FilterEmptyState state={state} />
    </>
  );
}

const renderBar = (initial = "") => {
  const store = createNavigationStore(initial);
  nav.store = store;
  render(<I18nProvider locale="en"><Harness /></I18nProvider>);
  return store;
};
const params = (store: { search: string }) => new URLSearchParams(store.search);

beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(cleanup);

describe("FilterBar", () => {
  it("shows segment counts, the result count and marks the active segment", async () => {
    const store = renderBar("verification_status=approved");
    expect(screen.getByRole("button", { name: /Verified/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /^All/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByTestId("segment-count").map((node) => node.textContent)).toEqual(["30", "20", "10"]);
    expect(screen.getByText("12 results")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Pending/ }));
    expect(params(store).get("verification_status")).toBe("pending");
    await userEvent.click(screen.getByRole("button", { name: /^All/ }));
    expect(params(store).has("verification_status")).toBe(false);
  });

  it("renders a removable chip per active filter and removing one updates the URL", async () => {
    const store = renderBar("faculty=10&is_active=false&page=3");
    const chips = within(screen.getByRole("list", { name: "Active filters" }));
    expect(chips.getByRole("button", { name: "Remove filter: Account status: Disabled" })).toBeTruthy();
    await userEvent.click(chips.getByRole("button", { name: "Remove filter: Faculty: Informatics" }));
    expect(params(store).toString()).toBe("is_active=false");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Remove filter: Faculty: Informatics" })).toBeNull());
  });

  it("clear all removes filters, search and segment but keeps the sort", async () => {
    const store = renderBar("faculty=10&search=ali&verification_status=pending&ordering=full_name&page=2");
    await userEvent.click(screen.getAllByRole("button", { name: "Clear all" })[0]!);
    expect(params(store).toString()).toBe("ordering=full_name");
    await waitFor(() => expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe(""));
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  it("debounces the search into the URL and returns to page 1", async () => {
    const store = renderBar("page=4&faculty=10");
    await userEvent.type(screen.getByRole("searchbox"), "sara");
    await waitFor(() => expect(params(store).get("search")).toBe("sara"));
    expect(params(store).has("page")).toBe(false);
    expect(params(store).get("faculty")).toBe("10");
  });

  it("follows the URL when it changes from outside (back/forward)", async () => {
    const store = renderBar("search=old");
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("old");
    store.set("search=newer");
    await waitFor(() => expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("newer"));
  });

  it("opens advanced filters in a drawer: tri-state boolean, date range and cascading reset", async () => {
    const store = renderBar("university=1&faculty=10");
    await userEvent.click(screen.getByRole("button", { name: /More filters/ }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "Disabled" }));
    expect(params(store).get("is_active")).toBe("false");
    await userEvent.click(dialog.getByRole("radio", { name: "Active" }));
    expect(params(store).get("is_active")).toBe("true");
    await userEvent.click(dialog.getByRole("radio", { name: "All" }));
    expect(params(store).has("is_active")).toBe(false);

    const from = dialog.getByLabelText("From") as HTMLInputElement;
    await userEvent.type(from, "2026-02-01");
    expect(params(store).get("registered_after")).toBe("2026-02-01");

    // Changing the parent (university) clears the dependent faculty.
    await userEvent.click(dialog.getByRole("combobox", { name: "University" }));
    await userEvent.click(await screen.findByRole("option", { name: "Aleppo" }));
    expect(params(store).get("university")).toBe("2");
    expect(params(store).has("faculty")).toBe(false);
  });

  it("offers the clear-filters action in the empty state when filters are active", async () => {
    const store = renderBar("faculty=11");
    await userEvent.click(within(screen.getByTestId("filter-empty")).getByRole("button", { name: "Clear filters" }));
    expect(store.search).toBe("");
  });

  it("sorts through the sort control", async () => {
    const store = renderBar();
    await userEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
    await userEvent.click(await screen.findByRole("option", { name: "Name" }));
    expect(params(store).get("ordering")).toBe("full_name");
  });
});
