import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { StatusPill } from "@/components/shared/status-pill";
import { UserLink } from "@/features/users/user-link";

const active = (value: unknown) => <StatusPill value={value ? "active" : "inactive"} />;
/** Audit rows: the actor's name (profile link) when the backend sends `actor_detail`, else the bare id; same for the target. */
export const auditActor = (value: unknown, row: Record<string, unknown>) => {
  const detail = row.actor_detail as { id?: number; full_name?: string; email?: string } | null | undefined;
  if (!detail || detail.id === undefined || detail.id === null) return value === null || value === undefined || value === "" ? "—" : String(value);
  return <UserLink userId={detail.id} name={detail.full_name || detail.email || `#${detail.id}`} className="font-semibold" />;
};
export const auditTarget = (value: unknown, row: Record<string, unknown>) => {
  const label = typeof row.target_label === "string" ? row.target_label : "";
  const id = value === null || value === undefined || value === "" ? "" : String(value);
  if (!label) return id || "—";
  return <span>{label}{id ? <span className="ms-1.5 font-mono text-xs text-muted-foreground" dir="ltr">#{id}</span> : null}</span>;
};
const enabled = (value: unknown) => <StatusPill value={value ? "enabled" : "disabled"} />;

/** Table columns per resource; resources without an entry fall back to columns inferred from the first record. */
export const RESOURCE_COLUMNS: Record<string, ResourceColumn[]> = {
  users: [
    { key: "id", label: "#" },
    { key: "full_name", render: (value, row) => <UserLink userId={row.id as number} name={String(value ?? "")} className="font-semibold" /> },
    { key: "email" },
    { key: "job_title", render: (value) => (value ? String(value) : "—") },
    { key: "role", render: (value) => <StatusPill value={value} /> },
    { key: "is_active", render: active },
    { key: "last_login" },
  ],
  verifications: [
    { key: "id", label: "#" }, { key: "user" }, { key: "student_number" },
    { key: "status", render: (value) => <StatusPill value={value} /> }, { key: "created_at" },
  ],
  lectures: [
    { key: "id", label: "#" }, { key: "title" }, { key: "subject" },
    { key: "processing_status", render: (value) => <StatusPill value={value} /> },
    { key: "status", render: (value) => <StatusPill value={value} /> }, { key: "created_at" },
  ],
  announcements: [
    { key: "id", label: "#" }, { key: "title" }, { key: "target_user_type" },
    { key: "is_active", render: active }, { key: "starts_at" }, { key: "ends_at" },
  ],
  universities: [{ key: "id", label: "#" }, { key: "name" }, { key: "code" }, { key: "is_active", render: active }],
  faculties: [{ key: "id", label: "#" }, { key: "name" }, { key: "code" }, { key: "university_name" }, { key: "is_active", render: active }],
  majors: [{ key: "id", label: "#" }, { key: "name" }, { key: "code" }, { key: "faculty_name" }, { key: "is_active", render: active }],
  "academic-years": [{ key: "id", label: "#" }, { key: "name" }, { key: "order" }, { key: "is_active", render: active }],
  semesters: [{ key: "id", label: "#" }, { key: "name" }, { key: "order" }, { key: "is_active", render: active }],
  subjects: [
    { key: "id", label: "#" }, { key: "name" }, { key: "code" }, { key: "faculty_name" }, { key: "major_name" },
    { key: "academic_year_name" }, { key: "semester_name" }, { key: "is_active", render: active },
  ],
  "printing-pricing-rules": [
    { key: "id", label: "#" }, { key: "name" }, { key: "color_mode" }, { key: "paper_size" }, { key: "sides" },
    { key: "price_per_sheet" }, { key: "setup_fee" }, { key: "currency" }, { key: "is_active", render: active }, { key: "effective_from" }, { key: "effective_to" },
  ],
  "printing-binding-prices": [
    { key: "id", label: "#" }, { key: "binding" }, { key: "name" }, { key: "kind" }, { key: "price_mode" }, { key: "price_per_copy" }, { key: "price_per_kg" }, { key: "currency" }, { key: "is_active", render: active },
  ],
  "printing-covers": [
    { key: "id", label: "#" }, { key: "code" }, { key: "name" }, { key: "color_hex" }, { key: "price_per_copy" }, { key: "currency" }, { key: "is_active", render: active },
  ],
  "printing-wire-specs": [
    { key: "id", label: "#" }, { key: "name" }, { key: "min_sheets" }, { key: "max_sheets" }, { key: "weight_grams" }, { key: "is_active", render: active },
  ],
  "printing-products": [
    { key: "id", label: "#" }, { key: "name" }, { key: "pages_count" }, { key: "paper_size" }, { key: "binding" }, { key: "price" }, { key: "currency" }, { key: "is_active", render: active },
  ],
  "printing-pickup-locations": [
    { key: "id", label: "#" }, { key: "name" }, { key: "address" }, { key: "sort_order" }, { key: "is_active", render: active },
  ],
  "maintenance-modes": [
    { key: "id", label: "#" }, { key: "title_ar" }, { key: "title_en" }, { key: "enabled", render: enabled }, { key: "is_currently_active", render: enabled }, { key: "estimated_end_at" }, { key: "updated_at" },
  ],
  "feature-flags": [
    { key: "id", label: "#" }, { key: "key" }, { key: "platform" }, { key: "role" }, { key: "enabled", render: enabled }, { key: "expose_to_mobile" }, { key: "updated_at" },
  ],
  "mobile-release-policies": [
    { key: "id", label: "#" }, { key: "platform" }, { key: "latest_version" }, { key: "minimum_supported_version" }, { key: "update_mode" },
    { key: "is_active", render: active }, { key: "updated_at" },
  ],
  "privacy-policy-versions": [
    { key: "id", label: "#" }, { key: "version" }, { key: "is_active", render: active }, { key: "requires_reacceptance" }, { key: "published_at" }, { key: "content_url" },
  ],
  "terms-versions": [
    { key: "id", label: "#" }, { key: "version" }, { key: "is_active", render: active }, { key: "requires_reacceptance" }, { key: "published_at" }, { key: "content_url" },
  ],
  "audit-logs": [
    { key: "id", label: "#" }, { key: "actor", render: auditActor }, { key: "action" }, { key: "target_type" }, { key: "target_id", render: auditTarget }, { key: "created_at" },
  ],
};
