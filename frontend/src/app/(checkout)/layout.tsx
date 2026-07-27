import Footer from "@frontend/components/common/footer";
import { ProfileBadge } from "@frontend/components/common/profile-badge";
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
        <Link
          href="/"
          className="flex gap-2 items-center text-xl font-semibold hover:text-ui-bg-base-hover"
        >
          🎂 CakeToHome
        </Link>
        <div className="flex gap-2 items-center">
          <ProfileBadge user={user} />
        </div>
      </nav>
      <main className="flex flex-col gap-4 p-4 md:p-10 transition-all duration-150 ease-in-out min-h-[calc(100vh-8rem)]">
        {children}
      </main>
      <Footer />
    </>
  );
}
