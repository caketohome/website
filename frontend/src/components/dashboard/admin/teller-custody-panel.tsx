"use client";

/**
 * CakeToHome ERP — Phase C4.2: Teller Cash Custody & Shift Operations Panel
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. STRICT CASH CUSTODY ONLY — NO POS / RETAIL CHECKOUT:
 *    - Designed for cash drawer float custody, physical counts, supervisor verification, and GL settlement.
 *    - Zero retail barcode checkout, itemized sales billing, or customer invoice printing.
 * 2. SERVER-SIDE FINANCIAL AUTHORITATIVE TRUTH:
 *    - All double-entry voucher logic (Shortage Dr 5296/Cr 1111, Excess Dr 1111/Cr 5296, Zero Variance)
 *      is executed by server-side C4.1 APIs.
 * 3. 3-TIER SEGREGATION OF DUTIES (SoD):
 *    - Opener != Count Verifier != Settler. Visual indicators and disabled gates prevent self-approval.
 */

import React, { useState, useEffect, useCallback, memo } from "react";
import {
  Wallet,
  Clock,
  Landmark,
  Building,
  RefreshCw,
  FileCheck2,
  AlertCircle,
  Layers,
  ArrowRight,
  Coins,
} from "lucide-react";
import type {
  TellerRow,
  TellerSessionRow,
  TellerMovementRow,
} from "@frontend/lib/types/teller.types";
import { WidgetErrorBoundary } from "./error-boundary";
import { ActiveDrawerTab } from "./teller/ActiveDrawerTab";
import { VerificationSettlementQueueTab } from "./teller/VerificationSettlementQueueTab";
import { SessionHistoryTab } from "./teller/SessionHistoryTab";
import { TellerMasterTab } from "./teller/TellerMasterTab";
import { BranchCashTab } from "./teller/BranchCashTab";

type SubTabId = "active_drawer" | "work_queue" | "history" | "stations" | "branch_cash";

export const TellerCustodyPanel = memo(function TellerCustodyPanel() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("branch_cash");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User auth context from cookie
  // User auth context from cookie
  const [user, setUser] = useState<{ userId: string; role: string; branchId?: string } | null>(null);

  // Master Data
  const [branches, setBranches] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [tellers, setTellers] = useState<TellerRow[]>([]);
  const [activeTeller, setActiveTeller] = useState<TellerRow | null>(null);

  // Session Data
  const [activeSession, setActiveSession] = useState<TellerSessionRow | null>(null);
  const [movements, setMovements] = useState<TellerMovementRow[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [allSessions, setAllSessions] = useState<TellerSessionRow[]>([]);

  // Resolve user identity from cookies
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cookies = document.cookie.split(";").reduce((acc: any, c) => {
        const [k, ...v] = c.trim().split("=");
        if (k) acc[k] = decodeURIComponent(v.join("="));
        return acc;
      }, {});

      const role = (cookies["_cth_role"] || "SUPER_ADMIN").toUpperCase();
      const userId = cookies["_cth_user_id"] || "admin_01";
      const branchId = cookies["_cth_branch_id"] || "";
      setUser({ role, userId, branchId });

      if (branchId) {
        setSelectedBranchId(branchId);
      }

      const subtabParam = new URLSearchParams(window.location.search).get("subtab") as SubTabId;
      if (subtabParam && ["active_drawer", "work_queue", "history", "stations", "branch_cash"].includes(subtabParam)) {
        setActiveSubTab(subtabParam);
      }
    }
  }, []);

  // Fetch branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await fetch("/api/v1/admin/branches?limit=100");
        const data = await res.json();
        if (data.branches && data.branches.length > 0) {
          setBranches(data.branches);
          setSelectedBranchId((current) => {
            if (current) return current;
            if (user?.branchId) {
              const matched = data.branches.find((b: any) => b.id === user.branchId);
              if (matched) return matched.id;
            }
            return data.branches[0].id;
          });
        }
      } catch (err: any) {
        console.error("Failed to load branches:", err);
      }
    }
    loadBranches();
  }, [user?.branchId]);

  // Fetch tellers for selected branch
  const loadTellers = useCallback(async () => {
    if (!selectedBranchId) return;
    try {
      const res = await fetch(`/api/v1/admin/tellers?branch_id=${selectedBranchId}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.tellers)) {
        setTellers(data.tellers);
        // Default to active user's teller, or first teller (which is now guaranteed by ensureDefaultBranchTeller)
        if (data.tellers.length > 0) {
          const matchingUserTeller = data.tellers.find((t: TellerRow) => t.user_id === user?.userId);
          setActiveTeller(matchingUserTeller || data.tellers[0]);
        } else {
          setActiveTeller(null);
        }
      }
    } catch (err: any) {
      console.error("Failed to load tellers:", err);
    }
  }, [selectedBranchId, user?.userId]);

  useEffect(() => {
    loadTellers();
  }, [loadTellers]);

  // Fetch active session and all sessions
  const loadSessionsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch active session for the active counter station or branch
      const activeUrl = activeTeller
        ? `/api/v1/admin/teller/sessions/active?teller_id=${activeTeller.id}`
        : selectedBranchId
        ? `/api/v1/admin/teller/sessions/active?branch_id=${selectedBranchId}`
        : "/api/v1/admin/teller/sessions/active";

      const activeRes = await fetch(activeUrl);
      const activeData = await activeRes.json();
      if (activeData.success) {
        setActiveSession(activeData.session || null);
      }

      // 2. Fetch all sessions for work queue and history
      const listParams = new URLSearchParams();
      // If branch manager, restrict to assigned branch; if admin, load company-wide sessions
      if (selectedBranchId && user?.role === "BRANCH_MANAGER") {
        listParams.set("branch_id", selectedBranchId);
      }
      listParams.set("limit", "100");

      const listRes = await fetch(`/api/v1/admin/teller/sessions?${listParams.toString()}`);
      const listData = await listRes.json();
      if (listData.success && Array.isArray(listData.sessions)) {
        setAllSessions(listData.sessions);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load teller sessions data.");
    } finally {
      setLoading(false);
    }
  }, [activeTeller, selectedBranchId, user?.role]);

  useEffect(() => {
    loadSessionsData();
  }, [loadSessionsData]);

  // Fetch movements for active session or continuous branch custody
  const loadMovements = useCallback(async () => {
    setLoadingMovements(true);
    try {
      if (activeSession) {
        const res = await fetch(`/api/v1/admin/teller/sessions/${activeSession.id}/movements`);
        const data = await res.json();
        if (data.success && Array.isArray(data.movements)) {
          setMovements(data.movements);
        } else {
          setMovements([]);
        }
      } else if (selectedBranchId) {
        const res = await fetch(`/api/v1/admin/teller/movements?branch_id=${selectedBranchId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.movements)) {
          setMovements(data.movements);
        } else {
          setMovements([]);
        }
      } else {
        setMovements([]);
      }
    } catch (err) {
      console.error("Failed to load movements:", err);
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  }, [activeSession, selectedBranchId]);

  useEffect(() => {
    loadMovements();
  }, [loadMovements]);

  // Handle changing selected teller counter
  const handleSelectTeller = (tellerId: string) => {
    const found = tellers.find((t) => t.id === tellerId);
    if (found) {
      setActiveTeller(found);
    }
  };

  // Queue counts for notification badges
  const pendingCount = allSessions.filter(
    (s) => s.status === "CLOSING" || s.status === "PENDING_VERIFICATION"
  ).length;

  return (
    <WidgetErrorBoundary>
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <Wallet className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Teller Cash Custody & Shift Operations
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Cash drawer float custody, physical counts, supervisor verification, and general ledger settlement.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadTellers();
                loadSessionsData();
                loadMovements();
              }}
              disabled={loading}
              className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-bold">Error loading teller custody workspace</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* Sub-Tab Navigation Bar */}
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab("branch_cash")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeSubTab === "branch_cash"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Branch Cash Custody & Position</span>
          </button>

          <button
            onClick={() => setActiveSubTab("active_drawer")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeSubTab === "active_drawer"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Counter Till / Drawer</span>
            {activeSession?.status === "OPEN" && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("work_queue")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeSubTab === "work_queue"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Verification & Settlement Queue</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-brand-light text-brand-navy border border-brand-primary/30">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab("history")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeSubTab === "history"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Session Audit History</span>
          </button>

          <button
            onClick={() => setActiveSubTab("stations")}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeSubTab === "stations"
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Counter Stations</span>
          </button>
        </div>

        {/* Tab Content Rendering */}
        {activeSubTab === "active_drawer" && (
          <ActiveDrawerTab
            activeSession={activeSession}
            activeTeller={activeTeller}
            tellers={tellers}
            branches={branches}
            selectedBranchId={selectedBranchId}
            onSelectBranch={setSelectedBranchId}
            onSelectTeller={handleSelectTeller}
            movements={movements}
            loadingMovements={loadingMovements}
            onRefreshMovements={loadMovements}
            onSessionChanged={() => {
              loadSessionsData();
              loadMovements();
            }}
            onNavigateToWorkQueue={() => setActiveSubTab("work_queue")}
            userRole={user?.role}
            userId={user?.userId}
          />
        )}

        {activeSubTab === "work_queue" && (
          <VerificationSettlementQueueTab
            sessions={allSessions}
            loading={loading}
            onRefresh={loadSessionsData}
            currentUserId={user?.userId}
            userRole={user?.role}
          />
        )}

        {activeSubTab === "history" && (
          <SessionHistoryTab
            sessions={allSessions}
            loading={loading}
            onRefresh={loadSessionsData}
            branches={branches}
            selectedBranchId={selectedBranchId}
            onSelectBranch={setSelectedBranchId}
          />
        )}

        {activeSubTab === "stations" && (
          <TellerMasterTab
            tellers={tellers}
            loading={loading}
            onRefresh={loadTellers}
            branches={branches}
            selectedBranchId={selectedBranchId}
            onSelectBranch={setSelectedBranchId}
          />
        )}

        {activeSubTab === "branch_cash" && (
          <BranchCashTab />
        )}
      </div>
    </WidgetErrorBoundary>
  );
});

export default TellerCustodyPanel;
