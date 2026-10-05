# Final Test Report

| Suite | Executed result | Evidence |
|---|---|---|
| Unit | PASS — 3 tests | capability source, fail-closed missing capabilities, student denial |
| Component | PASS — 1 test | accessible PageHeader heading/action |
| Integration | PASS — 1 test | refresh BFF absent-cookie path returns 401 and clears access/refresh cookies |
| Contract | PASS (local only) | 181 paths / 331 operations / 25 resources |
| Security | PASS — 3 tests plus static scan | CSRF origin/double-submit cases |
| E2E | PASS — 1 Playwright test | login page browser-storage/URL token absence |
| A11y | PASS — 1 axe test | no critical/serious login violations |

Not executed against a healthy backend: authenticated login, refresh success, concurrent 401, logout, RBAC, protected route and mutation journeys. Those are BLOCKED, not PASS.
