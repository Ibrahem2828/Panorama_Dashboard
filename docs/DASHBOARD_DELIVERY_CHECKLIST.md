# Panorama Dashboard Delivery Checklist

## Environment Setup
- [ ] `.env.local` created from `.env.example`
- [ ] `NEXT_PUBLIC_API_BASE_URL` set correctly
- [ ] `NEXT_PUBLIC_WS_BASE_URL` set correctly
- [ ] `NEXT_PUBLIC_APP_ENV` set (local / production)
- [ ] Backend CORS includes the dashboard origin
- [ ] Backend CSRF trusted origins include the dashboard origin (if CSRF enabled)

## Authentication & Roles
- [ ] it_support can login and sees all modules
- [ ] admin can login and sees operational modules
- [ ] print_staff can login and lands immediately on /printing
- [ ] student is denied (redirected to login or Access Denied)
- [ ] normal_user is denied
- [ ] Refresh token rotation works without breaking session
- [ ] Logout clears tokens and redirects to login
- [ ] Direct navigation to disallowed routes (e.g. /files as print_staff) is blocked

## Core Modules
- [ ] Overview loads metrics for allowed roles (unavailable fields show "—")
- [ ] Academic Structure: all CRUD flows work with relationship selects
- [ ] Verification: list + detail + approve/reject/needs-update + card preview uses protected token
- [ ] Groups: list, create, edit, memberships, join requests, actions with confirmations
- [ ] Files: list + upload/edit + visibility conditionals + admin warning in Arabic + preview uses token
- [ ] Announcements: full CRUD
- [ ] Printing (critical): queue, tabs, assign, status update (with note), internal note, file preview via token
- [ ] Support: list + detail thread + reply + status/priority/assign
- [ ] Audit Logs: read-only + detail (redacted values handled)
- [ ] Notifications: list + unread badge in topbar + mark read / read-all
- [ ] Settings: shows user info, role, env values, logout

## Protected Media
- [ ] Verification card images use preview-token endpoint (never direct URL)
- [ ] Dashboard files use preview-token
- [ ] Print order files use preview-token
- [ ] No direct `/media/` or raw sensitive URLs in UI

## Production Validation
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes (with proper NEXT_PUBLIC vars)
- [ ] No console.log / debugger / lorem in production code
- [ ] No raw API JSON envelopes displayed
- [ ] Empty / loading / error states are professional
- [ ] No critical TODOs left in core flows
- [ ] Status / role / visibility / priority badges consistent

## Coolify / Deployment
- [ ] Dockerfile present and tested
- [ ] .dockerignore present
- [ ] Coolify environment variables set
- [ ] Dashboard domain added to backend CORS / CSRF
- [ ] Post-deploy smoke tests executed

## Documentation
- [ ] docs/DASHBOARD_PRODUCTION_ENV.md
- [ ] docs/DASHBOARD_COOLIFY_DEPLOYMENT.md
- [ ] docs/DASHBOARD_DELIVERY_CHECKLIST.md (this file)
- [ ] .env.example up to date
- [ ] README reflects current scripts and role behavior

## Final Sign-off
- [ ] All required commands (lint / type-check / build) succeeded cleanly
- [ ] Role permissions and print_staff default behavior verified
- [ ] Protected media flow verified
- [ ] Ready for production Coolify deployment

After deployment, monitor first logins and a full print order workflow.