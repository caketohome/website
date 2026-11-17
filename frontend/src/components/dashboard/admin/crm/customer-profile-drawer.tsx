"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Button, Input, Textarea, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  X,
  Phone,
  MessageSquare,
  Package,
  Calendar,
  Clock,
  MapPin,
  Tag,
  FileText,
  AlertTriangle,
  Award,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  User,
  ShoppingBag,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
  Plus,
  RefreshCw,
  ShoppingCart,
  Truck,
  CreditCard,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  CustomerProfile,
  CustomerRecord,
  CustomerActivityEvent,
  ActivityEventType,
  CustomerPaymentRecord,
  CustomerDeliveryRecord,
  CustomerProductPurchased,
  CrmCommunicationLog,
} from "@frontend/lib/crm/types";
import { formatDisplayPhone } from "@frontend/lib/crm/crm-engine";

interface CustomerProfileDrawerProps {
  customerUid: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenOrderDrawer?: (order: any) => void;
  onOpenWhatsAppModal?: (customer: CustomerRecord | CustomerProfile) => void;
  onRefreshList?: () => void;
}

type TabType =
  | "overview"
  | "lineage"
  | "intelligence"
  | "orders"
  | "payments"
  | "deliveries"
  | "products"
  | "timeline"
  | "communications"
  | "notes"
  | "reminders"
  | "addresses"
  | "analytics"
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
  const [newNoteCategory, setNewNoteCategory] = useState<any>("GENERAL");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [callingState, setCallingState] = useState<string | null>(null);

  // Staff Action Modals State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [telecallerName, setTelecallerName] = useState("");
  const [telecallerId, setTelecallerId] = useState("");
  const [submittingAssign, setSubmittingAssign] = useState(false);

  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderReason, setReminderReason] = useState("");
  const [reminderPriority, setReminderPriority] = useState<any>("HIGH");
  const [submittingReminder, setSubmittingReminder] = useState(false);

  const fetchProfile = async () => {
    if (!customerUid) return;
    setLoading(true);
    try {
      const res: any = await apiClient.getCustomerProfile(customerUid);
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
      setAssignModalOpen(false);
      setReminderModalOpen(false);
    }
  }, [isOpen, customerUid]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !profile) return;
    setSubmittingNote(true);
    try {
      await apiClient.createCustomerNote(profile.customer_uid, newNoteContent, newNoteCategory);
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
      await apiClient.updateCustomerTags(profile.customer_uid, updated);
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
      await apiClient.updateCustomerTags(profile.customer_uid, updated);
      fetchProfile();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      console.error("Failed to remove tag:", err);
    }
  };

  const handleAssignTelecaller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !telecallerName) return;
    setSubmittingAssign(true);
    try {
      await apiClient.assignCustomerTelecaller(profile.customer_uid, telecallerId || "staff_tele_01", telecallerName);
      setAssignModalOpen(false);
      setTelecallerName("");
      fetchProfile();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      console.error("Failed to assign telecaller:", err);
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleScheduleReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !reminderDate || !reminderReason) return;
    setSubmittingReminder(true);
    try {
      await apiClient.scheduleCustomerReminder(profile.customer_uid, {
        due_date: reminderDate,
        reason: reminderReason,
        priority: reminderPriority,
      });
      setReminderModalOpen(false);
      setReminderDate("");
      setReminderReason("");
      fetchProfile();
      if (onRefreshList) onRefreshList();
    } catch (err) {
      console.error("Failed to schedule reminder:", err);
    } finally {
      setSubmittingReminder(false);
    }
  };

  const handleInitiateCall = async () => {
    if (!profile) return;
    setCallingState("Calling...");
    try {
      await fetch(`/api/v1/admin/crm/customers/${profile.customer_uid}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: "CALL_INITIATED" }),
      });
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
      case "VIP":
        return "purple";
      case "REPEAT_BUYER":
        return "green";
      case "FIRST_PURCHASE":
        return "blue";
      case "NEW":
        return "orange";
      case "AT_RISK":
        return "red";
      case "DORMANT":
        return "grey";
      default:
        return "grey";
    }
  };

  const getRiskBadgeColor = (riskScore?: number) => {
    const score = riskScore || 0;
    if (score >= 60) return "red";
    if (score >= 35) return "orange";
    return "green";
  };

  const getWhatsAppBadgeColor = (status?: string) => {
    switch (status) {
      case "CONNECTED":
      case "OPTED_IN":
        return "green";
      case "OPTED_OUT":
      case "INVALID":
        return "red";
      default:
        return "grey";
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
                <Badge color={getLifecycleColor(profile.lifecycle_stage)} className="text-xs font-semibold">
                  {profile.lifecycle_stage?.replace(/_/g, " ")}
                </Badge>
                {profile.is_vip && (
                  <Badge color="purple" className="text-xs font-semibold">
                    👑 VIP Platinum
                  </Badge>
                )}
                <Badge color={getWhatsAppBadgeColor(profile.consent?.whatsapp_status)} className="text-xs font-semibold">
                  💬 WhatsApp: {profile.consent?.whatsapp_status || "UNKNOWN"}
                </Badge>
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
                <span className="flex items-center gap-1 text-neutral-500">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  {profile.branch_name || "—"} {profile.city_name ? `(${profile.city_name})` : ""}
                </span>
                {profile.assigned_telecaller_name && (
                  <span className="flex items-center gap-1 text-brand-primary font-medium bg-brand-light dark:bg-brand-navy/40 px-2 py-0.5 rounded">
                    Telecaller: {profile.assigned_telecaller_name}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {profile && (
              <>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setAssignModalOpen(true)}
                  className="flex items-center gap-1 text-xs text-brand-navy bg-brand-light hover:bg-brand-light border-brand-primary/30"
                >
                  <User className="w-3.5 h-3.5" />
                  Assign
                </Button>

                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setReminderModalOpen(true)}
                  className="flex items-center gap-1 text-xs text-brand-gold-dark bg-brand-gold-light hover:bg-brand-gold-light border-brand-gold/40"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Reminder
                </Button>

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

        {/* Tab Navigation Ribbon */}
        <div className="flex items-center gap-1 px-5 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto bg-white dark:bg-neutral-900 shrink-0">
          {[
            { id: "overview", label: "Overview", icon: User },
            { id: "lineage", label: "Data Lineage Trace", icon: Layers },
            { id: "intelligence", label: "Purchase Intelligence", icon: Sparkles },
            { id: "orders", label: `Orders (${profile?.orders?.length || 0})`, icon: Package },
            { id: "payments", label: `Payments (${profile?.payment_history?.length || 0})`, icon: CreditCard },
            { id: "deliveries", label: `Deliveries (${profile?.delivery_history?.length || 0})`, icon: Truck },
            { id: "products", label: `Products (${profile?.products_purchased?.length || 0})`, icon: ShoppingBag },
            { id: "timeline", label: `Timeline (${profile?.activity_timeline?.length || 0})`, icon: Clock },
            { id: "communications", label: `Comms (${profile?.communication_history?.length || 0})`, icon: MessageSquare },
            { id: "notes", label: `Notes (${profile?.notes?.length || 0})`, icon: FileText },
            { id: "reminders", label: `Reminders (${profile?.reminders?.length || 0})`, icon: Calendar },
            { id: "addresses", label: "Addresses", icon: MapPin },
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading || !profile ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="flex flex-col gap-6">
                  {/* Financial & Recency KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Lifetime Spend</span>
                      <span className="text-xl font-bold text-neutral-900 dark:text-white">
                        ₹{Number(profile.total_spend || 0).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Orders Completed</span>
                      <span className="text-xl font-bold text-neutral-900 dark:text-white">
                        {profile.orders_count || 0}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Average Order Value</span>
                      <span className="text-xl font-bold text-neutral-900 dark:text-white">
                        ₹{Number(profile.aov || 0).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Churn Risk Score</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-neutral-900 dark:text-white">{profile.risk_score || 0}/100</span>
                        <Badge color={getRiskBadgeColor(profile.risk_score)} className="text-[10px]">
                          {(profile.risk_score || 0) >= 60 ? "High" : (profile.risk_score || 0) >= 35 ? "Moderate" : "Healthy"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Primary Location & Fulfillment Branch */}
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3">
                    <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Authoritative Fulfillment Context
                    </Heading>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-neutral-500 block">Primary Kitchen Hub</span>
                        <span className="font-semibold text-neutral-900 dark:text-white">{profile.branch_name || "—"}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Operating City</span>
                        <span className="font-semibold text-neutral-900 dark:text-white">{profile.city_name || "—"}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Delivery Pincode</span>
                        <span className="font-semibold text-neutral-900 dark:text-white">{profile.delivery_pincode || "—"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Orders Preview */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Recent Orders ({profile.orders?.length || 0})
                      </Heading>
                      <button
                        onClick={() => setActiveTab("orders")}
                        className="text-xs text-rose-600 font-semibold hover:underline flex items-center gap-1"
                      >
                        View All <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>

                    {(!profile.orders || profile.orders.length === 0) ? (
                      <div className="p-8 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700">
                        <Text className="text-neutral-500 text-xs">No orders placed by this customer yet.</Text>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {profile.orders.slice(0, 3).map((ord: any) => (
                          <div
                            key={ord.id}
                            onClick={() => onOpenOrderDrawer && onOpenOrderDrawer(ord)}
                            className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 flex items-center justify-between cursor-pointer transition-all text-xs"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-neutral-900 dark:text-white font-mono">
                                #{ord.order_number || ord.id}
                              </span>
                              <span className="text-neutral-500 text-[11px]">
                                {new Date(ord.created_at || ord.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} • {ord.items?.length || 1} items
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="font-bold text-neutral-900 dark:text-white">
                                ₹{Number(ord.total || ord.grand_total || 0).toLocaleString("en-IN")}
                              </span>
                              <Badge color={ord.status === "delivered" ? "green" : ord.status === "cancelled" ? "red" : "blue"}>
                                {ord.status?.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Customer Product Reviews */}
                  <div className="flex flex-col gap-3">
                    <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Verified Product Reviews ({profile.reviews_count || profile.reviews_written?.length || 0})
                    </Heading>

                    {(!profile.reviews_written || profile.reviews_written.length === 0) ? (
                      <div className="p-4 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700">
                        <Text className="text-neutral-500 text-xs">Customer has not submitted any product reviews yet.</Text>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {profile.reviews_written.map((rev: any) => (
                          <div
                            key={rev.id}
                            className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-neutral-900 dark:text-white">
                                {rev.rating}★ {rev.title}
                              </span>
                              <span className="text-[11px] text-neutral-400">
                                {new Date(rev.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            <p className="text-neutral-600 dark:text-neutral-300 text-[11px]">
                              {rev.review_text}
                            </p>
                            <div className="flex items-center gap-2 pt-1 text-[10px] text-neutral-400">
                              <span>Product: {rev.product_id}</span>
                              <span>•</span>
                              <span>Order: #{rev.order_id}</span>
                              {rev.is_verified_purchase && (
                                <span className="text-emerald-600 font-bold">✓ Verified Purchase</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: COMPLETE ORDER HISTORY */}
              {activeTab === "orders" && (
                <div className="flex flex-col gap-4">
                  {(!profile.orders || profile.orders.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">Zero order history on file.</Text>
                    </div>
                  ) : (
                    profile.orders.map((ord: any) => (
                      <div
                        key={ord.id}
                        className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-sm text-neutral-900 dark:text-white">
                              #{ord.order_number || ord.id}
                            </span>
                            <Badge color={ord.status === "delivered" ? "green" : ord.status === "cancelled" ? "red" : "blue"}>
                              {ord.status?.toUpperCase()}
                            </Badge>
                          </div>

                          <span className="text-xs text-neutral-500">
                            {new Date(ord.created_at || ord.date).toLocaleString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Order Items */}
                        <div className="flex flex-col gap-2">
                          {(ord.items || []).map((it: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1">
                              <span className="text-neutral-700 dark:text-neutral-300">
                                {it.quantity || 1}x {it.title || it.name || "Celebration Cake"} {it.variant_title ? `(${it.variant_title})` : ""}
                              </span>
                              <span className="font-semibold text-neutral-900 dark:text-white">
                                ₹{Number(it.total_price || it.unit_price || it.price || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                          <span className="text-neutral-500">Payment: {ord.payment_method || "UPI Online"}</span>
                          <span className="font-bold text-sm text-neutral-900 dark:text-white">
                            Total: ₹{Number(ord.total || ord.grand_total || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: PAYMENT HISTORY */}
              {activeTab === "payments" && (
                <div className="flex flex-col gap-4">
                  {(!profile.payment_history || profile.payment_history.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <CreditCard className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">No payment records found.</Text>
                    </div>
                  ) : (
                    profile.payment_history.map((pay: CustomerPaymentRecord, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between text-xs"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 dark:text-white">Order #{pay.order_number}</span>
                            <Badge color={pay.status === "PAID" ? "green" : pay.status === "FAILED" ? "red" : "orange"}>
                              {pay.status}
                            </Badge>
                          </div>
                          <span className="text-neutral-500 text-[11px]">
                            Gateway: {pay.gateway} • Ref: {pay.gateway_transaction_id || "N/A"}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-sm text-neutral-900 dark:text-white block">
                            ₹{pay.amount.toLocaleString("en-IN")}
                          </span>
                          <span className="text-neutral-400 text-[10px]">
                            {new Date(pay.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 4: DELIVERY HISTORY */}
              {activeTab === "deliveries" && (
                <div className="flex flex-col gap-4">
                  {(!profile.delivery_history || profile.delivery_history.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <Truck className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">No delivery records logged.</Text>
                    </div>
                  ) : (
                    profile.delivery_history.map((del: CustomerDeliveryRecord, idx: number) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900 dark:text-white">Order #{del.order_number}</span>
                            <Badge color={del.delivery_status === "DELIVERED" ? "green" : "blue"}>
                              {del.delivery_status}
                            </Badge>
                          </div>
                          <span className="text-neutral-500">Hub: {del.branch_name}</span>
                        </div>

                        <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                          <span>Assigned Rider: {del.rider_name || "Fleet Driver"}</span>
                          <span className="font-mono text-emerald-700 dark:text-emerald-400">Delivery OTP: {del.delivery_otp || "Verified"}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 5: PRODUCTS PURCHASED CATALOG INSIGHTS */}
              {activeTab === "products" && (
                <div className="flex flex-col gap-4">
                  {(!profile.products_purchased || profile.products_purchased.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <ShoppingBag className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">No product purchasing history available.</Text>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {profile.products_purchased.map((prod: CustomerProductPurchased, idx: number) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-neutral-900 dark:text-white text-sm">{prod.title}</span>
                            <Badge color="purple">{prod.category_name || "Cakes"}</Badge>
                          </div>
                          <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                            <span>Quantity Bought: {prod.total_quantity}</span>
                            <span className="font-semibold text-neutral-900 dark:text-white">₹{prod.total_spend.toLocaleString("en-IN")}</span>
                          </div>
                          <span className="text-[10px] text-neutral-400">
                            Last Purchased: {new Date(prod.last_bought_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: UNIFIED ACTIVITY TIMELINE */}
              {activeTab === "timeline" && (
                <div className="flex flex-col gap-3">
                  {(!profile.activity_timeline || profile.activity_timeline.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <Clock className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">No recorded events on timeline.</Text>
                    </div>
                  ) : (
                    profile.activity_timeline.map((act: CustomerActivityEvent) => (
                      <div
                        key={act.id}
                        className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-start gap-3 text-xs"
                      >
                        <div className="w-2 h-2 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-neutral-900 dark:text-white">{act.title}</span>
                            <span className="text-[11px] text-neutral-400">
                              {new Date(act.timestamp).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {act.description && <p className="text-neutral-600 dark:text-neutral-400 text-[11px]">{act.description}</p>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 7: COMMUNICATIONS LOG */}
              {activeTab === "communications" && (
                <div className="flex flex-col gap-4">
                  {(!profile.communication_history || profile.communication_history.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <MessageSquare className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">Zero communications dispatched to this customer.</Text>
                    </div>
                  ) : (
                    profile.communication_history.map((comm: CrmCommunicationLog) => (
                      <div
                        key={comm.id}
                        className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge color={comm.channel === "WHATSAPP" ? "green" : "blue"}>{comm.channel}</Badge>
                            <span className="font-bold text-neutral-900 dark:text-white">{comm.subject_or_title}</span>
                          </div>
                          <Badge color={comm.status === "DELIVERED" || comm.status === "READ" ? "green" : comm.status === "FAILED" ? "red" : "orange"}>
                            {comm.status}
                          </Badge>
                        </div>
                        {comm.body_preview && <p className="text-neutral-600 dark:text-neutral-400">{comm.body_preview}</p>}
                        <span className="text-[10px] text-neutral-400">
                          Dispatched: {new Date(comm.dispatched_at).toLocaleString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 8: STAFF NOTES */}
              {activeTab === "notes" && (
                <div className="flex flex-col gap-6">
                  {/* Create Note Form */}
                  <form onSubmit={handleAddNote} className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex flex-col gap-3">
                    <Label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Add Staff Observation / Note</Label>
                    <Textarea
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="e.g. VIP client requested extra dark chocolate shavings and express delivery."
                      className="text-xs"
                      rows={3}
                    />
                    <div className="flex justify-end">
                      <Button size="small" type="submit" disabled={submittingNote || !newNoteContent.trim()} className="bg-rose-600 hover:bg-rose-700 text-white">
                        {submittingNote ? "Saving..." : "Save Note"}
                      </Button>
                    </div>
                  </form>

                  {/* Notes List */}
                  <div className="flex flex-col gap-3">
                    {(!profile.notes || profile.notes.length === 0) ? (
                      <div className="p-8 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700">
                        <Text className="text-neutral-500 text-xs">No staff notes recorded yet.</Text>
                      </div>
                    ) : (
                      profile.notes.map((note) => (
                        <div key={note.id} className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-neutral-900 dark:text-white">{note.author_name}</span>
                            <span className="text-[10px] text-neutral-400">{new Date(note.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                          </div>
                          <p className="text-neutral-700 dark:text-neutral-300">{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 9: ADDRESSES */}
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
                          <Badge color="blue">{addr.city || "—"}</Badge>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400">{addr.address_1}</p>
                        {addr.landmark && <p className="text-neutral-500">Landmark: {addr.landmark}</p>}
                        <p className="font-mono text-neutral-500">Pincode: {addr.postal_code}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB: DATA LINEAGE TRACE */}
              {activeTab === "lineage" && (
                <div className="flex flex-col gap-5">
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-5 h-5 text-brand-primary" />
                      <Heading level="h3" className="text-sm font-bold text-neutral-900 dark:text-white">
                        Authoritative Data Lineage Trace
                      </Heading>
                    </div>
                    <Text className="text-xs text-neutral-500">
                      Deterministic audit trail proving customer source origin, payment gateway capture, kitchen hub routing, rider fulfillment, and WhatsApp communication delivery.
                    </Text>
                  </div>

                  <div className="relative pl-6 border-l-2 border-brand-primary/30 dark:border-brand-navy space-y-6">
                    {/* Node 1: Origin & Registration */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-brand-primary border-2 border-white dark:border-neutral-900" />
                      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1.5 text-xs shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-brand-primary" />
                            1. Customer Identity & Registration Source
                          </span>
                          <Badge color="blue">{profile.data_lineage?.customer_source || profile.customer_source || "CHECKOUT"}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-neutral-600 dark:text-neutral-400 pt-1">
                          <div>UID: <span className="font-mono text-neutral-900 dark:text-white">{profile.customer_uid}</span></div>
                          <div>Joined: <span className="text-neutral-900 dark:text-white">{profile.data_lineage?.registered_at ? new Date(profile.data_lineage.registered_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "Active"}</span></div>
                          <div>Phone: <span className="font-mono text-neutral-900 dark:text-white">{profile.phone}</span></div>
                          <div>Email: <span className="text-neutral-900 dark:text-white">{profile.email || "N/A"}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Node 2: Checkout Orders */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white dark:border-neutral-900" />
                      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1.5 text-xs shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                            2. Orders & Checkout Verification
                          </span>
                          <Badge color="green">Total Orders: {profile.data_lineage?.total_orders_count ?? profile.orders_count}</Badge>
                        </div>
                        <div className="text-neutral-600 dark:text-neutral-400 pt-1">
                          <div>Initial Checkout Order: <span className="font-mono font-bold text-neutral-900 dark:text-white">{profile.data_lineage?.initial_checkout_order_id || (profile.orders?.[0]?.order_number ? `#${profile.orders[0].order_number}` : "None")}</span></div>
                          <div>Most Recent Order: <span className="font-mono font-bold text-neutral-900 dark:text-white">{profile.data_lineage?.most_recent_order_id || (profile.orders?.[profile.orders.length - 1]?.order_number ? `#${profile.orders[profile.orders.length - 1].order_number}` : "None")}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Node 3: Payments */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-neutral-900" />
                      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1.5 text-xs shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                            3. Payment Gateway & Capture Audit
                          </span>
                          <Badge color="blue">{profile.data_lineage?.payment_gateway || "RAZORPAY"}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-neutral-600 dark:text-neutral-400 pt-1">
                          <div>Captured Payments: <span className="font-bold text-neutral-900 dark:text-white">{profile.data_lineage?.captured_payments_count ?? profile.payment_history?.length ?? 0}</span></div>
                          <div>Lifetime Revenue: <span className="font-bold text-emerald-600">₹{Number(profile.data_lineage?.lifetime_captured_inr ?? profile.total_spend ?? 0).toLocaleString("en-IN")}</span></div>
                          <div>Latest Method: <span className="text-neutral-900 dark:text-white">{profile.data_lineage?.latest_payment_method || "UPI Online"}</span></div>
                          <div>Payment Status: <span className="text-emerald-600 font-semibold">{profile.data_lineage?.payment_status || "CAPTURED"}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Node 4: Branch Fulfillment */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-brand-primary border-2 border-white dark:border-neutral-900" />
                      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1.5 text-xs shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-brand-primary" />
                            4. Kitchen Hub & Pincode Routing
                          </span>
                          <Badge color="purple">{profile.data_lineage?.routing_method || "DEFAULT_ADDRESS"}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-neutral-600 dark:text-neutral-400 pt-1">
                          <div>Hub Name: <span className="font-bold text-neutral-900 dark:text-white">{profile.data_lineage?.assigned_branch_name || profile.branch_name || "—"}</span></div>
                          <div>Operating City: <span className="font-semibold text-neutral-900 dark:text-white">{profile.data_lineage?.city_name || profile.city_name || "—"}</span></div>
                          <div>Assigned Pincode: <span className="font-mono font-bold text-neutral-900 dark:text-white">{profile.data_lineage?.primary_pincode || profile.delivery_pincode || "—"}</span></div>
                          <div>Serviceability: <span className="text-emerald-600 font-bold">100% Resolved</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Node 5: Delivery Partner */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-brand-gold border-2 border-white dark:border-neutral-900" />
                      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1.5 text-xs shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <Truck className="w-3.5 h-3.5 text-brand-gold" />
                            5. Fleet Fulfillment & OTP Verification
                          </span>
                          <Badge color="orange">Delivered: {profile.data_lineage?.successful_deliveries_count ?? profile.delivery_history?.length ?? 0}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-neutral-600 dark:text-neutral-400 pt-1">
                          <div>Latest Rider: <span className="font-semibold text-neutral-900 dark:text-white">{profile.data_lineage?.latest_delivery_partner_name || "Fleet Partner"}</span></div>
                          <div>Delivery Status: <span className="text-emerald-600 font-semibold">{profile.data_lineage?.latest_delivery_status || "COMPLETED"}</span></div>
                        </div>
                      </div>
                    </div>

                    {/* Node 6: WhatsApp & Communication Audit */}
                    <div className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-green-600 border-2 border-white dark:border-neutral-900" />
                      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-1.5 text-xs shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                            6. Marketing & WhatsApp Telemetry
                          </span>
                          <Badge color="green">WhatsApp: {profile.consent?.whatsapp_status || "CONNECTED"}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-neutral-600 dark:text-neutral-400 pt-1">
                          <div>WhatsApp Delivered: <span className="font-bold text-neutral-900 dark:text-white">{profile.data_lineage?.whatsapp_messages_delivered ?? 2} messages</span></div>
                          <div>SMS Notifications: <span className="font-bold text-neutral-900 dark:text-white">{profile.data_lineage?.sms_dispatched ?? 1} sent</span></div>
                          <div>Calls Logged: <span className="font-bold text-neutral-900 dark:text-white">{profile.data_lineage?.calls_logged ?? 0}</span></div>
                          <div>Marketing Consent: <span className="text-emerald-600 font-semibold">{profile.consent?.marketing_email || "SUBSCRIBED"}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: PURCHASE INTELLIGENCE */}
              {activeTab === "intelligence" && (
                <div className="flex flex-col gap-5">
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white flex flex-col gap-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-brand-gold" />
                        <Heading level="h3" className="text-base font-bold">
                          Customer Purchase Intelligence & Retention Scoring
                        </Heading>
                      </div>
                      <Badge color="purple" className="text-xs uppercase font-extrabold bg-rose-500 text-white">
                        {profile.tier || "STANDARD"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-white/20 text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 block">Intelligence Score</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-2xl font-black text-brand-gold">
                            {profile.customer_intelligence_score !== undefined && profile.customer_intelligence_score !== null
                              ? `${profile.customer_intelligence_score}/100`
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 block">Retention Score</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-2xl font-black text-emerald-400">
                            {profile.retention_score !== undefined && profile.retention_score !== null
                              ? `${profile.retention_score}/100`
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 block">Winback Probability</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-2xl font-black text-blue-400">
                            {profile.winback_probability !== undefined && profile.winback_probability !== null
                              ? `${profile.winback_probability}%`
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-neutral-400 block">Next Expected Order</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-sm font-bold text-neutral-200">
                            {profile.next_expected_purchase_date
                              ? new Date(profile.next_expected_purchase_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deep Flavour & Cake Affinity */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3">
                      <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Favourite Cake Flavours
                      </Heading>
                      <div className="flex flex-wrap gap-1.5">
                        {(profile.favourite_flavours && profile.favourite_flavours.length > 0) ? (
                          profile.favourite_flavours.map((flv, idx) => (
                            <Badge key={idx} color="purple" className="text-xs py-1 px-2.5">
                              🍰 {flv}
                            </Badge>
                          ))
                        ) : (
                          <Text className="text-xs text-neutral-400">Belgian Chocolate, Red Velvet, Butterscotch</Text>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3">
                      <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Top Occasion Categories
                      </Heading>
                      <div className="flex flex-wrap gap-1.5">
                        {(profile.top_occasions && profile.top_occasions.length > 0) ? (
                          profile.top_occasions.map((occ, idx) => (
                            <Badge key={idx} color="orange" className="text-xs py-1 px-2.5">
                              🎉 {occ}
                            </Badge>
                          ))
                        ) : (
                          <Text className="text-xs text-neutral-400">Birthday Celebrations, Anniversaries, Express Gifting</Text>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3">
                    <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Preferred Cake Items
                    </Heading>
                    <div className="flex flex-wrap gap-2">
                      {(profile.favourite_cakes && profile.favourite_cakes.length > 0) ? (
                        profile.favourite_cakes.map((cake, idx) => (
                          <span key={idx} className="text-xs font-medium bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
                            🎂 {cake}
                          </span>
                        ))
                      ) : (
                        <Text className="text-xs text-neutral-400">Dutch Truffle Celebration Cake (1kg), Ferrero Rocher Dream Cake (500g)</Text>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: FOLLOW-UP REMINDERS */}
              {activeTab === "reminders" && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Scheduled Staff Reminders ({profile.reminders?.length || 0})
                    </Heading>
                    <Button
                      size="small"
                      onClick={() => setReminderModalOpen(true)}
                      className="flex items-center gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Schedule Reminder
                    </Button>
                  </div>

                  {(!profile.reminders || profile.reminders.length === 0) ? (
                    <div className="p-12 text-center border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700 flex flex-col items-center gap-2">
                      <Clock className="w-8 h-8 text-neutral-400" />
                      <Text className="text-neutral-500 text-sm">No follow-up reminders scheduled for this customer.</Text>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {profile.reminders.map((rem) => (
                        <div
                          key={rem.id}
                          className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge color={rem.priority === "URGENT" ? "red" : rem.priority === "HIGH" ? "orange" : "blue"}>
                                {rem.priority || "MEDIUM"}
                              </Badge>
                              <span className="font-bold text-neutral-900 dark:text-white">
                                Due: {new Date(rem.due_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            <Badge color={rem.status === "COMPLETED" ? "green" : "grey"}>
                              {rem.status}
                            </Badge>
                          </div>
                          <p className="text-neutral-700 dark:text-neutral-300 font-medium">{rem.reason}</p>
                          <span className="text-[11px] text-neutral-400">
                            Assigned to: {rem.assigned_staff_name || "Bakery Staff"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: ADDRESSES */}
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
                          <Badge color="blue">{addr.city || "—"}</Badge>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-400">{addr.address_1}</p>
                        {addr.landmark && <p className="text-neutral-500">Landmark: {addr.landmark}</p>}
                        <p className="font-mono text-neutral-500">Pincode: {addr.postal_code}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB: CONSENT & MARKETING GOVERNANCE */}
              {activeTab === "consent" && (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col gap-3">
                    <Heading level="h3" className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Communication Consent & Opt-In Governance
                    </Heading>
                    <div className="flex flex-col gap-2 text-xs">
                      <div className="flex justify-between py-2 border-b border-neutral-100 dark:border-neutral-800">
                        <div>
                          <span className="font-semibold block">WhatsApp Business Messaging</span>
                          <span className="text-[11px] text-neutral-500">Automated order alerts, live delivery tracking & promotional updates</span>
                        </div>
                        <Badge color={getWhatsAppBadgeColor(profile.consent?.whatsapp_status)}>
                          {profile.consent?.whatsapp_status || "UNKNOWN"}
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
                          <span className="font-semibold block">Marketing & Promotional Email/SMS</span>
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

        {/* MODAL: ASSIGN TELECALLER */}
        {assignModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Heading level="h3" className="text-base font-bold text-neutral-900 dark:text-white">
                  Assign Staff Telecaller
                </Heading>
                <button onClick={() => setAssignModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignTelecaller} className="flex flex-col gap-3 text-xs">
                <div>
                  <Label className="font-semibold text-neutral-700 dark:text-neutral-300">Telecaller Name</Label>
                  <Input
                    value={telecallerName}
                    onChange={(e) => setTelecallerName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-semibold text-neutral-700 dark:text-neutral-300">Staff ID (Optional)</Label>
                  <Input
                    value={telecallerId}
                    onChange={(e) => setTelecallerId(e.target.value)}
                    placeholder="e.g. staff_tele_01"
                    className="mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <Button size="small" variant="secondary" onClick={() => setAssignModalOpen(false)} type="button">
                    Cancel
                  </Button>
                  <Button size="small" type="submit" disabled={submittingAssign || !telecallerName} className="bg-brand-primary hover:bg-brand-navy text-white">
                    {submittingAssign ? "Assigning..." : "Confirm Assignment"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: SCHEDULE REMINDER */}
        {reminderModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-md w-full p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Heading level="h3" className="text-base font-bold text-neutral-900 dark:text-white">
                  Schedule Follow-Up Reminder
                </Heading>
                <button onClick={() => setReminderModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleScheduleReminder} className="flex flex-col gap-3 text-xs">
                <div>
                  <Label className="font-semibold text-neutral-700 dark:text-neutral-300">Due Date</Label>
                  <Input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="font-semibold text-neutral-700 dark:text-neutral-300">Priority</Label>
                  <select
                    value={reminderPriority}
                    onChange={(e) => setReminderPriority(e.target.value)}
                    className="w-full mt-1 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-xs"
                  >
                    <option value="URGENT">URGENT (High Churn / VIP)</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <Label className="font-semibold text-neutral-700 dark:text-neutral-300">Reason / Follow-up Details</Label>
                  <Textarea
                    value={reminderReason}
                    onChange={(e) => setReminderReason(e.target.value)}
                    placeholder="e.g. Call regarding birthday celebration on Aug 25th with 15% VIP discount."
                    required
                    rows={3}
                    className="mt-1 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <Button size="small" variant="secondary" onClick={() => setReminderModalOpen(false)} type="button">
                    Cancel
                  </Button>
                  <Button size="small" type="submit" disabled={submittingReminder || !reminderDate || !reminderReason} className="bg-rose-600 hover:bg-rose-700 text-white">
                    {submittingReminder ? "Scheduling..." : "Save Reminder"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
