import CheckoutForm from "../../../components/store/checkout/checkout-form";
import { OrderSummary } from "../../../components/store/checkout/order-summary";
import { retrieveCart } from "../../../lib/data";
import { HttpTypes } from "@medusajs/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SeoMetadataBuilder } from "../../../lib/seo/metadata-builder";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return SeoMetadataBuilder.buildMetadata({
    fallbackTitle: "Checkout | CakeToHome",
    isPrivate: true,
  });
}

export default async function CheckoutPage() {
  const cartId = cookies().get("_medusa_cart_id")?.value;

  if (!cartId) {
    redirect("/");
  }

  const cart = (await retrieveCart(cartId)) as HttpTypes.StoreCart;

  if (!cart) {
    redirect("/");
  }

  return (
    <div className="grid grid-cols-1 font-sans lg:grid-cols-12 gap-x-8 max-w-7xl mx-auto px-4 py-8">
      <div className="lg:col-span-7">
        <CheckoutForm cart={cart} />
      </div>

      <div className="lg:col-span-5 mt-8 lg:mt-0">
        <OrderSummary cart={cart} />
      </div>
    </div>
  );
}
