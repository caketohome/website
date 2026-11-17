"use client";

import { ShoppingBag } from "@medusajs/icons";
import { CartCounter } from "./cart-counter";
import CartModal from "./cart-modal";
import { useState, useEffect } from "react";
import { cartBus } from "@frontend/lib/cart/cart-event-bus";

export default function CartButton({
  cart,
  device = "all",
}: {
  cart: any;
  device?: "desktop" | "mobile" | "all";
}) {
  const [open, setOpen] = useState(false);
  const [localCart, setLocalCart] = useState(cart);

  // Keep localCart in sync when server passes a valid updated cart
  useEffect(() => {
    if (cart && Array.isArray(cart.items) && cart.items.length > 0) {
      setLocalCart(cart);
    } else if (!localCart || !localCart.items || localCart.items.length === 0) {
      setLocalCart(cart);
    }
  }, [cart]);

  // Client-side hydration on mount if initial server cart was empty
  useEffect(() => {
    if (!localCart || !localCart.items || localCart.items.length === 0) {
      fetch("/api/v1/cart")
        .then((r) => r.json())
        .then((data) => {
          if (data?.cart && Array.isArray(data.cart.items) && data.cart.items.length > 0) {
            setLocalCart(data.cart);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Subscribe to cartBus events (add to cart, updates, open drawer requests)
  useEffect(() => {
    const unsubUpdate = cartBus.onCartUpdated((updatedCart) => {
      setLocalCart(updatedCart);
    });

    // Primary modal instance (device !== "mobile") responds to open requests
    let unsubOpen = () => {};
    if (device !== "mobile") {
      unsubOpen = cartBus.onOpenCart(() => {
        setOpen(true);
      });
    }

    return () => {
      unsubUpdate();
      unsubOpen();
    };
  }, [device]);

  const handleClick = () => {
    if (device === "mobile") {
      cartBus.emitOpenCart();
    } else {
      setOpen(true);
    }
  };

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        data-testid="header-cart-button"
        aria-label="Shopping Cart"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={handleClick}
        className="relative group flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
      >
        <ShoppingBag
          className="text-slate-600 hover:text-brand-primary transition-colors shrink-0"
          viewBox="2 2 18 18"
          height={22}
          width={22}
        />
        <CartCounter cart={localCart} />
      </button>

      {device !== "mobile" && (
        <CartModal
          isOpen={open}
          onClose={() => setOpen(false)}
          cart={localCart}
          onCartUpdate={(updatedCart) => setLocalCart(updatedCart)}
        />
      )}
    </div>
  );
}
