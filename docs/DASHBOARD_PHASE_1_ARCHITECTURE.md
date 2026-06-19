# Dashboard Phase 1 Architecture

## Brand Tokens

Panorama Dashboard uses a calm operations-console identity:

- Primary Navy: `#002B7F`
- Secondary Purple: `#3B0CA3`
- Accent Burgundy: `#A50D46`
- Silver / Muted: `#BFC0C2`
- Background: `#F8FAFC`

The global CSS exposes the same values as:

- `--panorama-navy`
- `--panorama-purple`
- `--panorama-burgundy`
- `--panorama-silver`

Logo assets live under `public/brand/` and are used by the login page, favicon metadata, and dashboard sidebar without distortion.

## Environment

Dashboard production API base URL:

`http://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io`

WebSocket base URL:

`ws://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io`

Public environment values are validated in `src/config/env.ts`. Only `NEXT_PUBLIC_*` client-safe values are exposed. No secrets belong in frontend env files.

Future HTTPS values are documented in `.env.example`:

- `NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com`
- `NEXT_PUBLIC_WS_BASE_URL=wss://api.your-domain.com`

## API Contract

The dashboard follows `panorama_dashboard_api_collection_v2_production.json` in the project root.

Success:

```json
{ "success": true, "message": "OK", "data": {} }
```

Error:

```json
{ "success": false, "message": "...", "errors": {}, "request_id": "..." }
```

Pagination:

```json
{
  "success": true,
  "message": "OK",
  "data": { "count": 0, "next": null, "previous": null, "results": [] }
}
```

API foundations live in:

- `src/lib/api/client.ts`
- `src/lib/api/endpoints.ts`
- `src/lib/api/types.ts`
- `src/lib/api/errors.ts`
- `src/lib/api/query-keys.ts`

The Axios client attaches `Authorization: Bearer <access_token>`, refreshes access tokens through `/api/v1/auth/token/refresh/`, replaces rotated refresh tokens when returned, and clears the session on refresh failure.

Mutations are not retried by TanStack Query. The client only performs a single auth-refresh replay after a `401`.

## Role Model

Dashboard-allowed roles:

- `it_support`
- `admin`
- `print_staff`

Denied dashboard roles:

- `student`
- `normal_user`

Navigation is role-filtered through `src/config/navigation.ts` and `src/lib/permissions.ts`.

Role defaults:

- `print_staff`: `/printing`
- `admin`: `/`
- `it_support`: `/`

## Route Guard Behavior

The dashboard guard is implemented in `src/lib/auth/auth-guards.tsx`.

On boot it hydrates local token state and validates the current user with `GET /api/v1/auth/me/`. Stored local user data is not treated as authoritative. If the user is missing, forbidden, or the backend validation fails, the guard clears local session state and redirects to `/login`.

LocalStorage is isolated behind `src/lib/auth/token-storage.ts`. HttpOnly secure cookies remain the preferred future production hardening path when backend support exists.

## Protected Media Preview

Sensitive media paths are not opened directly. The dashboard uses short-lived preview tokens through:

- `POST /api/v1/dashboard/verifications/{id}/card-preview-token/`
- `POST /api/v1/dashboard/files/{file_id}/preview-token/`
- `POST /api/v1/dashboard/printing/orders/{order_id}/file-preview-token/`

Shared implementation:

- `src/lib/api/protected-media.ts`
- `src/components/shared/protected-media-button.tsx`

The utility validates expiry fields and opens the returned protected media URL against the configured API base URL.

## Phase 2 And Phase 3 Remaining Work

Phase 2:

- Expand each module with production-grade server pagination controls.
- Confirm exact serializer fields for advanced create/edit workflows.
- Add richer filter bars per operational module.
- Add dashboard-specific notification UX details once backend payload examples are finalized.

Phase 3:

- Add automated integration and E2E coverage against a seeded backend.
- Move token storage to HttpOnly secure cookies if backend support is added.
- Add real-time WebSocket updates for printing, notifications, and support queues.
- Add observability conventions for request IDs in support workflows.

## Contract File Notes

`panorama_dashboard_api_collection_v2_production.json` exists in the project root and is the source of truth for this phase.

`panorama_mobile_api_collection_v2_production.json` was referenced in the prompt but is not present in this workspace. No mobile-only flows were used for dashboard implementation.
