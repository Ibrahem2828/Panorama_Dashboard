import { describe, expect, it } from "vitest";

import {
  activeCount, groupByLecture, isRevocable, maskDevice, normalizeState, offlineLicensesPath, revokeBody, revokeReasonKey,
  revokedCount, shouldShowReason, stateLabelKey, statePillValue, type OfflineLicenseRow,
} from "@/features/lectures/offline-license-rules";
import { ar, en } from "@/i18n/messages";

const row = (over: Partial<OfflineLicenseRow> = {}): OfflineLicenseRow => ({
  license_id: "l1", lecture_id: 1, lecture_title: "Lecture 1", user_id: 9, device: "abcdef1234567890",
  issued_at: "2026-11-01T10:00:00Z", expires_at: "2026-11-15T10:00:00Z", state: "active", revoked_at: null, revoke_reason: null, ...over,
});

describe("license state", () => {
  it("maps known states and treats anything else as expired", () => {
    expect(normalizeState("active")).toBe("active");
    expect(normalizeState("revoked")).toBe("revoked");
    expect(normalizeState("whatever")).toBe("expired");
    expect(normalizeState(null)).toBe("expired");
  });
  it("gives a label key and a pill colour per state", () => {
    expect(stateLabelKey("active")).toBe("offlineLicenses.state.active");
    expect(stateLabelKey("revoked")).toBe("offlineLicenses.state.revoked");
    expect(statePillValue("active")).toBe("active");
    expect(statePillValue("expired")).toBe("pending");
    expect(statePillValue("revoked")).toBe("blocked");
  });
  it("only revoked licenses are not revocable", () => {
    expect(isRevocable({ state: "active" })).toBe(true);
    expect(isRevocable({ state: "expired" })).toBe(true);
    expect(isRevocable({ state: "revoked" })).toBe(false);
  });
});

describe("revoke reasons", () => {
  it("has an Arabic and an English label for every known reason", () => {
    for (const reason of ["membership_ended", "access_lost", "lecture_unavailable", "lecture_replaced", "released_by_device", "revoked_by_staff", "device_replaced", "account_disabled", "expired"]) {
      const key = revokeReasonKey(reason);
      expect(key).toBe(`offlineLicenses.reason.${reason}`);
      expect(ar[key as keyof typeof ar]).toBeTruthy();
      expect(en[key as keyof typeof en]).toBeTruthy();
    }
  });
  it("returns null for unknown or empty reasons", () => {
    expect(revokeReasonKey("surprise")).toBeNull();
    expect(revokeReasonKey("")).toBeNull();
    expect(revokeReasonKey(undefined)).toBeNull();
  });
  it("shows the reason only for ended licenses", () => {
    expect(shouldShowReason({ state: "revoked", revoke_reason: "revoked_by_staff" })).toBe(true);
    expect(shouldShowReason({ state: "expired", revoke_reason: "expired" })).toBe(true);
    expect(shouldShowReason({ state: "active", revoke_reason: null })).toBe(false);
    expect(shouldShowReason({ state: "revoked", revoke_reason: null })).toBe(false);
  });
});

describe("device mask", () => {
  it("never shows more than 8 characters", () => {
    expect(maskDevice("abcdef1234567890")).toBe("abcdef12…");
    expect(maskDevice("abc")).toBe("abc…");
    expect(maskDevice("")).toBe("—");
    expect(maskDevice(null)).toBe("—");
  });
});

describe("grouping", () => {
  it("groups by lecture, newest first, with counts", () => {
    const groups = groupByLecture([
      row({ license_id: "a", issued_at: "2026-11-01T00:00:00Z" }),
      row({ license_id: "b", lecture_id: 2, lecture_title: "Two", state: "revoked" }),
      row({ license_id: "c", issued_at: "2026-11-05T00:00:00Z", state: "expired" }),
    ]);
    expect(groups.map((g) => g.lectureId)).toEqual([1, 2]);
    expect(groups[0].rows.map((r) => r.license_id)).toEqual(["c", "a"]);
    expect(groups[0]).toMatchObject({ revocable: 2, active: 1 });
    expect(groups[1]).toMatchObject({ revocable: 0, active: 0 });
  });
  it("is empty for no rows and counts active licenses", () => {
    expect(groupByLecture([])).toEqual([]);
    expect(activeCount([row(), row({ state: "revoked" }), row({ state: "expired" })])).toBe(1);
  });
});

describe("requests", () => {
  it("builds the revoke body with or without a lecture", () => {
    expect(revokeBody(5)).toEqual({ user_id: 5 });
    expect(revokeBody(5, 8)).toEqual({ user_id: 5, lecture_id: 8 });
  });
  it("reads the revoked count from plain or enveloped payloads", () => {
    expect(revokedCount({ revoked: 3 })).toBe(3);
    expect(revokedCount({ data: { revoked: 2 } })).toBe(2);
    expect(revokedCount(null)).toBe(0);
    expect(revokedCount({ revoked: "x" })).toBe(0);
  });
  it("builds the list path with the given filters only", () => {
    expect(offlineLicensesPath({ user: 4 })).toBe("/api/v1/dashboard/lectures/offline-licenses/?user=4");
    expect(offlineLicensesPath({ lecture: 7 })).toBe("/api/v1/dashboard/lectures/offline-licenses/?lecture=7");
    expect(offlineLicensesPath({ user: 4, lecture: 7 })).toBe("/api/v1/dashboard/lectures/offline-licenses/?user=4&lecture=7");
  });
});
