# Dependency Security Report

Artifacts: `npm-audit-before.json`, `npm-audit-after-next.json`, `npm-audit-production-before.json`, `npm-dependency-tree.txt`.

| Package | Severity | Direct | Runtime | Decision |
|---|---:|---:|---:|---|
| next | high | yes | yes | Updated from 16.2.6 to 16.2.11; audit still reports advisory chain, requires follow-up verification |
| sharp | high | no | yes | BLOCKED — transitive image runtime path |
| postcss | high | no | build/runtime chain | BLOCKED — transitive |
| brace-expansion | high | no | dependency chain | BLOCKED |
| js-yaml | high | no | dependency chain | BLOCKED |
| @babel/core | low | no | dev/build | Documented, not accepted for production closure |

Current audit: 0 critical, 5 high, 1 low; production audit previously recorded 3 high. No `npm audit fix --force` was used.
