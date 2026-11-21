/**
 * Fields customers must never see (what a cake costs us, margins).
 * Used on storefront pages and on API responses to anyone who is not staff.
 */
const PRIVATE_KEYS = new Set([
  "cost_price", "costPrice", "purchase_price", "purchasePrice",
  "landed_cost", "unit_cost", "margin", "margin_percent", "profit",
]);

export function stripPrivateProductFields<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripPrivateProductFields(v)) as unknown as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (PRIVATE_KEYS.has(k)) continue;
    out[k] = stripPrivateProductFields(v);
  }
  return out as T;
}

/** Cheap pre-check so responses without private fields are passed through untouched. */
export function mayContainPrivateFields(text: string): boolean {
  return /"(cost_price|costPrice|purchase_price|purchasePrice|landed_cost|unit_cost|margin|margin_percent|profit)"/.test(text);
}
