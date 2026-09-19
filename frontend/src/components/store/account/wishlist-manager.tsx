"use client";

import { useState, useEffect } from "react";
import { Trash2, ShoppingBag, Eye, Heart, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useFavorites } from "@/providers/favorites-provider";
import { addToCart } from "@frontend/lib/actions/carts";

interface WishlistItemInfo {
  id: string;
  product_id: string;
  title?: string;
  name?: string;
  thumbnail?: string | null;
  price?: number | null;
  selling_price?: number | null;
  mrp?: number | null;
  shop_id?: string;
  variant_id?: string;
  weight?: string;
  category?: string;
  category_slug?: string;
  handle?: string;
  is_available?: boolean;
  created_at?: string;
}

export function WishlistManager({
  initialItems,
}: {
  initialItems: WishlistItemInfo[];
}) {
  const { favoritesList, removeFavorite } = useFavorites();
  const [items, setItems] = useState<WishlistItemInfo[]>(initialItems);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [cartLoadingMap, setCartLoadingMap] = useState<Record<string, boolean>>({});
  const [notificationMsg, setNotificationMsg] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Sync with global favorites state if updated elsewhere
  useEffect(() => {
    if (favoritesList && favoritesList.length > 0) {
      setItems(favoritesList);
    }
  }, [favoritesList]);

  const handleRemove = async (productId: string) => {
    setLoadingMap((prev) => ({ ...prev, [productId]: true }));
    try {
      setItems((prev) => prev.filter((item) => item.product_id !== productId && item.id !== productId));
      await removeFavorite(productId);
      setNotificationMsg({ type: "success", message: "Removed cake from your Favorites." });
      setTimeout(() => setNotificationMsg(null), 3000);
    } catch (e) {
      console.error("Failed to remove item from wishlist", e);
      setNotificationMsg({ type: "error", message: "Could not remove cake. Please try again." });
      setTimeout(() => setNotificationMsg(null), 3000);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleAddToCart = async (item: WishlistItemInfo) => {
    const prodId = item.product_id || item.id;
    setCartLoadingMap((prev) => ({ ...prev, [prodId]: true }));
    try {
      await addToCart(item.variant_id || prodId, item.shop_id || "default_shop", {
        productId: prodId,
        title: item.title || item.name,
        price: item.price || item.selling_price,
        thumbnail: item.thumbnail || undefined,
      });
      setNotificationMsg({ type: "success", message: `🎉 Added "${item.title || item.name}" to your cart!` });
      setTimeout(() => setNotificationMsg(null), 4000);
    } catch (e: any) {
      console.error("Failed to add item to cart", e);
      setNotificationMsg({ type: "error", message: e?.message || "Failed to add cake to cart." });
      setTimeout(() => setNotificationMsg(null), 4000);
    } finally {
      setCartLoadingMap((prev) => ({ ...prev, [prodId]: false }));
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 border-2 border-dashed border-[#D4AF37]/20 rounded-2xl bg-gradient-to-b from-[#FDFBF7]/30 to-white text-center">
        <div className="w-16 h-16 rounded-full bg-brand-gold-soft/80 flex items-center justify-center text-[#D4AF37] mb-4 shadow-sm">
          <Heart className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Your Favorites list is empty</h3>
        <p className="text-gray-500 max-w-sm mb-6 text-xs leading-relaxed">
          Explore our signature celebratory cakes, artisanal mousse creations, and handcrafted desserts. Tap the heart icon to save your favorites here.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D2F5D] hover:bg-[#152347] text-white text-xs font-semibold rounded-lg shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
        >
          <Sparkles className="w-4 h-4" />
          Explore Gourmet Cakes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {notificationMsg && (
        <div
          className={`p-3 rounded-lg border text-xs font-semibold transition-all ${
            notificationMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-brand-gold-soft border-[#D4AF37]/30 text-[#1D2F5D]"
          }`}
        >
          {notificationMsg.message}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => {
          const prodId = item.product_id || item.id;
          const cakeHandle = item.handle || prodId;
          const displayPrice = item.price || item.selling_price || 0;
          const isAvail = item.is_available !== false;

          return (
            <div
              key={item.id || prodId}
              className="flex flex-col sm:flex-row gap-4 border border-gray-100 rounded-xl p-4 bg-white hover:shadow-md transition-shadow justify-between relative group"
            >
              <div className="flex gap-3.5 items-start">
                <Link href={`/products/${cakeHandle}`} className="relative shrink-0 overflow-hidden rounded-lg">
                  {item.thumbnail ? (
                    <Image
                      src={item.thumbnail}
                      alt={item.title || item.name || "Cake thumbnail"}
                      className="w-20 h-20 object-cover rounded-lg group-hover:scale-105 transition-transform"
                      width={80}
                      height={80}
                    />
                  ) : (
                    <div className="w-20 h-20 bg-brand-gold-soft rounded-lg flex items-center justify-center text-2xl">🍰</div>
                  )}
                </Link>
                <div className="flex flex-col gap-1">
                  {item.category && (
                    <span className="text-[10px] font-semibold tracking-wider uppercase text-[#1D2F5D]">
                      {item.category}
                    </span>
                  )}
                  <Link href={`/products/${cakeHandle}`}>
                    <h3 className="text-sm font-bold text-gray-900 hover:text-[#1D2F5D] transition-colors line-clamp-1">
                      {item.title || item.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-gray-900">₹{displayPrice.toFixed(0)}</span>
                    {item.mrp && item.mrp > displayPrice && (
                      <span className="text-[11px] text-gray-400 line-through">₹{item.mrp}</span>
                    )}
                    {item.weight && (
                      <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        {item.weight}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isAvail ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {isAvail ? "• Baked Fresh Daily" : "• Check Branch Availability"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col justify-end items-center sm:items-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <Link
                    href={`/products/${cakeHandle}`}
                    className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title="View Cake Details"
                    aria-label="View Cake Details"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleRemove(prodId)}
                    disabled={loadingMap[prodId]}
                    className="p-1.5 text-gray-400 hover:text-[#1D2F5D] hover:bg-brand-gold-soft rounded-lg transition-colors disabled:opacity-50"
                    title="Remove from Favorites"
                    aria-label="Remove from Favorites"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => handleAddToCart(item)}
                  disabled={cartLoadingMap[prodId]}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-[#1D2F5D] hover:bg-[#152347] text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Add to Cart
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
