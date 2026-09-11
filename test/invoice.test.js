import { describe, it, expect } from "vitest";
import { calculateInvoice } from "../src/invoiceCalculator.js";
import { getTenantConfig } from "../src/customerConfig.js";

const items = (...pairs) => pairs.map(([qty, rate]) => ({ qty, rate }));
const round2 = (n) => Math.round(n * 100) / 100;

describe("invoice — shape and totals", () => {
  it("returns base, discount, taxable, gst and total", () => {
    const r = calculateInvoice(items([2, 100]), { gstPercent: 18, discountPercent: 10 });
    expect(Object.keys(r).sort()).toEqual(["base", "discount", "gst", "taxable", "total"]);
  });

  it("computes base as the sum of qty × rate", () => {
    const r = calculateInvoice(items([2, 100], [3, 50]), { gstPercent: 18 });
    expect(r.base).toBe(350);
  });

  it("returns a base of 0 for an empty invoice", () => {
    expect(calculateInvoice([], { gstPercent: 18 }).base).toBe(0);
  });

  it("keeps taxable equal to base minus discount", () => {
    const r = calculateInvoice(items([10, 100]), { gstPercent: 18, discountPercent: 10 });
    expect(r.taxable).toBe(r.base - r.discount);
  });

  it("keeps total equal to taxable plus gst", () => {
    const r = calculateInvoice(items([10, 100]), { gstPercent: 18, discountPercent: 10 });
    expect(round2(r.total)).toBe(round2(r.taxable + r.gst));
  });

  it("handles a single line item", () => {
    const r = calculateInvoice(items([1, 1000]), { gstPercent: 18 });
    expect(r.base).toBe(1000);
    expect(round2(r.gst)).toBe(180);
  });

  it("handles many line items", () => {
    const r = calculateInvoice(items([1, 10], [2, 20], [3, 30], [4, 40]), { gstPercent: 18 });
    expect(r.base).toBe(300);
  });

  it("handles fractional rates", () => {
    const r = calculateInvoice(items([3, 33.33]), { gstPercent: 18 });
    expect(round2(r.base)).toBe(99.99);
  });

  it("applies no discount when tenantConfig is absent", () => {
    expect(calculateInvoice(items([1, 100])).discount).toBe(0);
  });

  it("does not throw when tenantConfig is null", () => {
    expect(() => calculateInvoice(items([1, 100]), null)).not.toThrow();
  });

  it("returns numbers, never strings", () => {
    const r = calculateInvoice(items([2, 100]), { gstPercent: 18, discountPercent: 10 });
    for (const v of Object.values(r)) expect(typeof v).toBe("number");
  });

  it("keeps precision on large quantities", () => {
    const r = calculateInvoice(items([100000, 1250.75]), { gstPercent: 18 });
    expect(round2(r.base)).toBe(125075000);
  });

  it("reproduces the ABC Corp March invoice reported in PRO-1245", () => {
    const cfg = getTenantConfig("ABC Corp");
    const r = calculateInvoice(items([50, 2000]), cfg);
    // base 100000, discount 10% = 10000, taxable 90000, gst 18% = 16200
    expect(round2(r.gst)).toBe(16200);
    expect(round2(r.total)).toBe(106200);
  });

  it("never returns a total below the taxable amount", () => {
    const r = calculateInvoice(items([7, 143]), { gstPercent: 18, discountPercent: 5 });
    expect(r.total).toBeGreaterThanOrEqual(r.taxable);
  });

  it("treats a zero-quantity line as contributing nothing", () => {
    const r = calculateInvoice(items([0, 9999], [1, 100]), { gstPercent: 18 });
    expect(r.base).toBe(100);
  });
});
