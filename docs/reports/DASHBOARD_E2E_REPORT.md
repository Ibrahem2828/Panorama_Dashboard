# تقرير E2E والاختبارات

تاريخ التدقيق: 2026-08-04

## الحالة

- لا يوجد `vitest.config.*` أو `playwright.config.*` أو ملفات `*.test.*`/`*.spec.*` في المستودع.
- لا توجد scripts لـ`test:unit` أو`test:component` أو`test:integration` أو`test:contract` أو`test:e2e` أو`test:a11y` أو`test:security`.
- `package.json` لا يحتوي Vitest أو Playwright أو Testing Library أو MSW أو axe.

وبناءً عليه: `TEST-001` حتى `TEST-013` لا تملك الأدلة المطلوبة، وcoverage وflakiness غير قابلين للقياس.

## Minimum test plan قبل أي إقرار

1. Unit: capabilities، routing، CSRF، errors، query keys، formatters، allowlists.
2. Component: login، session states، dialogs، forms، tables، loading/error/offline، language/theme.
3. Integration عبر MSW: BFF و401/403/409/426/429/503 وupload والفلترة والـmutations.
4. E2E: login/refresh/logout، URL محمي، مستخدم محظور، users/RBAC/verification/lectures/printing/support، RTL/LTR وresponsive.
5. Security/axe/visual/performance suites، مع ثلاث تشغيلات متتالية للرحلات الحرجة.


## P0 remediation update (2026-08-04)
See P0_REMEDIATION_REPORT_AR.md for code changes and command evidence. Local code gates were revalidated; final OpenAPI, backend readiness, staging and production remain BLOCKED.
