import { CartLineItemDTO } from "@frontend/lib/types";
import { clx } from "@medusajs/ui";

export function CartCounter({ cart }: { cart: any }) {
  const numberOfItems =
    cart?.items?.reduce(
      (acc: number, item: CartLineItemDTO) => acc + (item.quantity as number),
      0
    ) || 0;

  return (
    <span
      key={numberOfItems}
      className={clx(
        "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF4D6D] text-white text-[10px] font-bold shadow-md pointer-events-none",
        {
          "animate-bounce duration-300 repeat-1": numberOfItems > 0,
        }
      )}
    >
      {numberOfItems}
    </span>
  );
}
