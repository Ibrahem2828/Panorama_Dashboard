import { describe, expect, it } from "vitest";

import { activeChips, activeFieldCount, advancedActiveCount, applyChanges, clearAll, dependants, hasAnyFilter, readValues, toQueryString, toRequestParams } from "@/components/filters/filter-state";
import type { FilterChipLabels, FilterSchema } from "@/components/filters/filter-types";

const opts = [{ value: "1", label: "One" }, { value: "2", label: "Two" }];
const schema: FilterSchema = {
  searchParam: "search", segmentParam: "status", sortParam: "ordering", defaultSort: "-created_at",
  fields: [
    { kind: "select", key: "university", label: "University", options: opts, placement: "advanced" },
    { kind: "cascading-select", key: "faculty", parent: "university", label: "Faculty", options: opts },
    { kind: "cascading-select", key: "major", parent: "faculty", label: "Major", options: opts },
    { kind: "multi-select", key: "kind", label: "Kind", options: [{ value: "subject", label: "Subject" }, { value: "faculty", label: "Faculty community" }], placement: "advanced" },
    { kind: "boolean", key: "is_active", label: "Account", yesLabel: "Active", noLabel: "Disabled", placement: "advanced" },
    { kind: "date-range", key: "registered", fromKey: "registered_after", toKey: "registered_before", label: "Registered", placement: "advanced" },
    { kind: "number-range", key: "members", minKey: "members_min", maxKey: "members_max", label: "Members", placement: "advanced" },
    { kind: "number", key: "inactive_days", label: "Inactive for", unit: "days", placement: "advanced" },
  ],
};
const labels: FilterChipLabels = { yes: "Yes", no: "No", from: "from", to: "to", min: "min", max: "max", number: (value) => `#${value}`, date: (value) => `D${value}` };

describe("readValues", () => {
  it("reads known parameters and drops unknown or malformed ones", () => {
    const values = readValues(new URLSearchParams("faculty=3&is_active=maybe&registered_after=2026-01-05&registered_before=05/01/2026&members_min=4&members_max=abc&evil=1&search=%20ali%20&status=approved&ordering=-last_login&kind=subject,bad%20x"), schema);
    expect(values).toEqual({ faculty: "3", registered_after: "2026-01-05", members_min: "4", search: "ali", status: "approved", ordering: "-last_login", kind: "subject" });
  });
  it("rejects a sort or segment that is not a plain token", () => {
    expect(readValues(new URLSearchParams("ordering=name;drop&status=a b"), schema)).toEqual({});
  });
});

describe("applyChanges", () => {
  it("sets and removes parameters and resets the page", () => {
    const next = applyChanges("page=4&faculty=2&keep=1", schema, { faculty: null, is_active: "true" });
    expect(next.get("page")).toBeNull();
    expect(next.get("faculty")).toBeNull();
    expect(next.get("is_active")).toBe("true");
    expect(next.get("keep")).toBe("1");
  });
  it("clears cascading dependants transitively when a parent changes", () => {
    const next = applyChanges("university=1&faculty=2&major=3", schema, { university: "2" });
    expect(next.get("university")).toBe("2");
    expect(next.has("faculty")).toBe(false);
    expect(next.has("major")).toBe(false);
  });
  it("only clears the child level when a middle parent changes", () => {
    const next = applyChanges("university=1&faculty=2&major=3", schema, { faculty: "1" });
    expect(next.get("university")).toBe("1");
    expect(next.get("faculty")).toBe("1");
    expect(next.has("major")).toBe(false);
  });
  it("keeps a dependant that is changed in the same call", () => {
    const next = applyChanges("university=1&faculty=2", schema, { university: "2", faculty: "1" });
    expect(next.get("faculty")).toBe("1");
  });
  it("keeps the page when the change is paging itself", () => {
    expect(applyChanges("faculty=2", schema, { page: "3" }).get("page")).toBe("3");
    expect(applyChanges("page=3", schema, { page_size: "50" }).get("page")).toBe("3");
  });
  it("lists dependants", () => {
    expect(dependants(schema, ["university"]).sort()).toEqual(["faculty", "major"]);
    expect(dependants(schema, ["major"])).toEqual([]);
  });
});

describe("clearAll and request mapping", () => {
  it("clears filters, search and segment but keeps sorting and page size", () => {
    const next = clearAll("page=2&page_size=50&faculty=2&search=x&status=approved&ordering=full_name&registered_after=2026-01-01", schema);
    expect(next.toString()).toBe("page_size=50&ordering=full_name");
  });
  it("maps values to endpoint parameters with the default sort", () => {
    expect(toRequestParams({ faculty: "2", is_active: "false", search: "sara" }, schema)).toEqual({ faculty: "2", is_active: "false", search: "sara", ordering: "-created_at" });
    expect(toRequestParams({ status: "approved", ordering: "full_name" }, schema, ["status", "ordering"])).toEqual({});
  });
  it("builds a query string with paging", () => {
    expect(toQueryString({ faculty: "2" }, { page: 3, page_size: 25 })).toBe("faculty=2&page=3&page_size=25");
  });
});

describe("counts and chips", () => {
  const values = { university: "1", faculty: "2", is_active: "false", registered_after: "2026-01-01", members_max: "9", inactive_days: "30", search: "x", kind: "subject,faculty" };
  it("counts active fields, not search", () => {
    expect(activeFieldCount(values, schema)).toBe(7);
    expect(advancedActiveCount(values, schema)).toBe(6);
    expect(hasAnyFilter({ search: "x" }, schema)).toBe(true);
    expect(hasAnyFilter({ ordering: "full_name" }, schema)).toBe(false);
  });
  it("describes each active field once with readable values", () => {
    const chips = activeChips(values, schema, labels);
    expect(chips.map((chip) => [chip.id, chip.value])).toEqual([
      ["university", "One"], ["faculty", "Two"], ["kind", "Subject، Faculty community"], ["is_active", "Disabled"],
      ["registered", "from D2026-01-01"], ["members", "max #9"], ["inactive_days", "#30 days"],
    ]);
    expect(chips.find((chip) => chip.id === "registered")?.clear).toEqual(["registered_after", "registered_before"]);
  });
});
