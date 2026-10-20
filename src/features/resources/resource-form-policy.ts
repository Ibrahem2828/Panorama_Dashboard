import type { ResourceDefinition } from "@/contracts/types";
import { endAfterStart, resolveFieldSpecs, type CrossRule, type FieldOverride, type FieldSpec, type FormMode } from "@/features/resources/form-schema";
import { RESOURCE_DEFINITIONS } from "@/contracts/generated/resource-definitions";

export interface ResourceFormPolicy {
  allowedCreateFields: readonly string[];
  allowedUpdateFields: readonly string[];
  readOnlyFields: readonly string[];
  hiddenFields: readonly string[];
  sensitiveFields: readonly string[];
  /** The backend capability the write endpoints require; the UI mirrors it (hides actions) and the backend enforces it. */
  capability: string | null;
  mutationMethod: "POST" | "PATCH" | "PUT" | null;
  idempotencyRequired: boolean;
  /** Per-field refinements of what the generated contract says (relations, real ranges, defaults, hints). */
  fieldOverrides?: Record<string, FieldOverride>;
  crossRules?: readonly CrossRule[];
  /** DELETE is exposed in the UI (the backend soft-deletes: the record is hidden and deactivated). */
  deletable?: boolean;
}

const readOnlyPolicy = (capability: string | null): ResourceFormPolicy => ({
  allowedCreateFields: [],
  allowedUpdateFields: [],
  readOnlyFields: ["*"],
  hiddenFields: [],
  sensitiveFields: ["role", "effective_capabilities", "overrides", "status", "owner", "created_at", "updated_at"],
  capability,
  mutationMethod: null,
  idempotencyRequired: true,
});

interface WritablePolicyOptions {
  capability: string;
  create: readonly string[];
  update?: readonly string[];
  fieldOverrides?: Record<string, FieldOverride>;
  crossRules?: readonly CrossRule[];
  deletable?: boolean;
}

const writablePolicy = ({ capability, create, update = create, fieldOverrides, crossRules, deletable = false }: WritablePolicyOptions): ResourceFormPolicy => ({
  allowedCreateFields: create,
  allowedUpdateFields: update,
  readOnlyFields: ["id", "created_at", "updated_at"],
  hiddenFields: [],
  sensitiveFields: ["owner", "audit"],
  capability,
  mutationMethod: "PATCH",
  idempotencyRequired: true,
  fieldOverrides,
  crossRules,
  deletable,
});

/** Backend FileResourceSerializer.validate: group-only files need a group, major-only files a major and an academic year. */
export const visibilityNeedsScope: CrossRule = {
  check(values) {
    const present = (name: string) => values[name] !== undefined && values[name] !== null && values[name] !== "";
    if (values.visibility === "group_only" && !present("group")) return { field: "group", error: "validation.groupRequired" };
    if (values.visibility === "major_only") {
      if (!present("major")) return { field: "major", error: "validation.majorRequired" };
      if (!present("academic_year")) return { field: "academic_year", error: "validation.academicYearRequired" };
    }
    return null;
  },
};

const ROLE_VALUES = ["it_support", "admin", "print_staff", "support_staff", "content_manager", "student", "normal_user"] as const;
/** Smallest-int columns in the backend models (PositiveSmallIntegerField); the contract only says int64. */
/** Print prices are kept per currency: the new Syrian pound or the US dollar. */
const CURRENCY_OPTIONS = ["SYP", "USD"] as const;
const SMALL_ORDER: FieldOverride = { min: 0, max: 32767 };

/**
 * Hand-curated allowlists of what the dashboard may submit; generated OpenAPI fields are never submitted
 * automatically. A resource without an entry here stays read-only. Required contract fields must be in `create`.
 */
export const RESOURCE_FORM_POLICIES: Record<string, ResourceFormPolicy> = {
  users: writablePolicy({ capability: "users.manage", create: [], update: ["full_name", "role"], fieldOverrides: { role: { options: ROLE_VALUES, required: true } } }),
  universities: writablePolicy({ capability: "academic.manage", create: ["name", "code", "description", "is_active"], deletable: true }),
  faculties: writablePolicy({ capability: "academic.manage", create: ["university", "name", "code", "is_active"], deletable: true }),
  majors: writablePolicy({ capability: "academic.manage", create: ["faculty", "name", "code", "is_active"], deletable: true }),
  "academic-years": writablePolicy({ capability: "academic.manage", create: ["name", "order", "is_active"], fieldOverrides: { order: { ...SMALL_ORDER, hint: "form.hint.uniqueOrder" } }, deletable: true }),
  semesters: writablePolicy({ capability: "academic.manage", create: ["name", "order", "is_active"], fieldOverrides: { order: { ...SMALL_ORDER, hint: "form.hint.uniqueOrder" } }, deletable: true }),
  // A subject belongs to a FACULTY; the specialization (major) is an optional tag (specializations start in year 3 and only some subjects need one).
  subjects: writablePolicy({
    capability: "academic.manage",
    create: ["faculty", "major", "academic_year", "semester", "name", "code", "description", "is_active"],
    fieldOverrides: { faculty: { required: true }, major: { nullable: true, required: false, hint: "subjects.majorOptionalHint", relationFilter: { param: "faculty", from: "faculty" } } },
    deletable: true,
  }),
  verifications: readOnlyPolicy("verification.review"),
  lectures: readOnlyPolicy("lectures.manage"),
  // Library files: the backend soft-deletes (hides) them; `file` is only required on create (on edit it replaces the stored file).
  files: writablePolicy({
    capability: "files.manage",
    create: ["title", "description", "file", "visibility", "university", "faculty", "major", "academic_year", "semester", "subject", "group", "is_printable", "is_active"],
    fieldOverrides: {
      description: { maxLength: 5000 },
      file: { hint: "files.fileHint" },
      visibility: { defaultValue: "public", required: true, hint: "files.visibilityHint" },
      group: { nullable: true, required: false, hint: "files.groupHint" },
      is_printable: { defaultValue: false, hint: "files.printableHint" },
    },
    crossRules: [visibilityNeedsScope],
    deletable: true,
  }),
  // Groups are archived (is_active=false), not deleted. The WhatsApp channel is managed by its own capability-gated endpoint.
  groups: writablePolicy({
    capability: "groups.manage",
    create: ["name", "description", "image", "university", "faculty", "major", "academic_year", "semester", "subject", "requires_approval", "send_messages_permission", "is_active"],
    fieldOverrides: {
      description: { maxLength: 5000 },
      requires_approval: { defaultValue: true, hint: "groups.requiresApprovalHint" },
      send_messages_permission: { defaultValue: "all_members", required: true },
      faculty: { hint: "groups.scopeHint" },
    },
  }),
  announcements: writablePolicy({
    capability: "announcements.manage",
    create: ["title", "description", "image", "link", "target_user_type", "target_university", "target_faculty", "target_major", "target_academic_year", "target_semester", "starts_at", "ends_at", "is_active"],
    fieldOverrides: {
      target_university: { nullable: true, required: false },
      target_faculty: { nullable: true, required: false },
      target_major: { nullable: true, required: false },
      target_academic_year: { nullable: true, required: false },
      target_semester: { nullable: true, required: false },
      target_user_type: { defaultValue: "all" },
      description: { maxLength: 5000 },
      ends_at: { hint: "form.hint.expiry" },
    },
    crossRules: [endAfterStart("starts_at", "ends_at", true)],
    deletable: true,
  }),
  "printing-orders": readOnlyPolicy("printing.manage"),
  "printing-pricing-rules": writablePolicy({
    capability: "printing.manage",
    create: ["name", "color_mode", "paper_size", "sides", "price_per_sheet", "setup_fee", "currency", "effective_from", "effective_to", "is_active"],
    fieldOverrides: { currency: { kind: "select", options: CURRENCY_OPTIONS, defaultValue: "SYP", required: true, hint: "form.hint.currency" }, setup_fee: { defaultValue: "0" }, effective_to: { nullable: true, hint: "form.hint.effectiveTo" } },
    crossRules: [endAfterStart("effective_from", "effective_to")],
    deletable: true,
  }),
  // `binding` is unique and soft-deleted rows keep their value, so a binding price is deactivated (is_active) rather than deleted.
  "printing-binding-prices": writablePolicy({
    capability: "printing.manage",
    create: ["binding", "price_per_copy", "currency", "is_active"],
    fieldOverrides: { currency: { kind: "select", options: CURRENCY_OPTIONS, defaultValue: "SYP", required: true, hint: "form.hint.currency" }, price_per_copy: { defaultValue: "0", required: true } },
  }),
  "printing-pickup-locations": writablePolicy({
    capability: "printing.manage",
    create: ["name", "address", "instructions", "sort_order", "is_active"],
    fieldOverrides: { sort_order: { ...SMALL_ORDER, defaultValue: 0 }, address: { kind: "textarea", maxLength: 1000 }, instructions: { kind: "textarea", maxLength: 1000 } },
    deletable: true,
  }),
  "support-tickets": readOnlyPolicy("support.manage"),
  feedback: readOnlyPolicy("feedback.manage"),
  "feedback-prompt-policies": readOnlyPolicy("feedback.manage"),
  "mobile-release-policies": writablePolicy({
    capability: "product.manage",
    create: ["platform", "latest_version", "latest_build", "minimum_supported_version", "minimum_supported_build", "update_mode", "store_url", "message_ar", "message_en", "grace_period_ends_at", "emergency_update_bypass", "is_active"],
    fieldOverrides: {
      update_mode: { defaultValue: "none", required: true, hint: "form.hint.updateMode" },
      minimum_supported_build: { hint: "form.hint.minimumBuild" },
      grace_period_ends_at: { nullable: true },
      emergency_update_bypass: { hint: "form.hint.emergencyBypass" },
    },
  }),
  "maintenance-modes": writablePolicy({
    capability: "product.manage",
    create: ["enabled", "title_ar", "title_en", "message_ar", "message_en", "starts_at", "ends_at", "estimated_end_at", "retry_after_seconds", "bypass_staff"],
    fieldOverrides: { retry_after_seconds: { min: 1, max: 86400, defaultValue: 300 }, bypass_staff: { defaultValue: true, hint: "form.hint.bypassStaff" }, estimated_end_at: { nullable: true } },
    crossRules: [endAfterStart("starts_at", "ends_at")],
  }),
  // Feature flags are looked up by (key, platform, role); soft-deleted rows would still block the same scope, so toggle instead of delete.
  "feature-flags": writablePolicy({
    capability: "product.manage",
    create: ["key", "description", "platform", "role", "enabled", "expose_to_mobile"],
    update: ["description", "enabled", "expose_to_mobile"],
    fieldOverrides: {
      platform: { required: false, allowBlank: true, hint: "form.hint.flagScope" },
      role: { kind: "select", options: ROLE_VALUES, required: false, allowBlank: true },
      key: { pattern: "^[-a-zA-Z0-9_]+$", hint: "form.hint.flagKey" },
    },
  }),
  "privacy-policy-versions": writablePolicy({
    capability: "product.manage",
    create: ["version", "content_url", "requires_reacceptance", "is_active", "published_at"],
    update: ["content_url", "requires_reacceptance", "is_active", "published_at"],
    fieldOverrides: { is_active: { defaultValue: false, label: "form.field.publishNow" }, content_url: { required: true, hint: "form.hint.policyUrl" }, published_at: { hint: "form.hint.publishedAt" } },
  }),
  "terms-versions": writablePolicy({
    capability: "product.manage",
    create: ["version", "content_url", "requires_reacceptance", "is_active", "published_at"],
    update: ["content_url", "requires_reacceptance", "is_active", "published_at"],
    fieldOverrides: { is_active: { defaultValue: false, label: "form.field.publishNow" }, content_url: { required: true, hint: "form.hint.policyUrl" }, published_at: { hint: "form.hint.publishedAt" } },
  }),
  "audit-logs": readOnlyPolicy("audit.view"),
  // Moderation and governance screens: read-only generic table, with explicit row actions defined by their pages.
  "chat-reports": readOnlyPolicy("groups.manage"),
  "account-deletions": readOnlyPolicy("users.manage"),
  devices: readOnlyPolicy("product.manage"),
  // Finance level (finance.manage, admins). Stock quantities are never edited here: they move only through stock movements.
  "finance-exchange-rates": writablePolicy({
    capability: "finance.manage",
    create: ["effective_from", "syp_per_usd", "note"],
    fieldOverrides: { syp_per_usd: { required: true, decimalPlaces: 4, hint: "finance.rates.rateHint" }, effective_from: { hint: "finance.rates.effectiveHint" } },
    deletable: true,
  }),
  "finance-expenses": writablePolicy({
    capability: "finance.manage",
    create: ["spent_on", "category", "description", "amount", "currency"],
    fieldOverrides: {
      spent_on: { defaultValue: "today", required: true },
      category: { defaultValue: "supplies", required: true },
      description: { kind: "text", maxLength: 255 },
      amount: { required: true },
      currency: { defaultValue: "SYP", required: true },
    },
    deletable: true,
  }),
  "finance-inventory-items": writablePolicy({
    capability: "finance.manage",
    create: ["name", "category", "unit", "sku", "opening_quantity", "consumption_key", "consumption_per_use", "reorder_level", "unit_cost", "currency", "location", "notes", "is_active"],
    update: ["name", "category", "unit", "sku", "consumption_key", "consumption_per_use", "reorder_level", "unit_cost", "currency", "location", "notes", "is_active"],
    fieldOverrides: {
      category: { defaultValue: "paper", required: true },
      opening_quantity: { defaultValue: "0", hint: "finance.stock.openingHint" },
      consumption_key: { defaultValue: "", hint: "finance.stock.consumptionHint" },
      consumption_per_use: { defaultValue: "0", hint: "finance.stock.consumptionPerUseHint" },
      reorder_level: { defaultValue: "0", hint: "finance.stock.reorderHint" },
      unit_cost: { defaultValue: "0", hint: "finance.stock.unitCostHint" },
      currency: { defaultValue: "SYP", required: true },
      notes: { maxLength: 1000 },
    },
    deletable: true,
  }),
};

export function formDefinition(definition: ResourceDefinition, allowedFields: readonly string[]): ResourceDefinition {
  const allowed = new Set(allowedFields);
  return { ...definition, fields: definition.fields.filter((field) => allowed.has(field.name)) };
}

/** Whether the policy lets the UI create / edit / delete at all (before capability checks). */
export function policyAllows(policy: ResourceFormPolicy | undefined, action: "create" | "edit" | "delete"): boolean {
  if (!policy || policy.mutationMethod === null) return false;
  if (action === "create") return policy.allowedCreateFields.length > 0;
  if (action === "edit") return policy.allowedUpdateFields.length > 0;
  return policy.deletable === true;
}

/** Form field specs for a resource: contract fields filtered and ordered by the policy, refined by `extra` overrides. */
export function formSpecsFor(resourceKey: string, mode: FormMode, extra: Record<string, FieldOverride> = {}, only?: readonly string[]): FieldSpec[] {
  const policy = RESOURCE_FORM_POLICIES[resourceKey];
  const definition = RESOURCE_DEFINITIONS[resourceKey as keyof typeof RESOURCE_DEFINITIONS] as ResourceDefinition | undefined;
  if (!policy || !definition) return [];
  const names = mode === "edit" ? policy.allowedUpdateFields : policy.allowedCreateFields;
  const selected = only?.length ? names.filter((name) => only.includes(name)) : names;
  const overrides: Record<string, FieldOverride> = {};
  for (const name of selected) overrides[name] = { ...policy.fieldOverrides?.[name], ...extra[name] };
  return resolveFieldSpecs(definition, selected, overrides);
}
