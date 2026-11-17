"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
  Coins,
  Receipt,
  FileCheck2,
  User,
  Search,
} from "lucide-react";
import type { DeliveryCashHandoverRow, EligibleOrderCollection } from "@frontend/lib/services/delivery-handover.service";

interface DeliveryHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
  branchName: string;
  tellerSessionId?: string;
  onHandoverAcknowledged: () => void;
}

export function DeliveryHandoverModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  tellerSessionId,
  onHandoverAcknowledged,
}: DeliveryHandoverModalProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "declare" | "history">("pending");
  const [handovers, setHandovers] = useState<DeliveryCashHandoverRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Acknowledging state
  const [selectedHandover, setSelectedHandover] = useState<DeliveryCashHandoverRow | null>(null);
  const [actualCountedAmount, setActualCountedAmount] = useState<string>("");
  const [discrepancyNote, setDiscrepancyNote] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);

  // Declaration state
  const [deliveryPartners, setDeliveryPartners] = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [eligibleData, setEligibleData] = useState<{
    expectedCash: number;
    digitalCollections: number;
    orders: EligibleOrderCollection[];
  } | null>(null);
  const [declaringCash, setDeclaringCash] = useState<string>("");
  const [declarationNote, setDeclarationNote] = useState<string>("");

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = Number(val || 0);
    return "₹" + num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Load handovers for this branch
  const loadHandovers = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/delivery-handovers?branch_id=${branchId}&limit=50`);
      const data = await res.json();
      if (res.ok && data.handovers) {
        setHandovers(data.handovers);
      } else {
        setError(data.error || "Failed to load delivery handovers.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch delivery handovers.");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  // Load active delivery partners
  const loadDeliveryPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/fleet/partners?limit=100");
      const data = await res.json();
      if (data.partners) {
        setDeliveryPartners(
          data.partners.map((p: any) => ({
            id: p.id,
            name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.id,
            phone: p.phone,
          }))
        );
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadHandovers();
      loadDeliveryPartners();
      setSuccessMessage(null);
      setError(null);
    }
  }, [isOpen, loadHandovers, loadDeliveryPartners]);

  // When partner is selected in Declare tab, load eligible collections
  const handleSelectPartner = async (partnerId: string) => {
    setSelectedPartnerId(partnerId);
    setEligibleData(null);
    setDeclaringCash("");
    if (!partnerId) return;

    try {
      const res = await fetch(
        `/api/v1/admin/delivery-handovers/eligible?delivery_partner_id=${partnerId}&branch_id=${branchId}`
      );
      const data = await res.json();
      if (res.ok && data.data) {
        setEligibleData(data.data);
        setDeclaringCash(String(data.data.expectedCash));
      } else {
        setError(data.error || "Failed to fetch eligible collections.");
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch collections.");
    }
  };

  // Submit new declaration
  const handleSubmitDeclaration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eligibleData || eligibleData.orders.length === 0) {
      setError("No eligible delivered orders found for this rider.");
      return;
    }
    const decAmt = parseFloat(declaringCash);
    if (isNaN(decAmt) || decAmt < 0) {
      setError("Please enter a valid cash amount.");
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/delivery-handovers/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          delivery_partner_id: selectedPartnerId,
          declared_amount: decAmt,
          digital_amount: eligibleData.digitalCollections,
          order_ids: eligibleData.orders.map((o) => o.orderId),
          discrepancy_reason: declarationNote || undefined,
          notes: declarationNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to submit handover declaration.");
        return;
      }
      setSuccessMessage(`Handover declaration ${data.data.handover_number} submitted! Manager may now count and acknowledge cash.`);
      setActiveTab("pending");
      setSelectedPartnerId("");
      setEligibleData(null);
      loadHandovers();
    } catch (e: any) {
      setError(e.message || "Error submitting declaration.");
    } finally {
      setActionLoading(false);
    }
  };

  // Manager acknowledges physical cash
  const handleAcknowledgeCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHandover) return;
    const actAmt = parseFloat(actualCountedAmount);
    if (isNaN(actAmt) || actAmt < 0) {
      setError("Please enter a valid physical cash count.");
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/delivery-handovers/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handover_id: selectedHandover.id,
          branch_id: branchId,
          acknowledged_amount: actAmt,
          teller_session_id: tellerSessionId,
          discrepancy_explanation: discrepancyNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to acknowledge cash receipt.");
        return;
      }
      setSuccessMessage(`Successfully acknowledged ${formatCurrency(actAmt)} from ${selectedHandover.handover_number}. Cash drawer and GL ledger updated!`);
      setSelectedHandover(null);
      setActualCountedAmount("");
      setDiscrepancyNote("");
      loadHandovers();
      onHandoverAcknowledged();
    } catch (e: any) {
      setError(e.message || "Error acknowledging cash.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const pendingHandovers = handovers.filter((h) => h.status === "SUBMITTED" || h.status === "DRAFT");
  const pastHandovers = handovers.filter((h) => h.status !== "SUBMITTED" && h.status !== "DRAFT");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Delivery Boy Cash Collections & Handovers
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {branchName} — Operational cash custody reconciliation & manager acknowledgement
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-2 bg-slate-50/50 dark:bg-slate-800/20">
          <button
            onClick={() => { setActiveTab("pending"); setSelectedHandover(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "pending"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Pending Manager Count ({pendingHandovers.length})</span>
          </button>
          <button
            onClick={() => { setActiveTab("declare"); setSelectedHandover(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "declare"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Coins className="h-4 w-4" />
            <span>New Handover Declaration</span>
          </button>
          <button
            onClick={() => { setActiveTab("history"); setSelectedHandover(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === "history"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FileCheck2 className="h-4 w-4" />
            <span>Acknowledged History ({pastHandovers.length})</span>
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* TAB 1: PENDING HANDOVERS */}
          {activeTab === "pending" && (
            <div className="space-y-4">
              {selectedHandover ? (
                // Manager Count & Confirmation Form
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">
                        Count & Acknowledge Physical Cash: {selectedHandover.handover_number}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Delivery Partner: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedHandover.partner_name || selectedHandover.delivery_partner_id}</span> • Orders: {selectedHandover.order_ids?.length || 0}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedHandover(null)}
                      className="text-xs text-slate-500 hover:text-slate-700 underline"
                    >
                      Back to list
                    </button>
                  </div>

                  <form onSubmit={handleAcknowledgeCash} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-white dark:bg-slate-800 border rounded-lg">
                        <span className="text-xs text-slate-500 block">Expected System Cash</span>
                        <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(selectedHandover.expected_amount)}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 border rounded-lg">
                        <span className="text-xs text-slate-500 block">Rider Declared Cash</span>
                        <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(selectedHandover.declared_amount)}
                        </span>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-800 border rounded-lg">
                        <span className="text-xs text-slate-500 block">Digital Collections (Separate)</span>
                        <span className="text-base font-bold text-slate-500">
                          {formatCurrency(selectedHandover.digital_amount)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Actual Cash Counted by Manager (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={actualCountedAmount}
                        onChange={(e) => setActualCountedAmount(e.target.value)}
                        placeholder="e.g. 1250.00"
                        className="w-full px-3 py-2 text-base font-semibold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                      {actualCountedAmount && !isNaN(parseFloat(actualCountedAmount)) && (
                        <div className="mt-2 text-xs">
                          {parseFloat(actualCountedAmount) < Number(selectedHandover.expected_amount) ? (
                            <span className="text-brand-gold dark:text-brand-gold font-medium">
                              ⚠️ Shortage detected: {formatCurrency(Number(selectedHandover.expected_amount) - parseFloat(actualCountedAmount))}. Explanation required.
                            </span>
                          ) : parseFloat(actualCountedAmount) > Number(selectedHandover.expected_amount) ? (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              ℹ️ Surplus detected: {formatCurrency(parseFloat(actualCountedAmount) - Number(selectedHandover.expected_amount))}.
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              ✓ Cash counts match system expected collections exactly (₹0.00 variance).
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Discrepancy Explanation / Cashier Notes
                      </label>
                      <textarea
                        rows={2}
                        value={discrepancyNote}
                        onChange={(e) => setDiscrepancyNote(e.target.value)}
                        placeholder="e.g. Shortage of ₹50 verified with rider; customer paid ₹50 less due to change issue."
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setSelectedHandover(null)}
                        className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading || !actualCountedAmount}
                        className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center space-x-2"
                      >
                        {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        <span>Confirm & Acknowledge Cash</span>
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                // Pending handovers list
                <div className="space-y-3">
                  {loading ? (
                    <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Loading pending handovers...</span>
                    </div>
                  ) : pendingHandovers.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/20 border border-dashed rounded-xl">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-60" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No pending handovers awaiting manager count
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        All submitted delivery boy remittances for {branchName} have been counted and acknowledged.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b">
                          <tr>
                            <th className="px-4 py-3">Handover #</th>
                            <th className="px-4 py-3">Delivery Boy</th>
                            <th className="px-4 py-3 text-right">Expected</th>
                            <th className="px-4 py-3 text-right">Declared</th>
                            <th className="px-4 py-3 text-center">Difference</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {pendingHandovers.map((h) => {
                            const diff = Number(h.declared_amount) - Number(h.expected_amount);
                            return (
                              <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">
                                  {h.handover_number}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                                    {h.partner_name || h.delivery_partner_id}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {h.order_ids?.length || 0} orders
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-medium">
                                  {formatCurrency(h.expected_amount)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                                  {formatCurrency(h.declared_amount)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {diff < 0 ? (
                                    <span className="text-brand-gold font-semibold">Short ₹{Math.abs(diff).toFixed(2)}</span>
                                  ) : diff > 0 ? (
                                    <span className="text-blue-600 font-semibold">+₹{diff.toFixed(2)}</span>
                                  ) : (
                                    <span className="text-emerald-600 font-medium">₹0.00</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/40 dark:text-brand-gold/40">
                                    Awaiting Manager Count
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => {
                                      setSelectedHandover(h);
                                      setActualCountedAmount(String(h.declared_amount || h.expected_amount));
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                                  >
                                    Count & Confirm
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DECLARE HANDOVER */}
          {activeTab === "declare" && (
            <div className="space-y-4">
              <form onSubmit={handleSubmitDeclaration} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Delivery Partner / Rider <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => handleSelectPartner(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Choose Delivery Rider --</option>
                    {deliveryPartners.map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        {dp.name} ({dp.id}) {dp.phone ? `• ${dp.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {eligibleData && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <span className="text-xs text-blue-700 dark:text-blue-300 font-semibold block">
                          Authoritative Unsettled COD Cash
                        </span>
                        <span className="text-xl font-bold text-blue-900 dark:text-blue-100">
                          {formatCurrency(eligibleData.expectedCash)}
                        </span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400 block mt-1">
                          Across {eligibleData.orders.length} delivered order(s)
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border rounded-lg">
                        <span className="text-xs text-slate-500 font-semibold block">
                          Digital Customer Payments (Tracked Separately)
                        </span>
                        <span className="text-xl font-bold text-slate-700 dark:text-slate-300">
                          {formatCurrency(eligibleData.digitalCollections)}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Settled directly via payment gateway
                        </span>
                      </div>
                    </div>

                    {eligibleData.orders.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                          Delivered Orders Included in This Handover:
                        </span>
                        <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y text-xs">
                          {eligibleData.orders.map((ord) => (
                            <div key={ord.orderId} className="px-3 py-2 flex items-center justify-between">
                              <div>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                  #{ord.displayId}
                                </span>
                                {ord.recipientName && (
                                  <span className="text-slate-500 ml-2">({ord.recipientName})</span>
                                )}
                              </div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatCurrency(ord.collectedAmount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Cash Declared for Handover (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={declaringCash}
                        onChange={(e) => setDeclaringCash(e.target.value)}
                        placeholder="e.g. 1500.00"
                        className="w-full px-3 py-2 text-base font-semibold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Discrepancy Explanation / Handover Notes
                      </label>
                      <textarea
                        rows={2}
                        value={declarationNote}
                        onChange={(e) => setDeclarationNote(e.target.value)}
                        placeholder="e.g. Delivered 3 orders on shift 1; ₹100 change carried over."
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={actionLoading || eligibleData.orders.length === 0}
                        className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors flex items-center space-x-2"
                      >
                        {actionLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        <span>Submit Handover for Manager Count</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* TAB 3: HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-3">
              {pastHandovers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No acknowledged handovers found for this branch.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b">
                      <tr>
                        <th className="px-4 py-3">Handover #</th>
                        <th className="px-4 py-3">Delivery Partner</th>
                        <th className="px-4 py-3 text-right">Expected</th>
                        <th className="px-4 py-3 text-right">Acknowledged</th>
                        <th className="px-4 py-3">Received By</th>
                        <th className="px-4 py-3">Voucher #</th>
                        <th className="px-4 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pastHandovers.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white">
                            {h.handover_number}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                            {h.partner_name || h.delivery_partner_id}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {formatCurrency(h.expected_amount)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(h.acknowledged_amount)}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                            {h.received_by || "Branch Manager"}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-blue-600">
                            {h.settlement_voucher_id || "—"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {h.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
