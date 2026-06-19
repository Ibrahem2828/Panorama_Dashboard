# Dashboard Phase 2 Modules & Production UX

This document records the implementation status for Phase 2.

## Goals Achieved
- Production-grade module UX on top of Phase 1 foundation (no architecture rewrite).
- All listed modules implemented or polished: shell, overview, academic, verification, groups, files, announcements, printing, support, audit, notifications, settings.
- Role permissions reflected in navigation, sidebar, guards, and UI.
- print_staff lands on /printing by default and sees only printing + notifications + settings.
- Protected media preview tokens used for:
  - Verification cards: `/api/v1/dashboard/verifications/{id}/card-preview-token/`
  - Files: `/api/v1/dashboard/files/{file_id}/preview-token/`
  - Printing files: `/api/v1/dashboard/printing/orders/{order_id}/file-preview-token/`
- Centralized query keys in `src/lib/api/query-keys.ts`.
- Loading / empty / error states via shared TablePageShell, DataTable, EmptyState, ErrorState, LoadingState.
- Success + error toasts (with request_id when available).
- Confirmation dialogs for sensitive actions.
- Field errors mapped via applyBackendFieldErrors in forms where applicable.
- No direct sensitive /media/ URLs rendered.
- No raw API envelopes shown to users.
- No hardcoded tokens.

## Role Access Matrix
- it_support: all modules + full navigation.
- admin: operational modules (overview, academic, verification, groups, files, announcements, printing, support, audit, notifications, settings).
- print_staff: printing (default route), notifications, settings.
- student / normal_user: blocked by ProtectedRoute + /me validation.

Sidebar and navigation filter items via `canAccess(role)`.

## Endpoint Mapping (from panorama_dashboard_api_collection_v2_production.json)
- Stats: GET /api/v1/dashboard/stats/
- Academic: CRUD on /universities/, /faculties/, /majors/, /academic-years/, /semesters/, /subjects/
- Verification: list/detail + /approve/, /reject/, /needs-update/, /card-preview-token/
- Groups: CRUD + /memberships/, /join-requests/ + membership actions (/approve/, /reject/, /block/, /role/)
- Files: CRUD + /preview-token/
- Announcements: CRUD
- Printing: list/detail + /assign/, /status/, /note/, /file-preview-token/
- Support: list/detail + /status/, /priority/, /assign/, /messages/
- Audit: GET /audit-logs/
- Notifications: /notifications/, /unread-count/, mark-read, read-all
- Auth: /me/, login/refresh/logout preserved from Phase 1.

All mutations invalidate appropriate query keys from central system and show toasts.

## Protected Media Usage Summary
- `src/lib/api/protected-media.ts` + `requestPreviewToken`
- `ProtectedMediaButton` component handles loading + error toast with request_id.
- Used consistently in verification, files, printing detail views.
- Never renders raw card_image_url or file paths for restricted items.

## Shared Components (Improved / Added)
- AccessDenied (new): clean 403 state. Used in overview, files, verification, academic for defense-in-depth.
- VisibilityBadge (new): dedicated badge for file visibility values (public, major_only, admin_only...).
- MetricCard: handles number | "—"
- TablePageShell, DataTable, StatusBadge, RoleBadge, PriorityBadge, VisibilityBadge, ConfirmDialog, StatusActionDialog, EntityDialog, DetailDialog, ProtectedMediaButton, PageHeader, FieldGrid, EmptyState, ErrorState, LoadingState.
- ErrorState always shows requestId when present.
- Topbar: notification bell + unread badge (for allowed roles), theme, user menu with role.
- Sidebar: logo + role badge footer + role-filtered nav + active states.
- DashboardLayout: subtle Panorama background and borders using brand silver/navy palette for calm ops console.
- Navigation: bilingual Arabic labels prepared in config for RTL/Arabic experience.
- Forms: FormInput/Select/Textarea/Switch/FileUpload/SubmitButton.

## Error & Request ID UX
- All API errors normalized in `src/lib/api/errors.ts` capturing `request_id`.
- Toasts in hooks for mutations now include `description: Request ID: xxx`.
- ErrorState surfaces friendly message + request ID box + retry.
- TablePageShell surfaces errors without crashing.
- No raw stack traces or full envelopes rendered.

## Query / Data Assumptions (Defensive)
- Many list endpoints may return `results[]` or flat array (handled by `listData`).
- Stats fields are optional; missing rendered as "—".
- Related objects may be `{id, name}` or string or nested; helpers `getRelatedName` / `readString` used.
- Preview token responses: `url` | `preview_url` | `protected_url` + `expires_in` / `expires_at`.
- Pagination contract supported in client but current tables are client-side filtered/paged (server params passed when provided).
- Status values: pending/approved/rejected/needs_update, submitted/under_review/... for printing, etc. StatusBadge covers common values.
- Visibility and send_messages_permission use enum values matching backend.

## print_staff Specifics
- Guard redirects from "/" to "/printing".
- Sidebar hides overview/academic/verification/groups/files/announcements/support/audit.
- Printing module is primary daily tool with protected file previews + status workflow.
- Can view notifications and own settings.

## Phase 3 Items to Validate / Add
- Server-driven pagination (page/size) against real backend responses.
- Full end-to-end flows with seeded data + request_id observability.
- Real-time (WS) for printing queue / notifications (documented in Phase 1).
- Confirm exact serializer shapes for all create/update (esp. relationships, file uploads).
- HttpOnly cookie migration if backend adds support.
- Add automated tests, lint, typecheck, build in CI (Phase 3).

## Smoke Test Scenarios for Phase 3 (Manual)
- Login as it_support / admin / print_staff → correct default route and visible nav.
- Direct URL to /verification as print_staff → redirect or AccessDenied.
- Overview (admin): metric cards show numbers or "—"; no crash on partial stats. Print staff sees AccessDenied.
- Academic: create faculty (select uni), major (select faculty), subject (select major + semester). Edit/delete with confirm. Errors show request_id. Non-admins denied via AccessDenied.
- Verification: list + filter via search, approve (confirm), reject (reason required), needs-update, card preview (opens protected, never raw URL).
- Groups: create with send_messages_permission=admins_only (Arabic note shown), memberships tab approve/reject/block, role change.
- Files: upload with group_only (requires group), admin_only (warning in Arabic shown), preview uses token. Print staff sees AccessDenied.
- Announcements: create targeted + preview feel.
- Printing (print_staff): tabs by status, assign, change status (with note), add internal note, file preview via token, items visible. Accessible to print_staff.
- Support: thread reply, change status/priority/assign, request_id on failure.
- Audit: read only, detail shows redacted as-is or [REDACTED].
- Notifications: badge count updates, mark read / read all, list.
- Settings: shows env, role badge, logout works (no secrets).
- All error cases (403/400/500) surface friendly + request_id.
- Logout + re-login cycle.
- RTL layout does not break (text direction friendly). Bilingual labels present.

## Files Changed Summary (Phase 2)
- Expanded centralized query keys and migrated feature hooks.
- Topbar + sidebar + role UX + notification badge.
- Overview graceful stats + explicit AccessDenied.
- Protected flows and forms already wired; enhanced labels + warnings (Arabic).
- Added AccessDenied component and wired into restricted pages (files, verification, overview, academic, printing).
- Added VisibilityBadge dedicated component and used in files.
- Dashboard shell uses brand colors (#F8FAFC, silver borders).
- Improved audit redaction display with [REDACTED].
- Improved error toasts with request_id across hooks.
- Added Arabic explanatory labels and bilingual notes in groups/files/verification/printing/academic/navigation.
- Created/updated Phase 2 docs.
- Added explicit role guards + AccessDenied in key restricted modules.

All work done without executing builds, tests, dev server, or live backend calls.

## Known Risks / Future
- Backend response shape for optional nested objects / counts may evolve.
- Client table pagination; move to server when contract stable.
- Full Arabic i18n not in scope (labels added where appropriate for key UX + bilingual config prepared).
- Form relationship selects rely on academic hooks; cascading may need loading guards.
- AccessDenied is rendered client-side for extra defense (primary enforcement remains in ProtectedRoute + navigation filter + backend).

Phase 2 complete: production UX foundations in place.
