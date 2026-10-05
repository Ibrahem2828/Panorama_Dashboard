# Phase 1 final unblock, verification, and closure

**Verification time:** 2026-08-14T20:23:11+03:00  
**Verdict:** **PHASE 1 BLOCKED**

The dashboard contract is now synchronized with the actual backend release
candidate and the local integration/security source checks pass. Phase 1 cannot
close because the deployed backend is not ready and the required Node 22.16
toolchain could not be installed in this environment. No unsupported Node 24
test result is presented as a release result.

## Canonical OpenAPI

| Field | Result |
| --- | --- |
| Backend RC source | `B:\panorama\Backend\panorama-backend\docs\api\openapi.json` |
| Backend RC SHA-256 | `EA9745F55299680F4B76F63ACD495306B658306F5ED9A36A3BB2A976148DC653` |
| Dashboard synced SHA-256 | `EA9745F55299680F4B76F63ACD495306B658306F5ED9A36A3BB2A976148DC653` |
| Paths / operations / schemas | 184 / 272 / 222 |
| Contract workflow | `contracts:sync` → `contracts:generate` → `contracts:check` **PASS** |
| YAML mirror | synced from the matching backend YAML artifact |

The generated DTO contract contains `BackendSchemas` and `BackendOperations`.
`contracts:check` now also rejects stale operation IDs referenced by the legacy
endpoint adapter.

## API compatibility audit

The audited predecessor was
`180F1FDEC13A63567C24F129B8548810025A82107833E4E612FE1261825F30D3`.

| Classification | Count |
| --- | ---: |
| Added | 3 |
| Removed | 62 |
| Changed | 10 |
| Deprecated | 0 |
| Static dashboard calls documented by RC | 20 |
| Dynamic action templates | 1 |
| Static off-contract dashboard calls | 0 |

The dynamic verification action has the finite actions `approve`, `reject`, and
`needs-update`; each is present in the RC. All 45 operation IDs used by the
legacy adapter are also present. The detailed, reproducible diff is in
`docs/reports/CONTRACT_DIFF.json` and can be regenerated with
`OLD_OPENAPI_SOURCE=<old-artifact> npm run contracts:diff`.

## Authentication and cookie policy

| Cookie | HttpOnly | Secure in production | SameSite | Path |
| --- | --- | --- | --- | --- |
| Access | yes | yes | Lax | `/api` |
| Refresh | yes | yes | Lax | `/api` |
| CSRF | no | yes | Lax | `/` |

Middleware does not read `/api`-scoped token cookies. `/api/auth/session` is
the source of session truth. The BFF distinguishes 401 unauthenticated, 403
forbidden, 429 refresh rate limiting, and backend-unavailable states; only the
invalid session path clears credentials.

## Refresh and BFF controls

- Refresh is limited to one retry of the original request and is coalesced per
  refresh token within one Next.js process.
- Cross-replica coordination still requires backend rotation grace/idempotency
  or shared state; the in-memory lock is not presented as global coordination.
- The BFF only allows normalized, canonical OpenAPI method/path pairs.
- SSRF, traversal, double encoding, absolute URL shapes, browser bearer
  injection, uncontrolled headers, redirects, and off-contract operations are
  rejected or not forwarded.
- CSRF, request IDs, idempotency-key validation, body/header/response limits,
  timeouts, and range-response forwarding are in place.

## Capabilities and routes

Effective backend capabilities are the authorization source. `dashboard.access`
is required for a dashboard session; navigation visibility is only UX. The
dashboard shell independently gates canonical direct routes before their feature
queries render. Canonical dashboard routes are `/{ar|en}/dashboard/...`.

## Backend deployment verification

Probe target: `https://api.xn--mgbaab0cxheq.tech`

| Probe | Status | Duration | Safe result |
| --- | ---: | ---: | --- |
| `GET /api/v1/health/live/` | 200 | 2040 ms | `LIVE`; service `panorama_backend` |
| `GET /api/v1/health/ready/` | 503 | 1544 ms | `SERVICE_NOT_READY`; dependencies unavailable |
| `GET /api/v1/health/startup/` | 503 | 212 ms | `STARTUP_NOT_READY`; dependencies unavailable |
| Invalid `POST /api/v1/auth/login/` using canonical `identifier` + `password` | 500 | 191 ms | HTML response; no credentials logged |

TLS connectivity is verified by the HTTPS probes. Readiness/startup and the
controlled invalid-login 500 are **P0 backend deployment/bug blockers**. The
dashboard must not be changed to adapt to them.

## Node and dependency recovery

| Item | Result |
| --- | --- |
| Repository requirement | Node `22.16.0` (`.nvmrc`, package engines, CI) |
| Available global Node | `24.19.0` — unsupported by this repository |
| Available NVM versions | `20.19.6` only |
| Clean dependency state | incomplete `node_modules` was removed; `package-lock.json` preserved |
| Node 22 recovery | NVM installer stalled; official download was blocked by the local proxy (`curl: (7)`) |
| `npm ci` | **NOT RUN** — must run only under Node 22.16 |

## Test and static quality results

| Gate | Result |
| --- | --- |
| Unit / integration / auth regression tests | NOT RUN — Node 22 + clean `npm ci` unavailable |
| Security test suite | NOT RUN — same dependency blocker |
| Contract check | PASS — 184 / 272 / 222 |
| Contract diff / call audit | PASS — 0 static off-contract calls |
| Route check | PASS — 28 navigation targets |
| i18n check | PASS — 269 Arabic/English keys |
| Security source check | PASS — 270 source files |
| TypeScript | NOT RUN — Node 22 dependency toolchain unavailable |
| ESLint | NOT RUN — Node 22 dependency toolchain unavailable |
| Production build | NOT RUN — Node 22 dependency toolchain unavailable |
| Authenticated E2E | NOT VERIFIED — no safe non-production credentials; backend not ready |

## Git hygiene

The pre-existing worktree is not clean: 57 tracked changes and 73 untracked
paths. `git diff --check` reports three pre-existing whitespace warnings:
`package.json`, `src/features/auth/hooks.ts`, and `src/lib/api/client.ts`.
No package lockfile was regenerated and no secrets were reported by the security
source scan.

## Required P0 unblock sequence

1. Restore backend readiness and startup dependencies so both health endpoints
   return 200.
2. Fix backend invalid-login handling to return a documented controlled 4xx,
   not HTML 500.
3. Make Node 22.16 available through the environment proxy/runtime image.
4. Run `npm ci` with Node 22.16, then all tests, type-check, lint, build, and
   the BFF/auth/capability regressions.
5. Run authenticated staging smoke tests with safe non-production credentials.

Until those gates pass, Phase 1 remains blocked. Phase 2 must not begin.
