"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  User,
  ShoppingBag,
  MapPin,
  Heart,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Phone,
  Mail,
  Edit3,
  Save,
  Bell,
  Sliders,
  Award,
  Clock,
  Cake,
  Gift,
  Check
} from "lucide-react";
import type { CustomerProfileDTO } from "@frontend/lib/crm/types";
import { useCustomer } from "@frontend/providers/customer-provider";

interface AccountDashboardViewProps {
  initialCustomer: CustomerProfileDTO;
}

export function AccountDashboardView({ initialCustomer }: AccountDashboardViewProps) {
  const { customer: ctxCustomer, updateProfile } = useCustomer();
  const customer = ctxCustomer || initialCustomer;

  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "notifications" | "security">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form State
  const [fullName, setFullName] = useState(customer.full_name || customer.name || "");
  const [email, setEmail] = useState(customer.email || "");
  const [dateOfBirth, setDateOfBirth] = useState(customer.date_of_birth || "");
  const [egglessOnly, setEgglessOnly] = useState(customer.preferences?.eggless_only ?? false);
  const [favouriteFlavour, setFavouriteFlavour] = useState(customer.preferences?.favourite_flavour || "Dutch Chocolate");
  const [whatsappNotifs, setWhatsappNotifs] = useState(customer.preferences?.whatsapp_notifications ?? true);
  const [smsNotifs, setSmsNotifs] = useState(customer.preferences?.sms_notifications ?? true);
  const [marketingEmails, setMarketingEmails] = useState(customer.preferences?.marketing_emails ?? true);

  const displayName = customer.full_name || customer.name || "Gourmet Customer";
  const initials = (displayName.split(" ").map((n) => n[0]).join("") || "C").toUpperCase().slice(0, 2);
  const stats = customer.stats || {
    orders: 0,
    total_spent: 0,
    favourite_cake: "Belgian Dark Chocolate Truffle",
    last_order_date: null,
  };

  const formattedLastOrder = stats.last_order_date
    ? new Date(stats.last_order_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "No orders yet";

  const firstName = (displayName && displayName !== "Gourmet Customer") ? displayName.split(" ")[0] : "there";
  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    const ok = await updateProfile({
      full_name: fullName,
      email,
      date_of_birth: dateOfBirth || null,
      preferences: {
        eggless_only: egglessOnly,
        favourite_flavour: favouriteFlavour,
        whatsapp_notifications: whatsappNotifs,
        sms_notifications: smsNotifs,
        marketing_emails: marketingEmails,
      },
    });

    setSaving(false);
    if (ok) {
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── 1. LUXURY HEADER CARD ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900/95 to-neutral-950 border border-neutral-800 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-500/10 via-rose-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-600 to-rose-600 p-[2px] shadow-xl">
                <div className="w-full h-full bg-neutral-900 rounded-[22px] flex items-center justify-center text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-amber-200 to-orange-400">
                  {initials}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 text-neutral-950 rounded-full flex items-center justify-center shadow-md border-2 border-neutral-900">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {timeGreeting}, {firstName} 👋
                </h2>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20 shadow-sm">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  {customer.tier === "VIP_PLATINUM" ? "VIP Platinum" : customer.tier === "GOLD" ? "Gold Member" : customer.tier === "SILVER" ? "Silver Member" : "Artisan Connoisseur"}
                </span>
              </div>
              <p className="text-xs font-medium text-amber-400">
                Ready for your next celebration?
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400 pt-1">
                <div className="flex items-center gap-1.5 font-mono text-neutral-300">
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>{customer.phone || "—"}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-1.5 text-neutral-300">
                    <Mail className="w-3.5 h-3.5 text-rose-400" />
                    <span>{customer.email}</span>
                  </div>
                )}
                <div className="text-neutral-500 font-mono text-[11px]">
                  UID: <span className="text-neutral-400">{customer.customer_uid}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={() => {
                setIsEditing(!isEditing);
                setActiveTab("profile");
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700/60 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              {isEditing ? "Cancel Editing" : "Edit Profile"}
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Your profile and taste preferences have been saved successfully.
          </div>
        )}
      </div>

      {/* ── 2. FOUR LUXURY STAT CARDS ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-3xl p-5 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Total Orders</p>
          <p className="text-2xl sm:text-3xl font-black text-white mt-0.5 tracking-tight">
            {stats.orders} <span className="text-xs font-medium text-neutral-500">Orders</span>
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">100% On-Time Delivery</p>
        </div>

        {/* Celebration Spend */}
        <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-3xl p-5 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
            <Award className="w-5 h-5" />
          </div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Total Spent</p>
          <p className="text-2xl sm:text-3xl font-black text-white mt-0.5 tracking-tight">
            ₹{stats.total_spent.toLocaleString("en-IN")}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">Gourmet Treats Delivered</p>
        </div>

        {/* Favourite Cake */}
        <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-3xl p-5 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-rose-500/40 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
            <Cake className="w-5 h-5" />
          </div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Favourite Cake</p>
          <p className="text-sm sm:text-base font-bold text-white mt-1 line-clamp-1">
            {stats.favourite_cake || "Belgian Truffle"}
          </p>
          <p className="text-[11px] text-rose-400/80 mt-1 flex items-center gap-1 font-medium">
            <Heart className="w-3 h-3 fill-rose-500/40" /> Most Reordered Treat
          </p>
        </div>

        {/* Last Order Date */}
        <div className="bg-neutral-900/80 border border-neutral-800/80 rounded-3xl p-5 shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Last Order</p>
          <p className="text-sm sm:text-base font-bold text-white mt-1">
            {formattedLastOrder}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1">Verified Order History</p>
        </div>
      </div>

      {/* ── 3. INTERACTIVE PROFILE TABS ─────────────────────────────────── */}
      <div className="bg-neutral-900/90 border border-neutral-800/90 rounded-3xl p-6 shadow-xl backdrop-blur-xl space-y-6">
        {/* Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-neutral-800 no-scrollbar">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "profile"
                ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-extrabold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            <User className="w-3.5 h-3.5" /> Personal Details
          </button>

          <button
            onClick={() => setActiveTab("preferences")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "preferences"
                ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-extrabold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Taste & Dietary Preferences
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "notifications"
                ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-extrabold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Communication Channels
          </button>

          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === "security"
                ? "bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20 font-extrabold"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Security & Sessions
          </button>
        </div>

        {/* TAB 1: PERSONAL DETAILS */}
        {activeTab === "profile" && (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">
                  Full Customer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. Alex R Ashok"
                  className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">
                  Registered Mobile Phone
                </label>
                <input
                  type="text"
                  value={customer.phone}
                  disabled
                  className="w-full bg-neutral-950/40 border border-neutral-800/60 rounded-2xl px-4 py-3 text-sm text-neutral-400 font-mono cursor-not-allowed"
                />
                <p className="text-[11px] text-neutral-500">Verified via SMS OTP. Used for real-time delivery rider tracking.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">
                  Email Address for Invoices & Receipts
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g. alex@example.com"
                  className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-neutral-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">
                  Date of Birth (For Birthday Surprise Treats)
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  disabled={!isEditing}
                  className="w-full bg-neutral-950/80 border border-neutral-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-2xl px-4 py-3 text-sm text-white disabled:opacity-70 disabled:cursor-not-allowed transition-all font-medium"
                />
              </div>
            </div>

            {isEditing && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-2xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving Changes..." : "Save Profile"}
                </button>
              </div>
            )}
          </form>
        )}

        {/* TAB 2: PREFERENCES */}
        {activeTab === "preferences" && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> 100% Eggless Filter Preference
                  </h4>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Automatically filter cake catalog and recommend only 100% pure vegetarian / eggless creations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !egglessOnly;
                    setEgglessOnly(next);
                    updateProfile({ preferences: { eggless_only: next } });
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    egglessOnly ? "bg-emerald-500" : "bg-neutral-800"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      egglessOnly ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="border-t border-neutral-800/60 pt-4">
                <label className="text-xs font-bold text-neutral-300 block mb-2">
                  Signature Favourite Flavour
                </label>
                <select
                  value={favouriteFlavour}
                  onChange={(e) => {
                    setFavouriteFlavour(e.target.value);
                    updateProfile({ preferences: { favourite_flavour: e.target.value } });
                  }}
                  className="w-full sm:w-80 bg-neutral-950 border border-neutral-800 focus:border-amber-500 rounded-2xl px-4 py-2.5 text-sm text-white"
                >
                  <option value="Dutch Chocolate">Belgian Dutch Chocolate</option>
                  <option value="Red Velvet Cream Cheese">Red Velvet Cream Cheese</option>
                  <option value="Black Forest Gateau">Classic Black Forest</option>
                  <option value="Fresh Alphonso Mango">Fresh Alphonso Mango</option>
                  <option value="Butterscotch Crunch">Butterscotch Caramel Crunch</option>
                  <option value="Fresh Berry Vanilla">Madagascar Vanilla & Fresh Berries</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NOTIFICATIONS */}
        {activeTab === "notifications" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">WhatsApp Live Order Tracking & Photo Proof</p>
                <p className="text-xs text-neutral-400">Receive kitchen baking photos, rider location, and OTP alerts via WhatsApp.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !whatsappNotifs;
                  setWhatsappNotifs(next);
                  updateProfile({ preferences: { whatsapp_notifications: next } });
                }}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  whatsappNotifs ? "bg-amber-500" : "bg-neutral-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${whatsappNotifs ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">SMS Delivery Notifications</p>
                <p className="text-xs text-neutral-400">Standard SMS alerts for delivery dispatch and verification PINs.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !smsNotifs;
                  setSmsNotifs(next);
                  updateProfile({ preferences: { sms_notifications: next } });
                }}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  smsNotifs ? "bg-amber-500" : "bg-neutral-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${smsNotifs ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Exclusive Baker&apos;s Specials & Seasonal Menus</p>
                <p className="text-xs text-neutral-400">Receive early access to festive collections and chef-crafted seasonal cakes.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !marketingEmails;
                  setMarketingEmails(next);
                  updateProfile({ preferences: { marketing_emails: next } });
                }}
                className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                  marketingEmails ? "bg-amber-500" : "bg-neutral-800"
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${marketingEmails ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: SECURITY & SESSIONS */}
        {activeTab === "security" && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-3 text-left">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" /> Passwordless OTP Verification Active
              </div>
              <p className="text-xs text-neutral-300">
                Your account is protected by encrypted 6-digit SMS verification. No passwords can be stolen or compromised.
              </p>
              <div className="pt-2">
                <p className="text-xs text-neutral-400">
                  Active Session: <span className="font-mono text-neutral-200">Current Web Device</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. QUICK ACTION CARDS ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/account/orders"
          className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 hover:border-amber-500/40 transition-all flex items-center justify-between group shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Live & Past Orders</p>
              <p className="text-xs text-neutral-400">Track delivery status and reorder in 1-click</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">View &rarr;</span>
        </Link>

        <Link
          href="/account/addresses"
          className="p-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 hover:border-rose-500/40 transition-all flex items-center justify-between group shadow-lg"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Delivery Locations</p>
              <p className="text-xs text-neutral-400">Manage saved Home, Office & Party addresses</p>
            </div>
          </div>
          <span className="text-xs font-bold text-rose-400 group-hover:translate-x-1 transition-transform">Manage &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
