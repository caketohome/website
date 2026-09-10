import Footer from "@frontend/components/common/footer";
import { ProfileBadge } from "@frontend/components/common/profile-badge";
import NavCart from "@frontend/components/store/cart/nav-cart";
import { NavFavorites } from "@frontend/components/store/favorites/nav-favorites";
import { NavSearch } from "@frontend/components/store/search/nav-search";
import { HeaderNavigation } from "@frontend/components/store/cms/navigation";
import { DeliveryLocationHeader } from "@frontend/components/store/location/delivery-location-header";
import { EngagementProvider } from "@frontend/components/store/engagement/engagement-provider";
import { retrieveUser } from "@frontend/lib/data/users";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StorefrontFloatingWidgets } from "@frontend/components/store/storefront-floating-widgets";

export const metadata: Metadata = {
  title: "CakeToHome",
  description: "Order premium cakes and bakery products online",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await retrieveUser();

  return (
    <EngagementProvider>
      <nav className="flex px-3 sm:px-6 md:px-10 h-16 bg-white text-navy-accent justify-between items-center sticky top-0 z-50 border-b border-navy-accent/10 shadow-sm w-full max-w-full gap-2 sm:gap-4">
        {/* Brand & Location & CMS Links */}
        <div className="flex gap-1.5 sm:gap-4 lg:gap-6 items-center shrink-0 min-w-0">
          <Link
            href="/"
            className="flex gap-1.5 sm:gap-2 items-center text-sm sm:text-xl font-bold text-navy-accent hover:text-navy-glow transition-colors opacity-100 shrink-0"
          >
            🎂 CakeToHome
          </Link>
          <DeliveryLocationHeader />
          {/* CMS-driven header navigation (renders nothing if no nav configured) */}
          <Suspense fallback={null}>
            <HeaderNavigation />
          </Suspense>
        </div>

        {/* Embedded Header Search */}
        <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-1 sm:mx-2 min-w-0">
          <NavSearch />
        </div>

        {/* Right Actions: Favorites, Cart, Profile */}
        <div className="flex gap-1 sm:gap-2 items-center shrink-0">
          <NavFavorites />
          <Suspense
            fallback={
              <div className="p-2 text-navy-accent/70">
                <span className="text-xl">🛍️</span>
              </div>
            }
          >
            <NavCart />
          </Suspense>
          <ProfileBadge user={user} />
        </div>
      </nav>
      <main className="flex flex-col min-h-[calc(100vh-8rem)] w-full max-w-full min-w-0">
        {children}
      </main>
      <Footer />
      {/* Floating Customer Help, AI Sommelier & Exit-intent widgets */}
      <StorefrontFloatingWidgets />
    </EngagementProvider>
  );
}
