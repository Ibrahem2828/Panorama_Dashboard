/**
 * Compatibility names for legacy feature modules. The paths themselves are
 * generated from contracts/backend/openapi.json; do not add literal API paths
 * to this file.
 */
import { operationPath } from "@/contracts/generated/resources";

export const endpoints = {
  auth: {
    login: operationPath("v1_auth_login_create"),
    refresh: operationPath("v1_auth_token_refresh_create"),
    logout: operationPath("v1_auth_logout_create"),
    me: operationPath("v1_auth_me_retrieve"),
  },
  dashboard: { stats: operationPath("v1_dashboard_stats_retrieve") },
  academic: {
    universities: operationPath("v1_dashboard_universities_list"),
    faculties: operationPath("v1_dashboard_faculties_list"),
    majors: operationPath("v1_dashboard_majors_list"),
    academicYears: operationPath("v1_dashboard_academic_years_list"),
    semesters: operationPath("v1_dashboard_semesters_list"),
    subjects: operationPath("v1_dashboard_subjects_list"),
  },
  verification: {
    requests: operationPath("v1_dashboard_verifications_list"),
    detail: (id: number | string) => operationPath("v1_dashboard_verifications_retrieve", { id }),
    approve: (id: number | string) => operationPath("v1_dashboard_verifications_approve_create", { id }),
    reject: (id: number | string) => operationPath("v1_dashboard_verifications_reject_create", { id }),
    needsUpdate: (id: number | string) => operationPath("v1_dashboard_verifications_needs_update_create", { id }),
    cardTicket: (id: number | string) => operationPath("v1_dashboard_verifications_card_ticket_create", { id }),
  },
  groups: {
    list: operationPath("v1_dashboard_groups_list"),
    detail: (id: number | string) => operationPath("v1_dashboard_groups_retrieve", { id }),
    memberships: (groupPk: number | string) => operationPath("v1_dashboard_groups_memberships_list", { group_pk: groupPk }),
    joinRequests: (groupPk: number | string) => operationPath("v1_dashboard_groups_join_requests_list", { group_pk: groupPk }),
    approveMembership: (id: number | string) => operationPath("v1_dashboard_group_memberships_approve_create", { id }),
    rejectMembership: (id: number | string) => operationPath("v1_dashboard_group_memberships_reject_create", { id }),
    blockMembership: (id: number | string) => operationPath("v1_dashboard_group_memberships_block_create", { id }),
    membershipRole: (id: number | string) => operationPath("v1_dashboard_group_memberships_role_partial_update", { id }),
  },
  files: {
    list: operationPath("v1_dashboard_files_list"),
    detail: (id: number | string) => operationPath("v1_dashboard_files_retrieve", { id }),
  },
  announcements: {
    list: operationPath("v1_dashboard_announcements_list"),
    detail: (id: number | string) => operationPath("v1_dashboard_announcements_retrieve", { id }),
  },
  printing: {
    orders: operationPath("v1_dashboard_printing_orders_list"),
    detail: (id: number | string) => operationPath("v1_dashboard_printing_orders_retrieve", { id }),
    assign: (id: number | string) => operationPath("v1_dashboard_printing_orders_assign_partial_update", { id }),
    status: (id: number | string) => operationPath("v1_dashboard_printing_orders_status_partial_update", { id }),
    note: (id: number | string) => operationPath("v1_dashboard_printing_orders_note_create", { id }),
  },
  support: {
    tickets: operationPath("v1_dashboard_support_tickets_list"),
    detail: (id: number | string) => operationPath("v1_dashboard_support_tickets_retrieve", { id }),
    status: (id: number | string) => operationPath("v1_dashboard_support_tickets_status_partial_update", { id }),
    priority: (id: number | string) => operationPath("v1_dashboard_support_tickets_priority_partial_update", { id }),
    assign: (id: number | string) => operationPath("v1_dashboard_support_tickets_assign_create", { id }),
    messages: (id: number | string) => operationPath("v1_dashboard_support_tickets_messages_create", { id }),
  },
  audit: { logs: operationPath("v1_dashboard_audit_logs_list") },
  notifications: {
    list: operationPath("v1_notifications_list"),
    unreadCount: operationPath("v1_notifications_unread_count_retrieve"),
    markRead: (id: number | string) => operationPath("v1_notifications_read_create", { id }),
    readAll: operationPath("v1_notifications_read_all_create"),
  },
} as const;
