import Footer from "@frontend/components/common/footer";
import { ProfileBadge } from "@frontend/components/common/profile-badge";
import NavCart from "@frontend/components/store/cart/nav-cart";
import { HeaderNavigation } from "@frontend/components/store/cms/navigation";
import { DeliveryLocationHeader } from "@frontend/components/store/location/delivery-location-header";
import { ExitIntentPopup } from "@frontend/components/store/marketing/exit-intent-popup";
import { retrieveUser } from "@frontend/lib/data";
import { ShoppingBag } from "@medusajs/icons";
import { IconButton, Text } from "@medusajs/ui";
import type { Metadata } from "next";
import { Link } from "next-view-transitions";
import { Suspense } from "react";

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
    <>
      <nav className="flex px-4 md:px-10 py-4 h-16 bg-ui-fg-base text-ui-fg-on-inverted justify-between items-center sticky top-0 z-40">
        <div className="flex gap-6 items-center">
          <Link
            href="/"
            className="flex gap-2 items-center text-xl font-semibold hover:text-ui-bg-base-hover"
          >
            🎂 CakeToHome
          </Link>
          <DeliveryLocationHeader />
          {/* CMS-driven header navigation (renders nothing if no nav configured) */}
          <Suspense fallback={null}>
            <HeaderNavigation />
          </Suspense>
        </div>
        <div className="flex gap-2 items-center">
          <Suspense
            fallback={
              <IconButton variant="transparent">
                <ShoppingBag />
              </IconButton>
            }
          >
            <NavCart />
          </Suspense>
          <ProfileBadge user={user} />
        </div>
      </nav>
      <main className="flex flex-col gap-20 p-4 md:p-10 transition-all duration-150 ease-in-out min-h-[calc(100vh-8rem)]">
        {children}
      </main>
      <Footer />
      {/* Phase 9.2 — Exit-intent / marketing popups (renders nothing if no eligible popups) */}
      <Suspense fallback={null}>
        <ExitIntentPopup />
      </Suspense>
    </>
  );
}
