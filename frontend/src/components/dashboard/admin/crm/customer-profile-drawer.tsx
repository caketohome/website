"use client";

import { useState, useEffect } from "react";
import {
  X,
  Phone,
  MessageSquare,
  ShoppingCart,
  Package,
  Calendar,
  Clock,
  MapPin,
  Tag,
  FileText,
  Award,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Plus,
  Send,
  User,
  ChevronRight,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { Badge, Button, Heading, Text, Input, Label } from "@medusajs/ui";
import { CustomerProfile, CustomerNote, ActivityEventType } from "@frontend/lib/crm/types";
import { formatDisplayPhone } from "@frontend/lib/crm/crm-engine";
import { apiClient } from "@frontend/lib/api-client";

interface CustomerProfileDrawerProps {
  customerUid: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenOrderDrawer?: (orderId: string) => void;
  onOpenWhatsAppModal?: (customer: CustomerProfile) => void;
  onRefreshList?: () => void;
}

type TabType =
  | "overview"
  | "orders"
  | "carts"
  | "abandoned"
  | "activity"
  | "addresses"
  | "communications"
  | "notes"
  | "tags"
  | "loyalty"
  | "recovery"
  | "consent";

export function CustomerProfileDrawer({
  customerUid,
  isOpen,
  onClose,
  onOpenOrderDrawer,
  onOpenWhatsAppModal,
  onRefreshList,
}: CustomerProfileDrawerProps) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState("GENERAL");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [callingState, setCallingState] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!customerUid) return;
    setLoading(true);
    try {
      const res: any = await apiClient.getAdminCustomerProfile(customerUid);
      if (res?.customer) {
        setProfile(res.customer);
      }
    } catch (err) {
      console.error("[Customer Drawer] Failed to fetch customer profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customerUid) {
      fetchProfile();
    } else {
      setProfile(null);
      setActiveTab("overview");
    }
  }, [isOpen, customerUid]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !profile) return;
    setSubmittingNote(true);
    try {
      await apiClient.addAdminCustomerNote(profile.customer_uid, newNoteContent, newNoteCategory);
      setNewNoteContent("");
      fetchProfile();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTagInput.trim() || !profile) return;
    const clean = newTagInput.trim();
    if (profile.tags?.includes(clean)) return;
    const updated = [...(profile.tags || []), clean];
    try {
      await apiClient.updateAdminCustomerTags(profile.customer_uid, updated);
      setNewTagInput("");
      fetchProfile();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      console.error("Failed to update tags:", err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!profile) return;
    const updated = (profile.tags || []).filter((t) => t !== tagToRemove);
    try {
      await apiClient.updateAdminCustomerTags(profile.customer_uid, updated);
      fetchProfile();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      console.error("Failed to remove tag:", err);
    }
  };

  const handleInitiateCall = async () => {
    if (!profile) return;
    setCallingState("Calling...");
    try {
      await apiClient.recordAdminCallAction(profile.customer_uid, undefined, "CALL_INITIATED");
      fetchProfile();
      if (typeof window !== "undefined") {
        window.location.href = `tel:${profile.phone.replace(/\s+/g, "")}`;
      }
    } catch (err) {
      console.error("Failed to log call:", err);
    } finally {
      setTimeout(() => setCallingState(null), 2500);
    }
  };

  if (!isOpen) return null;

  const getLifecycleColor = (stage?: string) => {
    switch (stage) {
      case "LOYAL":
        return "purple";
      case "REPEAT_BUYER":
      case "ACTIVE":
        return "green";
      case "FIRST_PURCHASE":
        return "blue";
      case "NEW":
      case "REGISTERED":
        return "orange";
      case "AT_RISK":
        return "red";
      case "DORMANT":
        return "grey";
      default:
        return "grey";
    }
  };

  const getActivityIcon = (type: ActivityEventType) => {
    switch (type) {
      case "ORDER_PLACED":
      case "ORDER_CONFIRMED":
      case "ORDER_DELIVERED":
        return <Package className="w-3.5 h-3.5 text-emerald-600" />;
      case "CART_ITEM_ADDED":
      case "CART_CREATED":
        return <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />;
      case "RECOVERY_MESSAGE_SENT":
      case "RECOVERY_MESSAGE_DELIVERED":
        return <MessageSquare className="w-3.5 h-3.5 text-amber-600" />;
      case "CALL_INITIATED":
        return <Phone className="w-3.5 h-3.5 text-purple-600" />;
      case "NOTE_ADDED":
        return <FileText className="w-3.5 h-3.5 text-indigo-600" />;
      case "TAG_ADDED":
        return <Tag className="w-3.5 h-3.5 text-rose-600" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-neutral-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 h-full shadow-2xl flex flex-col border-l border-neutral-200 dark:border-neutral-800 animate-slide-in-right overflow-hidden">
        {/* Top Header Ribbon */}
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/80 flex items-start justify-between gap-4">
          {loading || !profile ? (
            <div className="animate-pulse flex flex-col gap-2">
              <div className="h-6 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
              <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Heading level="h2" className="text-xl font-bold truncate">
                  {profile.name}
                </Heading>
                <Badge color={getLifecycleColor(profile.lifecycle_stage)} className="text-xs">
                  {profile.lifecycle_stage?.replace(/_/g, " ")}
                </Badge>
                {profile.is_vip && (
                  <Badge color="purple" className="text-xs font-semibold">
                    👑 VIP Platinum
                  </Badge>
                )}
                <span className="text-xs font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                  {profile.customer_number || profile.customer_uid}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400 flex-wrap">
                <span className="flex items-center gap-1 font-mono font-medium">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  {formatDisplayPhone(profile.phone)}
                </span>
                {profile.email && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    {profile.email}
                  </span>
                )}
                <span className="flex items-center gap-1 text-neutral-400">
                  <Clock className="w-3.5 h-3.5" />
                  Active: {new Date(profile.last_active_at || profile.updated_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={handleInitiateCall}
                  className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {callingState || "Call"}
                </Button>

                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => onOpenWhatsAppModal && onOpenWhatsAppModal(profile)}
                  className="flex items-center gap-1.5 text-xs text-green-800 bg-green-50 hover:bg-green-100 border-green-300"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp
                </Button>
              </>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer Journey Funnel Tracker */}
        {profile && profile.journey_funnel && (
          <div className="px-5 py-2.5 bg-rose-50/50 dark:bg-rose-950/20 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between gap-2 overflow-x-auto text-[11px]">
            <span className="font-semibold text-rose-900 dark:text-rose-300 shrink-0 uppercase tracking-wider text-[10px]">
              Customer Funnel:
            </span>
            <div className="flex items-center gap-1.5 flex-1 min-w-[500px]">
              {[
                { label: "Visited", done: profile.journey_funnel.visited },
                { label: "Registered", done: profile.journey_funnel.registered },
                { label: "Product", done: profile.journey_funnel.product_viewed },
                { label: "Cart", done: profile.journey_funnel.cart_added },
                { label: "Checkout", done: profile.journey_funnel.checkout_started },
                { label: "Payment", done: profile.journey_funnel.payment_started },
                { label: "Order", done: profile.journey_funnel.order_completed },
              ].map((step, idx, arr) => (
                <div key={step.label} className="flex items-center gap-1 flex-1">
                  <div
                    className={`flex-1 py-1 px-2 rounded text-center font-medium transition-colors ${
                      step.done
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold"
                        : idx === 0 || arr[idx - 1]?.done
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold border border-amber-300"
                        : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800"
                    }`}
                  >
                    {step.label} {step.done ? "✓" : ""}
                  </div>
                  {idx < arr.length - 1 && <ChevronRight className="w-3 h-3 text-neutral-300 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation Ribbon */}
        <div className="flex items-center gap-1 px-5 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto bg-white dark:bg-neutral-900 shrink-0">
          {[
            { id: "overview", label: "Overview", icon: User },
            { id: "orders", label: `Orders (${profile?.orders?.length || 0})`, icon: Package },
            { id: "abandoned", label: `Carts (${profile?.abandoned_carts?.length || 0})`, icon: ShoppingCart },
            { id: "activity", label: `Timeline (${profile?.activity_timeline?.length || 0})`, icon: Clock },
            { id: "notes", label: `Notes (${profile?.notes?.length || 0})`, icon: FileText },
            { id: "tags", label: `Tags (${profile?.tags?.length || 0})`, icon: Tag },
            { id: "addresses", label: "Addresses", icon: MapPin },
            { id: "loyalty", label: `Loyalty (${profile?.loyalty?.points_balance || 0} pts)`, icon: Award },
            { id: "consent", label: "Consent & Safety", icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-3 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? "border-rose-600 text-rose-600"
                    : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading || !profile ? (
            <div className="flex flex-col items-center justify-center h-64 text-neutral-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
              <span className="text-xs">Loading customer profile...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="flex flex-col gap-6">
                  {/* Financial KPI Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                        Lifetime Orders
                      </span>
                      <span className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                        {profile.orders_count || 0}
                      </span>
                      <span className="text-[11px] text-neutral-500 block mt-0.5">Completed Checkouts</span>
                    </div>

                    <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                        Total Spend
                      </span>
                      <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        ₹{(profile.total_spend || 0).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[11px] text-emerald-700/70 block mt-0.5">Gross Order Value</span>
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                      <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block mb-1">
                        Avg Order Value
                      </span>
                      <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                        ₹{(profile.aov || 0).toLocaleString("en-IN")}
                      </span>
                      <span className="text-[11px] text-blue-700/70 block mt-0.5">Per Basket</span>
                    </div>

                    <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50">
                      <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block mb-1">
                        Reward Points
                      </span>
                      <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                        {profile.loyalty?.points_balance || 0}
                      </span>
                      <span className="text-[11px] text-purple-700/70 block mt-0.5">
                        Tier: {profile.tier || "STANDARD"}
                      </span>
                    </div>
                  </div>

                  {/* Primary Profile Attributes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3">
                      <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Customer Metadata
                      </Heading>
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">Canonical UID</span>
                          <span className="font-mono font-semibold">{profile.customer_uid}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">Customer Number</span>
                          <span className="font-mono">{profile.customer_number || "—"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">Registered On</span>
                          <span>{new Date(profile.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">First Order Date</span>
                          <span>{profile.first_order_at ? new Date(profile.first_order_at).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "No orders yet"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">Last Order Date</span>
                          <span>{profile.last_order_at ? new Date(profile.last_order_at).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "No orders yet"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-neutral-500">Acquisition Channel</span>
                          <span className="font-semibold text-rose-600">{profile.acquisition_channel || "Direct Storefront"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3">
                      <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Operational Routing & Hub
                      </Heading>
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">Assigned Branch</span>
                          <span className="font-semibold">{profile.branch_name || profile.branch_id || "Indiranagar Flagship Kitchen"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">City / Region</span>
                          <span>{profile.city_name || "Bengaluru"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">Preferred Pincode</span>
                          <span className="font-mono">{profile.delivery_pincode || "560038"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutral-100 dark:border-neutral-800">
                          <span className="text-neutral-500">WhatsApp Reachability</span>
                          <Badge color={profile.consent?.whatsapp_status === "ELIGIBLE" ? "green" : "red"}>
                            {profile.consent?.whatsapp_status || "ELIGIBLE"}
                          </Badge>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-neutral-500">Active Cart Status</span>
                          <span className="font-semibold">{profile.cart_status || "NO_CART"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ORDERS */}
              {activeTab === "orders" && (
                <div className="flex flex-col gap-4">
                  {(!profile.orders || profile.orders.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <ShoppingBag className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">No completed or active orders found for this customer.</Text>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {profile.orders.map((ord: any) => (
                        <div
                          key={ord.id || ord.order_number}
                          className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-rose-400 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs">{ord.order_number || ord.id}</span>
                              <Badge color={ord.status === "confirmed" || ord.status === "delivered" ? "green" : ord.status === "cancelled" ? "red" : "blue"}>
                                {ord.status}
                              </Badge>
                              <Badge color="grey" className="text-[10px]">
                                {ord.payment_status || "paid"}
                              </Badge>
                            </div>
                            <span className="text-xs text-neutral-500">
                              {new Date(ord.created_at).toLocaleDateString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              {(ord.items || []).map((itm: any, idx: number) => (
                                <span key={idx} className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                                  • {itm.title || itm.name} (x{itm.quantity || 1})
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <span className="text-base font-extrabold text-neutral-900 dark:text-white block">
                                ₹{(Number(ord.total) || Number(ord.grand_total) || 0).toLocaleString("en-IN")}
                              </span>
                              <span className="text-[10px] text-neutral-500">
                                {ord.branch?.name || ord.branch_name || "Flagship Hub"}
                              </span>
                            </div>

                            {onOpenOrderDrawer && (
                              <Button
                                size="small"
                                variant="secondary"
                                onClick={() => onOpenOrderDrawer(ord.id || ord.order_number)}
                                className="text-xs"
                              >
                                View Order
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ABANDONED CARTS */}
              {activeTab === "abandoned" && (
                <div className="flex flex-col gap-4">
                  {(!profile.abandoned_carts || profile.abandoned_carts.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <ShoppingCart className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">No abandoned carts currently recorded.</Text>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {profile.abandoned_carts.map((cart: any) => (
                        <div
                          key={cart.id || cart.cart_id}
                          className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20 flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs">{cart.cart_id || cart.id}</span>
                              <Badge color={cart.status === "RECOVERED" ? "green" : "orange"}>
                                {cart.status}
                              </Badge>
                            </div>
                            <span className="text-base font-extrabold text-amber-900 dark:text-amber-300">
                              ₹{(cart.grand_total || cart.subtotal || 0).toLocaleString("en-IN")}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1 text-xs">
                            {(cart.items || []).map((itm: any, i: number) => (
                              <div key={i} className="flex justify-between text-neutral-700 dark:text-neutral-300">
                                <span>{itm.product_name} (x{itm.quantity})</span>
                                <span className="font-mono font-semibold">₹{itm.total_price || itm.unit_price}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-amber-200/60 text-[11px] text-neutral-500">
                            <span>Abandoned at: {new Date(cart.abandoned_at || cart.last_activity_at).toLocaleDateString("en-IN", { timeStyle: "short", dateStyle: "short" })}</span>
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => onOpenWhatsAppModal && onOpenWhatsAppModal(profile)}
                              className="text-xs text-amber-800 bg-amber-100 hover:bg-amber-200 border-amber-300"
                            >
                              Dispatch Recovery
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: ACTIVITY TIMELINE */}
              {activeTab === "activity" && (
                <div className="flex flex-col gap-4">
                  {(!profile.activity_timeline || profile.activity_timeline.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <Clock className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">No activity events recorded yet.</Text>
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-neutral-200 dark:border-neutral-800 ml-3 flex flex-col gap-4 py-2">
                      {profile.activity_timeline.map((act) => (
                        <div key={act.id} className="relative pl-6 flex flex-col gap-1">
                          <div className="absolute -left-2.5 top-1 w-5 h-5 rounded-full bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-700 flex items-center justify-center">
                            {getActivityIcon(act.event_type)}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-900 dark:text-white">
                              {act.title}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {new Date(act.timestamp).toLocaleDateString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                            </span>
                          </div>
                          {act.description && (
                            <p className="text-xs text-neutral-600 dark:text-neutral-400">
                              {act.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: NOTES */}
              {activeTab === "notes" && (
                <div className="flex flex-col gap-6">
                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 flex flex-col gap-3">
                    <Label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                      Add Internal Staff Note
                    </Label>
                    <textarea
                      rows={3}
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="e.g. Customer requested extra chocolate frosting on anniversary orders..."
                      className="w-full p-2.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-1 focus:ring-rose-500 focus:outline-none"
                      required
                    />
                    <div className="flex items-center justify-between">
                      <select
                        value={newNoteCategory}
                        onChange={(e) => setNewNoteCategory(e.target.value)}
                        className="py-1 px-2 text-xs rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                      >
                        <option value="GENERAL">General</option>
                        <option value="DELIVERY_PREFERENCE">Delivery Preference</option>
                        <option value="COMPLAINT">Customer Issue / Complaint</option>
                        <option value="VIP_REQUEST">VIP Special Request</option>
                        <option value="RECOVERY">Recovery Outreach</option>
                      </select>
                      <Button
                        size="small"
                        type="submit"
                        isLoading={submittingNote}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
                      >
                        Save Staff Note
                      </Button>
                    </div>
                  </form>

                  {/* Notes Feed */}
                  <div className="flex flex-col gap-3">
                    {(!profile.notes || profile.notes.length === 0) ? (
                      <div className="p-8 text-center text-xs text-neutral-400 border border-dashed rounded-lg">
                        No internal staff notes recorded yet.
                      </div>
                    ) : (
                      profile.notes.map((n) => (
                        <div
                          key={n.id}
                          className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-neutral-900 dark:text-white">{n.author_name}</span>
                              <Badge color="purple" className="text-[10px]">{n.category || "GENERAL"}</Badge>
                            </div>
                            <span className="text-[10px] text-neutral-400">
                              {new Date(n.created_at).toLocaleDateString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                            {n.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 6: TAGS */}
              {activeTab === "tags" && (
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="e.g. VIP, Corporate, Midnight Buyer..."
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      className="text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <Button size="small" onClick={handleAddTag} className="text-xs bg-rose-600 hover:bg-rose-700 text-white shrink-0">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Tag
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(!profile.tags || profile.tags.length === 0) ? (
                      <div className="p-8 w-full text-center text-xs text-neutral-400 border border-dashed rounded-lg">
                        No tags assigned to this customer yet.
                      </div>
                    ) : (
                      profile.tags.map((t) => (
                        <span
                          key={t}
                          className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5"
                        >
                          <Tag className="w-3 h-3 text-rose-500" />
                          {t}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="hover:text-rose-900 font-bold ml-1"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 7: ADDRESSES */}
              {activeTab === "addresses" && (
                <div className="flex flex-col gap-3">
                  {(!profile.addresses || profile.addresses.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <MapPin className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">No saved delivery addresses found.</Text>
                    </div>
                  ) : (
                    profile.addresses.map((addr, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 dark:text-white">
                            {addr.type || "Delivery Address"} {addr.is_default && "(Default)"}
                          </span>
                          <Badge color="blue">{addr.city || "Bengaluru"}</Badge>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400">{addr.address_1}</p>
                        {addr.landmark && <p className="text-neutral-500">Landmark: {addr.landmark}</p>}
                        <p className="font-mono text-neutral-500">Pincode: {addr.postal_code}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 8: LOYALTY & REWARDS */}
              {activeTab === "loyalty" && (
                <div className="flex flex-col gap-4">
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex flex-col gap-4 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-6 h-6 text-amber-400" />
                        <span className="font-bold text-base">Sweet Rewards™ Tier</span>
                      </div>
                      <Badge color="purple" className="text-xs uppercase font-extrabold bg-amber-400 text-neutral-900">
                        {profile.loyalty?.tier || profile.tier || "STANDARD"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/20">
                      <div>
                        <span className="text-[10px] uppercase text-purple-200 block">Current Balance</span>
                        <span className="text-2xl font-bold">{profile.loyalty?.points_balance || 0} pts</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-purple-200 block">Total Earned</span>
                        <span className="text-xl font-semibold">{profile.loyalty?.points_earned || 0} pts</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-purple-200 block">Redeemed</span>
                        <span className="text-xl font-semibold">{profile.loyalty?.points_redeemed || 0} pts</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: CONSENT & SAFETY */}
              {activeTab === "consent" && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3">
                    <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Communication Consent Registry
                    </Heading>
                    <div className="flex flex-col gap-2 text-xs">
                      <div className="flex justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
                        <div>
                          <span className="font-semibold block">WhatsApp Business Messaging</span>
                          <span className="text-[11px] text-neutral-500">Automated order alerts, live delivery tracking & cart recovery</span>
                        </div>
                        <Badge color={profile.consent?.whatsapp_status === "ELIGIBLE" ? "green" : "red"}>
                          {profile.consent?.whatsapp_status || "ELIGIBLE"}
                        </Badge>
                      </div>

                      <div className="flex justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
                        <div>
                          <span className="font-semibold block">Transactional Communication (OTP & Invoices)</span>
                          <span className="text-[11px] text-neutral-500">Critical order confirmations and OTP verification</span>
                        </div>
                        <Badge color="green">Always Active</Badge>
                      </div>

                      <div className="flex justify-between py-2">
                        <div>
                          <span className="font-semibold block">Marketing & Promotional Offers</span>
                          <span className="text-[11px] text-neutral-500">Special seasonal discounts, festive coupons & announcements</span>
                        </div>
                        <Badge color={profile.consent?.marketing_email === "SUBSCRIBED" ? "green" : "grey"}>
                          {profile.consent?.marketing_email || "SUBSCRIBED"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
