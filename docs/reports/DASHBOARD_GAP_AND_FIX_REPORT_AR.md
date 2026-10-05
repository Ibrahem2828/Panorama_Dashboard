# تقرير الفجوات وخطة الإصلاح — عربي

تاريخ التدقيق: 2026-08-04

## الخلاصة التنفيذية

التطبيق في حالة **هجرة غير مكتملة**: توجد طبقة BFF/cookies أحدث ذات اتجاه صحيح، لكنها تتعايش مع طبقة Axios/JWT قديمة تخزن الرموز في المتصفح. هذا يمنع أي اعتماد أمني أو وظيفي. كما أن العقد المحلي ليس العقد النهائي المطلوب، والباك readiness تعيد 503، وبوابات TypeScript وESLint والأمان فاشلة، ولا توجد اختبارات آلية.

لم أعدّل كود التطبيق في هذه الجولة لأن مساحة العمل كانت تحتوي تغييرات غير ملتزم بها قبل التدقيق، ولأن إصلاح P0 بصورة سليمة يحتاج قرارًا معماريًا واحدًا: **إزالة المسار القديم بالكامل والاعتماد على BFF فقط بعد استلام OpenAPI النهائي**. المخرجات المضافة هي تقارير إثبات الفجوات والمصفوفة الكاملة.

## P0 المفتوحة مرتبة حسب خطرها

| الترتيب | Requirement IDs | المشكلة | المعالجة الآمنة |
|---:|---|---|---|
| 1 | ARCH-001, ARCH-002, ARCH-003, AUTH-001, SEC-001 | Tokens في localStorage وAxios مباشر وNEXT_PUBLIC API | حذف طبقة client/token-storage/endpoints القديمة ومساراتها غير المستخدمة؛ إعادة وصل كل Feature نشط بـ`browser-client` إلى BFF؛ منعها بفحص ساكن واختبار Browser |
| 2 | RBAC-001, SEC-014 | role fallback يعمل في production عند غياب capabilities | قبول fallback في `development/test` فقط؛ في production session بلا `effective_capabilities` = 403 + cookies cleared |
| 3 | AUTH-003–AUTH-008, SEC-004, API-003 | السلوك الصحيح جزئي بلا إثبات؛ refresh failure لا يمسح الجلسة دائمًا | توحيد single-flight، مسح cookies عند كل فشل، اختبارات CSRF/401/logout/redirect/forbidden |
| 4 | BASE-001, API-001, API-002 | OpenAPI محلي 331 مقابل العقد النهائي المرجعي 271 | طلب artifact وSHA/commit نهائي؛ generate/check؛ CI drift؛ Fail-Closed للعمليات غير المعتمدة |
| 5 | LOAD-001–003 | Splash ثابت وShell محجوب بالجلسة | إزالة timers؛ server/progressive bootstrap؛ skeleton مؤخر 150ms غير حاجب |
| 6 | SEC-002–010 | headers/health/proxy/files/destructive actions غير مثبتة | HSTS، health صادق، tests هجومية، ticket-only media، confirmation+reason+audit |
| 7 | TEST-001–006 | لا Unit/Component/Integration/Contract/E2E | إضافة Vitest/RTL/MSW/Playwright وبناء fixtures آمنة بلا بيانات إنتاج |
| 8 | DEP-001–004 | Node محلي 20، build غير صالح، readiness 503 | استعمال Node 22، clean CI، إبقاء staging/production محجوبين حتى ready صحي وsmoke ناجح |

## مراجعة الوحدات الوظيفية

| الوحدة | الحالة | الموجود | الفجوة أو الحظر |
|---|---|---|---|
| Overview | PARTIAL | صفحة overview/stats وواجهة readiness | KPIs/quick actions لا تملك E2E/capability snapshots؛ الباك غير ready |
| Users | PARTIAL | route وResourceManager | القائمة والتفاصيل والتفعيل/تعطيل والـallowlist لا تملك عقدًا نهائيًا أو اختبارات |
| RBAC | PARTIAL | صفحة RBAC وCapabilityGate | role fallback production وغياب override/audit tests |
| Academic | PARTIAL | routes وCRUD resources | cascading/409/import/export وتغطية الاختبارات غير مثبتة |
| Student Verification | PARTIAL | صفحة verification وprotected media | ticket/state transitions/double-click/IDOR لا تملك tests |
| Lectures | PARTIAL | route موجود | wizard/job/viewer/ticket/streaming لم تثبت بعقد أو tests |
| Files | PARTIAL | files page وprotected media | scan/quarantine/ticket/download/IDOR غير مثبتة |
| Groups | PARTIAL | groups route/resource | state machine/last-admin/external capability غير مختبرة |
| Announcements | PARTIAL | announcements feature | bilingual schedule/audience preview/confirmation لا تملك E2E |
| Notifications | PARTIAL | notifications feature | deep-link allowlist/dedupe/metrics لا تملك tests |
| Printing | PARTIAL | printing page | transitions/pricing/read-only/SLA/media لا تملك tests |
| Support | PARTIAL | support page | paging threads/optimistic de-dupe/audit لا تملك tests |
| Feedback | PARTIAL | feedback page | PII minimization/analytics contract غير مثبت |
| Mobile Releases | PARTIAL | product route | policy conflict/426 preview/rollback لا تملك E2E |
| Maintenance | PARTIAL | product route | 503 window/Retry-After/secure bypass/intersection غير مثبت |
| Feature Flags | PARTIAL | product route | typed keys/kill switch/confirmation/audit غير مثبت |
| Devices | PARTIAL | contract-gap route | يجب إثبات Fail-Closed وعدم استخدام mobile endpoints |
| Policies | PARTIAL | policies page | immutability/version/consent aggregate غير مثبت |
| Account Deletion | PARTIAL | contract-gap route | يجب إثبات Fail-Closed وعدم استخدام mobile endpoints |
| Audit | PARTIAL | audit page | read-only/export redaction/request_id لا تملك tests |
| System Health | PARTIAL | health page | backend readiness غير صحي؛ لا كشف DB/Redis/Workers آمن مثبت |
| Personal Settings | PARTIAL | settings/preferences | Reset/session/password flows وtests غير مكتملة |

## مراحل التنفيذ المقترحة

1. **P0-A: توحيد المنصة الأمنية.** إزالة الإرث المباشر، إصلاح refresh/capability fail-closed/health/headers ونجاح `security:check`, `type-check`, `lint` على Node 22.
2. **P0-B: تثبيت العقد.** لا أي feature mutation جديدة قبل تسليم OpenAPI النهائي ونجاح regenerate/drift tests.
3. **P0-C: الاختبارات الأساسية.** auth/BFF/proxy/capabilities/form allowlists ثم E2E للحالات الحرجة.
4. **P1: الوحدات وتجربة الاستخدام.** URL tables، search cancellation، status HTTP، RTL/LTR، a11y، observability وCI/CD.
5. **P2: التحسينات المقاسة.** bundle budgets، preferences، long tasks وfixtures/Storybook عند بقاء الحاجة.

## الشروط الخارجية المحجوبة

| العامل الخارجي | الأثر | المطلوب | السلوك الآمن الحالي المطلوب |
|---|---|---|---|
| OpenAPI النهائي/Backend SHA | يمنع اعتماد كل عمليات Dashboard | artifact من الباك النهائي مع SHA وchangelog | Fail-Closed للعمليات بلا عقد |
| Backend readiness HTTP 503 | يمنع Staging/E2E/smoke/performance | إصلاح startup/ready في الباك | لا deployment ولا health ناجح زائف |
| Node 22 في بيئة التنفيذ | يمنع إثبات clean build الموثوق | توفير Node 22.13+ | لا ادعاء `npm ci`/build ناجح |


## P0 remediation update (2026-08-04)
See P0_REMEDIATION_REPORT_AR.md for code changes and command evidence. Local code gates were revalidated; final OpenAPI, backend readiness, staging and production remain BLOCKED.
