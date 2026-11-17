import { retrieveUser } from "@frontend/lib/data";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CakeToHomeLogo } from "@frontend/components/common/logo";
import { User, ShoppingBag, MapPin, Heart, LogOut, Sparkles, ChevronRight } from "lucide-react";
import { LogoutButton } from "@frontend/components/common/logout-button";

const navItems = [
  { href: "/account", label: "Personal Profile", description: "Identity, Preferences & Security", icon: User },
  { href: "/account/orders", label: "Order History", description: "Active tracking & past receipts", icon: ShoppingBag },
  { href: "/account/wishlist", label: "My Favorites", description: "Saved celebratory cakes & flavours", icon: Heart },
  { href: "/account/addresses", label: "Saved Addresses", description: "Home, Office & delivery hubs", icon: MapPin },
];

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await retrieveUser();

  // If no authenticated user, redirect to login
  if (!user) {
    redirect("/login");
  }

  const displayName = user.full_name || user.name || user.customer_name || user.phone || "";
  const initials = ((displayName.split(" ").map((n: string) => n[0]).join("") || user.phone?.slice(-2)) || "C").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-brand-warm-white text-brand-text py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Breadcrumb & Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
          <div className="space-y-2">
            <CakeToHomeLogo variant="white" mode="full" height={34} href="/" priority />
            <div className="flex items-center gap-2 text-xs text-brand-gold/80 font-medium">
              <Link href="/" className="hover:text-brand-gold transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5 text-brand-text-muted" />
              <span className="text-brand-text">My Account</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-text tracking-tight flex items-center gap-2.5">
              <span>Account Hub</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-gold/10 text-brand-gold border border-brand-gold/20">
                Verified Member
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3 bg-white border border-brand-border rounded-2xl px-4 py-2.5 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold text-white font-bold text-sm flex items-center justify-center shadow-md">
              {initials}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-brand-text line-clamp-1">{displayName}</p>
              <p className="text-[11px] text-brand-text-muted font-mono">{user.phone || user.email || "Active Session"}</p>
            </div>
          </div>
        </div>

        {/* Main 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
            <div className="bg-white border border-brand-border rounded-2xl p-3 shadow-lg backdrop-blur-sm space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-brand-text-muted px-3 py-2">
                Navigation
              </p>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-brand-text hover:text-brand-navy hover:bg-brand-surface-muted transition-all group border border-transparent hover:border-brand-border"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-surface-muted text-brand-gold flex items-center justify-center group-hover:bg-brand-gold/20 group-hover:text-brand-gold/40 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-text group-hover:text-white transition-colors">{item.label}</p>
                      <p className="text-[11px] text-brand-text-muted truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-brand-text-muted group-hover:text-brand-navy group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}

              <div className="pt-3 mt-3 border-t border-brand-border px-2">
                <LogoutButton variant="danger" size="small" fullWidth />
              </div>
            </div>

            {/* Concierge Support Card */}
            <div className="bg-gradient-to-br from-brand-gold/10 via-neutral-900 to-rose-500/5 border border-brand-gold/20 rounded-2xl p-4 shadow-md text-left space-y-2">
              <div className="flex items-center gap-2 text-brand-gold text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> Concierge Support
              </div>
              <p className="text-xs text-brand-text">
                Need urgent customization, scheduled delivery coordination, or custom tiered cake consultation?
              </p>
              <a
                href="https://wa.me/919567789888?text=Hi%20CakeToHome%20Concierge,%20I%20need%20assistance%20with%20my%20order."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-gold hover:text-brand-gold/40 hover:underline pt-1"
              >
                Chat on WhatsApp (+91 95677 89888) &rarr;
              </a>
            </div>
          </aside>

          {/* Dynamic Content Main Area */}
          <main className="lg:col-span-8 xl:col-span-9">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
