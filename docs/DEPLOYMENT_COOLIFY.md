# Coolify Deployment

## Required variables

Use `.env.example` as the key list. Store real values only in Coolify secrets.

Minimum:

```env
NODE_ENV=production
BACKEND_API_BASE_URL=https://api.xn--mgbaab0cxheq.tech
SESSION_COOKIE_SECURE=true
NEXT_PUBLIC_DEFAULT_LOCALE=ar
NEXT_PUBLIC_SUPPORTED_LOCALES=ar,en
```

## Build

- Dockerfile target: final runtime stage.
- Container port: `3000`.
- Health endpoint: `/api/health`.
- Persist no dashboard state inside the container.
- Use an immutable image tagged with Git SHA.

## Promotion gates

1. Contract, i18n and security source checks.
2. TypeScript, ESLint and production build.
3. Container build, SBOM and Critical/High scan.
4. Staging login, refresh, logout and capability tests.
5. Critical workflows: verification, lecture upload, printing, support, feedback and product controls.
6. Backend `/ready/` and `/startup/` return healthy.
7. Smoke test after deployment and tested image rollback.

Never change the dashboard health route to hide a backend readiness failure.
