# Panorama Dashboard — Initial Baseline

تاريخ التدقيق: 2026-08-04  
المراجع: `ac74516234ab6e6392039a8656fe8aec0043ba49` (مع مساحة عمل غير نظيفة قبل بدء التدقيق)

## النطاق وطريقة التقييم

تمت قراءة المواصفة الملزمة `Panorama_Dashboard_Master_Specification_Codex_Audit_AR.md`، ومراجعة بنية التطبيق، وBFF والمصادقة وOpenAPI وإعدادات النشر. لا تعني نتيجة فحص ساكن أو اسم ملف أن المتطلب مكتمل؛ لا تُسجَّل حالة `PASS` في تقارير المطابقة بلا اختبار وأمر قابل لإعادة التشغيل.

## جرد المشروع

| المؤشر | القيمة | الدليل |
|---|---:|---|
| Node في بيئة التدقيق | `v20.19.6` | `node --version` |
| Node المطلوب | `>=22.13.0 <23` | `package.json` |
| npm | `11.16.0` | `npm --version` |
| Next.js | `16.2.6` | `package.json` |
| React | `19.2.4` | `package.json` |
| ملفات المستودع المفهرسة | 315 | `rg --files` |
| ملفات `page.tsx` | 51 | جرد `src/app`؛ يشمل المسارات القديمة والجديدة |
| مجلدات Features | 19 | `src/features` |
| ملفات Unit/Integration/E2E/Playwright/Vitest | 0 | `rg --files -g '*test*' -g '*spec*' ...` |
| OpenAPI paths | 181 | `contracts/backend/openapi.json` |
| OpenAPI operations | 331 | `npm run contracts:check` |
| OpenAPI schemas | 221 | تحليل `openapi.json` |
| موارد CRUD المنقحة | 25 | `npm run contracts:check` |
| مفاتيح الترجمة ar/en | 269/269 | `npm run i18n:check` |
| `console.log` في `src` | 0 | مسح ساكن |

## نتائج بوابات Baseline

| البوابة | الأمر أو الفحص | النتيجة | الدليل |
|---|---|---|---|
| توافق العقد الداخلي | `npm run contracts:check` | PASS داخلي فقط | 181 paths، 331 operations، 25 resources؛ لا يثبت أنه عقد الباك النهائي |
| تطابق i18n | `npm run i18n:check` | PASS جزئي | 269 مفتاحًا في اللغتين؛ لا يوجد اختبار مرئي RTL/LTR أو فحص للنصوص الثابتة |
| فحص المسارات | `npm run routes:check` | PASS جزئي | 28 هدف ملاحة لها صفحات؛ لا يثبت حراسة capability أو المسارات غير المدرجة |
| فحص الأمان الساكن | `npm run security:check` | FAIL | اكتشف `NEXT_PUBLIC_API_BASE_URL` في `src/config/env.ts` |
| TypeScript | `npm run type-check` | FAIL | أخطاء كثيرة من طبقة API/Auth قديمة ومسارات قديمة ومتعارضة |
| ESLint | `npm run lint` | FAIL | خطآن في `app-boot-splash.tsx` و`resource-form-dialog.tsx`، وتحذيران |
| Unit/Component/Integration/Contract/E2E | — | FAIL | لا توجد بنية اختبار أو scripts/اعتماديات Vitest/Playwright |
| `npm ci` من Clone نظيف | غير قابل للإثبات | BLOCKED | بيئة التدقيق Node 20، خلاف نطاق Node 22 المطلوب |
| Build | غير منفذ | BLOCKED | `type-check` فاشل؛ لا يمكن ادعاء بناء صالح |

## حالة الباك والعقد

| البند | النتيجة |
|---|---|
| SHA-256 للعقد المحلي | `180F1FDEC13A63567C24F129B8548810025A82107833E4E612FE1261825F30D3` |
| عدد العمليات المحلي | 331 |
| العقد المرجعي النهائي المذكور في المواصفة | 271 عملية |
| Backend Git SHA / عقد نهائي موثّق | غير متاح في المستودع |
| `https://api.xn--mgbaab0cxheq.tech/api/v1/health/ready/` | HTTP 503 في 2026-08-04 (فحص قراءة فقط) |

لذلك لا يمكن إقرار `BASE-001` أو `API-001` أو أي ربط إنتاجي. لا يجوز استبدال العقد بالتخمين أو استخدام endpoints الجوال بديلًا عن عقد Dashboard.

## ملاحظات أمنية ووظيفية حرجة

1. توجد طبقة قديمة في `src/lib/auth/token-storage.ts` تحفظ Access/Refresh Tokens في `localStorage`، ويستخدمها `src/lib/api/client.ts` وFeatures قديمة. هذا يخالف صراحةً `ARCH-001` و`SEC-001` ويمكّن الاتصال المباشر بالباك.
2. يوجد مسار BFF أحدث وآمن جزئيًا في `src/app/api/backend/[...path]/route.ts`، لكنه يتعايش مع الطبقة القديمة. لا يمكن اعتبار Same-Origin مفروضًا حتى إزالة المسار القديم أو عزله بالكامل من البناء.
3. `sessionFromUser` يسمح بـ`ROLE_CAPABILITY_FALLBACK` عند غياب capabilities من الباك حتى في الإنتاج؛ يلزم Fail-Closed في production.
4. الـSplash في `src/components/brand/app-boot-splash.tsx` يستعمل `setTimeout` ثابتًا (950ms و1250ms)، مخالفًا لمتطلبات التحميل.
5. `/api/health` يعيد `status: ok` محليًا بلا فحص backend readiness، مخالفًا لمتطلب readiness الصادق.
6. لا توجد اختبارات أو CI أو SBOM أو فحص حاوية أو أدلة Staging؛ لا يمكن منح أي اعتماد إنتاجي.

## القرار المرحلي

**BLOCKED** — توجد متطلبات P0 مفتوحة، وبوابة الأمن وTypeScript وESLint فاشلة، والباك غير Ready، والعقد النهائي غير متاح.


## P0 remediation update (2026-08-04)
See P0_REMEDIATION_REPORT_AR.md for code changes and command evidence. Local code gates were revalidated; final OpenAPI, backend readiness, staging and production remain BLOCKED.
