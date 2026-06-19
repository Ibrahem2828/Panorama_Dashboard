# Dashboard Production Environment

## Current HTTP (Development / Staging Backend)
```
NEXT_PUBLIC_API_BASE_URL=http://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io
NEXT_PUBLIC_WS_BASE_URL=ws://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io
NEXT_PUBLIC_APP_NAME=Panorama Dashboard
NEXT_PUBLIC_APP_ENV=local
```

## Recommended Production HTTPS Values
```
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_BASE_URL=wss://api.your-domain.com
NEXT_PUBLIC_APP_NAME=Panorama Dashboard
NEXT_PUBLIC_APP_ENV=production
```

## Coolify Environment Variables
Set these in the Coolify service configuration (Environment tab):

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_WS_BASE_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_ENV`

Example production values (replace with real domain):
- NEXT_PUBLIC_API_BASE_URL=https://api.panorama.your-domain.com
- NEXT_PUBLIC_WS_BASE_URL=wss://api.panorama.your-domain.com
- NEXT_PUBLIC_APP_NAME=Panorama Dashboard
- NEXT_PUBLIC_APP_ENV=production

## Important Notes
- All `NEXT_PUBLIC_*` values are **public** and will be bundled into the client-side JavaScript. Never put tokens, passwords, or secrets here.
- The dashboard is a pure client-side authenticated app after login. No server-side secrets are required at build time.
- `src/config/env.ts` performs strict validation on startup. Missing or invalid values will cause a clear error.
- Local development typically uses `http://localhost:3000`.
- Deployed dashboard **must** use its real HTTPS origin.

## Backend CORS / CSRF Reminder
The backend must explicitly allow the dashboard's origin:
- Add the deployed dashboard URL (e.g. `https://dashboard.your-domain.com`) to `CORS_ALLOWED_ORIGINS`.
- Add it to `CSRF_TRUSTED_ORIGINS` (if CSRF is enabled).

Without this, login, token refresh, and authenticated calls will fail with CORS or CSRF errors.

## .env.local for Local Development
```bash
cp .env.example .env.local
# Then edit .env.local with current values if needed.
```

Build will succeed as long as the required NEXT_PUBLIC variables are present at build/runtime (Coolify injects them).

## Validation
The `npm run type-check` and `npm run build` will not call the live backend. All data fetching happens client-side after authentication.