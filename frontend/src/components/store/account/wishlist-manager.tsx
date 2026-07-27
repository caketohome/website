"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Image from "next/image";

interface WishlistItemInfo {
  id: string;
  product_id: string;
  title: string;
  thumbnail?: string | null;
  price?: number | null;
  shop_id?: string;
  variant_id?: string;
}

export function WishlistManager({
  initialItems,
}: {
  initialItems: WishlistItemInfo[];
}) {
  const [items, setItems] = useState<WishlistItemInfo[]>(initialItems);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [cartLoadingMap, setCartLoadingMap] = useState<Record<string, boolean>>({});
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const handleRemove = async (productId: string) => {
    setLoadingMap((prev) => ({ ...prev, [productId]: true }));
    try {
      setItems((prev) => prev.filter((item) => item.product_id !== productId));
    } catch (e) {
      console.error("Failed to remove item from wishlist", e);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const handleAddToCart = async (item: WishlistItemInfo) => {
    if (!item.variant_id) return;
    setCartLoadingMap((prev) => ({ ...prev, [item.product_id]: true }));
    try {
      setNotificationMsg(`Added ${item.title} to your cart!`);
      setTimeout(() => setNotificationMsg(null), 4000);
    } catch (e) {
      console.error("Failed to add item to cart", e);
    } finally {
      setCartLoadingMap((prev) => ({ ...prev, [item.product_id]: false }));
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg bg-gray-50">
        <p className="text-gray-500 mb-4 text-sm font-medium">Your wishlist is currently empty.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {notificationMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
          🎉 {notificationMsg}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 border rounded-lg p-4 bg-white items-center justify-between shadow-sm">
            <div className="flex gap-3 items-center">
              {item.thumbnail ? (
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-16 h-16 object-cover rounded-md"
                  width={64}
                  height={64}
                />
              ) : (
                <div className="w-16 h-16 bg-pink-50 rounded-md flex items-center justify-center text-xl">🍰</div>
              )}
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                {item.price && <p className="text-xs text-gray-500">₹{item.price.toFixed(2)}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              {item.variant_id && (
                <button 
                  onClick={() => handleAddToCart(item)}
                  disabled={cartLoadingMap[item.product_id]}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
                >
                  Add to Cart
                </button>
              )}
              <button
                onClick={() => handleRemove(item.product_id)}
                disabled={loadingMap[item.product_id]}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
