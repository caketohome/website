import { retrieveCart } from "@frontend/lib/data/carts";
import { cookies } from "next/headers";
import Link from "next/link";
import CartModal from "@frontend/components/store/cart/cart-modal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shopping Cart — CakeToHome",
  description: "View and manage items in your CakeToHome shopping cart.",
};

export default async function CartPage() {
  const cookieStore = cookies();
  const cartId = cookieStore.get("_cth_cart_id")?.value || cookieStore.get("_medusa_cart_id")?.value;
  const cart = cartId ? await retrieveCart(cartId) : null;
  const items = Array.isArray(cart?.items) ? cart.items : [];

  if (!cart || items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center font-sans">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 md:p-16 shadow-xl flex flex-col items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-brand-gold-soft dark:bg-brand-deep/40 flex items-center justify-center text-5xl">
            🛒
          </div>
          <div className="flex flex-col gap-2 max-w-md">
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
              Your cart is empty.
            </h1>
            <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-400">
              You haven't added any delicious cakes yet. Browse our handcrafted gourmet creations and delight your celebrations!
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center mt-2">
            <Link
              href="/products"
              className="px-8 py-3.5 rounded-xl bg-brand-navy hover:bg-brand-deep text-white font-bold text-sm md:text-base shadow-lg shadow-rose-600/20 transition-all hover:scale-[1.02]"
            >
              Browse Gourmet Cakes →
            </Link>
            <Link
              href="/"
              className="px-8 py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-sm md:text-base hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
            >
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const subtotal = items.reduce(
    (acc: number, item: any) =>
      acc + Number(item.unit_price || item.price || 0) * Number(item.quantity || 1),
    0
  );

  const deliveryFeeCookie = cookieStore.get("delivery_fee")?.value;
  let resolvedDeliveryFee: number | null = null;
  if (typeof cart?.delivery_fee === "number") {
    resolvedDeliveryFee = cart.delivery_fee;
  } else if (deliveryFeeCookie) {
    const rawFee = decodeURIComponent(deliveryFeeCookie).trim().toLowerCase();
    if (rawFee === "0") {
      resolvedDeliveryFee = 0;
    } else {
      const parsed = parseFloat(rawFee.replace(/[^0-9.]/g, ""));
      resolvedDeliveryFee = isNaN(parsed) ? null : parsed;
    }
  }

  let deliveryLabel = "Calculated at checkout";
  let deliveryClass = "text-zinc-500";
  if (typeof resolvedDeliveryFee === "number") {
    deliveryLabel = `₹${resolvedDeliveryFee.toLocaleString("en-IN")}`;
    deliveryClass = "font-medium text-zinc-900 dark:text-zinc-100";
  }

  const grandTotal = subtotal + (typeof resolvedDeliveryFee === "number" ? resolvedDeliveryFee : 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
      <div className="flex justify-between items-center mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            Shopping Bag
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0)} items in your cart
          </p>
        </div>
        <Link
          href="/products"
          className="text-sm font-semibold text-brand-navy dark:text-brand-gold hover:underline flex items-center gap-1"
        >
          <span>Continue Shopping</span>
          <span>→</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-4">
          {items.map((item: any) => (
            <div
              key={item.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
            >
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200/60">
                  <img
                    src={item.thumbnail || item.image_url || "/images/placeholder-cake.webp"}
                    alt={item.title || "Product"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                    {item.title || item.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {(item.weight || item.metadata?.weight) && (
                      <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300 font-medium">
                        {item.weight || item.metadata?.weight}
                      </span>
                    )}
                    {(item.flavour || item.metadata?.flavour) && (
                      <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300">
                        {item.flavour || item.metadata?.flavour}
                      </span>
                    )}
                    {(item.shape || item.metadata?.shape) && (
                      <span className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-600 dark:text-zinc-300">
                        {item.shape || item.metadata?.shape}
                      </span>
                    )}
                    <span className="text-xs text-zinc-500">
                      Qty: {item.quantity || 1}
                    </span>
                  </div>
                  {(item.cake_message || item.metadata?.cake_message) && (
                    <p
                      data-testid="cart-page-item-cake-message"
                      className="text-xs text-brand-gold-dark bg-brand-gold-light border border-brand-gold/40 rounded px-2 py-0.5 mt-1.5 inline-block italic"
                    >
                      🎂 Message on Cake: &ldquo;{item.cake_message || item.metadata?.cake_message}&rdquo;
                    </p>
                  )}
                  {item.unit_price && Number(item.quantity || 1) > 1 && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      ₹{Number(item.unit_price).toLocaleString("en-IN")} each
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-zinc-100">
                <div className="text-lg font-bold text-brand-navy dark:text-brand-gold">
                  ₹{(Number(item.unit_price || item.price || 0) * Number(item.quantity || 1)).toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-md flex flex-col gap-5 sticky top-24">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              Order Summary
            </h2>

            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">Items Subtotal</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">₹{subtotal.toLocaleString("en-IN")}</span>
            </div>

            <div className="flex justify-between text-sm font-medium">
              <span className="text-zinc-600 dark:text-zinc-400">Standard Delivery</span>
              <span className={deliveryClass}>{deliveryLabel}</span>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">Estimated Total</span>
                {resolvedDeliveryFee === null && (
                  <span className="text-xs text-zinc-400 font-normal">excl. delivery fee</span>
                )}
              </div>
              <span className="font-extrabold text-xl text-brand-navy dark:text-brand-gold">
                ₹{grandTotal.toLocaleString("en-IN")}
              </span>
            </div>

            <Link
              href="/checkout"
              className="w-full py-3.5 bg-brand-navy hover:bg-brand-deep text-white font-bold text-center rounded-xl shadow-lg shadow-rose-600/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <span>Proceed to Checkout</span>
              <span>→</span>
            </Link>

            <Link
              href="/products"
              className="text-xs text-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 font-medium transition-colors"
            >
              ← Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
