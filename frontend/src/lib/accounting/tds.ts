/**
 * TDS (Tax Deducted at Source) — recorded only when money actually moves:
 *  - Paying a supplier: deduct TDS, pay the net, owe the TDS to the government (2130 TDS Payable).
 *  - Receiving from a corporate customer who deducted TDS: receive the net, claim the TDS (1125 TDS Receivable).
 * Never applied to ordinary storefront sales.
 */

export const TDS_PAYABLE_ACCOUNT = "2130";
export const TDS_RECEIVABLE_ACCOUNT = "1125";

export const TDS_SECTIONS: Record<string, string> = {
  "194C": "Contractors / job work",
  "194J": "Professional / technical fees",
  "194I": "Rent",
  "194H": "Commission / brokerage",
  "194Q": "Purchase of goods",
  "194A": "Interest (other than securities)",
  "194O": "E-commerce operator — marketplace partner sales",
};

export class TdsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TdsValidationError";
  }
}

/** Validates the TDS on a payment/receipt of `grossAmount`. Returns 0/null when no TDS. */
export function resolveTds(
  tdsAmount: unknown,
  tdsSection: unknown,
  grossAmount: number
): { amount: number; section: string | null; net: number } {
  const amount = Math.round(Number(tdsAmount || 0) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new TdsValidationError("TDS amount must be zero or a positive number.");
  }
  if (amount === 0) return { amount: 0, section: null, net: grossAmount };
  const section = String(tdsSection || "").trim().toUpperCase();
  if (!TDS_SECTIONS[section]) {
    throw new TdsValidationError(`TDS section is required (one of ${Object.keys(TDS_SECTIONS).join(", ")}).`);
  }
  if (amount >= grossAmount) {
    throw new TdsValidationError(`TDS (₹${amount.toFixed(2)}) must be less than the amount settled (₹${grossAmount.toFixed(2)}).`);
  }
  return { amount, section, net: Math.round((grossAmount - amount) * 100) / 100 };
}
