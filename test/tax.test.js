import { describe, it, expect } from "vitest";
import { calculateInvoice, DEFAULT_GST_RATE } from "../src/invoiceCalculator.js";
import { tenantConfigs, getTenantConfig } from "../src/customerConfig.js";

const items = (...pairs) => pairs.map(([qty, rate]) => ({ qty, rate }));
const round2 = (n) => Math.round(n * 100) / 100;

// Parametrised across every tenant configuration we ship. Eight tenants, eight tests.
describe("tax — per-tenant GST matrix", () => {
  for (const [customer, cfg] of Object.entries(tenantConfigs)) {
    it(`applies ${cfg.gstPercent}% GST for ${customer}`, () => {
      const r = calculateInvoice(items([10, 1000]), cfg);
      expect(round2(r.gst)).toBe(round2(r.taxable * (cfg.gstPercent / 100)));
    });
  }
});

describe("tax — rate selection", () => {
  it("reads the rate from tenantConfig.gstPercent rather than the module default", () => {
    const r = calculateInvoice(items([1, 1000]), { gstPercent: 18 });
    expect(round2(r.gst)).toBe(180);
  });

  it("falls back to DEFAULT_GST_RATE only when gstPercent is absent", () => {
    const r = calculateInvoice(items([1, 1000]), { discountPercent: 0 });
    expect(round2(r.gst)).toBe(round2(1000 * (DEFAULT_GST_RATE / 100)));
  });

  it("keeps DEFAULT_GST_RATE at 12", () => {
    expect(DEFAULT_GST_RATE).toBe(12);
  });

  it("honours an explicit gstPercent of 0", () => {
    const r = calculateInvoice(items([1, 1000]), { gstPercent: 0 });
    expect(r.gst).toBe(0);
  });

  it("computes GST on the taxable amount, not on base", () => {
    const r = calculateInvoice(items([1, 1000]), { gstPercent: 18, discountPercent: 50 });
    expect(round2(r.gst)).toBe(90);
  });

  it("charges ABC Corp 18%, not the 12% default (PRO-1245)", () => {
    const r = calculateInvoice(items([1, 1000]), getTenantConfig("ABC Corp"));
    expect(round2(r.gst)).toBe(round2(900 * 0.18));
  });

  it("charges a 5% tenant 5%", () => {
    const r = calculateInvoice(items([1, 1000]), getTenantConfig("Nova Infra"));
    expect(round2(r.gst)).toBe(round2(880 * 0.05));
  });

  it("charges a 28% tenant 28%", () => {
    const r = calculateInvoice(items([1, 1000]), getTenantConfig("Bharat Cement"));
    expect(round2(r.gst)).toBe(280);
  });
});
