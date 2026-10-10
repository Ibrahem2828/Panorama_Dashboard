# Backend blockers for dashboard integration

**Observed:** 2026-08-15T14:33:22+03:00  
**Backend target:** `https://api.xn--mgbaab0cxheq.tech`  
**Backend source reviewed (read-only):** `dbee14ef0840aa68e6c39dd4516cbbfe128edfbb`

The dashboard does not invent a substitute backend response. Its BFF now
replaces any upstream 5xx body with a safe JSON envelope before it can reach a
browser, while keeping the original HTTP status and correlation ID. The issues
below are therefore backend/deployment blockers, not dashboard authorization or
payload-shape failures.

## 1. Readiness and startup remain unavailable

### Symptom

| Endpoint | Method | Status | Content type | Request ID | Latency |
| --- | --- | ---: | --- | --- | ---: |
| `/api/v1/health/live/` | GET | 200 | `application/json` | `da469011-314d-4c66-9c21-f19e515be740` | 987 ms |
| `/api/v1/health/ready/` | GET | 503 | `application/json` | `e88f347c-67ee-4f98-8049-b737c5cf8dbd` | 1089 ms |
| `/api/v1/health/startup/` | GET | 503 | `application/json` | `04936753-1bef-4892-987e-fd365417a26f` | 267 ms |

### Reproduction

```text
GET https://api.xn--mgbaab0cxheq.tech/api/v1/health/ready/
GET https://api.xn--mgbaab0cxheq.tech/api/v1/health/startup/
```

### Expected

Both endpoints return HTTP 200 and their documented JSON readiness envelopes.

### Actual

`ready` returns the safe body:

```json
{
  "success": false,
  "code": "SERVICE_NOT_READY",
  "message": "Service dependencies are unavailable",
  "errors": {}
}
```

`startup` returns the same body shape with `code: "STARTUP_NOT_READY"`.

### Source and evidence

This is **BACKEND_DEPLOYMENT** (high confidence for ownership). The live probe
proves that the HTTP process is running. The current backend readiness code at
`app/apps/common/health_views.py` deliberately returns 503 when any of these
checks fails:

1. PostgreSQL `SELECT 1`.
2. Redis-backed Django cache `get`.
3. Pending migration detection.
4. Production configuration/local persistent-media validation, including the
   field-encryption key and writable media volume.

The production response intentionally omits the failing dependency. No safe
deployment logs were available to distinguish those checks, so the dependency
root cause is **NOT CONFIRMED**. Do not infer Redis, database, or storage from
the opaque response alone.

### Required backend evidence

Retrieve the structured deployment logs for the listed request IDs and inspect
only the safe diagnostic events emitted by the current source:

```text
health_dependency_check_failed
health_pending_migrations
health_invalid_critical_configuration
```

The first event includes a dependency classification (`database`, `cache`, or
`migrations`) and failure class without secrets. If the configuration event is
present, validate the persistent media volume and the required production
configuration without printing environment values.

### Recommended backend hotfix

Restore the failed dependency/configuration, run outstanding migrations, then
repeat all three health probes until `live`, `ready`, and `startup` return 200.

### Required backend regression tests

- Integration smoke test against the deployed production configuration:
  `live=200`, `ready=200`, `startup=200`.
- One failure-mode test per dependency that verifies a JSON 503 envelope and
  preserves `X-Request-ID`.

### OpenAPI impact

**No.** The documented 503 response is appropriate; deployment health is not.

## 2. Invalid login emits an HTML 500

### Symptom

| Endpoint | Method | Request schema | Status | Content type | Request ID | Latency |
| --- | --- | --- | ---: | --- | --- | ---: |
| `/api/v1/auth/login/` | POST | `identifier`, `password` (synthetic invalid values) | 500 | `text/html; charset=utf-8` | `54a5a915-461d-43ae-a10b-5cf87e8ae81d` | 418 ms |

### Reproduction

```json
POST /api/v1/auth/login/
{
  "identifier": "closure.invalid@example.test",
  "password": "[synthetic invalid password]"
}
```

No real credential, token, cookie, or HTML response body is stored in this
report.

### Expected

A controlled JSON 4xx validation/authentication response. The reviewed
`LoginSerializer` in `app/apps/accounts/serializers.py` maps invalid credentials
to validation failure, and the backend's `test_wrong_password_login_failure`
expects HTTP 400.

### Actual

The production target returns an HTML 500 page. This violates both the OpenAPI
error contract and the backend's own safety controls. The dashboard BFF now
normalizes such upstream 5xx bodies to a safe JSON `UPSTREAM_INTERNAL_ERROR`
for users, so no Django HTML is rendered by the dashboard.

### Source and evidence

This is **BACKEND_DEPLOYMENT** (high confidence for ownership) with **root
cause not confirmed**. The reviewed current backend source contains both:

- DRF's `custom_exception_handler` in `app/apps/common/exceptions.py`, which
  turns dependency failures into JSON 503 responses; and
- `APIErrorEnvelopeMiddleware` plus API `handler500` in
  `app/apps/common/middleware.py` and `app/apps/common/error_views.py`, which
  prevent HTML 500 pages for `/api/*`.

The deployed response is incompatible with those safeguards. That points to a
production rollout/runtime mismatch, an exception escaping before those layers,
or an edge proxy rendering its own HTML. It does **not** point to the dashboard:
this probe called the backend target directly using the canonical OpenAPI
payload.

### Required backend evidence

For request ID `54a5a915-461d-43ae-a10b-5cf87e8ae81d`, inspect the ingress and
application logs and record:

1. the serving image/revision;
2. the original exception class and the layer that rendered HTML;
3. confirmation that `config.settings.production` loads the current exception
   handler, middleware, and `handler500`; and
4. whether Redis throttling, feature-flag lookup, or database access failed
   before the serializer returned the expected 400.

### Recommended backend hotfix

Deploy the reviewed error-envelope middleware/handler to every production
worker and fix the originating dependency or exception. Invalid credentials
must return a JSON 400/401/429 according to the backend policy, never an HTML
500 page.

### Required backend regression tests

- Production smoke test posting syntactically valid, invalid credentials and
  asserting JSON 400/401/429 with `X-Request-ID`.
- A forced unhandled login exception asserting JSON 500 with no traceback.
- A Redis throttle outage asserting JSON 503, matching the existing
  `tests_api_error_handling.py` contract.

### OpenAPI impact

**No.** The endpoint already declares the request shape; this is an
implementation/deployment regression.
