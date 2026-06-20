# Coolify Deployment Guide for Panorama Dashboard

## Project Type in Coolify
- Recommended: **Dockerfile** (recommended for full control)
- Alternative: Nixpacks with the committed `nixpacks.toml` and `NIXPACKS_NODE_VERSION=22.16.0`

## Build & Start
- **Build command**: handled by Dockerfile (npm run build inside image)
- **Start command**: handled by Dockerfile (`node server.js`)
- **Port**: `3000` (internal)

## Required Environment Variables (Coolify)
Set these under the service Environment variables:

```
NIXPACKS_NODE_VERSION=22.16.0
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
NEXT_PUBLIC_APP_ENV=production
```

## Dockerfile Notes
- Uses multi-stage build with Node `22.16.0`.
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
3. Set the environment variables listed above.
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

## Current Coolify Deployment Fix

Recommended deployment path: **Build Pack = Dockerfile**.

The Dockerfile pins `node:22.16.0-alpine`, runs `npm ci`, builds the Next.js standalone output, and starts `server.js`.

Nixpacks is also supported through the committed `nixpacks.toml`. If using Nixpacks, set:

```bash
NIXPACKS_NODE_VERSION=22.16.0
```

Required Coolify environment values:

```bash
NIXPACKS_NODE_VERSION=22.16.0
NEXT_PUBLIC_API_BASE_URL=http://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io
NEXT_PUBLIC_WS_BASE_URL=ws://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io
NEXT_PUBLIC_APP_NAME=Panorama Dashboard
NEXT_PUBLIC_APP_ENV=production
```

Nixpacks commands are defined in `nixpacks.toml`:

```bash
npm ci
npm run build
npm run start
```

If Coolify reports an `npm ci` lockfile mismatch, verify it is deploying the latest commit and not a stale generated Nixpacks build context. If Coolify reports a Node engine mismatch, verify `NIXPACKS_NODE_VERSION=22.16.0` or switch to **Build Pack = Dockerfile**.
