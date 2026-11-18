"use client";

/**
 * Asks a guest shopper with items in the cart to log in, so the cart is saved to their account
 * (claim-cart on login) and can be recovered by WhatsApp / telecaller if they leave.
 *
 * Shows a few seconds after a guest adds to cart, or on exit intent on the cart/checkout pages.
 * Dismissal is remembered for 24 hours on this browser.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ShoppingBag, X } from "lucide-react";
import { cartBus } from "@frontend/lib/cart/cart-event-bus";

const DISMISS_KEY = "cth_guest_cart_prompt_dismissed_at";
const DISMISS_MS = 24 * 60 * 60 * 1000;
const HIDDEN_ON = ["/login", "/account", "/dashboard", "/partner", "/your-order"];

function recentlyDismissed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

function hasCartCookie(): boolean {
  return /(?:^|;\s*)(_cth_cart_id|_medusa_cart_id)=[^;]+/.test(document.cookie || "");
}

async function isGuest(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
    const j = await r.json();
    return !j?.data?.user;
  } catch {
    return false; // unknown -> don't nag
  }
}

export function GuestCartLoginPrompt() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const shownRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hiddenHere = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const tryShow = useCallback(async () => {
    if (shownRef.current || hiddenHere || recentlyDismissed()) return;
    if (!(await isGuest())) return;
    shownRef.current = true;
    setOpen(true);
  }, [hiddenHere]);

  // A guest just added something: ask after the cart drawer has had a moment.
  useEffect(() => {
    return cartBus.onCartUpdated((cart: any) => {
      const count = Array.isArray(cart?.items) ? cart.items.length : 0;
      if (count === 0) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(tryShow, 4000);
    });
  }, [tryShow]);

  // Leaving the cart or checkout with items: last chance to save the cart.
  useEffect(() => {
    if (!(pathname.startsWith("/cart") || pathname.startsWith("/checkout"))) return;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && hasCartCookie()) tryShow();
    };
    document.addEventListener("mouseleave", onLeave);
    return () => document.removeEventListener("mouseleave", onLeave);
  }, [pathname, tryShow]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const next = encodeURIComponent(`${pathname}${typeof window !== "undefined" ? window.location.search : ""}`);

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-cart-prompt-title"
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#1D2F5D] px-5 py-4 flex items-center gap-3 text-white">
          <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4.5 h-4.5" aria-hidden />
          </span>
          <h2 id="guest-cart-prompt-title" className="font-serif text-lg leading-snug">Save your cart</h2>
          <button type="button" onClick={dismiss} aria-label="Close" className="ml-auto p-1 rounded-md text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600">
            Log in with your mobile number and we&apos;ll keep your cart for you, so you can finish your order any time on any device.
          </p>
          <div className="flex flex-col gap-2">
            <a
              href={`/login?next=${next}`}
              className="w-full text-center rounded-xl bg-[#1D2F5D] text-white text-sm font-semibold py-2.5 hover:opacity-95"
            >
              Log in to save cart
            </a>
            <button type="button" onClick={dismiss} className="w-full text-center rounded-xl text-sm text-slate-500 py-2 hover:text-slate-800">
              Continue as guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
