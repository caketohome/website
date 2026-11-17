/**
 * Marketplace partner KYC rules (pure — safe to import in client components).
 * A food partner selling through the marketplace needs GST registration (e-commerce suppliers must
 * register), PAN (194-O TDS), an FSSAI licence, and bank details for payouts.
 */

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const FSSAI_RE = /^[0-9]{14}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** KYC problems that block partner approval (empty array = KYC complete). */
export function partnerKycIssues(p: {
  gstin?: string | null;
  pan?: string | null;
  metadata?: any;
  bank_details?: any;
}): string[] {
  const issues: string[] = [];
  const gstin = String(p.gstin || "").toUpperCase();
  const pan = String(p.pan || "").toUpperCase();
  if (!GSTIN_RE.test(gstin)) issues.push("Valid 15-character GSTIN is required.");
  if (!PAN_RE.test(pan)) issues.push("Valid PAN is required.");
  if (GSTIN_RE.test(gstin) && PAN_RE.test(pan) && gstin.slice(2, 12) !== pan) issues.push("PAN does not match the PAN inside the GSTIN.");
  if (!FSSAI_RE.test(String(p.metadata?.fssai_number || ""))) issues.push("14-digit FSSAI licence number is required.");
  const bank = typeof p.bank_details === "string" ? safeJson(p.bank_details) : p.bank_details || {};
  if (!String(bank.account_number || "").trim()) issues.push("Bank account number is required for payouts.");
  if (!IFSC_RE.test(String(bank.ifsc || "").toUpperCase())) issues.push("Valid bank IFSC is required.");
  return issues;
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
