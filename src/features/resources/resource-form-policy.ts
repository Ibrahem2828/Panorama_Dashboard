import type { ResourceDefinition } from "@/contracts/types";

export interface ResourceFormPolicy {
  allowedCreateFields: readonly string[];
  allowedUpdateFields: readonly string[];
  readOnlyFields: readonly string[];
  hiddenFields: readonly string[];
  sensitiveFields: readonly string[];
  capability: string | null;
  mutationMethod: "POST" | "PATCH" | "PUT" | null;
  idempotencyRequired: boolean;
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

const academicPolicy = (capability: string, create: readonly string[], update = create): ResourceFormPolicy => ({
  allowedCreateFields: create,
  allowedUpdateFields: update,
  readOnlyFields: ["id", "created_at", "updated_at"],
  hiddenFields: [],
  sensitiveFields: ["is_active", "owner", "audit", "status"],
  capability,
  mutationMethod: "PATCH",
  idempotencyRequired: true,
});

/**
 * Hand-curated P0 allowlists. Generated OpenAPI fields are never submitted
 * automatically; resources without an approved mutation contract remain read-only.
 */
export const RESOURCE_FORM_POLICIES: Record<string, ResourceFormPolicy> = {
  users: readOnlyPolicy("users.manage"),
  universities: academicPolicy("academic.manage", ["name", "code", "description"]),
  faculties: academicPolicy("academic.manage", ["university", "name", "code", "description"]),
  majors: academicPolicy("academic.manage", ["faculty", "name", "code", "description"]),
  "academic-years": academicPolicy("academic.manage", ["name", "code", "start_date", "end_date"]),
  semesters: academicPolicy("academic.manage", ["academic_year", "name", "code", "start_date", "end_date"]),
  subjects: academicPolicy("academic.manage", ["major", "name", "code", "description"]),
  verifications: readOnlyPolicy("verification.review"),
  lectures: readOnlyPolicy("lectures.manage"),
  files: readOnlyPolicy("files.manage"),
  groups: readOnlyPolicy("groups.manage"),
  announcements: readOnlyPolicy("announcements.manage"),
  "printing-orders": readOnlyPolicy("printing.manage"),
  "printing-pricing-rules": readOnlyPolicy("printing.manage"),
  "printing-binding-prices": readOnlyPolicy("printing.manage"),
  "printing-pickup-locations": readOnlyPolicy("printing.manage"),
  "support-tickets": readOnlyPolicy("support.manage"),
  feedback: readOnlyPolicy("feedback.manage"),
  "feedback-prompt-policies": readOnlyPolicy("feedback.manage"),
  "mobile-release-policies": readOnlyPolicy("product.manage"),
  "maintenance-modes": readOnlyPolicy("product.manage"),
  "feature-flags": readOnlyPolicy("product.manage"),
  "privacy-policy-versions": readOnlyPolicy("product.manage"),
  "terms-versions": readOnlyPolicy("product.manage"),
  "audit-logs": readOnlyPolicy("audit.view"),
};

export function formDefinition(definition: ResourceDefinition, allowedFields: readonly string[]): ResourceDefinition {
  const allowed = new Set(allowedFields);
  return { ...definition, fields: definition.fields.filter((field) => allowed.has(field.name)) };
}
