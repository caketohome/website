"use client";

import { ShoppingBag } from "@medusajs/icons";
import { DropdownMenu } from "@medusajs/ui";
import { CartCounter } from "./cart-counter";
import CartModal from "./cart-modal";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CartButton({ cart }: { cart: any }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const mainElement = window.document.getElementsByTagName("main")[0];
    if (!mainElement) return;

    mainElement.style.filter = "none";
    if (open) {
      mainElement.style.filter = "blur(3px)";
    } else {
      mainElement.style.filter = "none";
    }

    return () => {
      mainElement.style.filter = "none";
    };
  }, [open]);

  const handleCheckoutClick = () => {
    const mainElement = window.document.getElementsByTagName("main")[0];
    if (mainElement) mainElement.style.filter = "none";

    setOpen(false);
    router.push("/checkout");
  };

  return (
    <div className="relative flex items-center">
      <DropdownMenu
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
        }}
        open={open}
      >
        <DropdownMenu.Trigger
          asChild
          className="relative group flex items-center justify-center p-2 rounded-lg text-navy-accent hover:bg-navy-accent/5 transition-colors focus:outline-none"
        >
          <button type="button" aria-label="Shopping Cart">
            <ShoppingBag
              className="text-navy-accent hover:text-navy-glow transition-colors shrink-0"
              viewBox="2 2 18 18"
              height={24}
              width={24}
            />
            <CartCounter cart={cart} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content className="border-none p-0 m-0 mt-2 z-50">
          <CartModal cart={cart} handleCheckoutClick={handleCheckoutClick} />
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}
