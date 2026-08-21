import Footer from "@frontend/components/common/footer";
import { ProfileBadge } from "@frontend/components/common/profile-badge";
import { retrieveUser } from "@frontend/lib/data";
import { Text } from "@medusajs/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";

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
    <div className="flex flex-col min-h-screen w-full bg-ui-bg-subtle/30">
      <nav className="flex w-full px-4 md:px-10 py-3 h-16 bg-[#111111] text-white justify-between items-center sticky top-0 z-50 border-b border-neutral-800 shadow-md">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex gap-2 items-center text-xl font-bold text-white hover:text-amber-300 transition-colors"
          >
            🎂 CakeToHome
          </Link>
        </div>
        <div className="flex gap-3 items-center">
          <ProfileBadge user={user} />
        </div>
      </nav>
      <main className="flex-1 flex flex-col gap-6 p-3 sm:p-4 md:p-6 min-h-[calc(100vh-4rem)]">
        <DashboardErrorBoundary moduleName="Root Dashboard Layout">
          {children}
        </DashboardErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}
