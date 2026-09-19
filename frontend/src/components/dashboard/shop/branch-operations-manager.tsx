"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  fetchBranchDashboard,
  fetchBranchOrders,
  fetchBranchOrderDetails,
  fetchBranchProducts,
  updateBranchProductAvailability,
  fetchBranchInventory,
  updateBranchInventoryStock,
  fetchBranchDeliveryPartners,
  fetchBranchActiveDeliveries,
  updateBranchStatus,
  updateBranchSettings,
  fetchBranchReports,
  fetchBranchNotifications,
  markBranchNotificationRead,
  acceptBranchOrder,
  markBranchOrderReady,
} from "@frontend/lib/data/manager";
import OrderDetailsDrawer from "./order-details-drawer";
import KotModal from "./kot-modal";
import InvoiceModal from "./invoice-modal";
import AssignRiderModal from "./assign-rider-modal";
import { authLogout } from "@frontend/lib/auth-service";
import { LogOut } from "lucide-react";

export default function BranchOperationsManager({ initialShop }: { initialShop?: any }) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"orders" | "products" | "inventory" | "delivery" | "notifications" | "reports" | "settings">("orders");

  // State
  const [dashboard, setDashboard] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<any[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [reportRange, setReportRange] = useState("today");

  // Modals & Drawers
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kotOrderId, setKotOrderId] = useState<string | null>(null);
  const [invoiceOrderId, setInvoiceOrderId] = useState<string | null>(null);
  const [assignRiderOrder, setAssignRiderOrder] = useState<any>(null);

  // Status pause controls
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState<any>({
    phone: "",
    whatsapp: "",
    preparation_buffer_mins: 15,
  });

  // Load all initial data
  const loadDashboardData = useCallback(async () => {
    try {
      const [dashRes, ordersRes, notifsRes] = await Promise.all([
        fetchBranchDashboard().catch(() => null),
        fetchBranchOrders({ status: statusFilter, search: searchQuery, priority: priorityFilter !== "ALL" ? priorityFilter : "" }).catch(() => ({ orders: [] })),
        fetchBranchNotifications().catch(() => ({ notifications: [] })),
      ]);

      if (dashRes && dashRes.success) {
        setDashboard(dashRes);
        setSettingsForm({
          phone: dashRes.branch?.phone || "",
          whatsapp: (dashRes.branch as any)?.whatsapp || "",
          preparation_buffer_mins: dashRes.branch?.preparation_buffer_mins || 15,
        });
      }
      if (ordersRes && ordersRes.orders) {
        setOrders(ordersRes.orders);
      }
      if (notifsRes && notifsRes.notifications) {
        setNotifications(notifsRes.notifications);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, priorityFilter]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Load tab-specific data
  useEffect(() => {
    if (activeTab === "products") {
      fetchBranchProducts().then((res) => {
        if (res.success && res.products) setProducts(res.products);
      });
    } else if (activeTab === "inventory") {
      fetchBranchInventory().then((res) => {
        if (res.success && res.items) setInventory(res.items);
      });
    } else if (activeTab === "delivery") {
      Promise.all([
        fetchBranchDeliveryPartners(),
        fetchBranchActiveDeliveries(),
      ]).then(([pRes, dRes]) => {
        if (pRes.success && pRes.partners) setDeliveryPartners(pRes.partners);
        if (dRes.success && dRes.deliveries) setActiveDeliveries(dRes.deliveries);
      });
    } else if (activeTab === "reports") {
      fetchBranchReports("sales", reportRange).then((res) => {
        if (res.success) setReportsData(res);
      });
    }
  }, [activeTab, reportRange]);

  // Branch status handler
  const handleStatusChange = async (newStatus: string, pauseMinutes?: number) => {
    try {
      setStatusUpdating(true);
      await updateBranchStatus(newStatus, pauseMinutes);
      setPauseMenuOpen(false);
      loadDashboardData();
    } finally {
      setStatusUpdating(false);
    }
  };

  // Product availability handler
  const handleProductStatusChange = async (productId: string, newStatus: string) => {
    try {
      const res = await updateBranchProductAvailability(productId, newStatus);
      if (res && (res.success || res.status === newStatus)) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, branch_status: newStatus } : p))
        );
      } else {
        alert(res?.error || res?.message || "Failed to update product availability");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update product availability");
    }
  };

  // Inventory stock update handler
  const handleStockUpdate = async (itemId: string, newStock: number) => {
    try {
      await updateBranchInventoryStock(itemId, newStock);
      setInventory((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, stock: newStock, is_low_stock: newStock <= i.low_stock_threshold } : i))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update inventory stock");
    }
  };

  // Open details drawer
  const handleOpenDetails = async (order: any) => {
    try {
      const res = await fetchBranchOrderDetails(order.id);
      if (res.success && res.order) {
        setSelectedOrder(res.order);
      } else {
        setSelectedOrder(order);
      }
      setDrawerOpen(true);
    } catch {
      setSelectedOrder(order);
      setDrawerOpen(true);
    }
  };

  // Quick accept
  const handleQuickAccept = async (orderId: string) => {
    try {
      await acceptBranchOrder(orderId);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to accept order");
    }
  };

  // Quick mark ready
  const handleQuickMarkReady = async (orderId: string) => {
    try {
      await markBranchOrderReady(orderId);
      loadDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to mark order ready");
    }
  };

  // Export report to CSV
  const handleExportCsv = () => {
    if (!reportsData || !reportsData.rows) return;
    const headers = ["Order Number", "Customer Name", "Total", "Status", "Delivery Status", "Created At"];
    const rows = reportsData.rows.map((r: any) => [
      r.order_number,
      `"${r.customer_name || ""}"`,
      r.total,
      r.status,
      r.delivery_status,
      r.created_at,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Branch_Sales_Report_${reportsData.branch_code || "HUB"}_${reportRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const branch = dashboard?.branch || initialShop || {
    name: "Indiranagar Flagship Kitchen",
    code: "HUB-BLR-01",
    is_open: true,
    is_paused: false,
    manager_name: "Branch Manager",
  };

  const kpis = dashboard?.kpis || {
    todays_orders: 0,
    pending_orders: 0,
    preparing_orders: 0,
    ready_orders: 0,
    in_transit_orders: 0,
    delivered_orders: 0,
    cancelled_orders: 0,
    delayed_orders: 0,
    online_riders: 0,
    low_stock_items: 0,
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-16">
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TOP OPERATIONAL BAR & STATUS CONTROLS ───────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              {branch.name}
            </h1>
            <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300">
              {branch.code}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected (SSE Live)
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manager: <b className="text-zinc-700 dark:text-zinc-200">{branch.manager_name}</b> • {branch.address || "100 Feet Rd, Indiranagar"}
          </p>
        </div>

        {/* Branch Status Switcher */}
        <div className="relative flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-zinc-400">Current Branch Mode</p>
            <p className="text-xs font-bold">
              {branch.is_paused ? (
                <span className="text-amber-600 dark:text-amber-400">
                  ⏸ Paused ({branch.pause_remaining_minutes || 0}m left)
                </span>
              ) : branch.is_open ? (
                <span className="text-emerald-600 dark:text-emerald-400">🟢 OPEN & Accepting Orders</span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400">🔴 CLOSED</span>
              )}
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setPauseMenuOpen(!pauseMenuOpen)}
              disabled={statusUpdating}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              ⚙️ Change Status ▾
            </button>

            {pauseMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 py-2 z-30 animate-in fade-in">
                <button
                  onClick={() => handleStatusChange("OPEN")}
                  className="w-full px-4 py-2 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2"
                >
                  🟢 Set Status: OPEN
                </button>
                <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                <p className="px-4 py-1 text-[10px] font-bold uppercase text-zinc-400">Pause Incoming Orders</p>
                <button
                  onClick={() => handleStatusChange("PAUSED", 15)}
                  className="w-full px-4 py-1.5 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  ⏸ Pause for 15 Minutes
                </button>
                <button
                  onClick={() => handleStatusChange("PAUSED", 30)}
                  className="w-full px-4 py-1.5 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  ⏸ Pause for 30 Minutes
                </button>
                <button
                  onClick={() => handleStatusChange("PAUSED", 60)}
                  className="w-full px-4 py-1.5 text-left text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  ⏸ Pause for 60 Minutes
                </button>
                <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                <button
                  onClick={() => handleStatusChange("CLOSED")}
                  className="w-full px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                >
                  🔴 Set Status: CLOSED
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => authLogout({ redirectUrl: "/dashboard/shop/login" })}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 text-xs font-bold flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/50 shadow-sm transition shrink-0"
            title="Sign out of Branch Manager panel"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 10 REAL OPERATIONAL KPIS ───────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Today&apos;s Orders</span>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{kpis.todays_orders}</p>
          <span className="text-[10px] text-zinc-500">Live Branch Queue</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm bg-amber-50/20">
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Acceptance</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{kpis.pending_orders}</p>
          <span className="text-[10px] text-amber-600/70">Action Required</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-sm bg-blue-50/20">
          <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Baking / Preparing</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{kpis.preparing_orders}</p>
          <span className="text-[10px] text-blue-600/70">In Kitchen</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-purple-200 dark:border-purple-900/50 shadow-sm bg-purple-50/20">
          <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Ready for Pickup</span>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{kpis.ready_orders}</p>
          <span className="text-[10px] text-purple-600/70">Packed & Staged</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-cyan-200 dark:border-cyan-900/50 shadow-sm bg-cyan-50/20">
          <span className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Out for Delivery</span>
          <p className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">{kpis.in_transit_orders}</p>
          <span className="text-[10px] text-cyan-600/70">With Riders</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Delivered Today</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{kpis.delivered_orders}</p>
          <span className="text-[10px] text-emerald-600/70">Fulfilled</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm bg-rose-50/20">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Cancelled Orders</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{kpis.cancelled_orders}</p>
          <span className="text-[10px] text-rose-600/70">Today</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-orange-200 dark:border-orange-900/50 shadow-sm bg-orange-50/20">
          <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Delayed Deliveries</span>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">{kpis.delayed_orders}</p>
          <span className="text-[10px] text-orange-600/70">Alert Active</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Online Riders</span>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{kpis.online_riders}</p>
          <span className="text-[10px] text-zinc-500">Assigned to Branch</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm bg-rose-50/20">
          <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Low Stock Items</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{kpis.low_stock_items}</p>
          <span className="text-[10px] text-rose-600/70">Reorder Alert</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── NAVIGATION TABS ─────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2 overflow-x-auto pb-1 text-sm font-semibold">
        {[
          { id: "orders", label: "📋 Orders Pipeline", count: orders.length },
          { id: "products", label: "🎂 Product Availability" },
          { id: "inventory", label: "📦 Inventory & Accessories", alert: kpis.low_stock_items > 0 },
          { id: "delivery", label: "🛵 Delivery Operations", count: kpis.online_riders },
          { id: "notifications", label: "🔔 Notifications", count: notifications.filter((n) => !n.is_read).length },
          { id: "reports", label: "📊 Reports & Exports" },
          { id: "settings", label: "⚙️ Branch Settings" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-rose-600 text-white shadow-sm font-bold"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === tab.id ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
              }`}>
                {tab.count}
              </span>
            )}
            {tab.alert && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: ORDERS PIPELINE ──────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row gap-3 justify-between items-center">
            {/* Search Input */}
            <div className="w-full md:w-80">
              <input
                type="text"
                placeholder="Search by #order, name, phone, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto text-xs">
              {[
                { id: "all", label: "All Orders" },
                { id: "pending", label: "Pending" },
                { id: "preparing", label: "Preparing" },
                { id: "ready", label: "Ready" },
                { id: "in_transit", label: "In Transit" },
                { id: "delivered", label: "Delivered" },
                { id: "delayed", label: "Delayed" },
                { id: "cancelled", label: "Cancelled" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap ${
                    statusFilter === st.id
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-bold"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Priority Filter */}
            <div className="flex gap-2 items-center text-xs">
              <span className="text-zinc-400 font-bold">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="p-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
              >
                <option value="ALL">All Priorities</option>
                <option value="EXPRESS">Express</option>
                <option value="MIDNIGHT">Midnight</option>
                <option value="NORMAL">Normal</option>
              </select>
            </div>
          </div>

          {/* Orders Grid */}
          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-sm">Loading branch orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              No branch orders match your query or filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((ord) => {
                const isPhoto = ord.is_photo_cake || !!ord.photo_url || (ord.items || []).some((i: any) => (i.title || "").toLowerCase().includes("photo"));
                return (
                  <div
                    key={ord.id}
                    className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md transition"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-zinc-900 dark:text-white">
                              #{ord.order_number || ord.id}
                            </span>
                            {ord.priority === "EXPRESS" && (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-black uppercase">
                                ⚡ EXPRESS
                              </span>
                            )}
                            {ord.priority === "MIDNIGHT" && (
                              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-black uppercase">
                                🌙 MIDNIGHT
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mt-0.5">
                            {ord.customer_name} • {ord.customer_phone}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          ord.status === "delivered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                          ord.status === "cancelled" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                          ord.status === "preparing" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                          "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}>
                          {ord.status}
                        </span>
                      </div>

                      {/* Photo Cake Badge */}
                      {isPhoto && (
                        <div className="mt-3 p-2 bg-gradient-to-r from-[#1D2F5D]/10 to-[#D4AF37]/10 dark:from-[#1D2F5D]/30 dark:to-[#142040]/30 rounded-lg border border-[#D4AF37]/30 flex items-center gap-2">
                          <span className="text-xs">📸</span>
                          <span className="text-[11px] font-bold text-[#1D2F5D] dark:text-[#D4AF37]">
                            Photo Cake Asset Attached
                          </span>
                        </div>
                      )}

                      {/* Inscription Message Preview */}
                      {ord.custom_message && (
                        <div className="mt-2 text-xs italic text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 p-2 rounded-lg border border-rose-100 dark:border-rose-900/30">
                          &ldquo;{ord.custom_message}&rdquo;
                        </div>
                      )}

                      {/* Items & Delivery Slot */}
                      <div className="mt-3 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                          {(ord.items || [])[0]?.title || "Rich Truffle Cake"}
                          {(ord.items || []).length > 1 ? ` (+${ord.items.length - 1} more)` : ""}
                        </p>
                        <p className="text-[11px]">
                          Slot: <b className="text-zinc-900 dark:text-white">{ord.delivery_slot || "2:00 PM - 4:00 PM"}</b> ({ord.delivery_date || "Today"})
                        </p>
                        <p className="text-[11px]">
                          Rider: <b className="text-zinc-900 dark:text-white">{ord.driver_name || "Unassigned"}</b>
                        </p>
                      </div>

                      {/* Quick Pickup OTP Display */}
                      {ord.pickup_otp && (
                        <div className="mt-2.5 p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/40 flex items-center justify-between text-xs">
                          <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                            🔑 Pickup OTP:
                          </span>
                          <span className="font-mono font-black text-xs px-2.5 py-0.5 bg-amber-500 text-white rounded-lg shadow-sm tracking-wider">
                            {ord.pickup_otp}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap justify-between items-center gap-2">
                      <button
                        onClick={() => handleOpenDetails(ord)}
                        className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        View Details →
                      </button>

                      <div className="flex gap-1.5">
                        {ord.status === "confirmed" || ord.status === "pending" ? (
                          <button
                            onClick={() => handleQuickAccept(ord.id)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                          >
                            ✓ Accept
                          </button>
                        ) : ord.status === "kitchen_accepted" || ord.status === "preparing" ? (
                          <button
                            onClick={() => handleQuickMarkReady(ord.id)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg shadow-sm"
                          >
                            🎂 Mark Ready
                          </button>
                        ) : null}

                        <button
                          onClick={() => setKotOrderId(ord.id)}
                          className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 font-semibold text-[11px] rounded-lg"
                        >
                          🖨️ KOT
                        </button>
                        <button
                          onClick={() => setInvoiceOrderId(ord.id)}
                          className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 font-semibold text-[11px] rounded-lg"
                        >
                          🧾 GST
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: PRODUCT AVAILABILITY MATRIX ─────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "products" && (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Branch 3-State Product Availability Matrix</h2>
              <p className="text-xs text-zinc-500">Configure catalog availability strictly for {branch.name} without mutating global products.</p>
            </div>
            <div className="flex gap-4 text-xs font-semibold">
              <span className="text-emerald-600">🟢 Available</span>
              <span className="text-amber-600">🟡 Out of Stock</span>
              <span className="text-rose-600">🔴 Hidden</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((prod) => (
              <div
                key={prod.id}
                className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3">
                    {prod.thumbnail && (
                      <img src={prod.thumbnail} alt={prod.title} className="w-12 h-12 rounded-lg object-cover" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{prod.title}</h4>
                      <p className="text-xs text-zinc-500">{prod.category} • ₹{prod.price}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-[10px] font-bold uppercase text-zinc-400 mb-1.5">Branch Availability</p>
                  <div className="grid grid-cols-3 gap-1 text-xs">
                    <button
                      onClick={() => handleProductStatusChange(prod.id, "AVAILABLE")}
                      className={`p-1.5 rounded font-bold transition text-center ${
                        prod.branch_status === "AVAILABLE"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300"
                      }`}
                    >
                      Available
                    </button>
                    <button
                      onClick={() => handleProductStatusChange(prod.id, "OUT_OF_STOCK")}
                      className={`p-1.5 rounded font-bold transition text-center ${
                        prod.branch_status === "OUT_OF_STOCK"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300"
                      }`}
                    >
                      Out of Stock
                    </button>
                    <button
                      onClick={() => handleProductStatusChange(prod.id, "HIDDEN")}
                      className={`p-1.5 rounded font-bold transition text-center ${
                        prod.branch_status === "HIDDEN"
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300"
                      }`}
                    >
                      Hidden
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: ACCESSORY & CAKE INVENTORY TRACKER ───────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "inventory" && (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Branch Accessory & Inventory Levels</h2>
              <p className="text-xs text-zinc-500">Track Candles, Knives, Toppers, Greeting Cards, and Packaging inventory at {branch.name}.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventory.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  item.is_low_stock
                    ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900"
                    : "bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{item.name}</h4>
                      <p className="text-xs text-zinc-500">{item.category_name} • SKU: {item.sku}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.stock === 0 ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                      item.is_low_stock ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Current Stock:</span>
                    <span className="font-black text-base text-zinc-900 dark:text-white">{item.stock} units</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-zinc-500">
                    <span>Low Stock Threshold:</span>
                    <span>{item.low_stock_threshold} units</span>
                  </div>
                </div>

                {/* Stock Controls */}
                <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStockUpdate(item.id, Math.max(0, item.stock - 5))}
                      className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 font-bold rounded text-xs"
                    >
                      -5
                    </button>
                    <button
                      onClick={() => handleStockUpdate(item.id, item.stock + 10)}
                      className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 font-bold rounded text-xs"
                    >
                      +10
                    </button>
                    <button
                      onClick={() => handleStockUpdate(item.id, item.stock + 50)}
                      className="px-2.5 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 font-bold rounded text-xs"
                    >
                      +50
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: DELIVERY OPERATIONS ──────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "delivery" && (
        <div className="space-y-6">
          {/* Active Deliveries Monitor */}
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Active In-Transit Branch Deliveries</h2>
            {activeDeliveries.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No active deliveries are in-transit for this branch currently.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeDeliveries.map((del, i) => (
                  <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-sm text-zinc-900 dark:text-white">#{del.order_number}</span>
                      <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 text-[10px] font-bold uppercase">
                        {del.delivery_status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 font-semibold">{del.customer_name}</p>
                    <p className="text-xs text-zinc-500 truncate">
                      {typeof del.delivery_address === "string"
                        ? del.delivery_address
                        : (del.delivery_address && typeof del.delivery_address === "object"
                            ? [(del.delivery_address as any).line1 || (del.delivery_address as any).address_1, (del.delivery_address as any).city].filter(Boolean).join(", ")
                            : "Delivery Address on File")}
                    </p>
                    <div className="mt-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs flex justify-between">
                      <span>Rider: <b className="text-zinc-800 dark:text-zinc-200">{del.rider_name}</b></span>
                      <span className="text-rose-600 font-bold">ETA: {del.eta}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Delivery Partners */}
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Eligible Branch Delivery Partners</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deliveryPartners.map((rider) => (
                <div key={rider.id} className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white">{rider.name}</h4>
                      <span className={`w-2 h-2 rounded-full ${rider.availability_status === "ONLINE" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                    </div>
                    <p className="text-xs text-zinc-500">{rider.phone} • ★ {rider.rating || 5.0}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                      Active: <b>{rider.current_active_orders || 0}/{rider.maximum_concurrent_orders || 5} orders</b>
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    rider.availability_status === "ONLINE" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-zinc-200 text-zinc-600"
                  }`}>
                    {rider.availability_status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 5: NOTIFICATION CENTER ──────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "notifications" && (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Branch Notifications & Alerts</h2>
          <div className="space-y-2.5">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-xl border flex justify-between items-center ${
                  n.is_read
                    ? "bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-800 opacity-70"
                    : "bg-white dark:bg-zinc-900 border-rose-200 dark:border-rose-900 shadow-sm"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-white">{n.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-mono">
                      {n.type}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{new Date(n.timestamp).toLocaleString("en-IN")}</p>
                </div>
                {!n.is_read && (
                  <button
                    onClick={async () => {
                      await markBranchNotificationRead(n.id);
                      setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item)));
                    }}
                    className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 text-xs font-semibold rounded-lg"
                  >
                    Mark Read
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 6: REPORTS & EXPORTS ────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "reports" && (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Branch Sales & Operational Reports</h2>
              <p className="text-xs text-zinc-500">Live operational data strictly scoped to {branch.name}.</p>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={reportRange}
                onChange={(e) => setReportRange(e.target.value)}
                className="p-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-semibold"
              >
                <option value="today">Today</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
              </select>
              <button
                onClick={handleExportCsv}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                📥 Export CSV Report
              </button>
            </div>
          </div>

          {reportsData && (
            <div className="space-y-6">
              {/* Report Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs text-zinc-400 font-bold uppercase">Total Branch Orders</span>
                  <p className="text-2xl font-black mt-1">{reportsData.metrics?.total_orders || 0}</p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs text-zinc-400 font-bold uppercase">Branch Revenue</span>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                    ₹{reportsData.metrics?.total_revenue || 0}
                  </p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs text-zinc-400 font-bold uppercase">Fulfillment SLA Rate</span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {reportsData.metrics?.fulfillment_rate || 100}%
                  </p>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs text-zinc-400 font-bold uppercase">Average Order Value</span>
                  <p className="text-2xl font-black mt-1">
                    ₹{reportsData.metrics?.average_order_value || 0}
                  </p>
                </div>
              </div>

              {/* Transactions Table */}
              <div>
                <h3 className="text-sm font-bold mb-3">Order History Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-bold uppercase text-[10px]">
                        <th className="pb-2">Order Number</th>
                        <th className="pb-2">Customer</th>
                        <th className="pb-2">Total Amount</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Created Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {(reportsData.rows || []).map((r: any, i: number) => (
                        <tr key={i} className="py-2">
                          <td className="py-2.5 font-bold">#{r.order_number}</td>
                          <td className="py-2.5">{r.customer_name}</td>
                          <td className="py-2.5 font-semibold text-rose-600">₹{r.total}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-bold text-[10px]">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-zinc-400">{new Date(r.created_at).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 7: OPERATIONAL SETTINGS ─────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6 max-w-2xl">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Local Operational Settings</h2>
            <p className="text-xs text-zinc-500">Configure store contact details, operating buffers, and hours for {branch.name}.</p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await updateBranchSettings(settingsForm);
              alert("Branch settings saved successfully!");
            }}
            className="space-y-4 text-xs"
          >
            <div>
              <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Branch Contact Phone</label>
              <input
                type="text"
                value={settingsForm.phone}
                onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">WhatsApp Hotline</label>
              <input
                type="text"
                value={settingsForm.whatsapp}
                onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Kitchen Prep Buffer (Minutes)</label>
              <input
                type="number"
                value={settingsForm.preparation_buffer_mins}
                onChange={(e) => setSettingsForm({ ...settingsForm, preparation_buffer_mins: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 font-medium"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm transition"
            >
              Save Operational Settings
            </button>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── MODALS & DRAWERS ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <OrderDetailsDrawer
        order={selectedOrder}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRefresh={() => {
          loadDashboardData();
          if (selectedOrder) handleOpenDetails(selectedOrder);
        }}
        onOpenKot={(ord) => setKotOrderId(ord.id)}
        onOpenInvoice={(ord) => setInvoiceOrderId(ord.id)}
        onOpenAssignRider={(ord) => setAssignRiderOrder(ord)}
      />

      <KotModal
        orderId={kotOrderId}
        isOpen={!!kotOrderId}
        onClose={() => setKotOrderId(null)}
      />

      <InvoiceModal
        orderId={invoiceOrderId}
        isOpen={!!invoiceOrderId}
        onClose={() => setInvoiceOrderId(null)}
      />

      <AssignRiderModal
        order={assignRiderOrder}
        isOpen={!!assignRiderOrder}
        onClose={() => setAssignRiderOrder(null)}
        onAssigned={() => loadDashboardData()}
      />
    </div>
  );
}
