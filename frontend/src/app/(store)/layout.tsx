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
      <div className="min-h-screen flex flex-col w-full">
        <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 text-slate-900 border-b border-slate-200/80 shadow-xs transition-colors duration-200">
          {/* ── DESKTOP & TABLET HEADER (>= 768px / md) ── */}
          <nav className="hidden md:flex px-4 sm:px-6 md:px-8 lg:px-10 h-16 justify-between items-center w-full max-w-full gap-3 lg:gap-6">
            {/* Brand & Location & CMS Links */}
            <div className="flex gap-2 sm:gap-3 lg:gap-6 items-center shrink-0 min-w-0">
              <Link
                href="/"
                className="flex gap-1.5 sm:gap-2 items-center text-lg sm:text-xl font-bold font-serif text-slate-900 hover:text-[#2563EB] transition-colors opacity-100 shrink-0 select-none"
              >
                🎂 CakeToHome
              </Link>
              <DeliveryLocationHeader variant="pill" />
              {/* CMS-driven header navigation (renders nothing if no nav configured) */}
              <Suspense fallback={null}>
                <HeaderNavigation />
              </Suspense>
            </div>

            {/* Embedded Header Search */}
            <div className="flex-1 max-w-xs md:max-w-sm lg:max-w-lg mx-2 min-w-0">
              <NavSearch mode="embedded" />
            </div>

            {/* Right Actions: Favorites, Cart, Profile */}
            <div className="flex gap-1.5 sm:gap-2 items-center shrink-0">
              <NavFavorites />
              <Suspense
                fallback={
                  <div className="p-2 text-slate-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <span className="text-xl">🛍️</span>
                  </div>
                }
              >
                <NavCart device="desktop" />
              </Suspense>
              <ProfileBadge user={user} />
            </div>
          </nav>

          {/* ── DEDICATED MOBILE HEADER (< 768px / md) ── */}
          <div className="flex flex-col md:hidden w-full">
            {/* Top Row: Brand Logo & Mobile Action Toolbar */}
            <nav className="flex px-3 h-14 justify-between items-center w-full max-w-full gap-2">
              {/* Brand Logo */}
              <Link
                href="/"
                className="flex items-center gap-1.5 text-base font-bold font-serif text-slate-900 hover:text-[#2563EB] transition-colors shrink-0 select-none"
              >
                <span className="text-lg">🎂</span>
                <span className="tracking-tight">CakeToHome</span>
              </Link>

              {/* Mobile Actions: Search, Wishlist, Cart, Profile */}
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <NavSearch mode="trigger-only" />
                <NavFavorites />
                <Suspense
                  fallback={
                    <div className="p-2 text-slate-500 min-w-[40px] min-h-[40px] flex items-center justify-center">
                      <span className="text-lg">🛍️</span>
                    </div>
                  }
                >
                  <NavCart device="mobile" />
                </Suspense>
                <ProfileBadge user={user} />
              </div>
            </nav>

            {/* Sub-Header Row: Full-Width Location Selector Bar */}
            <div className="w-full border-t border-slate-200/80">
              <DeliveryLocationHeader variant="bar" />
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col w-full max-w-full min-w-0">
          {children}
        </main>
        <Footer />
      </div>
      {/* Floating Customer Help, AI Sommelier & Exit-intent widgets */}
      <StorefrontFloatingWidgets />
    </EngagementProvider>
  );
}
