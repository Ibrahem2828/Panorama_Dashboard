import { describe, expect, it } from "vitest";

import { faceCells, parseItemOptions, printerSettings, sheetGrid, sheetsPerCopy } from "@/features/printing/print-options";
import { cartTotal, changeQuantity, type SellableItem } from "@/features/shop/shop-rules";

describe("parseItemOptions", () => {
  it("reads what the customer asked for", () => {
    expect(parseItemOptions({
      pages_per_sheet: 4, duplex_flip: "short_edge", orientation: "landscape", n_up_direction: "rtl", page_range: " 1-5, 8 ",
      selected_pages: 6, collate: false, cover: "navy", pricing_snapshot: { wire_grams_per_copy: "25.00", binding_kind: "spiral" },
    })).toMatchObject({ pagesPerSheet: 4, duplexFlip: "short_edge", orientation: "landscape", nUpDirection: "rtl", pageRange: "1-5, 8", selectedPages: 6, collate: false, cover: "navy", wireGrams: "25.00", bindingKind: "spiral" });
  });

  it("falls back to the old behaviour for orders made before these options existed", () => {
    expect(parseItemOptions({ copies: 2 })).toMatchObject({ pagesPerSheet: 1, duplexFlip: "long_edge", orientation: "auto", nUpDirection: "ltr", pageRange: "", selectedPages: null, collate: true, cover: "", wireGrams: null });
  });

  it("ignores values it does not know", () => {
    expect(parseItemOptions({ pages_per_sheet: 3, duplex_flip: "diagonal", orientation: 5, selected_pages: -1 })).toMatchObject({ pagesPerSheet: 1, duplexFlip: "long_edge", orientation: "auto", selectedPages: null });
  });
});

describe("sheet geometry (same formula as the server)", () => {
  it.each([[1, "auto", 1, 1, false], [2, "auto", 2, 1, true], [4, "auto", 2, 2, false], [6, "auto", 3, 2, true], [9, "auto", 3, 3, false], [16, "auto", 4, 4, false], [2, "portrait", 1, 2, false]] as const)(
    "%i per sheet (%s)", (perSheet, orientation, columns, rows, landscape) => {
      expect(sheetGrid(perSheet, orientation)).toEqual({ columns, rows, landscape });
    });

  it.each([[10, 1, false, 10], [10, 1, true, 5], [11, 1, true, 6], [12, 4, true, 2], [13, 4, true, 2], [17, 4, true, 3], [0, 4, true, 0]])(
    "%i pages, %i per sheet, double=%s -> %i sheets", (pages, perSheet, double, expected) => {
      expect(sheetsPerCopy(pages, perSheet, double)).toBe(expected);
    });

  it("places pages row by row, from the right for a right-to-left grid", () => {
    const grid = sheetGrid(4, "auto");
    expect(faceCells([1, 2, 3, 4], grid, "ltr")).toEqual([1, 2, 3, 4]);
    expect(faceCells([1, 2, 3, 4], grid, "rtl")).toEqual([2, 1, 4, 3]);
    expect(faceCells([1], grid, "ltr")).toEqual([1, null, null, null]);
  });
});

describe("printerSettings", () => {
  const options = parseItemOptions({ duplex_flip: "short_edge" });
  it("tells the cashier which printer settings give the ordered result and that the file is printed once", () => {
    expect(printerSettings({ sides: "double_sided", colorMode: "color", paperSize: "A4" }, options)).toEqual({ duplex: "short_edge", color: "color", paper: "A4", copies: 1 });
    expect(printerSettings({ sides: "one_sided", colorMode: "black_white", paperSize: "A3" }, options)).toEqual({ duplex: "off", color: "mono", paper: "A3", copies: 1 });
  });
});

const pen: SellableItem = { id: 1, name: "قلم", sku: "", unit: "piece", quantity: "3", sale_price: "500.00", currency: "SYP" };
const book: SellableItem = { id: 2, name: "دفتر", sku: "", unit: "piece", quantity: "0", sale_price: "3500.50", currency: "SYP" };

describe("shop cart", () => {
  it("never goes above the shelf or below one piece", () => {
    let cart = changeQuantity([], pen, 1);
    cart = changeQuantity(cart, pen, 1);
    cart = changeQuantity(cart, pen, 1);
    cart = changeQuantity(cart, pen, 1);
    expect(cart).toEqual([{ item: pen, quantity: 3 }]);
    cart = changeQuantity(cart, pen, -3);
    expect(cart).toEqual([]);
  });

  it("does not add an item that is out of stock", () => {
    expect(changeQuantity([], book, 1)).toEqual([]);
  });

  it("totals in whole cents", () => {
    expect(cartTotal([{ item: pen, quantity: 2 }, { item: { ...book, quantity: "5" }, quantity: 1 }])).toBe("4500.50");
    expect(cartTotal([{ item: { ...pen, sale_price: "0.10" }, quantity: 3 }])).toBe("0.30");
  });
});

import { itemBody, lineProblems, lineSheets, newLine } from "@/features/printing/counter-order-rules";

describe("counter line for a ready product", () => {
  it("sends only the product and the copies, and needs no page count", () => {
    const line = { ...newLine(), productId: 7, productName: "دفتر تشريح", copies: "2" };
    expect(itemBody(line)).toEqual({ product: 7, copies: 2 });
    expect(lineProblems(line)).toEqual({});
    expect(lineSheets(line)).toBeNull();
  });

  it("still checks the copies", () => {
    expect(lineProblems({ ...newLine(), productId: 7, copies: "0" })).toEqual({ copies: true });
  });

  it("an ordinary line is unchanged", () => {
    expect(lineProblems(newLine())).toMatchObject({ pages: true });
  });
});
