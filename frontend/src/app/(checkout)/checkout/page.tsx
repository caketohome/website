import CheckoutForm from "../../../components/store/checkout/checkout-form";
import { OrderSummary } from "../../../components/store/checkout/order-summary";
import { retrieveCart } from "../../../lib/data/carts";
import { cookies } from "next/headers";
import Link from "next/link";
import { SeoMetadataBuilder } from "../../../lib/seo/metadata-builder";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    fallbackTitle: "Checkout — CakeToHome",
    isPrivate: true,
  });
}

export default async function CheckoutPage() {
  const cookieStore = cookies();
  const cartId = cookieStore.get("_cth_cart_id")?.value || cookieStore.get("_medusa_cart_id")?.value;

  const cart = cartId ? await retrieveCart(cartId) : null;
  const items = Array.isArray(cart?.items) ? cart.items : [];

  if (!cart || items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center font-sans">
        <div className="japandi-card p-10 md:p-16 flex flex-col items-center gap-6 shadow-xl border border-stone-200/80 bg-brand-warm-white">
          <div className="w-24 h-24 rounded-full bg-brand-gold-light/80 border border-brand-gold/60 flex items-center justify-center text-5xl shadow-sm">
            🎂
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <span className="text-[11px] font-sans uppercase tracking-[0.25em] text-[#997A1E] font-semibold">
              Bespoke Patisserie
            </span>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-brand-navy">
              Your cart is waiting.
            </h1>
            <p className="text-sm md:text-base text-slate-600 leading-relaxed font-sans">
              No cakes selected yet. Browse our handcrafted gourmet creations baked fresh daily for your special moments.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center mt-2">
            <Link
              href="/products"
              className="px-8 py-3.5 rounded-xl bg-brand-navy hover:bg-brand-deep text-white font-bold text-sm md:text-base shadow-lg shadow-brand-navy/20 transition-all hover:scale-[1.02] inline-flex items-center gap-2"
            >
              <span>Explore Cakes & Delicacies</span>
              <span>→</span>
            </Link>
            <Link
              href="/"
              className="px-8 py-3.5 rounded-xl border border-stone-300 bg-white text-slate-700 font-semibold text-sm md:text-base hover:bg-stone-50 transition-all"
            >
              Return Home
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-8 mt-4 border-t border-stone-200/60 text-xs text-slate-500 font-sans">
            <div className="flex items-center gap-2 justify-center">
              <span>🚚</span>
              <span>Delivery charged by distance</span>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <span>⚡</span>
              <span>Same-Day & Scheduled Slots</span>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <span>⭐</span>
              <span>100% Freshly Baked Guarantee</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <CheckoutForm cart={cart} />
    </div>
  );
}


