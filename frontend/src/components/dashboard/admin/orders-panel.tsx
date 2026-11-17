"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Container, Heading, Text, StatusBadge, Badge, Input, Button } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  Search, Eye, RefreshCw, Download, Printer, Filter, CheckSquare, Square,
  SlidersHorizontal, ChevronLeft, ChevronRight, Store, Truck, Phone, FileText, Plus, X
} from "lucide-react";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";
import { OrderDetailsDrawer } from "./order-details-drawer";
import { CreateOrderDrawer } from "./create-order-drawer";

export const OrdersPanel = memo(function OrdersPanel() {
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [branches, setBranches] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  // Initial Filter State from URL
  const [search, setSearch] = useState(searchParams?.get("q") || searchParams?.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams?.get("status") || "all");
  const [branchFilter, setBranchFilter] = useState(searchParams?.get("branch_id") || searchParams?.get("branch") || "all");
  const [cityFilter, setCityFilter] = useState(searchParams?.get("city") || searchParams?.get("city_id") || "all");
  const [paymentFilter, setPaymentFilter] = useState(searchParams?.get("payment_status") || searchParams?.get("paymentStatus") || "all");
  const [fromDate, setFromDate] = useState(searchParams?.get("from_date") || "");
  const [toDate, setToDate] = useState(searchParams?.get("to_date") || "");
  const [datePreset, setDatePreset] = useState(searchParams?.get("date_preset") || searchParams?.get("datePreset") || "all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  const [page, setPage] = useState(Number(searchParams?.get("page")) || 1);
  const limit = 25;

  // Load Active Branches and Cities
  useEffect(() => {
    apiClient.getAdminBranches().then((res: any) => {
      const list = res?.branches || (Array.isArray(res) ? res : []);
      if (Array.isArray(list) && list.length > 0) setBranches(list);
    }).catch(() => {});
    apiClient.getAdminCities().then((res: any) => {
      const list = res?.cities || (Array.isArray(res) ? res : []);
      if (Array.isArray(list) && list.length > 0) setCities(list);
    }).catch(() => {});
  }, []);

  // Synchronize URL with active filter state
  const syncUrl = useCallback((updates: Record<string, string | number>) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "orders");
    
    Object.entries(updates).forEach(([key, val]) => {
      if (!val || val === "all" || (key === "page" && Number(val) === 1)) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, String(val));
      }
    });

    window.history.replaceState(null, "", url.toString());
  }, []);

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);

    let nextFrom = "";
    let nextTo = "";

    if (preset === "all") {
      nextFrom = "";
      nextTo = "";
    } else if (preset === "today") {
      nextFrom = formatDate(now);
      nextTo = formatDate(now);
    } else if (preset === "yesterday") {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      nextFrom = formatDate(y);
      nextTo = formatDate(y);
    } else if (preset === "last_7_days") {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      nextFrom = formatDate(d);
      nextTo = formatDate(now);
    } else if (preset === "last_30_days") {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      nextFrom = formatDate(d);
      nextTo = formatDate(now);
    } else if (preset === "last_90_days") {
      const d = new Date(now); d.setDate(d.getDate() - 89);
      nextFrom = formatDate(d);
      nextTo = formatDate(now);
    } else if (preset === "this_month") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      nextFrom = formatDate(d);
      nextTo = formatDate(now);
    } else if (preset === "last_month") {
      const d1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const d2 = new Date(now.getFullYear(), now.getMonth(), 0);
      nextFrom = formatDate(d1);
      nextTo = formatDate(d2);
    } else if (preset === "this_year") {
      const d = new Date(now.getFullYear(), 0, 1);
      nextFrom = formatDate(d);
      nextTo = formatDate(now);
    } else if (preset === "financial_year") {
      const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
      nextFrom = formatDate(fyStart);
      nextTo = formatDate(now);
    }

    setFromDate(nextFrom);
    setToDate(nextTo);
    syncUrl({
      date_preset: preset,
      from_date: nextFrom,
      to_date: nextTo,
      page: 1,
    });
  };

  const handleClearAllFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setBranchFilter("all");
    setCityFilter("all");
    setPaymentFilter("all");
    setDatePreset("all");
    setFromDate("");
    setToDate("");
    setPage(1);
    syncUrl({
      q: "",
      status: "all",
      branch_id: "all",
      city: "all",
      payment_status: "all",
      date_preset: "all",
      from_date: "",
      to_date: "",
      page: 1,
    });
  };

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "all" ||
    branchFilter !== "all" ||
    cityFilter !== "all" ||
    paymentFilter !== "all" ||
    datePreset !== "all" ||
    fromDate !== "" ||
    toDate !== "";

  // Selected Order Drawer State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");

  // Column Visibility State (Completely decoupled from domain filters)
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    order_number: true,
    customer: true,
    phone: true,
    branch: true,
    delivery_type: true,
    status: true,
    payment_status: true,
    total: true,
    delivery_date: true,
    actions: true,
  });

  const fetchOrders = useCallback(() => {
    setLoading(true);
    setError(null);
    const offset = (page - 1) * limit;
    apiClient
      .getAdminOrders({
        q: search,
        status: statusFilter,
        branch_id: branchFilter,
        city: cityFilter,
        payment_status: paymentFilter,
        date_preset: datePreset,
        from_date: fromDate,
        to_date: toDate,
        limit,
        offset,
      })
      .then((r: any) => {
        const list = r?.orders || r?.data || [];
        setOrders(Array.isArray(list) ? list : []);
        setTotalCount(r?.total ?? r?.count ?? (Array.isArray(list) ? list.length : 0));
      })
      .catch((err) => {
        if (err?.name === "AbortError") {
          return;
        }
        console.error("[Orders Command Center Error] Failed to fetch orders:", err);
        setError(err.message || "Failed to load orders");
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [page, search, statusFilter, branchFilter, cityFilter, paymentFilter, datePreset, fromDate, toDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selectedOrderIds.length === 0) return;
    if (!confirm(`Apply status '${bulkStatus}' to ${selectedOrderIds.length} selected orders?`)) return;

    setLoading(true);
    try {
      await Promise.all(
        selectedOrderIds.map((id) => apiClient.updateOrderStatus(id, bulkStatus, "Bulk status update"))
      );
      setSelectedOrderIds([]);
      setBulkStatus("");
      fetchOrders();
    } catch (err: any) {
      alert(err.message || "Failed bulk status update");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res: any = await apiClient.exportAdminOrders({
        q: search,
        status: statusFilter,
        branch_id: branchFilter,
        city: cityFilter,
        payment_status: paymentFilter,
        from_date: fromDate,
        to_date: toDate,
      });
      const rows = res?.export_data || orders;
      if (!rows || rows.length === 0) {
        alert("No order data to export.");
        return;
      }

      const headers = Object.keys(rows[0]).join(",");
      const csvContent = [
        headers,
        ...rows.map((r: any) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cakes2home_orders_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Export failed.");
    }
  };

  const statusColor = (s: string) => {
    const map: Record<string, "green" | "orange" | "red" | "blue" | "grey"> = {
      delivered: "green", completed: "green", pending: "orange", confirmed: "blue",
      kitchen_accepted: "blue", preparing: "blue", packed: "purple" as any,
      out_for_delivery: "orange", cancelled: "red", refunded: "red",
    };
    return map[s?.toLowerCase()] || "grey";
  };

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full min-w-0 max-w-full">
      {/* Top Header Command Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full min-w-0">
        <div className="min-w-0">
          <Heading level="h2" className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 break-words">
            Enterprise Order Command Center
          </Heading>
          <Text className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm break-words">
            Live bakery production &amp; delivery operational management hub.
          </Text>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button size="small" onClick={() => setIsCreateOrderOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 text-xs px-3 py-1.5 shadow-sm">
            <Plus className="w-4 h-4" /> + Create Order
          </Button>
          <Button size="small" variant="secondary" onClick={handleExportCSV} className="flex items-center gap-1 text-xs">
            <Download className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
          </Button>
          <Button size="small" variant="secondary" onClick={fetchOrders} className="flex items-center gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Badge color="purple" className="px-3 py-1 text-xs font-bold font-mono">
            {totalCount} Orders Total
          </Badge>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <Button size="small" variant="secondary" onClick={fetchOrders}>Retry Fetch</Button>
        </div>
      )}

      {/* Filter & Action Toolbar */}
      <div className="p-3 sm:p-4 border rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 w-full min-w-0">
        {/* Search & Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto min-w-0">
          <div className="relative w-full md:w-72 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
            <Input
              placeholder="Search order #, customer, phone..."
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                setPage(1);
                syncUrl({ q: val, page: 1 });
              }}
              className="pl-9 text-xs"
              data-testid="orders-search-input"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs overflow-x-auto scrollbar-thin max-w-full min-w-0">
            {["all", "confirmed", "kitchen_accepted", "preparing", "out_for_delivery", "delivered", "cancelled"].map((st) => (
              <button
                key={st}
                onClick={() => { setStatusFilter(st); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-colors whitespace-nowrap ${
                  statusFilter === st ? "bg-brand-navy text-white shadow-xs border border-brand-gold/30" : "text-slate-600 dark:text-slate-300 hover:text-brand-navy dark:hover:text-brand-gold"
                }`}
              >
                {st.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Branch Hub Selector */}
            <select
              value={branchFilter}
              onChange={(e) => {
                const val = e.target.value;
                setBranchFilter(val);
                setPage(1);
                syncUrl({ branch_id: val, page: 1 });
              }}
              className="p-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs"
              data-testid="branch-filter"
            >
              <option value="all">All Branch Hubs</option>
              {branches.length > 0 ? (
                branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="br_indiranagar">Indiranagar Flagship</option>
                  <option value="br_koramangala">Koramangala Gourmet</option>
                  <option value="br_whitefield">Whitefield Central</option>
                  <option value="br_hsr">HSR Layout Kitchen</option>
                </>
              )}
            </select>

            {/* City Selector */}
            <select
              value={cityFilter}
              onChange={(e) => {
                const val = e.target.value;
                setCityFilter(val);
                setPage(1);
                syncUrl({ city: val, page: 1 });
              }}
              className="p-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs"
              data-testid="city-filter"
            >
              <option value="all">All Cities</option>
              {cities.length > 0 ? (
                cities.map((c) => (
                  <option key={c.id || c.slug} value={c.slug || c.name.toLowerCase()}>
                    {c.name}
                  </option>
                ))
              ) : (
                <>
                  <option value="bengaluru">Bengaluru</option>
                  <option value="mumbai">Mumbai</option>
                  <option value="delhi">Delhi NCR</option>
                  <option value="kochi">Kochi</option>
                </>
              )}
            </select>

            {/* Payment Status Selector */}
            <select
              value={paymentFilter}
              onChange={(e) => {
                const val = e.target.value;
                setPaymentFilter(val);
                setPage(1);
                syncUrl({ payment_status: val, page: 1 });
              }}
              className="p-2 border rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs"
              data-testid="payment-filter"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid / Captured</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
            </select>

            {/* Date Preset Selector */}
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="p-2 border rounded-xl bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-brand-gold font-extrabold text-xs border-brand-navy/20"
              data-testid="date-preset-filter"
            >
              <option value="all">📅 All Time (Any Date)</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="last_90_days">Last 90 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <option value="financial_year">Financial Year</option>
              <option value="custom">Custom Date Range...</option>
            </select>

            {/* Custom Date Inputs */}
            {datePreset === "custom" && (
              <div className="flex items-center gap-1.5 bg-brand-light dark:bg-brand-navy/40 p-1 rounded-xl border border-brand-primary/30">
                <span className="text-[10px] font-bold text-brand-navy dark:text-brand-primary/30">From:</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFromDate(val);
                    setPage(1);
                    syncUrl({ from_date: val, page: 1 });
                  }}
                  className="h-7 text-xs w-32"
                  data-testid="from-date-input"
                />
                <span className="text-[10px] font-bold text-brand-navy dark:text-brand-primary/30">To:</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setToDate(val);
                    setPage(1);
                    syncUrl({ to_date: val, page: 1 });
                  }}
                  className="h-7 text-xs w-32"
                  data-testid="to-date-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                    setDatePreset("all");
                    syncUrl({ date_preset: "all", from_date: "", to_date: "", page: 1 });
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-700 font-bold px-1"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <Button
                size="small"
                variant="secondary"
                onClick={handleClearAllFilters}
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                data-testid="clear-filters-button"
              >
                <X className="w-3.5 h-3.5" /> Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Bulk Action & Column Visibility Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {selectedOrderIds.length > 0 && (
            <div className="flex items-center gap-2 bg-brand-navy/10 dark:bg-brand-navy/30 p-1.5 rounded-xl border border-brand-navy/20 text-xs">
              <span className="font-bold text-brand-navy dark:text-brand-gold">{selectedOrderIds.length} Selected</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="p-1 border rounded-lg bg-white dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="">Bulk Action...</option>
                <option value="confirmed">Set Confirmed</option>
                <option value="kitchen_accepted">Set Kitchen Accepted</option>
                <option value="preparing">Set Preparing</option>
                <option value="packed">Set Packed</option>
                <option value="out_for_delivery">Set Out for Delivery</option>
                <option value="delivered">Set Delivered</option>
                <option value="cancelled">Set Cancelled</option>
              </select>
              <Button size="small" onClick={handleBulkStatusChange} className="bg-brand-navy hover:bg-brand-deep text-white text-xs">Apply</Button>
            </div>
          )}

          <div className="relative">
            <Button size="small" variant="secondary" onClick={() => setShowColumnMenu(!showColumnMenu)} className="text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Columns
            </Button>
            {showColumnMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border rounded-xl shadow-xl p-3 z-30 space-y-1.5 text-xs">
                <p className="font-bold text-slate-500 uppercase text-[10px] mb-1">Toggle Table Columns</p>
                {Object.keys(visibleColumns).map((col) => (
                  <label key={col} className="flex items-center gap-2 cursor-pointer font-medium hover:text-brand-navy dark:hover:text-brand-gold">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col]}
                      onChange={() => toggleColumn(col)}
                      className="rounded"
                    />
                    <span className="capitalize">{col.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Command Table Container */}
      <WidgetErrorBoundary moduleName="Orders Table Grid" onRetry={fetchOrders} compact>
        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : error && orders.length === 0 ? (
          <Container className="p-12 text-center flex flex-col gap-2 items-center border rounded-2xl bg-white dark:bg-slate-900" data-testid="orders-error-state">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-2xl">⚠️</div>
            <Text className="font-bold text-rose-700 dark:text-rose-400">
              {error}
            </Text>
            <Button size="small" variant="secondary" onClick={fetchOrders} className="mt-2 text-xs">
              <RefreshCw className="w-3 h-3 mr-1" /> Retry Loading Orders
            </Button>
          </Container>
        ) : orders.length === 0 ? (
          <Container className="p-12 text-center flex flex-col gap-2 items-center border rounded-2xl bg-white dark:bg-slate-900" data-testid="orders-empty-state">
            <div className="w-12 h-12 rounded-full bg-brand-navy/10 dark:bg-brand-navy/30 flex items-center justify-center text-2xl">🎂</div>
            <Text className="font-bold text-slate-700 dark:text-slate-200">
              {hasActiveFilters ? "No orders found matching the active filter combination." : "No orders found in the database."}
            </Text>
            <Text className="text-xs text-slate-500">
              {hasActiveFilters ? "Try broadening or resetting your active filter selections." : "New customer orders will appear here automatically."}
            </Text>
            {hasActiveFilters ? (
              <Button size="small" variant="secondary" onClick={handleClearAllFilters} className="mt-2 text-xs text-rose-600 border-rose-200" data-testid="empty-clear-filters">
                <X className="w-3 h-3 mr-1" /> Reset All Filters
              </Button>
            ) : (
              <Button size="small" variant="secondary" onClick={fetchOrders} className="mt-2 text-xs">
                <RefreshCw className="w-3 h-3 mr-1" /> Retry Loading Orders
              </Button>
            )}
          </Container>
        ) : (
          <Container className="p-0 overflow-hidden border rounded-2xl shadow-sm w-full min-w-0 max-w-full">
            <div className="overflow-x-auto w-full min-w-0 max-w-full scrollbar-thin">
              <table className="w-full text-xs text-left">
                {/* Sticky Header */}
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-ui-border-base text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] z-10">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <button onClick={toggleSelectAll}>
                        {selectedOrderIds.length === orders.length ? (
                          <CheckSquare className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    {visibleColumns.order_number && <th className="p-3.5">Order #</th>}
                    {visibleColumns.customer && <th className="p-3.5">Customer Name</th>}
                    {visibleColumns.phone && <th className="p-3.5">Phone / Contact</th>}
                    {visibleColumns.branch && <th className="p-3.5">Branch Hub</th>}
                    {visibleColumns.delivery_type && <th className="p-3.5">Delivery Slot</th>}
                    {visibleColumns.status && <th className="p-3.5">Status</th>}
                    {visibleColumns.payment_status && <th className="p-3.5">Payment</th>}
                    {visibleColumns.total && <th className="p-3.5 text-right">Total Amount</th>}
                    {visibleColumns.delivery_date && <th className="p-3.5">Delivery Date</th>}
                    {visibleColumns.actions && <th className="p-3.5 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orders.map((o: any) => {
                    const isSelected = selectedOrderIds.includes(o.id);
                    return (
                      <tr
                        key={o.id}
                        className={`hover:bg-brand-navy/5 dark:hover:bg-brand-navy/20 transition-colors ${
                          isSelected ? "bg-brand-navy/10 dark:bg-brand-navy/30" : ""
                        }`}
                        data-testid={`order-row-${o.id}`}
                      >
                        <td className="p-3.5 text-center">
                          <button onClick={() => toggleSelectOrder(o.id)}>
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </td>

                        {visibleColumns.order_number && (
                          <td className="p-3.5">
                            <span className="font-mono font-extrabold text-brand-navy dark:text-brand-gold block">
                              {o.display_id || o.order_number || o.id.slice(-8)}
                            </span>
                            <span className="text-[10px] text-slate-500 block font-mono">
                              {o.created_at ? new Date(o.created_at).toLocaleDateString() : (o.id || "")}
                            </span>
                          </td>
                        )}

                        {visibleColumns.customer && (
                          <td className="p-3.5">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{o.customer_name || o.customer?.name || "Guest Customer"}</p>
                            <p className="text-[10px] text-brand-navy dark:text-brand-gold font-mono font-bold">{o.customer_number || o.customer?.customer_number || "CTH-CUST-GUEST"}</p>
                          </td>
                        )}

                        {visibleColumns.phone && (
                          <td className="p-3.5 text-slate-600 dark:text-slate-300 font-mono">
                            {o.customer_phone}
                          </td>
                        )}

                        {visibleColumns.branch && (
                          <td className="p-3.5">
                            <Badge color="purple" className="text-[10px] font-semibold">
                              {o.branch?.name || "Indiranagar Kitchen"}
                            </Badge>
                          </td>
                        )}

                        {visibleColumns.delivery_type && (
                          <td className="p-3.5">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{o.delivery_type}</p>
                            <p className="text-[10px] text-slate-400">{o.delivery_slot}</p>
                          </td>
                        )}

                        {visibleColumns.status && (
                          <td className="p-3.5">
                            <StatusBadge color={statusColor(o.status)} className="text-[10px] font-bold uppercase">
                              {o.status}
                            </StatusBadge>
                          </td>
                        )}

                        {visibleColumns.payment_status && (
                          <td className="p-3.5">
                            <Badge color={o.payment_status === "paid" || o.payment_status === "captured" ? "green" : "orange"} className="text-[10px] uppercase font-bold">
                              {o.payment_status || "paid"}
                            </Badge>
                          </td>
                        )}

                        {visibleColumns.total && (
                          <td className="p-3.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                            ₹{o.total}
                          </td>
                        )}

                        {visibleColumns.delivery_date && (
                          <td className="p-3.5 text-slate-600 dark:text-slate-300">
                            {o.delivery_date}
                          </td>
                        )}

                        {visibleColumns.actions && (
                          <td className="p-3.5 text-center">
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => setSelectedOrderId(o.id)}
                              className="text-xs bg-brand-navy/10 dark:bg-brand-navy/30 text-brand-navy dark:text-brand-gold hover:bg-brand-navy/20 font-bold border border-brand-gold/30"
                              data-testid={`inspect-order-${o.id}`}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> Inspect
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 text-xs">
              <Text className="text-slate-500 font-medium">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} orders
              </Text>
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="text-xs"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <span className="font-bold px-2 text-slate-700 dark:text-slate-300">Page {page} of {totalPages}</span>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="text-xs"
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </Container>
        )}
      </WidgetErrorBoundary>

      {/* Full 12-Section Order Details Drawer */}
      {selectedOrderId && (
        <OrderDetailsDrawer
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onRefresh={fetchOrders}
        />
      )}

      {/* Telecalling Create Order Drawer */}
      <CreateOrderDrawer
        isOpen={isCreateOrderOpen}
        onClose={() => setIsCreateOrderOpen(false)}
        onOrderCreated={(newOrder) => {
          fetchOrders();
          if (newOrder?.id) {
            setSelectedOrderId(newOrder.id);
          }
        }}
      />
    </div>
  );
});
