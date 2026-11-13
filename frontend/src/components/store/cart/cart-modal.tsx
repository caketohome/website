"use client";

import React, { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
  MapPin,
  MessageSquare,
} from "lucide-react";
import {
  removeItemFromCart,
  updateCartItemQuantity,
  updateCartItemMessage,
} from "@frontend/lib/actions/carts";
import { cartBus } from "@frontend/lib/cart/cart-event-bus";

export interface CartModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  cart?: Record<string, any> | null;
  handleCheckoutClick?: () => void;
  onCartUpdate?: (cart: any) => void;
}

export default function CartModal({
  isOpen = false,
  onClose,
  cart,
  handleCheckoutClick,
  onCartUpdate,
}: CartModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen to cartBus errors to display inside drawer if opened
  useEffect(() => {
    const unsubError = cartBus.onCartError((err) => {
      setDrawerError(err);
    });
    return () => unsubError();
  }, []);

  // Lock body scroll and restore exact scroll position upon closing
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalLeft = document.body.style.left;
    const originalRight = document.body.style.right;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);

      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.left = originalLeft;
      document.body.style.right = originalRight;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;

      window.scrollTo({
        top: scrollY,
        behavior: "instant" as ScrollBehavior,
      });
    };
  }, [isOpen, onClose]);

  const [activeCart, setActiveCart] = useState(cart);
  const [isFetchingCart, setIsFetchingCart] = useState(false);
  const lastBusUpdateAtRef = React.useRef<number>(0);

  useEffect(() => {
    if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
      setActiveCart(cart);
      setIsFetchingCart(false);
    } else if (!activeCart || !activeCart.items || activeCart.items.length === 0) {
      setActiveCart(cart);
    }
  }, [cart]);

  // Refresh cart on drawer open from authoritative PostgreSQL endpoint
  useEffect(() => {
    if (!isOpen) return;
    const hasExistingItems = Boolean(activeCart && Array.isArray(activeCart.items) && activeCart.items.length > 0);
    if (!hasExistingItems) {
      setIsFetchingCart(true);
    }
    setDrawerError(null);
    const fetchStartedAt = Date.now();
    let cancelled = false;

    fetch("/api/v1/cart", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load cart from server");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Do not overwrite if a fresher cartBus event arrived after this fetch started
        if (lastBusUpdateAtRef.current > fetchStartedAt) return;
        if (data?.cart && Array.isArray(data.cart.items)) {
          if (data.cart.items.length > 0 || !hasExistingItems) {
            setActiveCart(data.cart);
            onCartUpdate?.(data.cart);
          }
        }
      })
      .catch((err) => {
        if (!cancelled && !hasExistingItems) {
          setDrawerError(err.message || "Failed to load cart");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsFetchingCart(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Synchronize with external cartBus updates
  useEffect(() => {
    const unsub = cartBus.onCartUpdated((newCart) => {
      lastBusUpdateAtRef.current = Date.now();
      setActiveCart(newCart);
      setIsFetchingCart(false);
      setDrawerError(null);
    });
    const unsubError = cartBus.onCartError((errMsg) => {
      setIsFetchingCart(false);
      setDrawerError(errMsg);
    });
    return () => {
      unsub();
      unsubError();
    };
  }, []);

  if (!isOpen || !mounted) {
    return null;
  }

  const items = Array.isArray(activeCart?.items) ? activeCart.items : [];
  const totalItemCount = items.reduce(
    (acc: number, item: any) => acc + Number(item.quantity || 1),
    0
  );

  const subtotal = items.reduce(
    (acc: number, item: any) =>
      acc + Number(item.unit_price || item.price || 0) * Number(item.quantity || 1),
    0
  );

  // Read location cookies or activeCart metadata for truthful delivery fee
  const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  };

  const deliveryLocation = getCookie("delivery_location") ? decodeURIComponent(getCookie("delivery_location")!) : null;
  const deliveryPincode = getCookie("delivery_pincode");
  const deliveryFeeCookie = getCookie("delivery_fee");

  // Determine delivery fee from cart or location cookie
  let resolvedDeliveryFee: number | null = null;
  if (typeof activeCart?.delivery_fee === "number") {
    resolvedDeliveryFee = activeCart.delivery_fee;
  } else if (deliveryFeeCookie) {
    const rawFee = decodeURIComponent(deliveryFeeCookie).trim().toLowerCase();
    if (rawFee === "free" || rawFee === "0") {
      resolvedDeliveryFee = 0;
    } else {
      const parsed = parseFloat(rawFee.replace(/[^0-9.]/g, ""));
      resolvedDeliveryFee = isNaN(parsed) ? null : parsed;
    }
  }

  // Delivery rules threshold (from backend fulfillment rules or default 999)
  const freeDeliveryThreshold = activeCart?.fulfillment_rules?.free_delivery_threshold || 999;
  const hasThreshold = Boolean(deliveryPincode || deliveryLocation || activeCart?.fulfillment_rules);
  const amountNeededForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);
  const deliveryProgressPercent = Math.min(100, Math.round((subtotal / freeDeliveryThreshold) * 100));

  // Determine delivery label and display styling
  let deliveryLabel = "Calculated at checkout";
  let deliveryClass = "text-slate-500 font-sans";
  if (resolvedDeliveryFee === 0) {
    deliveryLabel = "FREE";
    deliveryClass = "text-emerald-600 font-bold font-sans";
  } else if (typeof resolvedDeliveryFee === "number") {
    deliveryLabel = `₹${resolvedDeliveryFee.toLocaleString("en-IN")}`;
    deliveryClass = "font-medium text-slate-900 font-sans";
  } else if (!deliveryPincode && !deliveryLocation) {
    deliveryLabel = "Select delivery location";
    deliveryClass = "text-slate-500 italic font-sans text-[11px]";
  }

  const grandTotal = subtotal + (typeof resolvedDeliveryFee === "number" ? resolvedDeliveryFee : 0);

  const handleCheckout = () => {
    if (items.length === 0) return;
    if (handleCheckoutClick) {
      handleCheckoutClick();
    } else {
      onClose?.();
      router.push("/checkout");
    }
  };

  const handleBrowseCatalog = () => {
    onClose?.();
    router.push("/products");
  };

  const handleViewBag = () => {
    onClose?.();
    router.push("/cart");
  };

  const drawerContent = (
    <div
      data-testid="cart-drawer-root"
      className="fixed inset-0 z-[2000] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag"
    >
      {/* Backdrop Overlay with blur */}
      <div
        data-testid="cart-backdrop"
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div
        data-testid="cart-drawer-panel"
        className="relative z-10 w-full sm:w-[440px] md:w-[480px] h-full bg-[#FAF8F5] text-slate-900 flex flex-col shadow-2xl border-l border-slate-200/80 transition-transform duration-300 ease-out animate-in slide-in-from-right duration-300"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-[#2563EB]">
              <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-serif font-bold text-[#0F172A] leading-none">
                  Your Bag
                </h2>
                <span
                  data-testid="cart-header-count"
                  className="px-2 py-0.5 rounded-full bg-[#2563EB] text-white font-sans text-xs font-bold shadow-xs"
                >
                  {totalItemCount}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                Fresh gourmet bakes handcrafted to order
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close bag"
            data-testid="cart-close-button"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Truthful Delivery Status Banner */}
        {items.length > 0 && (
          resolvedDeliveryFee === 0 ? (
            <div className="bg-[#1E3A8A] text-white px-5 sm:px-6 py-2.5 shrink-0 shadow-inner flex items-center justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                Free Delivery confirmed {deliveryLocation ? `for ${deliveryLocation.split("—")[0].trim()}` : "for your order"}
              </span>
            </div>
          ) : hasThreshold && amountNeededForFreeDelivery > 0 ? (
            <div className="bg-[#1E3A8A] text-white px-5 sm:px-6 py-2.5 shrink-0 shadow-inner">
              <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                  <span>
                    Add <strong className="text-blue-200">₹{amountNeededForFreeDelivery}</strong> more for{" "}
                    <strong>FREE Delivery</strong>
                  </span>
                </span>
                <span className="text-[11px] text-blue-200 font-mono">
                  {deliveryProgressPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-indigo-300 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${deliveryProgressPercent}%` }}
                />
              </div>
            </div>
          ) : !deliveryLocation && !deliveryPincode ? (
            <div className="bg-slate-100 border-b border-slate-200 text-slate-700 px-5 sm:px-6 py-2 shrink-0 flex items-center gap-1.5 text-xs">
              <MapPin className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
              <span>Select delivery location at header or checkout to calculate delivery fee</span>
            </div>
          ) : null
        )}

        {/* Error Notification Banner */}
        {drawerError && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="truncate">{drawerError}</span>
            </div>
            <button
              type="button"
              onClick={() => setDrawerError(null)}
              className="text-rose-500 hover:text-rose-700 font-bold px-1.5 py-0.5 rounded text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scrollable Cart Items Container */}
        <div
          data-testid="cart-items-container"
          className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 flex flex-col gap-3.5 scrollbar-thin"
        >
          {items.length > 0 ? (
            items.map((item: any) => (
              <DrawerCartItem
                key={item.id}
                item={item}
                activeCart={activeCart}
                onOptimisticUpdate={(optCart) => {
                  setActiveCart(optCart);
                  onCartUpdate?.(optCart);
                }}
                onCartUpdate={(srvCart) => {
                  setActiveCart(srvCart);
                  onCartUpdate?.(srvCart);
                }}
                onError={(err) => setDrawerError(err)}
              />
            ))
          ) : isFetchingCart ? (
            /* Loading Cart State — prevents empty-state flash while cart is being fetched */
            <div
              data-testid="cart-loading-state"
              className="py-16 sm:py-20 text-center flex flex-col items-center justify-center gap-3 my-auto px-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
              </div>
              <p className="text-xs text-slate-500 font-sans animate-pulse">
                Fetching your bag...
              </p>
            </div>
          ) : drawerError ? (
            /* Error State — NEVER show 'Your bag is empty' when an API error occurred */
            <div
              data-testid="cart-error-state"
              className="py-16 sm:py-20 text-center flex flex-col items-center justify-center gap-4 my-auto px-6"
            >
              <div className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
                <AlertCircle className="w-10 h-10 stroke-[1.5]" />
              </div>
              <div className="space-y-1 max-w-xs">
                <h3 className="text-lg font-serif font-bold text-slate-900">
                  Unable to load your bag
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  {drawerError}
                </p>
              </div>
              <button
                type="button"
                data-testid="retry-cart-button"
                onClick={() => {
                  setDrawerError(null);
                  setIsFetchingCart(true);
                  fetch("/api/v1/cart")
                    .then((r) => {
                      if (!r.ok) throw new Error("Failed to load cart from server");
                      return r.json();
                    })
                    .then((data) => {
                      if (data?.cart) {
                        setActiveCart(data.cart);
                        onCartUpdate?.(data.cart);
                      }
                    })
                    .catch((err) => setDrawerError(err.message || "Failed to load cart"))
                    .finally(() => setIsFetchingCart(false));
                }}
                className="mt-2 px-6 py-2.5 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-sans text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>Retry</span>
              </button>
            </div>
          ) : (
            /* Luxury Empty State */
            <div
              data-testid="cart-empty-state"
              className="py-16 sm:py-20 text-center flex flex-col items-center justify-center gap-4 my-auto px-6"
            >
              <div className="w-20 h-20 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shadow-xs">
                <ShoppingBag className="w-10 h-10 stroke-[1.5] text-[#2563EB]" />
              </div>
              <div className="space-y-1 max-w-xs">
                <h3 className="text-lg font-serif font-bold text-[#0F172A]">
                  Your bag is empty
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-sans">
                  Explore our signature gourmet cakes, artisanal pastries, and celebration desserts.
                </p>
              </div>
              <button
                type="button"
                data-testid="browse-cakes-button"
                onClick={handleBrowseCatalog}
                className="mt-2 px-6 py-3 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white font-sans text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <span>Explore Gourmet Cakes</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Sticky Summary & Checkout Footer */}
        {items.length > 0 && (
          <div
            data-testid="cart-drawer-footer"
            className="shrink-0 border-t border-slate-200/80 p-4 sm:p-5 bg-white/95 backdrop-blur-md flex flex-col gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            {/* Price Breakdown */}
            <div className="space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span className="font-sans">Subtotal ({totalItemCount} items)</span>
                <span className="font-medium text-slate-900 font-sans">
                  ₹{subtotal.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span>Standard Delivery</span>
                <span className={deliveryClass}>
                  {deliveryLabel}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between items-baseline">
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-500">
                    Total Payable
                  </span>
                  {resolvedDeliveryFee === null && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      excl. delivery fee
                    </span>
                  )}
                </div>
                <span
                  data-testid="cart-total-payable"
                  className="font-serif text-2xl font-bold text-[#0F172A]"
                >
                  ₹{grandTotal.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              data-testid="cart-checkout-button"
              onClick={handleCheckout}
              disabled={items.length === 0}
              className="w-full py-4 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-[0.99] text-white font-sans text-xs font-bold uppercase tracking-[0.15em] rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Secondary Link: View Full Bag */}
            <button
              type="button"
              onClick={handleViewBag}
              className="w-full py-1 text-center text-[11px] uppercase tracking-wider font-semibold text-slate-500 hover:text-[#2563EB] transition-colors cursor-pointer"
            >
              View Full Bag & Customizations
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}

// ── Individual Cart Line Item Row ──
function DrawerCartItem({
  item,
  activeCart,
  onOptimisticUpdate,
  onCartUpdate,
  onError,
}: {
  item: Record<string, any>;
  activeCart?: any;
  onOptimisticUpdate?: (cart: any) => void;
  onCartUpdate?: (cart: any) => void;
  onError?: (err: string) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  const deleteItem = async (itemId: string) => {
    if (updating) return;

    // Optimistic deletion
    if (activeCart && onOptimisticUpdate) {
      const updatedItems = (activeCart.items || []).filter((i: any) => i.id !== itemId);
      const newSubtotal = updatedItems.reduce((s: number, i: any) => s + (Number(i.total_price || i.subtotal) || 0), 0);
      onOptimisticUpdate({
        ...activeCart,
        items: updatedItems,
        subtotal: newSubtotal,
        total: newSubtotal,
      });
    }

    setUpdating(true);
    try {
      const res = await removeItemFromCart(itemId);
      if (res?.cart) {
        cartBus.emitCartUpdated(res.cart);
        onCartUpdate?.(res.cart);
      }
    } catch (err: any) {
      console.error("Failed to remove cart item:", err);
      onError?.(err.message || "Failed to remove item. Please try again.");
      if (activeCart && onOptimisticUpdate) {
        onOptimisticUpdate(activeCart);
      }
    } finally {
      setUpdating(false);
    }
  };

  const changeQuantity = async (delta: number) => {
    if (updating) return;
    const currentQty = Number(item.quantity || 1);
    const newQty = currentQty + delta;
    if (newQty <= 0) {
      await deleteItem(item.id);
      return;
    }

    // Optimistic quantity increment
    if (activeCart && onOptimisticUpdate) {
      const updatedItems = (activeCart.items || []).map((i: any) => {
        if (i.id === item.id) {
          const uPrice = Number(i.unit_price || i.price || 0);
          return {
            ...i,
            quantity: newQty,
            total_price: newQty * uPrice,
            subtotal: newQty * uPrice,
          };
        }
        return i;
      });
      const newSubtotal = updatedItems.reduce((s: number, i: any) => s + (Number(i.total_price || i.subtotal) || 0), 0);
      onOptimisticUpdate({
        ...activeCart,
        items: updatedItems,
        subtotal: newSubtotal,
        total: newSubtotal,
      });
    }

    setUpdating(true);
    try {
      const res = await updateCartItemQuantity(item.id, newQty);
      if (res?.cart) {
        cartBus.emitCartUpdated(res.cart);
        onCartUpdate?.(res.cart);
      }
    } catch (err: any) {
      console.error("Failed to update item quantity:", err);
      onError?.(err.message || "Failed to update quantity. Please try again.");
      if (activeCart && onOptimisticUpdate) {
        onOptimisticUpdate(activeCart);
      }
    } finally {
      setUpdating(false);
    }
  };

  const thumbnail =
    item.thumbnail ||
    item.image_url ||
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=200";

  const title = item.title || item.name || "Gourmet Bakery Item";
  const unitPrice = Number(item.unit_price || item.price || 0);
  const currentQuantity = Number(item.quantity || 1);
  const lineTotal = unitPrice * currentQuantity;

  // Metadata attributes
  const meta = item.metadata || {};
  const weight = item.weight || meta.weight || null;
  const flavour = item.flavour || meta.flavour || null;
  const shape = item.shape || meta.shape || null;
  const cakeMessage = item.cake_message || meta.cake_message || null;
  const photoCake = item.photo_cake || meta.photo_cake || null;
  const selectedAddons = Array.isArray(item.selected_addons) && item.selected_addons.length > 0
    ? item.selected_addons
    : Array.isArray(meta.selected_addons)
      ? meta.selected_addons
      : [];

  const isCakeItem =
    !String(item.product_id || "").startsWith("acc_") &&
    !String(title).toLowerCase().includes("bouquet") &&
    !String(title).toLowerCase().includes("candle") &&
    !String(title).toLowerCase().includes("topper") &&
    !String(title).toLowerCase().includes("balloon");

  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [draftMessage, setDraftMessage] = useState<string>(cakeMessage || "");

  useEffect(() => {
    setDraftMessage(cakeMessage || "");
  }, [cakeMessage]);

  const handleSaveCakeMessage = async () => {
    if (updating) return;
    const trimmed = draftMessage.trim().slice(0, 30);
    setUpdating(true);
    try {
      const res = await updateCartItemMessage(item.id, trimmed || null);
      if (res?.cart) {
        cartBus.emitCartUpdated(res.cart);
        onCartUpdate?.(res.cart);
      }
      setIsEditingMessage(false);
    } catch (err: any) {
      onError?.(err.message || "Failed to update cake message");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      data-testid={`cart-item-${item.id}`}
      className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-200 transition-all group"
    >
      {/* Thumbnail */}
      <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200/60">
        <Image
          src={thumbnail}
          alt={title}
          className="object-cover"
          fill
          sizes="80px"
        />
        {updating && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-[#2563EB] animate-spin" />
          </div>
        )}
      </div>

      {/* Item Details */}
      <div className="flex flex-col flex-1 min-w-0 py-0.5">
        {/* Title & Remove Button */}
        <div className="flex justify-between items-start gap-1">
          <h3 className="text-xs sm:text-[13px] font-sans font-bold text-[#0F172A] truncate pr-1">
            {title}
          </h3>
          <button
            type="button"
            onClick={() => deleteItem(item.id)}
            disabled={updating}
            aria-label={`Remove ${title} from bag`}
            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
          </button>
        </div>

        {/* Tags / Customizations */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {weight && (
            <span className="text-[10px] font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              {weight}
            </span>
          )}
          {flavour && (
            <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              {flavour}
            </span>
          )}
          {shape && (
            <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              {shape}
            </span>
          )}
        </div>

        {/* Message Inscription / Reminder */}
        {isEditingMessage ? (
          <div className="mt-1.5 p-2 rounded-xl bg-amber-50/70 border border-amber-200 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Message on Cake
              </span>
              <span className="text-[10px] font-bold text-amber-700">
                {draftMessage.length}/30
              </span>
            </div>
            <input
              type="text"
              maxLength={30}
              value={draftMessage}
              onChange={(e) => setDraftMessage(e.target.value.slice(0, 30))}
              placeholder="Write message (max 30 chars)"
              data-testid="cart-item-message-input"
              className="w-full px-2 py-1 text-xs rounded-lg border border-amber-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setDraftMessage(cakeMessage || "");
                  setIsEditingMessage(false);
                }}
                className="px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updating}
                onClick={handleSaveCakeMessage}
                data-testid="cart-item-message-save-btn"
                className="px-2.5 py-0.5 text-[10px] font-bold rounded-md bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
              >
                Save
              </button>
            </div>
          </div>
        ) : cakeMessage ? (
          <div className="flex items-center justify-between gap-1.5 mt-1 bg-amber-50/60 border border-amber-200/50 rounded px-1.5 py-0.5">
            <p
              data-testid="cart-item-cake-message"
              className="text-[10px] text-slate-600 italic truncate"
            >
              🎂 &ldquo;{cakeMessage}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setIsEditingMessage(true)}
              data-testid="cart-item-edit-message-btn"
              className="text-[10px] font-semibold text-[#2563EB] hover:underline shrink-0"
            >
              Edit
            </button>
          </div>
        ) : isCakeItem ? (
          <button
            type="button"
            onClick={() => setIsEditingMessage(true)}
            data-testid="cart-item-add-message-btn"
            className="mt-1 text-[10px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50/60 hover:bg-amber-100/70 border border-amber-200/60 rounded px-1.5 py-0.5 flex items-center gap-1 w-fit transition-colors"
          >
            <MessageSquare className="w-2.5 h-2.5" />
            <span>+ Add message on cake (Optional)</span>
          </button>
        ) : null}

        {/* Photo Cake indicator */}
        {photoCake && (
          <span className="text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-200/60 rounded px-1.5 py-0.5 mt-1 inline-block w-fit">
            📷 Custom Photo Print
          </span>
        )}

        {/* Addons List */}
        {selectedAddons.length > 0 && (
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            + {selectedAddons.join(", ")}
          </p>
        )}

        {/* Quantity Controls & Line Total */}
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100">
          {/* Stepper */}
          <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-xl px-1 py-0.5 shadow-xs">
            <button
              type="button"
              data-testid="cart-drawer-qty-minus"
              disabled={updating || currentQuantity <= 1}
              onClick={() => changeQuantity(-1)}
              aria-label="Decrease quantity"
              className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-white transition-all cursor-pointer"
            >
              <Minus className="w-3 h-3 stroke-[2.5]" />
            </button>
            <span
              data-testid="cart-drawer-qty-value"
              className="text-xs font-bold text-[#0F172A] min-w-6 text-center font-mono"
            >
              {currentQuantity}
            </span>
            <button
              type="button"
              data-testid="cart-drawer-qty-plus"
              disabled={updating}
              onClick={() => changeQuantity(1)}
              aria-label="Increase quantity"
              className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30 rounded-lg hover:bg-white transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="text-xs sm:text-sm font-bold font-serif text-[#0F172A]">
              ₹{lineTotal.toLocaleString("en-IN")}
            </div>
            {currentQuantity > 1 && (
              <div className="text-[10px] text-slate-400 font-sans">
                ₹{unitPrice} each
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
