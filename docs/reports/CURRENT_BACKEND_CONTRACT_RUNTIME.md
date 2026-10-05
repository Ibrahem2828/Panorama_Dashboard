# Current Backend Contract Runtime

Generated from the checked-in OpenAPI contract on 2026-08-09.

| Field | Value |
| --- | --- |
| Backend base URL | `https://api.xn--mgbaab0cxheq.tech` |
| OpenAPI source | `contracts/backend/openapi.json` |
| SHA-256 | `180f1fdec13a63567c24f129b8548810025a82107833e4e612fe1261825f30d3` |
| Paths | 181 |
| Operations | 331 |
| Schemas | 221 |
| Login | `POST /api/v1/auth/login/` (`v1_auth_login_create`) |
| Refresh | `POST /api/v1/auth/token/refresh/` (`v1_auth_token_refresh_create`) |
| Current user | `GET /api/v1/auth/me/` (`v1_auth_me_retrieve`) |
| Logout | `POST /api/v1/auth/logout/` (`v1_auth_logout_create`) |
| Dashboard operations | 172 |

## Contract finality

`CONTRACT_FINALITY_BLOCKED`: the repository's prior production reports refer to
an expected final contract with 271 operations, while the only supplied
OpenAPI artifact contains 331. No final backend OpenAPI artifact or backend
commit SHA is available to resolve that mismatch. Generated code is therefore
derived only from the checked-in artifact and unknown operations are fail
closed rather than guessed.

## Runtime probe (2026-08-09)

| Endpoint | Status | X-Request-ID | Result |
| --- | ---: | --- | --- |
| `GET /api/v1/health/live/` | 200 | `93e3329f-1227-44c5-85ca-5d1565be64dd` | live |
| `GET /api/v1/health/ready/` | 503 | `5994624a-3b37-444c-8ebc-9e50e35c4a7e` | dependencies unavailable |
| `GET /api/v1/health/startup/` | 503 | `33ab3760-c917-4e53-b963-dbe98f5c4f8c` | dependencies unavailable |
| `POST /api/v1/auth/login/` with invalid credentials | 500 | `7bf354f2-e63f-49be-acbd-331f63b103d0` | Django returned HTML 500 |

The backend is not ready. A genuine browser login cannot pass until its
readiness dependencies and invalid-login handling are repaired upstream.
