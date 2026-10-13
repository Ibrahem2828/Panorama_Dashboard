import type { ResourceColumn } from "@/components/data-grid/resource-table";
import { StatusPill } from "@/components/shared/status-pill";

const active = (value: unknown) => <StatusPill value={value ? "active" : "inactive"} />;
const enabled = (value: unknown) => <StatusPill value={value ? "enabled" : "disabled"} />;

/** Table columns per resource; resources without an entry fall back to columns inferred from the first record. */
export const RESOURCE_COLUMNS: Record<string, ResourceColumn[]> = {
  users: [
    { key: "id", label: "#" },
    { key: "full_name" },
    { key: "email" },
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
    { key: "id", label: "#" }, { key: "name" }, { key: "code" }, { key: "major_name" },
    { key: "academic_year_name" }, { key: "semester_name" }, { key: "is_active", render: active },
  ],
  "printing-pricing-rules": [
    { key: "id", label: "#" }, { key: "name" }, { key: "color_mode" }, { key: "paper_size" }, { key: "sides" },
    { key: "price_per_sheet" }, { key: "setup_fee" }, { key: "currency" }, { key: "is_active", render: active }, { key: "effective_from" }, { key: "effective_to" },
  ],
  "printing-binding-prices": [
    { key: "id", label: "#" }, { key: "binding" }, { key: "price_per_copy" }, { key: "currency" }, { key: "is_active", render: active },
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
    { key: "id", label: "#" }, { key: "actor" }, { key: "action" }, { key: "target_type" }, { key: "target_id" }, { key: "created_at" },
  ],
};
