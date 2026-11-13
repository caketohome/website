import Footer from "@frontend/components/common/footer";
import { ProfileBadge } from "@frontend/components/common/profile-badge";
import { CakeToHomeLogo } from "@frontend/components/common/logo";
import { retrieveUser } from "@frontend/lib/data";
import { Text } from "@medusajs/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CakeToHome",
  description: "Order premium cakes and bakery products online",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await retrieveUser();

  return (
    <div className="min-h-screen flex flex-col w-full">
      <nav className="flex px-4 md:px-10 h-16 bg-[#1D2F5D]/95 backdrop-blur-md text-white justify-between items-center sticky top-0 z-50 border-b border-white/10 shadow-[0_4px_24px_rgba(29,47,93,0.25)]">
        <div className="flex items-center gap-3">
          <CakeToHomeLogo
            variant="white"
            mode="full"
            height={36}
            priority
            href="/"
            className="py-1"
          />
          <span className="hidden sm:inline-flex text-[10px] uppercase font-sans tracking-[0.2em] font-semibold text-[#D4AF37] px-2.5 py-0.5 rounded-full bg-white/10 border border-[#D4AF37]/30">
            Patisserie Checkout
          </span>
        </div>
        <div className="flex gap-2 items-center">
          <ProfileBadge user={user} />
        </div>
      </nav>
      <main className="japandi-quiet-surface flex-1 flex flex-col gap-4 p-4 md:p-10 transition-all duration-150 ease-in-out">
        {children}
      </main>
      <Footer />
    </div>
  );
}
