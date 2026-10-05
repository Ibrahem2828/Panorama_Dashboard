# Panorama Dashboard production environment

The browser talks only to the dashboard origin. The Django backend URL is a
server-only runtime setting and must never use a `NEXT_PUBLIC_*` name.

## Required settings

```dotenv
BACKEND_API_BASE_URL=https://api.xn--mgbaab0cxheq.tech
BACKEND_REQUEST_TIMEOUT_MS=12000
NEXT_PUBLIC_APP_NAME=Panorama Dashboard
NEXT_PUBLIC_APP_ENV=production
ALLOW_ROLE_CAPABILITY_FALLBACK=false
```

Do not set `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_BACKEND_API_BASE_URL`, or a
public WebSocket backend URL for this dashboard. Such values would invite
browser-to-backend traffic and bypass the BFF boundary.

## Cookie policy

| Cookie | HttpOnly | Secure in production | SameSite | Path |
| --- | --- | --- | --- | --- |
| `panorama_access` | yes | yes | Lax | `/api` |
| `panorama_refresh` | yes | yes | Lax | `/api` |
| `panorama_csrf` | no | yes | Lax | `/` |

The CSRF cookie is readable only so same-origin browser mutations can submit a
double-submit header. It is not a credential. Access and refresh cookies must
retain `Path=/api`; page middleware intentionally does not authenticate users.

## Release sequence

1. Provide the approved backend `docs/api/openapi.json` artifact.
2. Set `BACKEND_OPENAPI_SOURCE` to its HTTPS URL or local file path. If the
   backend publishes the YAML companion, set `BACKEND_OPENAPI_YAML_SOURCE` too
   so the informational YAML mirror cannot remain stale.
3. Run `npm run contracts:sync`, `npm run contracts:generate`, then `npm run contracts:check`.
4. Run the quality suite under Node `22.16.x` (`.nvmrc`).
5. Run authenticated staging smoke tests with approved non-production credentials.

`contracts:sync` rejects any document that does not match the pinned release
checksum and counts in `contracts/backend/contract-target.json`.
