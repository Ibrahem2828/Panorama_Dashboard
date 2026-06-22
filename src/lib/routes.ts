export const ROUTES = {
  login: "/login",
  forgotPassword: "/forgot-password",
  overview: "/",
  academic: "/academic",
  universities: "/academic/universities",
  faculties: "/academic/faculties",
  majors: "/academic/majors",
  academicYears: "/academic/academic-years",
  semesters: "/academic/semesters",
  subjects: "/academic/subjects",
  verification: "/verification",
  studentAccountRequests: "/student-account-requests",
  groups: "/groups",
  files: "/files",
  announcements: "/announcements",
  printing: "/printing",
  support: "/support",
  auditLogs: "/audit-logs",
  notifications: "/notifications",
  settings: "/settings",
} as const;

export function getDefaultDashboardRoute(role?: string | null) {
  return role === "print_staff" ? ROUTES.printing : ROUTES.overview;
}

export function studentAccountRequestDetail(id: number | string) {
  return `${ROUTES.studentAccountRequests}/${id}`;
}
