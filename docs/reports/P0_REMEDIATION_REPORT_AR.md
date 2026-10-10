# P0 Remediation Report

## Decision

**P0 REMEDIATION PARTIAL**

The local security foundation is implemented and verified, but this environment is Node 20.19.6 rather than required Node 22.13+, and the external backend readiness endpoint remains HTTP 503. Final OpenAPI artefact, staging and production smoke remain blocked.

## Implemented code changes

- Browser traffic is BFF-only: `/api/auth/*` and `/api/backend/[...path]`.
- `token-storage` is an inert compatibility shim; no browser storage calls remain.
- Legacy Axios adapter is now same-origin BFF-only.
- Backend URL is server-only (`BACKEND_API_BASE_URL`); no `NEXT_PUBLIC_API_BASE_URL` remains.
- Refresh uses process single-flight; failure clears all session and CSRF cookies.
- Session returns only user/role/effective capabilities/source; missing backend capabilities fails closed unless explicit development/test flag is enabled. Production startup rejects that flag.
- CSRF validates exact Origin, Referer, `sec-fetch-site`, double-submit token, and constant-time equality.
- BFF proxy normalizes `api/v1` paths, rejects traversal/control characters, restricts headers, bodies, responses, redirects and upstream cookies.
- Health now distinguishes live and readiness and degrades/returns 503 when backend readiness is unavailable.
- Artificial splash timers were removed; shell uses a progressive neutral skeleton.
- HSTS, CSP nonce and other headers are configured.
- Resource form policy explicitly defines 25 curated resources and defaults sensitive mutations to fail closed.

## Evidence

| Check | Result |
|---|---|
| `npm run type-check` | PASS |
| `npm run lint` | PASS (zero warnings) |
| `npm run build` | PASS (Next 16.2.6 / Turbopack) |
| `npm run security:check` | PASS, 267 source files |
| `npm run test:unit` | PASS, 3 tests |
| `npm run test:security` | PASS, 3 tests |
| `npm run contracts:check` | PASS locally: 181 paths / 331 operations / 25 resources |
| `npm run routes:check` | PASS, 28 routes |
| `npm run i18n:check` | PASS, 269 Arabic/English keys |

## Legacy inventory

- Before: browser token storage, direct Axios client and public backend runtime config existed in the legacy layer.
- After: production imports of token storage/direct Axios are zero; static check enforces this.
- No deletion of the broad legacy source set was performed: the existing dirty worktree made broad deletion unsafe and the action was declined by sandbox review. Compatibility shims are fail-safe and BFF-only.

## External blockers

1. Current runtime: Node `v20.19.6`; project requires `>=22.13.0 <23`.
2. Backend readiness was previously observed as HTTP 503.
3. Final OpenAPI artifact, backend SHA and changelog are not supplied; BASE-001/API-001 remain BLOCKED.
4. Staging/production HTTPS smoke and browser E2E require a ready backend and environment.
5. Dependency audit after test-tool installation reports 6 transitive vulnerabilities; review/upgrade must run under Node 22 before release.
