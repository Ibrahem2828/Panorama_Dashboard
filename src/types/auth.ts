// The backend's effective capabilities, not this descriptive role string, are
// authoritative for dashboard access. Keep the received role opaque so a new
// backend role with dashboard.access is not rejected by a stale frontend enum.
export type DashboardRole = string;
export type Capability = string;

export interface SessionUser {
  id: number;
  full_name: string;
  email: string;
  role: DashboardRole;
  is_active: boolean;
  effective_capabilities?: unknown;
  locale?: "ar" | "en";
  phone_number?: string;
}

export interface DashboardSession {
  authenticated: true;
  user: SessionUser;
  role: DashboardRole;
  capabilities: string[];
  effectiveCapabilities: string[];
  source: "backend" | "development-fallback";
  capabilitySource: "backend" | "development-fallback";
  locale?: "ar" | "en";
}

export interface AuthTokens { access: string; refresh: string; }
export type User = SessionUser;
export type LoginRequest = { email: string; password: string };
