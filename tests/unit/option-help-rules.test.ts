import { describe, expect, it } from "vitest";

import {
  BODY_MAX, BODY_NEAR, IMAGE_MAX_BYTES, TITLE_MAX,
  bodyGuidance, emptyForm, extraSectionLabelKey, filterRows, formFromRow, groupByTopic, groupOfTopic, helpFields, helpProblems,
  imageProblem, isValidTopic, keyHints, missingKeys, multipartEntries, optionHelpPath, parseOptionHelp, previewParagraphs, topicChoices,
  type OptionHelpRow,
} from "@/features/printing/option-help-rules";
import { CATALOG_SECTIONS, resolveSection } from "@/features/printing/printing-home-rules";

function row(patch: Partial<OptionHelpRow> & { id: number }): OptionHelpRow {
  return { topic: "print_size", key: "", title: "t", body: "b", imageUrl: null, imageCaption: "", sortOrder: 0, isActive: true, ...patch };
}
const form = (patch = {}) => ({ ...emptyForm("print_size"), title: "ورق A4", body: "الحجم القياسي", ...patch });

describe("topics", () => {
  it("accepts the fixed topics and extra:<slug>, nothing else", () => {
    expect(isValidTopic("print_size")).toBe(true);
    expect(isValidTopic("extra:front_cover")).toBe(true);
    expect(isValidTopic("extra:")).toBe(false);
    expect(isValidTopic("extra:Front Cover")).toBe(false);
    expect(isValidTopic("paper")).toBe(false);
    expect(isValidTopic("")).toBe(false);
  });
  it("puts every extra section in one group", () => {
    expect(groupOfTopic("extra:finishing")).toBe("extra");
    expect(groupOfTopic("binding")).toBe("binding");
    expect(groupOfTopic("nonsense")).toBeNull();
  });
  it("offers fixed topics then the known sections, all valid", () => {
    const choices = topicChoices();
    expect(choices.slice(0, 6)).toEqual(["print_size", "print_colour", "print_sides", "binding", "cover", "spiral_wire"]);
    expect(choices.every(isValidTopic)).toBe(true);
    expect(choices.filter((topic) => extraSectionLabelKey(topic)).length).toBe(9);
    expect(extraSectionLabelKey("extra:custom_thing")).toBeNull();
  });
});

describe("key hints", () => {
  it("lists the option codes the app knows", () => {
    expect(keyHints("print_size")).toEqual(["A4", "A5", "A3"]);
    expect(keyHints("binding")).toContain("spiral");
    expect(keyHints("cover")).toEqual([]);
    expect(keyHints("extra:front_cover")).toEqual([]);
  });
  it("points at codes that still have no explanation", () => {
    const rows = [row({ id: 1, key: "A4" }), row({ id: 2, key: "", topic: "print_size" }), row({ id: 3, key: "A5", topic: "binding" })];
    expect(missingKeys("print_size", rows)).toEqual(["A5", "A3"]);
    expect(missingKeys("binding", rows)).toEqual(["none", "staple", "spiral", "thermal", "beads", "other"]);
  });
});

describe("parseOptionHelp", () => {
  it("reads a server row and defaults the optional parts", () => {
    expect(parseOptionHelp({ id: 4, topic: "binding", key: "spiral", title: "سلك", body: "نص", image_url: "http://x/y.png", image_caption: "c", sort_order: 3, is_active: false }))
      .toEqual({ id: 4, topic: "binding", key: "spiral", title: "سلك", body: "نص", imageUrl: "http://x/y.png", imageCaption: "c", sortOrder: 3, isActive: false });
    expect(parseOptionHelp({ id: 5, topic: "cover" })).toMatchObject({ key: "", title: "", imageUrl: null, sortOrder: 0, isActive: true });
  });
  it("drops rows it cannot draw", () => {
    expect(parseOptionHelp(null)).toBeNull();
    expect(parseOptionHelp({ topic: "cover" })).toBeNull();
    expect(parseOptionHelp({ id: 0, topic: "cover" })).toBeNull();
    expect(parseOptionHelp({ id: 1 })).toBeNull();
  });
  it("builds the item address", () => {
    expect(optionHelpPath(12)).toBe("/api/v1/dashboard/printing/option-help/12/");
  });
});

describe("grouping and filtering", () => {
  const rows = [
    row({ id: 1, topic: "binding", key: "staple", sortOrder: 2, title: "تدبيس" }),
    row({ id: 2, topic: "binding", key: "", sortOrder: 9, title: "التجليد" }),
    row({ id: 3, topic: "binding", key: "spiral", sortOrder: 1, title: "سلك", isActive: false }),
    row({ id: 4, topic: "extra:finishing", key: "gloss", title: "لمعة" }),
    row({ id: 5, topic: "extra:final_delivery", key: "", title: "تسليم" }),
    row({ id: 6, topic: "print_size", key: "A4", title: "ورق A4" }),
    row({ id: 7, topic: "unknown_topic", title: "x" }),
  ];
  it("orders groups as on the order form and the whole-topic note first", () => {
    const groups = groupByTopic(rows);
    expect(groups.map((group) => group.id)).toEqual(["print_size", "binding", "extra"]);
    expect(groups[1]?.rows.map((entry) => entry.id)).toEqual([2, 3, 1]);
    expect(groups[2]?.rows.map((entry) => entry.id)).toEqual([5, 4]);
  });
  it("leaves out topics the screen does not know and empty groups", () => {
    expect(groupByTopic(rows).flatMap((group) => group.rows).some((entry) => entry.id === 7)).toBe(false);
    expect(groupByTopic([])).toEqual([]);
  });
  it("filters by status, group and text", () => {
    const all = { query: "", status: "all", group: "all" } as const;
    expect(filterRows(rows, all)).toHaveLength(7);
    expect(filterRows(rows, { ...all, status: "inactive" }).map((entry) => entry.id)).toEqual([3]);
    expect(filterRows(rows, { ...all, status: "active", group: "binding" }).map((entry) => entry.id)).toEqual([1, 2]);
    expect(filterRows(rows, { ...all, group: "extra" }).map((entry) => entry.id)).toEqual([4, 5]);
    expect(filterRows(rows, { ...all, query: "  SPIRAL " }).map((entry) => entry.id)).toEqual([3]);
    expect(filterRows(rows, { ...all, query: "لمعة" }).map((entry) => entry.id)).toEqual([4]);
  });
});

describe("form validation", () => {
  it("accepts a complete form with an empty key (whole topic)", () => {
    expect(helpProblems(form())).toEqual({});
    expect(helpProblems(form({ key: "A4" }))).toEqual({});
  });
  it("needs a title and a body", () => {
    expect(helpProblems(form({ title: "  ", body: "" }))).toEqual({ title: "required", body: "required" });
  });
  it("limits lengths", () => {
    expect(helpProblems(form({ title: "x".repeat(TITLE_MAX + 1) }))).toEqual({ title: "tooLong" });
    expect(helpProblems(form({ body: "x".repeat(BODY_MAX + 1) }))).toEqual({ body: "tooLong" });
    expect(helpProblems(form({ body: "x".repeat(BODY_MAX) }))).toEqual({});
    expect(helpProblems(form({ imageCaption: "c".repeat(256) }))).toEqual({ imageCaption: "tooLong" });
  });
  it("checks the option code like the server", () => {
    expect(helpProblems(form({ key: "double_sided" }))).toEqual({});
    expect(helpProblems(form({ key: "a b" }))).toEqual({ key: "format" });
    expect(helpProblems(form({ key: "-x" }))).toEqual({ key: "format" });
    expect(helpProblems(form({ key: "k".repeat(65) }))).toEqual({ key: "tooLong" });
  });
  it("checks the topic and the order number", () => {
    expect(helpProblems(form({ topic: "bogus" }))).toEqual({ topic: "invalid" });
    expect(helpProblems(form({ sortOrder: "32768" }))).toEqual({ sortOrder: "invalid" });
    expect(helpProblems(form({ sortOrder: "32767" }))).toEqual({});
    expect(helpProblems(form({ sortOrder: "" }))).toEqual({});
    expect(helpProblems(form({ sortOrder: "1.5" }))).toEqual({ sortOrder: "invalid" });
  });
  it("catches a second explanation for the same option, except the one being edited", () => {
    const rows = [row({ id: 1, topic: "print_size", key: "A4" })];
    expect(helpProblems(form({ key: "A4" }), rows)).toEqual({ duplicate: "invalid" });
    expect(helpProblems(form({ key: "A4" }), rows, 1)).toEqual({});
    expect(helpProblems(form({ key: "A5" }), rows)).toEqual({});
    expect(helpProblems(form({ key: " A4 " }), rows)).toEqual({ duplicate: "invalid" });
  });
});

describe("images", () => {
  it("accepts jpeg, png and webp up to the size limit", () => {
    expect(imageProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(imageProblem({ type: "image/webp", size: IMAGE_MAX_BYTES })).toBeNull();
    expect(imageProblem({ type: "image/gif", size: 10 })).toBe("type");
    expect(imageProblem({ type: "application/pdf", size: 10 })).toBe("type");
    expect(imageProblem({ type: "image/jpeg", size: IMAGE_MAX_BYTES + 1 })).toBe("size");
  });
});

describe("request body", () => {
  it("trims the text fields and defaults the order to 0", () => {
    expect(helpFields(form({ key: " A4 ", title: " ورق ", body: " نص \n", sortOrder: "" })))
      .toEqual({ topic: "print_size", key: "A4", title: "ورق", body: "نص", image_caption: "", sort_order: 0, is_active: true });
  });
  it("uses plain JSON unless the image changes", () => {
    expect(multipartEntries(form(), { kind: "keep" })).toBeNull();
  });
  it("sends an empty image to remove it and the file to replace it", () => {
    const removed = multipartEntries(form(), { kind: "remove" });
    expect(removed?.find(([name]) => name === "image")?.[1]).toBe("");
    expect(removed?.find(([name]) => name === "is_active")?.[1]).toBe("true");
    const file = new File(["x"], "a.png", { type: "image/png" });
    expect(multipartEntries(form({ isActive: false }), { kind: "replace", file })?.find(([name]) => name === "image")?.[1]).toBe(file);
    expect(multipartEntries(form({ isActive: false }), { kind: "replace", file })?.find(([name]) => name === "is_active")?.[1]).toBe("false");
  });
  it("restores a row into the form", () => {
    expect(formFromRow(row({ id: 1, topic: "binding", key: "spiral", title: "سلك", body: "نص", imageCaption: "c", sortOrder: 4, isActive: false })))
      .toEqual({ topic: "binding", key: "spiral", title: "سلك", body: "نص", imageCaption: "c", sortOrder: "4", isActive: false });
  });
});

describe("body guidance and preview", () => {
  it("warns before the limit and flags an excess", () => {
    expect(bodyGuidance("")).toMatchObject({ length: 0, lines: 0, level: "ok" });
    expect(bodyGuidance("a\n\nb\n")).toMatchObject({ length: 4, lines: 2, level: "ok" });
    expect(bodyGuidance("x".repeat(BODY_NEAR)).level).toBe("near");
    expect(bodyGuidance("x".repeat(BODY_MAX))).toMatchObject({ level: "near", remaining: 0 });
    expect(bodyGuidance("x".repeat(BODY_MAX + 5))).toMatchObject({ level: "over", remaining: -5 });
  });
  it("turns each non-empty line into a paragraph", () => {
    expect(previewParagraphs("أول\r\n\r\n  ثاني  \n")).toEqual(["أول", "ثاني"]);
    expect(previewParagraphs("   ")).toEqual([]);
  });
});

describe("catalog layout", () => {
  it("has the help section and resolves it from the address", () => {
    expect(CATALOG_SECTIONS).toContain("help");
    expect(resolveSection("help")).toBe("help");
  });
});
