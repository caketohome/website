/**
 * Single source of truth for Indian mobile normalization (E.164, +91).
 * Accepts: 9876543210 | +91 98765 43210 | 919876543210 | 09876543210 | (+91) 98765-43210
 * Rejects anything that is not a 10-digit Indian mobile starting 6-9.
 */
export function normalizeIndianMobile(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!/^[+\d\s().-]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  const hadPlus = trimmed.startsWith("+") || trimmed.startsWith("(+");

  if (hadPlus) {
    if (!digits.startsWith("91")) return null; // non-Indian international number
    digits = digits.slice(2);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** "+919876543210" -> "+91 98765 ***10" for logs/UI; never log full numbers. */
export function maskPhone(e164: string): string {
  return e164.length >= 13 ? `${e164.slice(0, 3)} ${e164.slice(3, 8)} ***${e164.slice(-2)}` : "***";
}
