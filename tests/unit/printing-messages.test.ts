import { describe, expect, it } from "vitest";

import { printingAr, printingEn } from "@/features/printing/printing-messages";
import { ar, en } from "@/i18n/messages";

describe("printing messages", () => {
  it("have the same keys in Arabic and English", () => {
    expect(Object.keys(printingEn).sort()).toEqual(Object.keys(printingAr).sort());
  });
  it("are part of both dictionaries and keep the same placeholders", () => {
    for (const key of Object.keys(printingAr) as (keyof typeof printingAr)[]) {
      expect(ar[key]).toBe(printingAr[key]);
      expect(en[key]).toBe(printingEn[key]);
      const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
      expect(placeholders(printingEn[key]), key).toEqual(placeholders(printingAr[key]));
      expect(printingAr[key].trim(), key).not.toBe("");
    }
  });
  it("write the Arabic copy in Arabic", () => {
    for (const [key, text] of Object.entries(printingAr)) expect(/[؀-ۿ]/u.test(text), key).toBe(true);
  });
});
