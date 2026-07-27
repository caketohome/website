import Footer from "@frontend/components/common/footer";
import { ProfileBadge } from "@frontend/components/common/profile-badge";
import { LogoutButton } from "@frontend/components/common/logout-button";
import { retrieveUser } from "@frontend/lib/data";
import { Text } from "@medusajs/ui";
import type { Metadata } from "next";
import { Link } from "next-view-transitions";

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
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex gap-2 items-center text-xl font-semibold hover:text-ui-bg-base-hover"
          >
            🎂 CakeToHome
          </Link>
          <div className="hidden lg:flex items-center gap-4 text-xs font-medium">
            <Link href="/dashboard/shop" className="hover:underline text-amber-300">
              🏪 Shop Manager
            </Link>
            <Link href="/dashboard/shop/menu" className="hover:underline text-amber-300">
              🍰 Menu & Items
            </Link>
            <Link href="/dashboard/delivery-partner" className="hover:underline text-amber-300">
              🛵 Delivery Partner
            </Link>
            <Link href="/account" className="hover:underline text-emerald-300">
              👤 Customer Portal
            </Link>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <ProfileBadge user={user} />
          <LogoutButton variant="secondary" size="small" />
        </div>
      </nav>
      <main className="flex flex-col gap-10 p-4 md:p-10 min-h-[calc(100vh-8rem)]">
        {children}
      </main>
      <Footer />
    </>
  );
}
