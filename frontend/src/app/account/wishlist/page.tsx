import { WishlistManager } from "@frontend/components/store/account/wishlist-manager";
import { Heading } from "@medusajs/ui";

export default async function AccountWishlistPage() {
  const items: any[] = [];
  return (
    <div className="flex flex-col gap-4">
      <Heading level="h2">My Wishlist</Heading>
      <WishlistManager initialItems={items} />
    </div>
  );
}
