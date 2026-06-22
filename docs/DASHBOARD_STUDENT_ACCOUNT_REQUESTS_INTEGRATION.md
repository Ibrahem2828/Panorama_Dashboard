# Panorama Dashboard — Student Account Requests Integration

## Feature overview

Admin/IT support module for reviewing student account creation requests, verifying uploaded university cards, and manually delivering OTP activation codes via WhatsApp.

- **Backend base:** `NEXT_PUBLIC_API_BASE_URL` (production: `https://api.xn--mgbaab0cxheq.tech`)
- **Auth:** `Authorization: Bearer <access_token>`
- **Response envelope:** `{ success, message, data }` with paginated lists `{ count, next, previous, results }`

## Routes added

| Route | Page | Access |
|-------|------|--------|
| `/student-account-requests` | List | `admin`, `it_support` |
| `/student-account-requests/:id` | Detail | `admin`, `it_support` |

`print_staff` is redirected to `/printing` by `ProtectedRoute` when accessing these routes.

## Sidebar behavior

- Label: **طلبات حسابات الطلاب**
- Icon: `ClipboardList`
- Visible to: `admin`, `it_support`
- Hidden from: `print_staff` (and all non-dashboard roles)

## API methods used

| Method | Endpoint |
|--------|----------|
| `listStudentAccountRequests` | `GET /api/v1/dashboard/student-account-requests/` |
| `getStudentAccountRequest` | `GET /api/v1/dashboard/student-account-requests/{id}/` |
| `approveStudentAccountRequest` | `POST /api/v1/dashboard/student-account-requests/{id}/approve/` |
| `rejectStudentAccountRequest` | `POST /api/v1/dashboard/student-account-requests/{id}/reject/` |
| `markStudentAccountRequestNeedsUpdate` | `POST /api/v1/dashboard/student-account-requests/{id}/needs-update/` |
| `resendStudentOtp` | `POST /api/v1/dashboard/student-account-requests/{id}/resend-otp/` |
| `createCardPreviewToken` | `POST /api/v1/dashboard/student-account-requests/{id}/card-preview-token/` |

Card preview opens: `GET /api/v1/protected-media/{token}/`

## Permission matrix

| Role | Sidebar | Routes | API |
|------|---------|--------|-----|
| `admin` | Yes | Full | 200 |
| `it_support` | Yes | Full | 200 |
| `print_staff` | No | Redirect `/printing` | 403 |
| `student` / `normal_user` | No | Login blocked | N/A |

## Status mapping

| Backend status | Arabic label |
|----------------|--------------|
| `pending_review` | قيد المراجعة |
| `approved_pending_otp` | بانتظار إرسال رمز التفعيل |
| `otp_sent` | تم توليد رمز التفعيل |
| `active` | مفعّل |
| `rejected` | مرفوض |
| `needs_update` | يحتاج تعديل |
| `expired` | منتهي |

## Approve / resend OTP workflow

1. Admin clicks **قبول الطالب** (or **إعادة توليد رمز التفعيل** for `approved_pending_otp` / `otp_sent`).
2. Confirmation modal shown.
3. On success, backend returns `otp_code`, `whatsapp_phone`, `otp_expires_at`, `manual_whatsapp_message`.
4. OTP modal displays code and copy buttons.
5. Admin copies OTP or full WhatsApp message and sends manually.
6. OTP is **not** stored in localStorage or persistent frontend state.

## Manual WhatsApp workflow

- No WhatsApp API integration.
- Dashboard never auto-sends messages.
- `manual_whatsapp_message` is copyable from the OTP modal.

## Reject / needs_update workflow

- **Reject:** required `rejection_reason` (min 5 chars) → `POST reject/`
- **Needs update:** required `needs_update_reason` (min 5 chars) → `POST needs-update/`
- Mobile resubmit is backend-deferred; dashboard only marks status and shows reason.

## Card preview flow

1. User clicks **معاينة البطاقة** on detail page.
2. Frontend requests `card-preview-token`.
3. Token used to open `/api/v1/protected-media/{token}/` in a new tab.
4. Token is not cached permanently.

## QA checklist

- [ ] Login as `admin` — list loads
- [ ] Detail page loads from row click
- [ ] Card preview works or shows graceful error
- [ ] Approve pending request — OTP modal appears
- [ ] Copy OTP works
- [ ] Copy WhatsApp message works
- [ ] Resend OTP works (cooldown error in Arabic)
- [ ] Reject with reason works
- [ ] Needs update with reason works
- [ ] `print_staff` cannot access route (redirect to printing)
- [ ] Printing page still works
- [ ] Existing dashboard pages unaffected
- [x] `npm run type-check` passes
- [x] `npm run lint` passes
- [x] `npm run build` passes

## Known backend contract notes

- OTP returned only from `approve` and `resend-otp` responses.
- `reject` only from `pending_review`.
- `needs-update` only from `pending_review`.
- `approve` allowed from `pending_review` and `needs_update`.
- `resend-otp` only when status is `approved_pending_otp` or `otp_sent`.
- List supports: `status`, `search`, `ordering`, `page`, `page_size`.
- Detail exposes `has_uploaded_card` but never raw file paths.

## Source files

```
src/features/student-account-requests/
src/app/(dashboard)/student-account-requests/
src/lib/routes.ts
src/lib/api/endpoints.ts
src/lib/api/query-keys.ts
src/lib/permissions.ts
src/config/navigation.ts
```