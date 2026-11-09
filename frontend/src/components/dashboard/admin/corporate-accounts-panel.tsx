"use client";

/**
 * CakeToHome ERP — Phase C7.9 Step 9E: Corporate Account Master & Employee Roster Management Panel
 *
 * WORKFLOW CAPABILITIES:
 * 1. Account Inventory: List, search, and status filters (PENDING, APPROVED, SUSPENDED, CLOSED).
 * 2. Registration Wizard: Register new corporate master with GSTIN/PAN and primary contact.
 * 3. Four-Eyes Approval: Segregation of duties enforcement (creator !== approver, Super Admin only).
 * 4. Credit Governance: Request credit vs Super Admin-only Credit Activation (Decision Q1).
 * 5. Delegated Membership: Grant/revoke account-scoped ROSTER_MANAGER and ROSTER_VIEWER roles.
 * 6. Employee Roster Management: View, search, filter, edit, soft-deactivate, and reactivate.
 * 7. PII Defense: Automatic dynamic masking for non-privileged viewers with status indicator.
 * 8. Coordinates Verification: India bbox validation, plausibility check, and Super Admin verification.
 * 9. Bulk Roster Import Wizard: Official Excel template download, file upload, dry-run validation
 *    with row-level diagnostics, SHA-256 replay protection, and atomic commit.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2,
  Users,
  ShieldCheck,
  CreditCard,
  Download,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  Plus,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  FileText,
  MapPin,
  Check,
  X,
  Lock,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  SlidersHorizontal,
  Mail,
  Phone,
  Briefcase,
} from "lucide-react";
import { WidgetErrorBoundary } from "./error-boundary";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface CorporateAccount {
  id: string;
  customer_id: string;
  legal_name: string;
  trade_name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  status: "PENDING" | "APPROVED" | "SUSPENDED" | "CLOSED";
  credit_requested_limit?: number | null;
  credit_requested_terms_days?: number | null;
  billing_address?: any;
  registered_address?: any;
  created_by?: string;
  created_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  suspended_reason?: string | null;
}

interface CorporateContact {
  id: string;
  account_id: string;
  contact_type: "PRIMARY" | "SECONDARY" | "ACCOUNTS_PAYABLE" | "BILLING";
  name: string;
  email: string;
  phone: string;
  designation?: string | null;
  is_active: boolean;
}

interface CorporateMember {
  id: string;
  account_id: string;
  user_id: string;
  member_role: "ROSTER_MANAGER" | "ROSTER_VIEWER";
  status: "ACTIVE" | "REVOKED";
  granted_by: string;
  granted_at: string;
}

interface CorporateEmployee {
  id: string;
  account_id: string;
  employee_code: string;
  full_name: string;
  phone: string;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  default_latitude?: number | null;
  default_longitude?: number | null;
  coordinate_verified: boolean;
  coordinate_source?: string | null;
  status: "ACTIVE" | "INACTIVE";
  deactivated_reason?: string | null;
  created_at: string;
}

interface ImportBatch {
  id: string;
  account_id: string;
  file_hash: string;
  filename: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  phone_reuse_count: number;
  created_by: string;
  created_at: string;
  committed_at?: string | null;
}

interface ImportValidationResult {
  isValid: boolean;
  fileHash: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  phoneReuseCount: number;
  errors: Array<{
    rowNumber: number;
    employeeCode?: string;
    fullName?: string;
    phone?: string;
    reason: string;
  }>;
  phoneReuseWarnings: Array<{
    rowNumber: number;
    employeeCode: string;
    phone: string;
    existingEmployeeCode?: string;
    message: string;
  }>;
}

// ─── Main Panel Component ────────────────────────────────────────────────────

export function CorporateAccountsPanel() {
  // Navigation & View State
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<CorporateAccount | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Sub-sections for selected account
  const [activeSubTab, setActiveSubTab] = useState<"ROSTER" | "CONTACTS" | "MEMBERS" | "IMPORTS" | "CREDIT">("ROSTER");
  const [contacts, setContacts] = useState<CorporateContact[]>([]);
  const [members, setMembers] = useState<CorporateMember[]>([]);
  const [employees, setEmployees] = useState<CorporateEmployee[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [isLoadingSubData, setIsLoadingSubData] = useState<boolean>(false);

  // Modals State
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [showCreditRequestModal, setShowCreditRequestModal] = useState<boolean>(false);
  const [showCreditActivationModal, setShowCreditActivationModal] = useState<boolean>(false);
  const [showSuspendModal, setShowSuspendModal] = useState<boolean>(false);
  const [showReactivateModal, setShowReactivateModal] = useState<boolean>(false);
  const [showAddContactModal, setShowAddContactModal] = useState<boolean>(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState<boolean>(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState<boolean>(false);
  const [showEditEmployeeModal, setShowEditEmployeeModal] = useState<boolean>(false);
  const [showDeactivateEmployeeModal, setShowDeactivateEmployeeModal] = useState<boolean>(false);
  const [showReactivateEmployeeModal, setShowReactivateEmployeeModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Target item for mutations
  const [targetEmployee, setTargetEmployee] = useState<CorporateEmployee | null>(null);

  // Form State: Register Account
  const [regLegalName, setRegLegalName] = useState<string>("");
  const [regTradeName, setRegTradeName] = useState<string>("");
  const [regGstin, setRegGstin] = useState<string>("");
  const [regPan, setRegPan] = useState<string>("");
  const [regContactName, setRegContactName] = useState<string>("");
  const [regContactEmail, setRegContactEmail] = useState<string>("");
  const [regContactPhone, setRegContactPhone] = useState<string>("");
  const [regContactDesignation, setRegContactDesignation] = useState<string>("Director");

  // Form State: Credit
  const [creditLimitInput, setCreditLimitInput] = useState<string>("250000");
  const [termsDaysInput, setTermsDaysInput] = useState<string>("30");
  const [actionReason, setActionReason] = useState<string>("");

  // Form State: Employee CRUD
  const [empCode, setEmpCode] = useState<string>("");
  const [empName, setEmpName] = useState<string>("");
  const [empPhone, setEmpPhone] = useState<string>("");
  const [empEmail, setEmpEmail] = useState<string>("");
  const [empDept, setEmpDept] = useState<string>("");
  const [empDesig, setEmpDesig] = useState<string>("");
  const [empLat, setEmpLat] = useState<string>("");
  const [empLng, setEmpLng] = useState<string>("");

  // Form State: Contact & Member
  const [newContactType, setNewContactType] = useState<string>("ACCOUNTS_PAYABLE");
  const [newContactName, setNewContactName] = useState<string>("");
  const [newContactEmail, setNewContactEmail] = useState<string>("");
  const [newContactPhone, setNewContactPhone] = useState<string>("");
  const [newMemberUserId, setNewMemberUserId] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<string>("ROSTER_MANAGER");

  // Import Wizard State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isValidatingImport, setIsValidatingImport] = useState<boolean>(false);
  const [isCommittingImport, setIsCommittingImport] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<ImportValidationResult | null>(null);

  // Helper for notification messages
  const notifySuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 5000);
  };
  const notifyError = (msg: string) => {
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(null), 7000);
  };

  // ─── Fetch Accounts List ───────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/admin/corporate-accounts");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to load corporate accounts.");
      }
      setAccounts(data.items || []);
    } catch (err: any) {
      notifyError(err.message || "Network error loading accounts.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // ─── Fetch Account Details & Sub-Resources ─────────────────────────────────

  const loadAccountDetails = useCallback(async (accountId: string) => {
    setIsLoadingSubData(true);
    try {
      const [detailRes, empRes, batchesRes] = await Promise.all([
        fetch(`/api/v1/admin/corporate-accounts/${accountId}`),
        fetch(`/api/v1/admin/corporate-accounts/${accountId}/employees`),
        fetch(`/api/v1/admin/corporate-accounts/${accountId}/employees/import/batches`),
      ]);

      const detailData = await detailRes.json();
      const empData = await empRes.json();
      const batchesData = await batchesRes.json();

      if (detailData.success) {
        setSelectedAccount(detailData.account);
        setContacts(detailData.contacts || []);
        setMembers(detailData.members || []);
      }
      if (empData.success) {
        setEmployees(empData.items || []);
      }
      if (batchesData.success) {
        setImportBatches(batchesData.items || []);
      }
    } catch (err: any) {
      notifyError(err.message || "Failed to load account details.");
    } finally {
      setIsLoadingSubData(false);
    }
  }, []);

  const handleSelectAccount = (account: CorporateAccount) => {
    setSelectedAccount(account);
    setActiveSubTab("ROSTER");
    loadAccountDetails(account.id);
  };

  // ─── Actions: Register Account ─────────────────────────────────────────────

  const handleRegisterAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regLegalName.trim()) {
      notifyError("Legal name is required.");
      return;
    }

    try {
      const res = await fetch("/api/v1/admin/corporate-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_name: regLegalName.trim(),
          trade_name: regTradeName.trim() || undefined,
          gstin: regGstin.trim().toUpperCase() || undefined,
          pan: regPan.trim().toUpperCase() || undefined,
          primary_contact: regContactName.trim()
            ? {
                name: regContactName.trim(),
                email: regContactEmail.trim(),
                phone: regContactPhone.trim(),
                designation: regContactDesignation.trim(),
              }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Account creation failed.");
      }

      notifySuccess(`Corporate account '${data.account.legal_name}' created with status PENDING.`);
      setShowRegisterModal(false);
      setRegLegalName("");
      setRegTradeName("");
      setRegGstin("");
      setRegPan("");
      setRegContactName("");
      setRegContactEmail("");
      setRegContactPhone("");
      await loadAccounts();
      if (data.account) handleSelectAccount(data.account);
    } catch (err: any) {
      notifyError(err.message || "Error registering corporate account.");
    }
  };

  // ─── Actions: Approve Account (Four-Eyes Enforcement) ──────────────────────

  const handleApproveAccount = async () => {
    if (!selectedAccount) return;
    try {
      const res = await fetch(`/api/v1/admin/corporate-accounts/${selectedAccount.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Account approval failed.");
      }

      notifySuccess(`Account approved successfully. Current status: APPROVED.`);
      setShowApprovalModal(false);
      loadAccounts();
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Approval error. Creator cannot approve own account.");
    }
  };

  // ─── Actions: Status Lifecycle (Suspend / Reactivate) ──────────────────────

  const handleSuspendAccount = async () => {
    if (!selectedAccount || !actionReason.trim()) {
      notifyError("Suspension reason is mandatory.");
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/corporate-accounts/${selectedAccount.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: actionReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Suspension failed.");

      notifySuccess("Account has been suspended.");
      setShowSuspendModal(false);
      setActionReason("");
      loadAccounts();
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Error suspending account.");
    }
  };

  const handleReactivateAccount = async () => {
    if (!selectedAccount || !actionReason.trim()) {
      notifyError("Reactivation reason is mandatory.");
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/corporate-accounts/${selectedAccount.id}/reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: actionReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Reactivation failed.");

      notifySuccess("Account reactivated. Status: APPROVED.");
      setShowReactivateModal(false);
      setActionReason("");
      loadAccounts();
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Error reactivating account.");
    }
  };

  // ─── Actions: Credit Governance ────────────────────────────────────────────

  const handleCreditRequest = async () => {
    if (!selectedAccount) return;
    try {
      const res = await fetch(`/api/v1/admin/corporate-accounts/${selectedAccount.id}/credit-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditLimit: parseFloat(creditLimitInput),
          termsDays: parseInt(termsDaysInput, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Credit request failed.");

      notifySuccess(`Credit request recorded for ₹${parseFloat(creditLimitInput).toLocaleString("en-IN")}.`);
      setShowCreditRequestModal(false);
      loadAccounts();
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Error recording credit request.");
    }
  };

  const handleCreditActivation = async () => {
    if (!selectedAccount) return;
    try {
      const res = await fetch(`/api/v1/admin/corporate-accounts/${selectedAccount.id}/credit-activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditLimit: parseFloat(creditLimitInput),
          paymentTermsDays: parseInt(termsDaysInput, 10),
          notes: actionReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Credit activation failed.");

      notifySuccess(`Decision Q1: Corporate credit successfully activated by Super Admin.`);
      setShowCreditActivationModal(false);
      setActionReason("");
      loadAccounts();
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Credit activation requires Super Admin & APPROVED account.");
    }
  };

  // ─── Actions: Employee Roster CRUD ─────────────────────────────────────────

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !empCode.trim() || !empName.trim() || !empPhone.trim()) {
      notifyError("Employee code, full name, and phone are mandatory.");
      return;
    }
    try {
      const res = await fetch(`/api/v1/admin/corporate-accounts/${selectedAccount.id}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_code: empCode.trim(),
          full_name: empName.trim(),
          phone: empPhone.trim(),
          email: empEmail.trim() || undefined,
          department: empDept.trim() || undefined,
          designation: empDesig.trim() || undefined,
          default_latitude: empLat ? parseFloat(empLat) : undefined,
          default_longitude: empLng ? parseFloat(empLng) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Employee creation failed.");

      notifySuccess(`Employee ${data.employee.employee_code} added to roster.`);
      setShowAddEmployeeModal(false);
      setEmpCode("");
      setEmpName("");
      setEmpPhone("");
      setEmpEmail("");
      setEmpDept("");
      setEmpDesig("");
      setEmpLat("");
      setEmpLng("");
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Failed to create employee.");
    }
  };

  const handleDeactivateEmployee = async () => {
    if (!selectedAccount || !targetEmployee || !actionReason.trim()) {
      notifyError("Reason for deactivation is mandatory.");
      return;
    }
    try {
      const res = await fetch(
        `/api/v1/admin/corporate-accounts/${selectedAccount.id}/employees/${targetEmployee.id}/deactivate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: actionReason.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Deactivation failed.");

      notifySuccess(`Employee ${targetEmployee.employee_code} deactivated.`);
      setShowDeactivateEmployeeModal(false);
      setTargetEmployee(null);
      setActionReason("");
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Error deactivating employee.");
    }
  };

  const handleReactivateEmployee = async () => {
    if (!selectedAccount || !targetEmployee || !actionReason.trim()) {
      notifyError("Reason for reactivation is mandatory.");
      return;
    }
    try {
      const res = await fetch(
        `/api/v1/admin/corporate-accounts/${selectedAccount.id}/employees/${targetEmployee.id}/reactivate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: actionReason.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Reactivation failed.");

      notifySuccess(`Employee ${targetEmployee.employee_code} reactivated with existing ID.`);
      setShowReactivateEmployeeModal(false);
      setTargetEmployee(null);
      setActionReason("");
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Error reactivating employee.");
    }
  };

  const handleVerifyCoordinates = async (emp: CorporateEmployee) => {
    if (!selectedAccount) return;
    try {
      const res = await fetch(
        `/api/v1/admin/corporate-accounts/${selectedAccount.id}/employees/${emp.id}/verify-coordinates`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Coordinate verification failed.");

      notifySuccess(`Coordinates verified for ${emp.employee_code}.`);
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Only Super Admin can verify employee coordinates.");
    }
  };

  // ─── Actions: Bulk Roster Import Wizard ────────────────────────────────────

  const handleDownloadTemplate = () => {
    if (!selectedAccount) return;
    window.open(`/api/v1/admin/corporate-accounts/${selectedAccount.id}/employees/import/template`, "_blank");
  };

  const handleValidateImport = async () => {
    if (!selectedAccount || !importFile) {
      notifyError("Please select a .xlsx file to validate.");
      return;
    }
    setIsValidatingImport(true);
    setValidationReport(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch(
        `/api/v1/admin/corporate-accounts/${selectedAccount.id}/employees/import/validate`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Validation failed.");

      setValidationReport(data.result);
      if (data.result.isValid) {
        notifySuccess(`Workbook validated: ${data.result.validRows} valid rows ready for commit.`);
      } else {
        notifyError(`Validation detected ${data.result.invalidRows} errors. Review diagnostics below.`);
      }
    } catch (err: any) {
      notifyError(err.message || "Dry-run validation failed.");
    } finally {
      setIsValidatingImport(false);
    }
  };

  const handleCommitImport = async () => {
    if (!selectedAccount || !importFile || !validationReport?.isValid) {
      notifyError("Cannot commit: Please run a successful validation first.");
      return;
    }
    setIsCommittingImport(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const res = await fetch(
        `/api/v1/admin/corporate-accounts/${selectedAccount.id}/employees/import/commit`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Commit failed.");

      notifySuccess(`Roster batch committed: ${data.committedCount} employees created atomically.`);
      setShowImportModal(false);
      setImportFile(null);
      setValidationReport(null);
      loadAccountDetails(selectedAccount.id);
    } catch (err: any) {
      notifyError(err.message || "Import commit failed or replay protection triggered.");
    } finally {
      setIsCommittingImport(false);
    }
  };

  // ─── Filtered Accounts ─────────────────────────────────────────────────────

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchesStatus = statusFilter === "ALL" || acc.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        acc.legal_name.toLowerCase().includes(q) ||
        (acc.trade_name && acc.trade_name.toLowerCase().includes(q)) ||
        (acc.gstin && acc.gstin.toLowerCase().includes(q)) ||
        (acc.pan && acc.pan.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [accounts, statusFilter, searchQuery]);

  // ─── Render UI ─────────────────────────────────────────────────────────────

  return (
    <WidgetErrorBoundary>
      <div className="w-full space-y-6">
        {/* Banner Notifications */}
        {errorBanner && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="text-sm font-semibold">{errorBanner}</p>
            </div>
            <button onClick={() => setErrorBanner(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successBanner && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold">{successBanner}</p>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top Header & Metrics */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  Corporate Account Master & Roster
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage institutional accounts, 4-eyes approval governance, and employee delivery rosters.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadAccounts}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-2 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#1D2F5D] hover:bg-[#152347] text-white flex items-center gap-2 shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Register Account
            </button>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">Total Accounts</span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{accounts.length}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-amber-600 font-medium">Pending Approval</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">
              {accounts.filter((a) => a.status === "PENDING").length}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-emerald-600 font-medium">Approved & Active</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {accounts.filter((a) => a.status === "APPROVED").length}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">Suspended / Closed</span>
            <div className="text-2xl font-bold text-slate-500 mt-1">
              {accounts.filter((a) => a.status === "SUSPENDED" || a.status === "CLOSED").length}
            </div>
          </div>
        </div>

        {/* Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Account Directory */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Accounts Directory ({filteredAccounts.length})
                </span>
              </div>

              {/* Search & Filter */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search name, GSTIN, PAN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#1D2F5D]"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                {["ALL", "PENDING", "APPROVED", "SUSPENDED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition shrink-0 ${
                      statusFilter === st
                        ? "bg-[#1D2F5D] text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1 scrollbar-thin">
                {filteredAccounts.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">No accounts match filter.</div>
                ) : (
                  filteredAccounts.map((acc) => {
                    const isSelected = selectedAccount?.id === acc.id;
                    return (
                      <div
                        key={acc.id}
                        onClick={() => handleSelectAccount(acc)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between gap-3 ${
                          isSelected
                            ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 shadow-xs"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {acc.legal_name}
                          </p>
                          {acc.trade_name && (
                            <p className="text-[11px] text-slate-500 truncate">{acc.trade_name}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                            {acc.gstin && <span>GST: {acc.gstin}</span>}
                            {acc.pan && <span>PAN: {acc.pan}</span>}
                          </div>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                              acc.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                                : acc.status === "PENDING"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400"
                                : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400"
                            }`}
                          >
                            {acc.status}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Account Workspace & Sub-Resources */}
          <div className="lg:col-span-8">
            {!selectedAccount ? (
              <div className="bg-white dark:bg-slate-900 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center min-h-[400px]">
                <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Select an account from directory
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  View master details, execute four-eyes approvals, manage employee rosters, and run bulk imports.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Account Profile Header Card */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          {selectedAccount.legal_name}
                        </h2>
                        <span
                          className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase ${
                            selectedAccount.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : selectedAccount.status === "PENDING"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {selectedAccount.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ID: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedAccount.id}</span> • Customer UID:{" "}
                        <span className="font-mono text-slate-700 dark:text-slate-300">{selectedAccount.customer_id}</span>
                      </p>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedAccount.status === "PENDING" && (
                        <button
                          onClick={() => setShowApprovalModal(true)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Approve Account
                        </button>
                      )}
                      {selectedAccount.status === "APPROVED" && (
                        <>
                          <button
                            onClick={() => setShowCreditActivationModal(true)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Credit Activation (Q1)
                          </button>
                          <button
                            onClick={() => setShowSuspendModal(true)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                          >
                            Suspend
                          </button>
                        </>
                      )}
                      {selectedAccount.status === "SUSPENDED" && (
                        <button
                          onClick={() => setShowReactivateModal(true)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Account Metadata Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">GSTIN</span>
                      <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedAccount.gstin || "Unregistered"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">PAN</span>
                      <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedAccount.pan || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Credit Requested</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedAccount.credit_requested_limit
                          ? `₹${Number(selectedAccount.credit_requested_limit).toLocaleString("en-IN")}`
                          : "None"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Registered On</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {new Date(selectedAccount.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <button
                    onClick={() => setActiveSubTab("ROSTER")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                      activeSubTab === "ROSTER"
                        ? "bg-[#1D2F5D] text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Employee Roster ({employees.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab("IMPORTS")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                      activeSubTab === "IMPORTS"
                        ? "bg-[#1D2F5D] text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    Bulk Imports ({importBatches.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab("CONTACTS")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                      activeSubTab === "CONTACTS"
                        ? "bg-[#1D2F5D] text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Contacts ({contacts.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab("MEMBERS")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                      activeSubTab === "MEMBERS"
                        ? "bg-[#1D2F5D] text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Scoped Members ({members.length})
                  </button>
                  <button
                    onClick={() => setActiveSubTab("CREDIT")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition flex items-center gap-1.5 ${
                      activeSubTab === "CREDIT"
                        ? "bg-[#1D2F5D] text-white"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Credit Governance
                  </button>
                </div>

                {/* Sub-Tab 1: Employee Roster */}
                {activeSubTab === "ROSTER" && (
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Roster Records & Delivery Addresses
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Non-privileged viewers receive masked phone/email data. Re-joining employees are reactivated with same ID.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowImportModal(true)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          Bulk Import
                        </button>
                        <button
                          onClick={() => setShowAddEmployeeModal(true)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#1D2F5D] hover:bg-[#152347] text-white flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Employee
                        </button>
                      </div>
                    </div>

                    {/* Employees Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Code</th>
                            <th className="py-2.5 px-3">Full Name</th>
                            <th className="py-2.5 px-3">Phone</th>
                            <th className="py-2.5 px-3">Email</th>
                            <th className="py-2.5 px-3">Dept / Desig</th>
                            <th className="py-2.5 px-3">Coordinates</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {employees.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                                No employees enrolled yet. Use 'Add Employee' or 'Bulk Import' to populate roster.
                              </td>
                            </tr>
                          ) : (
                            employees.map((emp) => (
                              <tr key={emp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                  {emp.employee_code}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                  {emp.full_name}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                                  {emp.phone}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">{emp.email || "—"}</td>
                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                  {emp.department || "—"}
                                  {emp.designation && <span className="text-slate-400"> • {emp.designation}</span>}
                                </td>
                                <td className="py-2.5 px-3">
                                  {emp.default_latitude ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-[10px] text-slate-600">
                                        {Number(emp.default_latitude).toFixed(2)}, {emp.default_longitude ? Number(emp.default_longitude).toFixed(2) : ""}
                                      </span>
                                      {emp.coordinate_verified ? (
                                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-emerald-100 text-emerald-800">
                                          Verified
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => handleVerifyCoordinates(emp)}
                                          title="Verify coordinates as Super Admin"
                                          className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200"
                                        >
                                          Verify
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">No Coords</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                      emp.status === "ACTIVE"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                                    }`}
                                  >
                                    {emp.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {emp.status === "ACTIVE" ? (
                                    <button
                                      onClick={() => {
                                        setTargetEmployee(emp);
                                        setShowDeactivateEmployeeModal(true);
                                      }}
                                      className="text-red-600 hover:text-red-800 font-semibold text-[11px]"
                                    >
                                      Deactivate
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setTargetEmployee(emp);
                                        setShowReactivateEmployeeModal(true);
                                      }}
                                      className="text-emerald-600 hover:text-emerald-800 font-semibold text-[11px]"
                                    >
                                      Reactivate
                                    </button>
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

                {/* Sub-Tab 2: Bulk Imports */}
                {activeSubTab === "IMPORTS" && (
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Roster Excel Import Batches
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Replay-protected SHA-256 batch history. Batches execute atomically with duplicate prevention.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDownloadTemplate}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Template (.xlsx)
                        </button>
                        <button
                          onClick={() => setShowImportModal(true)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#1D2F5D] hover:bg-[#152347] text-white flex items-center gap-1.5"
                        >
                          <UploadCloud className="w-3.5 h-3.5" />
                          New Import
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {importBatches.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          No roster import batches submitted yet.
                        </div>
                      ) : (
                        importBatches.map((batch) => (
                          <div
                            key={batch.id}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-slate-900 dark:text-white">{batch.filename}</span>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                    batch.status === "COMMITTED"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {batch.status}
                                </span>
                              </div>
                              <p className="font-mono text-[10px] text-slate-400 mt-1">
                                Hash: {batch.file_hash} • Created By: {batch.created_by}
                              </p>
                            </div>
                            <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 text-[11px]">
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white">{batch.valid_rows}</span>{" "}
                                valid
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white">{batch.duplicate_rows}</span>{" "}
                                duplicates
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white">{batch.phone_reuse_count}</span>{" "}
                                phone reuses
                              </div>
                              <div className="text-slate-400">{new Date(batch.created_at).toLocaleDateString()}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-Tab 3: Contacts */}
                {activeSubTab === "CONTACTS" && (
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Corporate Contacts</h3>
                        <p className="text-[11px] text-slate-500">
                          Exactly one active PRIMARY contact is enforced per corporate account.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAddContactModal(true)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#1D2F5D] text-white flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Contact
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {contacts.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">{c.name}</span>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 text-indigo-800">
                              {c.contact_type}
                            </span>
                          </div>
                          <p className="text-slate-500">{c.designation || "Designation unspecified"}</p>
                          <div className="pt-2 text-slate-600 dark:text-slate-400 space-y-1 text-[11px]">
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{c.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{c.phone}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-Tab 4: Scoped Members */}
                {activeSubTab === "MEMBERS" && (
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delegated Staff Membership</h3>
                        <p className="text-[11px] text-slate-500">
                          Scoped members have ROSTER_MANAGER or ROSTER_VIEWER authority restricted strictly to this account.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAddMemberModal(true)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#1D2F5D] text-white flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Grant Membership
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {members.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">
                          No delegated account members granted yet.
                        </div>
                      ) : (
                        members.map((m) => (
                          <div key={m.id} className="py-3 flex items-center justify-between text-xs">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 dark:text-white">{m.user_id}</span>
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 text-indigo-800">
                                  {m.member_role}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Granted by {m.granted_by} on {new Date(m.granted_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                m.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Sub-Tab 5: Credit Governance */}
                {activeSubTab === "CREDIT" && (
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Corporate Credit Governance (Decision Q1)
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Locked Policy: Credit limit and terms live authoritatively on canonical customer. Corporate account stores credit requests only. Credit activation requires Super Admin authority and an APPROVED account.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-2">
                        <span className="text-xs font-semibold text-slate-500">Requested Credit Terms</span>
                        <div className="text-xl font-bold text-slate-900 dark:text-white">
                          ₹{Number(selectedAccount.credit_requested_limit || 0).toLocaleString("en-IN")}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Payment Terms: {selectedAccount.credit_requested_terms_days || 30} days
                        </p>
                        <button
                          onClick={() => setShowCreditRequestModal(true)}
                          className="mt-2 w-full py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300"
                        >
                          Update Credit Request
                        </button>
                      </div>

                      <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          Super Admin Credit Activation
                        </span>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          Delegates atomically to BillsReceivableService.approveCorporateCredit with four-eyes audit.
                        </div>
                        <button
                          onClick={() => setShowCreditActivationModal(true)}
                          className="mt-3 w-full py-2 text-xs font-semibold rounded-lg bg-[#1D2F5D] text-white hover:bg-[#152347]"
                        >
                          Activate Corporate Credit
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ─── MODAL 1: Register Account ─────────────────────────────────────── */}
        {showRegisterModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Register Corporate Account Master</h3>
                <button onClick={() => setShowRegisterModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRegisterAccount} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                    Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tata Consultancy Services Ltd"
                    value={regLegalName}
                    onChange={(e) => setRegLegalName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-[#1D2F5D]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">Trade Name</label>
                  <input
                    type="text"
                    placeholder="e.g. TCS Global"
                    value={regTradeName}
                    onChange={(e) => setRegTradeName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">GSTIN (15 Digits)</label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="29AABCT1332L1ZV"
                      value={regGstin}
                      onChange={(e) => setRegGstin(e.target.value)}
                      className="w-full px-3 py-2 font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">PAN (10 Digits)</label>
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="AABCT1332L"
                      value={regPan}
                      onChange={(e) => setRegPan(e.target.value)}
                      className="w-full px-3 py-2 font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-200">Primary Contact Person</span>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <input
                        type="text"
                        placeholder="Contact Name"
                        value={regContactName}
                        onChange={(e) => setRegContactName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Designation"
                        value={regContactDesignation}
                        onChange={(e) => setRegContactDesignation(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="email"
                        placeholder="Email"
                        value={regContactEmail}
                        onChange={(e) => setRegContactEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                      />
                    </div>
                    <div>
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={regContactPhone}
                        onChange={(e) => setRegContactPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#1D2F5D] hover:bg-[#152347] text-white font-semibold"
                  >
                    Create Draft Master
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 2: Four-Eyes Approval ───────────────────────────────────── */}
        {showApprovalModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
              <div className="flex items-center gap-3 text-emerald-600">
                <ShieldCheck className="w-6 h-6 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Four-Eyes Approval: Corporate Account
                </h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                You are about to approve corporate account <span className="font-bold text-slate-900 dark:text-white">'{selectedAccount?.legal_name}'</span>.
              </p>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                <p className="font-bold">🔒 Segregation of Duties Enforcement:</p>
                <p>The creator of the draft cannot approve the account. Must be executed by an authorized Super Admin.</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowApprovalModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveAccount}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Confirm Four-Eyes Approval
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 3: Bulk Roster Import Wizard ─────────────────────────────── */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 space-y-4 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Bulk Employee Roster Import Wizard
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Import Excel roster (.xlsx) with dry-run validation, duplicate checks, and replay protection.
                  </p>
                </div>
                <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step 1: Template & Upload */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">Step 1: Download Standard Template</span>
                    <p className="text-[11px] text-slate-500">Includes exact column schema, coordinate bounding rules, and formats.</p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>

                <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                  <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                  <div>
                    <label className="font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                      <span>Click to select workbook (.xlsx)</span>
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={(e) => {
                          if (e.target.files?.[0]) setImportFile(e.target.files[0]);
                        }}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">Maximum file size: 10MB.</p>
                  </div>
                  {importFile && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              </div>

              {/* Dry-run validation trigger */}
              <div className="flex items-center justify-between pt-2">
                <button
                  disabled={!importFile || isValidatingImport}
                  onClick={handleValidateImport}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isValidatingImport ? "animate-spin" : ""}`} />
                  {isValidatingImport ? "Executing Dry-Run..." : "Step 2: Validate Workbook (Read-Only)"}
                </button>
              </div>

              {/* Step 3: Diagnostic Report */}
              {validationReport && (
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                      <span className="text-[10px] text-slate-400">Total Rows</span>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{validationReport.totalRows}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-800">
                      <span className="text-[10px]">Valid</span>
                      <div className="font-bold">{validationReport.validRows}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-red-50 text-red-800">
                      <span className="text-[10px]">Invalid Errors</span>
                      <div className="font-bold">{validationReport.invalidRows}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50 text-amber-800">
                      <span className="text-[10px]">Phone Reuses</span>
                      <div className="font-bold">{validationReport.phoneReuseCount}</div>
                    </div>
                  </div>

                  {/* Errors table */}
                  {validationReport.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-red-200 bg-red-50/50 p-2 text-[11px] space-y-1">
                      <div className="font-bold text-red-800">Row Errors (Must fix before commit):</div>
                      {validationReport.errors.map((err, i) => (
                        <div key={i} className="text-red-700 flex items-start gap-1.5">
                          <span>•</span>
                          <span>
                            Row {err.rowNumber}: {err.reason} {err.employeeCode && `(${err.employeeCode})`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Commit action */}
                  <div className="pt-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-400">
                      SHA-256: {validationReport.fileHash.slice(0, 16)}...
                    </span>
                    <button
                      disabled={!validationReport.isValid || isCommittingImport}
                      onClick={handleCommitImport}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 disabled:opacity-50 shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      {isCommittingImport ? "Committing Roster..." : "Step 3: Commit Import Batch"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MODAL 4: Credit Activation (Decision Q1) ──────────────────────── */}
        {showCreditActivationModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
              <div className="flex items-center gap-2.5 text-indigo-600">
                <CreditCard className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Activate Corporate Credit (Decision Q1)
                </h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Authorize corporate credit facilities for <span className="font-bold text-slate-900 dark:text-white">'{selectedAccount?.legal_name}'</span>.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Approved Credit Limit (INR)</label>
                  <input
                    type="number"
                    value={creditLimitInput}
                    onChange={(e) => setCreditLimitInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Payment Terms (Days)</label>
                  <input
                    type="number"
                    value={termsDaysInput}
                    onChange={(e) => setTermsDaysInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Credit Approval Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Risk assessment and financial statements verified."
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowCreditActivationModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreditActivation}
                  className="px-4 py-2 rounded-xl bg-[#1D2F5D] hover:bg-[#152347] text-white font-bold"
                >
                  Authorize Credit Limit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 5: Add Employee Modal ───────────────────────────────────── */}
        {showAddEmployeeModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Enroll Employee to Roster</h3>
                <button onClick={() => setShowAddEmployeeModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateEmployee} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Employee Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EMP-101"
                      value={empCode}
                      onChange={(e) => setEmpCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Anita Desai"
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Phone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="9876543210"
                      value={empPhone}
                      onChange={(e) => setEmpPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="anita@corp.com"
                      value={empEmail}
                      onChange={(e) => setEmpEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="Engineering"
                      value={empDept}
                      onChange={(e) => setEmpDept(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Designation</label>
                    <input
                      type="text"
                      placeholder="Lead Architect"
                      value={empDesig}
                      onChange={(e) => setEmpDesig(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Latitude (6° to 38°N)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="12.9716"
                      value={empLat}
                      onChange={(e) => setEmpLat(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Longitude (68° to 98°E)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="77.5946"
                      value={empLng}
                      onChange={(e) => setEmpLng(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddEmployeeModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#1D2F5D] hover:bg-[#152347] text-white font-semibold"
                  >
                    Enroll Employee
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL 6: Deactivate Employee ──────────────────────────────────── */}
        {showDeactivateEmployeeModal && targetEmployee && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4 shadow-xl text-xs">
              <div className="flex items-center gap-2 text-red-600">
                <UserX className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Deactivate Employee</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Deactivate <span className="font-bold text-slate-900 dark:text-white">{targetEmployee.full_name}</span> ({targetEmployee.employee_code}). Record is preserved in history; hard deletes are strictly blocked.
              </p>
              <div>
                <label className="block font-semibold mb-1">Reason for Deactivation *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Resigned / Sabbatical"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowDeactivateEmployeeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivateEmployee}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  Confirm Deactivation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 7: Reactivate Employee ──────────────────────────────────── */}
        {showReactivateEmployeeModal && targetEmployee && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6 space-y-4 shadow-xl text-xs">
              <div className="flex items-center gap-2 text-emerald-600">
                <UserCheck className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reactivate / Rehire Employee</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                Reactivate <span className="font-bold text-slate-900 dark:text-white">{targetEmployee.full_name}</span> ({targetEmployee.employee_code}). The employee retains their original persistent identifier.
              </p>
              <div>
                <label className="block font-semibold mb-1">Reason for Reactivation *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rejoined organization"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowReactivateEmployeeModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReactivateEmployee}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Confirm Reactivation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WidgetErrorBoundary>
  );
}
export default CorporateAccountsPanel;
