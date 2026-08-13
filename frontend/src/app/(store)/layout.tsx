import Footer from "@frontend/components/common/footer";
import { ProfileBadge } from "@frontend/components/common/profile-badge";
import NavCart from "@frontend/components/store/cart/nav-cart";
import { HeaderNavigation } from "@frontend/components/store/cms/navigation";
import { DeliveryLocationHeader } from "@frontend/components/store/location/delivery-location-header";
import { ExitIntentPopup } from "@frontend/components/store/marketing/exit-intent-popup";
import { WhatsAppSupportButton } from "@frontend/components/store/whatsapp-support-button";
import { AiChatAssistant } from "@frontend/components/store/ai-chat-assistant";
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
      <nav className="flex px-3 sm:px-6 md:px-10 h-16 bg-[#111111] text-white justify-between items-center sticky top-0 z-40 border-b border-white/10 shadow-[0_4px_18px_rgba(0,0,0,0.25)] w-full max-w-full overflow-hidden">
        <div className="flex gap-2 sm:gap-6 items-center shrink min-w-0">
          <Link
            href="/"
            className="flex gap-1.5 sm:gap-2 items-center text-sm sm:text-xl font-bold text-white hover:text-white transition-colors opacity-100 shrink-0"
          >
            🎂 CakeToHome
          </Link>
          <DeliveryLocationHeader />
          {/* CMS-driven header navigation (renders nothing if no nav configured) */}
          <Suspense fallback={null}>
            <HeaderNavigation />
          </Suspense>
        </div>
        <div className="flex gap-1.5 sm:gap-2 items-center shrink-0">
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
      <main className="flex flex-col gap-12 sm:gap-20 p-3 sm:p-6 md:p-10 transition-all duration-150 ease-in-out min-h-[calc(100vh-8rem)] w-full max-w-full min-w-0 overflow-x-clip">
        {children}
      </main>
      <Footer />
      {/* Floating Customer Help & AI Sommelier widgets */}
      <Suspense fallback={null}>
        <WhatsAppSupportButton />
        <AiChatAssistant />
      </Suspense>
      {/* Exit-intent / marketing popups */}
      <Suspense fallback={null}>
        <ExitIntentPopup />
      </Suspense>
    </>
  );
}
