import { apiClient } from "@frontend/lib/api-client";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function YourOrderPage({
  searchParams,
}: {
  searchParams?: { order_id?: string; delivery_id?: string };
}) {
  const cookieStore = cookies();
  const orderId =
    searchParams?.order_id ||
    cookieStore.get("_cth_order_id")?.value ||
    cookieStore.get("_medusa_order_id")?.value ||
    searchParams?.delivery_id ||
    cookieStore.get("_medusa_delivery_id")?.value ||
    cookieStore.get("_cth_delivery_id")?.value;

  let order: any = null;

  if (orderId) {
    try {
      const res = await apiClient.getOrder(orderId);
      order = res?.order || res;
    } catch (e) {
      console.warn("Failed to fetch order details:", e);
    }
  }



  if (!order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-3xl">
          🎂
        </div>
        <h1 className="text-2xl font-black text-zinc-900">No Recent Order Found</h1>
        <p className="text-sm text-zinc-500 max-w-md">
          We couldn't locate an active order session. If you just placed an order, check your SMS confirmation or enter your Order ID.
        </p>
        <Link
          href="/"
          className="mt-4 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl shadow transition"
        >
          Return to Bakery
        </Link>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const pricing = order.pricing || {
    subtotal: order.subtotal || order.total || 0,
    delivery_fee: order.delivery_fee || 0,
    slot_surcharge: order.slot_surcharge || 0,
    discount: order.discount_total || 0,
    grand_total: order.total || order.subtotal || 0,
    taxable_value: Math.round(((order.total || 0) / 1.05) * 100) / 100,
    total_tax: Math.round(((order.total || 0) - (order.total || 0) / 1.05) * 100) / 100,
    cgst: Math.round((((order.total || 0) - (order.total || 0) / 1.05) / 2) * 100) / 100,
    sgst: Math.round((((order.total || 0) - (order.total || 0) / 1.05) / 2) * 100) / 100,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8 font-sans">
      {/* Header Success Banner */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 text-9xl">
          🎂
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/30 text-emerald-100 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-400/30">
              <span>✓</span> Order Confirmed & In Kitchen
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Thank you, {order.customer_name?.split(" ")[0] || "Friend"}!
            </h1>
            <p className="text-sm text-emerald-100 mt-1">
              Your celebration cake is queued at{" "}
              <b className="text-white">{order.branch_name || "Flagship Kitchen"}</b>.
            </p>
          </div>

          {/* Secure Delivery OTP Box */}
          {order.delivery_otp && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center shrink-0 w-full sm:w-auto">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-100">
                Secure Delivery OTP
              </span>
              <div className="text-3xl font-black tracking-widest text-white mt-0.5">
                {order.delivery_otp}
              </div>
              <p className="text-[10px] text-emerald-200 mt-0.5">Share with rider upon delivery</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Details */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Order Metadata Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <span className="text-xs text-zinc-500 font-medium">Order Number</span>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                  {order.order_number || order.id}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-zinc-500 font-medium">KOT Ticket</span>
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono">
                  {order.kot_number || `KOT-${order.order_number || order.id}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 font-medium">Delivery Schedule</span>
                <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                  🗓️ {order.delivery_date}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">{order.delivery_slot}</p>
              </div>
              <div>
                <span className="text-zinc-500 font-medium">Payment Mode</span>
                <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                  {order.payment_method || "Online"}
                </p>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold">
                  {order.payment_status === "pending" ? "Pending on Delivery" : "Captured"}
                </span>
              </div>
            </div>

            <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 text-xs">
              <span className="text-zinc-500 font-medium">Delivery Destination</span>
              <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                {order.delivery_address}
              </p>
              {order.customer_phone && (
                <p className="text-zinc-500 mt-0.5">Contact: {order.customer_phone}</p>
              )}
            </div>
          </div>

          {/* Ordered Items List */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>📦</span> Items in this Order ({items.length})
            </h2>

            <div className="flex flex-col gap-3">
              {items.map((item: any) => {
                const img = item.thumbnail || item.image_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=300";
                const qty = Number(item.quantity || 1);
                const price = Number(item.unit_price || item.price || 0);

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3.5 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800"
                  >
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-white">
                      <Image
                        src={img}
                        alt={item.title || "Cake"}
                        className="object-cover"
                        fill
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate pr-1">
                          {item.title || item.name}
                        </h3>
                        <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 shrink-0">
                          ₹{(price * qty).toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-semibold text-zinc-500">
                          {qty} × ₹{price}
                        </span>
                        {item.weight && (
                          <span className="text-[10px] font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded">
                            {item.weight}
                          </span>
                        )}
                      </div>

                      {item.cake_message && (
                        <p className="text-[11px] text-zinc-500 italic mt-1 truncate">
                          "{item.cake_message}"
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Summary & Next Steps */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Statutory Tax & Price Breakdown */}
          <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4 text-sm">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              Payment Summary
            </h2>

            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Subtotal</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                ₹{Number(pricing.subtotal).toLocaleString("en-IN")}
              </span>
            </div>

            {Number(pricing.discount) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount</span>
                <span>-₹{Number(pricing.discount).toLocaleString("en-IN")}</span>
              </div>
            )}

            <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
              <span>Delivery Fee</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {pricing.delivery_fee === 0 ? "FREE" : `₹${pricing.delivery_fee}`}
              </span>
            </div>

            {Number(pricing.slot_surcharge) > 0 && (
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Slot Surcharge</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  ₹{pricing.slot_surcharge}
                </span>
              </div>
            )}

            {/* GST Details Box */}
            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-xs flex flex-col gap-1">
              <div className="flex justify-between font-semibold text-zinc-700 dark:text-zinc-300">
                <span>GST (5% HSN 19059090)</span>
                <span>₹{Number(pricing.total_tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-500 pl-3">
                <span>CGST (2.5%)</span>
                <span>₹{Number(pricing.cgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-500 pl-3">
                <span>SGST (2.5%)</span>
                <span>₹{Number(pricing.sgst).toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-700 pt-3 flex justify-between items-baseline">
              <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                Total Paid
              </span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                ₹{Number(pricing.grand_total).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex flex-col gap-3">
            <Link
              href={`/account/orders?highlight=${encodeURIComponent(order.id)}`}
              className="w-full py-3.5 px-4 bg-zinc-900 hover:bg-black text-white text-center font-bold text-sm rounded-2xl shadow transition flex items-center justify-center gap-2"
            >
              <span>📋 View in My Orders</span>
            </Link>
            <Link
              href="/"
              className="w-full py-3 px-4 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-center font-semibold text-sm rounded-2xl transition"
            >
              ← Order More Cakes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

