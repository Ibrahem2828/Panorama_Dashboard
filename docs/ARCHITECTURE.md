# Dashboard Architecture

```text
Browser
  | same-origin requests + CSRF
  v
Next.js Route Handlers / BFF
  | Authorization bearer added server-side
  v
Panorama Django API
  |-- PostgreSQL
  |-- Redis / Celery
  `-- Private media / conversion workers
```

## Trust boundaries

- The browser can read only the non-secret CSRF cookie.
- Access and refresh tokens are `HttpOnly` and never enter client state, localStorage or sessionStorage.
- `/api/backend/[...path]` accepts only normalized, OpenAPI-documented `/api/v1/...` method/path pairs, blocks traversal, enforces body limits and forwards a narrow response-header allowlist (including safe range-response headers).
- Backend authorization is authoritative. Capability checks in the UI improve usability but never replace API authorization.
- Mutations carry a request ID and idempotency key.

## State

- TanStack Query: server state and invalidation.
- URL search parameters: page, page size, search, filters and ordering.
- Zustand: non-sensitive interface preferences only.
- React local state: dialog/form interaction.
