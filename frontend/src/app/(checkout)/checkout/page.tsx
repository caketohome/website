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
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 md:p-16 shadow-xl flex flex-col items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-5xl">
            🎂
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
              Your cart is empty.
            </h1>
            <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400">
              Looks like you haven't added any delicious cakes yet. Browse our handcrafted gourmet creations and delight your celebrations!
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center mt-2">
            <Link
              href="/products"
              className="px-8 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm md:text-base shadow-lg shadow-rose-600/20 transition-all hover:scale-[1.02]"
            >
              Explore Cakes & Delicacies →
            </Link>
            <Link
              href="/"
              className="px-8 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-sm md:text-base hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
            >
              Return Home
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-8 mt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500">
            <div className="flex items-center gap-2 justify-center">
              <span>🚚</span>
              <span>Free Delivery Above ₹599</span>
            </div>
            <div className="flex items-center gap-2 justify-center">
              <span>⚡</span>
              <span>Same-Day & Midnight Slots</span>
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


