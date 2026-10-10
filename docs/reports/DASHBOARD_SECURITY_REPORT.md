# تقرير الأمان — Panorama Dashboard

تاريخ التدقيق: 2026-08-04  
نطاقه: مراجعة كود ساكن وقراءة إعدادات BFF/المصادقة. لم تُنفذ اختبارات هجومية أو E2E لعدم وجود بنية اختبار، لذلك لا توجد نتيجة أمان نهائية.

## النتيجة

**BLOCKED** — توجد مخالفات P0 مؤكدة. لا يصرّح هذا التقرير بأن التطبيق صالح للنشر.

## النتائج المؤكدة

| الشدة | المتطلبات | الدليل | الأثر | المعالجة المطلوبة |
|---|---|---|---|---|
| حرجة | `ARCH-001`, `SEC-001`, `AUTH-001` | `src/lib/auth/token-storage.ts` يضع Access/Refresh Tokens في `localStorage`، ويُستهلك في `src/lib/api/client.ts` وميزات قديمة | XSS أو إضافة متصفح خبيثة تستطيع قراءة الجلسة؛ يوجد مسار API مباشر | إزالة طبقة token-storage/axios القديمة وكل imports التابعة لها من الإنتاج؛ حصر المتصفح في BFF+HttpOnly cookies |
| حرجة | `ARCH-002`, `ARCH-003`, `SEC-007` | `src/config/env.ts` يقبل `NEXT_PUBLIC_API_BASE_URL` و`src/lib/api/client.ts` يطلبه مباشرة | تجاوز BFF وسياسات CSRF/headers؛ فشل `npm run security:check` | حذف public API base والعميل المباشر أو نقله إلى server-only؛ منع استيراده في client bundle |
| عالية | `RBAC-001`, `SEC-014` | `src/lib/auth/server-session.ts` يطبق `ROLE_CAPABILITY_FALLBACK` عند غياب capabilities بلا قيد بيئة | صلاحيات مشتقة من role في production بدل مصدر backend؛ فشل مفتوح | في production: capabilities غائبة = session مرفوضة/Fail-Closed؛ قصر fallback على development/test مع مؤشر واضح |
| عالية | `AUTH-004` | Refresh الفاشل في `/api/auth/refresh` وBFF لا يمسح الكوكيز دائمًا | جلسة منتهية تبقى في المتصفح وقد تؤدي لتكرار أخطاء | مسح جميع Cookies في كل فشل refresh وإيقاف أي retry بعد محاولة واحدة |
| عالية | `SEC-002`, `SEC-003` | CSP موجود في `middleware.ts` لكن HSTS غير موجود في `next.config.ts`، ولا يوجد اختبار headers | دفاعات HTTP غير مكتملة وغير مثبتة خلف proxy | إضافة HSTS للإنتاج، والتحقق من CSP nonce و`frame-ancestors` و`object-src` و`connect-src` وheaders الخارجية باختبار |
| عالية | `DEP-003` | `/api/health` يعيد `status: ok` بلا استعلام `/api/v1/health/ready/` | Coolify قد يعتبر الحاوية سليمة بينما الباك غير ready | جعل health يعكس readiness الآمن للباك ويعيد non-2xx عند الفشل من دون كشف تفاصيل |
| عالية | `LOAD-001`, `LOAD-002` | `app-boot-splash.tsx` يستعمل تأخيرات ثابتة 950ms/1250ms | حجب مصطنع وتجربة سيئة؛ فشل lint | إزالة timers؛ إظهار loading فقط بعد 150ms من تهيئة حقيقية وبحد طبيعي 600ms |

## عناصر صحيحة جزئيًا لكنها غير كافية للـPASS

- `src/app/api/backend/[...path]/route.ts` يقبل فقط مسارات تبدأ `api/v1/` ويمنع `..` و`://`، يستعمل allowlist لاستجابة upstream، ويضيف `X-Request-ID` وIdempotency للـmutations.
- `src/lib/security/csrf.ts` يتحقق من Origin/Referer/`sec-fetch-site` ومن double-submit token باستخدام مقارنة ثابتة الزمن.
- cookies الجديدة تضبط `HttpOnly` لرموز الجلسة و`SameSite=Lax` و`Secure` في production.
- middleware يضبط CSP متضمنًا `frame-ancestors 'none'` و`object-src 'none'` و`connect-src 'self'`.

لا تكفي هذه العناصر بسبب وجود المسار القديم المتعارض، وبسبب غياب اختبارات هجوم فعلية على BFF/Routes.

## أوامر وأدلة

```text
npm run security:check
FAIL: public backend API environment variable: src\config\env.ts

curl (read-only) https://api.xn--mgbaab0cxheq.tech/api/v1/health/ready/
HTTP 503
```

## الاختبارات الأمنية الإلزامية قبل الإقرار

1. Browser test يثبت عدم وجود access/refresh token في localStorage/sessionStorage/IndexedDB/URL.
2. BFF tests لمسارات absolute/protocol-relative/traversal encoded/CRLF/headers/oversized body/upstream override.
3. CSRF negative tests لكل Mutation وorigin/referer forged.
4. Concurrent 401 يثبت single-flight ويمسح cookies بعد الفشل.
5. IDOR وfile preview/download ticket tests.
6. Mass-assignment allowlist tests لكل مورد قابل للتحرير.
7. External HTTPS headers test وdependency/container scan وSBOM.


## P0 remediation update (2026-08-04)
See P0_REMEDIATION_REPORT_AR.md for code changes and command evidence. Local code gates were revalidated; final OpenAPI, backend readiness, staging and production remain BLOCKED.
