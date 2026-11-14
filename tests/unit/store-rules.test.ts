import { describe, expect, it } from "vitest";

import {
  EMPTY_BRAND, EMPTY_CATEGORY, EMPTY_PRODUCT, EMPTY_VARIANT, IMAGE_MAX_BYTES, ORDER_STATUSES, allowedTransitions, brandFields, brandMultipart, canCancelOrder, canTransition,
  categoryFields, cleanSpecs, effectivePrice, forwardStatus, hasNoPrice, imageProblem, imageUploadFields, isFinalStatus, isHexColour, isOpenStatus, nextImageSort, openOrderId,
  openOrdersCount, orderQuery, orderedImages, priceProblem, priceValue, productBody, reasonProblem, reorderImages, resolveHiddenFilter, resolveOrderStatus, reviewQuery,
  sortedHistory, statusBody, statusLabelKey, statusTone, stockAfter, stockBody, stockDelta, stockLevel, stockProblem, storeErrorKey, storeImageSrc, storePath, storeTabHref,
  suggestSlug, validateBrand, validateCategory, validateProduct, validateVariant, variantBody, variantLabel,
} from "@/features/store/store-rules";

describe("store paths", () => {
  it("end with a slash and encode the id", () => {
    expect(storePath("orders")).toBe("/api/v1/dashboard/store/orders/");
    expect(storePath("orders", 7, "status")).toBe("/api/v1/dashboard/store/orders/7/status/");
    expect(storePath("variants", "a/b")).toBe("/api/v1/dashboard/store/variants/a%2Fb/");
    expect(storePath("summary")).toBe("/api/v1/dashboard/store/summary/");
  });
});

describe("order status flow", () => {
  it("allows exactly the backend transitions", () => {
    expect(allowedTransitions("pending")).toEqual(["confirmed", "cancelled"]);
    expect(allowedTransitions("confirmed")).toEqual(["ready_for_pickup", "cancelled"]);
    expect(allowedTransitions("ready_for_pickup")).toEqual(["picked_up", "cancelled"]);
    expect(allowedTransitions("picked_up")).toEqual([]);
    expect(allowedTransitions("cancelled")).toEqual([]);
    expect(allowedTransitions("something_else")).toEqual([]);
  });
  it("never skips a step", () => {
    expect(canTransition("pending", "ready_for_pickup")).toBe(false);
    expect(canTransition("pending", "picked_up")).toBe(false);
    expect(canTransition("confirmed", "picked_up")).toBe(false);
    expect(canTransition("picked_up", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
  });
  it("offers one forward step and a cancel while the order is open", () => {
    expect(forwardStatus("pending")).toBe("confirmed");
    expect(forwardStatus("confirmed")).toBe("ready_for_pickup");
    expect(forwardStatus("ready_for_pickup")).toBe("picked_up");
    expect(forwardStatus("picked_up")).toBeNull();
    expect(forwardStatus("cancelled")).toBeNull();
    expect(["pending", "confirmed", "ready_for_pickup"].every(canCancelOrder)).toBe(true);
    expect(canCancelOrder("picked_up")).toBe(false);
  });
  it("knows final and open statuses", () => {
    expect(isFinalStatus("picked_up")).toBe(true);
    expect(isFinalStatus("cancelled")).toBe(true);
    expect(isFinalStatus("pending")).toBe(false);
    expect(ORDER_STATUSES.filter(isOpenStatus)).toEqual(["pending", "confirmed", "ready_for_pickup"]);
  });
  it("labels and tones every status, with a safe fallback", () => {
    for (const status of ORDER_STATUSES) expect(statusLabelKey(status)).toBe(`store.status.${status}`);
    expect(statusLabelKey("weird")).toBe("store.status.unknown");
    expect(statusTone("pending")).toBe("warning");
    expect(statusTone("cancelled")).toBe("danger");
    expect(statusTone("weird")).toBe("muted");
  });
  it("sorts the history oldest first", () => {
    const sorted = sortedHistory([
      { old_status: "confirmed", new_status: "ready_for_pickup", note: "", created_at: "2026-11-02T10:00:00Z" },
      { old_status: "pending", new_status: "confirmed", note: "", created_at: "2026-11-01T10:00:00Z" },
      { old_status: "", new_status: "x", note: "", created_at: "not a date" },
    ]);
    expect(sorted.map((entry) => entry.new_status)).toEqual(["confirmed", "ready_for_pickup", "x"]);
    expect(sortedHistory(undefined)).toEqual([]);
  });
  it("sends the reason only when cancelling", () => {
    expect(statusBody("cancelled", "  out of stock ")).toEqual({ status: "cancelled", reason: "out of stock", note: "" });
    expect(statusBody("confirmed", "ignored")).toEqual({ status: "confirmed", reason: "", note: "" });
  });
  it("requires a reason of at most 255 characters", () => {
    expect(reasonProblem("   ")).toBe("required");
    expect(reasonProblem("x".repeat(256))).toBe("tooLong");
    expect(reasonProblem("x".repeat(255))).toBeNull();
  });
  it("maps backend error codes to sentences", () => {
    expect(storeErrorKey("INVALID_TRANSITION")).toBe("store.error.INVALID_TRANSITION");
    expect(storeErrorKey("in_use")).toBe("store.error.IN_USE");
    expect(storeErrorKey("NOPE")).toBeNull();
    expect(storeErrorKey(undefined)).toBeNull();
  });
});

describe("prices", () => {
  it("accepts blank (not sold) and positive amounts with up to two decimals", () => {
    expect(priceProblem("")).toBeNull();
    expect(priceProblem("  ")).toBeNull();
    expect(priceProblem("12500")).toBeNull();
    expect(priceProblem("3.5")).toBeNull();
    expect(priceProblem("3.50")).toBeNull();
  });
  it("refuses bad ones", () => {
    expect(priceProblem("abc")).toBe("invalid");
    expect(priceProblem("-1")).toBe("invalid");
    expect(priceProblem("1,5")).toBe("invalid");
    expect(priceProblem("1.234")).toBe("tooMany");
    expect(priceProblem("0")).toBe("nonPositive");
    expect(priceProblem("0.00")).toBe("nonPositive");
    expect(priceProblem("99999999999")).toBe("tooLarge");
  });
  it("sends null for a blank price and the effective price falls back to the product", () => {
    expect(priceValue(" ")).toBeNull();
    expect(priceValue(" 4.50 ")).toBe("4.50");
    expect(effectivePrice("5.00", "4.00")).toBe("5.00");
    expect(effectivePrice(null, "4.00")).toBe("4.00");
    expect(effectivePrice(null, null)).toBeNull();
  });
  it("validates colours", () => {
    expect(isHexColour("#1A2b3C")).toBe(true);
    expect(isHexColour("1A2B3C")).toBe(false);
    expect(isHexColour("#12345")).toBe(false);
  });
});

describe("image addresses", () => {
  it("go through the BFF and keep the cache buster and thumb variant", () => {
    expect(storeImageSrc("https://api.example.com/api/v1/store/images/12/?v=1731000000&variant=thumb")).toBe("/api/backend/api/v1/store/images/12/?v=1731000000&variant=thumb");
    expect(storeImageSrc("/api/v1/store/images/12/?v=5")).toBe("/api/backend/api/v1/store/images/12/?v=5");
    expect(storeImageSrc("/api/v1/store/images/12/")).toBe("/api/backend/api/v1/store/images/12/");
    expect(storeImageSrc("/api/v1/store/brands/3/logo/?v=9")).toBe("/api/backend/api/v1/store/brands/3/logo/?v=9");
  });
  it("drops an unsafe cache buster and an unknown variant", () => {
    expect(storeImageSrc("/api/v1/store/images/12/?v=a%20b&variant=huge")).toBe("/api/backend/api/v1/store/images/12/");
    expect(storeImageSrc("/api/v1/store/brands/3/logo/?variant=thumb")).toBe("/api/backend/api/v1/store/brands/3/logo/");
  });
  it("maps nothing that is not a store picture", () => {
    expect(storeImageSrc(null)).toBeNull();
    expect(storeImageSrc("")).toBeNull();
    expect(storeImageSrc("https://evil.example/x.png")).toBeNull();
    expect(storeImageSrc("/media/store/a.png")).toBeNull();
    expect(storeImageSrc("/api/v1/store/images/abc/")).toBeNull();
    expect(storeImageSrc("/api/v1/store/images/1/../../x/")).toBeNull();
    expect(storeImageSrc("/api/v1/store/brands/3/")).toBeNull();
    expect(storeImageSrc("/api/v1/store/images/3/logo/")).toBeNull();
  });
  it("validates uploads: type and 5 MB", () => {
    expect(imageProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(imageProblem({ type: "image/webp", size: IMAGE_MAX_BYTES })).toBeNull();
    expect(imageProblem({ type: "image/gif", size: 1000 })).toBe("type");
    expect(imageProblem({ type: "application/pdf", size: 1000 })).toBe("type");
    expect(imageProblem({ type: "image/jpeg", size: IMAGE_MAX_BYTES + 1 })).toBe("size");
    expect(imageProblem({ type: "image/jpeg", size: 0 })).toBe("size");
  });
  it("always sends is_primary and alt_text in the multipart fields", () => {
    const fields = Object.fromEntries(imageUploadFields({ product: 4, sortOrder: 2, isPrimary: false }));
    expect(fields).toEqual({ product: "4", alt_text: "", sort_order: "2", is_primary: "false" });
    expect(Object.fromEntries(imageUploadFields({ product: 4, variant: 9, altText: " Pen ", sortOrder: -3, isPrimary: true }))).toEqual({ product: "4", alt_text: "Pen", sort_order: "0", is_primary: "true", variant: "9" });
  });
  it("orders a gallery with the primary first and computes reorder moves", () => {
    const images = [{ id: 3, sort_order: 1, is_primary: false }, { id: 1, sort_order: 5, is_primary: true }, { id: 2, sort_order: 0, is_primary: false }];
    expect(orderedImages(images).map((image) => image.id)).toEqual([1, 2, 3]);
    expect(reorderImages([1, 2, 3], 3, 2)).toEqual([[3, 1], [2, 2]]);
    expect(reorderImages([1, 2, 3], 2, 2)).toEqual([]);
    expect(reorderImages([1, 2, 3], 9, 2)).toEqual([]);
    expect(nextImageSort([])).toBe(0);
    expect(nextImageSort([{ sort_order: 4 }, { sort_order: 2 }])).toBe(5);
  });
});

describe("brand and category forms", () => {
  it("validates the brand", () => {
    expect(validateBrand(EMPTY_BRAND)).toEqual({ name: "required" });
    expect(validateBrand({ ...EMPTY_BRAND, name: "x".repeat(101) })).toEqual({ name: "tooLong" });
    expect(validateBrand({ ...EMPTY_BRAND, name: "Pilot", sortOrder: "-1" })).toEqual({ sortOrder: "invalid" });
    expect(validateBrand({ ...EMPTY_BRAND, name: "Pilot" })).toEqual({});
  });
  it("sends JSON unless the logo changes, and always sends is_active in multipart", () => {
    const form = { name: " Pilot ", sortOrder: "3", isActive: true };
    expect(brandFields(form)).toEqual({ name: "Pilot", sort_order: 3, is_active: true });
    expect(brandMultipart(form, { kind: "keep" })).toBeNull();
    expect(brandMultipart({ ...form, isActive: false }, { kind: "remove" })).toEqual([["name", "Pilot"], ["sort_order", "3"], ["is_active", "false"], ["logo", ""]]);
    const file = new File(["x"], "logo.png", { type: "image/png" });
    expect(brandMultipart(form, { kind: "replace", file })?.at(-1)).toEqual(["logo", file]);
  });
  it("validates the category and suggests a slug", () => {
    expect(validateCategory(EMPTY_CATEGORY)).toEqual({ name: "required", slug: "required" });
    expect(validateCategory({ ...EMPTY_CATEGORY, name: "أقلام", slug: "اقلام" })).toEqual({ slug: "invalid" });
    expect(validateCategory({ ...EMPTY_CATEGORY, name: "أقلام", slug: "pens_2-a" })).toEqual({});
    expect(suggestSlug(" Ball  Pens! ")).toBe("ball-pens");
    expect(suggestSlug("أقلام")).toBe("");
    expect(categoryFields({ name: " A ", slug: " a ", sortOrder: "", isActive: false })).toEqual({ name: "A", slug: "a", sort_order: 0, is_active: false });
  });
});

describe("product form", () => {
  const valid = { ...EMPTY_PRODUCT, name: "قلم حبر", category: "2" };
  it("needs a name and a category", () => {
    expect(validateProduct(EMPTY_PRODUCT)).toEqual({ name: "required", category: "required" });
    expect(validateProduct({ ...valid, name: "x".repeat(151) })).toEqual({ name: "tooLong" });
    expect(validateProduct(valid)).toEqual({});
  });
  it("checks prices and the sort order", () => {
    expect(validateProduct({ ...valid, priceSyp: "abc", priceUsd: "0", sortOrder: "99999" })).toEqual({ priceSyp: "invalid", priceUsd: "nonPositive", sortOrder: "invalid" });
  });
  it("drops blank spec rows and flags half-filled or oversized ones", () => {
    expect(cleanSpecs([{ label: " ", value: "" }, { label: " Tip ", value: " 0.7 " }])).toEqual([{ label: "Tip", value: "0.7" }]);
    expect(validateProduct({ ...valid, specs: [{ label: "", value: "" }] })).toEqual({});
    expect(validateProduct({ ...valid, specs: [{ label: "Tip", value: "" }] })).toEqual({ specs: "incomplete" });
    expect(validateProduct({ ...valid, specs: [{ label: "x".repeat(61), value: "v" }] })).toEqual({ specs: "tooLong" });
    expect(validateProduct({ ...valid, specs: Array.from({ length: 21 }, (_, i) => ({ label: `a${i}`, value: "b" })) })).toEqual({ specs: "tooMany" });
  });
  it("builds the request body with nulls for what is empty", () => {
    expect(productBody({ ...valid, brand: "", priceSyp: " 12500 ", priceUsd: "", specs: [{ label: "A", value: "B" }, { label: "", value: "" }], sortOrder: "" })).toEqual({
      name: "قلم حبر", description: "", brand: null, category: 2, specs: [{ label: "A", value: "B" }], price_syp: "12500", price_usd: null, is_active: true, sort_order: 0,
    });
    expect(productBody({ ...valid, brand: "5" }).brand).toBe(5);
  });
  it("warns when no currency has a price", () => {
    expect(hasNoPrice(EMPTY_PRODUCT)).toBe(true);
    expect(hasNoPrice({ priceSyp: "", priceUsd: "1" })).toBe(false);
  });
});

describe("variant form", () => {
  it("accepts the empty plain variant and validates the rest", () => {
    expect(validateVariant(EMPTY_VARIANT, true)).toEqual({});
    expect(validateVariant({ ...EMPTY_VARIANT, colourHex: "red" }, true)).toEqual({ colourHex: "invalid" });
    expect(validateVariant({ ...EMPTY_VARIANT, priceSyp: "-5", maxPerOrder: "0" }, true)).toEqual({ priceSyp: "invalid", maxPerOrder: "invalid" });
    expect(validateVariant({ ...EMPTY_VARIANT, initialStock: "1.5", reorderLevel: "x" }, true)).toEqual({ initialStock: "invalid", reorderLevel: "invalid" });
    expect(validateVariant({ ...EMPTY_VARIANT, sku: "x".repeat(65), colourName: "y".repeat(51) }, false)).toEqual({ sku: "tooLong", colourName: "tooLong" });
  });
  it("ignores the initial stock when editing", () => {
    expect(validateVariant({ ...EMPTY_VARIANT, initialStock: "abc" }, false)).toEqual({});
  });
  it("sends initial_stock on create only and always sends reorder_level and is_active", () => {
    const form = { ...EMPTY_VARIANT, sku: " P-1 ", colourName: "Blue", colourHex: "#1a2b3c", sizeLabel: "0.7", priceSyp: "9000", initialStock: "12", reorderLevel: "3", maxPerOrder: "10" };
    expect(variantBody(form, 4, true)).toEqual({
      product: 4, sku: "P-1", colour_name: "Blue", colour_hex: "#1A2B3C", size_label: "0.7", price_syp: "9000", price_usd: null, max_per_order: 10, is_active: true, sort_order: 0, reorder_level: 3, initial_stock: 12,
    });
    const edited = variantBody({ ...form, isActive: false }, 4, false);
    expect(edited).not.toHaveProperty("initial_stock");
    expect(edited).toMatchObject({ is_active: false, reorder_level: 3 });
  });
  it("labels a variant by colour and size", () => {
    expect(variantLabel({ colour_name: "Blue", size_label: "0.7" })).toBe("Blue / 0.7");
    expect(variantLabel({ colour_name: "", size_label: "A4" })).toBe("A4");
    expect(variantLabel({})).toBe("");
  });
});

describe("stock movements", () => {
  it("signs the change by movement type", () => {
    expect(stockDelta("purchase", 5)).toBe(5);
    expect(stockDelta("waste", 5)).toBe(-5);
    expect(stockDelta("adjustment", -3)).toBe(-3);
    expect(stockDelta("adjustment", 4)).toBe(4);
  });
  it("validates the quantity per type", () => {
    expect(stockProblem("purchase", "10")).toBeNull();
    expect(stockProblem("purchase", "")).toBe("invalid");
    expect(stockProblem("purchase", "1.5")).toBe("invalid");
    expect(stockProblem("purchase", "0")).toBe("zero");
    expect(stockProblem("purchase", "-2")).toBe("negative");
    expect(stockProblem("waste", "-2")).toBe("negative");
    expect(stockProblem("adjustment", "-2")).toBeNull();
    expect(stockProblem("adjustment", "-0")).toBe("zero");
    expect(stockProblem("purchase", "100001")).toBe("tooLarge");
  });
  it("previews the shelf after the movement", () => {
    expect(stockAfter(10, "purchase", "5")).toBe(15);
    expect(stockAfter(10, "waste", "4")).toBe(6);
    expect(stockAfter(10, "adjustment", "-12")).toBe(-2);
    expect(stockAfter(10, "waste", "")).toBeNull();
  });
  it("builds the body with a trimmed, capped note", () => {
    expect(stockBody("adjustment", " -3 ", "  recount ")).toEqual({ movement_type: "adjustment", quantity: -3, note: "recount" });
    expect(stockBody("purchase", "5", "x".repeat(400)).note).toHaveLength(255);
  });
  it("classifies the shelf level", () => {
    expect(stockLevel(0, 5)).toBe("out");
    expect(stockLevel(-1, 0)).toBe("out");
    expect(stockLevel(5, 5)).toBe("low");
    expect(stockLevel(6, 5)).toBe("ok");
    expect(stockLevel(1, 0)).toBe("ok");
  });
});

describe("filters and links", () => {
  it("resolves the order status tab", () => {
    expect(resolveOrderStatus("pending")).toBe("pending");
    expect(resolveOrderStatus("bogus")).toBe("all");
    expect(resolveOrderStatus(null)).toBe("all");
  });
  it("builds the order query without unknown statuses or inverted ranges", () => {
    const base = { status: "all", q: "", from: "", to: "", page: 2, pageSize: 25 };
    expect(orderQuery(base).toString()).toBe("page=2&page_size=25");
    const full = orderQuery({ ...base, status: "pending", q: "  ST-000012 ", from: "2026-11-01", to: "2026-11-05" });
    expect(Object.fromEntries(full)).toEqual({ page: "2", page_size: "25", status: "pending", q: "ST-000012", from: "2026-11-01", to: "2026-11-05" });
    const inverted = orderQuery({ ...base, from: "2026-11-09", to: "2026-11-01" });
    expect(inverted.has("from") || inverted.has("to")).toBe(false);
    expect(orderQuery({ ...base, status: "bogus" }).has("status")).toBe(false);
    expect(orderQuery({ ...base, q: "a".repeat(100) }).get("q")).toHaveLength(60);
  });
  it("builds the review query", () => {
    expect(resolveHiddenFilter("hidden")).toBe("hidden");
    expect(resolveHiddenFilter("zzz")).toBe("all");
    const params = (input: Parameters<typeof reviewQuery>[0]) => Object.fromEntries(reviewQuery(input));
    expect(params({ hidden: "all", rating: "", product: "", page: 1, pageSize: 25 })).toEqual({ page: "1", page_size: "25" });
    expect(params({ hidden: "hidden", rating: "4", product: "9", page: 1, pageSize: 25 })).toMatchObject({ is_hidden: "true", rating: "4", product: "9" });
    expect(params({ hidden: "visible", rating: "9", product: "x", page: 1, pageSize: 25 })).toEqual({ page: "1", page_size: "25", is_hidden: "false" });
  });
  it("reads the order to open from ?order or the notification's ?highlight", () => {
    const params = (text: string) => new URLSearchParams(text);
    expect(openOrderId(params("highlight=15"))).toBe(15);
    expect(openOrderId(params("order=7&highlight=15"))).toBe(7);
    expect(openOrderId(params("order=abc"))).toBeNull();
    expect(openOrderId(params(""))).toBeNull();
  });
  it("builds links to the store screens", () => {
    expect(storeTabHref("ar", "overview")).toBe("/ar/dashboard/store");
    expect(storeTabHref("en", "orders", { status: "pending" })).toBe("/en/dashboard/store/orders?status=pending");
    expect(storeTabHref("ar", "products", { variant: 12 })).toBe("/ar/dashboard/store/products?variant=12");
  });
  it("counts the orders that still need the desk", () => {
    expect(openOrdersCount(undefined)).toBe(0);
    expect(openOrdersCount({ orders_by_status: { pending: 2, confirmed: 1, ready_for_pickup: 3, picked_up: 40, cancelled: 5 } })).toBe(6);
  });
});
