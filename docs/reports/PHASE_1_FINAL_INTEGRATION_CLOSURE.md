# Phase 1 final integration closure

> **Superseded on 2026-08-14.** The backend RC was subsequently located and
> synchronized. Use `PHASE_1_FINAL_UNBLOCK_VERIFICATION_CLOSURE.md` for the
> current evidence and closure verdict; this report is retained as the
> historical pre-sync record.

## Executive verdict

**P0 BLOCKED — do not freeze Phase 1 or begin Phase 2.**

The dashboard now has the targeted BFF, authentication, capability, route, and
contract-drift controls described below. Production closure cannot be approved
because the checked-in OpenAPI is not the supplied backend RC, the backend is
not ready, and the local Node 22 test toolchain is unavailable.

## Canonical OpenAPI

| Field | Required RC | Checked-in artifact |
| --- | ---: | ---: |
| SHA-256 | `EA9745F55299680F4B76F63ACD495306B658306F5ED9A36A3BB2A976148DC653` | `180F1FDEC13A63567C24F129B8548810025A82107833E4E612FE1261825F30D3` |
| Paths | 184 | 181 |
| HTTP operations | 272 | 331 |
| Schemas | 222 | 221 |

`contracts/backend/contract-target.json` pins the required artifact. The new
`contracts:check` command rejects the current document before generated code can
be accepted. `contracts:sync` accepts only an HTTPS/local source passed through
`BACKEND_OPENAPI_SOURCE`, verifies its exact checksum/counts, and writes the
canonical JSON. Run `contracts:generate` only after a successful sync.

An Added/Changed/Removed/Deprecated/Breaking diff is **not generated** because
the actual RC JSON has not been supplied. Producing one from counts or guessed
endpoints would be misleading.

## Authentication and session lifecycle

- Access and refresh tokens remain `HttpOnly`, `SameSite=Lax`, production
  `Secure`, `Path=/api` cookies. The CSRF token remains non-HttpOnly at `/`.
- Middleware no longer reads `/api`-scoped session cookies or redirects direct
  localized dashboard routes. `/api/auth/session` is the session source of
  truth.
- Session states are `loading`, `authenticated`, `unauthenticated`,
  `forbidden`, and `backend_unavailable`.
- 401 clears the local session and redirects to localized login. 403 displays
  access denied. 429/5xx/network failures retain credentials and show a retry
  state rather than pretending the user is logged out.
- A refresh retries the original request once only. Same-process refresh calls
  for a token are coalesced and rotation updates only HttpOnly cookies.

Cross-replica refresh serialization remains dependent on backend rotation grace
or a shared lock. It is documented as a deployment limit rather than being
misrepresented as globally solved by an in-memory map.

## BFF and capability controls

- The proxy accepts only normalized `/api/v1/...` paths that match a documented
  OpenAPI method/path pair; off-contract operations return 404.
- Traversal, double encoding, absolute-url-shaped segments, backslashes,
  control characters, arbitrary headers, uncontrolled redirects, and browser
  bearer injection are rejected or not forwarded.
- Mutation CSRF uses same-origin, referer/fetch-site, and constant-time
  double-submit validation. Body, header, streamed-response, timeout, request
  ID, idempotency, range-response, and response-header limits are enforced.
- Effective backend capabilities are authoritative. Sidebar hiding is UX only;
  the centralized dashboard shell also blocks direct canonical routes before
  their feature queries render.

## Route policy

Canonical authenticated routes are `/{ar|en}/dashboard/...`. Unlocalized legacy
paths normalize through middleware while preserving query strings. Middleware
does not use token cookies to decide authentication because those cookies are
intentionally unavailable to page requests.

## Verification record

| Gate | Result | Evidence |
| --- | --- | --- |
| Security source audit | PASS | `node scripts/security-check.mjs` — 270 source files |
| Locale messages | PASS | `node scripts/check-i18n.mjs` — 269 Arabic/English keys |
| Navigation routes | PASS | `node scripts/check-routes.mjs` — 28 targets |
| Contract script syntax | PASS | `node --check` for sync/check/generate/security scripts |
| Contract check | BLOCKED as designed | current artifact does not match RC checksum/counts |
| Backend liveness | VERIFIED | `GET /api/v1/health/live/` → 200 |
| Backend readiness/startup | NOT READY | both endpoints returned 503 |
| Backend invalid-login reachability | NOT READY | `POST /api/v1/auth/login/` returned 500 |
| Unit/integration/security tests | NOT RUN | Node 22.16 is absent; partial install has no executable test bin |
| TypeScript, ESLint, build | NOT RUN | same toolchain blocker; current Node 24 is unsupported and V8 ran out of memory during install/type-check |
| Authenticated E2E | NOT RUN | no safe test credentials and backend readiness is 503 |

## Added regression coverage

- Direct `/ar/dashboard` and `/en/dashboard` middleware behavior with
  `/api`-scoped cookies absent from the page request.
- Canonical direct-route capability mapping.
- Encoded traversal, absolute URL shape, and off-contract BFF rejection.
- Session 401/403/503 state separation.
- Concurrent BFF expired-access requests with same-process refresh coalescing.

## Required unblock sequence

1. Provide the exact backend `docs/api/openapi.json` RC artifact whose hash is
   `EA9745…C653`.
2. Run `BACKEND_OPENAPI_SOURCE=<approved-source> npm run contracts:sync`, then
   `npm run contracts:generate` and `npm run contracts:check`.
3. Restore backend readiness/startup and correct invalid-login handling to a
   documented application-level response.
4. Install and use Node `22.16.x`, then run `npm ci`, `npm run test:all`,
   `npm run type-check`, `npm run lint`, and `npm run build`.
5. Run credentialed staging login/refresh/logout/capability smoke tests.

## Phase 2 after P0 closure

Functional module completion, complete Arabic/English localization, RTL/LTR
visual refinement, responsive UX, and forms/tables/workflow polish remain
Phase 2 work. They are not substitutes for the blocked P0 integration gates.
