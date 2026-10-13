/**
 * Client-side checks for mobile release policies that the backend would only reject late or not gracefully:
 * `product_one_active_release_per_platform` is a conditional unique constraint (an extra active row for a platform
 * is an integrity error, not a field error), and `update_mode = required` is meaningless without a minimum build.
 */
export interface ReleasePolicyLike {
  id?: unknown;
  platform?: unknown;
  is_active?: unknown;
  update_mode?: unknown;
  minimum_supported_build?: unknown;
  [key: string]: unknown;
}

export interface ReleaseProblem {
  field: string;
  /** `validation.*` message key with optional `:arg`. */
  message: string;
}

export function validateReleasePolicy(payload: Record<string, unknown>, entity: ReleasePolicyLike | null, rows: readonly ReleasePolicyLike[]): ReleaseProblem | null {
  const merged: ReleasePolicyLike = { ...(entity ?? {}), ...payload };
  const platform = String(merged.platform ?? "");
  if (merged.is_active !== false && platform) {
    const clash = rows.some((row) => row.is_active === true && String(row.platform) === platform && String(row.id) !== String(entity?.id ?? ""));
    if (clash) return { field: "is_active", message: `validation.activeRelease:${platform}` };
  }
  if (merged.update_mode === "required" && !(Number(merged.minimum_supported_build) > 0)) {
    return { field: "minimum_supported_build", message: "validation.requiredBuild" };
  }
  return null;
}
