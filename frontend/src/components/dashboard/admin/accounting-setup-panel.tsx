"use client";

/**
 * CakeToHome ERP — Accounting Setup Panel
 * Phase 5A.2: Fiscal Period Management, Accounting Start Date, and Opening Balance Workflow
 *
 * This panel provides the controlled UI for:
 * 1. Setting the accounting start date
 * 2. Generating/managing fiscal periods
 * 3. Viewing opening balance status (does NOT auto-post opening balances)
 *
 * CRITICAL: This panel does NOT fabricate or seed any opening balances.
 * Opening balances should only be entered when the business has supplied
 * authoritative opening figures.
 */

import { useState, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AccountingConfig {
  accounting_start_date: string | null;
  is_configured: boolean;
  is_immutable: boolean;
}

interface FiscalPeriod {
  id: string;
  fiscal_year: string;
  period_name: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
}

interface OpeningBalanceAccount {
  account_id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  has_opening_balance: boolean;
  opening_debit: number;
  opening_credit: number;
}

// ─── API Helpers ───────────────────────────────────────────────────────────────

async function fetchApi(path: string, options?: RequestInit) {
  let token: string | null = null;
  if (typeof window !== "undefined") {
    token = localStorage.getItem("cth_access_token")
      || localStorage.getItem("cth_admin_token")
      || localStorage.getItem("admin_token")
      || localStorage.getItem("medusa_access_token");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };
  const res = await fetch(`/api/v1/${path}`, {
    credentials: "include",
    ...options,
    headers,
  });
  return res.json();
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AccountingSetupPanel() {
  const [config, setConfig] = useState<AccountingConfig | null>(null);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [obAccounts, setObAccounts] = useState<OpeningBalanceAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Start date form
  const [startDateInput, setStartDateInput] = useState("");

  // Year generation form
  const [genFiscalYear, setGenFiscalYear] = useState("");
  const [genStartDate, setGenStartDate] = useState("");

  // Active section
  const [activeSection, setActiveSection] = useState<"config" | "periods" | "balances">("config");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, periodsRes, obRes] = await Promise.all([
        fetchApi("admin/accounting/config"),
        fetchApi("admin/accounting/fiscal-periods"),
        fetchApi("admin/accounting/opening-balances/status"),
      ]);

      if (configRes.success) setConfig(configRes);
      if (periodsRes.success) setPeriods(periodsRes.periods || []);
      if (obRes.success) setObAccounts(obRes.accounts || []);
    } catch (err: any) {
      setError(err.message || "Failed to load accounting configuration.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // ── Set Accounting Start Date ──────────────────────────────────────────────

  const handleSetStartDate = async () => {
    if (!startDateInput) return;
    setError(null);
    try {
      const res = await fetchApi("admin/accounting/config/start-date", {
        method: "PUT",
        body: JSON.stringify({ startDate: startDateInput }),
      });
      if (res.success) {
        showSuccess(`Accounting start date set to ${startDateInput}`);
        await loadData();
      } else {
        setError(res.message || res.error || "Failed to set start date.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Generate Year Periods ──────────────────────────────────────────────────

  const handleGenerateYear = async () => {
    if (!genFiscalYear || !genStartDate) return;
    setError(null);
    try {
      const res = await fetchApi("admin/accounting/fiscal-periods/generate-year", {
        method: "POST",
        body: JSON.stringify({ fiscal_year: genFiscalYear, year_start_date: genStartDate }),
      });
      if (res.success) {
        showSuccess(`Generated ${res.count} fiscal periods for ${genFiscalYear}`);
        await loadData();
      } else {
        setError(res.message || res.error || "Failed to generate periods.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Lock/Unlock Period ─────────────────────────────────────────────────────

  const handleToggleLock = async (periodId: string, isLocked: boolean) => {
    setError(null);
    try {
      const action = isLocked ? "unlock" : "lock";
      const res = await fetchApi(`admin/accounting/fiscal-periods/${periodId}/${action}`, {
        method: "PUT",
      });
      if (res.success) {
        showSuccess(`Period ${action}ed successfully`);
        await loadData();
      } else {
        setError(res.message || res.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Computed Values ────────────────────────────────────────────────────────

  const totalObDebit = obAccounts.reduce((sum, a) => sum + a.opening_debit, 0);
  const totalObCredit = obAccounts.reduce((sum, a) => sum + a.opening_credit, 0);
  const obAccountsConfigured = obAccounts.filter((a) => a.has_opening_balance).length;

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#9ca3af" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⏳</div>
        Loading accounting configuration...
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", maxWidth: "1200px" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.25rem" }}>
          ⚙️ Accounting Setup
        </h2>
        <p style={{ fontSize: "0.85rem", color: "#6b7280" }}>
          Configure accounting start date, fiscal periods, and view opening balance status.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div style={{
          padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: "6px",
          backgroundColor: "#fef2f2", border: "1px solid #fca5a5", color: "#b91c1c", fontSize: "0.85rem",
        }}>
          ❌ {error}
        </div>
      )}
      {successMsg && (
        <div style={{
          padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: "6px",
          backgroundColor: "#f0fdf4", border: "1px solid #86efac", color: "#166534", fontSize: "0.85rem",
        }}>
          ✅ {successMsg}
        </div>
      )}

      {/* Section Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", borderBottom: "1px solid #e5e7eb", paddingBottom: "0.5rem" }}>
        {(["config", "periods", "balances"] as const).map((sec) => (
          <button
            key={sec}
            onClick={() => setActiveSection(sec)}
            style={{
              padding: "0.5rem 1rem", borderRadius: "6px 6px 0 0", cursor: "pointer",
              fontSize: "0.85rem", fontWeight: activeSection === sec ? 700 : 400,
              backgroundColor: activeSection === sec ? "#245A96" : "transparent",
              color: activeSection === sec ? "#fff" : "#6b7280",
              border: "none",
            }}
          >
            {sec === "config" ? "📅 Start Date" : sec === "periods" ? "📋 Fiscal Periods" : "💰 Opening Balances"}
          </button>
        ))}
      </div>

      {/* Section: Accounting Start Date */}
      {activeSection === "config" && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
            Accounting Start Date
          </h3>

          {config?.is_configured ? (
            <div>
              <div style={{
                padding: "1rem", borderRadius: "8px", backgroundColor: "#f0fdf4",
                border: "1px solid #86efac", marginBottom: "1rem",
              }}>
                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>Current Start Date</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#166534" }}>
                  {config.accounting_start_date}
                </div>
                {config.is_immutable && (
                  <div style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "0.5rem" }}>
                    🔒 Locked — Journal entries exist. Start date cannot be changed.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                padding: "1rem", borderRadius: "8px", backgroundColor: "#fef3c7",
                border: "1px solid #fcd34d", marginBottom: "1rem",
              }}>
                <div style={{ fontWeight: 600, color: "#92400e", marginBottom: "0.25rem" }}>
                  ⚠️ Accounting Start Date Not Configured
                </div>
                <div style={{ fontSize: "0.85rem", color: "#78350f" }}>
                  All posting operations are blocked until an accounting start date is set.
                  This should be the date from which the business begins tracking accounting transactions.
                  For Indian FY, this is typically April 1 (e.g., 2024-04-01).
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="date"
                  value={startDateInput}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  style={{
                    padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db",
                    fontSize: "0.9rem",
                  }}
                />
                <button
                  onClick={handleSetStartDate}
                  disabled={!startDateInput}
                  style={{
                    padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer",
                    backgroundColor: startDateInput ? "#245A96" : "#d1d5db",
                    color: "#fff", border: "none", fontWeight: 600, fontSize: "0.85rem",
                  }}
                >
                  Set Start Date
                </button>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.5rem" }}>
                Once journal entries are posted, this date becomes permanent and cannot be changed.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Section: Fiscal Periods */}
      {activeSection === "periods" && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
            Fiscal Periods ({periods.length})
          </h3>

          {!config?.is_configured && (
            <div style={{
              padding: "0.75rem", borderRadius: "6px", backgroundColor: "#fef3c7",
              border: "1px solid #fcd34d", marginBottom: "1rem", fontSize: "0.85rem", color: "#92400e",
            }}>
              ⚠️ Set the accounting start date first before creating fiscal periods.
            </div>
          )}

          {config?.is_configured && (
            <div style={{
              padding: "1rem", borderRadius: "8px", backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb", marginBottom: "1rem",
            }}>
              <div style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                Auto-Generate 12-Month Fiscal Year
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Fiscal Year (e.g. 2024-2025)"
                  value={genFiscalYear}
                  onChange={(e) => setGenFiscalYear(e.target.value)}
                  style={{
                    padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db",
                    fontSize: "0.85rem", width: "180px",
                  }}
                />
                <input
                  type="date"
                  placeholder="Year Start Date"
                  value={genStartDate}
                  onChange={(e) => setGenStartDate(e.target.value)}
                  style={{
                    padding: "0.5rem", borderRadius: "6px", border: "1px solid #d1d5db",
                    fontSize: "0.85rem",
                  }}
                />
                <button
                  onClick={handleGenerateYear}
                  disabled={!genFiscalYear || !genStartDate}
                  style={{
                    padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer",
                    backgroundColor: genFiscalYear && genStartDate ? "#059669" : "#d1d5db",
                    color: "#fff", border: "none", fontWeight: 600, fontSize: "0.85rem",
                  }}
                >
                  Generate 12 Periods
                </button>
              </div>
              <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.5rem" }}>
                For Indian FY (Apr–Mar), set year start date to April 1 (e.g. 2024-04-01).
              </p>
            </div>
          )}

          {periods.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "0.5rem", color: "#6b7280" }}>Period</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", color: "#6b7280" }}>Year</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", color: "#6b7280" }}>Start</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", color: "#6b7280" }}>End</th>
                    <th style={{ textAlign: "center", padding: "0.5rem", color: "#6b7280" }}>Status</th>
                    <th style={{ textAlign: "center", padding: "0.5rem", color: "#6b7280" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.5rem", fontWeight: 500 }}>{p.period_name}</td>
                      <td style={{ padding: "0.5rem" }}>{p.fiscal_year}</td>
                      <td style={{ padding: "0.5rem" }}>{p.start_date}</td>
                      <td style={{ padding: "0.5rem" }}>{p.end_date}</td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>
                        <span style={{
                          padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600,
                          backgroundColor: p.is_locked ? "#fef2f2" : "#f0fdf4",
                          color: p.is_locked ? "#b91c1c" : "#166534",
                        }}>
                          {p.is_locked ? "🔒 Locked" : "✅ Open"}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>
                        <button
                          onClick={() => handleToggleLock(p.id, p.is_locked)}
                          style={{
                            padding: "3px 10px", borderRadius: "4px", cursor: "pointer",
                            fontSize: "0.75rem", fontWeight: 500,
                            backgroundColor: p.is_locked ? "#dbeafe" : "#fef3c7",
                            color: p.is_locked ? "#3978B8" : "#92400e",
                            border: "none",
                          }}
                        >
                          {p.is_locked ? "Unlock" : "Lock"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>
              No fiscal periods configured yet.
            </div>
          )}
        </div>
      )}

      {/* Section: Opening Balance Status (Read-Only View) */}
      {activeSection === "balances" && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Opening Balance Status
          </h3>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "1rem" }}>
            This view shows which accounts have opening balances posted. Opening balances
            should only be entered when the business has supplied authoritative opening figures.
          </p>

          {/* Summary */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.75rem", marginBottom: "1rem",
          }}>
            <div style={{
              padding: "0.75rem", borderRadius: "8px", backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Accounts Configured</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                {obAccountsConfigured} / {obAccounts.length}
              </div>
            </div>
            <div style={{
              padding: "0.75rem", borderRadius: "8px", backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Total Debit</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                ₹{totalObDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{
              padding: "0.75rem", borderRadius: "8px", backgroundColor: "#f9fafb",
              border: "1px solid #e5e7eb",
            }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Total Credit</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>
                ₹{totalObCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{
              padding: "0.75rem", borderRadius: "8px",
              backgroundColor: Math.abs(totalObDebit - totalObCredit) < 0.01 ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${Math.abs(totalObDebit - totalObCredit) < 0.01 ? "#86efac" : "#fca5a5"}`,
            }}>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Balance Check</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: Math.abs(totalObDebit - totalObCredit) < 0.01 ? "#166534" : "#b91c1c" }}>
                {Math.abs(totalObDebit - totalObCredit) < 0.01 ? "✅ Balanced" : `⚠️ Diff: ₹${Math.abs(totalObDebit - totalObCredit).toFixed(2)}`}
              </div>
            </div>
          </div>

          {obAccounts.length > 0 ? (
            <div style={{ overflowX: "auto", maxHeight: "500px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead style={{ position: "sticky", top: 0, backgroundColor: "#fff" }}>
                  <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                    <th style={{ textAlign: "left", padding: "0.5rem", color: "#6b7280" }}>Code</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", color: "#6b7280" }}>Name</th>
                    <th style={{ textAlign: "left", padding: "0.5rem", color: "#6b7280" }}>Type</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", color: "#6b7280" }}>Debit</th>
                    <th style={{ textAlign: "right", padding: "0.5rem", color: "#6b7280" }}>Credit</th>
                    <th style={{ textAlign: "center", padding: "0.5rem", color: "#6b7280" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {obAccounts.map((a) => (
                    <tr key={a.account_id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.5rem", fontFamily: "monospace", fontWeight: 500 }}>{a.code}</td>
                      <td style={{ padding: "0.5rem" }}>{a.name}</td>
                      <td style={{ padding: "0.5rem", fontSize: "0.75rem" }}>
                        <span style={{
                          padding: "1px 6px", borderRadius: "4px", fontSize: "0.7rem",
                          backgroundColor: a.type === "ASSET" ? "#dbeafe" : a.type === "LIABILITY" ? "#fce7f3" : a.type === "EQUITY" ? "#ede9fe" : a.type === "REVENUE" ? "#d1fae5" : "#fef3c7",
                          color: a.type === "ASSET" ? "#3978B8" : a.type === "LIABILITY" ? "#9d174d" : a.type === "EQUITY" ? "#6d28d9" : a.type === "REVENUE" ? "#059669" : "#92400e",
                        }}>
                          {a.type}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "monospace" }}>
                        {a.opening_debit > 0 ? `₹${a.opening_debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "monospace" }}>
                        {a.opening_credit > 0 ? `₹${a.opening_credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td style={{ padding: "0.5rem", textAlign: "center" }}>
                        <span style={{
                          padding: "1px 6px", borderRadius: "8px", fontSize: "0.7rem", fontWeight: 600,
                          backgroundColor: a.has_opening_balance ? "#f0fdf4" : "#f9fafb",
                          color: a.has_opening_balance ? "#166534" : "#9ca3af",
                        }}>
                          {a.has_opening_balance ? "Configured" : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>
              No leaf accounts found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
