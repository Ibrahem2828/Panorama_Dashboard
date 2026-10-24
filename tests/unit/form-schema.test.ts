import { describe, expect, it } from "vitest";

import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";
import type { ResourceDefinition } from "@/contracts/types";
import {
  changedFields, endAfterStart, formatFieldError, hasFile, initialFormValues, mapServerErrors, parseField, toFormData, validateForm,
  type FieldSpec,
} from "@/features/resources/form-schema";
import { RESOURCE_FORM_POLICIES, formSpecsFor, policyAllows } from "@/features/resources/resource-form-policy";
import { messages } from "@/i18n/messages";

const WRITABLE = Object.entries(RESOURCE_FORM_POLICIES).filter(([, policy]) => policy.mutationMethod !== null).map(([key]) => key);
const definitionOf = (key: string) => RESOURCE_DEFINITIONS[key as keyof typeof RESOURCE_DEFINITIONS] as ResourceDefinition;
const spec = (overrides: Partial<FieldSpec> & Pick<FieldSpec, "name" | "kind">): FieldSpec => ({ required: false, nullable: false, ...overrides });

describe("resource form policies (contract coverage)", () => {
  it("exposes exactly the resources the dashboard can write", () => {
    expect([...WRITABLE].sort()).toEqual([
      "academic-years", "announcements", "faculties", "feature-flags", "files", "finance-exchange-rates", "finance-expenses", "finance-inventory-items", "groups", "maintenance-modes", "majors", "mobile-release-policies",
      "printing-binding-prices", "printing-covers", "printing-pickup-locations", "printing-pricing-rules", "printing-products", "printing-wire-specs", "privacy-policy-versions", "semesters",
      "subjects", "terms-versions", "universities", "users",
    ]);
  });

  it.each(WRITABLE.filter((key) => key !== "users"))("%s: every field the contract requires on create is in the create allowlist", (key) => {
    const policy = RESOURCE_FORM_POLICIES[key];
    const required = definitionOf(key).fields.filter((field) => field.required && !field.readOnly).map((field) => field.name);
    expect(required.filter((name) => !policy.allowedCreateFields.includes(name))).toEqual([]);
  });

  it.each(WRITABLE)("%s: allowlisted fields exist in the contract and are writable", (key) => {
    const policy = RESOURCE_FORM_POLICIES[key];
    const fields = new Map(definitionOf(key).fields.map((field) => [field.name, field]));
    for (const name of [...policy.allowedCreateFields, ...policy.allowedUpdateFields]) {
      expect(fields.has(name), `${key}.${name} missing from the contract`).toBe(true);
      expect(fields.get(name)?.readOnly, `${key}.${name} is read-only`).toBe(false);
    }
  });

  it("keeps every other resource read-only", () => {
    for (const [key, policy] of Object.entries(RESOURCE_FORM_POLICIES)) {
      if (policy.mutationMethod === null) {
        expect(policy.allowedCreateFields).toEqual([]);
        expect(policyAllows(policy, "create")).toBe(false);
        expect(policyAllows(policy, "edit")).toBe(false);
        expect(policyAllows(policy, "delete"), key).toBe(false);
      }
    }
  });

  it("mirrors the backend capability for each write", () => {
    const capabilityOf = (key: string) => RESOURCE_FORM_POLICIES[key].capability;
    for (const key of ["universities", "faculties", "majors", "academic-years", "semesters", "subjects"]) expect(capabilityOf(key)).toBe("academic.manage");
    for (const key of ["printing-pricing-rules", "printing-binding-prices", "printing-pickup-locations"]) expect(capabilityOf(key)).toBe("printing.manage");
    for (const key of ["privacy-policy-versions", "terms-versions", "maintenance-modes", "feature-flags", "mobile-release-policies"]) expect(capabilityOf(key)).toBe("product.manage");
    expect(capabilityOf("announcements")).toBe("announcements.manage");
    expect(capabilityOf("users")).toBe("users.manage");
  });

  it("only offers delete where a soft delete does not break re-creation", () => {
    const deletable = WRITABLE.filter((key) => policyAllows(RESOURCE_FORM_POLICIES[key], "delete")).sort();
    expect(deletable).toEqual(["academic-years", "announcements", "faculties", "files", "finance-exchange-rates", "finance-expenses", "finance-inventory-items", "majors", "printing-pickup-locations", "printing-pricing-rules", "printing-products", "printing-wire-specs", "semesters", "subjects", "universities"]);
  });
});

describe("formSpecsFor", () => {
  it("builds the academic year form with the required order as an integer", () => {
    const specs = formSpecsFor("academic-years", "create");
    expect(specs.map((item) => item.name)).toEqual(["name", "order", "is_active"]);
    expect(specs.find((item) => item.name === "order")).toMatchObject({ kind: "integer", required: true, min: 0, max: 32767 });
    expect(specs.find((item) => item.name === "is_active")).toMatchObject({ kind: "boolean", defaultValue: true });
  });

  it("builds the subject form: faculty, year and semester are required relations, the specialization is optional and follows the faculty", () => {
    const specs = formSpecsFor("subjects", "create");
    const relations = Object.fromEntries(specs.filter((item) => item.kind === "relation").map((item) => [item.name, item.relationEndpoint]));
    expect(relations).toEqual({
      faculty: "/api/v1/dashboard/faculties/",
      major: "/api/v1/dashboard/majors/",
      academic_year: "/api/v1/dashboard/academic-years/",
      semester: "/api/v1/dashboard/semesters/",
    });
    const byName = Object.fromEntries(specs.map((item) => [item.name, item]));
    expect(["faculty", "academic_year", "semester"].every((name) => byName[name]?.required)).toBe(true);
    expect(byName.major).toMatchObject({ required: false, nullable: true, relationFilter: { param: "faculty", from: "faculty" } });
  });

  it("types printing prices as decimals and dates as datetimes", () => {
    const rule = formSpecsFor("printing-pricing-rules", "create");
    expect(rule.find((item) => item.name === "price_per_sheet")).toMatchObject({ kind: "decimal", required: true });
    expect(rule.find((item) => item.name === "effective_to")).toMatchObject({ kind: "datetime", nullable: true });
    expect(rule.find((item) => item.name === "currency")).toMatchObject({ defaultValue: "SYP" });
  });

  it("limits feature-flag edits to the mutable fields and lets platform/role mean all", () => {
    expect(formSpecsFor("feature-flags", "edit").map((item) => item.name)).toEqual(["description", "enabled", "expose_to_mobile"]);
    const create = formSpecsFor("feature-flags", "create");
    expect(create.find((item) => item.name === "platform")).toMatchObject({ kind: "select", allowBlank: true, required: false });
    expect(create.find((item) => item.name === "role")).toMatchObject({ kind: "select", allowBlank: true });
  });

  it("applies extra overrides on top of the policy (dynamic role options)", () => {
    const [role] = formSpecsFor("users", "edit", { role: { options: ["print_staff"] } }, ["role"]);
    expect(role.options).toEqual(["print_staff"]);
  });
});

describe("validateForm per resource", () => {
  const valid: Record<string, Record<string, unknown>> = {
    universities: { name: "Damascus University", code: "dam", description: "", is_active: true },
    faculties: { university: "3", name: "Engineering", code: "ENG", is_active: true },
    majors: { faculty: "4", name: "Software", code: "SW", is_active: true },
    "academic-years": { name: "First year", order: "1", is_active: true },
    semesters: { name: "Autumn", order: "1", is_active: true },
    subjects: { faculty: "3", major: "5", academic_year: "1", semester: "2", name: "Algorithms", code: "CS201", description: "", is_active: true },
    "printing-pricing-rules": { name: "A4 mono", color_mode: "black_white", paper_size: "A4", sides: "one_sided", price_per_sheet: "150.50", setup_fee: "0", currency: "SYP", effective_from: "", effective_to: "", is_active: true },
    "printing-binding-prices": { binding: "spiral", kind: "spiral", price_mode: "per_copy", price_per_copy: "1200", currency: "SYP", is_active: true },
    "printing-pickup-locations": { name: "Main library", address: "Ground floor", instructions: "", sort_order: "2", is_active: true },
    "privacy-policy-versions": { version: "2026-01", content_url: "https://example.com/privacy", requires_reacceptance: true, is_active: false, published_at: "" },
    "terms-versions": { version: "2026-01", content_url: "https://example.com/terms", requires_reacceptance: false, is_active: false, published_at: "" },
    "maintenance-modes": { enabled: true, title_ar: "صيانة", title_en: "Maintenance", message_ar: "", message_en: "Back soon", starts_at: "", ends_at: "", estimated_end_at: "2030-01-01T10:00", retry_after_seconds: "300", bypass_staff: true },
    "feature-flags": { key: "new-search", description: "", platform: "", role: "", enabled: true, expose_to_mobile: true },
    "mobile-release-policies": { platform: "android", latest_version: "1.4.0", latest_build: "14", minimum_supported_version: "1.2.0", minimum_supported_build: "12", update_mode: "required", store_url: "https://play.google.com/store/apps/details?id=x", message_ar: "", message_en: "", grace_period_ends_at: "", emergency_update_bypass: false, is_active: true },
    announcements: { title: "Exams", description: "Schedule published", link: "", target_user_type: "students", target_university: "", target_faculty: "", target_major: "", target_academic_year: "", target_semester: "", starts_at: "2030-01-01T08:00", ends_at: "2030-02-01T08:00", is_active: true },
  };

  it.each(Object.keys(valid))("%s: accepts a complete valid submission", (key) => {
    const result = validateForm(formSpecsFor(key, "create"), valid[key], "create", RESOURCE_FORM_POLICIES[key].crossRules);
    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
  });

  it.each(Object.keys(valid))("%s: rejects an empty form with a required error on every required field", (key) => {
    const specs = formSpecsFor(key, "create");
    const result = validateForm(specs, initialFormValues(specs, null), "create", RESOURCE_FORM_POLICIES[key].crossRules);
    const required = specs.filter((item) => item.required && item.kind !== "boolean" && !(item.kind === "select" && item.allowBlank)).map((item) => item.name);
    // Defaulted required fields (currency, update_mode...) legitimately pass; everything else must be flagged.
    const defaulted = new Set(specs.filter((item) => item.defaultValue !== undefined && item.defaultValue !== "").map((item) => item.name));
    const mustFail = required.filter((name) => !defaulted.has(name));
    if (mustFail.length) {
      expect(result.ok).toBe(false);
      if (!result.ok) for (const name of mustFail) expect(result.errors[name], `${key}.${name}`).toBe("validation.required");
    }
  });

  it("serializes typed values: integers as numbers, relations as ids, decimals as strings, datetimes as ISO", () => {
    const subject = validateForm(formSpecsFor("subjects", "create"), valid.subjects, "create");
    expect(subject).toMatchObject({ ok: true, payload: { major: 5, academic_year: 1, semester: 2, name: "Algorithms", is_active: true } });
    const rule = validateForm(formSpecsFor("printing-pricing-rules", "create"), { ...valid["printing-pricing-rules"], effective_from: "2030-05-01T09:30" }, "create");
    expect(rule.ok && rule.payload.price_per_sheet).toBe("150.50");
    expect(rule.ok && rule.payload.effective_from).toBe(new Date("2030-05-01T09:30").toISOString());
    const year = validateForm(formSpecsFor("academic-years", "create"), valid["academic-years"], "create");
    expect(year.ok && year.payload.order).toBe(1);
  });

  it("flags bad numbers, decimals, urls and dates with field errors", () => {
    const rule = validateForm(formSpecsFor("printing-pricing-rules", "create"), { ...valid["printing-pricing-rules"], price_per_sheet: "12.345", setup_fee: "-1" }, "create");
    expect(rule).toMatchObject({ ok: false, errors: { price_per_sheet: "validation.decimalPlaces:2", setup_fee: "validation.nonNegative" } });
    const order = validateForm(formSpecsFor("academic-years", "create"), { ...valid["academic-years"], order: "abc" }, "create");
    expect(order).toMatchObject({ ok: false, errors: { order: "validation.integer" } });
    const tooBig = validateForm(formSpecsFor("academic-years", "create"), { ...valid["academic-years"], order: "40000" }, "create");
    expect(tooBig).toMatchObject({ ok: false, errors: { order: "validation.max:32767" } });
    const policy = validateForm(formSpecsFor("terms-versions", "create"), { ...valid["terms-versions"], content_url: "javascript:alert(1)" }, "create");
    expect(policy).toMatchObject({ ok: false, errors: { content_url: "validation.url" } });
    const flag = validateForm(formSpecsFor("feature-flags", "create"), { ...valid["feature-flags"], key: "bad key!" }, "create");
    expect(flag).toMatchObject({ ok: false, errors: { key: "validation.pattern" } });
  });

  it("checks date ordering across fields", () => {
    const rule = validateForm(formSpecsFor("printing-pricing-rules", "create"), { ...valid["printing-pricing-rules"], effective_from: "2030-05-01T09:00", effective_to: "2030-04-01T09:00" }, "create", RESOURCE_FORM_POLICIES["printing-pricing-rules"].crossRules);
    expect(rule).toMatchObject({ ok: false, errors: { effective_to: "validation.endAfterStart" } });
    const announcement = validateForm(formSpecsFor("announcements", "create"), { ...valid.announcements, ends_at: "2029-01-01T08:00" }, "create", RESOURCE_FORM_POLICIES.announcements.crossRules);
    expect(announcement).toMatchObject({ ok: false, errors: { ends_at: "validation.endAfterStart" } });
  });

  it("enforces required relations and select options", () => {
    const subject = validateForm(formSpecsFor("subjects", "create"), { ...valid.subjects, faculty: "", semester: "x" }, "create");
    expect(subject).toMatchObject({ ok: false, errors: { faculty: "validation.required", semester: "validation.relation" } });
    const binding = validateForm(formSpecsFor("printing-binding-prices", "create"), { ...valid["printing-binding-prices"], kind: "glue" }, "create");
    expect(binding).toMatchObject({ ok: false, errors: { kind: "validation.option" } });
  });

  it("enforces max lengths from the contract", () => {
    const university = validateForm(formSpecsFor("universities", "create"), { ...valid.universities, code: "x".repeat(33) }, "create");
    expect(university).toMatchObject({ ok: false, errors: { code: "validation.maxLength:32" } });
  });
});

describe("edit mode", () => {
  const specs = formSpecsFor("printing-pickup-locations", "edit");
  const entity = { id: 1, name: "Main", address: "A", instructions: "", sort_order: 2, is_active: true };

  it("starts from the stored values", () => {
    expect(initialFormValues(specs, entity)).toMatchObject({ name: "Main", sort_order: "2", is_active: true });
  });

  it("sends only changed fields and nothing when untouched", () => {
    const untouched = validateForm(specs, initialFormValues(specs, entity), "edit");
    expect(untouched.ok && changedFields(specs, untouched.payload, entity)).toEqual({});
    const edited = validateForm(specs, { ...initialFormValues(specs, entity), name: "Library", sort_order: "5" }, "edit");
    expect(edited.ok && changedFields(specs, edited.payload, entity)).toEqual({ name: "Library", sort_order: 5 });
  });

  it("compares dates and decimals by value", () => {
    const rule = formSpecsFor("printing-pricing-rules", "edit");
    const stored = { price_per_sheet: "150.00", effective_from: "2030-05-01T06:30:00Z", currency: "SYP", is_active: true, name: "x", color_mode: "color", paper_size: "A4", sides: "one_sided", setup_fee: "0.00", effective_to: null };
    const values = initialFormValues(rule, stored);
    const result = validateForm(rule, { ...values, price_per_sheet: "150" }, "edit");
    expect(result.ok && changedFields(rule, result.payload, stored)).toEqual({});
  });

  it("clears an optional text field with an empty string and a nullable one with null", () => {
    const rule = formSpecsFor("printing-pricing-rules", "edit");
    const stored = { name: "x", color_mode: "color", paper_size: "A4", sides: "one_sided", price_per_sheet: "1", setup_fee: "0", currency: "SYP", is_active: true, effective_from: "2030-05-01T06:30:00Z", effective_to: "2031-05-01T06:30:00Z" };
    const result = validateForm(rule, { ...initialFormValues(rule, stored), effective_to: "" }, "edit");
    expect(result.ok && changedFields(rule, result.payload, stored)).toEqual({ effective_to: null });
  });
});

describe("parseField", () => {
  it("allows the blank option of a select that means all", () => {
    const platform = spec({ name: "platform", kind: "select", options: ["android", "ios"], allowBlank: true });
    expect(parseField(platform, "", "create")).toEqual({ ok: true, value: "" });
    expect(parseField(platform, "web", "create")).toEqual({ ok: false, error: "validation.option" });
  });

  it("rejects too many digits before the decimal point", () => {
    expect(parseField(spec({ name: "p", kind: "decimal" }), "12345678901", "create")).toEqual({ ok: false, error: "validation.decimalDigits:10" });
    expect(parseField(spec({ name: "p", kind: "decimal" }), "0001.50", "create")).toEqual({ ok: true, value: "0001.50" });
  });

  it("trims text and refuses a whitespace-only required value", () => {
    expect(parseField(spec({ name: "n", kind: "text", required: true }), "  x  ", "create")).toEqual({ ok: true, value: "x" });
    expect(parseField(spec({ name: "n", kind: "text", required: true }), "   ", "create")).toEqual({ ok: false, error: "validation.required" });
  });
});

describe("endAfterStart", () => {
  it("passes when either side is missing and respects allowEqual", () => {
    const strict = endAfterStart("a", "b");
    expect(strict.check({ a: "2030-01-01T00:00:00.000Z" })).toBeNull();
    expect(strict.check({ a: "2030-01-01T00:00:00.000Z", b: "2030-01-01T00:00:00.000Z" })).toEqual({ field: "b", error: "validation.endAfterStart" });
    expect(endAfterStart("a", "b", true).check({ a: "2030-01-01T00:00:00.000Z", b: "2030-01-01T00:00:00.000Z" })).toBeNull();
  });
});

describe("multipart bodies", () => {
  it("builds FormData for payloads with a file and skips nulls", () => {
    const file = new File(["x"], "banner.png", { type: "image/png" });
    const payload = { title: "Exams", image: file, is_active: true, target_major: null };
    expect(hasFile(payload)).toBe(true);
    const form = toFormData(payload);
    expect(form.get("title")).toBe("Exams");
    expect(form.get("is_active")).toBe("true");
    expect(form.has("target_major")).toBe(false);
    expect((form.get("image") as File).name).toBe("banner.png");
    expect(hasFile({ title: "x" })).toBe(false);
  });
});

describe("server errors", () => {
  it("maps DRF field errors to the form and the rest to one general message", () => {
    expect(mapServerErrors({ order: ["academic year with this order already exists."], detail: "Nope", extra: ["x"] }, ["name", "order"])).toEqual({
      fields: { order: "academic year with this order already exists." },
      general: "Nope extra: x",
    });
    expect(mapServerErrors({ non_field_errors: ["Bad combination."] }, ["name"])).toEqual({ fields: {}, general: "Bad combination." });
    expect(mapServerErrors(undefined, ["name"])).toEqual({ fields: {}, general: null });
  });
});

describe("formatFieldError", () => {
  const translate = (key: string, values?: Record<string, string | number>) => `${key}|${values?.n ?? ""}`;
  it("renders validation keys with their argument and passes server text through", () => {
    expect(formatFieldError("validation.maxLength:32", translate)).toBe("validation.maxLength|32");
    expect(formatFieldError("validation.required", translate)).toBe("validation.required|");
    expect(formatFieldError("Already exists.", translate)).toBe("Already exists.");
  });

  it("has a localized message for every validation key the engine can emit", () => {
    const keys = ["required", "minLength", "maxLength", "min", "max", "integer", "decimal", "decimalPlaces", "decimalDigits", "nonNegative", "url", "datetime", "option", "pattern", "endAfterStart", "relation", "activeRelease", "requiredBuild"];
    for (const key of keys) {
      expect(messages.ar[`validation.${key}` as keyof typeof messages.ar]).toBeTruthy();
      expect(messages.en[`validation.${key}` as keyof typeof messages.en]).toBeTruthy();
    }
  });
});

describe("labels", () => {
  it("has a localized label for every field the writable forms show", () => {
    const missing: string[] = [];
    for (const key of WRITABLE) {
      for (const field of formSpecsFor(key, "create").concat(formSpecsFor(key, "edit"))) {
        const label = field.label ?? `field.${field.name}`;
        if (!(label in messages.ar) || !(label in messages.en)) missing.push(`${key}:${label}`);
      }
    }
    expect(Array.from(new Set(missing))).toEqual([]);
  });

  it("has hint texts for every hint key and localized labels for enum options", () => {
    const hints = new Set<string>();
    for (const key of WRITABLE) for (const field of formSpecsFor(key, "create").concat(formSpecsFor(key, "edit"))) if (field.hint) hints.add(field.hint);
    for (const hint of hints) {
      expect(hint in messages.ar, hint).toBe(true);
      expect(hint in messages.en, hint).toBe(true);
    }
    const options = new Set<string>();
    for (const key of WRITABLE) for (const field of formSpecsFor(key, "create")) if (field.kind === "select" && field.name !== "role") for (const option of field.options ?? []) options.add(option);
    for (const option of options) expect(`enum.${option}` in messages.en, option).toBe(true);
  });
});
