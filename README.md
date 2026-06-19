# Panorama Dashboard

Professional admin dashboard for Panorama student services platform.

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- shadcn-style UI primitives
- TanStack Query
- TanStack Table
- React Hook Form
- Zod
- Axios
- Recharts
- Sonner
- Next Themes
- Lucide React

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The dashboard follows the Panorama Dashboard API v2 production contract in
`panorama_dashboard_api_collection_v2_production.json`.

```bash
NEXT_PUBLIC_API_BASE_URL=http://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io
NEXT_PUBLIC_WS_BASE_URL=ws://eby52x8qksscjvfeqxf0eob7.76.13.155.172.sslip.io
NEXT_PUBLIC_APP_NAME=Panorama Dashboard
NEXT_PUBLIC_APP_ENV=local
```

## Demo Credentials

Seeded backend users:

- `it@panorama.local`
- `admin@panorama.local`
- `print@panorama.local`

Password:

- `ChangeMe123!`

## Brand Assets

- `public/brand/panorama-logo.png`
- `public/brand/panorama-logo-horizontal.png`
- `public/brand/panorama-icon.png`

The UI uses Panorama navy `#002B7F`, purple `#3B0CA3`, burgundy `#A50D46`, silver `#BFC0C2`, and a clean slate background.

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run type-check
```

This Windows workspace has a native Next SWC binary issue, so `npm run dev` and `npm run build` use local wrappers that fall back to SWC WASM + webpack when needed.

## Role-Based Access

- `it_support`: all modules
- `admin`: overview, academic, verification, groups, files, announcements, printing, support, audit logs, notifications, settings
- `print_staff`: printing, notifications, settings
- `student` and `normal_user`: blocked from dashboard

The backend remains the source of truth. Frontend permissions hide inaccessible UI and redirect forbidden direct routes.

## Phase 1 Completed

- Next.js App Router foundation with TypeScript and Tailwind CSS
- shadcn-style UI primitives, theme provider, Sonner toasts, and responsive layout shell
- Centralized environment config, route constants, API endpoints, and permissions
- Axios API client with backend response normalization, request ID capture, JWT attachment, refresh token rotation, multipart support, and session cleanup
- Login flow with React Hook Form, Zod validation, token storage, role checks, and dashboard redirects
- Protected dashboard routes with `/api/v1/auth/me/` boot validation and role-based navigation for `it_support`, `admin`, and `print_staff`
- Dashboard overview connected to `/api/v1/dashboard/stats/` with metric cards, charts, loading, empty, and error states
- Reusable DataTable, form controls, feedback states, page header, status badges, and role badges
- Route structure for academic, verification, groups, files, announcements, printing, support, audit logs, notifications, and settings
- Production validation scripts for linting, type-checking, and building

## Additional Existing Module Work

- Panorama branding on login, sidebar, metadata, theme colors, charts, cards, and states
- Academic Structure CRUD:
  - universities
  - faculties with parser-compatible Arabic code helper
  - majors
  - academic years
  - semesters
  - subjects
- Verification Requests:
  - list
  - detail dialog
  - parsed student-number fields
  - card image preview/open
  - approve/reject/needs-update actions
- Groups:
  - list/create/edit/delete
  - multipart image upload
  - send message permission
  - detail tabs
  - memberships and join requests
  - approve/reject/block/update-role actions
- Files Library:
  - list/create/edit/delete
  - multipart file upload
  - visibility rules for `major_only`, `group_only`, and `admin_only`
  - download/open action
- Announcements:
  - list/create/edit/delete
  - image upload
  - target selectors
  - schedule fields
  - mobile preview card
- Printing Orders:
  - status tabs
  - list/detail
  - items table
  - status history
  - assign/update-status/add-note actions
- Support Tickets:
  - list/detail
  - message thread
  - update status/priority
  - assign/reply actions
- Audit Logs:
  - read-only table
  - detail dialog
  - redaction note
- Notifications:
  - list
  - unread count
  - mark read
  - read all
- Settings/Profile:
  - current user card
  - role badge
  - theme switch
  - logout
  - API/environment display

## Phase 2 Next

- Confirm backend serializer coverage for all create/edit forms.
- Add server-driven pagination once backend pagination contracts are finalized.
- Add end-to-end tests against a seeded backend.
- Confirm dashboard notification payload examples and refine notification UX.
- Move token storage to httpOnly secure cookies when backend support is available.

## Known Limitations

- `panorama_mobile_api_collection_v2_production.json` is not present in this workspace; dashboard work uses the Dashboard API v2 contract only.
- Some create/edit fields depend on exact backend serializer support. The frontend maps only documented fields from `panorama_dashboard_api_collection_v2_production.json`.
- LocalStorage token storage is acceptable for MVP. httpOnly secure cookies are recommended for production hardening if the backend supports them later.

## Next Production Steps

- Confirm dashboard notification endpoints.
- Add server-driven pagination controls when backend page-size/page-number contract is finalized.
- Add end-to-end tests against a seeded backend.
- Move token storage to httpOnly cookies when backend support is available.
