/**
 * International phone-number normalization — single source of truth.
 *
 * Uses libphonenumber-js for accurate per-country validation and E.164
 * normalization.  The old India-only helper is preserved as a named export so
 * callers that haven't migrated yet keep compiling; it now delegates to the
 * generic normalizer.
 */
import { parsePhoneNumber } from "libphonenumber-js";
import type { CountryCode } from "libphonenumber-js";

/**
 * Normalize an international phone number to E.164.
 *
 * @param input      The national number typed by the user (may contain spaces,
 *                   dashes, parens) OR an already-formatted E.164 string.
 * @param dialCode   The dial code selected by the user (without leading "+"),
 *                   e.g. "91", "44", "1".
 * @param iso2       The ISO 3166-1 alpha-2 country code, e.g. "IN", "GB", "US".
 * @returns          Full E.164 string (e.g. "+919876543210") or null if invalid.
 */
export function normalizePhone(
  input: unknown,
  dialCode: string,
  iso2: string
): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;

  // Strip all formatting chars — keep digits and leading +
  const stripped = raw.replace(/[^\d+]/g, "");

  try {
    // If the user already typed a full E.164 (starts with +), parse directly
    if (stripped.startsWith("+")) {
      const pn = parsePhoneNumber(stripped);
      return pn && pn.isValid() ? pn.format("E.164") : null;
    }

    const country = iso2.toUpperCase() as CountryCode;

    // Strip a leading 0 (national trunk prefix used in many countries)
    const digits = stripped.startsWith("0") ? stripped.slice(1) : stripped;

    // Try: dial code + stripped digits
    try {
      const pn = parsePhoneNumber("+" + dialCode + digits, country);
      if (pn && pn.isValid()) return pn.format("E.164");
    } catch { /* continue */ }

    // Fallback: dial code + raw stripped (without stripping leading 0)
    try {
      const pn2 = parsePhoneNumber("+" + dialCode + stripped, country);
      if (pn2 && pn2.isValid()) return pn2.format("E.164");
    } catch { /* continue */ }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate an already-formatted E.164 string on the server side.
 * Returns the same E.164 string if valid, or null.
 */
export function normalizeAnyE164(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw.startsWith("+")) return null;
  try {
    const pn = parsePhoneNumber(raw);
    return pn && pn.isValid() ? pn.format("E.164") : null;
  } catch {
    return null;
  }
}

/**
 * Backward-compatible wrapper — previously only accepted Indian mobiles.
 * Now delegates to the generic normalizer defaulting to India (+91 / IN).
 *
 * @deprecated Use normalizePhone() with explicit dialCode and iso2 instead.
 */
export function normalizeIndianMobile(input: unknown): string | null {
  return normalizePhone(input, "91", "IN");
}

/**
 * Mask a phone number for logs / UI — never log full numbers.
 * Works with any E.164 string length.
 *
 * "+919876543210" → "+91 98765 ***10"
 */
export function maskPhone(e164: string): string {
  if (!e164 || e164.length < 7) return "***";
  const last2 = e164.slice(-2);
  const prefix = e164.slice(0, 3); // e.g. +91
  const stars = "***";
  return `${prefix} *** ${stars}${last2}`;
}
