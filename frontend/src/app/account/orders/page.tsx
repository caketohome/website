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
import { ReorderButton } from "@frontend/components/store/account/reorder-button";

export const metadata = {
  title: "My Orders | CakeToHome",
  description: "View and track your CakeToHome artisan cake orders and delivery timelines.",
};

export const dynamic = "force-dynamic";

interface AccountOrdersPageProps {
  searchParams?: Promise<{ page?: string }> | { page?: string };
}

export default async function AccountOrdersPage({ searchParams }: AccountOrdersPageProps) {
  const user = await retrieveUser();
  if (!user) {
    redirect("/login");
  }

  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  const page = Math.max(1, parseInt(resolvedParams.page || "1", 10) || 1);
  const pageSize = 20;

  const { ApiEngine } = await import("@frontend/lib/api-engine");
  const { OrderRepository } = await import("@frontend/lib/repositories");
  const customerReviews = user.customer_uid ? ApiEngine.getCustomerReviews(user.customer_uid) : [];

  let sortedOrders: any[] = [];
  let totalOrders = 0;
  let totalPages = 1;

  // 1. Authoritative: OrderRepository directly with database pagination
  const customerId = user.customer_uid || user.id;
  if (customerId) {
    try {
      const dbResult = await OrderRepository.listOrders({
        page,
        pageSize,
        customer_id: customerId,
      });
      if (dbResult) {
        sortedOrders = dbResult.items;
        totalOrders = dbResult.total;
        totalPages = dbResult.totalPages;
      }
    } catch (e: any) {
      console.warn("[AccountOrdersPage] DB query warning:", e.message);
    }
  }

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EAF7EF] text-[#16834A] border border-emerald-500/20">
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
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
          <Clock className="w-3.5 h-3.5" /> Preparing in Kitchen
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
        <Package className="w-3.5 h-3.5" /> Confirmed
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-brand-text tracking-tight flex items-center gap-2.5">
            <ShoppingBag className="w-6 h-6 text-brand-gold" />
            <span>Order History</span>
          </h2>
          <p className="text-xs text-brand-text-muted mt-1">
            Real-time kitchen status, delivery rider tracking, and 1-click reordering.
          </p>
        </div>

        <Link
          href="/shop"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-brand-navy hover:bg-brand-primary text-white text-xs font-black transition-all shadow-md shadow-brand-gold/20 active:scale-95 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" /> Order Fresh Cake
        </Link>
      </div>

      {/* Orders List */}
      {sortedOrders.length === 0 ? (
        <div className="bg-white border border-brand-border rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-brand-surface-muted text-brand-text-muted mx-auto flex items-center justify-center">
            <Package className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-brand-text">No Orders Found Yet</h3>
            <p className="text-xs text-brand-text-muted max-w-sm mx-auto">
              Your freshly baked celebrations will appear here with live tracking once you place an order.
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-brand-gold to-brand-gold text-white text-xs font-black hover:opacity-95 transition-all shadow-lg active:scale-95"
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
                className="bg-white border border-brand-border hover:border-brand-border rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-sm transition-all space-y-4"
              >
                {/* Order Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-brand-border text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-brand-text">
                      {ord.order_number || ord.id}
                    </span>
                    <span className="text-brand-text-muted">•</span>
                    <span className="text-brand-text-muted flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-brand-text-muted" />
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
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-brand-warm-white border border-brand-border shrink-0">
                      <img
                        src={cakeThumbnail}
                        alt={cakeTitle}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-brand-text line-clamp-1">{cakeTitle}</h4>
                      {itemCount > 1 && (
                        <p className="text-xs text-brand-gold font-medium">+ {itemCount - 1} more treat{itemCount > 2 ? "s" : ""}</p>
                      )}
                      {firstItem.cake_message && (
                        <p className="text-xs text-brand-text-muted italic">
                          &ldquo;{firstItem.cake_message}&rdquo;
                        </p>
                      )}
                      {ord.branch_name && (
                        <p className="text-[11px] text-brand-text-muted flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Baked at {ord.branch_name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Price & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-brand-border">
                    <p className="text-lg sm:text-xl font-black text-brand-text">
                      ₹{orderTotal.toLocaleString("en-IN")}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      {isDelivered && firstItemProdId && (
                        existingReview ? (
                          <Link
                            href={`/products/${firstItemProdId}#customer-reviews-section`}
                            className="px-3.5 py-1.5 rounded-xl bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold/40 border border-brand-gold/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Star className="w-3.5 h-3.5 fill-brand-gold text-brand-gold" />
                            Reviewed ({existingReview.rating}★)
                          </Link>
                        ) : (
                          <Link
                            href={`/products/${firstItemProdId}#customer-reviews-section`}
                            className="px-3.5 py-1.5 rounded-xl bg-brand-navy hover:bg-brand-navy text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/20 active:scale-95"
                          >
                            <Star className="w-3.5 h-3.5 fill-white text-brand-text" />
                            Write a Review
                          </Link>
                        )
                      )}

                      <Link
                        href={`/track?order_id=${ord.id || ord.order_number}`}
                        className="px-3.5 py-1.5 rounded-xl bg-brand-surface-muted hover:bg-brand-surface-muted text-brand-text hover:text-brand-navy text-xs font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <Truck className="w-3.5 h-3.5 text-brand-gold" />
                        Track
                      </Link>

                      <ReorderButton orderId={ord.id || ord.order_number} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 border-t border-brand-border text-xs">
              <span className="text-brand-text-muted font-medium">
                Showing page <span className="text-brand-text font-bold">{page}</span> of{" "}
                <span className="text-brand-text font-bold">{totalPages}</span> ({totalOrders} orders)
              </span>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <Link
                    href={`/account/orders?page=${page - 1}`}
                    className="px-3.5 py-1.5 rounded-xl bg-brand-surface-muted hover:bg-brand-surface-muted text-brand-text hover:text-brand-navy font-bold transition-colors"
                  >
                    &larr; Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/account/orders?page=${page + 1}`}
                    className="px-3.5 py-1.5 rounded-xl bg-brand-navy hover:bg-brand-primary text-white font-bold transition-all shadow-md shadow-brand-gold/20"
                  >
                    Next &rarr;
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
