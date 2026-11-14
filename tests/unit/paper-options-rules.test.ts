import { describe, expect, it } from "vitest";

import {
  EXTRA_SECTIONS, SECTION_BLOCKS, deleteRequests, effectiveUsd, emptyForm, estimateExtrasCost, extrasBody, formFromEntry, groupOptions, missingCurrencies, needsPrice,
  optionProblems, parseExtraOption, parseItemExtras, parseItemExtrasPrice, parseShopExtras, saveRequests, toggleRequests, usdFromSyp, usableRate, withExtra,
  type ExtraOptionRow,
} from "@/features/printing/paper-options-rules";

const raw = (over: Record<string, unknown> = {}) => ({ id: 1, section: "finishing", code: "wire_comb", name: "تسليك", description: "", price: "20.00", price_unit: "per_50_sheets", currency: "SYP", color_hex: "", sort_order: 1, is_active: true, ...over });
const row = (over: Record<string, unknown> = {}): ExtraOptionRow => parseExtraOption(raw(over)) as ExtraOptionRow;

describe("section blocks", () => {
  it("cover every section exactly once and group each transparency face under one block", () => {
    expect(SECTION_BLOCKS.flatMap((block) => [...block.sections]).sort()).toEqual([...EXTRA_SECTIONS].sort());
    expect(SECTION_BLOCKS.find((block) => block.id === "front_transparency")?.sections).toEqual(["front_transparency_required", "front_transparency_optional"]);
    expect(SECTION_BLOCKS.find((block) => block.id === "back_transparency")?.sections).toEqual(["back_transparency_required", "back_transparency_optional"]);
  });
});

describe("parseExtraOption", () => {
  it("reads a server row", () => {
    expect(row()).toMatchObject({ id: 1, section: "finishing", code: "wire_comb", price: "20.00", priceUnit: "per_50_sheets", currency: "SYP", isActive: true });
  });
  it("rejects rows with an unknown section or no id", () => {
    expect(parseExtraOption(raw({ section: "nope" }))).toBeNull();
    expect(parseExtraOption(raw({ id: "x" }))).toBeNull();
    expect(parseExtraOption(null)).toBeNull();
  });
  it("falls back to per copy for an unknown unit", () => {
    expect(row({ price_unit: "weird" }).priceUnit).toBe("per_copy");
  });
});

describe("groupOptions", () => {
  const rows = [
    row({ id: 1, currency: "SYP", price: "75" }), row({ id: 2, currency: "USD", price: "0.63" }),
    row({ id: 3, code: "punching", name: "تخريز", price: "0", currency: "SYP", is_active: false, sort_order: 2 }),
    row({ id: 4, code: "punching", name: "تخريز", price: "0", currency: "USD", is_active: false, sort_order: 2 }),
  ];
  it("pairs the pound and dollar rows of one option", () => {
    const entries = groupOptions(rows);
    expect(entries.map((entry) => entry.code)).toEqual(["wire_comb", "punching"]);
    expect(entries[0]?.rows.SYP?.id).toBe(1);
    expect(entries[0]?.rows.USD?.id).toBe(2);
  });
  it("flags an inactive option with a zero price as needing a price", () => {
    const [wire, punching] = groupOptions(rows);
    expect(needsPrice(wire!)).toBe(false);
    expect(needsPrice(punching!)).toBe(true);
  });
  it("does not flag an inactive option that already has a price", () => {
    const [entry] = groupOptions([row({ id: 5, is_active: false, price: "10" }), row({ id: 6, currency: "USD", is_active: false, price: "0.08" })]);
    expect(needsPrice(entry!)).toBe(false);
  });
  it("shows a half-switched pair as off and reports a missing currency", () => {
    const [entry] = groupOptions([row({ id: 1 }), row({ id: 2, currency: "USD", is_active: false })]);
    expect(entry?.isActive).toBe(false);
    const [single] = groupOptions([row({ id: 1 })]);
    expect(missingCurrencies(single!)).toEqual(["USD"]);
  });
});

describe("dollar price from the pound price", () => {
  it("divides by the rate and rounds to cents", () => {
    expect(usdFromSyp("75", 120)).toBe("0.63");
    expect(usdFromSyp("20", "120")).toBe("0.17");
    expect(usdFromSyp("0", 120)).toBe("0.00");
    expect(usdFromSyp("12000", 120)).toBe("100.00");
  });
  it("is null without a usable rate or amount", () => {
    expect(usdFromSyp("75", null)).toBeNull();
    expect(usdFromSyp("75", 0)).toBeNull();
    expect(usdFromSyp("", 120)).toBeNull();
    expect(usdFromSyp("abc", 120)).toBeNull();
    expect(usableRate("x")).toBeNull();
  });
});

describe("option form", () => {
  it("follows the rate for a new option only when a rate is known", () => {
    expect(emptyForm("front_cover", 120).usdAuto).toBe(true);
    expect(emptyForm("front_cover", null).usdAuto).toBe(false);
  });
  it("keeps a hand-typed dollar price of an existing option", () => {
    const [entry] = groupOptions([row({ id: 1, price: "75" }), row({ id: 2, currency: "USD", price: "0.60" })]);
    expect(formFromEntry(entry!, 120).usdAuto).toBe(false);
    const [auto] = groupOptions([row({ id: 1, price: "75" }), row({ id: 2, currency: "USD", price: "0.63" })]);
    expect(formFromEntry(auto!, 120).usdAuto).toBe(true);
  });
  it("validates code (new options only), name, prices and order", () => {
    const base = { ...emptyForm("front_cover", 120), code: "card_130", name: "كرتون", sypPrice: "10" };
    expect(optionProblems(base, 120, true)).toEqual({});
    expect(optionProblems({ ...base, code: "" }, 120, true).code).toBe("required");
    expect(optionProblems({ ...base, code: "Bad Code" }, 120, true).code).toBe("format");
    expect(optionProblems({ ...base, code: "card_130" }, 120, true, ["card_130"]).code).toBe("taken");
    expect(optionProblems({ ...base, code: "" }, 120, false)).toEqual({});
    expect(optionProblems({ ...base, name: "  " }, 120, true).name).toBe("required");
    expect(optionProblems({ ...base, sypPrice: "" }, 120, true).syp).toBe("required");
    expect(optionProblems({ ...base, sypPrice: "1.234" }, 120, true).syp).toBe("tooMany");
    expect(optionProblems({ ...base, sypPrice: "99999999999" }, 120, true).syp).toBe("tooBig");
    expect(optionProblems({ ...base, sortOrder: "x" }, 120, true).sort).toBe(true);
  });
  it("needs a typed dollar price when there is no rate", () => {
    const form = { ...emptyForm("front_cover", null), code: "a", name: "x", sypPrice: "10" };
    expect(optionProblems(form, null, true).usd).toBe("required");
    expect(optionProblems({ ...form, usdPrice: "0.08" }, null, true).usd).toBeUndefined();
    expect(effectiveUsd({ ...form, usdAuto: true }, 120)).toBe("0.08");
  });
});

describe("saveRequests", () => {
  it("creates both currency rows for a new option", () => {
    const form = { ...emptyForm("final_delivery", 120), code: "bag", name: "كيس", sypPrice: "120", priceUnit: "per_copy" as const };
    const requests = saveRequests(form, null, 120);
    expect(requests.map((request) => request.method)).toEqual(["POST", "POST"]);
    expect(requests.map((request) => request.body.currency)).toEqual(["SYP", "USD"]);
    expect(requests.map((request) => request.body.price)).toEqual(["120.00", "1.00"]);
    expect(requests[0]?.body).toMatchObject({ section: "final_delivery", code: "bag", name: "كيس", price_unit: "per_copy", is_active: true });
  });
  it("patches existing rows and creates only the missing one", () => {
    const [entry] = groupOptions([row({ id: 1, price: "20" })]);
    const form = { ...formFromEntry(entry!, 120), sypPrice: "30" };
    const requests = saveRequests(form, entry!, 120);
    expect(requests[0]).toMatchObject({ method: "PATCH", path: "/api/v1/dashboard/printing/extra-options/1/", body: { price: "30.00" } });
    expect(requests[1]).toMatchObject({ method: "POST", body: { currency: "USD", code: "wire_comb", section: "finishing", price: "0.25" } });
  });
  it("writes the typed dollar price when it does not follow the rate", () => {
    const form = { ...emptyForm("front_cover", 120), code: "a", name: "x", sypPrice: "10", usdAuto: false, usdPrice: "0.5" };
    expect(saveRequests(form, null, 120)[1]?.body.price).toBe("0.50");
  });
  it("switches and deletes every row of an option", () => {
    const [entry] = groupOptions([row({ id: 1 }), row({ id: 2, currency: "USD" })]);
    expect(toggleRequests(entry!, false).map((request) => [request.method, request.path, request.body])).toEqual([
      ["PATCH", "/api/v1/dashboard/printing/extra-options/1/", { is_active: false }],
      ["PATCH", "/api/v1/dashboard/printing/extra-options/2/", { is_active: false }],
    ]);
    expect(deleteRequests(entry!).map((request) => [request.method, request.path])).toEqual([
      ["DELETE", "/api/v1/dashboard/printing/extra-options/1/"], ["DELETE", "/api/v1/dashboard/printing/extra-options/2/"],
    ]);
  });
});

describe("paper options on an order item", () => {
  const item = { extras: { front_cover: "card_130", finishing: "wire_comb" }, extras_price: "70.00", pricing_snapshot: { extras: [
    { section: "finishing", code: "wire_comb", name: "تسليك", price: "20.00", price_unit: "per_50_sheets", cost: "60.00" },
    { section: "front_cover", code: "card_130", name: "كرتون 130 غ", price: "10.00", price_unit: "per_copy", cost: "10.00" },
    { section: "bogus", code: "x", name: "x" },
  ] } };
  it("prefers the pricing snapshot and orders by section", () => {
    const extras = parseItemExtras(item);
    expect(extras.map((extra) => extra.section)).toEqual(["front_cover", "finishing"]);
    expect(extras[1]).toEqual({ section: "finishing", code: "wire_comb", name: "تسليك", price: "20.00", priceUnit: "per_50_sheets", cost: "60.00" });
    expect(parseItemExtrasPrice(item)).toBe("70.00");
  });
  it("falls back to the codes when there is no snapshot", () => {
    expect(parseItemExtras({ extras: { front_cover: "card_130", bogus: "y" } })).toEqual([{ section: "front_cover", code: "card_130", name: "card_130", price: null, priceUnit: null, cost: null }]);
  });
  it("shows nothing for an item without extras", () => {
    expect(parseItemExtras({})).toEqual([]);
    expect(parseItemExtrasPrice({ extras_price: "0.00" })).toBeNull();
  });
});

describe("options offered at the counter", () => {
  it("keeps only sections that have choices, in form order", () => {
    const sections = parseShopExtras([
      { section: "finishing", label: "الإخراج الفني", options: [{ code: "wire_comb", name: "تسليك", description: "", price: "20.00", price_unit: "per_50_sheets" }] },
      { section: "front_cover", label: "نوع الغلاف الأمامي", options: [{ code: "none", name: "لاشيء", price: "0", price_unit: "per_copy" }, { name: "no code" }] },
      { section: "back_cover", label: "x", options: [] },
      { section: "bogus", options: [{ code: "a" }] },
    ]);
    expect(sections.map((section) => section.section)).toEqual(["front_cover", "finishing"]);
    expect(sections[0]?.options).toHaveLength(1);
    expect(parseShopExtras(undefined)).toEqual([]);
  });
  it("builds and edits the {section: code} choice", () => {
    expect(extrasBody({ front_cover: "a", finishing: "", bogus: "z" })).toEqual({ front_cover: "a" });
    expect(withExtra({ front_cover: "a" }, "finishing", "wire_comb")).toEqual({ front_cover: "a", finishing: "wire_comb" });
    expect(withExtra({ front_cover: "a" }, "front_cover", "")).toEqual({});
  });
});

describe("estimateExtrasCost", () => {
  const sections = parseShopExtras([
    { section: "front_cover", options: [{ code: "card_130", name: "x", price: "10", price_unit: "per_copy" }] },
    { section: "finishing", options: [{ code: "wire_comb", name: "y", price: "20", price_unit: "per_50_sheets" }] },
    { section: "design_paper", options: [{ code: "glossy", name: "z", price: "50", price_unit: "per_sheet" }] },
  ]);
  it("prices per copy, per 50 sheets (rounded up) and per sheet like the server", () => {
    // 2 copies of 60 sheets each: 10 x 2 + 20 x ceil(60 / 50) x 2 = 20 + 80
    expect(estimateExtrasCost({ front_cover: "card_130", finishing: "wire_comb" }, sections, 2, 120)).toBe("100.00");
    expect(estimateExtrasCost({ design_paper: "glossy" }, sections, 3, 30)).toBe("1500.00");
  });
  it("is null when nothing known is chosen or the input is unusable", () => {
    expect(estimateExtrasCost({}, sections, 1, 10)).toBeNull();
    expect(estimateExtrasCost({ front_cover: "gone" }, sections, 1, 10)).toBeNull();
    expect(estimateExtrasCost({ front_cover: "card_130" }, sections, 0, 10)).toBeNull();
  });
});
