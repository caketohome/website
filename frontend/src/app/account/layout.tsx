import { retrieveUser } from "@frontend/lib/data";
import { Container, Heading, Text } from "@medusajs/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@frontend/components/common/logout-button";

const navItems = [
    { href: "/account", label: "Profile" },
    { href: "/account/orders", label: "Orders" },
    { href: "/account/addresses", label: "Addresses" },
    { href: "/account/wallet", label: "Wallet" },
    { href: "/account/loyalty", label: "Loyalty" },
    { href: "/account/referrals", label: "Referrals" },
    { href: "/account/wishlist", label: "Wishlist" },
    { href: "/account/subscriptions", label: "Subscriptions" },
];


export default async function AccountLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = await retrieveUser();

    // If no authenticated user, redirect to login.
    if (!user) {
        redirect("/login");
    }

    return (
        <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
            <Heading level="h1">My Account</Heading>
            <div className="flex flex-col md:flex-row gap-6">
                <aside className="md:w-56 shrink-0">
                    <Container className="flex flex-col gap-1 p-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="px-3 py-2 rounded hover:bg-ui-bg-base-hover text-sm"
                            >
                                {item.label}
                            </Link>
                        ))}
                        <div className="pt-3 border-t mt-2">
                            <LogoutButton variant="danger" size="small" fullWidth />
                        </div>
                    </Container>
                </aside>
                <main className="flex-1 min-w-0">
                    <Container className="p-6">{children}</Container>
                </main>
            </div>
        </div>
    );
}
