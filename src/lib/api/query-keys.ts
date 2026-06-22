import type { QueryParams } from "@/lib/api/crud";

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: () => ["auth", "me"] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    stats: () => ["dashboard", "stats"] as const,
  },
  academic: {
    all: ["academic"] as const,
    list: (resource: string, params?: QueryParams) => ["academic", resource, params] as const,
  },
  verification: {
    all: ["verification"] as const,
    list: (params?: QueryParams) => ["verification", "list", params] as const,
    detail: (id?: number | string) => ["verification", "detail", id] as const,
  },
  studentAccountRequests: {
    all: ["student-account-requests"] as const,
    list: (params?: QueryParams) => ["student-account-requests", "list", params] as const,
    detail: (id?: number | string) => ["student-account-requests", "detail", id] as const,
  },
  groups: {
    all: ["groups"] as const,
    list: (params?: QueryParams) => ["groups", "list", params] as const,
    detail: (id?: number | string) => ["groups", "detail", id] as const,
    memberships: (groupId?: number | string) => ["groups", "memberships", groupId] as const,
    joinRequests: (groupId?: number | string) => ["groups", "join-requests", groupId] as const,
  },
  files: {
    all: ["files"] as const,
    list: (params?: QueryParams) => ["files", "list", params] as const,
  },
  announcements: {
    all: ["announcements"] as const,
    list: (params?: QueryParams) => ["announcements", "list", params] as const,
  },
  printing: {
    all: ["printing"] as const,
    list: (params?: QueryParams) => ["printing", "list", params] as const,
    detail: (id?: number | string) => ["printing", "detail", id] as const,
  },
  support: {
    all: ["support"] as const,
    list: (params?: QueryParams) => ["support", "list", params] as const,
    detail: (id?: number | string) => ["support", "detail", id] as const,
  },
  audit: {
    all: ["audit"] as const,
    list: (params?: QueryParams) => ["audit", "list", params] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (params?: QueryParams) => ["notifications", "list", params] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
  },
} as const;
