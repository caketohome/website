"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { Search, RefreshCw, ShieldCheck, ShieldAlert, KeyRound, Smartphone, Calendar, Filter, Users } from "lucide-react";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";

export const LoginActivityPanel = memo(function LoginActivityPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    total_events: 0,
    successful_logins: 0,
    failed_logins: 0,
    unique_users: 0,
    role_breakdown: {},
    status_breakdown: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [preset, setPreset] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const fetchLoginActivity = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (preset !== "all") params.set("preset", preset);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (role !== "all") params.set("role", role);
    if (status !== "all") params.set("status", status);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/v1/admin/login-activity?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setEvents(data.events || []);
        if (data.metrics) setMetrics(data.metrics);
        if (data.pagination) setTotal(data.pagination.total);
      })
      .catch((err) => {
        console.error("[Login Activity Error]:", err);
        setError(err.message || "Failed to load login activity data");
        setEvents([]);
      })
      .finally(() => setLoading(false));
  }, [preset, startDate, endDate, role, status, search, page, limit]);

  useEffect(() => {
    fetchLoginActivity();
  }, [fetchLoginActivity]);

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <WidgetErrorBoundary>
      <div className="flex flex-col gap-6">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Heading level="h2" className="text-xl font-bold">
                Authentication & Security Activity
              </Heading>
              <Badge color="purple" className="text-xs">
                Audit Log
              </Badge>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              Real-time audit log of user logins, OTP verifications, role elevations, and security events.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              onClick={fetchLoginActivity}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Metric KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Logins</span>
              <KeyRound className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-neutral-900 dark:text-white">
              {metrics.total_events || total}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Logged auth attempts</div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-emerald-100 dark:border-emerald-950 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Successful
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.successful_logins || 0}
            </div>
            <div className="text-xs text-emerald-600/70 mt-1">
              {metrics.total_events > 0
                ? `${Math.round((metrics.successful_logins / metrics.total_events) * 100)}% success rate`
                : "100% success rate"}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-rose-100 dark:border-rose-950 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Failed / Invalid
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {metrics.failed_logins || 0}
            </div>
            <div className="text-xs text-rose-600/70 mt-1">Invalid OTPs or rejected</div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-brand-light dark:border-brand-navy rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-navy dark:text-brand-primary">
                Unique Users
              </span>
              <Users className="w-4 h-4 text-brand-primary" />
            </div>
            <div className="text-2xl font-bold text-brand-primary dark:text-brand-primary">
              {metrics.unique_users || 0}
            </div>
            <div className="text-xs text-brand-primary/70 mt-1">Active customer/staff profiles</div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search phone, user, role, IP..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500 text-neutral-900 dark:text-white"
              />
            </div>

            {/* Date Range Preset */}
            <select
              value={preset}
              onChange={(e) => {
                setPreset(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_month">This Month</option>
            </select>

            {/* Role Filter */}
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="BRANCH_MANAGER">Branch Manager</option>
              <option value="DELIVERY_PARTNER">Delivery Partner</option>
              <option value="CUSTOMER">Customer</option>
            </select>

            {/* Status Filter */}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILED">Failed Only</option>
            </select>
          </div>
        </div>

        {/* Table & Event Stream */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : error ? (
          <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300">
            <p className="font-semibold">{error}</p>
            <Button size="small" variant="secondary" onClick={fetchLoginActivity} className="mt-3">
              Retry
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
            <ShieldCheck className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">No Login Events Found</h3>
            <p className="text-sm text-neutral-500 mt-1">Try broadening your date filter or search query.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">User / Phone</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Auth Method</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">IP & Device</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {events.map((evt) => {
                    const isSuccess = evt.status === "SUCCESS";
                    const isSuperAdmin = evt.role === "SUPER_ADMIN";
                    return (
                      <tr key={evt.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-neutral-500">
                          <div>{new Date(evt.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                          <div className="text-[10px] text-neutral-400">{new Date(evt.created_at).toLocaleDateString()}</div>
                        </td>

                        <td className="py-3 px-4 font-medium text-neutral-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            {evt.user_name || "Gourmet Customer"}
                          </div>
                          <div className="text-[11px] font-mono text-neutral-500">{evt.phone || "—"}</div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isSuperAdmin
                                ? "bg-brand-light dark:bg-brand-navy text-brand-navy dark:text-brand-primary border border-brand-primary/30 dark:border-brand-navy"
                                : evt.role === "BRANCH_MANAGER"
                                ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                : evt.role === "DELIVERY_PARTNER"
                                ? "bg-brand-gold-light dark:bg-brand-gold-dark text-brand-gold-dark dark:text-brand-gold border border-brand-gold/40 dark:border-brand-gold-dark"
                                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                            }`}
                          >
                            {evt.role?.replace(/_/g, " ") || "CUSTOMER"}
                          </span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap text-neutral-600 dark:text-neutral-300">
                          <div className="flex items-center gap-1">
                            <Smartphone className="w-3 h-3 text-neutral-400" />
                            {evt.method || "OTP_SMS"}
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              SUCCESS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                              FAILED
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-neutral-500 text-[11px]">
                          <div className="font-mono">{evt.ip_address || "127.0.0.1"}</div>
                          <div className="truncate max-w-[140px] text-[10px] text-neutral-400">
                            {evt.user_agent || "Web Browser"}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-neutral-500 text-[11px]">
                          {evt.failure_reason ? (
                            <span className="text-rose-600 font-medium">{evt.failure_reason}</span>
                          ) : (
                            <span className="text-neutral-400">Authenticated via Secure OTP</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between text-xs text-neutral-500">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} events
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="font-medium">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </WidgetErrorBoundary>
  );
});
