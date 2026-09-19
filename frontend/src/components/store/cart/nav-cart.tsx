import { retrieveCart } from "@frontend/lib/data/carts";
import { cookies } from "next/headers";
import CartButton from "./cart-button";

export default async function NavCart({ device = "all" }: { device?: "desktop" | "mobile" | "all" } = {}) {
  const cartId = cookies().get("_cth_cart_id")?.value || cookies().get("_medusa_cart_id")?.value;
  let cart;

  if (cartId) {
    cart = await retrieveCart(cartId);
  }

  return (
    <div className="relative">
      <CartButton cart={cart} device={device} />
    </div>
  );
}
