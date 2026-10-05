# تقرير عقد الباك وOpenAPI

تاريخ التدقيق: 2026-08-04

## الحالة المثبتة

| الحقل | القيمة |
|---|---|
| ملف العقد | `contracts/backend/openapi.json` |
| OpenAPI | 3.0.3 |
| SHA-256 | `180F1FDEC13A63567C24F129B8548810025A82107833E4E612FE1261825F30D3` |
| Paths | 181 |
| Operations | 331 |
| Schemas | 221 |
| `operationId` مفقود | 0 |
| `operationId` فريد | 331/331 |
| الموردات المنقحة في generated definitions | 25 |
| Backend Git SHA | غير متاح |
| تاريخ توليد العقد | غير موثق في metadata الحالية |

## الأمر المنفذ

```text
npm run contracts:check
Contract check passed: 181 paths, 331 operations, 25 curated resources.
```

هذه نتيجة اتساق داخلي للعقد المحلي فقط. لا تصلح دليلًا على توافقه مع الباك النهائي.

## فجوة مانعة (P0)

المواصفة توثق احتمال انتقال العقد النهائي إلى **271 عملية**، بينما النسخة المحلية تحوي **331**. لا يوجد Commit SHA للباك النهائي ولا artifact OpenAPI أحدث في المستودع، ومن ثم:

- `BASE-001` و`API-001` و`API-002` هي **BLOCKED** وليست PASS.
- لا يمكن تشغيل `contracts:generate` على عقد نهائي غير متاح.
- لا يجوز تعديل ملفات `src/contracts/generated/*` يدويًا لمعالجة الفجوة.
- أي وحدة تستخدم مسارًا غير موجود في العقد النهائي المتوقع يجب أن تكون Fail-Closed حتى يستلم الفريق العقد المعتمد.

## ما يجب أن يقدمه فريق الباك قبل الاستمرار

1. Git SHA أو release tag للباك النهائي.
2. نسخة OpenAPI النهائية مع SHA-256 أو رابط artifact ثابت.
3. تعريف رسمي للفروقات بين 331 و271 عملية، وخاصة عمليات Dashboard الإدارية.
4. سياسة `Idempotency-Key` و`X-Request-ID` لكل Mutation.
5. عقد capabilities الفعالة وواجهات readiness/startup.

## إجراءات الإصلاح بعد استلام العقد

1. استبدال `contracts/backend/openapi.{json,yaml}` من artifact الموثق فقط.
2. تشغيل `npm run contracts:generate` ثم `npm run contracts:check`.
3. إعادة بناء operation registry/resource definitions من المولد، لا بالتحرير اليدوي.
4. إضافة CI يرفض اختلاف OpenAPI أو metadata أو operations أو resource definitions أو runtime usage.
5. تشغيل contract tests على كل مسارات Dashboard وإبقاء أي عملية بلا عقد Fail-Closed.


## P0 remediation update (2026-08-04)
See P0_REMEDIATION_REPORT_AR.md for code changes and command evidence. Local code gates were revalidated; final OpenAPI, backend readiness, staging and production remain BLOCKED.
