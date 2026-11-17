"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, Button, Input } from "@medusajs/ui";
import {
  Store,
  Building2,
  FileSpreadsheet,
  Receipt,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Calculator,
} from "lucide-react";

interface Partner {
  id: string;
  name: string;
  legal_name: string;
  trade_name?: string;
  email: string;
  phone: string;
  gstin?: string;
  pan?: string;
  status: string;
  kyc_status: string;
  created_at: string;
}

interface ReconciliationSummary {
  statementId: string;
  partnerId: string;
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  totalGrossSales: number;
  totalGst: number;
  totalDeliveryCharges: number;
  totalDiscounts: number;
  totalCommission: number;
  netPayableToPartner: number;
  currency: string;
}

export const MarketplacePanel = memo(function MarketplacePanel() {
  const [activeSubTab, setActiveSubTab] = useState<"partners" | "reconciliation" | "invoices">("partners");
  const [loading, setLoading] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reconciliation state
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [periodStart, setPeriodStart] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [periodEnd, setPeriodEnd] = useState<string>(new Date().toISOString().split("T")[0]);
  const [statement, setStatement] = useState<ReconciliationSummary | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [exporting, setExporting] = useState(false);

  // New Invoice Receipt state
  const [partnerInvoiceNo, setPartnerInvoiceNo] = useState("");
  const [partnerInvoiceDate, setPartnerInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [partnerInvoiceAmount, setPartnerInvoiceAmount] = useState<number>(0);
  const [partnerDocRef, setPartnerDocRef] = useState("");
  const [receivingInvoice, setReceivingInvoice] = useState(false);

  // Onboard partner modal state
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [newPartner, setNewPartner] = useState({
    name: "",
    legal_name: "",
    trade_name: "",
    email: "",
    phone: "",
    gstin: "",
    pan: "",
    commission_percentage: 15,
  });

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/admin/marketplace/partners");
      const data = await res.json();
      if (data.partners) {
        setPartners(data.partners);
        if (!selectedPartnerId && data.partners.length > 0) {
          setSelectedPartnerId(data.partners[0].id);
        }
      }
    } catch (err: any) {
      setErrorMsg("Failed to load marketplace partners: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await fetch("/api/v1/admin/marketplace/invoices");
      const data = await res.json();
      if (data.invoices) {
        setInvoices(data.invoices);
      }
    } catch (err: any) {
      console.error("Failed to load invoices", err);
    }
  };

  useEffect(() => {
    fetchPartners();
    fetchInvoices();
  }, []);

  const handleOnboardPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/admin/marketplace/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPartner),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to onboard partner");
      }
      setSuccessMsg(`Successfully onboarded commercial partner: ${data.partner.name}`);
      setShowOnboardModal(false);
      setNewPartner({
        name: "",
        legal_name: "",
        trade_name: "",
        email: "",
        phone: "",
        gstin: "",
        pan: "",
        commission_percentage: 15,
      });
      fetchPartners();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateStatement = async () => {
    if (!selectedPartnerId) {
      setErrorMsg("Please select a partner first.");
      return;
    }
    try {
      setReconciling(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await fetch("/api/v1/admin/marketplace/reconciliation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: selectedPartnerId,
          periodStart,
          periodEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate statement");
      }
      setStatement(data.statement);
      setPartnerInvoiceAmount(data.statement.netPayableToPartner);
      setSuccessMsg(`Generated reconciliation statement covering ${data.statement.orderCount} orders.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setReconciling(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedPartnerId) {
      setErrorMsg("Please select a partner first.");
      return;
    }
    try {
      setExporting(true);
      const url = `/api/v1/admin/marketplace/reconciliation/export?partner_id=${encodeURIComponent(
        selectedPartnerId
      )}&period_start=${encodeURIComponent(periodStart)}&period_end=${encodeURIComponent(periodEnd)}`;

      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to export Excel statement");
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Marketplace_Reconciliation_${selectedPartnerId}_${periodStart}_${periodEnd}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setSuccessMsg("Excel reconciliation statement exported successfully.");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleReceivePartnerInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartnerId || !partnerInvoiceNo || partnerInvoiceAmount <= 0) {
      setErrorMsg("Invoice number and valid amount are required.");
      return;
    }
    try {
      setReceivingInvoice(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/admin/marketplace/invoices/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerId: selectedPartnerId,
          partnerInvoiceNumber: partnerInvoiceNo,
          invoiceDate: partnerInvoiceDate,
          periodStart,
          periodEnd,
          invoiceAmount: partnerInvoiceAmount,
          currency: "INR",
          documentReference: partnerDocRef,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to record invoice receipt");
      }
      setSuccessMsg(
        `Invoice ${data.invoice.partner_invoice_number} recorded in status: ${data.invoice.status} with discrepancy ₹${data.invoice.discrepancy_amount}`
      );
      setPartnerInvoiceNo("");
      fetchInvoices();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setReceivingInvoice(false);
    }
  };

  const handleApproveInvoice = async (invoiceId: string) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/v1/admin/marketplace/invoices/${invoiceId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to approve invoice");
      }
      setSuccessMsg(`Invoice approved and linked to Bills Payable: Voucher ${data.voucherNumber}`);
      fetchInvoices();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-brand-navy to-slate-900 border border-brand-navy/40 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-primary/20 text-brand-primary border border-brand-primary/30">
              <Store className="w-5 h-5" />
            </span>
            <Heading level="h2" className="text-xl font-bold tracking-tight text-white">
              Partner Marketplace & Commercial Operations
            </Heading>
            <Badge color="purple" className="text-xs font-semibold px-2.5 py-0.5">
              PostgreSQL Single Truth
            </Badge>
          </div>
          <Text className="text-sm text-slate-300 max-w-3xl">
            Commercial vendor management, multi-store operations, order agreements, and PostgreSQL-authoritative invoice receipt & reconciliation linked to Bills Payable.
          </Text>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              fetchPartners();
              fetchInvoices();
            }}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={() => setShowOnboardModal(true)}
            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary text-white border-0 shadow-md shadow-brand-primary/30"
          >
            <Plus className="w-4 h-4" />
            Onboard Partner
          </Button>
        </div>
      </div>

      {/* Alert Notices */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <Text className="text-sm font-medium">{errorMsg}</Text>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <Text className="text-sm font-medium">{successMsg}</Text>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4">
        <button
          onClick={() => setActiveSubTab("partners")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeSubTab === "partners"
              ? "border-brand-primary text-brand-primary dark:text-brand-primary"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Commercial Partners ({partners.length})
        </button>
        <button
          onClick={() => setActiveSubTab("reconciliation")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeSubTab === "reconciliation"
              ? "border-brand-primary text-brand-primary dark:text-brand-primary"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Calculator className="w-4 h-4" />
          Reconciliation & Excel Export
        </button>
        <button
          onClick={() => setActiveSubTab("invoices")}
          className={`pb-3 px-2 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeSubTab === "invoices"
              ? "border-brand-primary text-brand-primary dark:text-brand-primary"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <Receipt className="w-4 h-4" />
          Partner Invoices & Bills Payable ({invoices.length})
        </button>
      </div>

      {/* ── SubTab 1: Commercial Partners ── */}
      {activeSubTab === "partners" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <Text className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Active Marketplace Partners
            </Text>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Multi-tenant isolated vendors with commercial agreements
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <th className="py-3 px-4">Partner Name / Legal</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4">Tax Identifiers</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">KYC</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {partners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No commercial partners onboarded yet. Click "Onboard Partner" above to register one.
                    </td>
                  </tr>
                ) : (
                  partners.map((partner) => (
                    <tr key={partner.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{partner.name}</div>
                        <div className="text-[11px] text-slate-500">{partner.legal_name}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>{partner.email}</div>
                        <div className="text-slate-500">{partner.phone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>GSTIN: {partner.gstin || "—"}</div>
                        <div className="text-slate-500">PAN: {partner.pan || "—"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            partner.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : "bg-brand-gold/10 text-brand-gold border border-brand-gold/20"
                          }`}
                        >
                          {partner.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            partner.kyc_status === "VERIFIED"
                              ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                              : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                          }`}
                        >
                          {partner.kyc_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedPartnerId(partner.id);
                            setActiveSubTab("reconciliation");
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-brand-light dark:bg-brand-navy/60 text-brand-primary dark:text-brand-primary hover:bg-brand-light rounded-lg transition-colors border border-brand-primary/30 dark:border-brand-navy"
                        >
                          Reconcile
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SubTab 2: Reconciliation & Excel Export ── */}
      {activeSubTab === "reconciliation" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-1 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-brand-primary" />
                Statement Parameters
              </Heading>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Select Partner</label>
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Choose Partner --</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">From Date</label>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">To Date</label>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <Button
                  variant="primary"
                  className="w-full bg-brand-primary hover:bg-brand-primary text-white mt-2"
                  onClick={handleGenerateStatement}
                  disabled={reconciling || !selectedPartnerId}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${reconciling ? "animate-spin" : ""}`} />
                  Calculate Reconciliation
                </Button>

                <Button
                  variant="secondary"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white border-0 mt-2 flex items-center justify-center gap-2"
                  onClick={handleExportExcel}
                  disabled={exporting || !selectedPartnerId}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Export Excel Statement (.xlsx)
                </Button>
              </div>
            </div>

            {/* Record Partner's Invoice Receipt Form */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-500" />
                Record Partner Invoice Receipt
              </Heading>
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                Record receipt of an invoice already issued by the partner. Does NOT auto-post or auto-pay.
              </Text>

              <form onSubmit={handleReceivePartnerInvoice} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                    Partner Invoice Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-PTNR-2026-089"
                    value={partnerInvoiceNo}
                    onChange={(e) => setPartnerInvoiceNo(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={partnerInvoiceDate}
                    onChange={(e) => setPartnerInvoiceDate(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                    Invoice Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={partnerInvoiceAmount}
                    onChange={(e) => setPartnerInvoiceAmount(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                    Document Ref / URL
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PDF-REF-1092"
                    value={partnerDocRef}
                    onChange={(e) => setPartnerDocRef(e.target.value)}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white mt-2"
                  disabled={receivingInvoice || !selectedPartnerId}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Record Invoice Receipt
                </Button>
              </form>
            </div>
          </div>

          {/* Statement View Column */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white">
                  PostgreSQL Reconciliation Statement Summary
                </Heading>
                {statement && (
                  <Badge color="blue" className="text-xs">
                    Statement Ref: {statement.statementId.slice(0, 10)}
                  </Badge>
                )}
              </div>

              {!statement ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <Calculator className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium">No statement calculated yet.</p>
                  <p className="text-xs">
                    Select a partner and date range on the left and click "Calculate Reconciliation".
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-slate-500 font-medium">Orders Count</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {statement.orderCount}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-slate-500 font-medium">Gross Product Sales</div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        ₹{statement.totalGrossSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="text-slate-500 font-medium">Marketplace Commission</div>
                      <div className="text-lg font-bold text-brand-primary dark:text-brand-primary mt-1">
                        ₹{statement.totalCommission.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                      <div className="text-emerald-700 dark:text-emerald-400 font-semibold">Net Payable to Partner</div>
                      <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                        ₹{statement.netPayableToPartner.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Breakdown Table */}
                  <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                    <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Calculation Flow</div>
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span>Gross Sales (Cakes & Bouquets)</span>
                      <span className="font-semibold">₹{statement.totalGrossSales.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span>Total GST Collected</span>
                      <span className="font-semibold">₹{statement.totalGst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span>Customer Discounts Borne</span>
                      <span className="font-semibold text-rose-500">-₹{statement.totalDiscounts.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                      <span>Marketplace Commission Retained</span>
                      <span className="font-semibold text-brand-primary">-₹{statement.totalCommission.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 font-bold text-slate-900 dark:text-white">
                      <span>Net Calculated Entitlement</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ₹{statement.netPayableToPartner.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SubTab 3: Partner Invoices & Bills Payable ── */}
      {activeSubTab === "invoices" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <Text className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Partner Invoice Receipts & Bills Payable Linkages
            </Text>
            <span className="text-xs text-slate-500">
              Double-entry posting requires administrative approval to Bills Payable
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                  <th className="py-3 px-4">Partner Invoice #</th>
                  <th className="py-3 px-4">Partner</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4">Invoiced vs Reconciled</th>
                  <th className="py-3 px-4">Discrepancy</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Accounting Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No partner invoices recorded yet. Record an invoice receipt in the Reconciliation tab.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {inv.partner_invoice_number}
                        </div>
                        <div className="text-[11px] text-slate-500">Date: {inv.invoice_date}</div>
                      </td>
                      <td className="py-3 px-4 font-medium">{inv.partner_name || inv.partner_id.slice(0, 8)}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {inv.period_start} to {inv.period_end}
                      </td>
                      <td className="py-3 px-4">
                        <div>Inv: ₹{Number(inv.invoice_amount).toFixed(2)}</div>
                        <div className="text-[11px] text-slate-500">
                          Calc: ₹{Number(inv.reconciled_amount).toFixed(2)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {Number(inv.discrepancy_amount) !== 0 ? (
                          <span className="text-rose-500 font-semibold">
                            ₹{Number(inv.discrepancy_amount).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-emerald-500 font-medium">₹0.00 (Matched)</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === "APPROVED" || inv.status === "POSTED_TO_AP"
                              ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                              : inv.status === "DISCREPANCY_DETECTED"
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.status !== "APPROVED" && inv.status !== "POSTED_TO_AP" ? (
                          <Button
                            size="small"
                            variant="primary"
                            onClick={() => handleApproveInvoice(inv.id)}
                            className="bg-brand-primary hover:bg-brand-primary text-white text-xs px-2.5 py-1"
                          >
                            Approve to Bills Payable
                          </Button>
                        ) : (
                          <span className="text-slate-400 text-xs flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Approved
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onboard Partner Modal */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <Heading level="h3" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Store className="w-5 h-5 text-brand-primary" />
                Onboard Commercial Marketplace Partner
              </Heading>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOnboardPartner} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Store / Brand Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Bakers & Confectionery"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Legal Entity Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Foods LLP"
                  value={newPartner.legal_name}
                  onChange={(e) => setNewPartner({ ...newPartner, legal_name: e.target.value })}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="partner@example.com"
                    value={newPartner.email}
                    onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 9876543210"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">GSTIN</label>
                  <input
                    type="text"
                    placeholder="29AAAAA0000A1Z5"
                    value={newPartner.gstin}
                    onChange={(e) => setNewPartner({ ...newPartner, gstin: e.target.value.toUpperCase() })}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">PAN</label>
                  <input
                    type="text"
                    placeholder="AAAAA0000A"
                    value={newPartner.pan}
                    onChange={(e) => setNewPartner({ ...newPartner, pan: e.target.value.toUpperCase() })}
                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                  Default Marketplace Commission (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newPartner.commission_percentage}
                  onChange={(e) => setNewPartner({ ...newPartner, commission_percentage: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowOnboardModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-brand-primary hover:bg-brand-primary text-white"
                  disabled={loading}
                >
                  Onboard & Save to PostgreSQL
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
