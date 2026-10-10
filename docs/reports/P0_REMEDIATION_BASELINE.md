# P0 Remediation Baseline

تاريخ البدء: 2026-08-04  
الفرع: `fix/dashboard-p0-security-foundation`  
SHA عند البداية: `ac74516234ab6e6392039a8656fe8aec0043ba49`

## حماية مساحة العمل

- حُفظت التغييرات المتعقبة قبل العمل في `docs/reports/PRE_P0_WORKTREE_BACKUP.patch`.
- حُفظت قائمة الملفات غير المتعقبة قبل العمل في `docs/reports/PRE_P0_UNTRACKED_FILES.txt`.
- لم يُستخدم reset أو clean أو restore أو stash.
- كانت مساحة العمل غير نظيفة وتحتوي هجرة BFF جزئية مع طبقة Axios/JWT قديمة متعارضة. ستقتصر التغييرات على إصلاح P0 أو إزالة الإرث الذي يسبب المخالفة/فشل البناء.

## Baseline التنفيذي

| البوابة | الحالة عند البدء |
|---|---|
| Node | `v20.19.6`، بينما النطاق المطلوب Node 22 |
| `npm run security:check` | FAIL: public backend API environment variable |
| `npm run type-check` | FAIL: طبقة legacy/types/routes متعارضة |
| `npm run lint` | FAIL: Splash/Form effect errors |
| `npm run build` | FAIL: 38 Turbopack errors من legacy imports/routes |
| Backend readiness | HTTP 503 (قراءة فقط) |
| Contract finality | BLOCKED: العقد المحلي 331 عملية، artifact النهائي 271 غير متاح |

## قرار الدمج

توجد مسارات locale/BFF أحدث قابلة للاستبقاء، ومسارات `src/app/(dashboard)` وطبقة Axios/token-storage أقدم هي مصدر المخالفة وأخطاء البناء. ستُزال أو تُعزل الملفات القديمة بعد التأكد من عدم اعتماد المسارات النشطة عليها، مع توثيق كل ملف في التقرير النهائي.
