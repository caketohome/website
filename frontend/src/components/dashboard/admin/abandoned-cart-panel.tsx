"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import {
  Search,
  RefreshCw,
  ShoppingCart,
  Send,
  ArrowUpRight,
  CheckCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  Mail,
  Copy,
  Check,
  Download,
  PhoneCall,
  Zap,
  Filter,
  TrendingUp,
  Percent,
  Package,
  Layers,
  Sparkles,
  ChevronRight,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";
import { RecoveryJourneyDrawer } from "./abandoned-cart/recovery-journey-drawer";
import { CampaignBuilderModal } from "./abandoned-cart/campaign-builder-modal";
import {
  AbandonedCartRecord,
  AbandonedCartMetrics,
  RecoveryFunnelStep,
  RecoveryChannelPerformance,
  TopAbandonedProduct,
} from "@/lib/cart-recovery/types";

import { BrowseAbandonmentTab } from "./browse-abandonment-tab";

export const AbandonedCartPanel = memo(function AbandonedCartPanel() {
  const [activeTab, setActiveTab] = useState<"carts" | "channels" | "products" | "browse">("carts");
  const [carts, setCarts] = useState<AbandonedCartRecord[]>([]);
  const [metrics, setMetrics] = useState<AbandonedCartMetrics>({
    total_abandoned: 0,
    active_abandoned: 0,
    revenue_at_risk: 0,
    recovered_count: 0,
    recovered_revenue: 0,
    lost_revenue: 0,
    recovery_rate_pct: 0,
    average_cart_value: 0,
    average_recovery_time_minutes: 0,
    whatsapp_reachable_count: 0,
  });
  const [funnel, setFunnel] = useState<RecoveryFunnelStep[]>([]);
  const [channels, setChannels] = useState<RecoveryChannelPerformance[]>([]);
  const [topProducts, setTopProducts] = useState<TopAbandonedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [preset, setPreset] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  // Detail Drawer & Automation Modal State
  const [selectedCart, setSelectedCart] = useState<AbandonedCartRecord | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);

  const fetchAbandonedCarts = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (preset !== "all") params.set("preset", preset);
    if (status !== "all") params.set("status", status);
    if (city !== "all") params.set("city", city);
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
        if (data.funnel) setFunnel(data.funnel);
        if (data.channel_performance) setChannels(data.channel_performance);
        if (data.top_products) setTopProducts(data.top_products);
        if (data.pagination) setTotal(data.pagination.total);
      })
      .catch((err) => {
        console.error("[Abandoned Carts Error]:", err);
        setError(err.message || "Failed to load abandoned carts");
        setCarts([]);
      })
      .finally(() => setLoading(false));
  }, [preset, status, city, search, page, limit]);

  useEffect(() => {
    fetchAbandonedCarts();
  }, [fetchAbandonedCarts]);

  const handleEvaluateNow = async () => {
    setEvaluating(true);
    try {
      await fetch("/api/v1/admin/abandoned-carts/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold_minutes: 0 }),
      });
      fetchAbandonedCarts();
    } catch (err) {
      console.error("Evaluation error:", err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleOpenCartJourney = (cart: AbandonedCartRecord) => {
    setSelectedCart(cart);
    setIsDrawerOpen(true);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const getRelativeTime = (dateStr: string) => {
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <WidgetErrorBoundary>
      <div className="flex flex-col gap-6">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Heading level="h2" className="text-xl font-bold text-neutral-900 dark:text-white">
                Abandoned Cart Recovery Engine
              </Heading>
              <Badge color="orange" className="text-xs">
                Revenue Intelligence
              </Badge>
            </div>
            <Text className="text-neutral-500 dark:text-neutral-400 text-sm mt-0.5">
              Live dropped checkout detection, omnichannel automated incentives, and authoritative revenue attribution.
            </Text>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="small"
              variant="secondary"
              onClick={() => setIsCampaignModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-brand-gold/10 hover:bg-brand-gold/20 text-brand-gold-dark dark:text-brand-gold/40 border-brand-gold/40 dark:border-brand-gold-dark"
            >
              <Zap className="w-3.5 h-3.5 text-brand-gold" /> Automated Workflows
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={handleEvaluateNow}
              disabled={evaluating}
              className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? "animate-spin" : ""}`} />
              {evaluating ? "Scanning..." : "Scan Carts"}
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                const params = new URLSearchParams();
                if (preset !== "all") params.set("preset", preset);
                if (status !== "all") params.set("status", status);
                if (city !== "all") params.set("city", city);
                if (search) params.set("search", search);
                window.open(`/api/v1/admin/abandoned-carts/export?${params.toString()}`, "_blank");
              }}
              className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Dynamic Metric KPI Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-neutral-900 border border-brand-gold/40 dark:border-brand-gold-dark/60 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold block mb-1">
              Revenue At Risk
            </span>
            <div className="text-xl font-bold text-neutral-900 dark:text-white">
              ₹{Number(metrics.revenue_at_risk || 0).toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              {metrics.active_abandoned || 0} active carts
            </span>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
              Recovered Revenue
            </span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ₹{Number(metrics.recovered_revenue || 0).toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              {metrics.recovered_count || 0} converted orders
            </span>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-blue-200 dark:border-blue-900/60 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">
              Recovery Rate
            </span>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {metrics.recovery_rate_pct || 0}%
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Omnichannel conversion
            </span>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block mb-1">
              Lost Revenue
            </span>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
              ₹{Number(metrics.lost_revenue || 0).toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Expired & failed
            </span>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
              Avg Cart Value
            </span>
            <div className="text-xl font-bold text-neutral-900 dark:text-white">
              ₹{Number(metrics.average_cart_value || 0).toLocaleString("en-IN")}
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Per dropped checkout
            </span>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
              Avg Recovery Time
            </span>
            <div className="text-xl font-bold text-neutral-900 dark:text-white">
              {metrics.average_recovery_time_minutes || 0}m
            </div>
            <span className="text-[11px] text-neutral-400 mt-1 block">
              Time to conversion
            </span>
          </div>
        </div>

        {/* Omnichannel Recovery Funnel Visualizer */}
        {funnel.length > 0 && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-primary-600" /> Recovery Funnel Progression
              </h3>
              <span className="text-xs text-neutral-400">Real-time checkout drop-off analysis</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {funnel.map((step, idx) => (
                <div
                  key={step.step}
                  className="bg-neutral-50 dark:bg-neutral-800/60 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700/60 relative"
                >
                  <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                    {step.step.replace(/_/g, " ")}
                  </div>
                  <div className="text-base font-bold text-neutral-900 dark:text-white mt-0.5">
                    {(Number(step.count) || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] font-semibold text-brand-gold dark:text-brand-gold mt-0.5">
                    ₹{(Number(step.value) || 0).toLocaleString("en-IN")}
                  </div>
                  {idx > 0 && (
                    <span className="text-[10px] text-neutral-400 block mt-1">
                      {step.conversion_rate_pct ?? step.percentage ?? 0}% of total
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2">
          <button
            onClick={() => setActiveTab("carts")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "carts"
                ? "bg-brand-gold text-white"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" /> Abandoned Carts ({total})
          </button>
          <button
            onClick={() => setActiveTab("channels")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "channels"
                ? "bg-brand-gold text-white"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Channel Performance
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "products"
                ? "bg-brand-gold text-white"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <Package className="w-3.5 h-3.5" /> Top Abandoned Cakes
          </button>
          <button
            onClick={() => setActiveTab("browse")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "browse"
                ? "bg-brand-gold text-white"
                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            Viewed but didn&apos;t buy
          </button>
        </div>

        {activeTab === "browse" && <BrowseAbandonmentTab />}

        {/* Tab 1: Abandoned Carts Table View */}
        {activeTab === "carts" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <Input
                  size="small"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search customer, phone, cake, or cart ID..."
                  className="text-xs"
                />
              </div>

              <div>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full p-2 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="all">All Recovery Statuses</option>
                  <option value="ACTIVE">Active / Pending</option>
                  <option value="MESSAGE_SENT">Message Dispatched</option>
                  <option value="CLICKED">Link Clicked</option>
                  <option value="RECOVERED">Recovered (Paid)</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>

              <div>
                <select
                  value={preset}
                  onChange={(e) => {
                    setPreset(e.target.value);
                    setPage(1);
                  }}
                  className="w-full p-2 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="all">All Time History</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last_7_days">Last 7 Days</option>
                  <option value="last_30_days">Last 30 Days</option>
                </select>
              </div>

              <div>
                <select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setPage(1);
                  }}
                  className="w-full p-2 text-xs border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="all">All Hub Cities</option>
                  <option value="Bengaluru">Bengaluru</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Delhi NCR">Delhi NCR</option>
                </select>
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
              {loading ? (
                <div className="p-6">
                  <TableSkeleton rows={6} />
                </div>
              ) : carts.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <ShoppingCart className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto" />
                  <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    No Abandoned Carts Found
                  </h4>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    {search || status !== "all" || preset !== "all"
                      ? "No carts match the current filter criteria."
                      : "Zero checkouts have been abandoned. All customer sessions converted or carts are clear."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Phone / WhatsApp</th>
                        <th className="py-3 px-4">Cart Items</th>
                        <th className="py-3 px-4">Cart Value</th>
                        <th className="py-3 px-4">Branch</th>
                        <th className="py-3 px-4">Abandoned</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {carts.map((cart) => {
                        const items = cart.items || [];
                        const firstItem = items[0];
                        return (
                          <tr
                            key={cart.id}
                            className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-neutral-900 dark:text-white">
                                {cart.customer_name || "Guest Customer"}
                              </div>
                              <div className="text-[11px] text-neutral-400 font-mono">
                                {cart.cart_uid || cart.id}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono text-neutral-700 dark:text-neutral-300">
                              {cart.phone || "—"}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                {firstItem?.thumbnail ? (
                                  <img
                                    src={firstItem.thumbnail}
                                    alt={firstItem.title || "Cake"}
                                    className="w-7 h-7 rounded-md object-cover border border-neutral-200 dark:border-neutral-700"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-neutral-400" />
                                )}
                                <div>
                                  <span className="font-medium text-neutral-800 dark:text-neutral-200 line-clamp-1">
                                    {firstItem?.title || firstItem?.name || "Celebration Cake"}
                                  </span>
                                  {items.length > 1 && (
                                    <span className="text-[10px] text-neutral-400">
                                      +{items.length - 1} more items
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="font-bold text-neutral-900 dark:text-white">
                                ₹{Number(cart.cart_value || 0).toLocaleString("en-IN")}
                              </span>
                              {cart.recovered_revenue ? (
                                <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Recov: ₹{cart.recovered_revenue.toLocaleString("en-IN")}
                                </span>
                              ) : null}
                            </td>

                            <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-400">
                              <div>{cart.branch_name || "—"}</div>
                              <div className="text-[10px] text-neutral-400">{cart.city || ""}</div>
                            </td>

                            <td className="py-3.5 px-4 text-neutral-500">
                              <div>{getRelativeTime(cart.abandoned_at || cart.created_at)}</div>
                              <div className="text-[10px] text-neutral-400">
                                {new Date(cart.abandoned_at || cart.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <Badge
                                color={
                                  cart.status === "RECOVERED"
                                    ? "green"
                                    : cart.status === "MESSAGE_SENT"
                                    ? "blue"
                                    : cart.status === "CLICKED"
                                    ? "purple"
                                    : "orange"
                                }
                                className="text-[10px]"
                              >
                                {cart.status}
                              </Badge>
                              {cart.recovery_channel && (
                                <span className="block text-[10px] text-neutral-400 mt-0.5">
                                  via {cart.recovery_channel}
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <Button
                                size="small"
                                variant="secondary"
                                onClick={() => handleOpenCartJourney(cart)}
                                className="text-xs bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                              >
                                View Journey <ChevronRight className="w-3 h-3 ml-0.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Bar */}
              {!loading && carts.length > 0 && (
                <div className="p-3.5 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    Showing {Math.min((page - 1) * limit + 1, total)} - {Math.min(page * limit, total)} of{" "}
                    {total} abandoned carts
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="text-xs"
                    >
                      Previous
                    </Button>
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="text-xs"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Channel Performance Analytics */}
        {activeTab === "channels" && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs p-6 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-gold" /> Omnichannel Recovery Attribution Breakdown
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {channels.map((ch) => (
                <div
                  key={ch.channel}
                  className="p-4 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-700/60 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-neutral-900 dark:text-white capitalize">
                      {ch.channel}
                    </span>
                    <Badge color="blue" className="text-[10px]">
                      {ch.conversion_rate_pct ?? ch.recovery_rate_pct ?? 0}% Conv
                    </Badge>
                  </div>
                  <div className="text-xs text-neutral-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Messages Dispatched:</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {ch.messages_sent ?? ch.sent_count ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivered / Seen:</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {ch.delivered_count ?? ch.messages_sent ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Links Clicked:</span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                        {ch.clicks ?? ch.clicked_count ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Orders Recovered:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {ch.recovered_orders ?? ch.recovered_count ?? 0}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-neutral-200 dark:border-neutral-700 pt-1 font-bold text-neutral-900 dark:text-white">
                      <span>Attributed Revenue:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ₹{(Number(ch.recovered_revenue) || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Top Abandoned Cakes */}
        {activeTab === "products" && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-gold" /> High-Drop Bakery Products
              </h3>
              <span className="text-xs text-neutral-400">Aggregated dropped cake items & lost revenue</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Unit Price</th>
                    <th className="py-3 px-4">Times Abandoned</th>
                    <th className="py-3 px-4">Times Recovered</th>
                    <th className="py-3 px-4">Revenue At Risk</th>
                    <th className="py-3 px-4">Recovery Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {topProducts.map((p) => (
                    <tr key={p.product_id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40">
                      <td className="py-3.5 px-4 font-semibold text-neutral-900 dark:text-white">
                        {p.title}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-neutral-700 dark:text-neutral-300">
                        ₹{(Number(p.unit_price) || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-brand-gold font-semibold">
                        {p.abandoned_count ?? 0} checkouts
                      </td>
                      <td className="py-3.5 px-4 text-emerald-600 font-semibold">
                        {p.recovered_count ?? 0} orders
                      </td>
                      <td className="py-3.5 px-4 font-bold text-neutral-900 dark:text-white">
                        ₹{(Number(p.revenue_at_risk ?? p.total_lost_revenue) || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge color={(p.recovery_rate_pct ?? 0) >= 20 ? "green" : "orange"} className="text-[10px]">
                          {p.recovery_rate_pct ?? 0}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customer Recovery Journey Drawer */}
        <RecoveryJourneyDrawer
          cart={selectedCart}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onRefresh={fetchAbandonedCarts}
        />

        {/* Campaign Workflows Modal */}
        <CampaignBuilderModal
          isOpen={isCampaignModalOpen}
          onClose={() => setIsCampaignModalOpen(false)}
          onRefresh={fetchAbandonedCarts}
        />
      </div>
    </WidgetErrorBoundary>
  );
});
