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
    <Container className="flex flex-col gap-4 w-[calc(100vw-32px)] max-w-96 max-h-[85vh] overflow-y-auto m-0 shadow-ambient-lg rounded-[24px] p-6 border border-navy-accent/60 bg-navy-surface">
      <div className="flex justify-between items-center border-b border-navy-accent/60 pb-4">
        <Heading level="h2" className="text-xl font-serif text-pearl flex items-center gap-2">
          Your Bag <span className="text-ash font-sans text-xs">({items.length})</span>
        </Heading>
        {subtotal > 0 && (
          <span className="text-sm font-semibold text-pearl">
            ₹{subtotal.toLocaleString("en-IN")}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4 max-h-80 overflow-y-auto pr-2 scrollbar-hide">
        {items.length > 0 ? (
          items.map((item: any) => (
            <CartItem key={item.id} item={item} />
          ))
        ) : (
          <div className="py-10 text-center flex flex-col items-center gap-3 text-ash/70">
            <span className="text-3xl opacity-50">🛍️</span>
            <Text className="text-sm font-sans font-medium">Your bag is currently empty.</Text>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border-t border-navy-accent/60 pt-4 flex flex-col gap-3">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-ash font-sans text-xs uppercase tracking-widest font-semibold">Subtotal</span>
            <span className="font-serif text-xl font-medium text-pearl">₹{subtotal.toLocaleString("en-IN")}</span>
          </div>
          <Button
            variant="primary"
            className="w-full py-4 bg-rosegold hover:bg-rosegold/90 text-white font-sans text-[11px] font-medium uppercase tracking-[0.15em] rounded-full shadow-ambient transition-all flex items-center justify-center gap-2 border-none"
            size="large"
            onClick={handleCheckoutClick}
            disabled={items.length === 0}
          >
            <span>Checkout</span>
            <span>→</span>
          </Button>
          <a
            href="/cart"
            className="w-full py-2 text-center text-[11px] uppercase tracking-widest font-semibold text-ash hover:text-pearl rounded-full hover:bg-obsidian-base transition-colors"
          >
            View Full Bag
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
    <div className="flex items-start gap-4 p-3 rounded-[20px] bg-obsidian-base border border-navy-accent/60 transition-all hover:border-taupe/20">
      <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-navy-surface border border-navy-accent/60">
        <Image
          src={thumbnail}
          alt={item.title || "Cake"}
          className="object-cover"
          fill
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 py-0.5">
        <div className="flex justify-between items-start">
            <Heading level="h3" className="text-[13px] font-sans font-medium text-pearl truncate pr-1">
              {item.title || item.name}
            </Heading>
          <IconButton
            onClick={() => deleteItem(item.id)}
            variant="transparent"
            size="small"
            className="text-ash hover:text-pearl p-0 h-5 w-5 shrink-0 transition-colors"
            isLoading={updating}
          >
            <XMark />
          </IconButton>
        </div>

        <div className="flex flex-wrap gap-1 mt-1">
          {weight && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-ash bg-navy-surface px-2 py-0.5 rounded-full border border-navy-accent/60">
              {weight}
            </span>
          )}
        </div>

        {message && (
          <p className="text-[10px] text-ash italic truncate mt-1">
            "{message}"
          </p>
        )}

        <div className="flex justify-between items-center mt-3">
          <div className="flex items-center gap-1.5 bg-navy-surface border border-navy-accent/60 rounded-full px-1.5 py-0.5 shadow-sm">
            <button
              type="button"
              disabled={updating || item.quantity <= 1}
              onClick={() => changeQuantity(-1)}
              className="text-xs font-medium text-pearl hover:text-pearl/70 disabled:opacity-30 px-1.5"
            >
              -
            </button>
            <span className="text-xs font-medium text-pearl min-w-4 text-center">
              {item.quantity || 1}
            </span>
            <button
              type="button"
              disabled={updating}
              onClick={() => changeQuantity(1)}
              className="text-xs font-medium text-pearl hover:text-pearl/70 px-1.5"
            >
              +
            </button>
          </div>

          <span className="text-[13px] font-semibold text-pearl">
            ₹{((Number(item.unit_price || item.price || 0)) * (Number(item.quantity || 1))).toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </div>
  );
}

