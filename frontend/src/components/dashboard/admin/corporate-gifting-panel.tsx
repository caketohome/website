"use client";

/**
 * CakeToHome ERP — Phase C7.7 Step 7D: Corporate Gifting Management Panel
 *
 * WORKFLOW CAPABILITIES:
 * 1. Download official 11-column Excel template directly from server.
 * 2. Select & upload workbook (.xlsx) via file picker or drag-and-drop.
 * 3. Dry-run validation executing completely read-only on server (zero mutations).
 * 4. Display structured validation report with row-level errors and actionable feedback.
 * 5. Allow workbook correction and re-validation.
 * 6. Display server-authoritative corporate credit exposure and limit status.
 * 7. Require explicit confirmation modal before executing a valid batch.
 * 8. Execute atomic batch import generating 1 master order, N deliveries, 1 master corporate invoice, and GL voucher.
 * 9. Display batch list with filters (status, search, customer) and pagination.
 * 10. Open batch detail drawer/modal showing recipient roster with PII protection.
 * 11. Complete loading, empty, error, permission-denied, and double-submit defense states.
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
import {
  Gift,
  Download,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldAlert,
  Users,
  Search,
  RefreshCw,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  Layers,
  Building2,
  FileText,
  DollarSign,
  Lock,
  ArrowRight,
  Check,
  Truck,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { WidgetErrorBoundary } from "./error-boundary";

interface CustomerOption {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  credit_enabled: boolean;
  credit_limit: number;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface BatchListItem {
  id: string;
  customer_id: string;
  batch_name: string;
  source_filename: string;
  status: string;
  total_recipients: number;
  total_amount: number;
  validated_recipients: number;
  invalid_recipients: number;
  processed_recipients: number;
  invoice_id: string | null;
  order_id: string | null;
  created_at: string;
  metadata?: any;
}

interface ValidationReport {
  isValid: boolean;
  fileHash: string;
  fileSizeBytes: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  summary: {
    subtotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    taxTotal: number;
    grandTotal: number;
    customerCreditLimit: number;
    currentOutstanding: number;
    activeBatchesTotal: number;
    totalProjectedExposure: number;
    availableCredit: number;
    creditLimitExceeded: boolean;
  };
  errors: Array<{
    rowNumber?: number;
    field?: string;
    code: string;
    message: string;
  }>;
  parsedRecipients: Array<any>;
  customer?: any;
  branch?: any;
}

interface ExecutionResult {
  batch: BatchListItem;
  recipientsCount: number;
  masterOrderId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  voucherId: string | null;
  voucherNumber: string | null;
}

export const CorporateGiftingPanel = memo(function CorporateGiftingPanel() {
  const [activeSubTab, setActiveSubTab] = useState<"batches" | "upload">("batches");

  // Master Data
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(true);

  // List State
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [totalBatches, setTotalBatches] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Filters
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const limit = 15;

  // Upload & Validation State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileBase64, setUploadFileBase64] = useState<string>("");
  const [uploadCustomerId, setUploadCustomerId] = useState<string>("");
  const [uploadBatchName, setUploadBatchName] = useState<string>("");
  const [validating, setValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Execution State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Detail Modal State
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailBatch, setDetailBatch] = useState<BatchListItem | null>(null);
  const [detailRecipients, setDetailRecipients] = useState<any[]>([]);
  const [detailRoutingSummary, setDetailRoutingSummary] = useState<any | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reEvaluatingRouting, setReEvaluatingRouting] = useState(false);

  // Download Template State
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Fetch Master Data
  useEffect(() => {
    async function loadMasterData() {
      try {
        setLoadingMaster(true);
        // Load customers
        const custRes = await fetch("/api/v1/customers?limit=100", { credentials: "include" });
        if (custRes.ok) {
          const data = await custRes.json();
          const list = Array.isArray(data.customers) ? data.customers : Array.isArray(data) ? data : [];
          const corpOnly = list.filter((c: any) => c.is_corporate === true || c.isCorporate === true);
          setCustomers(corpOnly);
          if (corpOnly.length > 0 && !uploadCustomerId) {
            setUploadCustomerId(corpOnly[0].id);
          }
        }

        // Load branches
        const bRes = await fetch("/api/v1/admin/branches", { credentials: "include" });
        if (bRes.ok) {
          const bData = await bRes.json();
          const bList = Array.isArray(bData.branches) ? bData.branches : Array.isArray(bData) ? bData : [];
          setBranches(bList);
        }
      } catch (err) {
        console.error("Failed to load master data:", err);
      } finally {
        setLoadingMaster(false);
      }
    }
    loadMasterData();
  }, []);

  // Fetch Batches List
  const fetchBatches = useCallback(async () => {
    try {
      setListLoading(true);
      setListError(null);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (selectedCustomerId) params.set("customerId", selectedCustomerId);
      if (selectedStatus && selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/v1/admin/corporate-gifting/batches?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch batches (HTTP ${res.status})`);
      }

      const data = await res.json();
      setBatches(data.batches || []);
      setTotalBatches(data.total || 0);
    } catch (err: any) {
      setListError(err.message || "Failed to load corporate gifting batches.");
    } finally {
      setListLoading(false);
    }
  }, [page, limit, selectedCustomerId, selectedStatus, searchQuery]);

  useEffect(() => {
    if (activeSubTab === "batches") {
      fetchBatches();
    }
  }, [fetchBatches, activeSubTab]);

  // Handle Template Download
  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const res = await fetch("/api/v1/admin/corporate-gifting/template", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to download template (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "corporate_gifting_template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error downloading template: ${err.message}`);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Handle File Input Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx")) {
      alert("Please upload an Excel workbook (.xlsx).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("File exceeds maximum limit of 10MB.");
      return;
    }

    setUploadFile(file);
    setValidationReport(null);
    setValidationError(null);
    setExecutionResult(null);
    setExecutionError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      setUploadFileBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  // Run Dry-Run Validation
  const handleRunValidation = async () => {
    if (!uploadFileBase64 || !uploadCustomerId) {
      setValidationError("Please select a corporate customer and upload an .xlsx file.");
      return;
    }

    try {
      setValidating(true);
      setValidationError(null);
      setValidationReport(null);

      const res = await fetch("/api/v1/admin/corporate-gifting/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerId: uploadCustomerId,
          fileBase64: uploadFileBase64,
          sourceFilename: uploadFile?.name || "corporate_gifting.xlsx",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Validation request failed (HTTP ${res.status})`);
      }

      setValidationReport(data);
    } catch (err: any) {
      setValidationError(err.message || "Failed to validate spreadsheet.");
    } finally {
      setValidating(false);
    }
  };

  // Run Batch Execution
  const handleExecuteBatch = async () => {
    if (!uploadFileBase64 || !uploadCustomerId || !validationReport?.isValid) {
      return;
    }

    try {
      setExecuting(true);
      setExecutionError(null);

      const res = await fetch("/api/v1/admin/corporate-gifting/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerId: uploadCustomerId,
          batchName: uploadBatchName.trim() || undefined,
          fileBase64: uploadFileBase64,
          sourceFilename: uploadFile?.name || "corporate_gifting.xlsx",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Batch execution failed (HTTP ${res.status})`);
      }

      setExecutionResult(data);
      setShowConfirmModal(false);
      // Reset upload buffer to avoid duplicate execution
      setUploadFile(null);
      setUploadFileBase64("");
      setValidationReport(null);
      // Refresh list
      fetchBatches();
    } catch (err: any) {
      setExecutionError(err.message || "Execution failed.");
      setShowConfirmModal(false);
    } finally {
      setExecuting(false);
    }
  };

  // Open Batch Detail Modal
  const handleOpenDetail = async (batchId: string) => {
    try {
      setDetailBatchId(batchId);
      setDetailLoading(true);
      setDetailError(null);
      setDetailBatch(null);
      setDetailRecipients([]);
      setDetailRoutingSummary(null);

      const res = await fetch(`/api/v1/admin/corporate-gifting/batches/${batchId}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch batch details (HTTP ${res.status})`);
      }

      const data = await res.json();
      setDetailBatch(data.batch);
      setDetailRecipients(data.recipients || []);
      setDetailRoutingSummary(data.routingSummary || null);
    } catch (err: any) {
      setDetailError(err.message || "Failed to load batch details.");
    } finally {
      setDetailLoading(false);
    }
  };

  // Phase C7.13: Re-evaluate Routing for Batch
  const handleReEvaluateRouting = async (forceReassign: boolean = false) => {
    if (!detailBatchId) return;
    try {
      setReEvaluatingRouting(true);
      const res = await fetch(`/api/v1/admin/corporate-gifting/batches/${detailBatchId}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ forceReassign }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Re-evaluation failed (HTTP ${res.status})`);
      }

      // Re-fetch detail to refresh badges and items
      await handleOpenDetail(detailBatchId);
    } catch (err: any) {
      alert(`Routing re-evaluation failed: ${err.message}`);
    } finally {
      setReEvaluatingRouting(false);
    }
  };

  // Helper status color badge
  const renderStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    switch (s) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-800 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" /> Processing
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <Clock className="w-3 h-3" /> Scheduled
          </span>
        );
      case "VALIDATED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <Check className="w-3 h-3" /> Validated
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            {status}
          </span>
        );
    }
  };

  // Phase C7.13: Delivery lifecycle badge
  const renderDeliveryStatusBadge = (status?: string) => {
    const s = (status || "pending").toLowerCase();
    switch (s) {
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Delivered
          </span>
        );
      case "out_for_delivery":
      case "in_transit":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
            <Truck className="w-3 h-3" /> In Transit
          </span>
        );
      case "assigned":
      case "pickup_claimed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
            <Check className="w-3 h-3" /> Assigned
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  // Phase C7.13: Route assignment badge
  const renderRoutingBadge = (item: any) => {
    const status = (item.assignment_status || "").toUpperCase();
    if (status === "ASSIGNED") {
      return (
        <div className="flex flex-col text-[11px]">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
            <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
            <span className="truncate max-w-[130px]">{item.assigned_store_name || "Assigned Store"}</span>
          </span>
          {item.assigned_partner_name && (
            <span className="text-[10px] text-slate-500 flex items-center gap-1 truncate max-w-[130px]">
              <Truck className="w-2.5 h-2.5 shrink-0" />
              {item.assigned_partner_name}
            </span>
          )}
          {item.distance_km !== null && item.distance_km !== undefined && (
            <span className="text-[10px] text-slate-400 font-mono">
              {Number(item.distance_km).toFixed(1)} km
            </span>
          )}
        </div>
      );
    }
    if (status === "MANUAL_OVERRIDE") {
      return (
        <div className="flex flex-col text-[11px]">
          <span className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-400">
            <ShieldCheck className="w-3 h-3 text-purple-600 shrink-0" />
            <span className="truncate max-w-[130px]">{item.assigned_store_name || "Override Store"}</span>
          </span>
          {item.assigned_partner_name && (
            <span className="text-[10px] text-slate-500 truncate max-w-[130px]">
              {item.assigned_partner_name}
            </span>
          )}
          <span className="text-[10px] text-purple-600/80 font-mono">
            Manual Override
          </span>
        </div>
      );
    }
    const reason = item.reason_code || "UNRESOLVED";
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
        {reason}
      </span>
    );
  };

  return (
    <WidgetErrorBoundary>
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Corporate Gifting Subsystem
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Bulk recipient campaign ingestion, dry-run spreadsheet validation, credit exposure checks, and master corporate billing.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
              id="btn-download-gifting-template"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs disabled:opacity-50"
            >
              {downloadingTemplate ? (
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
              ) : (
                <Download className="w-4 h-4 text-indigo-500" />
              )}
              Download Excel Template
            </button>

            <button
              onClick={() => setActiveSubTab(activeSubTab === "batches" ? "upload" : "batches")}
              id="btn-toggle-gifting-view"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors"
            >
              {activeSubTab === "batches" ? (
                <>
                  <UploadCloud className="w-4 h-4" />
                  New Bulk Campaign
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  View All Batches
                </>
              )}
            </button>
          </div>
        </div>

        {/* Global Execution Alert Banner if completed */}
        {executionResult && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-sm flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Corporate Gifting Batch Successfully Scheduled!
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                  Batch ID: <strong className="font-mono">{executionResult.batch?.id}</strong> | Processed Recipients: <strong>{executionResult.recipientsCount}</strong>
                </p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  <span>Commercial Master Order: <strong className="font-mono">{executionResult.masterOrderId}</strong></span>
                  {executionResult.invoiceNumber && (
                    <span>Master Corporate Invoice: <strong className="font-mono">{executionResult.invoiceNumber}</strong></span>
                  )}
                  {executionResult.voucherNumber && (
                    <span>Statutory Voucher: <strong className="font-mono">{executionResult.voucherNumber}</strong></span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setExecutionResult(null)}
              className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Global Error Banner */}
        {executionError && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 shadow-sm flex items-start justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">Execution Error</h4>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">{executionError}</p>
              </div>
            </div>
            <button
              onClick={() => setExecutionError(null)}
              className="p-1 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* VIEW 1: NEW BULK CAMPAIGN INGESTION */}
        {activeSubTab === "upload" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Upload Form & Instructions */}
              <div className="lg:col-span-1 space-y-4">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                    Campaign Parameters
                  </h3>

                  {/* Customer Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Corporate Customer <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={uploadCustomerId}
                      onChange={(e) => {
                        setUploadCustomerId(e.target.value);
                        setValidationReport(null);
                      }}
                      id="select-gifting-customer"
                      className="w-full text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Corporate Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name || `${c.first_name} ${c.last_name}`} (Credit: ₹{Number(c.credit_limit || 0).toLocaleString("en-IN")})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Or enter Customer ID (e.g. cus_...)"
                      value={uploadCustomerId}
                      onChange={(e) => {
                        setUploadCustomerId(e.target.value);
                        setValidationReport(null);
                      }}
                      id="input-gifting-customer-id"
                      className="w-full text-xs py-1.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 font-mono mt-1"
                    />
                  </div>

                  {/* Batch Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Campaign / Batch Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Diwali Executive Gifting 2026"
                      value={uploadBatchName}
                      onChange={(e) => setUploadBatchName(e.target.value)}
                      id="input-gifting-batch-name"
                      className="w-full text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* File Upload Zone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Upload Recipient Workbook (.xlsx) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-850/50">
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={handleFileChange}
                        id="input-gifting-file"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <UploadCloud className="w-8 h-8 mx-auto text-indigo-500 mb-2" />
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {uploadFile ? uploadFile.name : "Choose or drag .xlsx workbook"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Max 10MB | Strictly 11 canonical columns
                      </p>
                    </div>
                  </div>

                  {/* Validate Button */}
                  <button
                    onClick={handleRunValidation}
                    disabled={!uploadFile || !uploadCustomerId || validating}
                    id="btn-run-validation"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {validating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Validating Spreadsheet...
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4" />
                        Run Dry-Run Validation
                      </>
                    )}
                  </button>

                  {validationError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{validationError}</span>
                    </div>
                  )}
                </div>

                {/* Instructions Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    Ingestion Guidelines
                  </h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Must use official template columns without alterations.</li>
                    <li>Recipient phone must be a valid 10-digit Indian mobile.</li>
                    <li>PIN codes must be valid 6-digit postal numbers.</li>
                    <li>Delivery date cannot be in the past or exceed 60 days.</li>
                    <li>SKUs must exist in live catalog with active selling prices.</li>
                  </ul>
                </div>
              </div>

              {/* Right Columns: Dry-Run Validation Results */}
              <div className="lg:col-span-2 space-y-4">
                {validationReport ? (
                  <div className="space-y-4 animate-in fade-in">
                    {/* Validation Status Card */}
                    <div
                      className={`p-5 rounded-2xl border shadow-xs ${
                        validationReport.isValid
                          ? "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                          : "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {validationReport.isValid ? (
                            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                              <AlertTriangle className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {validationReport.isValid
                                ? "Workbook Passed All Validations"
                                : "Workbook Contains Row Validation Errors"}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {validationReport.isValid
                                ? "All recipients and SKUs resolved. Ready for atomic batch execution."
                                : "Please correct the flagged row errors in your spreadsheet and re-upload."}
                            </p>
                          </div>
                        </div>

                        {validationReport.isValid && (
                          <button
                            onClick={() => setShowConfirmModal(true)}
                            id="btn-open-execute-confirmation"
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors shrink-0"
                          >
                            <Gift className="w-4 h-4" />
                            Confirm & Execute Batch
                          </button>
                        )}
                      </div>

                      {/* Summary Metrics Bar */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                        <div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Total Rows</span>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{validationReport.totalRows}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Valid Rows</span>
                          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{validationReport.validRows}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">Invalid Rows</span>
                          <p className="text-sm font-bold text-rose-700 dark:text-rose-300">{validationReport.invalidRows}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">Estimated Total</span>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            ₹{Number(validationReport.summary.grandTotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Authoritative Financial & Credit Exposure Breakdown */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-indigo-500" />
                        Authoritative Credit & Financial Audit
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Financial Totals */}
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Tax & Amount Summary</span>
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>Taxable Subtotal:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">₹{validationReport.summary.subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>CGST + SGST (Intra-state):</span>
                            <span>₹{(validationReport.summary.cgst + validationReport.summary.sgst).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>IGST (Inter-state):</span>
                            <span>₹{validationReport.summary.igst.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold pt-1.5 border-t border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                            <span>Grand Total (1 Master Invoice):</span>
                            <span className="text-indigo-600 dark:text-indigo-400">₹{validationReport.summary.grandTotal.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Credit Status */}
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 space-y-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Corporate Credit Limit</span>
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>Approved Limit:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">₹{validationReport.summary.customerCreditLimit.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>Current Outstanding (AR):</span>
                            <span>₹{validationReport.summary.currentOutstanding.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>Projected Exposure:</span>
                            <span className={validationReport.summary.creditLimitExceeded ? "text-rose-600 font-bold" : "text-slate-900 dark:text-white font-semibold"}>
                              ₹{validationReport.summary.totalProjectedExposure.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs font-bold pt-1.5 border-t border-slate-200 dark:border-slate-700">
                            <span>Available Remaining:</span>
                            <span className={validationReport.summary.creditLimitExceeded ? "text-rose-600" : "text-emerald-600"}>
                              ₹{validationReport.summary.availableCredit.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {validationReport.summary.creditLimitExceeded && (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>
                            <strong>Credit Limit Exceeded:</strong> Projected exposure exceeds the approved corporate credit limit. Execution is blocked.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Row Errors Table (if errors exist) */}
                    {validationReport.errors && validationReport.errors.length > 0 && (
                      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                        <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" />
                          Identified Row-Level Errors ({validationReport.errors.length})
                        </h4>
                        <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold sticky top-0">
                              <tr>
                                <th className="py-2 px-3">Row</th>
                                <th className="py-2 px-3">Field</th>
                                <th className="py-2 px-3">Error Code</th>
                                <th className="py-2 px-3">Message</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {validationReport.errors.map((err, idx) => (
                                <tr key={idx} className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20">
                                  <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {err.rowNumber || "General"}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                    {err.field || "—"}
                                  </td>
                                  <td className="py-2 px-3 font-mono text-rose-600 dark:text-rose-400">
                                    {err.code}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                    {err.message}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-900/30">
                    <FileSpreadsheet className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Dry-Run Report Yet</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
                      Select a corporate client, choose an .xlsx workbook, and click "Run Dry-Run Validation" to audit recipients and calculate authoritative taxes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: BATCH LISTING */}
        {activeSubTab === "batches" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex flex-1 flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search campaign name or file..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    id="input-search-gifting-batches"
                    className="w-full text-xs py-2 pl-9 pr-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Customer Filter */}
                <select
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setPage(1);
                  }}
                  id="select-filter-customer"
                  className="text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Corporate Clients</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || `${c.first_name} ${c.last_name}`}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  id="select-filter-status"
                  className="text-xs py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={fetchBatches}
                  disabled={listLoading}
                  id="btn-refresh-gifting-batches"
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${listLoading ? "animate-spin text-indigo-500" : ""}`} />
                </button>
              </div>
            </div>

            {/* Error Message */}
            {listError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{listError}</span>
              </div>
            )}

            {/* Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Campaign / Batch</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Recipients</th>
                      <th className="py-3 px-4">Total Amount</th>
                      <th className="py-3 px-4">Master Invoice</th>
                      <th className="py-3 px-4">Created Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {listLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                          <span>Loading campaign batches...</span>
                        </td>
                      </tr>
                    ) : batches.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          <Gift className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                          <p className="font-semibold text-slate-600 dark:text-slate-300">No Corporate Gifting Batches Found</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Click "New Bulk Campaign" to ingest an Excel workbook.</p>
                        </td>
                      </tr>
                    ) : (
                      batches.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{b.batch_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>{b.id}</span>
                              <span>•</span>
                              <span>{b.source_filename}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">{renderStatusBadge(b.status)}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{b.total_recipients}</span>
                            <span className="text-slate-400 text-[11px]"> recipients</span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            ₹{Number(b.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                            {b.invoice_id ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-medium">Linked</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                            {b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleOpenDetail(b.id)}
                              id={`btn-view-batch-${b.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-3 bg-slate-50/60 dark:bg-slate-850/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {batches.length} of {totalBatches} batches
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-bold text-slate-800 dark:text-slate-200">{page}</span>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page * limit >= totalBatches}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: EXPLICIT EXECUTION CONFIRMATION */}
        {showConfirmModal && validationReport && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    <Gift className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Confirm Corporate Gifting Execution
                    </h3>
                    <p className="text-xs text-slate-500">
                      Atomic creation of 1 master order, child deliveries, and 1 corporate invoice.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={executing}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Corporate Customer:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {validationReport.customer?.companyName || uploadCustomerId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Campaign Name:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {uploadBatchName || "Default Scheduled Campaign"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Valid Recipients:</span>
                  <span className="font-semibold text-emerald-600">{validationReport.validRows}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-700 dark:text-slate-300 font-bold">Total Invoiced Amount:</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                    ₹{validationReport.summary.grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Invariant:</strong> Exactly 1 master corporate tax invoice will be posted to General Ledger. Individual recipients will NOT receive separate invoices.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={executing}
                  id="btn-cancel-execution"
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteBatch}
                  disabled={executing}
                  id="btn-confirm-execute-batch"
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {executing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Executing Batch & Invoicing...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Authorize & Execute
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: BATCH DETAILS & RECIPIENT ROSTER */}
        {detailBatchId && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col space-y-4 animate-in zoom-in-95">
              <div className="flex items-start justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {detailBatch?.batch_name || "Batch Details"}
                    </h3>
                    {detailBatch && renderStatusBadge(detailBatch.status)}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Batch ID: {detailBatchId} | File: {detailBatch?.source_filename}
                  </p>
                </div>
                <button
                  onClick={() => setDetailBatchId(null)}
                  id="btn-close-batch-detail-modal"
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {detailLoading ? (
                <div className="py-20 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                  <span>Loading batch details & recipients...</span>
                </div>
              ) : detailError ? (
                <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs">
                  {detailError}
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto pr-1">
                  {/* Master Info Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Recipients Count</span>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {detailBatch?.total_recipients}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Total Billed</span>
                      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                        ₹{Number(detailBatch?.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Master Order</span>
                      <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                        {detailBatch?.order_id || "—"}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500">Master Invoice</span>
                      <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                        {detailBatch?.invoice_id || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Phase C7.13: Routing & Fulfillment Coverage Summary */}
                  {detailRoutingSummary && (
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>Routing & Fulfillment Coverage</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              {detailRoutingSummary.assignedCount} / {detailRoutingSummary.totalRecipients} Assigned
                            </span>
                            {detailRoutingSummary.unassignedCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                {detailRoutingSummary.unassignedCount} In Review
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Automated polygon geofence & partner capability routing with manual override protection.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleReEvaluateRouting(false)}
                          disabled={reEvaluatingRouting}
                          id="btn-reevaluate-routing"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-2xs"
                          title="Re-evaluates automated routing while preserving manual overrides"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${reEvaluatingRouting ? "animate-spin" : ""}`} />
                          Re-evaluate Routing
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recipient Roster */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      Recipient Deliveries ({detailRecipients.length})
                    </h4>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-850 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Emp ID</th>
                            <th className="py-2.5 px-3">Recipient Name</th>
                            <th className="py-2.5 px-3">Phone</th>
                            <th className="py-2.5 px-3">Address & PIN</th>
                            <th className="py-2.5 px-3">Delivery Status</th>
                            <th className="py-2.5 px-3">Route Assignment</th>
                            <th className="py-2.5 px-3">Delivery Date</th>
                            <th className="py-2.5 px-3">Item / SKU</th>
                            <th className="py-2.5 px-3 text-right">Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {detailRecipients.map((r, idx) => (
                            <tr key={r.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                {r.employee_id || r.employeeId || "—"}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                {r.recipient_name || r.recipientName}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                {r.recipient_phone || r.recipientPhone}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[180px] truncate">
                                {r.delivery_address || r.deliveryAddress} ({r.delivery_pincode || r.deliveryPincode})
                              </td>
                              <td className="py-2.5 px-3">
                                {renderDeliveryStatusBadge(r.delivery_status || r.deliveryStatus)}
                              </td>
                              <td className="py-2.5 px-3">
                                {renderRoutingBadge(r)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                {r.delivery_date || r.deliveryDate}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                                {r.sku || r.productSku}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">
                                {r.quantity}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </WidgetErrorBoundary>
  );
});

CorporateGiftingPanel.displayName = "CorporateGiftingPanel";
export default CorporateGiftingPanel;
