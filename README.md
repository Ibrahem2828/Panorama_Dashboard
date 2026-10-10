# Panorama Professional Dashboard

لوحة إدارة ثنائية اللغة لمنصة **Panorama Student Services Platform**، مبنية لتعمل كعميل آمن لعقود الباك المرفقة دون تخزين JWT في JavaScript.

## Highlights

- Arabic-first RTL and English LTR under `/{locale}` routes.
- Light, dark and system themes.
- Branded splash screen, route loading, skeleton, empty, offline and error states.
- Capability-driven navigation and action guards; the backend remains authoritative.
- Next.js BFF with `HttpOnly`, `Secure`, `SameSite=Lax` session cookies.
- CSRF checks for every browser mutation and same-origin backend proxying.
- Server-side pagination/search/filter parameters for large lists.
- Generated operation/resource registry from `contracts/backend/openapi.json`.
- Explicit fail-closed screens for dashboard contracts not yet exposed by the backend.
- Docker standalone runtime suitable for Coolify.

## Backend

The server-only default is:

```env
BACKEND_API_BASE_URL=https://api.xn--mgbaab0cxheq.tech
```

The browser never receives this value as a public environment variable and never receives access or refresh tokens.

## Start locally

```bash
cp .env.example .env.local
npm ci
npm run contracts:check
npm run i18n:check
npm run security:check
npm run dev
```

Open:

- `http://localhost:3000/ar/login`
- `http://localhost:3000/en/login`

Do not put real credentials in source code, `.env.example`, Postman collections or documentation.

## Validation

```bash
npm run contracts:generate  # only after replacing OpenAPI
npm run contracts:check
npm run i18n:check
npm run security:check
npm run type-check
npm run lint
npm run build
```

`npm run validate` runs all gates in sequence.

## Contract workflow

1. Replace `contracts/backend/openapi.json` and `.yaml` with an approved backend release contract.
2. Run `npm run contracts:generate`.
3. Review generated operation and resource drift.
4. Run all validation gates.
5. Record the backend commit SHA and OpenAPI SHA in the release report.

The uploaded contract currently generates 181 paths and 331 operations. The user-reported backend closure later mentioned 271 operations; therefore regenerate these files from the exact approved backend commit before production integration.

## Main modules

- Overview and role-specific quick actions
- Users and capability overrides
- Academic hierarchy
- Student verification and protected card preview
- Lectures, files, groups and announcements
- Printing workflow, pricing and pickup locations
- Support tickets and conversations
- Feedback workflow, analytics and prompt policies
- Notification campaigns
- Mobile releases, maintenance and feature flags
- Policies, deletion contract readiness and audit logs
- System health and personal interface settings

## Production status

This repository is a production-oriented implementation, not proof that the external environment is healthy. Promotion remains blocked until the backend readiness/startup probes return healthy responses and Docker, staging, DAST, load, backup/restore and rollback gates pass.

See `docs/IMPLEMENTATION_REPORT_AR.md` and `docs/DEPLOYMENT_COOLIFY.md`.
