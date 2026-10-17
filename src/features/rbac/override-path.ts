/** Path of one permission override: `DELETE` on it removes the override (no request body). */
export function permissionOverridePath(userId: string | number, permissionCode: string): string {
  return `/api/v1/dashboard/users/${encodeURIComponent(String(userId))}/permission-overrides/${encodeURIComponent(permissionCode)}/`;
}
