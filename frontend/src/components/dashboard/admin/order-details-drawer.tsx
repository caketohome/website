"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Badge, Button, Input, StatusBadge } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  X, CheckCircle, Clock, MapPin, Phone, Mail, User, Store, Truck, ChefHat, CreditCard,
  History, MessageSquare, Paperclip, Printer, FileText, RefreshCw, AlertTriangle, ShieldCheck,
  ChevronRight, Calendar, ArrowRight, CornerDownRight, Send, Plus, Search, Zap
} from "lucide-react";
import { OrderKotPrintModal } from "./order-kot-print-modal";
import { OrderInvoicePrintModal } from "./order-invoice-print-modal";
import { buildGoogleMapsDirectionsUrl, extractDeliveryCoordinates } from "@frontend/lib/location/directions";

interface OrderDetailsDrawerProps {
  orderId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function OrderDetailsDrawer({ orderId, onClose, onRefresh }: OrderDetailsDrawerProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Action States
  const [showKotModal, setShowKotModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [committedInvoice, setCommittedInvoice] = useState<any>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Action Drawer Sub-states
  const [showBranchAssign, setShowBranchAssign] = useState(false);
  const [showDriverAssign, setShowDriverAssign] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [refundReasonInput, setRefundReasonInput] = useState("");

  const [deliveryPartnersList, setDeliveryPartnersList] = useState<any[]>([]);
  const [driverSearchQuery, setDriverSearchQuery] = useState("");

  const [selectedBranch, setSelectedBranch] = useState("res_01KXYMAHGFPRY1G9TZKEVGAGAT");
  const [driverNameInput, setDriverNameInput] = useState("");
  const [driverPhoneInput, setDriverPhoneInput] = useState("");
  const [newDeliveryDate, setNewDeliveryDate] = useState("");
  const [newDeliverySlot, setNewDeliverySlot] = useState("07:00 PM - 09:00 PM (Evening Slot)");

  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [internalNoteInput, setInternalNoteInput] = useState("");
  const [internalNotesList, setInternalNotesList] = useState<string[]>([]);

  const fetchOrderDetails = () => {
    if (!orderId) {
      setError("No order ID provided");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    apiClient
      .getAdminOrderDetails(orderId)
      .then((data: any) => {
        if (data) {
          setOrder(data);
          if (Array.isArray(data.staff_notes)) {
            setInternalNotesList(data.staff_notes);
          }
        } else {
          setError("Order details not found");
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        setError(err.message || "Failed to load order details");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrderDetails();
    apiClient.getAdminDeliveryPartners().then((res: any) => {
      setDeliveryPartnersList(res?.partners || []);
    }).catch(() => setDeliveryPartnersList([]));
    apiClient.getAdminBranches().then((res: any) => {
      setBranchesList(res?.branches || res?.data || []);
    }).catch(() => setBranchesList([]));
  }, [orderId]);

  const handleAutoAssignDelivery = async () => {
    setActionLoading(true);
    setActionSuccess(null);
    try {
      const res: any = await apiClient.autoAssignAdminOrderDelivery(orderId);
      if (res?.order) setOrder(res.order);
      // New engine returns res.partner.full_name / res.partner.partner_number
      const riderName = res?.partner?.full_name || res?.partner?.name || res?.assigned_rider?.name || "Rider";
      const riderNum = res?.partner?.partner_number || res?.assigned_rider?.employee_id || "";
      setActionSuccess(`⚡ Auto-Assigned Best Rider: ${riderName}${riderNum ? ` (${riderNum})` : ""}! OTPs generated.`);
      fetchOrderDetails();
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed auto rider assignment");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setActionLoading(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res: any = await apiClient.updateOrderStatus(orderId, newStatus, `Updated via Admin Command Center`);
      if (!res || !res.order) {
        throw new Error(res?.message || res?.error || `Failed to update order status to '${newStatus}'`);
      }
      setOrder(res.order);
      setActionSuccess(`Status updated to '${newStatus}'!`);
      fetchOrderDetails();
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || "Failed to update order status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewInvoice = async () => {
    if (!order?.invoice_number || order.invoice_number === "PENDING_INVOICE") {
      setActionError("Cannot print tax invoice: Order has no committed statutory invoice.");
      return;
    }
    setInvoiceLoading(true);
    setActionError(null);
    try {
      const res: any = await apiClient.getOrderInvoice(orderId);
      if (!res || !res.success || !res.invoice) {
        setCommittedInvoice(null);
        setShowInvoiceModal(false);
        throw new Error(res?.error || res?.message || "INVOICE_NOT_COMMITTED: No committed invoice found on server");
      }
      setCommittedInvoice(res.invoice);
      setShowInvoiceModal(true);
    } catch (err: any) {
      setCommittedInvoice(null);
      setShowInvoiceModal(false);
      setActionError(err.message || "Failed to load authoritative invoice from database");
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleGenerateInvoice = async () => {
    setActionLoading(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res: any = await apiClient.generateOrderInvoice(orderId);
      if (!res || !res.success || !res.invoice) {
        setCommittedInvoice(null);
        throw new Error(res?.message || res?.error || "Statutory invoice allocation rejected");
      }
      setActionSuccess(`⚡ Statutory Tax Invoice allocated & committed: ${res.invoice.invoice_number}`);
      await fetchOrderDetails();
      onRefresh();
    } catch (err: any) {
      setCommittedInvoice(null);
      setActionError(err.message || "Statutory invoice generation failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignBranch = async () => {
    if (!selectedBranch) return;
    setActionLoading(true);
    try {
      const res: any = await apiClient.assignAdminOrderBranch(orderId, selectedBranch, "Selected Kitchen Hub");
      if (res?.order) setOrder(res.order);
      setActionSuccess("Order branch successfully assigned!");
      setShowBranchAssign(false);
      fetchOrderDetails();
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to assign branch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignDelivery = async () => {
    if (!driverNameInput.trim()) return;
    setActionLoading(true);
    try {
      const selectedPartner = deliveryPartnersList.find((p) => p.id === driverNameInput || p.partner_number === driverNameInput || p.name === driverNameInput);
      const partnerId = selectedPartner?.id || driverNameInput.trim();

      const res: any = await apiClient.manualAssignOrderDelivery(orderId, partnerId, "Manual Admin Override");
      if (res?.order) setOrder(res.order);
      setActionSuccess(`Assigned delivery partner!`);
      setShowDriverAssign(false);
      fetchOrderDetails();
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to assign partner");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnassignDelivery = async () => {
    if (!confirm(`Are you sure you want to unassign the delivery partner from Order ${order?.order_number}?`)) return;
    setActionLoading(true);
    try {
      const res: any = await apiClient.unassignOrderDelivery(orderId, "Unassigned by Admin Manager");
      if (res?.order) setOrder(res.order);
      setActionSuccess(`Delivery partner unassigned.`);
      fetchOrderDetails();
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to unassign partner");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!newDeliveryDate) return;
    setActionLoading(true);
    try {
      const res: any = await apiClient.rescheduleAdminOrder(orderId, newDeliveryDate, newDeliverySlot);
      if (res?.order) setOrder(res.order);
      setActionSuccess(`Order rescheduled to ${newDeliveryDate}!`);
      setShowReschedule(false);
      fetchOrderDetails();
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to reschedule order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReasonInput.trim()) {
      alert("Please enter a cancellation reason.");
      return;
    }
    setActionLoading(true);
    try {
      const res: any = await apiClient.cancelAdminOrder(orderId, cancelReasonInput.trim());
      if (res?.order) setOrder(res.order);
      setActionSuccess(`Order ${orderId} cancelled successfully.`);
      setShowCancelModal(false);
      fetchOrderDetails();
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to cancel order");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefundOrder = async () => {
    setActionLoading(true);
    try {
      const amt = parseFloat(refundAmountInput) || order?.total || 0;
      const res: any = await apiClient.refundAdminOrder(orderId, amt, refundReasonInput.trim() || "Admin refund issued");
      if (res?.order) setOrder(res.order);
      setActionSuccess(`Refund of ₹${amt} processed for order ${orderId}.`);
      setShowRefundModal(false);
      fetchOrderDetails();
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to process refund");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddInternalNote = async () => {
    if (!internalNoteInput.trim()) return;
    const noteText = internalNoteInput.trim();
    setInternalNotesList((prev) => [...prev, noteText]);
    setInternalNoteInput("");
    try {
      await apiClient.addAdminOrderNote(orderId, noteText);
      fetchOrderDetails();
    } catch {
      // Non-blocking UI update
    }
  };

  const statusList = [
    { key: "confirmed", label: "Confirmed" },
    { key: "kitchen_accepted", label: "Kitchen Accepted" },
    { key: "preparing", label: "Preparing" },
    { key: "packed", label: "Packed" },
    { key: "out_for_delivery", label: "Out For Delivery" },
    { key: "delivered", label: "Delivered" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200 dark:border-slate-800">
        {/* Command Header */}
        <div className="p-4 border-b flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <Badge color="purple" className="text-xs font-mono px-2.5 py-1">
              {order?.order_number || orderId}
            </Badge>
            <div>
              <Heading level="h2" className="text-base font-bold text-white flex items-center gap-2">
                Order Command Center &bull; {order?.customer_name || "Customer Order"}
              </Heading>
              <Text className="text-xs text-slate-400">
                Created: {order?.created_at ? new Date(order.created_at).toLocaleString("en-IN") : "—"}
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="small" variant="secondary" onClick={fetchOrderDetails} className="text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <button data-testid="close-order-drawer" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white" title="Close Drawer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div id="drawer-action-success-banner" className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 px-4 py-2 text-xs font-semibold flex items-center justify-between">
            <span>✅ {actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:underline">Dismiss</button>
          </div>
        )}
        {actionError && (
          <div id="drawer-action-error-banner" className="bg-rose-50 border-b border-rose-200 text-rose-800 px-4 py-2 text-xs font-semibold flex items-center justify-between">
            <span>❌ {actionError}</span>
            <button onClick={() => setActionError(null)} className="text-rose-600 hover:underline">Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
            <Text className="text-sm">Loading full enterprise order details from database...</Text>
          </div>
        ) : error || !order ? (
          <div className="p-8 text-center text-rose-600">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-bold">{error || "Order not found"}</p>
            <Button size="small" variant="secondary" onClick={fetchOrderDetails} className="mt-3">Retry Fetch</Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 dark:text-slate-200">
            {/* SECTION 1: ORDER SUMMARY & INTERACTIVE LIFECYCLE TIMELINE STEPPER */}
            <div className="p-5 border rounded-2xl bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                <div>
                  <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">SECTION 1 &bull; ORDER LIFECYCLE STATUS</span>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Heading level="h3" className="text-lg font-black">{order.order_number}</Heading>
                    <Badge color={order.invoice_number && order.invoice_number !== "PENDING_INVOICE" ? "purple" : "grey"} className="text-xs font-mono font-bold px-2 py-0.5" id="drawer-order-invoice-badge">
                      {order.invoice_number && order.invoice_number !== "PENDING_INVOICE" ? order.invoice_number : "PENDING_INVOICE"}
                    </Badge>
                    {(!order.invoice_number || order.invoice_number === "PENDING_INVOICE") && (order.status === "delivered" || order.status === "completed") && (
                      <Button
                        id="btn-generate-statutory-invoice"
                        size="small"
                        variant="primary"
                        onClick={handleGenerateInvoice}
                        isLoading={actionLoading}
                        className="text-xs font-extrabold bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Zap className="w-3.5 h-3.5 mr-1" /> Generate Tax Invoice
                      </Button>
                    )}
                    {order.invoice_number && order.invoice_number !== "PENDING_INVOICE" ? (
                      <Button
                        id="btn-view-invoice-modal"
                        size="small"
                        variant="secondary"
                        onClick={handleViewInvoice}
                        isLoading={invoiceLoading}
                        className="text-xs font-extrabold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-emerald-600" /> View / Print Tax Invoice
                      </Button>
                    ) : (
                      <Button
                        id="btn-view-invoice-modal-disabled"
                        size="small"
                        variant="secondary"
                        disabled
                        className="text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 cursor-not-allowed opacity-60"
                        title="Tax invoice not committed. View and print are only enabled after statutory generation."
                      >
                        <FileText className="w-3.5 h-3.5 mr-1 text-slate-400" /> Invoice Not Committed
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge color={order.status === "delivered" ? "green" : order.status === "cancelled" ? "red" : "blue"} className="text-xs font-bold uppercase">
                    {order.status}
                  </StatusBadge>
                  <span className="text-lg font-black text-emerald-600">₹{order.total}</span>
                </div>
              </div>

              {/* Stepper Process Bar */}
              <div className="space-y-1.5 pt-1">
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Production &amp; Delivery Progress Stepper:</Text>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                  {statusList.map((st, idx) => {
                    const isCurrent = order.status?.toLowerCase() === st.key;
                    return (
                      <button
                        key={st.key}
                        disabled={actionLoading}
                        onClick={() => handleStatusUpdate(st.key)}
                        className={`p-2 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center gap-1 ${
                          isCurrent
                            ? "bg-purple-600 text-white border-purple-600 ring-2 ring-purple-300 shadow-md"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-purple-400"
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 flex items-center justify-center text-[10px] font-extrabold">
                          {idx + 1}
                        </span>
                        <span className="line-clamp-1">{st.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SECTION 12 (PRIMARY ACTIONS BAR): QUICK OPERATIONAL CONTROLS */}
            <div className="p-4 border rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1 text-purple-300">
                <ShieldCheck className="w-4 h-4 text-purple-400" /> Operational Controls:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="small" onClick={() => setShowKotModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold">
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print KOT
                </Button>
                {order.invoice_number && order.invoice_number !== "PENDING_INVOICE" && (
                  <Button size="small" onClick={handleViewInvoice} isLoading={invoiceLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                    <FileText className="w-3.5 h-3.5 mr-1" /> Print Invoice
                  </Button>
                )}
                <Button size="small" variant="secondary" onClick={() => setShowBranchAssign(!showBranchAssign)} className="text-xs font-semibold">
                  <Store className="w-3.5 h-3.5 mr-1" /> Reassign Branch
                </Button>
                <Button size="small" variant="secondary" onClick={() => setShowDriverAssign(!showDriverAssign)} className="text-xs font-semibold">
                  <Truck className="w-3.5 h-3.5 mr-1" /> Assign Driver
                </Button>
                <Button size="small" variant="secondary" onClick={() => setShowReschedule(!showReschedule)} className="text-xs font-semibold">
                  <Calendar className="w-3.5 h-3.5 mr-1" /> Reschedule
                </Button>
                <Button size="small" onClick={() => handleStatusUpdate("cancelled")} className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">
                  Cancel Order
                </Button>
              </div>
            </div>

            {/* Inline Action Forms */}
            {showBranchAssign && (
              <div className="p-4 border rounded-xl bg-purple-50 dark:bg-purple-950/40 space-y-3 text-xs">
                <Text className="font-bold text-purple-900 dark:text-purple-200">Reassign Kitchen Branch Hub &amp; Baking Station:</Text>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-h-56 overflow-y-auto">
                  {(branchesList.length > 0 ? branchesList : [
                    { id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", name: "Indiranagar Flagship", code: "HUB-BLR-01", queue: 4, capacity: "78% Load", bakers: 6, delay: "0 mins" },
                    { id: "res_02KXYMAHGFPRY1G9TZKEVGAGAT", name: "Koramangala Gourmet", code: "HUB-BLR-02", queue: 2, capacity: "45% Load", bakers: 4, delay: "0 mins" },
                    { id: "res_03KXYMAHGFPRY1G9TZKEVGAGAT", name: "Whitefield Central", code: "HUB-BLR-03", queue: 7, capacity: "92% High Load", bakers: 5, delay: "+15 mins" },
                  ]).map((b: any) => {
                    const bId = b.id;
                    const bName = b.name || b.branch_name || "Branch Hub";
                    const bCode = b.code || b.branch_code || `HUB-${b.city || "BLR"}`;
                    const bCapacity = b.capacity || "Operational";
                    const bCity = b.city || b.state || "";
                    return (
                      <div
                        key={bId}
                        onClick={() => setSelectedBranch(bId)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          selectedBranch === bId ? "bg-purple-600 text-white border-purple-600 shadow-md" : "bg-white dark:bg-slate-800 border-slate-200 hover:border-purple-400"
                        }`}
                      >
                        <p className="font-bold text-xs">{bName}</p>
                        <p className={`text-[10px] ${selectedBranch === bId ? "text-purple-100" : "text-slate-500"}`}>{bCode} {bCity ? `• ${bCity}` : ""}</p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px]">
                          <span className="font-mono">{bCapacity}</span>
                          <span>{b.status || "Active"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button size="small" variant="secondary" onClick={() => setShowBranchAssign(false)}>Cancel</Button>
                  <Button size="small" onClick={handleAssignBranch} isLoading={actionLoading} className="bg-purple-600 text-white font-bold">
                    Reassign Selected Branch
                  </Button>
                </div>
              </div>
            )}

            {showDriverAssign && (
              <div className="p-4 border rounded-xl bg-blue-50 dark:bg-blue-950/40 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Text className="font-bold text-blue-900 dark:text-blue-200">Delivery Fleet &amp; Partner Assignment Engine:</Text>
                  <Button size="small" onClick={handleAutoAssignDelivery} isLoading={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm">
                    ⚡ Auto-Assign Best Rider
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="Search rider name, partner ID, phone..."
                    value={driverSearchQuery}
                    onChange={(e) => setDriverSearchQuery(e.target.value)}
                    className="pl-8 text-xs bg-white dark:bg-slate-800"
                  />
                </div>

                {/* Searchable Rider Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pt-1">
                  {deliveryPartnersList
                    .filter((p) => {
                      const q = driverSearchQuery.toLowerCase();
                      const name = (p.full_name || p.name || "").toLowerCase();
                      const num = (p.partner_number || p.employee_id || "").toLowerCase();
                      const phone = (p.phone || "").toLowerCase();
                      return !q || name.includes(q) || num.includes(q) || phone.includes(q);
                    })
                    .map((p) => {
                      const pName = p.full_name || p.name || "Driver";
                      const pNum = p.partner_number || p.employee_id || p.id;
                      const pPhoto = p.profile_photo || p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pName)}&background=6366f1&color=fff&size=80`;
                      const pActive = p.current_active_orders ?? p.active_deliveries ?? 0;
                      const pMax = p.maximum_concurrent_orders || p.max_capacity || 5;
                      const pAvail = p.availability_status || (p.online ? "ONLINE" : "OFFLINE");
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setDriverNameInput(p.id);
                            setDriverPhoneInput(p.phone || "");
                          }}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                            driverNameInput === p.id ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-white dark:bg-slate-800 border-slate-200 hover:border-blue-400"
                          }`}
                        >
                          <img src={pPhoto} alt={pName} className="w-10 h-10 rounded-full object-cover border" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-xs truncate">{pName}</p>
                              <Badge color={pAvail === "ONLINE" ? "green" : "grey"} className="text-[9px] uppercase">{pAvail}</Badge>
                            </div>
                            <p className={`text-[10px] ${driverNameInput === p.id ? "text-blue-100" : "text-slate-500"} truncate`}>
                              {pNum} &bull; {p.phone || ""}
                            </p>
                            <div className="flex items-center justify-end text-[10px] pt-1">
                              <span className="font-bold font-mono">{pActive}/{pMax} Capacity Load</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button size="small" variant="secondary" onClick={() => setShowDriverAssign(false)}>Close</Button>
                  <Button size="small" onClick={handleAssignDelivery} isLoading={actionLoading} className="bg-blue-600 text-white font-bold">
                    Assign Selected Rider
                  </Button>
                </div>
              </div>
            )}

            {showReschedule && (
              <div className="p-4 border rounded-xl bg-amber-50 dark:bg-amber-950/40 space-y-3 text-xs">
                <Text className="font-bold text-amber-900 dark:text-amber-200">Delivery Slot Capacity Scheduler:</Text>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">Select Target Date:</label>
                    <Input type="date" value={newDeliveryDate} onChange={(e) => setNewDeliveryDate(e.target.value)} className="w-44 text-xs bg-white dark:bg-slate-800" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">Select Available Time Slot:</label>
                    <select value={newDeliverySlot} onChange={(e) => setNewDeliverySlot(e.target.value)} className="p-2 border rounded-lg bg-white dark:bg-slate-800 text-xs w-full font-bold">
                      <option value="09:00 AM - 12:00 PM (Morning Slot)">09:00 AM - 12:00 PM (Morning Slot) - 4/15 Orders</option>
                      <option value="02:00 PM - 05:00 PM (Afternoon Slot)">02:00 PM - 05:00 PM (Afternoon Slot) - 8/15 Orders</option>
                      <option value="07:00 PM - 09:00 PM (Evening Slot)">07:00 PM - 09:00 PM (Evening Express) - 11/15 Orders</option>
                      <option value="09:00 PM - 10:30 PM (Night Slot)">09:00 PM - 10:30 PM (Night Slot) - 3/10 Orders</option>
                    </select>
                  </div>
                  <div className="pt-4">
                    <Button size="small" onClick={handleReschedule} isLoading={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                      Confirm Schedule
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2 & SECTION 3 GRID: CUSTOMER & BRANCH DETAILS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SECTION 2: CUSTOMER INFORMATION */}
              <div className="p-4 border rounded-2xl space-y-3 bg-white dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-blue-600" /> SECTION 2 &bull; CUSTOMER DETAILS
                  </span>
                  <Badge color={order.customer_type === "registered" || order.customer?.customer_type === "registered" ? "blue" : "grey"} className="text-[9px] uppercase font-mono">
                    {order.customer_type || order.customer?.customer_type || "registered"}
                  </Badge>
                </div>
                <div>
                  <p className="font-extrabold text-base text-slate-900 dark:text-white">{order.customer?.name || order.customer_name}</p>
                  <p className="text-xs text-purple-600 font-mono font-bold mt-0.5">
                    Customer No: {order.customer?.customer_number || order.customer_number || "CTH-CUST-GUEST"}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {order.customer?.phone || order.customer_phone}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {order.customer?.email || order.customer_email}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    Internal ID: {order.customer?.id || order.customer_id}
                  </p>
                </div>
                <div className="pt-2 border-t text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500 block text-[10px] uppercase">Shipping Address:</span>
                    {(() => {
                      const coords = extractDeliveryCoordinates(order);
                      const mapsUrl = buildGoogleMapsDirectionsUrl({
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        address: order.delivery_address || order.customer?.address || order.shipping_address?.address_1,
                        pincode: order.delivery_pincode || order.pincode || order.customer?.pincode,
                      });
                      return (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                        >
                          <MapPin className="w-3 h-3 text-blue-500" /> Open in Maps ↗
                        </a>
                      );
                    })()}
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {(() => {
                      const addr = order.delivery_address || order.customer?.address || order.shipping_address?.address_1;
                      if (typeof addr === "string") return addr;
                      if (addr && typeof addr === "object") {
                        return [addr.line1 || addr.address_1 || addr.address, addr.line2 || addr.address_2, addr.landmark, addr.city, addr.pincode].filter(Boolean).join(", ");
                      }
                      return "Delivery Address on File";
                    })()}
                  </p>
                  <p className="text-slate-500">
                    {[order.delivery_area || order.customer?.area || order.shipping_address?.area, order.delivery_city || order.customer?.city || order.shipping_address?.city].filter(Boolean).join(", ")} - {order.delivery_pincode || order.customer?.pincode || order.shipping_address?.postal_code}
                  </p>
                  {(() => {
                    const coords = extractDeliveryCoordinates(order);
                    if (coords.hasCoords && typeof coords.latitude === "number" && typeof coords.longitude === "number") {
                      return (
                        <p className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                          🎯 Coordinates: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} ({order.delivery_zone_name || "Service Zone"})
                        </p>
                      );
                    }
                    return null;
                  })()}
                  {(order.delivery_landmark || order.customer?.landmark || order.shipping_address?.landmark) && (
                    <p className="text-slate-500">Landmark: {order.delivery_landmark || order.customer?.landmark || order.shipping_address?.landmark}</p>
                  )}
                </div>
                {(order.delivery_instructions || order.customer?.delivery_instructions) && (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-bold block text-[10px]">Instructions:</span> {order.delivery_instructions || order.customer?.delivery_instructions}
                  </div>
                )}
              </div>

              {/* SECTION 3: BRANCH INFORMATION */}
              <div className="p-4 border rounded-2xl space-y-3 bg-white dark:bg-slate-800/50">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Store className="w-3.5 h-3.5 text-purple-600" /> SECTION 3 &bull; ASSIGNED BRANCH &amp; KITCHEN
                </span>
                <div>
                  <p className="font-extrabold text-base text-slate-900 dark:text-white">{order.branch?.name || order.branch_name}</p>
                  <p className="text-xs text-purple-600 font-mono font-bold mt-0.5">{order.branch?.code || order.branch_code}</p>
                </div>
                <div className="pt-2 border-t text-xs space-y-1.5">
                  <p><span className="font-bold text-slate-500">Address:</span> {order.branch?.address || "Flagship Kitchen Location"}</p>
                  <p><span className="font-bold text-slate-500">Branch Phone:</span> {order.branch?.phone || "+91 80 4912 8800"}</p>
                  <p><span className="font-bold text-slate-500">Ops Manager:</span> {order.branch?.manager || "Branch Ops Lead"}</p>
                  <div className="pt-1">
                    <Badge color="purple" className="text-[10px]">{order.branch?.capacity || "Operational"}</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4 & SECTION 7 GRID: DELIVERY & KITCHEN TICKET DETAILS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SECTION 4: DELIVERY INFORMATION */}
              <div className="p-4 border rounded-2xl space-y-3 bg-white dark:bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-emerald-600" /> SECTION 4 &bull; DELIVERY PARTNER &amp; OTPS
                  </span>
                  <Badge color={order.delivery?.assignment_mode === "auto" ? "green" : order.delivery?.assignment_mode === "manual" ? "purple" : "grey"} className="text-[9px] uppercase font-mono font-bold">
                    {order.delivery?.assignment_mode || "UNASSIGNED"}
                  </Badge>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-sm text-slate-900 dark:text-white">{order.delivery?.partner_name || "Awaiting rider assignment"}</p>
                    {order.delivery?.partner_number && (
                      <span className="text-xs font-mono font-bold text-purple-600">{order.delivery.partner_number}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{order.delivery?.partner_phone || "Not assigned"}</p>
                  {order.delivery?.assignment_reason && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 italic mt-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded border">
                      &ldquo;{order.delivery.assignment_reason}&rdquo;
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t font-medium">
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200">
                    <span className="text-[10px] text-emerald-700 font-bold block uppercase">Pickup OTP</span>
                    <span className="font-mono text-base font-extrabold text-emerald-800">{order.delivery?.pickup_otp || order.pickup_otp || "Not generated"}</span>
                  </div>
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200">
                    <span className="text-[10px] text-blue-700 font-bold block uppercase">Delivery OTP</span>
                    <span className="font-mono text-base font-extrabold text-blue-800">{order.delivery?.delivery_otp || order.delivery_otp || "Not generated"}</span>
                  </div>
                </div>

                <div className="text-xs space-y-1 pt-1 text-slate-600 dark:text-slate-300">
                  <p><span className="font-bold">Estimated Arrival:</span> {order.delivery?.eta || "Pending Dispatch"}</p>
                  <p><span className="font-bold">Live Status:</span> {order.delivery?.live_location || "Awaiting Rider Assignment"}</p>
                </div>

                <div className="pt-2 border-t flex flex-wrap gap-2">
                  <Button size="small" onClick={handleAutoAssignDelivery} isLoading={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex-1">
                    ⚡ Auto-Assign Rider
                  </Button>
                  <Button size="small" variant="secondary" onClick={() => setShowDriverAssign(!showDriverAssign)} className="text-xs font-semibold">
                    Reassign Rider
                  </Button>
                  {order.delivery?.partner_id && (
                    <Button size="small" variant="secondary" onClick={handleUnassignDelivery} isLoading={actionLoading} className="text-xs font-semibold text-rose-600 hover:bg-rose-50">
                      Unassign
                    </Button>
                  )}
                </div>
              </div>

              {/* SECTION 7: KITCHEN KOT DETAILS */}
              <div className="p-4 border rounded-2xl space-y-3 bg-white dark:bg-slate-800/50">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ChefHat className="w-3.5 h-3.5 text-amber-600" /> SECTION 7 &bull; KITCHEN TICKET (KOT) &amp; PRODUCTION
                </span>
                <div>
                  <p className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    KOT #: <span className="font-mono underline text-amber-600">{order.kitchen?.kot_number || "KOT not created"}</span>
                  </p>
                  <p className="text-xs text-slate-500">{order.kitchen?.chef_assigned || "Not assigned"}</p>
                </div>
                <div className="text-xs space-y-1 pt-2 border-t text-slate-600 dark:text-slate-300">
                  <p><span className="font-bold">Preparation Time:</span> {order.kitchen?.prep_time_minutes ? `${order.kitchen.prep_time_minutes} mins` : "Pending Preparation"}</p>
                  <p><span className="font-bold">Dispatch Target:</span> {order.kitchen?.dispatch_time || "Pending Dispatch"}</p>
                  <p><span className="font-bold">Status:</span> <Badge color="orange" className="text-[10px]">{order.kitchen?.production_status || "Unassigned"}</Badge></p>
                </div>
                {order.kitchen?.kitchen_notes && (
                  <p className="text-[11px] italic text-slate-500 border-t pt-1.5">&ldquo;{order.kitchen.kitchen_notes}&rdquo;</p>
                )}
              </div>
            </div>

            {/* SECTION 5: ORDERED PRODUCTS */}
            <div className="p-4 border rounded-2xl space-y-4 bg-white dark:bg-slate-800/50">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                SECTION 5 &bull; ORDERED PRODUCTS &amp; SPECIFICATIONS ({order.items?.length || 0})
              </span>

              <div className="space-y-3">
                {(order.items || []).map((item: any, idx: number) => (
                  <div key={item.id || idx} className="p-4 border rounded-xl flex flex-col sm:flex-row items-start justify-between gap-4 bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumbnail} alt={item.title} className="w-16 h-16 rounded-lg object-cover border shrink-0" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</p>
                          <Badge color={item.artisan ? "green" : "red"} className="text-[9px]">{item.artisan ? "artisan" : "With Egg"}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Size: <strong className="text-slate-800 dark:text-slate-200">{item.weight}</strong> &bull; Flavor: <strong className="text-slate-800 dark:text-slate-200">{item.flavour}</strong> &bull; Shape: <strong className="text-slate-800 dark:text-slate-200">{item.shape}</strong>
                        </p>

                        {item.cake_message && (
                          <div className="mt-1 p-1.5 bg-amber-100 dark:bg-amber-950/60 rounded border border-amber-200 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                            Piping Text: &ldquo;{item.cake_message}&rdquo;
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right sm:self-center font-bold text-xs space-y-0.5 shrink-0">
                      <p className="text-slate-500">{item.quantity} x ₹{item.unit_price}</p>
                      <p className="text-sm font-black text-slate-900 dark:text-white">Subtotal: ₹{item.subtotal}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 6: CAKE CUSTOMIZATION & ADD-ONS */}
            <div className="p-4 border rounded-2xl space-y-3 bg-white dark:bg-slate-800/50">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                SECTION 6 &bull; CAKE CUSTOMIZATION &amp; ADD-ON ITEMS
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <p><span className="font-bold text-slate-500">Piping Text:</span> &ldquo;{order.customization?.cake_message}&rdquo;</p>
                  <p><span className="font-bold text-slate-500">Special Instructions:</span> {order.customization?.special_instructions || "None"}</p>
                  <p><span className="font-bold text-slate-500">Packaging:</span> {order.customization?.packaging_notes}</p>
                </div>
                <div className="space-y-2">
                  <span className="font-bold text-slate-500 block text-[10px] uppercase">Selected Add-ons &amp; Accessories:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(order.customization?.add_ons || []).map((addon: string, i: number) => (
                      <Badge key={i} color="purple" className="text-[10px] font-semibold">{addon}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 8: PAYMENT DETAILS */}
            <div className="p-4 border rounded-2xl space-y-3 bg-white dark:bg-slate-800/50">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> SECTION 8 &bull; PAYMENT, TAX &amp; INVOICE
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-medium">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Payment Method</span>
                  <p className="font-bold text-slate-900 dark:text-white">{order.payment?.method}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Transaction ID</span>
                  <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{order.payment?.transaction_id}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Gateway Status</span>
                  <Badge color="green" className="text-[10px] uppercase font-bold">{order.payment?.status}</Badge>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">GST Breakdown</span>
                  <p className="text-slate-600">CGST ₹{order.payment?.cgst} | SGST ₹{order.payment?.sgst}</p>
                </div>
              </div>
            </div>

            {/* SECTION 9 & SECTION 10: TIMELINE & COMMUNICATIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SECTION 9: TIMELINE */}
              <div className="p-4 border rounded-2xl space-y-3 bg-white dark:bg-slate-800/50">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-purple-600" /> SECTION 9 &bull; AUDIT LOG TIMELINE
                </span>
                <div className="space-y-2 border-l-2 border-purple-200 dark:border-purple-900 pl-3 text-xs">
                  {(order.timeline || []).map((tl: any, i: number) => (
                    <div key={i} className="relative space-y-0.5">
                      <p className="font-bold text-slate-800 dark:text-slate-200">{tl.event}</p>
                      <p className="text-[10px] text-slate-500">{new Date(tl.timestamp).toLocaleString("en-IN")} &bull; {tl.user}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 10: COMMUNICATION & INTERNAL NOTES */}
              <div className="p-4 border rounded-2xl space-y-3 bg-white dark:bg-slate-800/50">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" /> SECTION 10 &bull; STAFF NOTES &amp; LOGS
                </span>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add staff internal note..."
                      value={internalNoteInput}
                      onChange={(e) => setInternalNoteInput(e.target.value)}
                      className="text-xs flex-1 h-8"
                    />
                    <Button size="small" onClick={handleAddInternalNote} className="bg-purple-600 text-white h-8 text-xs">
                      <Send className="w-3 h-3" />
                    </Button>
                  </div>

                  <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto">
                    {internalNotesList.map((note, idx) => (
                      <div key={idx} className="p-2 bg-slate-50 dark:bg-slate-800 rounded border text-slate-700 dark:text-slate-300">
                        <span className="font-bold text-[10px] text-purple-600 block">Admin Staff Note:</span>
                        <p>{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 11: ATTACHMENTS & ACTIONS */}
            <div className="p-4 border rounded-2xl space-y-3 bg-white dark:bg-slate-800/50">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5 text-slate-600" /> SECTION 11 &amp; 12 &bull; DOCUMENTS &amp; CRITICAL ACTIONS
              </span>
              <div className="flex flex-wrap gap-3">
                {order.invoice_number && order.invoice_number !== "PENDING_INVOICE" && (
                  <Button size="small" variant="secondary" onClick={handleViewInvoice} isLoading={invoiceLoading} className="text-xs">
                    <FileText className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Tax Invoice PDF
                  </Button>
                )}
                <Button size="small" variant="secondary" onClick={() => setShowKotModal(true)} className="text-xs">
                  <ChefHat className="w-3.5 h-3.5 mr-1 text-amber-600" /> Kitchen KOT Ticket
                </Button>
                <Button size="small" variant="secondary" onClick={() => setShowCancelModal(true)} className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 font-bold">
                  ❌ Cancel Order
                </Button>
                <Button size="small" variant="secondary" onClick={() => setShowRefundModal(true)} className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-bold">
                  💸 Issue Refund
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-rose-600 flex items-center gap-2">❌ Cancel Order #{order?.order_number || orderId}</h3>
              <button onClick={() => setShowCancelModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">This action will cancel the order, release reserved inventory, and write an audit event log.</p>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Cancellation Reason *</label>
              <Input
                placeholder="e.g. Customer requested cancellation / Kitchen stock out..."
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button size="small" variant="secondary" onClick={() => setShowCancelModal(false)}>Back</Button>
              <Button size="small" onClick={handleCancelOrder} isLoading={actionLoading} className="bg-rose-600 text-white font-bold">
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Order Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-emerald-700 flex items-center gap-2">💸 Issue Payment Refund</h3>
              <button onClick={() => setShowRefundModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">Process refund back to customer original payment method.</p>
            <div className="space-y-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Refund Amount (₹)</label>
                <Input
                  placeholder={`Full amount: ₹${order?.total || 0}`}
                  value={refundAmountInput}
                  onChange={(e) => setRefundAmountInput(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Refund Reason / Note</label>
                <Input
                  placeholder="e.g. Customer satisfaction compensation / Item returned"
                  value={refundReasonInput}
                  onChange={(e) => setRefundReasonInput(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="small" variant="secondary" onClick={() => setShowRefundModal(false)}>Cancel</Button>
              <Button size="small" onClick={handleRefundOrder} isLoading={actionLoading} className="bg-emerald-600 text-white font-bold">
                Process Refund
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* KOT Print Modal */}
      {showKotModal && order && (
        <OrderKotPrintModal order={order} onClose={() => setShowKotModal(false)} />
      )}

      {/* Invoice Print Modal */}
      {showInvoiceModal && committedInvoice && (
        <OrderInvoicePrintModal
          order={order}
          invoice={committedInvoice}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}
    </div>
  );
}
