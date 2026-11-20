import { describe, expect, it } from "vitest";

import { storeAr, storeEn } from "@/features/store/store-messages";
import { ar, en } from "@/i18n/messages";

describe("store messages", () => {
  it("have the same keys in Arabic and English", () => {
    expect(Object.keys(storeEn).sort()).toEqual(Object.keys(storeAr).sort());
  });
  it("are part of both dictionaries and keep the same placeholders", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
    for (const key of Object.keys(storeAr) as (keyof typeof storeAr)[]) {
      expect(ar[key]).toBe(storeAr[key]);
      expect(en[key]).toBe(storeEn[key]);
      expect(placeholders(storeEn[key]), key).toEqual(placeholders(storeAr[key]));
      expect(storeAr[key].trim(), key).not.toBe("");
      expect(storeEn[key].trim(), key).not.toBe("");
    }
  });
  it("write the Arabic copy in Arabic", () => {
    for (const [key, text] of Object.entries(storeAr)) expect(/[؀-ۿ]/u.test(text), key).toBe(true);
  });
  it("name every order status, action and server error the screens can show", () => {
    for (const status of ["pending", "confirmed", "ready_for_pickup", "picked_up", "cancelled", "unknown"]) expect(storeAr).toHaveProperty(`store.status.${status}`);
    for (const status of ["confirmed", "ready_for_pickup", "picked_up", "cancelled"]) expect(storeAr).toHaveProperty(`store.action.${status}`);
    for (const code of ["INVALID_TRANSITION", "IN_USE", "INSUFFICIENT_STOCK", "ORDER_NOT_CANCELLABLE", "VALIDATION_ERROR"]) expect(storeAr).toHaveProperty(`store.error.${code}`);
  });
});
