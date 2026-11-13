"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  User,
  ShoppingBag,
  MapPin,
  Calendar,
  ShieldCheck,
  Phone,
  Mail,
  Edit3,
  Save,
  Bell,
  Clock,
  Cake,
  Check,
  Plus,
  Trash2,
  Lock,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  LogOut,
  ExternalLink,
  Package,
} from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useCustomerProfile, CustomerProfileData } from "@/hooks/use-customer-profile";
import { useOrders } from "@/hooks/use-orders";
import { useAddresses, CustomerAddress } from "@/hooks/use-addresses";

interface AccountDashboardViewProps {
  initialCustomer?: any;
}

export function AccountDashboardView({ initialCustomer }: AccountDashboardViewProps) {
  const { logout } = useAuth();
  const { profile, loading: profileLoading, updateProfile, updating: profileUpdating } = useCustomerProfile(initialCustomer);
  const { orders, loading: ordersLoading, totalOrders, totalSpend } = useOrders();
  const { addresses, loading: addressesLoading, saveAddress, deleteAddress, saving: addressSaving } = useAddresses();

  const [activeTab, setActiveTab] = useState<"profile" | "orders" | "addresses" | "preferences">("profile");

  // Edit Profile Modal State
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDob, setEditDob] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  // Add/Edit Address Modal State
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addrLabel, setAddrLabel] = useState("Home");
  const [addrName, setAddrName] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLandmark, setAddrLandmark] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrPincode, setAddrPincode] = useState("");
  const [addrIsDefault, setAddrIsDefault] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);

  // Active Customer data resolution
  const customer = profile || initialCustomer || {};
  const displayName = customer.full_name || customer.name || "Gourmet Customer";
  const initials = (displayName.split(" ").map((n: string) => n[0]).join("") || "C").toUpperCase().slice(0, 2);
  const formattedDob = customer.date_of_birth
    ? new Date(customer.date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "Not provided";
  const memberSince = customer.created_at
    ? new Date(customer.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "2026";

  const effectiveTotalOrders = totalOrders > 0 ? totalOrders : (customer.stats?.total_orders || 0);
  const effectiveTotalSpend = totalSpend > 0 ? totalSpend : (customer.stats?.total_spend || 0);
  const favouriteFlavour = customer.preferences?.favourite_flavour || "Belgian Dark Chocolate Truffle";

  // Open Edit Profile Modal
  const handleOpenEditProfile = () => {
    setEditName(customer.full_name || customer.name || "");
    setEditEmail(customer.email || "");
    setEditDob(customer.date_of_birth ? customer.date_of_birth.split("T")[0] : "");
    setEditError(null);
    setIsEditProfileOpen(true);
  };

  // Submit Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    if (!editName.trim() || editName.trim().length < 2) {
      setEditError("Full Name must be at least 2 characters long.");
      return;
    }

    if (editEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      setEditError("Please provide a valid email address.");
      return;
    }

    const res = await updateProfile({
      full_name: editName.trim(),
      email: editEmail.trim().toLowerCase(),
      date_of_birth: editDob || null,
    });

    if (res.success) {
      setIsEditProfileOpen(false);
      setEditSuccessMsg("Profile details updated successfully.");
      setTimeout(() => setEditSuccessMsg(null), 4000);
    } else {
      setEditError(res.error || "Failed to update profile.");
    }
  };

  // Open Address Modal for New
  const handleOpenNewAddress = () => {
    setEditingAddressId(null);
    setAddrLabel("Home");
    setAddrName(displayName);
    setAddrPhone(customer.phone || "");
    setAddrLine1("");
    setAddrLandmark("");
    setAddrCity("");
    setAddrPincode("");
    setAddrIsDefault(addresses.length === 0);
    setAddrError(null);
    setIsAddressModalOpen(true);
  };

  // Open Address Modal for Edit
  const handleOpenEditAddress = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setAddrLabel(addr.label || addr.type || "Home");
    setAddrName(addr.name || displayName);
    setAddrPhone(addr.phone || customer.phone || "");
    setAddrLine1(addr.address_1 || "");
    setAddrLandmark(addr.landmark || "");
    setAddrCity(addr.city || "");
    setAddrPincode(addr.postal_code || "");
    setAddrIsDefault(Boolean(addr.is_default));
    setAddrError(null);
    setIsAddressModalOpen(true);
  };

  // Save Address
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddrError(null);

    if (!addrLine1.trim()) {
      setAddrError("Address line 1 is required.");
      return;
    }

    if (!addrPincode.trim() || !/^\d{6}$/.test(addrPincode.trim())) {
      setAddrError("Please enter a valid 6-digit postal code.");
      return;
    }

    const payload: Partial<CustomerAddress> = {
      id: editingAddressId || undefined,
      label: addrLabel,
      type: addrLabel.toUpperCase(),
      name: addrName.trim() || displayName,
      phone: addrPhone.trim() || customer.phone,
      address_1: addrLine1.trim(),
      landmark: addrLandmark.trim(),
      city: addrCity.trim(),
      postal_code: addrPincode.trim(),
      is_default: addrIsDefault,
    };

    const res = await saveAddress(payload);
    if (res.success) {
      setIsAddressModalOpen(false);
    } else {
      setAddrError(res.error || "Failed to save address.");
    }
  };

  // Handle Communication Preference Toggle
  const handleTogglePref = async (key: "whatsapp_notifications" | "sms_notifications" | "marketing_emails", value: boolean) => {
    await updateProfile({
      preferences: {
        ...(customer.preferences || {}),
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-8 font-sans max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Success Toast Alert ───────────────────────────────────────────── */}
      {editSuccessMsg && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 bg-neutral-900 border border-amber-500/40 text-amber-300 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{editSuccessMsg}</span>
        </div>
      )}

      {/* ── 1. LUXURY HEADER BANNER ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-950 border border-neutral-800/80 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/15 via-[#1D2F5D]/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-amber-600/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-0.5 shadow-xl shadow-amber-500/20">
                <div className="w-full h-full rounded-[14px] bg-neutral-900 flex items-center justify-center text-2xl sm:text-3xl font-extrabold text-amber-300">
                  {initials}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-neutral-950 rounded-full border border-neutral-800">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight">
                  {displayName}
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  Verified Connoisseur
                </span>
              </div>
              <p className="text-xs text-neutral-400 flex items-center gap-2">
                <span>{customer.phone || "No phone linked"}</span>
                <span>•</span>
                <span>Member since {memberSince}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleOpenEditProfile}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              Edit Profile
            </button>
            <button
              onClick={() => logout("/login")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-[#D4AF37] border border-neutral-800 text-xs font-bold transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Quick Highlights Strip */}
        <div className="mt-8 pt-6 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3.5 bg-neutral-900/60 border border-neutral-800/60 p-3.5 rounded-2xl">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Total Orders</p>
              <p className="text-base font-bold text-neutral-100">{effectiveTotalOrders} Delivered</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 bg-neutral-900/60 border border-neutral-800/60 p-3.5 rounded-2xl">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Cake className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Total Spent</p>
              <p className="text-base font-bold text-neutral-100">₹{effectiveTotalSpend.toLocaleString("en-IN")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 bg-neutral-900/60 border border-neutral-800/60 p-3.5 rounded-2xl">
            <div className="p-2.5 rounded-xl bg-[#1D2F5D]/10 text-[#D4AF37]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Signature Flavour</p>
              <p className="text-xs font-bold text-neutral-100 truncate max-w-[160px]">{favouriteFlavour}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. TABBED NAVIGATION ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "profile"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <User className="w-4 h-4" /> Personal Identity
        </button>

        <button
          onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "orders"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> Order History ({effectiveTotalOrders})
        </button>

        <button
          onClick={() => setActiveTab("addresses")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "addresses"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <MapPin className="w-4 h-4" /> Saved Addresses ({addresses.length})
        </button>

        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === "preferences"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
          }`}
        >
          <Bell className="w-4 h-4" /> Communication Preferences
        </button>
      </div>

      {/* ── 3. TAB 1: PERSONAL IDENTITY & PROFILE ─────────────────────────── */}
      {activeTab === "profile" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-50 duration-300">
          <div className="p-6 rounded-3xl bg-neutral-950 border border-neutral-800 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" /> Identity Details
              </h3>
              <button
                onClick={handleOpenEditProfile}
                className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Full Name</p>
                <p className="text-sm font-semibold text-neutral-100 mt-0.5">{displayName}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Registered Mobile Number</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-semibold text-neutral-100">{customer.phone || "Not linked"}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 text-[10px] font-bold text-emerald-400">
                    <Lock className="w-2.5 h-2.5" /> OTP Verified
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Email Address</p>
                <p className="text-sm font-semibold text-neutral-100 mt-0.5">{customer.email || "No email provided"}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Date of Birth</p>
                <p className="text-sm font-semibold text-neutral-100 mt-0.5">{formattedDob}</p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-neutral-950 border border-neutral-800 space-y-6">
            <div className="border-b border-neutral-800 pb-4">
              <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" /> Account Security & Sessions
              </h3>
            </div>

            <div className="space-y-4 text-xs text-neutral-300">
              <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-100">Passwordless OTP Authentication</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">ACTIVE</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Your account uses direct SMS/WhatsApp one-time verification tokens. No passwords to remember or compromise.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-100">Primary Delivery Hub</span>
                  <span className="text-amber-400 font-semibold">{customer.branch_name || ""}</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Fastest fulfillment and chef dispatch routed from your nearest neighborhood temperature-controlled kitchen.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. TAB 2: ORDER HISTORY ──────────────────────────────────────── */}
      {activeTab === "orders" && (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-100">Recent Cake Deliveries</h3>
            <Link href="/products" className="text-xs text-amber-400 font-bold hover:underline flex items-center gap-1">
              Browse Catalog <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {ordersLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="p-6 rounded-3xl bg-neutral-950 border border-neutral-800 animate-pulse space-y-3">
                  <div className="h-4 bg-neutral-800 rounded w-1/4" />
                  <div className="h-3 bg-neutral-800 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-neutral-950 border border-neutral-800 space-y-4">
              <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mx-auto text-neutral-400">
                <Package className="w-8 h-8 text-neutral-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-neutral-100">No Orders Placed Yet</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Treat yourself or surprise a loved one with our master pastry chef signature cakes.
                </p>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-lg shadow-amber-500/20"
              >
                Order Fresh Cake Now
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                const isDelivered = (order.status || "").toUpperCase() === "DELIVERED";
                const isProcessing = ["BAKING", "ACCEPTED", "DISPATCHED", "PENDING"].includes((order.status || "").toUpperCase());

                return (
                  <div
                    key={order.id}
                    className="p-6 rounded-3xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-sm text-neutral-100">Order #{order.order_number || order.id.slice(-8)}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isDelivered
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                : isProcessing
                                ? "bg-amber-950 text-amber-400 border border-amber-800"
                                : "bg-neutral-800 text-neutral-300"
                            }`}
                          >
                            {order.status || "CONFIRMED"}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">Placed on {orderDate}</p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-base font-extrabold text-amber-400">
                          ₹{Number(order.grand_total || order.total || order.subtotal || 0).toLocaleString("en-IN")}
                        </p>
                        <p className="text-[11px] text-neutral-400">{order.items?.length || 1} Item(s)</p>
                      </div>
                    </div>

                    {/* Order Line Items */}
                    <div className="space-y-3">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-neutral-900 overflow-hidden shrink-0 border border-neutral-800 flex items-center justify-center">
                              {item.thumbnail ? (
                                <img src={item.thumbnail} alt={item.title || "Cake"} className="w-full h-full object-cover" />
                              ) : (
                                <Cake className="w-5 h-5 text-amber-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-200 line-clamp-1">{item.title || item.product_name || "Artisanal Cake"}</p>
                              <p className="text-[10px] text-neutral-400">Qty: {item.quantity} × ₹{item.unit_price}</p>
                            </div>
                          </div>
                          <span className="font-bold text-neutral-200">₹{item.total_price}</span>
                        </div>
                      ))}
                    </div>

                    {order.shipping_address && (
                      <div className="pt-3 border-t border-neutral-900 text-[11px] text-neutral-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                        <span className="truncate">
                          Delivered to: {order.shipping_address.address_1}, {order.shipping_address.city} - {order.shipping_address.postal_code}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 5. TAB 3: SAVED ADDRESSES ────────────────────────────────────── */}
      {activeTab === "addresses" && (
        <div className="space-y-4 animate-in fade-in-50 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-100">Delivery Address Book</h3>
            <button
              onClick={handleOpenNewAddress}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Address
            </button>
          </div>

          {addressesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="p-6 rounded-3xl bg-neutral-950 border border-neutral-800 animate-pulse space-y-3">
                  <div className="h-4 bg-neutral-800 rounded w-1/3" />
                  <div className="h-3 bg-neutral-800 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : addresses.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-neutral-950 border border-neutral-800 space-y-4">
              <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mx-auto text-neutral-400">
                <MapPin className="w-8 h-8 text-neutral-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-neutral-100">No Saved Addresses</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Add your home, work, or celebration party venue address for 1-click express checkout.
                </p>
              </div>
              <button
                onClick={handleOpenNewAddress}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Add Your First Address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="p-6 rounded-3xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-100">{addr.label || addr.type || "Home"}</span>
                        {addr.is_default && (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-[10px] font-bold text-emerald-400">
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenEditAddress(addr)}
                          className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-amber-400 transition cursor-pointer"
                          title="Edit address"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteAddress(addr.id)}
                          className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-[#D4AF37] transition cursor-pointer"
                          title="Delete address"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                      {addr.address_1}
                      {addr.landmark && <span className="block text-neutral-400 text-[11px]">Landmark: {addr.landmark}</span>}
                      <span className="block text-neutral-400 text-[11px] mt-0.5">
                        {[addr.city, addr.state].filter(Boolean).join(", ")} - {addr.postal_code}
                      </span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-neutral-900 flex items-center justify-between text-xs text-neutral-400">
                    <span>Contact: {addr.phone || customer.phone}</span>
                    {!addr.is_default && (
                      <button
                        onClick={() => saveAddress({ id: addr.id, is_default: true })}
                        className="text-amber-400 hover:underline font-bold text-[11px] cursor-pointer"
                      >
                        Set as Default
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 6. TAB 4: COMMUNICATION PREFERENCES ──────────────────────────── */}
      {activeTab === "preferences" && (
        <div className="p-6 sm:p-8 rounded-3xl bg-neutral-950 border border-neutral-800 space-y-6 animate-in fade-in-50 duration-300">
          <div className="border-b border-neutral-800 pb-4">
            <h3 className="text-base font-bold text-neutral-100 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" /> Notifications & Channels
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Choose how you wish to receive real-time cake baking, rider tracking, and chef dispatch alerts.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400" /> WhatsApp Live Dispatch Updates
                </span>
                <p className="text-xs text-neutral-400">
                  Receive live WhatsApp notifications when the chef puts cake in the oven and when the courier heads to your door.
                </p>
              </div>
              <input
                type="checkbox"
                checked={customer.preferences?.whatsapp_notifications ?? true}
                onChange={(e) => handleTogglePref("whatsapp_notifications", e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-400" /> Email Invoices & Baker's Specials
                </span>
                <p className="text-xs text-neutral-400">
                  GST tax invoice receipts, birthday celebration reminders, and seasonal mango/chocolate harvest menus.
                </p>
              </div>
              <input
                type="checkbox"
                checked={customer.preferences?.marketing_emails ?? true}
                onChange={(e) => handleTogglePref("marketing_emails", e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-neutral-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#D4AF37]" /> SMS Delivery OTP Alerts
                </span>
                <p className="text-xs text-neutral-400">
                  Secure one-time delivery verification PIN directly delivered via SMS on your registered phone.
                </p>
              </div>
              <input
                type="checkbox"
                checked={customer.preferences?.sms_notifications ?? true}
                onChange={(e) => handleTogglePref("sms_notifications", e.target.checked)}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 7. EDIT PROFILE MODAL ─────────────────────────────────────────── */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-neutral-950 border border-neutral-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" /> Edit Profile Information
              </h3>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3.5 rounded-2xl bg-[#0c1326]/60 border border-[#D4AF37]/20 text-[#D4AF37]/80 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Full Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Alex R Ashok"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="e.g. alex@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={editDob}
                  onChange={(e) => setEditDob(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Mobile Phone Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customer.phone || ""}
                    disabled
                    className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/50 border border-neutral-800/60 text-neutral-400 text-xs cursor-not-allowed"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Read-Only
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Mobile number is locked and verified via OTP for account security.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileUpdating}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {profileUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8. ADD/EDIT ADDRESS MODAL ─────────────────────────────────────── */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-neutral-950 border border-neutral-800 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-400" /> {editingAddressId ? "Edit Address" : "Add Delivery Address"}
              </h3>
              <button
                onClick={() => setIsAddressModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addrError && (
              <div className="p-3.5 rounded-2xl bg-[#0c1326]/60 border border-[#D4AF37]/20 text-[#D4AF37]/80 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addrError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAddress} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Address Type</label>
                  <select
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                  >
                    <option value="Home">Home</option>
                    <option value="Work">Office / Work</option>
                    <option value="Party Venue">Party Venue / Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Recipient Name</label>
                  <input
                    type="text"
                    value={addrName}
                    onChange={(e) => setAddrName(e.target.value)}
                    placeholder="Recipient Name"
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Contact Phone</label>
                <input
                  type="text"
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Address Line 1 (Flat, House No., Building, Street) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={addrLine1}
                  onChange={(e) => setAddrLine1(e.target.value)}
                  placeholder="e.g. Flat 302, Palm Heights, 100ft Road"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Landmark</label>
                  <input
                    type="text"
                    value={addrLandmark}
                    onChange={(e) => setAddrLandmark(e.target.value)}
                    placeholder="Near Metro Station"
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Postal Pincode <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={addrPincode}
                    onChange={(e) => setAddrPincode(e.target.value)}
                    placeholder="560001"
                    maxLength={6}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="addr_default_chk"
                  checked={addrIsDefault}
                  onChange={(e) => setAddrIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
                <label htmlFor="addr_default_chk" className="text-xs text-neutral-300 font-medium cursor-pointer">
                  Set as default delivery address
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addressSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {addressSaving ? "Saving..." : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
