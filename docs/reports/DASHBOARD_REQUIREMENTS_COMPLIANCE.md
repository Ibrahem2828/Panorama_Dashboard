# مصفوفة مطابقة متطلبات Panorama Dashboard

تاريخ التدقيق: 2026-08-04. الحالة تعبّر عن الأدلة التي جُمعت من الكود والأوامر؛ لا توجد أي حالة `PASS` لأن المواصفة تشترط اختبارًا ناجحًا ودليلًا قابلًا للتوثيق لكل متطلب، ولا توجد حزمة اختبارات في المستودع.

`Changes made` في هذه الجولة = إنشاء تقارير التدقيق فقط، لا تغييرات وظيفية على كود التطبيق.

## Baseline

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| BASE-001 | P0 | BLOCKED | عقد محلي 331 عملية | Audit only | `contracts:check` يثبت 331 لا 271 | `contracts/backend` | العقد النهائي/SHA مفقود |
| BASE-002 | P0 | FAIL | لا توجد بنية اختبار | Audit only | 0 test/spec/config files | `package.json` | لا Vitest/Playwright/MSW/axe |
| BASE-003 | P0 | FAIL | build غير مثبت | Audit only | type-check وlint فاشلان | `src` | أخطاء compile/lint وNode 20 |
| BASE-004 | P0 | BLOCKED | readiness الخارجي غير صحي | Audit only | `health/ready` = HTTP 503 | backend | الباك غير Ready |
| BASE-005 | P1 | FAIL | Splash بتوقيت ثابت 950/1250ms | Audit only | lint/source inspection | `app-boot-splash.tsx` | setTimeout اصطناعي |
| BASE-006 | P1 | FAIL | الفلاتر/التصدير غير مثبتين | Audit only | لا tests؛ المواصفة تسجل التعطيل | `resource-manager.tsx` | عقد/تنفيذ/E2E مفقود |
| BASE-007 | P0 | PARTIAL | صفحات contract-gap موجودة | Audit only | لا integration test | `features/product` | لا دليل Fail-Closed شامل |
| BASE-008 | P1 | PARTIAL | resource definitions منقحة جزئيًا | Audit only | 25 curated resources؛ لا tests | `contracts/generated` | allowlists لكل مورد غير مثبتة |
| BASE-009 | P1 | FAIL | SessionBoundary client-side حاجب | Audit only | source inspection | `features/session.tsx` | لا progressive/server bootstrap |
| BASE-010 | P1 | FAIL | role fallback بلا قيد production | Audit only | source inspection | `server-session.ts` | لا Fail-Closed |

## Architecture

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| ARCH-001 | P0 | FAIL | HttpOnly BFF جديد مع localStorage قديم | Audit only | token-storage source scan | `lib/auth/token-storage.ts` | Tokens قابلة للقراءة |
| ARCH-002 | P0 | FAIL | BFF موجود لكن Axios قديم مباشر | Audit only | imports/source scan | `lib/api/client.ts` | تجاوز Same-Origin |
| ARCH-003 | P0 | FAIL | BACKEND server-only جديد وNEXT_PUBLIC قديم | Audit only | `security:check` فاشل | `config/env.ts` | public API base |
| ARCH-004 | P0 | PARTIAL | generated operations/resources موجودة | Audit only | contracts check داخلي يمر | `contracts/generated` | عقد قديم وmanual endpoints |
| ARCH-005 | P1 | PARTIAL | React Query/Zustand موجودان | Audit only | مراجعة imports | `features`,`lib/api` | axios/token state قديم |
| ARCH-006 | P1 | PARTIAL | Feature folders موجودة | Audit only | type-check فاشل | `features` | APIs داخل طبقة قديمة؛ لا rules |
| ARCH-007 | P1 | PARTIAL | navigation/errors/formatters مركزية جزئيًا | Audit only | source inspection | `config`,`lib` | طبقات مكررة قديمة/جديدة |
| ARCH-008 | P1 | FAIL | لا analyzer أو lazy-proof | Audit only | لا script/test | `package.json` | budgets/dynamic imports غير مثبتة |
| ARCH-009 | P1 | PARTIAL | contract-gap pages موجودة | Audit only | لا integration test | `features/product` | وحدات بلا عقد لم تتحقق |
| ARCH-010 | P1 | PARTIAL | env.server موجود | Audit only | source inspection | `config/env*.ts` | fallback base URL وpublic env قديم |

## Authentication

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| AUTH-001 | P0 | FAIL | Login BFF جديد وLogin Axios قديم | Audit only | direct-client imports | `api/auth`,`lib/api/client.ts` | Tokens/direct backend |
| AUTH-002 | P0 | PARTIAL | Cookies HttpOnly/Secure/Lax مهيأة | Audit only | source inspection | `lib/auth/cookies.ts` | لا Set-Cookie test؛ Path واسع |
| AUTH-003 | P0 | PARTIAL | refreshLocks single-flight داخل process | Audit only | source inspection | `server-session.ts` | لا concurrent-401 test |
| AUTH-004 | P0 | FAIL | فشل refresh لا ينظف cookies دائمًا | Audit only | source inspection | `api/auth/refresh`,`backend route` | session stale |
| AUTH-005 | P0 | PARTIAL | BFF logout يحاول الباك ويمسح cookies | Audit only | source inspection | `api/auth/logout` | لا E2E/query-cache proof |
| AUTH-006 | P0 | PARTIAL | Origin/Referer/double-submit موجود | Audit only | source inspection | `lib/security/csrf.ts` | لا attack tests |
| AUTH-007 | P0 | PARTIAL | returnTo client check جزئي | Audit only | source inspection | `features/session.tsx`,`middleware.ts` | no redirect tests |
| AUTH-008 | P0 | PARTIAL | roles المسموحة تتحقق محليًا | Audit only | source inspection | `server-session.ts` | no student/normal E2E |
| AUTH-009 | P1 | PARTIAL | session يعيد بيانات محدودة | Audit only | source inspection | `server-session.ts` | fallback/source test مفقود |
| AUTH-010 | P1 | PARTIAL | BFF أخطاء آمنة غالبًا | Audit only | source inspection | `api/auth` | login يعيد backend data بلا redaction test |

## RBAC

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| RBAC-001 | P0 | FAIL | effective caps مع role fallback دائم | Audit only | source inspection | `server-session.ts` | fallback production |
| RBAC-002 | P0 | PARTIAL | navigation يحمل capabilities | Audit only | routes check جزئي | `config/navigation.ts` | no direct-URL capability test |
| RBAC-003 | P0 | PARTIAL | CapabilityGate موجود | Audit only | source inspection | `components/feedback` | action gate/API test مفقود |
| RBAC-004 | P0 | PARTIAL | AppApiError يعالج 403 | Audit only | source inspection | `lib/api` | no integration retry-loop test |
| RBAC-005 | P0 | FAIL | لا IDOR/UI leakage tests | Audit only | no test suite | `features` | حماية بيانات حساسة غير مثبتة |
| RBAC-006 | P1 | PARTIAL | navigation registry مركزي حديث | Audit only | source inspection | `config/navigation.ts` | legacy navigation موجود |
| RBAC-007 | P1 | PARTIAL | KPIs/actions لها caps جزئية | Audit only | no snapshots | `features/dashboard` | لا role snapshots |
| RBAC-008 | P1 | PARTIAL | صفحة RBAC موجودة | Audit only | no E2E | `features/rbac` | confirmation/audit/escalation غير مثبتة |

## I18N

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| I18N-001 | P0 | PARTIAL | العربية default ومجلد locale موجود | Audit only | keys check only | `i18n`,`app/[locale]` | no RTL visual/E2E |
| I18N-002 | P0 | PARTIAL | مسار en موجود | Audit only | keys check only | `i18n`,`app/[locale]` | no LTR visual/E2E |
| I18N-003 | P1 | FAIL | نصوص ظاهرة ثابتة موجودة | Audit only | source inspection | `features/session.tsx` | no static i18n lint |
| I18N-004 | P1 | PARTIAL | 269 ar/en keys متطابقة | Audit only | `npm run i18n:check` PASS | `i18n/messages.ts` | silent fallback production غير مختبر |
| I18N-005 | P1 | PARTIAL | formatters موجودة | Audit only | no unit tests | `lib/formatters.ts` | Intl locale evidence مفقود |
| I18N-006 | P1 | PARTIAL | language switcher موجود | Audit only | no E2E | `components/navigation` | path/query/dir behavior غير مثبت |
| I18N-007 | P2 | PARTIAL | حقول عقود جزئية | Audit only | no form tests | `components/forms` | bilingual-form proof مفقود |

## UX and Loading

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| UX-001 | P1 | PARTIAL | هوية وأصول Panorama موجودة | Audit only | no visual review | `globals.css`,`public/brand` | visual evidence مفقود |
| UX-002 | P1 | PARTIAL | theme switcher/next-themes موجود | Audit only | no E2E | `components/navigation` | no flash/persistence proof |
| UX-003 | P1 | PARTIAL | sidebar/mobile/topbar/header موجودة | Audit only | no viewport tests | `components/layout` | responsive proof مفقود |
| UX-004 | P1 | PARTIAL | command palette موجود | Audit only | no keyboard test | `components/navigation` | capability filtering غير مثبت |
| UX-005 | P1 | PARTIAL | PageHeader وfeedback states موجودة | Audit only | no page audit | `components/shared`,`feedback` | coverage غير مثبتة |
| UX-006 | P1 | PARTIAL | ConfirmDialog موجود | Audit only | no component tests | `components/feedback` | reason/audit لكل خطر غير مثبت |
| UX-007 | P1 | FAIL | أزرار فلاتر/تصدير غير مثبتة | Audit only | baseline spec/no E2E | `resource-manager.tsx` | تنفيذ/إخفاء/tooltip مفقود |
| UX-008 | P1 | PARTIAL | status UI موجود | Audit only | no a11y review | `components/shared` | color-independent evidence مفقود |
| UX-009 | P1 | PARTIAL | mobile sidebar موجود | Audit only | no 360px matrix | `components/layout` | visual test مفقود |
| UX-010 | P2 | PARTIAL | preferences feature موجودة | Audit only | no preference tests | `features/preferences.ts` | density/motion proof مفقود |
| LOAD-001 | P0 | FAIL | timeout ثابت للSplash | Audit only | lint/source inspection | `app-boot-splash.tsx` | 950/1250ms |
| LOAD-002 | P0 | FAIL | لا قياس 150/600ms أو session proof | Audit only | no E2E | `app-boot-splash.tsx` | artificial splash |
| LOAD-003 | P0 | FAIL | SessionBoundary يحجب shell | Audit only | source inspection | `features/session.tsx` | no progressive shell |
| LOAD-004 | P1 | FAIL | RouteLoader عام بلا delay/skeleton page-specific | Audit only | source inspection | `components/feedback` | timing/skeleton missing |
| LOAD-005 | P1 | PARTIAL | React Query مستخدم | Audit only | no integration proof | `features` | keepPrevious/placeholder غير مثبت |
| LOAD-006 | P1 | FAIL | AbortSignal search/route غير مثبت | Audit only | no tests/source proof | `features/resources` | cancellation missing |
| LOAD-007 | P1 | FAIL | debounce/Enter behavior غير مثبت | Audit only | no unit/E2E | `features/resources` | implementation evidence missing |
| LOAD-008 | P1 | FAIL | لا prefetch policy مثبتة | Audit only | no network trace | `components/navigation` | implementation missing |
| LOAD-009 | P1 | PARTIAL | next image config موجود | Audit only | eslint ينبه `<img>` في verification | `next.config.ts`,`verification-page.tsx` | asset audit missing |
| LOAD-010 | P1 | FAIL | لا network assertions | Audit only | no tests | `lib/api/query-client.ts` | duplicate calls unproven |

## Performance and API

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| PERF-001 | P1 | BLOCKED | لا Web Vitals | Audit only | backend ready=503 | Staging | backend/test infra |
| PERF-002 | P1 | BLOCKED | لا Web Vitals | Audit only | no traces | Staging | backend/test infra |
| PERF-003 | P1 | BLOCKED | لا TTFB p95 | Audit only | backend ready=503 | Staging | backend/test infra |
| PERF-004 | P1 | BLOCKED | لا session p95 | Audit only | no report | `features/session` | backend/test infra |
| PERF-005 | P1 | BLOCKED | لا route traces | Audit only | no Playwright | app | backend/test infra |
| PERF-006 | P1 | FAIL | لا analyzer/budget CI | Audit only | package scripts | `package.json` | tooling missing |
| PERF-007 | P1 | PARTIAL | data grid/pagination موجودة | Audit only | no large-data test | `components/data-grid` | server/virtualization proof missing |
| PERF-008 | P1 | FAIL | no dynamic-import evidence | Audit only | no analyzer | charts/editors | implementation proof missing |
| PERF-009 | P2 | PARTIAL | query client موجود | Audit only | no policy tests | `lib/api/query-client.ts` | stale-time policy missing |
| PERF-010 | P2 | BLOCKED | لا long-task trace | Audit only | no staging trace | Staging | test infra |
| API-001 | P0 | BLOCKED | OpenAPI 331 محلي | Audit only | SHA مسجل في contract report | `contracts/backend` | final 271 artifact missing |
| API-002 | P0 | PARTIAL | generator/check موجودان | Audit only | contracts check PASS داخلي | `scripts`,`contracts/generated` | no final contract/CI drift |
| API-003 | P0 | PARTIAL | BFF يضيف request/idempotency | Audit only | source inspection | `browser-client`,`backend route` | old Axios path/no tests |
| API-004 | P0 | PARTIAL | BFF validates `api/v1/`/traversal | Audit only | source inspection | `api/backend/[...path]` | no attack test; direct client exists |
| API-005 | P0 | PARTIAL | 50MB body limit/allowlist response | Audit only | source inspection | `api/backend/[...path]` | header/upload/stream tests missing |
| API-006 | P1 | PARTIAL | query keys factory موجودة | Audit only | no unit tests | `lib/api/query-keys.ts` | legacy paths/invalidations |
| API-007 | P1 | PARTIAL | URL-aware components جزئية | Audit only | no E2E | `data-grid`,`resources` | share/back proof missing |
| API-008 | P1 | PARTIAL | normalizeCollection يقرأ count/next | Audit only | source inspection | `browser-client.ts` | integration proof missing |
| API-009 | P1 | PARTIAL | AppApiError/View helpers موجودة | Audit only | no UI audit | `lib/api` | raw response leaks untested |
| API-010 | P1 | FAIL | no state-specific E2E | Audit only | no tests | `lib/api/errors.ts` | 409/429/426/503 UX unproven |
| API-011 | P1 | FAIL | no offline test/idempotency test | Audit only | no tests | app | implementation unproven |

## Tables and Forms

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| TABLE-001 | P1 | PARTIAL | data-grid/pagination موجودان | Audit only | no integration test | `components/data-grid` | server filtering/sorting unproven |
| TABLE-002 | P1 | PARTIAL | data-grid UI موجود | Audit only | no UI test | `components/data-grid` | visibility/density/pinning unproven |
| TABLE-003 | P1 | PARTIAL | URL state جزئي | Audit only | no E2E | resources | back/forward unproven |
| TABLE-004 | P1 | PARTIAL | EmptyState موجود | Audit only | no snapshots | `components/feedback` | contextual actions unproven |
| TABLE-005 | P1 | FAIL | export غير مثبت/معطل | Audit only | baseline/no E2E | `features/resources` | contract/capability job missing |
| FORM-001 | P0 | PARTIAL | curated resource definitions/forms موجودة | Audit only | 25 resources؛ no tests | `contracts/generated`,`forms` | all allowlists unverified |
| FORM-002 | P1 | PARTIAL | field-error helpers موجودة | Audit only | no integration | `lib/api/field-errors.ts` | errors/request_id unproven |
| FORM-003 | P1 | PARTIAL | submit controls موجودة | Audit only | no E2E | `components/forms` | double-submit proof missing |
| FORM-004 | P1 | FAIL | no dirty-form evidence | Audit only | no tests | forms | implementation missing |
| FORM-005 | P1 | PARTIAL | upload component موجود | Audit only | no upload tests | `form-file-upload.tsx` | progress/cancel/retry/MIME unproven |
| FORM-006 | P2 | NOT_APPLICABLE | لا autosave مسودات موثق | Audit only | no supporting contract evidence | forms | لا عقد versioning/concurrency |

## Security

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| SEC-001 | P0 | FAIL | localStorage Tokens موجودة | Audit only | security check fails | `token-storage.ts` | token exposure |
| SEC-002 | P0 | PARTIAL | CSP nonce/frame/object/connect موجود | Audit only | source only | `middleware.ts` | no external headers test |
| SEC-003 | P0 | FAIL | HSTS غائب | Audit only | next config inspection | `next.config.ts` | header missing |
| SEC-004 | P0 | PARTIAL | CSRF helper/BFF enforcement | Audit only | source only | `lib/security/csrf.ts` | no attack test/direct client |
| SEC-005 | P0 | FAIL | no IDOR test | Audit only | no suite | features/media | backend/UI protection unproven |
| SEC-006 | P0 | PARTIAL | curated forms موجودة | Audit only | no mass-assignment tests | forms/resources | allowlists unproven |
| SEC-007 | P0 | PARTIAL | BFF validation/allowlist موجودة | Audit only | source only | `api/backend/[...path]` | no SSRF/traversal/CRLF tests |
| SEC-008 | P0 | PARTIAL | protected-media helper موجود | Audit only | no integration | `lib/api/protected-media.ts` | raw URL/storage leakage unproven |
| SEC-009 | P0 | PARTIAL | ConfirmDialog/request IDs جزئية | Audit only | no E2E | feedback/BFF | reason/audit/idempotency unproven |
| SEC-010 | P0 | PARTIAL | no console.log found | Audit only | static scan only | `src` | no log-redaction test/structured logger |
| SEC-011 | P1 | PARTIAL | login/body timeout limits جزئية | Audit only | source inspection | API routes | boundary/upload tests missing |
| SEC-012 | P1 | FAIL | no audit/scan/SBOM | Audit only | no scripts/CI artifacts | CI | tooling missing |
| SEC-013 | P1 | PARTIAL | Next config reviewed | Audit only | no production build audit | `next.config.ts` | sourcemap policy unproven |
| SEC-014 | P1 | FAIL | production role fallback possible | Audit only | source inspection | `server-session.ts` | Fail-Closed missing |
| SEC-015 | P1 | PARTIAL | BFF emits request IDs | Audit only | source inspection | browser/BFF clients | network/error tests missing |

## Accessibility and DRY

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| A11Y-001 | P1 | FAIL | UI primitives exist | Audit only | no axe/keyboard test | components | evidence missing |
| A11Y-002 | P1 | FAIL | Radix dialogs exist | Audit only | no focus-trap test | dialogs | evidence missing |
| A11Y-003 | P1 | FAIL | labels/forms exist | Audit only | no axe test | forms | evidence missing |
| A11Y-004 | P1 | FAIL | feedback UI exists | Audit only | no screen-reader audit | feedback | evidence missing |
| A11Y-005 | P1 | FAIL | themes exist | Audit only | no contrast test | styles | evidence missing |
| A11Y-006 | P1 | FAIL | table primitive exists | Audit only | no responsive/axe test | tables | evidence missing |
| A11Y-007 | P1 | FAIL | preference feature exists | Audit only | no motion test | preferences | evidence missing |
| A11Y-008 | P2 | FAIL | icons broadly used | Audit only | no icon-name audit | components | evidence missing |
| DRY-001 | P0 | FAIL | generated registry مع API strings قديمة | Audit only | source/type errors | `lib/api/endpoints.ts` | duplicate manual endpoints |
| DRY-002 | P0 | PARTIAL | central capabilities/navigation موجودة | Audit only | source inspection | `capabilities`,`navigation` | legacy roles/navigation coexist |
| DRY-003 | P1 | PARTIAL | shared errors/formatters موجودة | Audit only | no duplicate audit | `lib` | old/new mappings coexist |
| DRY-004 | P1 | PARTIAL | query-key factory موجودة | Audit only | no unit/architecture test | `lib/api` | old client/hooks coexist |
| DRY-005 | P1 | PARTIAL | shared form primitives موجودة | Audit only | no review tests | forms | curated safety unproven |
| DRY-006 | P1 | FAIL | parallel legacy/new pages موجودة | Audit only | type-check errors | `app`,`features` | duplicate implementation |
| DRY-007 | P1 | PARTIAL | بعض components كبيرة | Audit only | 3 files >400 lines (heuristic) | `src` | no enforced metric/refactor |
| DRY-008 | P1 | FAIL | TypeScript لا يمر | Audit only | `npm run type-check` FAIL | `src` | type regressions |
| DRY-009 | P1 | PARTIAL | console.log=0 | Audit only | static scan | `src` | catch/log policy untested |
| DRY-010 | P1 | PARTIAL | generated files/check موجودة | Audit only | contracts check internal PASS | contracts | no CI drift/final contract |
| DRY-011 | P2 | NOT_APPLICABLE | لا Storybook/fixtures workflow | Audit only | package inspection | package | ليس جزءًا من المعمارية الحالية |

## Testing, Observability, Deployment

| Requirement ID | Priority | Status | Current implementation | Changes made | Test/Evidence | Files | Blocker |
|---|---|---|---|---|---|---|---|
| TEST-001 | P0 | FAIL | لا Unit tests | Audit only | 0 test files | package | framework missing |
| TEST-002 | P0 | FAIL | لا Component tests | Audit only | 0 test files | package | framework missing |
| TEST-003 | P0 | FAIL | لا Integration/MSW/Staging tests | Audit only | 0 test files | package | framework missing |
| TEST-004 | P0 | FAIL | check script فقط، لا contract tests | Audit only | no test runner | scripts | suite missing |
| TEST-005 | P0 | FAIL | لا Playwright auth E2E | Audit only | no config | package | suite missing |
| TEST-006 | P0 | FAIL | لا E2E للوحدات الحرجة | Audit only | no config | package | suite missing |
| TEST-007 | P1 | FAIL | لا visual snapshots | Audit only | no config | package | suite missing |
| TEST-008 | P1 | FAIL | لا axe/keyboard smoke | Audit only | no dependencies | package | suite missing |
| TEST-009 | P1 | FAIL | لا performance budget | Audit only | no scripts | package | tooling missing |
| TEST-010 | P1 | FAIL | لا security tests | Audit only | no suite | package | tooling missing |
| TEST-011 | P1 | FAIL | لا network retry/mutation tests | Audit only | no suite | package | tooling missing |
| TEST-012 | P1 | FAIL | لا coverage | Audit only | no runner/report | package | tooling missing |
| TEST-013 | P1 | FAIL | لا three-run flaky record | Audit only | no CI | CI | tooling missing |
| OBS-001 | P1 | FAIL | لا structured BFF logger | Audit only | source inspection | BFF routes | implementation missing |
| OBS-002 | P1 | FAIL | لا Sentry/OTel integration | Audit only | dependency/source inspection | package | implementation missing |
| OBS-003 | P1 | FAIL | لا Web Vitals collection | Audit only | no report | app | implementation missing |
| OBS-004 | P1 | FAIL | لا latency/error metrics | Audit only | no telemetry | app | implementation missing |
| OBS-005 | P2 | NOT_APPLICABLE | لا analytics/session replay مدمج | Audit only | dependency inspection | package | لا خدمة analytics ضمن النطاق |
| DEP-001 | P0 | FAIL | engines/Docker تحددان Node 22 | Audit only | runtime Node=20؛ no clean build | package,Dockerfile | environment/build proof missing |
| DEP-002 | P0 | PARTIAL | multi-stage/non-root موجود | Audit only | Dockerfile inspection | Dockerfile | no Git SHA image metadata/scan |
| DEP-003 | P0 | FAIL | health محلي فقط | Audit only | source + ready=503 | `api/health/route.ts` | hides backend failure |
| DEP-004 | P0 | BLOCKED | لا staging smoke/rollback | Audit only | backend ready=503 | deployment | backend unavailable |
| DEP-005 | P1 | PARTIAL | عدة headers موجودة | Audit only | source inspection | middleware,next config | HSTS/external verification missing |
| DEP-006 | P1 | FAIL | no SBOM/Trivy/Grype | Audit only | scripts/CI inspection | CI | tooling missing |
| DEP-007 | P1 | FAIL | server env مع public API legacy | Audit only | security check FAIL | config | environment separation broken |
| DEP-008 | P1 | FAIL | preferences local غير حساسة لكن tokens local | Audit only | source inspection | auth/preferences | sensitive persistent state |
| DEP-009 | P1 | BLOCKED | لا read-only production smoke | Audit only | backend ready=503 | deployment | staging/production gate unavailable |
| DEP-010 | P1 | FAIL | no rollback runbook/artifact | Audit only | docs/CI inspection | deployment | workflow missing |


## P0 remediation update (2026-08-04)
See P0_REMEDIATION_REPORT_AR.md for code changes and command evidence. Local code gates were revalidated; final OpenAPI, backend readiness, staging and production remain BLOCKED.


## Production closure update — Node 22 evidence (2026-08-04)
Local implementation evidence now includes Node 22.13.0 
pm ci, TypeScript, ESLint, Turbopack, route/contract/i18n/security checks, unit/component/integration/security tests, Playwright login-storage E2E and login axe. Requirement rows dependent on final OpenAPI, healthy backend, staging, production smoke, audit High remediation, rollback and container scan remain BLOCKED; no Requirement IDs were removed.
