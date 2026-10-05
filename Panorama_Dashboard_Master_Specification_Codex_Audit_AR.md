# وثيقة التشغيل والتحقق الشاملة للوحة تحكم بانوراما

**Panorama Dashboard Master Operating, Quality & Codex Audit Specification**

- Backend: `https://api.xn--mgbaab0cxheq.tech`
- Languages: Arabic RTL (default), English LTR
- Purpose: binding requirements and verification baseline for Codex.

> لا يُعد أي متطلب PASS دون دليل: أمر منفذ + اختبار ناجح + ملف/تقرير + نتيجة Staging عند الحاجة.

## Current baseline

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `BASE-001` | P0 | العقد المرفق داخل نسخة الداشبورد قد يولد 331 عملية بينما إغلاق الباك اللاحق ذكر 271 عملية؛ يجب استبداله من Commit الباك النهائي وإعادة التوليد. | SHA للباك + SHA لـOpenAPI + contracts:generate/check ناجح |
| `BASE-002` | P0 | لا توجد اختبارات Unit/Integration/E2E ظاهرة في الحزمة الحالية؛ يجب إنشاء بنية اختبارات كاملة. | ملفات اختبار فعلية وتقارير CI |
| `BASE-003` | P0 | البناء الكامل npm ci/type-check/lint/build لم يُثبت في بيئة التسليم السابقة. | CI نظيف من clone جديد |
| `BASE-004` | P0 | جاهزية الباك الخارجية كانت تعيد 503؛ يجب إبقاء الربط الإنتاجي محجوبًا حتى عودة ready/startup إلى الحالة الصحية. | Staging وProduction read-only smoke |
| `BASE-005` | P1 | الـSplash الحالي يستخدم توقيتًا ثابتًا يصل إلى 1250ms؛ يجب إزالة أي تأخير صناعي وجعله غير حاجب. | اختبار زمني ولقطة Performance trace |
| `BASE-006` | P1 | أزرار الفلاتر والتصدير في ResourceManager معطلة حاليًا. | تنفيذ فعلي أو إخفاء الزر حتى توفر العقد |
| `BASE-007` | P0 | الأجهزة وطلبات حذف الحساب تستخدم Fail-Closed لأن العقد الإداري غير مكتمل. | عقد إداري محمي أو استمرار Fail-Closed باختبار |
| `BASE-008` | P1 | النماذج المولدة آليًا تحتاج Allowlist وتنقيحًا لكل مورد لمنع Mass Assignment أو حقول غير مناسبة. | مصفوفة fields لكل مورد واختبارات |
| `BASE-009` | P1 | SessionBoundary يجلب الجلسة Client-side وقد يحجب الـShell بتحميل كامل. | Server bootstrap/prefetch أو تحميل مرحلي لا يحجب الهيكل |
| `BASE-010` | P1 | Role fallback موجود للتوافق؛ يجب ألا يكون مصدر الصلاحية في الإنتاج. | effective capabilities من الباك واختبار fallback disabled في production |

## Architecture

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `ARCH-001` | P0 | المتصفح يتعامل مع نطاق الداشبورد فقط ولا يستقبل Access/Refresh Token قابلًا للقراءة من JavaScript. | فحص Storage/Cookies واختبار XSS-oriented source scan |
| `ARCH-002` | P0 | كل طلب للباك يمر عبر BFF Same-Origin ولا يسمح بوجهة Upstream يحددها المستخدم. | اختبارات path traversal وopen proxy |
| `ARCH-003` | P0 | قيمة BACKEND_API_BASE_URL تبقى Server-only ولا تستخدم NEXT_PUBLIC. | فحص bundle/env |
| `ARCH-004` | P0 | OpenAPI هو المصدر الوحيد للعمليات والأنواع؛ يمنع endpoints.ts يدوي مكرر. | Contract drift check |
| `ARCH-005` | P1 | TanStack Query لبيانات السيرفر، URL Search Params للفلاتر، Zustand لتفضيلات UI غير الحساسة فقط. | مراجعة imports/store state |
| `ARCH-006` | P1 | كل Feature يملك api/hooks/components/schemas/tests دون استدعاءات API عشوائية داخل مكونات العرض. | Architecture lint أو dependency rules |
| `ARCH-007` | P1 | الـLayout والـNavigation والـError mapping والـformatters مصادر مركزية غير مكررة. | تقرير duplicate detection |
| `ARCH-008` | P1 | تجزئة المسارات Lazy/Route-level ومنع تحميل Recharts أو محررات كبيرة في المسارات غير المحتاجة. | Bundle analyzer |
| `ARCH-009` | P1 | الوظائف المحجوبة بعقد ناقص تستخدم Fail-Closed ولا تستدعي Endpoints مستخدم نهائي. | Integration test |
| `ARCH-010` | P1 | إدارة البيئة تفصل public/server وتفشل مبكرًا عند نقص متغير إلزامي. | env schema tests |

## Authentication

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `AUTH-001` | P0 | Login يرسل الاعتماديات إلى BFF ثم إلى /api/v1/auth/login/ دون حفظها أو تسجيلها. | E2E + log redaction |
| `AUTH-002` | P0 | Cookies: HttpOnly, Secure في الإنتاج, SameSite=Lax, Path محدود وMax-Age مطابق للعقد. | اختبار Set-Cookie |
| `AUTH-003` | P0 | Refresh يتم مرة واحدة فقط عند 401 مع single-flight لمنع سباق الطلبات. | اختبار concurrent 401 |
| `AUTH-004` | P0 | فشل Refresh يمسح الجلسة ويعيد المستخدم إلى Login برسالة آمنة. | E2E |
| `AUTH-005` | P0 | Logout يستدعي الباك عند الإمكان ثم يمسح جميع Cookies والكاش. | E2E |
| `AUTH-006` | P0 | CSRF مطبق على كل Mutation عبر Origin/Referer وDouble Submit token. | Security tests |
| `AUTH-007` | P0 | منع Open Redirect في returnTo واللغة والمسارات. | Security tests |
| `AUTH-008` | P0 | مستخدم student/normal_user يُرفض حتى إن كانت لديه Cookie صالحة. | RBAC E2E |
| `AUTH-009` | P1 | Session bootstrap يعيد user/role/effective capabilities/source والبيانات غير الحساسة فقط. | Schema test |
| `AUTH-010` | P1 | لا يُعرض أي Token أو Stack trace أو Provider detail في الأخطاء. | Negative tests |

## RBAC

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `RBAC-001` | P0 | effective capabilities من الباك هي المصدر الإنتاجي، والـRole fallback لا يعمل إلا في Development/Test وبعلامة واضحة. | Production config test |
| `RBAC-002` | P0 | كل مسار Dashboard يملك capability محددة وتُختبر محاولة URL المباشرة. | Route matrix E2E |
| `RBAC-003` | P0 | كل زر Mutation يملك Action Gate مستقلًا ولا يعتمد على ظهور الصفحة فقط. | Component + API tests |
| `RBAC-004` | P0 | 403 يُعرض كAccess Denied ولا يؤدي إلى Retry loop. | Integration test |
| `RBAC-005` | P0 | لا تُعرض بيانات حساسة في Dropdowns أو Search suggestions لمستخدم غير مخول. | IDOR/UI data leakage tests |
| `RBAC-006` | P1 | Navigation تتولد من سجل مركزي وتُفلتر حسب القدرات دون تكرار قوائم. | Source inspection test |
| `RBAC-007` | P1 | Quick Actions وKPIs ومحتوى الصفحة الرئيسية تختلف حسب الصلاحيات الفعلية. | Role snapshots |
| `RBAC-008` | P1 | إدارة Permission Overrides تعرض الفعلي والممنوح والمرفوض مع Confirm وتدقيق. | E2E |

## I18N

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `I18N-001` | P0 | العربية هي اللغة الافتراضية وتعمل RTL على html/layout والجداول والنوافذ. | Visual/E2E ar |
| `I18N-002` | P0 | الإنجليزية تعمل LTR دون بقايا RTL أو كسر الأيقونات. | Visual/E2E en |
| `I18N-003` | P1 | جميع النصوص تمر عبر مفاتيح ترجمة؛ يمنع النص الثابت الظاهر للمستخدم في TSX. | Static i18n lint |
| `I18N-004` | P1 | تطابق كامل بين مفاتيح ar/en ومنع fallback صامت في الإنتاج. | i18n:check |
| `I18N-005` | P1 | الأرقام والتواريخ والعملات والمنطقة الزمنية تستخدم Intl واللغة الحالية. | Unit tests |
| `I18N-006` | P1 | تغيير اللغة يحافظ على المسار والفلاتر ويغير الاتجاه فورًا دون Full reload غير لازم. | E2E |
| `I18N-007` | P2 | المحتوى ثنائي اللغة في النماذج يوضح الحقول العربية والإنجليزية ولا يخلط القيم. | Form tests |

## UX

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `UX-001` | P1 | الهوية تستخدم الكحلي والبنفسجي والعنابي والفضي بتوازن ودون إفراط أو تدرجات تعيق القراءة. | Visual review |
| `UX-002` | P1 | الوضع الفاتح والداكن والتلقائي مع persistence ودون Flash خاطئ عند التحميل. | Theme E2E |
| `UX-003` | P1 | Sidebar قابلة للطي، Mobile Sheet، Topbar، Breadcrumbs، Page Header وإجراءات متسقة. | Responsive snapshots |
| `UX-004` | P1 | Command Palette تبحث في العناصر المسموحة فقط وتدعم لوحة المفاتيح. | Keyboard E2E |
| `UX-005` | P1 | كل صفحة تملك عنوانًا ووصفًا وإجراءً رئيسيًا واضحًا وحالة بيانات. | Page audit |
| `UX-006` | P1 | كل إجراء خطر يستخدم Dialog يصف الأثر ويطلب سببًا عند الحاجة. | Component tests |
| `UX-007` | P1 | لا توجد أزرار معطلة بلا تفسير؛ إما تنفيذ أو إخفاء أو Tooltip يوضح العقد الناقص. | UI audit |
| `UX-008` | P1 | الرسائل المختصرة لا تعتمد على اللون وحده؛ تستخدم نصًا وأيقونة وحالة. | A11y review |
| `UX-009` | P1 | الواجهة متجاوبة من 360px حتى الشاشات الكبيرة، ولا يوجد قص أفقي غير مقصود. | Viewport matrix |
| `UX-010` | P2 | تفضيلات كثافة الجداول وتقليل الحركة قابلة للتغيير والحفظ. | Preference tests |

## Loading

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `LOAD-001` | P0 | إزالة أي setTimeout صناعي يفرض ظهور Splash. يُعرض فقط إذا استغرق التهيئة الحقيقية أكثر من 150ms ويختفي فور الجاهزية. | Timing test |
| `LOAD-002` | P0 | الحد الأقصى المرئي للـSplash في الحالة الطبيعية 600ms، ويظهر مرة واحدة لكل Session ويمكن تجاوزه عند prefers-reduced-motion. | E2E measured |
| `LOAD-003` | P0 | الـDashboard Shell يظهر فورًا ولا يُحجب كاملًا بجلب الجلسة؛ يفضل bootstrap سيرفري أو Prefetch/Hydration. | Performance trace |
| `LOAD-004` | P1 | Route loader لا يظهر قبل 150ms لتجنب الوميض، ويستبدل بمخطط Skeleton مطابق للصفحة بعد ذلك. | Visual timing test |
| `LOAD-005` | P1 | استخدام keepPreviousData/placeholderData عند تغيير الصفحة والفلاتر لمنع اختفاء الجدول. | Integration test |
| `LOAD-006` | P1 | إلغاء الطلبات القديمة عند تغير البحث أو المسار باستخدام AbortSignal. | Network test |
| `LOAD-007` | P1 | Debounce للبحث 300-400ms مع Enter للتنفيذ الفوري. | Unit/E2E |
| `LOAD-008` | P1 | Prefetch للمسارات المسموحة عند hover/focus أو قرب الظهور، دون تحميل كل الوحدات مسبقًا. | Network trace |
| `LOAD-009` | P1 | الصور تستخدم next/image وأبعادًا ثابتة وتنسيقات محسنة، ولا يوجد أصل علامة كبير بلا حاجة. | Lighthouse/assets audit |
| `LOAD-010` | P1 | لا توجد طلبات API مكررة لنفس Query Key بسبب مكونات متعددة أو re-render. | Network assertion |

## Performance

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `PERF-001` | P1 | LCP عند p75 على Staging mobile profile لا يتجاوز 2.5s. | Web Vitals report |
| `PERF-002` | P1 | INP لا يتجاوز 200ms وCLS لا يتجاوز 0.10. | Web Vitals report |
| `PERF-003` | P1 | TTFB لصفحة Dashboard HTML في Staging لا يتجاوز 800ms p95 عند صحة الباك. | k6/browser trace |
| `PERF-004` | P1 | Session bootstrap لا يتجاوز 1000ms p95 في Staging. | k6/API report |
| `PERF-005` | P1 | انتقال المسار يعرض محتوى مفيدًا خلال 1200ms p95؛ إن تأخر الباك يظهر Skeleton لا شاشة فارغة. | Playwright trace |
| `PERF-006` | P1 | JavaScript الخاص بالمسار الأولي يبقى ضمن Budget موثق؛ أي زيادة >10% تفشل CI ما لم تعتمد. | Bundle budget |
| `PERF-007` | P1 | الجداول الكبيرة تعتمد Server pagination وتستخدم virtualization عند الحاجة، ولا ترسم آلاف الصفوف. | Performance test |
| `PERF-008` | P1 | Recharts ومكونات التحليل تحمل ديناميكيًا في صفحاتها فقط. | Bundle analyzer |
| `PERF-009` | P2 | الـQueries تملك staleTime مناسبًا حسب طبيعتها ولا تستخدم قيمة واحدة لكل الوحدات دون تبرير. | Query policy test |
| `PERF-010` | P2 | لا توجد Long Tasks تتجاوز 200ms في العمليات الشائعة على جهاز متوسط. | Performance trace |

## API

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `API-001` | P0 | استبدال OpenAPI من Commit الباك النهائي قبل أي تعديل وظيفي وتسجيل SHA. | Contract report |
| `API-002` | P0 | توليد Operation/Types/Resources آليًا ومنع تعديل generated يدويًا. | CI diff |
| `API-003` | P0 | كل Mutation ترسل X-Request-ID وIdempotency-Key عند دعم العقد. | Network tests |
| `API-004` | P0 | Proxy يسمح فقط بمسارات /api/v1/ المطبعة ويمنع traversal والـabsolute URL. | Security tests |
| `API-005` | P0 | حد حجم Body وTimeout وHeader allowlist وتصفية Set-Cookie من upstream. | Proxy tests |
| `API-006` | P1 | Query keys مركزية ودقيقة، وInvalidation محددة لا تمسح الكاش كله دون حاجة. | Unit tests |
| `API-007` | P1 | الفلاتر والترتيب والصفحة تظهر في URL ويمكن مشاركة الرابط والعودة إليه. | E2E |
| `API-008` | P1 | Pagination تستخدم count/next/previous من الباك ولا تحسب محليًا. | Integration test |
| `API-009` | P1 | لا تُعرض response raw في الواجهة؛ تستخدم View Models/formatters آمنة. | Code audit |
| `API-010` | P1 | 409 يعرض تعارضًا قابلًا للفهم، 429 يحترم Retry-After، 426/503 لهما تجربة مخصصة. | HTTP status E2E |
| `API-011` | P1 | حالات network/offline مستقلة عن 5xx وتسمح بإعادة المحاولة دون تكرار Mutation. | Offline tests |

## Tables and Forms

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `TABLE-001` | P1 | Server-side pagination/filtering/sorting لكل القوائم الكبيرة. | Integration tests |
| `TABLE-002` | P1 | الأعمدة قابلة للإخفاء والكثافة، مع تثبيت الأعمدة المهمة عند الشاشات الواسعة. | UI tests |
| `TABLE-003` | P1 | حالة الجدول في URL؛ Back/Forward يعيدان الحالة الصحيحة. | E2E |
| `TABLE-004` | P1 | Empty state يشرح السبب ويعرض إجراء مناسبًا إن كان مسموحًا. | Snapshots |
| `TABLE-005` | P1 | التصدير لا يظهر إلا بعقد فعلي وصلاحية، ويستخدم job عند البيانات الكبيرة. | E2E |
| `FORM-001` | P0 | النماذج مبنية من Schema/Allowlist وليس عرض كل حقول OpenAPI تلقائيًا. | Mass assignment tests |
| `FORM-002` | P1 | أخطاء الباك تربط بالحقول وتظهر رسالة عامة مع request_id. | Integration tests |
| `FORM-003` | P1 | منع Double submit، وإظهار pending داخل الزر دون تجميد الصفحة. | E2E |
| `FORM-004` | P1 | Dirty form warning عند الإغلاق أو الانتقال إذا كان فقد البيانات مؤثرًا. | E2E |
| `FORM-005` | P1 | رفع الملفات يعرض progress/cancel/retry والقيود قبل الرفع. | Upload tests |
| `FORM-006` | P2 | Autosave يستخدم فقط في المسودات وبعقد يدعم concurrency/versioning. | Tests |

## Security

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `SEC-001` | P0 | لا Tokens في localStorage/sessionStorage/IndexedDB/URL. | Security scan + browser test |
| `SEC-002` | P0 | CSP nonce، frame-ancestors none، object-src none، connect-src self. | Headers test |
| `SEC-003` | P0 | HSTS، nosniff، Referrer-Policy، Permissions-Policy. | Headers test |
| `SEC-004` | P0 | CSRF على Mutations وSame-Origin enforcement. | Attack tests |
| `SEC-005` | P0 | منع IDOR في كل تفاصيل/معاينة/تحميل حتى لو أخفت الواجهة الرابط. | API integration |
| `SEC-006` | P0 | منع Mass Assignment باستخدام field allowlists. | Security tests |
| `SEC-007` | P0 | Proxy يمنع SSRF/Open Proxy/Traversal/CRLF ويمرر Headers محددة فقط. | Security tests |
| `SEC-008` | P0 | File preview لا يقبل URL خام ولا يعرض storage key. | Integration tests |
| `SEC-009` | P0 | العمليات المدمرة تحتاج Confirmation وسبب وIdempotency وتدقيق. | E2E |
| `SEC-010` | P0 | Logs لا تحتوي credentials/tokens/OTP/CSRF/body حساس. | Log scan |
| `SEC-011` | P1 | حدود Body/Upload/Metadata/Search وTimeouts. | Boundary tests |
| `SEC-012` | P1 | Dependency audit وcontainer scan وSBOM، صفر Critical/High غير مقبول. | CI artifacts |
| `SEC-013` | P1 | لا source maps عامة في الإنتاج إذا كانت تكشف الكود؛ ترفع إلى Sentry خاص إن استُخدم. | Build audit |
| `SEC-014` | P1 | لا fallback role واسع في production عند فشل bootstrap؛ Fail Closed. | Config test |
| `SEC-015` | P1 | كل mutation ترسل request correlation ويظهر request_id في الأخطاء فقط. | Network tests |

## Accessibility

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `A11Y-001` | P1 | كل الوظائف قابلة بلوحة المفاتيح مع Focus ظاهر. | axe + keyboard E2E |
| `A11Y-002` | P1 | Dialogs تحبس التركيز وتعيده للعنصر الأصلي. | Component tests |
| `A11Y-003` | P1 | Labels وaria-describedby وأخطاء الحقول مرتبطة. | axe |
| `A11Y-004` | P1 | Live regions للتحميل والنجاح والخطأ دون إزعاج متكرر. | Screen reader audit |
| `A11Y-005` | P1 | Contrast AA للنصوص والحالات في Light/Dark. | Automated + visual |
| `A11Y-006` | P1 | الجداول تملك headers/captions وتعمل على شاشة ضيقة. | axe/responsive |
| `A11Y-007` | P1 | تقليل الحركة يوقف ping/float/transition غير الضروري. | prefers-reduced-motion test |
| `A11Y-008` | P2 | الأيقونات الزخرفية alt فارغ، والوظيفية لها اسم يمكن قراءته. | Audit |

## DRY

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `DRY-001` | P0 | مصدر واحد للمسارات والعمليات من OpenAPI؛ لا Strings مكررة داخل Features. | Static scan |
| `DRY-002` | P0 | مصدر واحد للCapabilities وNavigation، ولا مصفوفات صلاحيات متفرقة. | Static scan |
| `DRY-003` | P1 | مصدر واحد للترجمة، formatters، status colors، HTTP error mapping. | Duplicate audit |
| `DRY-004` | P1 | Query key factory مركزية، وhooks مشتركة للـpagination/filtering/mutations. | Architecture test |
| `DRY-005` | P1 | Forms المشتركة تستفيد من primitives، لكن النماذج الحساسة تبقى Curated ولا تعمم بطريقة خطرة. | Code review |
| `DRY-006` | P1 | لا نسخ ولصق لصفحات CRUD؛ Presets/definitions مع Allowlist واختبارات. | Duplicate report |
| `DRY-007` | P1 | لا مكونات ضخمة >400 سطر دون تقسيم منطقي، ولا hooks متعددة المسؤوليات. | Lint metric |
| `DRY-008` | P1 | لا any غير مبرر، ولا ts-ignore جماعي، ولا eslint disable واسع. | Type/lint audit |
| `DRY-009` | P1 | لا console.log في الإنتاج ولا catch فارغ. | Static scan |
| `DRY-010` | P1 | Generated files تحمل Header ولا تُعدّل يدويًا، وتُراجع Drift في CI. | CI |
| `DRY-011` | P2 | Storybook أو Component fixtures للمكونات المشتركة الحرجة إن أمكن. | Artifact |

## Testing

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `TEST-001` | P0 | Unit: formatters، capabilities، routing، CSRF helpers، error mapping، query keys. | Vitest/Jest report |
| `TEST-002` | P0 | Component: Login، forms، tables، dialogs، capability gates، loading/error states. | Testing Library report |
| `TEST-003` | P0 | Integration مع MSW أو Staging لكل وحدة حرجة. | Report |
| `TEST-004` | P0 | Contract: runtime routes مقابل OpenAPI وgenerated registry. | CI |
| `TEST-005` | P0 | E2E: login/refresh/logout/forbidden/direct URL. | Playwright |
| `TEST-006` | P0 | E2E: المستخدمون/RBAC/التحقق/المحاضرات/الطباعة/الدعم/المنتج. | Playwright |
| `TEST-007` | P1 | Visual snapshots بالعربية والإنجليزية وLight/Dark للجوال/سطح المكتب. | Playwright screenshots |
| `TEST-008` | P1 | Accessibility axe وkeyboard smoke. | Report |
| `TEST-009` | P1 | Performance/Web Vitals/Bundle budgets في CI أو Staging. | Reports |
| `TEST-010` | P1 | Security tests: CSRF، redirect، proxy traversal، token storage، IDOR، mass assignment. | Report |
| `TEST-011` | P1 | Network tests تمنع duplicate mutation وretry الخاطئ. | Report |
| `TEST-012` | P1 | Coverage: 85% إجمالي و95% لطبقة auth/security/proxy/capabilities. | Coverage report |
| `TEST-013` | P1 | Flaky test rate = 0 في ثلاث تشغيلات متتالية للرحلات الحرجة. | CI history |

## Observability

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `OBS-001` | P1 | Structured server logs في BFF مع request_id/path/status/duration دون بيانات حساسة. | Log sample |
| `OBS-002` | P1 | Client error boundary يرسل release/environment/request_id إلى Sentry/OTel عند تفعيله. | Staging test |
| `OBS-003` | P1 | Web Vitals تجمع حسب route/locale/device/release. | Dashboard/report |
| `OBS-004` | P1 | قياس session latency وAPI latency وerror rate و429/503. | Metrics |
| `OBS-005` | P2 | لا Analytics شخصية أو Session replay دون سياسة وموافقة. | Privacy review |

## Deployment

| ID | Priority | Requirement | Evidence |
|---|---|---|---|
| `DEP-001` | P0 | Node 22 ضمن النطاق، npm ci من lockfile، build reproducible. | Clean build |
| `DEP-002` | P0 | صورة متعددة المراحل، non-root، no secrets، immutable Git SHA. | Container inspection |
| `DEP-003` | P0 | /api/health يعكس صحة الداشبورد ولا يخفي فشل backend readiness. | Health test |
| `DEP-004` | P0 | النشر على Staging أولًا مع smoke وrollback فعلي. | Staging report |
| `DEP-005` | P1 | Security headers تعمل خلف Proxy وHTTPS وCookies Secure. | External headers test |
| `DEP-006` | P1 | SBOM وTrivy/Grype؛ صفر Critical/High غير مقبول. | Artifacts |
| `DEP-007` | P1 | متغيرات البيئة تتحقق عند startup، ولا يوجد NEXT_PUBLIC للباك أو الأسرار. | Runtime test |
| `DEP-008` | P1 | لا حالة دائمة داخل Container؛ التفضيلات Client-side غير حساسة فقط. | Deployment review |
| `DEP-009` | P1 | Smoke production قراءة فقط بعد النجاح، دون Mutations على بيانات حقيقية. | Production smoke report |
| `DEP-010` | P1 | Rollback إلى Image SHA سابق مختبر وموثق. | Rollback report |

## الوحدات الوظيفية

### 10.1 مركز العمليات والرئيسية - `MOD-OVERVIEW`
- KPIs من /dashboard/stats مع تنسيق مفهوم وليس أسماء مفاتيح خام.
- بطاقات انتباه: فشل Jobs، طلبات معلقة، SLA، صحة النظام، تحديثات إجبارية وصيانة.
- Quick Actions حسب effective capabilities، لا حسب Role ثابت.
- Readiness غير الصحي يظهر Banner واضح ولا يجعل الواجهة تدعي الصحة.
- لا يُعرض عدد عمليات العقد كبديل دائم عن KPI أعمال حقيقي.

### 10.2 المستخدمون - `MOD-USERS`
- قائمة Server-side: بحث، الدور، الحالة، التحقق، التاريخ، التصدير المقيد.
- تفاصيل: الملف، الحالة، الدور، capabilities الفعلية، overrides، الأجهزة المسموحة حسب العقد.
- تفعيل/تعطيل بإجراء صريح وسبب وتأكيد؛ منع تعطيل الذات أو آخر مسؤول حرج.
- PATCH Allowlist فقط؛ منع Mass Assignment وPUT غير الضروري.
- إنشاء المستخدم لا يُعرض إلا إذا كان عقد الباك الإداري معتمدًا.

### 10.3 RBAC والصلاحيات - `MOD-RBAC`
- عرض قاموس القدرات، الأدوار، الممنوح/المرفوض/الفعلي.
- إضافة/إزالة override بتأكيد وسبب وسجل تدقيق.
- منع منح قدرة أعلى من قدرة الفاعل أو Privilege Escalation.
- تحديث الواجهة فور نجاح التعديل مع invalidation محدد.

### 10.4 الهيكل الأكاديمي - `MOD-ACADEMIC`
- جامعات، كليات، تخصصات، سنوات، فصول، مواد مع Cascading filters.
- أسماء عربية وإنجليزية وأكواد فريدة وترتيب وحالة نشاط.
- منع حذف كيان مرتبط وإظهار سبب 409.
- Import/Export يظهر فقط عند وجود عقد آمن فعلي.

### 10.5 التحقق الطلابي - `MOD-VERIFY`
- Queue مع الحالة، الجامعة/الكلية، العمر، المراجع، أولوية.
- معاينة بطاقة عبر Ticket قصير العمر فقط، دون raw URL.
- Approve/Reject مع سبب، State transition صحيح، منع النقر المكرر.
- إظهار request_id/job id عند الخطأ دون بيانات حساسة.

### 10.6 المحاضرات والمعالجة - `MOD-LECTURES`
- قائمة بحالة الرفع والمعالجة والنشر والمقرر والرافع.
- Wizard رفع متعدد الخطوات مع MIME/حجم/امتداد وتعليمات واضحة.
- تفاصيل: hash، timeline، worker/job، progress، attempts، safe error.
- Retry/Cancel/Publish/Archive فقط عند سماح العقد والحالة.
- Viewer إداري بجلسة محمية لا URL مباشر، وتحميل صفحات تدريجي.

### 10.7 الملفات - `MOD-FILES`
- تصنيف واستهداف وحالة Scan/Quarantine ومالك وحجم.
- Preview/Download عبر Ticket محمي وContent-Disposition آمن.
- لا يُسمح بالنشر قبل scan clean، ولا يظهر path التخزين.

### 10.8 المجموعات - `MOD-GROUPS`
- قائمة المجموعات والأعضاء والطلبات والأدوار والحالة.
- قبول/رفض/حظر/ترقية وفق State Machine ومنع إزالة آخر مشرف.
- External channels وإعداداتها تظهر حسب capability منفصلة.

### 10.9 الإعلانات - `MOD-ANNOUNCE`
- إنشاء بالعربية والإنجليزية، استهداف، جدولة، معاينة، حالة نشر.
- Audience preview count وtimezone واضحان.
- لا تُرسل أو تُنشر الحملة قبل Confirmation نهائي.

### 10.10 الإشعارات والحملات - `MOD-NOTIFY`
- اختيار جمهور آمن، title/body ثنائي اللغة، deep-link allowlist، expiry.
- Preview قبل الإرسال، deduplication وIdempotency.
- تقارير sent/delivered/failed/invalid token/retry دون كشف tokens.

### 10.11 الطباعة - `MOD-PRINT`
- Queue وأوامر وحالات وتعيين طاقم وسجل زمني.
- السعر من الباك فقط، وحقول السعر Read-only.
- Transitions قانونية، سبب الرفض/الإلغاء، منع النقر المكرر.
- فلاتر حسب الحالة/الموقع/التاريخ وSLA/age.

### 10.12 الدعم - `MOD-SUPPORT`
- قائمة Tickets مع SLA والأولوية والتعيين والحالة والوسوم.
- Thread رسائل ومرفقات محمية، إرسال Optimistic مضبوط دون تكرار.
- Assign/priority/status/close/reopen وفق العقد والتدقيق.
- عدم تحميل كامل المحادثات دفعة واحدة إن كانت طويلة.

### 10.13 التقييمات والمقترحات - `MOD-FEEDBACK`
- قائمة وفلاتر نوع/حالة/أولوية/منصة/إصدار/لغة.
- تفاصيل المحتوى والMetadata والتعيين والملاحظات الداخلية والحل.
- لا تُعرض PII أكثر من اللازم ولا يُنشر النص تلقائيًا.
- تحليلات CSAT/CES/NPS عند توفر العقد.

### 10.14 إصدارات التطبيق - `MOD-RELEASES`
- Android/iOS، version/build، minimum/latest، required/recommended، روابط المتجر.
- منع سياسات متعارضة، Preview لأثر 426، نافذة زمنية واضحة.
- Emergency rollback/disable مع تأكيد وتدقيق.

### 10.15 الصيانة - `MOD-MAINT`
- إنشاء وجدولة نافذة 503 ورسالة ar/en وRetry-After.
- تجاوز إداري آمن لا يعتمد Header قابل للتزوير.
- Preview للمستخدمين المتأثرين ومنع تداخل النوافذ.

### 10.16 Feature Flags - `MOD-FLAGS`
- قائمة مفاتيح typed، الحالة، البيئة، الاستهداف، آخر تعديل.
- Kill switch للميزات الحرجة، Confirmation وسجل تدقيق.
- منع مفتاح نصي عشوائي غير معروف للعقد.

### 10.17 الأجهزة - `MOD-DEVICES`
- إن لم يوجد عقد Dashboard إداري: تبقى Fail-Closed.
- عند توفره: قائمة installations، منصة، إصدار، last_seen، active/revoked، بحث وrevoke.
- عدم كشف Push Token؛ عرض hint/hash فقط.

### 10.18 السياسات والموافقات - `MOD-POLICY`
- إصدارات Terms/Privacy/Consent مع لغة وحالة نشر وتاريخ.
- عدد الموافقين والتغطية حسب الإصدار دون كشف زائد.
- الإصدار المنشور Immutable أو يتطلب نسخة جديدة.

### 10.19 حذف الحساب - `MOD-DELETE`
- إن لم يوجد عقد إداري: Fail-Closed.
- عند توفره: طلبات، grace period، cancel، scheduled execution، timeline، legal retention.
- إجراءات حساسة بتأكيد وسبب وتدقيق ومنع التنفيذ المكرر.

### 10.20 سجل التدقيق - `MOD-AUDIT`
- Read-only حقيقي، فلاتر actor/action/target/result/time/request_id.
- تفاصيل آمنة دون Tokens أو أجسام حساسة.
- Export مقيد ومؤرخ ومسجل في التدقيق.

### 10.21 صحة النظام - `MOD-HEALTH`
- عرض Live/Ready/Startup ومكونات DB/Redis/Workers/Storage حسب العقد.
- عدم كشف Host/Credentials/stack.
- Auto-refresh مضبوط، حالة degraded، ونسخ request_id للدعم.

### 10.22 الإعدادات الشخصية - `MOD-SETTINGS`
- اللغة، Theme، الكثافة، تقليل الحركة، طي الشريط، حفظ محلي غير حساس.
- تغيير كلمة المرور أو الملف يمر عبر عقد الباك ويعيد إبطال الجلسة عند الحاجة.
- زر Reset preferences واضح ولا يمسح الجلسة.

## حالات HTTP

- **400/422:** Field errors + safe message
- **401:** Single refresh then logout
- **403:** Access denied
- **404:** Not found
- **405:** Contract bug
- **409:** Conflict UI
- **413/415:** Upload limits
- **426:** Forced update
- **429:** Respect Retry-After
- **503:** Maintenance/degraded
- **5xx:** Safe error + request_id
- **Offline:** Independent network state

## تعليمات كوديكس

```text
راجع المستودع كاملًا مقابل كل Requirement ID. أنشئ Compliance Matrix، أصلح P0 ثم P1 ثم P2، لا تعدل generated يدويًا، لا تستخدم endpoints الجوال كإدارة، أزل التأخير الصناعي من Splash، استخدم effective capabilities من الباك، وأنشئ Unit/Integration/Contract/E2E/Visual/A11y/Performance/Security tests. لا تقل PASS دون دليل. لا تربط الإنتاج قبل صحة ready/startup ونجاح Staging.
```

### المخرجات
- `docs/reports/DASHBOARD_REQUIREMENTS_COMPLIANCE.md`
- `docs/reports/DASHBOARD_GAP_AND_FIX_REPORT_AR.md`
- `docs/reports/DASHBOARD_PERFORMANCE_REPORT.md`
- `docs/reports/DASHBOARD_SECURITY_REPORT.md`
- `docs/reports/DASHBOARD_E2E_REPORT.md`
- `docs/reports/DASHBOARD_RELEASE_READINESS.md`

### أوامر القبول
```bash
npm ci
npm run contracts:generate
npm run contracts:check
npm run i18n:check
npm run security:check
npm run routes:check
npm run type-check
npm run lint
npm run build
npx vitest run --coverage
npx playwright test
```

### القرار النهائي
واحد فقط: `APPROVED FOR PRODUCTION` أو `APPROVED FOR LIMITED PILOT` أو `BLOCKED`.