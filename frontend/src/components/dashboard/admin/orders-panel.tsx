"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, StatusBadge, Badge, Input, Button } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  Search, Eye, RefreshCw, Download, Printer, Filter, CheckSquare, Square,
  SlidersHorizontal, ChevronLeft, ChevronRight, Store, Truck, Phone, FileText, Plus
} from "lucide-react";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";
import { OrderDetailsDrawer } from "./order-details-drawer";
import { CreateOrderDrawer } from "./create-order-drawer";

export const OrdersPanel = memo(function OrdersPanel() {
  const [orders, setOrders] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  const [page, setPage] = useState(1);
  const limit = 25;

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);

    if (preset === "all") { setFromDate(""); setToDate(""); return; }
    if (preset === "today") { setFromDate(formatDate(now)); setToDate(formatDate(now)); return; }
    if (preset === "yesterday") {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      setFromDate(formatDate(y)); setToDate(formatDate(y)); return;
    }
    if (preset === "last_7_days") {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      setFromDate(formatDate(d)); setToDate(formatDate(now)); return;
    }
    if (preset === "last_30_days") {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      setFromDate(formatDate(d)); setToDate(formatDate(now)); return;
    }
    if (preset === "last_90_days") {
      const d = new Date(now); d.setDate(d.getDate() - 89);
      setFromDate(formatDate(d)); setToDate(formatDate(now)); return;
    }
    if (preset === "this_month") {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(formatDate(d)); setToDate(formatDate(now)); return;
    }
    if (preset === "last_month") {
      const d1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const d2 = new Date(now.getFullYear(), now.getMonth(), 0);
      setFromDate(formatDate(d1)); setToDate(formatDate(d2)); return;
    }
    if (preset === "this_year") {
      const d = new Date(now.getFullYear(), 0, 1);
      setFromDate(formatDate(d)); setToDate(formatDate(now)); return;
    }
    if (preset === "financial_year") {
      const fyStart = now.getMonth() >= 3 ? new Date(now.getFullYear(), 3, 1) : new Date(now.getFullYear() - 1, 3, 1);
      setFromDate(formatDate(fyStart)); setToDate(formatDate(now)); return;
    }
  };

  // Selected Order Drawer State
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Bulk Selection State
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");

  // Column Visibility State
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
        from_date: fromDate,
        to_date: toDate,
        limit,
        offset,
      })
      .then((r: any) => {
        const list = r?.orders || r?.data || [];
        setOrders(Array.isArray(list) ? list : []);
        setTotalCount(r?.total || list.length || 0);
      })
      .catch((err) => {
        console.error("[Orders Command Center Error] Failed to fetch orders:", err);
        setError(err.message || "Failed to load orders");
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [page, search, statusFilter, branchFilter, cityFilter, paymentFilter, fromDate, toDate]);

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
    <div className="flex flex-col gap-6">
      {/* Top Header Command Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Heading level="h2" className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            Enterprise Order Command Center
          </Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Live bakery production &amp; delivery operational management hub.
          </Text>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
      <div className="p-4 border rounded-2xl bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search & Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
            <Input
              placeholder="Search order #, customer, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs overflow-x-auto">
            {["all", "confirmed", "kitchen_accepted", "preparing", "out_for_delivery", "delivered", "cancelled"].map((st) => (
              <button
                key={st}
                onClick={() => { setStatusFilter(st); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-colors whitespace-nowrap ${
                  statusFilter === st ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300 hover:text-purple-600"
                }`}
              >
                {st.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            <select
              value={branchFilter}
              onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
              className="p-2 border rounded-xl bg-white dark:bg-slate-800 font-semibold text-xs"
            >
              <option value="all">All Branch Hubs</option>
              <option value="res_01KXYMAHGFPRY1G9TZKEVGAGAT">Indiranagar Flagship</option>
              <option value="res_02KXYMAHGFPRY1G9TZKEVGAGAT">Koramangala Gourmet</option>
              <option value="res_03KXYMAHGFPRY1G9TZKEVGAGAT">Whitefield Central</option>
            </select>

            <select
              value={cityFilter}
              onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
              className="p-2 border rounded-xl bg-white dark:bg-slate-800 font-semibold text-xs"
            >
              <option value="all">All Cities</option>
              <option value="bengaluru">Bengaluru</option>
              <option value="mumbai">Mumbai</option>
              <option value="delhi">Delhi NCR</option>
            </select>

            <select
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
              className="p-2 border rounded-xl bg-white dark:bg-slate-800 font-semibold text-xs"
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
              className="p-2 border rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 font-extrabold text-xs"
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
              <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 p-1 rounded-xl border border-purple-200">
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">From:</span>
                <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-7 text-xs w-32" />
                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">To:</span>
                <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-7 text-xs w-32" />
                <button
                  type="button"
                  onClick={() => { setFromDate(""); setToDate(""); setDatePreset("all"); }}
                  className="text-[10px] text-slate-500 hover:text-slate-700 font-bold px-1"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bulk Action & Column Visibility Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {selectedOrderIds.length > 0 && (
            <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/40 p-1.5 rounded-xl border border-purple-200 text-xs">
              <span className="font-bold text-purple-700 dark:text-purple-300">{selectedOrderIds.length} Selected</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="p-1 rounded border text-xs bg-white dark:bg-slate-800"
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
              <Button size="small" onClick={handleBulkStatusChange} className="bg-purple-600 text-white text-xs">Apply</Button>
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
                  <label key={col} className="flex items-center gap-2 cursor-pointer font-medium hover:text-purple-600">
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
        ) : orders.length === 0 ? (
          <Container className="p-12 text-center flex flex-col gap-2 items-center">
            <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-2xl">🎂</div>
            <Text className="font-bold text-slate-700 dark:text-slate-200">No orders found matching filter criteria.</Text>
            <Text className="text-xs text-slate-500">Orders placed by customers will appear here in real-time.</Text>
            <Button size="small" variant="secondary" onClick={fetchOrders} className="mt-2 text-xs">
              <RefreshCw className="w-3 h-3 mr-1" /> Retry Loading Orders
            </Button>
          </Container>
        ) : (
          <Container className="p-0 overflow-hidden border rounded-2xl shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                {/* Sticky Header */}
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-ui-border-base text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[10px] z-10">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <button onClick={toggleSelectAll}>
                        {selectedOrderIds.length === orders.length ? (
                          <CheckSquare className="w-4 h-4 text-purple-600" />
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
                        className={`hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-colors ${
                          isSelected ? "bg-purple-50 dark:bg-purple-950/30" : ""
                        }`}
                      >
                        <td className="p-3.5 text-center">
                          <button onClick={() => toggleSelectOrder(o.id)}>
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                            )}
                          </button>
                        </td>

                        {visibleColumns.order_number && (
                          <td className="p-3.5">
                            <span className="font-mono font-extrabold text-purple-700 dark:text-purple-400 block">
                              {o.order_number || o.id}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">{o.id}</span>
                          </td>
                        )}

                        {visibleColumns.customer && (
                          <td className="p-3.5">
                            <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{o.customer_name || o.customer?.name || "Guest Customer"}</p>
                            <p className="text-[10px] text-purple-600 font-mono font-bold">{o.customer_number || o.customer?.customer_number || "CTH-CUST-GUEST"}</p>
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
                              className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 hover:bg-purple-200 font-bold"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" /> View Details
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
