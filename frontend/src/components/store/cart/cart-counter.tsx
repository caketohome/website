import { CartLineItemDTO } from "@frontend/lib/types";
import { clx } from "@medusajs/ui";

export function CartCounter({ cart }: { cart: any }) {
  const numberOfItems =
    cart?.items?.reduce(
      (acc: number, item: any) => acc + Number(item.quantity || 1),
      0
    ) || 0;

  return (
    <span
      key={numberOfItems}
      data-testid="cart-count-badge"
      className={clx(
        "absolute top-0.5 right-0.5 flex h-4 min-w-[17px] px-1 items-center justify-center rounded-full bg-brand-gold text-[#0F1A36] text-[10px] font-bold shadow-md pointer-events-none",
        {
          "animate-bounce duration-300 repeat-1": numberOfItems > 0,
        }
      )}
    >
      {numberOfItems}
    </span>
  );
}
