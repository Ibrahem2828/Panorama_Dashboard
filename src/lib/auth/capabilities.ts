import type { DashboardRole } from "@/config/constants";
import type { Capability } from "@/types/auth";

export const CAPABILITIES = {
  dashboard: "dashboard.access",
  system: "system.manage",
  users: "users.manage",
  academic: "academic.manage",
  verification: "verification.review",
  groups: "groups.manage",
  externalChannels: "groups.external_channels.manage",
  files: "files.manage",
  lectures: "lectures.manage",
  printing: "printing.manage",
  support: "support.manage",
  announcements: "announcements.manage",
  audit: "audit.view",
  feedback: "feedback.manage",
  product: "product.manage",
  finance: "finance.manage",
} as const satisfies Record<string, Capability>;

const allCapabilities = Object.values(CAPABILITIES);

/**
 * Display-only mirror of the backend `ROLE_CAPABILITIES` (apps/accounts/permissions.py). It is never used to authorize
 * anything (the session reads the backend's `effective_capabilities`); the RBAC page uses it to draw the baseline matrix.
 */
export const ROLE_CAPABILITY_FALLBACK: Record<DashboardRole, Capability[]> = {
  it_support: ["*", ...allCapabilities],
  admin: [
    CAPABILITIES.dashboard,
    CAPABILITIES.users,
    CAPABILITIES.academic,
    CAPABILITIES.verification,
    CAPABILITIES.groups,
    CAPABILITIES.externalChannels,
    CAPABILITIES.files,
    CAPABILITIES.lectures,
    CAPABILITIES.printing,
    CAPABILITIES.support,
    CAPABILITIES.announcements,
    CAPABILITIES.audit,
    CAPABILITIES.feedback,
    CAPABILITIES.product,
    CAPABILITIES.finance,
  ],
  print_staff: [CAPABILITIES.dashboard, CAPABILITIES.printing],
  support_staff: [CAPABILITIES.dashboard, CAPABILITIES.support, CAPABILITIES.feedback],
  content_manager: [
    CAPABILITIES.dashboard,
    CAPABILITIES.academic,
    CAPABILITIES.groups,
    CAPABILITIES.externalChannels,
    CAPABILITIES.files,
    CAPABILITIES.lectures,
    CAPABILITIES.announcements,
  ],
};

export function hasCapability(capabilities: readonly string[] | undefined, capability?: string) {
  if (!capability) return true;
  return Boolean(capabilities?.includes("*") || capabilities?.includes(capability));
}

/** Whether a role holds a capability by default (before per-user overrides), mirroring the backend baseline. */
export function roleBaselineHas(role: DashboardRole, capability: string): boolean {
  const granted = ROLE_CAPABILITY_FALLBACK[role];
  return Boolean(granted?.includes("*") || granted?.includes(capability));
}
