import { apiClient } from "@frontend/lib/api-client";
import { OrderRepository } from "@frontend/lib/repositories/order.repository";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { OrderLiveStatusWatcher } from "@frontend/components/store/order/order-live-status-watcher";
import { RiderLiveLocation } from "@frontend/components/store/order/rider-live-location";

export const dynamic = "force-dynamic";

function formatInr(amount: number): string {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "0.00";
  const hasPaise = Math.round(num * 100) % 100 !== 0;
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

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
      order = await OrderRepository.findById(orderId);
    } catch (repoErr) {
      console.warn("OrderRepository.findById error:", repoErr);
    }

    if (!order || !order.id) {
      try {
        const res = await apiClient.getOrder(orderId);
        const candidate = res?.order ?? (res?.id ? res : null);
        if (candidate && candidate.id) {
          order = candidate;
        }
      } catch (e) {
        console.warn("Failed to fetch order details via API:", e);
      }
    }
  }

  // Private details (delivery OTP, address, phone) only for the buyer: the browser that checked out,
  // the signed-in customer, or staff. Anyone else with the link just sees the order status.
  if (order?.id) {
    const { resolveServerSession } = await import("@frontend/lib/security/auth-session");
    const session = resolveServerSession({ cookies: cookieStore, headers: { get: () => "" } } as any);
    const role = String(session?.role || "").toUpperCase();
    const digits = (p: any) => String(p || "").replace(/\D/g, "").slice(-10);
    const isStaff = Boolean(role) && role !== "CUSTOMER" && !role.startsWith("PARTNER_") && role !== "DELIVERY_PARTNER" && role !== "DLP";
    const isBuyer =
      [cookieStore.get("_cth_order_id")?.value, cookieStore.get("_medusa_order_id")?.value].includes(order.id) ||
      (session && [session.userId, (session as any).customerId, (session as any).customerUid].filter(Boolean).includes(order.customer_id)) ||
      (session?.phone && digits(session.phone) === digits(order.customer_phone));
    if (!isStaff && !isBuyer) {
      order = { ...order, delivery_otp: null, delivery_address: null, customer_phone: null, customer_email: null,
        customer_name: "", customer: { ...(order.customer || {}), address: null, phone: null, email: null },
        delivery: order.delivery ? { ...order.delivery, delivery_otp: null, pickup_otp: null } : order.delivery };
    }
  }

  if (!order || !order.id) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-3xl">
          🎂
        </div>
        <h1 className="text-2xl font-black text-slate-900">No Recent Order Found</h1>
        <p className="text-sm text-slate-500 max-w-md">
          We couldn&apos;t locate an active order session{orderId ? ` for reference "${orderId}"` : ""}. If you just placed an order, check your SMS confirmation or verify your Order ID.
        </p>
        <Link
          href="/"
          className="mt-4 px-6 py-3 bg-brand-primary hover:bg-brand-deep text-white font-bold text-sm rounded-2xl shadow transition"
        >
          Return to Bakery
        </Link>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const rawSubtotal = order.subtotal ?? order.payment?.subtotal;
  const rawGrandTotal = order.grand_total ?? order.total_amount ?? order.total ?? order.payment?.grand_total;

  const subtotal = rawSubtotal !== undefined && rawSubtotal !== null && !isNaN(Number(rawSubtotal))
    ? Number(rawSubtotal)
    : NaN;
  const grandTotal = rawGrandTotal !== undefined && rawGrandTotal !== null && !isNaN(Number(rawGrandTotal))
    ? Number(rawGrandTotal)
    : NaN;

  // Financial Invariant #8 & #9: Missing or zero financial values or missing line items must NEVER silently render as ₹0
  const hasValidItems = items.length > 0 && items.every((it: any) => Number(it.quantity) >= 1 && Number(it.unit_price ?? it.price ?? it.taxable_value ?? 0) > 0);
  const hasValidTotals = Number.isFinite(subtotal) && subtotal > 0 && Number.isFinite(grandTotal) && grandTotal > 0;

  if (!hasValidItems || !hasValidTotals) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-4" data-testid="financial-integrity-exception">
        <div className="w-20 h-20 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-3xl">
          ⚠️
        </div>
        <h1 className="text-2xl font-black text-slate-900">Order Financial Reconciliation Required</h1>
        <p className="text-sm text-slate-600 max-w-lg">
          Order <span className="font-mono font-bold">{order.order_number || order.id}</span> has incomplete or unverified monetary records (Code: <span className="font-mono font-semibold text-rose-700">ORDER_FINANCIAL_INTEGRITY_EXCEPTION</span>). Confirmation display is blocked to prevent inaccurate financial reporting.
        </p>
        <div className="mt-4 flex gap-3">
          <Link
            href="/account/orders"
            className="px-6 py-3 bg-brand-primary hover:bg-brand-deep text-white font-bold text-sm rounded-2xl shadow transition"
          >
            View My Orders
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-white border border-slate-200 text-slate-800 font-semibold text-sm rounded-2xl transition"
          >
            Return to Bakery
          </Link>
        </div>
      </div>
    );
  }

  const itemsCgst = items.reduce((sum: number, it: any) => sum + Number(it.cgst || 0), 0);
  const itemsSgst = items.reduce((sum: number, it: any) => sum + Number(it.sgst || 0), 0);
  const itemsTax = items.reduce((sum: number, it: any) => sum + Number(it.tax_amount || 0), 0);

  const deliveryFee = Number(order.delivery_fee ?? order.payment?.delivery_fee ?? order.delivery?.fee ?? 0);
  const slotSurcharge = Number(order.slot_surcharge ?? order.metadata?.slot_surcharge ?? 0);
  const discount = Number(order.discount_amount ?? order.discount_total ?? order.payment?.discount ?? 0);

  const rawTax = order.tax_total ?? order.tax_amount ?? order.payment?.tax_total;
  const totalTax = rawTax !== undefined && rawTax !== null && !isNaN(Number(rawTax)) && Number(rawTax) > 0
    ? Number(rawTax)
    : (itemsTax > 0 ? Math.round(itemsTax * 100) / 100 : 0);

  const cgst = order.payment?.cgst != null && Number(order.payment.cgst) > 0
    ? Number(order.payment.cgst)
    : (itemsCgst > 0 ? Math.round(itemsCgst * 100) / 100 : Math.round((totalTax / 2) * 100) / 100);
  const sgst = order.payment?.sgst != null && Number(order.payment.sgst) > 0
    ? Number(order.payment.sgst)
    : (itemsSgst > 0 ? Math.round(itemsSgst * 100) / 100 : Math.round((totalTax / 2) * 100) / 100);

  const paymentStatusUpper = String(order.payment_status || order.payment?.status || "PENDING").toUpperCase();
  const orderStatusLower = String(order.status || "pending").toLowerCase();
  const isPaid = ["CAPTURED", "PAID", "COMPLETED"].includes(paymentStatusUpper);
  const isPaymentFailedOrException = ["FAILED", "PAYMENT_EXCEPTION", "CANCELLED"].includes(paymentStatusUpper) || orderStatusLower === "cancelled";
  const isConfirmedOrder = isPaid && !isPaymentFailedOrException && ["confirmed", "kitchen_accepted", "preparing", "in_preparation", "baking_inspection", "packed", "ready_for_pickup", "out_for_delivery", "delivered", "completed"].includes(orderStatusLower);

  const gatewayPaymentId = order.gateway_payment_id || order.payment?.gateway_payment_id || order.metadata?.razorpay?.payment_id || order.metadata?.razorpay_payment_id || null;
  const gatewayOrderId = order.gateway_order_id || order.payment?.gateway_order_id || order.metadata?.razorpay?.order_id || order.metadata?.razorpay_order_id || null;

  const pricing = {
    subtotal,
    delivery_fee: deliveryFee,
    slot_surcharge: slotSurcharge,
    discount,
    grand_total: grandTotal,
    taxable_value: subtotal,
    total_tax: totalTax,
    cgst,
    sgst,
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8 font-sans">
      <OrderLiveStatusWatcher
        orderId={order.id}
        initialStatus={order.status || "pending"}
        initialPaymentStatus={order.payment_status || order.payment?.status || "pending"}
        orderNumber={order.order_number || order.id}
      />
      {/* Live rider position (only while out for delivery, only for the customer's own order) */}
      <RiderLiveLocation orderId={order.id} />
      {/* Header Status Banner */}
      <div
        className={`rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden ${
          isPaymentFailedOrException
            ? "bg-gradient-to-br from-rose-600 to-red-800"
            : isConfirmedOrder
            ? "bg-gradient-to-br from-emerald-600 to-brand-navy"
            : "bg-gradient-to-br from-brand-gold to-brand-gold-dark"
        }`}
      >
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 text-9xl">
          🎂
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider mb-2 border border-white/30">
              {isPaymentFailedOrException ? (
                <><span>✕</span> Payment Failed / Order Not Confirmed</>
              ) : isConfirmedOrder ? (
                <><span>✓</span> Order Confirmed &amp; In Kitchen</>
              ) : (
                <><span>⏳</span> Order Pending Payment Confirmation</>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {isPaymentFailedOrException
                ? `Payment unsuccessful, ${order.customer_name?.split(" ")[0] || "Customer"}`
                : `Thank you, ${order.customer_name?.split(" ")[0] || "Customer"}!`}
            </h1>
            <p className="text-sm text-white/90 mt-1">
              {isPaymentFailedOrException ? (
                <>Your order at <b className="text-white">{order.branch_name || "Assigned Kitchen Branch"}</b> has not been confirmed due to an incomplete payment.</>
              ) : (
                <>Your celebration cake is queued at <b className="text-white">{order.branch_name || "Assigned Kitchen Branch"}</b>.</>
              )}
            </p>
          </div>

          {/* Secure Delivery OTP Box */}
          {order.delivery_otp && isConfirmedOrder && (
            <div className="bg-blue-50/80 border border-slate-200 backdrop-blur-md rounded-2xl p-4 text-center shrink-0 w-full sm:w-auto">
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
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs text-slate-500 font-medium">Order Number</span>
                <p className="text-sm font-bold text-slate-900 font-mono" data-testid="order-number">
                  {order.order_number || order.id}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium">KOT Ticket</span>
                <p className="text-xs font-bold text-slate-900 font-mono" data-testid="kot-number">
                  {order.kot_number || order.kitchen?.kot_number || `KOT-${order.order_number || order.id}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Delivery Schedule</span>
                <p className="font-bold text-slate-900 mt-0.5">
                  🗓️ {order.delivery_date || order.delivery?.date}
                </p>
                <p className="text-slate-500">{order.delivery_slot || order.delivery?.slot}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Payment Mode</span>
                <p className="font-bold text-slate-900 mt-0.5">
                  {String(order.payment_method || "RAZORPAY").toUpperCase() === "RAZORPAY"
                    ? "Razorpay Standard Checkout"
                    : order.payment_method}
                </p>
                <div className="flex flex-col gap-1 mt-1">
                  <span
                    data-testid="payment-status-badge"
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                      isPaid
                        ? "bg-emerald-50 text-emerald-700"
                        : isPaymentFailedOrException
                        ? "bg-rose-50 text-rose-700"
                        : "bg-brand-gold-light text-brand-gold-dark"
                    }`}
                  >
                    {isPaid
                      ? "Captured (Paid)"
                      : isPaymentFailedOrException
                      ? `Failed (${paymentStatusUpper})`
                      : "Pending Verification"}
                  </span>
                  {gatewayPaymentId && (
                    <span className="text-[10px] font-mono text-slate-600 truncate" title={gatewayPaymentId} data-testid="gateway-payment-id">
                      Payment ID: {gatewayPaymentId}
                    </span>
                  )}
                  {gatewayOrderId && (
                    <span className="text-[10px] font-mono text-slate-500 truncate" title={gatewayOrderId} data-testid="gateway-order-id">
                      Gateway Order: {gatewayOrderId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 text-xs">
              <span className="text-slate-500 font-medium">Delivery Destination</span>
              <p className="font-medium text-slate-900 mt-0.5">
                {typeof order.delivery_address === "string" && order.delivery_address.trim()
                  ? order.delivery_address
                  : typeof order.delivery_address === "object" && order.delivery_address !== null
                  ? [
                      order.delivery_address.line1 || order.delivery_address.address_1,
                      order.delivery_address.line2 || order.delivery_address.address_2,
                      order.delivery_address.landmark,
                      order.delivery_address.city,
                      order.delivery_address.state,
                      order.delivery_address.pincode || order.delivery_address.postal_code,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : typeof order.customer?.address === "string" && order.customer.address.trim()
                  ? order.customer.address
                  : "Delivery Address on File"}
              </p>
              {order.customer_phone && (
                <p className="text-slate-500 mt-0.5">Contact: {order.customer_phone}</p>
              )}
            </div>
          </div>

          {/* Ordered Items List */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col gap-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2" data-testid="order-items-heading">
              <span>📦</span> Items in this Order ({items.length})
            </h2>

            <div className="flex flex-col gap-3">
              {items.map((item: any) => {
                const img =
                  item.thumbnail && item.thumbnail !== "/images/placeholder-cake.png"
                    ? item.thumbnail
                    : item.image_url || "/images/placeholder-cake.webp";
                const qty = Math.max(1, Number(item.quantity || 1));
                const lineTaxable = Number(item.taxable_value ?? item.subtotal ?? item.total_line_amount ?? 0);
                const unitPrice = lineTaxable > 0
                  ? Math.round((lineTaxable / qty) * 100) / 100
                  : Number(item.unit_price || item.price || 0);
                const lineSubtotal = lineTaxable > 0 ? lineTaxable : Math.round(unitPrice * qty * 100) / 100;

                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200"
                    data-testid="order-line-item"
                  >
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-white">
                      <Image
                        src={img}
                        alt={item.title || "Cake"}
                        className="object-cover"
                        fill
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="text-sm font-bold text-slate-900 truncate pr-1">
                          {item.title || item.product_name || item.name}
                        </h3>
                        <span className="text-sm font-extrabold text-slate-900 shrink-0">
                          ₹{formatInr(lineSubtotal)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-semibold text-slate-500">
                          {qty} × ₹{formatInr(unitPrice)}
                        </span>
                        {item.weight && (
                          <span className="text-[10px] font-medium bg-blue-50 text-slate-900 px-1.5 py-0.5 rounded">
                            {item.weight}
                          </span>
                        )}
                      </div>

                      {item.cake_message && (
                        <p className="text-[11px] text-slate-500 italic mt-1 truncate">
                          &ldquo;{item.cake_message}&rdquo;
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
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col gap-4 text-sm">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-3">
              Payment Summary
            </h2>

            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900" data-testid="order-subtotal">
                ₹{formatInr(pricing.subtotal)}
              </span>
            </div>

            {Number(pricing.discount) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Discount</span>
                <span data-testid="order-discount">-₹{formatInr(pricing.discount)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-500">
              <span>Delivery Fee</span>
              <span className="font-semibold text-slate-900" data-testid="order-delivery-fee">
                {`₹${formatInr(pricing.delivery_fee)}`}
              </span>
            </div>

            {Number(pricing.slot_surcharge) > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>Slot Surcharge</span>
                <span className="font-semibold text-slate-900">
                  ₹{formatInr(pricing.slot_surcharge)}
                </span>
              </div>
            )}

            {/* GST Details Box */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex flex-col gap-1">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Statutory GST (Intra-State)</span>
                <span data-testid="order-gst">₹{Number(pricing.total_tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 pl-3">
                <span>CGST (2.5%)</span>
                <span>₹{Number(pricing.cgst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 pl-3">
                <span>SGST (2.5%)</span>
                <span>₹{Number(pricing.sgst).toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
              <span className="text-base font-extrabold text-slate-900">
                {isPaid ? "Total Paid" : "Total Amount"}
              </span>
              <span className="text-2xl font-black text-slate-900" data-testid="order-grand-total">
                ₹{formatInr(pricing.grand_total)}
              </span>
            </div>
          </div>

          {/* Action Links */}
          <div className="flex flex-col gap-3">
            <Link
              href={`/account/orders?highlight=${encodeURIComponent(order.id)}`}
              className="w-full py-3.5 px-4 bg-brand-primary hover:bg-black text-white text-center font-bold text-sm rounded-2xl shadow transition flex items-center justify-center gap-2"
            >
              <span>📋 View in My Orders</span>
            </Link>
            <Link
              href="/"
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 text-center font-semibold text-sm rounded-2xl transition"
            >
              ← Order More Cakes
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
