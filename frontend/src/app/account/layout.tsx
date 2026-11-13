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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Breadcrumb & Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80">
          <div className="space-y-2">
            <CakeToHomeLogo variant="white" mode="full" height={34} href="/" priority />
            <div className="flex items-center gap-2 text-xs text-amber-500/80 font-medium">
              <Link href="/" className="hover:text-amber-400 transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
              <span className="text-neutral-300">My Account</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <span>Account Hub</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Verified Member
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-3 bg-neutral-900/80 border border-neutral-800 rounded-2xl px-4 py-2.5 shadow-sm">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-[#D4AF37] text-white font-bold text-sm flex items-center justify-center shadow-md">
              {initials}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-neutral-200 line-clamp-1">{displayName}</p>
              <p className="text-[11px] text-neutral-400 font-mono">{user.phone || user.email || "Active Session"}</p>
            </div>
          </div>
        </div>

        {/* Main 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
            <div className="bg-neutral-900/90 border border-neutral-800/90 rounded-2xl p-3 shadow-lg backdrop-blur-sm space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-3 py-2">
                Navigation
              </p>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800/80 transition-all group border border-transparent hover:border-neutral-700/50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-neutral-800/90 text-amber-400 flex items-center justify-center group-hover:bg-amber-500/20 group-hover:text-amber-300 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors">{item.label}</p>
                      <p className="text-[11px] text-neutral-400 truncate">{item.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-200 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                );
              })}

              <div className="pt-3 mt-3 border-t border-neutral-800 px-2">
                <LogoutButton variant="danger" size="small" fullWidth />
              </div>
            </div>

            {/* Concierge Support Card */}
            <div className="bg-gradient-to-br from-amber-500/10 via-neutral-900 to-rose-500/5 border border-amber-500/20 rounded-2xl p-4 shadow-md text-left space-y-2">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> Concierge Support
              </div>
              <p className="text-xs text-neutral-300">
                Need urgent customization, scheduled delivery coordination, or custom tiered cake consultation?
              </p>
              <a
                href="https://wa.me/919567789888?text=Hi%20CakeToHome%20Concierge,%20I%20need%20assistance%20with%20my%20order."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline pt-1"
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
