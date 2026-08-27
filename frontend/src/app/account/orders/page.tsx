import { retrieveUser } from "@frontend/lib/data";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ArrowRight,
  RotateCcw,
  Sparkles,
  MapPin,
  Calendar,
  ExternalLink,
  Star
} from "lucide-react";

export const metadata = {
  title: "My Orders | CakeToHome",
  description: "View and track your CakeToHome artisan cake orders and delivery timelines.",
};

export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  const user = await retrieveUser();
  if (!user) {
    redirect("/login");
  }

  const { ApiEngine } = await import("@frontend/lib/api-engine");
  const customerReviews = user.customer_uid ? ApiEngine.getCustomerReviews(user.customer_uid) : [];

  const cleanPhone = user.normalized_phone || (user.phone ? user.phone.replace(/\D/g, "").slice(-10) : "");
  const allOrders = ApiEngine.getOrders();
  const customerOrders = (allOrders || []).filter((o: any) => {
    const matchUid = user.customer_uid && (o.customer_uid === user.customer_uid || o.customer_id === user.customer_uid);
    const matchPhone = cleanPhone && (o.customer_phone || o.phone || o.shipping_address?.phone || "").replace(/\D/g, "").slice(-10) === cleanPhone;
    return matchUid || matchPhone;
  });

  const sortedOrders = [...customerOrders].sort((a: any, b: any) => {
    return new Date(b.created_at || b.placed_at || 0).getTime() - new Date(a.created_at || a.placed_at || 0).getTime();
  });

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
        </span>
      );
    }
    if (s === "out_for_delivery" || s === "shipped") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
          <Truck className="w-3.5 h-3.5" /> Out for Delivery
        </span>
      );
    }
    if (s === "preparing" || s === "processing" || s === "baking") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock className="w-3.5 h-3.5" /> Preparing in Kitchen
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
        <Package className="w-3.5 h-3.5" /> Confirmed
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-amber-400" />
            <span>Order History</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time kitchen status, delivery rider tracking, and 1-click reordering.
          </p>
        </div>

        <Link
          href="/shop"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black transition-all shadow-md shadow-amber-500/20 active:scale-95 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" /> Order Fresh Cake
        </Link>
      </div>

      {/* Orders List */}
      {sortedOrders.length === 0 ? (
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-neutral-800/80 text-neutral-400 mx-auto flex items-center justify-center">
            <Package className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">No Orders Found Yet</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Your freshly baked celebrations will appear here with live tracking once you place an order.
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 text-white text-xs font-black hover:opacity-95 transition-all shadow-lg active:scale-95"
          >
            Explore Gourmet Cakes &rarr;
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedOrders.map((ord: any) => {
            const firstItem = ord.items?.[0] || {};
            const cakeTitle = firstItem.title || firstItem.name || "Artisanal Celebration Cake";
            const cakeThumbnail = firstItem.thumbnail || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=300&q=80";
            const itemCount = ord.items?.length || 1;
            const orderTotal = Number(ord.total || ord.grand_total || ord.pricing?.grand_total || 0);
            const placedDate = ord.created_at || ord.placed_at
              ? new Date(ord.created_at || ord.placed_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })
              : "Recent";
            const isDelivered = (ord.status || ord.delivery_status || "").toLowerCase() === "delivered";
            const firstItemProdId = firstItem.product_id || firstItem.id;
            const existingReview = customerReviews.find(
              (r: any) => r.order_id === ord.id && (r.product_id === firstItemProdId || r.product_id === `prod_${firstItemProdId}`)
            );

            return (
              <div
                key={ord.id || ord.order_number}
                className="bg-neutral-900/80 border border-neutral-800/90 hover:border-neutral-700/80 rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-sm transition-all space-y-4"
              >
                {/* Order Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800/80 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-neutral-200">
                      {ord.order_number || ord.id}
                    </span>
                    <span className="text-neutral-500">•</span>
                    <span className="text-neutral-400 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                      {placedDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(ord.status || ord.delivery_status)}
                  </div>
                </div>

                {/* Cake Line Item Details */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-neutral-950 border border-neutral-800 shrink-0">
                      <img
                        src={cakeThumbnail}
                        alt={cakeTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-white line-clamp-1">{cakeTitle}</h4>
                      {itemCount > 1 && (
                        <p className="text-xs text-amber-400 font-medium">+ {itemCount - 1} more treat{itemCount > 2 ? "s" : ""}</p>
                      )}
                      {firstItem.cake_message && (
                        <p className="text-xs text-neutral-400 italic">
                          &ldquo;{firstItem.cake_message}&rdquo;
                        </p>
                      )}
                      {ord.branch_name && (
                        <p className="text-[11px] text-neutral-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Baked at {ord.branch_name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
                    <p className="text-lg sm:text-xl font-black text-white">
                      ₹{orderTotal.toLocaleString("en-IN")}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {isDelivered && firstItemProdId && (
                        existingReview ? (
                          <Link
                            href={`/products/${firstItemProdId}#customer-reviews-section`}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            Reviewed ({existingReview.rating}★)
                          </Link>
                        ) : (
                          <Link
                            href={`/products/${firstItemProdId}#customer-reviews-section`}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/20 active:scale-95"
                          >
                            <Star className="w-3.5 h-3.5 fill-white text-white" />
                            Write a Review
                          </Link>
                        )
                      )}

                      <Link
                        href={`/track?order_id=${ord.id || ord.order_number}`}
                        className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Truck className="w-3.5 h-3.5 text-amber-400" />
                        Track
                      </Link>

                      <Link
                        href={`/shop`}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reorder
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
