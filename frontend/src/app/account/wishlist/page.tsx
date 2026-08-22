import { WishlistManager } from "@frontend/components/store/account/wishlist-manager";
import { listWishlist } from "@frontend/lib/data/catalog";
import { Heading } from "@medusajs/ui";

export const dynamic = "force-dynamic";

export default async function AccountWishlistPage() {
  const items = await listWishlist();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Heading level="h2" className="text-xl font-bold text-gray-900 dark:text-white">
          My Favorites
        </Heading>
        <p className="text-xs text-gray-500 mt-1">
          Your saved celebration cakes, flavors, and gourmet selections.
        </p>
      </div>
      <WishlistManager initialItems={items} />
    </div>
  );
}
