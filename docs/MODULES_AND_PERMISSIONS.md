# Modules and Capabilities

| Module | Capability |
|---|---|
| Dashboard | `dashboard.access` |
| Users / RBAC | `users.manage` |
| Academic | `academic.manage` |
| Verification | `verification.review` |
| Lectures | `lectures.manage` |
| Files | `files.manage` |
| Groups | `groups.manage` |
| Announcements / campaigns | `announcements.manage` |
| Printing | `printing.manage` |
| Support | `support.manage` |
| Feedback | `feedback.manage` |
| Product / governance | `product.manage` |
| Audit | `audit.view` |

Role fallback exists only for compatibility when the backend response lacks effective capabilities. Production should return authoritative effective capabilities from `/auth/me/` or a dashboard bootstrap endpoint.

Student and normal-user roles are not dashboard roles and must be rejected by the backend as well as the BFF.
