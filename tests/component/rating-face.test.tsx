/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RatingFace, toRatingValue } from "@/components/shared/rating-face";
import { I18nProvider } from "@/i18n/provider";

afterEach(cleanup);

const ar = ["حزين جدًا", "سيئ", "مقبول", "جيد", "رائع"];
const en = ["Very sad", "Bad", "Okay", "Good", "Wonderful"];

describe("RatingFace", () => {
  it.each([1, 2, 3, 4, 5])("renders value %i with its Arabic word and accessible label", (value) => {
    render(<I18nProvider locale="ar"><RatingFace value={value} /></I18nProvider>);
    const face = screen.getByTestId("rating-face");
    expect(face.getAttribute("aria-label")).toBe(`التقييم: ${ar[value - 1]} (${value} من 5)`);
    expect(face.textContent).toBe(ar[value - 1]);
    expect(face.querySelector(`svg[data-rating="${value}"]`)).not.toBeNull();
  });

  it("uses English copy and can hide the word", () => {
    render(<I18nProvider locale="en"><RatingFace value={4} showLabel={false} /></I18nProvider>);
    const face = screen.getByTestId("rating-face");
    expect(face.getAttribute("aria-label")).toBe("Rating: Good (4 of 5)");
    expect(face.textContent).toBe("");
    expect(en).toHaveLength(5);
  });

  it("accepts numeric strings and rejects out-of-range values", () => {
    expect(toRatingValue("5")).toBe(5);
    expect(toRatingValue(3.8)).toBe(4);
    expect(toRatingValue(0)).toBeNull();
    expect(toRatingValue(9)).toBeNull();
    expect(toRatingValue(null)).toBeNull();
    render(<I18nProvider locale="ar"><RatingFace value={null} /></I18nProvider>);
    expect(screen.queryByTestId("rating-face")).toBeNull();
    expect(screen.getByLabelText("بلا تقييم").textContent).toBe("—");
  });
});
