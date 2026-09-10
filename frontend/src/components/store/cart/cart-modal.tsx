"use client";

import { removeItemFromCart, updateCartItemQuantity } from "@frontend/lib/actions/carts";
import { XMark } from "@medusajs/icons";
import { Button, Container, Heading, IconButton, Text } from "@medusajs/ui";
import Image from "next/image";
import { useState } from "react";

export default function CartModal({
  cart,
  handleCheckoutClick,
}: {
  cart: Record<string, any>;
  handleCheckoutClick: () => void;
}) {
  const items = Array.isArray(cart?.items) ? cart.items : [];
  const subtotal = items.reduce((acc: number, item: any) => acc + (Number(item.unit_price || item.price || 0) * Number(item.quantity || 1)), 0);

  return (
    <Container className="flex flex-col gap-4 w-[calc(100vw-32px)] max-w-96 max-h-[85vh] overflow-y-auto m-0 shadow-2xl rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
        <Heading level="h2" className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <span>🛒</span> Your Cart ({items.length} {items.length === 1 ? "item" : "items"})
        </Heading>
        {subtotal > 0 && (
          <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
            ₹{subtotal.toLocaleString("en-IN")}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
        {items.length > 0 ? (
          items.map((item: any) => (
            <CartItem key={item.id} item={item} />
          ))
        ) : (
          <div className="py-8 text-center flex flex-col items-center gap-2 text-zinc-400">
            <span className="text-3xl">🎂</span>
            <Text className="text-sm font-medium">Your cart is currently empty.</Text>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3 flex flex-col gap-2">
          <div className="flex justify-between items-center text-sm mb-1">
            <span className="text-zinc-500 font-medium">Estimated Subtotal:</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">₹{subtotal.toLocaleString("en-IN")}</span>
          </div>
          <Button
            variant="primary"
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            size="large"
            onClick={handleCheckoutClick}
            disabled={items.length === 0}
          >
            <span>Proceed to Checkout</span>
            <span>→</span>
          </Button>
          <a
            href="/cart"
            className="w-full py-2 text-center text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            View Full Cart Details
          </a>
        </div>
      )}
    </Container>
  );
}

function CartItem({ item }: { item: Record<string, any> }) {
  const [updating, setUpdating] = useState(false);

  const deleteItem = async (itemId: string) => {
    setUpdating(true);
    await removeItemFromCart(itemId);
    setUpdating(false);
  };

  const changeQuantity = async (delta: number) => {
    const newQty = (item.quantity || 1) + delta;
    setUpdating(true);
    await updateCartItemQuantity(item.id, newQty);
    setUpdating(false);
  };

  const thumbnail = item.thumbnail || item.image_url || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=200";
  const weight = item.weight || item.metadata?.weight || null;
  const message = item.cake_message || item.metadata?.cake_message;

  return (
    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 transition hover:border-zinc-200">
      <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-white">
        <Image
          src={thumbnail}
          alt={item.title || "Cake"}
          className="object-cover"
          fill
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <Heading level="h3" className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate pr-1">
            {item.title || item.name}
          </Heading>
          <IconButton
            onClick={() => deleteItem(item.id)}
            variant="transparent"
            size="small"
            className="text-zinc-400 hover:text-rose-600 p-0 h-5 w-5 shrink-0"
            isLoading={updating}
          >
            <XMark />
          </IconButton>
        </div>

        <div className="flex flex-wrap gap-1 mt-0.5">
          {weight && (
            <span className="text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded">
              {weight}
            </span>
          )}
        </div>

        {message && (
          <p className="text-[10px] text-zinc-500 italic truncate mt-0.5">
            "{message}"
          </p>
        )}

        <div className="flex justify-between items-center mt-2">
          <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-1 py-0.5">
            <button
              type="button"
              disabled={updating || item.quantity <= 1}
              onClick={() => changeQuantity(-1)}
              className="text-xs font-bold text-zinc-600 hover:text-zinc-900 disabled:opacity-30 px-1"
            >
              -
            </button>
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 min-w-3 text-center">
              {item.quantity || 1}
            </span>
            <button
              type="button"
              disabled={updating}
              onClick={() => changeQuantity(1)}
              className="text-xs font-bold text-zinc-600 hover:text-zinc-900 px-1"
            >
              +
            </button>
          </div>

          <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
            ₹{((Number(item.unit_price || item.price || 0)) * (Number(item.quantity || 1))).toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </div>
  );
}

