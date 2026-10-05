/**
 * Legacy callers must use the BFF session query. This module intentionally has
 * no browser-token implementation and reports no persisted client session.
 */
export function hasValidDashboardSession() {
  return false;
}

export function clearInvalidSession() {}
