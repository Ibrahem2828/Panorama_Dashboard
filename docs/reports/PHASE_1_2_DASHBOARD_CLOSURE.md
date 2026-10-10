# Phase 1 + 2 dashboard closure

**Assessment time:** 2026-08-15T14:33:22+03:00  
**Verdict:** **DASHBOARD CLOSURE BLOCKED**

The dashboard is synchronized with the final backend RC and has received the
dashboard-side safety/UX fixes documented below. It is not truthful to declare
either release phase closed: the required Node 22.16 runtime and dependency
install are unavailable locally, production backend readiness/login are broken,
and several Phase 2 functional and test gates remain incomplete.

## Phase 1 status

| Gate | Result | Evidence |
| --- | --- | --- |
| Canonical OpenAPI | PASS | SHA-256 `EA9745F55299680F4B76F63ACD495306B658306F5ED9A36A3BB2A976148DC653`; 184 paths, 272 operations, 222 schemas |
| Static contract calls | PASS | `contracts:check` accepts all 45 literal dashboard operation IDs; prior RC diff found 0 off-contract calls |
| Cookie/session/BFF architecture | Implemented; runtime tests pending | HttpOnly `/api` token cookies, same-origin BFF, CSRF, refresh rotation, status-separated session states |
| Raw upstream 5xx protection | Implemented; test pending | Generic BFF now returns safe JSON instead of upstream HTML; regression test added |
| Static security source check | PASS | 271 source files scanned; no direct browser backend/token-storage regressions found |
| Node runtime | BLOCKED | policy is Node `22.16.0`; host is Node `24.19.0`; only Node 20 NVM installations are available |
| Docker fallback | BLOCKED | Docker Desktop is installed but the daemon/service cannot be started in this environment |
| `npm ci` | NOT RUN | correctly withheld until Node 22.16 is available; lockfile preserved |
| TypeScript / ESLint / tests / build | NOT RUN | dependency-backed gates cannot be claimed without canonical runtime and `npm ci` |
| Production backend integration | BLOCKED EXTERNALLY | `live=200`, `ready=503`, `startup=503`; invalid canonical login request returns HTML 500 |

## Backend health and root-cause classification

| Probe | Result | Classification |
| --- | --- | --- |
| `GET /api/v1/health/live/` | 200 JSON (`LIVE`) | healthy process liveness |
| `GET /api/v1/health/ready/` | 503 JSON (`SERVICE_NOT_READY`) | `BACKEND_DEPLOYMENT`; precise dependency not confirmed |
| `GET /api/v1/health/startup/` | 503 JSON (`STARTUP_NOT_READY`) | `BACKEND_DEPLOYMENT`; precise dependency not confirmed |
| `POST /api/v1/auth/login/` with synthetic invalid `identifier`/`password` | 500 `text/html` | `BACKEND_DEPLOYMENT`; current source/production response mismatch |

See [backend blocker evidence](B:/panorama/panorama-dashboard/docs/reports/BACKEND_BLOCKERS_FOR_DASHBOARD.md) for request IDs, source locations, non-secret reproduction, and the exact backend hotfix/regression-test requests.

## Authentication and BFF

```text
Browser → same-origin Next.js /api/* → server-only HTTPS backend target
```

- Browser JavaScript never receives access or refresh tokens.
- BFF routes are constrained to documented OpenAPI method/path combinations.
- Mutations require CSRF validation and receive an idempotency key.
- `401`, `403`, `429`, `500`, `503`, timeout, and network states stay distinct.
- Upstream HTML/non-JSON 5xx content is discarded at the BFF boundary. The
  browser receives a safe status-preserving JSON error with a request ID.
- A network fetch rejection is normalized to the localized service-unavailable
  path instead of exposing browser/network exception text.

## Functional module inventory

This inventory covers the 28 locale-routed navigation targets verified by
`routes:check`. “Runtime pending” means the source is contract-bound but cannot
be certified until Node 22.16, dependencies, and tests are available.

| Module / route | Capability | Contract-backed behavior | Status |
| --- | --- | --- | --- |
| Overview `/dashboard` | `dashboard.access` | dashboard summary/statistics | runtime pending |
| Users `/dashboard/users` | `users.manage` | paginated list, detail, curated PATCH fields | residual: activate/deactivate UI not yet surfaced |
| RBAC `/dashboard/rbac` | `users.manage` | capabilities, overrides, expiry/reason | residual: full pagination and destructive-action regression coverage |
| Academic `/dashboard/academic/*` | `academic.manage` | universities, faculties, majors, years, semesters, subjects; server pagination and curated CRUD | runtime pending |
| Verifications `/dashboard/verifications` | `verification.review` | list/filter/page, protected card ticket, approve/reject/needs-update | runtime pending; action tests pending |
| Lectures `/dashboard/lectures` | `lectures.manage` | contract-backed list/detail | read-only unless an action is explicitly curated |
| Files `/dashboard/files` | `files.manage` | contract-backed protected list/detail | read-only mutations pending curation |
| Groups `/dashboard/groups` | `groups.manage` | contract-backed list/detail | action workflow tests pending |
| Announcements `/dashboard/announcements` | `announcements.manage` | contract-backed list/detail | mutation curation/tests pending |
| Printing `/dashboard/printing` | `printing.manage` | server-paginated orders, URL search/status, assign/note/status actions, pricing/binding/location resources | runtime pending |
| Support `/dashboard/support` | `support.manage` | server-paginated tickets, URL search/status, message/status/priority/assignment actions | runtime pending |
| Feedback `/dashboard/feedback` | `feedback.manage` | analytics and workflow action endpoints | residual: URL pagination/search refactor and workflow tests |
| Notifications `/dashboard/notifications` | `announcements.manage` | server-paginated user targeting, URL search/role, recipient selection, campaign create | runtime pending |
| Product releases / maintenance / flags | `product.manage` | contract-backed resource displays | mutation curation/tests pending |
| Product devices `/dashboard/product/devices` | `product.manage` | deliberately fail-closed contract-gap screen | backend lacks dashboard administration list/analytics contract |
| Governance policies `/dashboard/governance/policies` | `product.manage` | contract-backed policy resources | mutation curation/tests pending |
| Account deletion `/dashboard/governance/deletions` | `product.manage` | deliberately fail-closed contract-gap screen | backend lacks dashboard review/approval contract |
| Audit `/dashboard/audit` | `audit.view` | read-only audit list | runtime pending |
| System health `/dashboard/system/health` | `dashboard.access` | live/readiness/startup health APIs | source complete; upstream 503 correctly visible as degraded |
| Settings `/dashboard/settings` | `dashboard.access` | local language/theme/density/motion preferences | source complete |

No visible dashboard action was added without a documented backend operation.
The device and account-deletion pages intentionally do not repurpose mobile or
end-user APIs as dashboard administration APIs.

## Arabic, English, RTL, and UX

- Dictionary parity: **294 Arabic/English keys; PASS**.
- Locale switching now preserves the active query string, for example
  `/ar/dashboard/printing?page=2&status=ready` →
  `/en/dashboard/printing?page=2&status=ready`.
- Root HTML emits `lang` and `dir`; the current dashboard layout uses logical
  Tailwind properties (`start`, `end`, `ps`, `pe`) for structural RTL/LTR
  behavior.
- Pagination arrows are direction-aware. Request IDs use `dir="ltr"` where
  they appear in localized error UX.
- Generic resource lists distinguish an empty module from an empty filtered
  result. Printing, support, and notification targeting use server pagination;
  printing/support/notification search is debounced and state is URL-backed.
- Remaining work: perform a final visual RTL/LTR and hardcoded-string audit
  after the dependency-backed test/build gate is restored. This is not counted
  as completed merely because dictionary keys are symmetric.

## Error UX

| Condition | Dashboard behavior |
| --- | --- |
| 400 | localized invalid-request guidance; field errors remain available to forms |
| 401 | unauthenticated session only; redirect to locale login |
| 403 | access-denied state; no logout |
| 404 / 409 / 413 / 429 | localized, status-specific error panel |
| 500 | safe localized unexpected-error state; no upstream HTML |
| 503 | localized unavailable state, retry, optional request ID, no session destruction |
| timeout / network | safe unavailable/gateway error; no raw fetch exception |

## Tests and quality

| Check | Result |
| --- | --- |
| Contract check | PASS |
| i18n parity | PASS (294/294 keys) |
| Route check | PASS (28 navigation routes) |
| Security source check | PASS (271 files) |
| `git diff --check` | PASS (only existing CRLF normalization advisories) |
| Focused regression additions | added: upstream HTML 500, upstream 503, browser-network normalization |
| Unit/component/integration/security test execution | pending Node 22.16 + `npm ci` |
| Type check/lint/build | pending Node 22.16 + `npm ci` |

## Git hygiene

The worktree was already broadly modified before this pass. Existing user
changes were retained. The known end-of-file whitespace failures in
`package.json`, `src/features/auth/hooks.ts`, and `src/lib/api/client.ts` were
removed. No temporary partial Node archive or `node_modules` directory remains,
and the lockfile was preserved.

## Required closure sequence

1. Restore a trusted Node `22.16.x` runtime (NVM cache, working Docker daemon,
   CI runner, or approved internal mirror) without changing project engines or
   disabling TLS validation.
2. Run `npm ci`, then type-check, lint, all test suites, and production build.
3. Fix the backend deployment blockers in the companion report and rerun live,
   ready, startup, and invalid-login probes.
4. Finish the listed dashboard residuals and their regression tests, then do
   the visual RTL/LTR and accessibility sweep.

Only after those steps can the verdict become **PHASE 1 + PHASE 2 CLOSED**.
