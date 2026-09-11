// Per-tenant billing configuration.

export const tenantConfigs = {
  "ABC Corp": { gstPercent: 18, discountPercent: 10 },
  "XYZ Metals": { gstPercent: 18, discountPercent: 5 },
  "Sharma Steels": { gstPercent: 18, discountPercent: 0 },
  "Nova Infra": { gstPercent: 5, discountPercent: 12 },
  "Kaveri Textiles": { gstPercent: 12, discountPercent: 7 },
  "Deccan Auto": { gstPercent: 28, discountPercent: 15 },
  "Orient Chem": { gstPercent: 18, discountPercent: 2.5 },
  "Bharat Cement": { gstPercent: 28, discountPercent: 0 },
};

export function getTenantConfig(customer) {
  return tenantConfigs[customer] ?? null;
}
