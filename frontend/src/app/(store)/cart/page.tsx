import { retrieveCart } from "@frontend/lib/data";
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
          <div className="w-24 h-24 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-5xl">
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
              className="px-8 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm md:text-base shadow-lg shadow-rose-600/20 transition-all hover:scale-[1.02]"
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-sans">
      <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mb-6 flex items-center gap-3">
        <span>🛒</span> Your Shopping Cart ({items.length} {items.length === 1 ? "item" : "items"})
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 flex flex-col gap-4">
          {items.map((item: any) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
            >
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={item.thumbnail || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=200"}
                  alt={item.title || "Cake"}
                  className="w-20 h-20 rounded-xl object-cover border border-zinc-100 dark:border-zinc-800 shrink-0"
                />
                <div className="flex flex-col gap-1 min-w-0">
                  <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100 truncate">
                    {item.title || item.name}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {item.weight && (
                      <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md font-medium text-zinc-700 dark:text-zinc-300">
                        {item.weight}
                      </span>
                    )}
                    {item.eggless && (
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-medium">
                        🌱 Eggless
                      </span>
                    )}
                    {item.shape && (
                      <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-600 dark:text-zinc-400">
                        {item.shape}
                      </span>
                    )}
                  </div>
                  {item.cake_message && (
                    <p className="text-xs text-zinc-500 italic truncate">
                      "{item.cake_message}"
                    </p>
                  )}
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2">
                <span className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                  ₹{(Number(item.unit_price || item.price || 0) * Number(item.quantity || 1)).toLocaleString("en-IN")}
                </span>
                <span className="text-xs text-zinc-500">
                  Qty: {item.quantity || 1}
                </span>
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

            <div className="flex justify-between text-sm text-emerald-600 font-medium">
              <span>Standard Delivery</span>
              <span>{subtotal >= 599 ? "FREE" : "Calculated at checkout"}</span>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex justify-between items-center">
              <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">Estimated Total</span>
              <span className="font-extrabold text-xl text-rose-600 dark:text-rose-400">
                ₹{subtotal.toLocaleString("en-IN")}
              </span>
            </div>

            <Link
              href="/checkout"
              className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-center rounded-xl shadow-lg shadow-rose-600/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
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
