import { describe, it, expect } from "vitest";
import { calculateInvoice } from "../src/invoiceCalculator.js";
import { tenantConfigs, getTenantConfig } from "../src/customerConfig.js";

const items = (...pairs) => pairs.map(([qty, rate]) => ({ qty, rate }));
const round2 = (n) => Math.round(n * 100) / 100;

describe("discount — per-tenant matrix", () => {
  for (const [customer, cfg] of Object.entries(tenantConfigs)) {
    it(`applies a ${cfg.discountPercent}% discount for ${customer}`, () => {
      const r = calculateInvoice(items([4, 2500]), cfg);
      expect(round2(r.discount)).toBe(round2(10000 * (cfg.discountPercent / 100)));
    });
  }
});

describe("discount — rules", () => {
  it("applies no discount when discountPercent is absent", () => {
    expect(calculateInvoice(items([1, 500]), { gstPercent: 18 }).discount).toBe(0);
  });

  it("applies the discount before tax", () => {
    const r = calculateInvoice(items([1, 1000]), { gstPercent: 18, discountPercent: 10 });
    expect(r.taxable).toBe(900);
  });

  it("treats a 0% discount as no discount", () => {
    expect(calculateInvoice(items([1, 500]), { gstPercent: 18, discountPercent: 0 }).discount).toBe(0);
  });

  it("supports fractional discount percentages", () => {
    const r = calculateInvoice(items([1, 1000]), getTenantConfig("Orient Chem"));
    expect(round2(r.discount)).toBe(25);
  });

  it("never discounts more than the base", () => {
    const r = calculateInvoice(items([1, 1000]), { gstPercent: 18, discountPercent: 100 });
    expect(r.discount).toBeLessThanOrEqual(r.base);
  });

  it("gives ABC Corp its contracted 10%", () => {
    const r = calculateInvoice(items([1, 1000]), getTenantConfig("ABC Corp"));
    expect(round2(r.discount)).toBe(100);
  });

  it("discounts nothing on an empty invoice", () => {
    expect(calculateInvoice([], { gstPercent: 18, discountPercent: 10 }).discount).toBe(0);
  });

  it("leaves base untouched when discounting", () => {
    const r = calculateInvoice(items([2, 750]), { gstPercent: 18, discountPercent: 20 });
    expect(r.base).toBe(1500);
  });
});
