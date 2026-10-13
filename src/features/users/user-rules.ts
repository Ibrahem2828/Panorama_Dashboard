/**
 * Who may act on whom, mirrored from the backend (apps/accounts/permissions.py and dashboard_serializers.py) so the UI
 * only offers actions the backend will accept. The backend stays authoritative and returns 403/400 otherwise.
 */
export const ALL_ROLES = ["it_support", "admin", "print_staff", "support_staff", "content_manager", "student", "normal_user"] as const;
export type UserRole = (typeof ALL_ROLES)[number];

const ROLE_RANK: Record<string, number> = { it_support: 100, admin: 50 };
const DEFAULT_ROLE_RANK = 10;

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? DEFAULT_ROLE_RANK;
}

/** IT Support manages everyone; anyone else only strictly lower ranks (`actor_outranks`). */
export function actorOutranks(actorRole: string, targetRole: string): boolean {
  return actorRole === "it_support" || roleRank(targetRole) < roleRank(actorRole);
}

/** Roles the actor may assign: IT Support any; otherwise only roles ranked below the actor's own (`validate_role`). */
export function assignableRoles(actorRole: string): UserRole[] {
  if (actorRole === "it_support") return [...ALL_ROLES];
  return ALL_ROLES.filter((role) => roleRank(role) < roleRank(actorRole));
}

export interface UserRef {
  id: number;
  role: string;
  is_active?: boolean;
}

export interface Actor {
  id: number;
  role: string;
}

/** PATCH full_name/role needs rank over the target (so only IT Support can edit its own row; the role stays locked there). */
export function canEditUser(actor: Actor, target: UserRef): boolean {
  return actorOutranks(actor.role, target.role);
}

export function canChangeRole(actor: Actor, target: UserRef): boolean {
  return actor.id !== target.id && actorOutranks(actor.role, target.role);
}

/** Deactivating: not yourself, and rank over the target (the "last IT Support" guard is enforced by the backend). */
export function canDeactivateUser(actor: Actor, target: UserRef): boolean {
  return target.is_active !== false && actor.id !== target.id && actorOutranks(actor.role, target.role);
}

/** Clearing a failed-login lockout: same rank rule as deactivating, never on yourself (the list exposes no lockout flag). */
export function canUnlockLogin(actor: Actor, target: UserRef): boolean {
  return actor.id !== target.id && actorOutranks(actor.role, target.role);
}

export function canActivateUser(actor: Actor, target: UserRef): boolean {
  return target.is_active === false && actorOutranks(actor.role, target.role);
}
