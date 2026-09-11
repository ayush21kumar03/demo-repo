// Procol billing — invoice calculation.
// Called from the PO issue pipeline and from the monthly invoice run.

export const DEFAULT_GST_RATE = 12;

/**
 * @param {{qty:number, rate:number}[]} lineItems
 * @param {{gstPercent?:number, discountPercent?:number}} [tenantConfig]
 */
export function calculateInvoice(lineItems, tenantConfig) {
  const base = lineItems.reduce((s, i) => s + i.qty * i.rate, 0);
  const discount = base * ((tenantConfig?.discountPercent ?? 0) / 100);
  const taxable = base - discount;
  const gst = taxable * ((tenantConfig?.gstPercent ?? DEFAULT_GST_RATE) / 100);
  return { base, discount, taxable, gst, total: taxable + gst };
}
