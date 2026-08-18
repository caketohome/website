"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { Search, RefreshCw, ShoppingCart, Send, ArrowUpRight, CheckCircle, Clock, AlertTriangle, MessageSquare, Mail, Copy, Check, Download } from "lucide-react";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";

export const AbandonedCartPanel = memo(function AbandonedCartPanel() {
  const [carts, setCarts] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    total_abandoned: 0,
    total_abandoned_value: 0,
    recovered_count: 0,
    recovered_revenue: 0,
    recovery_rate_pct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [preset, setPreset] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  // Detail Modal / Drawer State
  const [selectedCart, setSelectedCart] = useState<any | null>(null);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchAbandonedCarts = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (preset !== "all") params.set("preset", preset);
    if (status !== "all") params.set("status", status);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", String(limit));

    fetch(`/api/v1/admin/abandoned-carts?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setCarts(data.carts || []);
        if (data.metrics) setMetrics(data.metrics);
        if (data.pagination) setTotal(data.pagination.total);
      })
      .catch((err) => {
        console.error("[Abandoned Carts Error]:", err);
        setError(err.message || "Failed to load abandoned carts");
        setCarts([]);
      })
      .finally(() => setLoading(false));
  }, [preset, status, search, page, limit]);

  useEffect(() => {
    fetchAbandonedCarts();
  }, [fetchAbandonedCarts]);

  const handleSendRecovery = async (cartId: string, channel: "whatsapp" | "sms" | "email" = "whatsapp") => {
    setSendingRecovery(true);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/v1/admin/abandoned-carts/${cartId}/send-recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, discount_code: "SWEET10", discount_pct: 10 }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccess(`Recovery message successfully dispatched via ${channel.toUpperCase()}!`);
        fetchAbandonedCarts();
      } else {
        setError(data.error || "Failed to dispatch recovery message.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to dispatch recovery message.");
    } finally {
      setSendingRecovery(false);
    }
  };

  const handleCopyRecoveryUrl = (cart: any) => {
    const recoveryUrl = `${window.location.origin}/cart/recover/${cart.recovery_token || "sample_token"}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(recoveryUrl);
      setCopiedToken(cart.id);
      setTimeout(() => setCopiedToken(null), 3000);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <WidgetErrorBoundary>
      <div className="flex flex-col gap-6">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Heading level="h2" className="text-xl font-bold">
                Abandoned Cart Recovery Engine
              </Heading>
              <Badge color="orange" className="text-xs">
                Revenue Protection
              </Badge>
            </div>
            <Text className="text-ui-fg-subtle text-sm">
              Detect dropped checkouts, dispatch automated recovery incentives, and track revenue attribution.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              onClick={fetchAbandonedCarts}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                const params = new URLSearchParams();
                if (preset !== "all") params.set("preset", preset);
                if (status !== "all") params.set("status", status);
                if (search) params.set("search", search);
                window.open(`/api/v1/admin/abandoned-carts/export?${params.toString()}`, "_blank");
              }}
              className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Metric KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Abandoned Carts
              </span>
              <ShoppingCart className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-900 dark:text-amber-300">
              {metrics.total_abandoned || 0}
            </div>
            <div className="text-xs text-amber-700/70 mt-1">₹{metrics.total_abandoned_value?.toLocaleString("en-IN") || 0} at stake</div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Recovered Revenue
              </span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{metrics.recovered_revenue?.toLocaleString("en-IN") || 0}
            </div>
            <div className="text-xs text-emerald-600/70 mt-1">{metrics.recovered_count || 0} converted checkouts</div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-blue-200 dark:border-blue-900/60 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Recovery Rate
              </span>
              <ArrowUpRight className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {metrics.recovery_rate_pct || 0}%
            </div>
            <div className="text-xs text-blue-600/70 mt-1">Target benchmark: &gt;18%</div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-purple-200 dark:border-purple-900/60 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                Avg Cart Value
              </span>
              <ShoppingCart className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              ₹{metrics.total_abandoned > 0 ? Math.round(metrics.total_abandoned_value / metrics.total_abandoned) : 749}
            </div>
            <div className="text-xs text-purple-600/70 mt-1">Multi-item gourmet baskets</div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search customer, phone, cake title, cart ID..."
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
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_month">This Month</option>
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
              <option value="ABANDONED">Abandoned (Action Needed)</option>
              <option value="RECOVERY_SENT">Recovery Sent</option>
              <option value="RECOVERED">Recovered (Paid)</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        {loading ? (
          <TableSkeleton rows={8} />
        ) : error ? (
          <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300">
            <p className="font-semibold">{error}</p>
            <Button size="small" variant="secondary" onClick={fetchAbandonedCarts} className="mt-3">
              Retry
            </Button>
          </div>
        ) : carts.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
            <ShoppingCart className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">No Abandoned Carts Found</h3>
            <p className="text-sm text-neutral-500 mt-1">All checkouts are healthy or no carts match current filter.</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Abandoned At</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Items in Cart</th>
                    <th className="py-3 px-4">Value</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Recovery Sent</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {carts.map((cart) => {
                    const isRecovered = cart.status === "RECOVERED";
                    const isSent = cart.status === "RECOVERY_SENT";
                    return (
                      <tr key={cart.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-neutral-500">
                          <div>{new Date(cart.last_activity_at || cart.abandoned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          <div className="text-[10px] text-neutral-400">{new Date(cart.last_activity_at || cart.abandoned_at).toLocaleDateString()}</div>
                        </td>

                        <td className="py-3 px-4 font-medium text-neutral-900 dark:text-white">
                          <div>{cart.customer_name || "Guest Customer"}</div>
                          <div className="text-[11px] font-mono text-neutral-500">{cart.customer_phone || cart.customer_email || "—"}</div>
                        </td>

                        <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300">
                          <div className="font-semibold text-neutral-900 dark:text-white truncate max-w-[200px]">
                            {cart.items?.[0]?.title || cart.items?.[0]?.name || "Gourmet Cake"}
                          </div>
                          {cart.items?.length > 1 && (
                            <div className="text-[11px] text-neutral-400">+{cart.items.length - 1} more items</div>
                          )}
                        </td>

                        <td className="py-3 px-4 font-bold text-neutral-900 dark:text-white whitespace-nowrap">
                          ₹{(cart.subtotal || 699).toLocaleString("en-IN")}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          {isRecovered ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                              <CheckCircle className="w-3 h-3" /> RECOVERED
                            </span>
                          ) : isSent ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                              <Send className="w-3 h-3" /> RECOVERY SENT
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                              <Clock className="w-3 h-3" /> ABANDONED
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-neutral-500 text-[11px]">
                          {cart.recovery_attempts && cart.recovery_attempts.length > 0 ? (
                            <span>{cart.recovery_attempts.length}x ({cart.recovery_attempts[cart.recovery_attempts.length - 1].channel})</span>
                          ) : (
                            <span className="text-neutral-400">Not sent yet</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isRecovered && (
                              <button
                                type="button"
                                onClick={() => handleSendRecovery(cart.id, "whatsapp")}
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 transition-colors"
                                title="Send WhatsApp Recovery"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCopyRecoveryUrl(cart)}
                              className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-300 transition-colors"
                              title="Copy Direct Recovery URL"
                            >
                              {copiedToken === cart.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedCart(cart)}
                              className="px-2 py-1 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-200 transition-colors"
                            >
                              Inspect
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between text-xs text-neutral-500">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} carts
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

        {/* Inspect & Recovery Modal */}
        {selectedCart && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setSelectedCart(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/50">
                <div>
                  <h3 className="font-bold text-base text-neutral-900 dark:text-white">Cart Inspection & Direct Dispatch</h3>
                  <p className="text-xs text-neutral-500">Cart ID: {selectedCart.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCart(null)}
                  className="rounded-full p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                {/* Customer Details */}
                <div className="bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-neutral-400 block">Customer</span>
                    <strong className="text-neutral-900 dark:text-white">{selectedCart.customer_name || "Guest Customer"}</strong>
                    <div className="font-mono text-neutral-500">{selectedCart.customer_phone || selectedCart.customer_email || "No direct phone"}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-neutral-400 block">Delivery City</span>
                    <strong className="text-neutral-900 dark:text-white">{selectedCart.delivery_city || "Bengaluru"}</strong>
                  </div>
                </div>

                {/* Items in Cart */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">Items in Cart</h4>
                  <div className="flex flex-col gap-2">
                    {(selectedCart.items || []).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800 text-xs">
                        <div>
                          <div className="font-medium text-neutral-900 dark:text-white">{item.title || item.name}</div>
                          <div className="text-neutral-400 text-[11px]">Qty: {item.quantity || 1} • {item.weight || "1 kg"}</div>
                          {item.cake_message && (
                            <div className="text-amber-600 text-[11px]">Message: &quot;{item.cake_message}&quot;</div>
                          )}
                        </div>
                        <div className="font-bold text-neutral-900 dark:text-white">
                          ₹{((item.unit_price || item.price || 599) * (item.quantity || 1)).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Dispatch */}
                {actionSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl">
                    {actionSuccess}
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Dispatch Instant Recovery Message:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      size="small"
                      disabled={sendingRecovery}
                      onClick={() => handleSendRecovery(selectedCart.id, "whatsapp")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </Button>
                    <Button
                      size="small"
                      disabled={sendingRecovery}
                      onClick={() => handleSendRecovery(selectedCart.id, "sms")}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" /> SMS
                    </Button>
                    <Button
                      size="small"
                      disabled={sendingRecovery}
                      onClick={() => handleSendRecovery(selectedCart.id, "email")}
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs flex items-center justify-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" /> Email
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </WidgetErrorBoundary>
  );
});
