import { retrieveUser } from "@frontend/lib/data";
import { Heading, Text, Badge, Container } from "@medusajs/ui";
import Link from "next/link";
import { Package, MapPin, Sparkles, Phone, Mail, Award, Clock } from "lucide-react";

export default async function AccountProfilePage() {
    const user = (await retrieveUser()) as {
        first_name?: string;
        last_name?: string;
        name?: string;
        email?: string;
        phone?: string;
        customer_uid?: string;
        tier?: string;
        loyalty?: { points_balance?: number; tier?: string };
        orders_count?: number;
        total_spend?: number;
        lifecycle_stage?: string;
    } | null;

    const displayName = user?.name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Valued Customer";
    const tier = user?.tier || user?.loyalty?.tier || "STANDARD";
    const loyaltyPoints = user?.loyalty?.points_balance || 100;
    const ordersCount = user?.orders_count || 0;
    const totalSpend = user?.total_spend || 0;

    return (
        <div className="flex flex-col gap-6">
            {/* Header Profile Card */}
            <div className="bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/5 p-6 rounded-2xl border border-amber-200/60 dark:border-amber-900/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white font-bold text-xl shadow-md">
                        {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Heading level="h1" className="text-xl font-bold text-slate-900 dark:text-white">
                                {displayName}
                            </Heading>
                            <Badge color={tier === "VIP_PLATINUM" ? "purple" : tier === "GOLD" ? "orange" : tier === "SILVER" ? "blue" : "grey"}>
                                {tier.replace("_", " ")}
                            </Badge>
                        </div>
                        <Text className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                            UID: <span className="font-semibold text-slate-700 dark:text-slate-300">{user?.customer_uid || "cth_cus_account"}</span>
                        </Text>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 px-4 py-2.5 rounded-xl border border-amber-200/50 dark:border-amber-900/50 shadow-sm">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400">Sweet Rewards™</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{loyaltyPoints} Points</p>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Total Orders</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{ordersCount}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Celebration Spend</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">₹{totalSpend.toLocaleString("en-IN")}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 col-span-2 sm:col-span-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Member Status</span>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">✓ Active Verified</p>
                </div>
            </div>

            {/* Account Details */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-4">
                <Heading level="h2" className="text-base font-semibold border-b border-slate-100 dark:border-slate-800 pb-3 text-slate-900 dark:text-white">
                    Contact & Identity
                </Heading>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                            <Phone className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Mobile Phone</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 font-mono">{user?.phone || "—"}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                            <Mail className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-400">Email Address</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user?.email || "No email attached"}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                    href="/account/orders"
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 bg-white dark:bg-slate-900 transition-colors flex items-center justify-between group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Order History</p>
                            <p className="text-xs text-slate-500">Track current orders and view receipts</p>
                        </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">View →</span>
                </Link>

                <Link
                    href="/account/addresses"
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 bg-white dark:bg-slate-900 transition-colors flex items-center justify-between group"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
                            <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">Delivery Addresses</p>
                            <p className="text-xs text-slate-500">Manage saved home and office locations</p>
                        </div>
                    </div>
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Manage →</span>
                </Link>
            </div>
        </div>
    );
}
