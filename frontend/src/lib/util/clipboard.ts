/**
 * Copy text to the clipboard. Resolves true ONLY if the copy actually succeeded.
 * Callers must not show "Copied" unless this resolves true.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text || typeof window === "undefined") return false;

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/** Key used to carry a claimed coupon from a banner to checkout. Revalidated server-side. */
export const PENDING_COUPON_KEY = "cth_pending_coupon";

