# Coolify Deployment Guide for Panorama Dashboard

## Project Type in Coolify
- Recommended: **Dockerfile** (recommended for full control)
- Alternative: Node.js / Next.js template (if Dockerfile not used)

## Build & Start
- **Build command**: handled by Dockerfile (npm run build inside image)
- **Start command**: handled by Dockerfile (`node server.js`)
- **Port**: `3000` (internal)

## Required Environment Variables (Coolify)
Set these under the service → Environment variables (all are `NEXT_PUBLIC_*`):

```
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_BASE_URL=wss://api.your-domain.com
NEXT_PUBLIC_APP_NAME=Panorama Dashboard
NEXT_PUBLIC_APP_ENV=production
```

### Current HTTP values (for testing)
```
NEXT_PUBLIC_API_BASE_URL=http://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io
NEXT_PUBLIC_WS_BASE_URL=ws://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io
NEXT_PUBLIC_APP_NAME=Panorama Dashboard
NEXT_PUBLIC_APP_ENV=local
```

## Dockerfile Notes
- Uses multi-stage build.
- Enables `output: "standalone"` in `next.config.ts` for smaller images.
- Production image runs as non-root user.
- Expects `npm run build` to succeed with the provided NEXT_PUBLIC_* vars at build time.

## .dockerignore
Excludes `node_modules`, `.next`, `.env*`, logs, etc.

## Backend Requirements
Before deploying the dashboard:

1. Add the **final dashboard origin** (e.g. `https://dashboard.panorama.your-domain.com`) to the backend's:
   - `CORS_ALLOWED_ORIGINS`
   - `CSRF_TRUSTED_ORIGINS` (if applicable)

2. Ensure the backend can reach the dashboard for any future callbacks (not required for current JWT flow).

## Deployment Steps (Coolify)
1. Connect the repo in Coolify.
2. Choose **Dockerfile** build.
3. Set the four `NEXT_PUBLIC_*` environment variables.
4. Set exposed port to 3000.
5. Deploy.
6. After deploy, add the real public dashboard URL to backend CORS/CSRF.

## Post-Deploy Smoke Tests
- Open the deployed dashboard URL.
- Login as `print@panorama.local` → should land directly on `/printing`.
- Login as admin → can reach overview and other modules.
- Verify a protected preview (Verification card or Printing file) opens via token.
- Check notifications badge updates.
- Logout clears session.

## Troubleshooting
- CORS errors → backend not allowing the dashboard origin.
- Blank page after login → check NEXT_PUBLIC_API_BASE_URL points to correct backend and is reachable from browser.
- Build fails → ensure all NEXT_PUBLIC vars are set in Coolify before build.

The dashboard fetches data client-side after login. No live backend calls happen at Docker build time (except for the public env injection).