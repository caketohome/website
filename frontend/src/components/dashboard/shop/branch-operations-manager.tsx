"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
  fetchBranchPurchases,
  fetchBranchPurchaseDetails,
  createBranchPurchase,
  submitBranchPurchase,
  recordBranchGrnReceipt,
  fetchSuppliers,
  fetchBranchExpenses,
  createBranchExpense,
  submitBranchExpense,
  fetchExpenseCategories,
  fetchBranchCashPosition,
  fetchBranchRiderCodCustody,
  settleRiderCodShift,
  reportCodShortage,
  fetchBranchBankDepositSlips,
  prepareBankDepositSlip,
  fetchBranchBankAccounts,
  reportBranchStockDamage,
} from "@frontend/lib/data/manager";
import OrderDetailsDrawer from "./order-details-drawer";
import KotModal from "./kot-modal";
import InvoiceModal from "./invoice-modal";
import AssignRiderModal from "./assign-rider-modal";
import { SameDayOrderAlarm, todayIST } from "./same-day-order-alarm";
import { authLogout } from "@frontend/lib/auth-service";
import {
  LogOut,
  ShoppingBag,
  Package,
  Receipt,
  Coins,
  Warehouse,
  BarChart3,
  LayoutDashboard,
  AlertTriangle,
  CheckCircle,
  Clock,
  Printer,
  FileText,
  UserCheck,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ArrowRight,
  Info,
  DollarSign,
  TrendingUp,
  Download,
} from "lucide-react";
import {
  exportBranchDailySalesCsv,
  exportBranchCashPositionCsv,
  exportBranchInventoryDamageCsv,
  triggerPrint,
} from "@frontend/lib/data/accounting-exports";

export type ManagerTab =
  | "dashboard"
  | "orders"
  | "purchases"
  | "expenses"
  | "cash"
  | "inventory"
  | "reports";

export default function BranchOperationsManager({ initialShop }: { initialShop?: any }) {
  // ── Navigation State ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ManagerTab>("dashboard");

  // ── Core Operations State ───────────────────────────────────────────────────
  const [dashboard, setDashboard] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<any[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [reportsData, setReportsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ── Filters & Search ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [deliveryDateFilter, setDeliveryDateFilter] = useState<string>("all"); // "all" | YYYY-MM-DD
  const [reportRange, setReportRange] = useState("today");

  // ── Tab 3: Purchases & GRN State ────────────────────────────────────────────
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchaseTotal, setPurchaseTotal] = useState(0);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState("ALL");
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedPurchaseForGrn, setSelectedPurchaseForGrn] = useState<any>(null);
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [grnItems, setGrnItems] = useState<any[]>([]);
  const [grnNotes, setGrnNotes] = useState("");
  const [grnSubmitting, setGrnSubmitting] = useState(false);

  // Purchase Entry Form
  const [purchaseForm, setPurchaseForm] = useState({
    supplier_id: "",
    invoice_no: "",
    invoice_date: new Date().toISOString().split("T")[0],
    payment_method: "CASH",
    due_date: "",
  });
  const [purchaseLines, setPurchaseLines] = useState<any[]>([
    { item_type: "CAKE", description: "", quantity: 1, rate: 0, discount: 0, gst_rate: 5 },
  ]);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);

  // ── Tab 4: Expenses State ───────────────────────────────────────────────────
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [expenseStatusFilter, setExpenseStatusFilter] = useState("ALL");
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    category_id: "",
    description: "",
    amount: 0,
    gst_rate: 0,
    payment_method: "CASH",
    notes: "",
  });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // ── Tab 5: Cash & Teller State ──────────────────────────────────────────────
  const [cashPosition, setCashPosition] = useState<any>(null);

  // Rider COD Settlement
  const [riderCodList, setRiderCodList] = useState<any[]>([]);
  const [selectedRiderForSettle, setSelectedRiderForSettle] = useState<any>(null);
  const [cashPresentedInput, setCashPresentedInput] = useState<string>("");
  const [settlementSubmitting, setSettlementSubmitting] = useState(false);

  // Shortage Reporting
  const [isShortageModalOpen, setIsShortageModalOpen] = useState(false);
  const [shortageRider, setShortageRider] = useState<any>(null);
  const [shortageAmount, setShortageAmount] = useState(0);
  const [shortageNotes, setShortageNotes] = useState("");
  const [shortageSubmitting, setShortageSubmitting] = useState(false);

  // Bank Deposit Slips
  const [depositSlips, setDepositSlips] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositBankAccountId, setDepositBankAccountId] = useState<string>("");
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [denominations, setDenominations] = useState<Record<string, number>>({
    notes_2000: 0,
    notes_500: 0,
    notes_200: 0,
    notes_100: 0,
    notes_50: 0,
    notes_20: 0,
    notes_10: 0,
    notes_5: 0,
    coins: 0,
  });
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  // ── Tab 6: Inventory & Spoilage State ───────────────────────────────────────
  const [inventoryAccountFilter, setInventoryAccountFilter] = useState<string>("ALL");
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [damageItem, setDamageItem] = useState<any>(null);
  const [damageQty, setDamageQty] = useState(1);
  const [damageReason, setDamageReason] = useState("EXPIRED");
  const [damageNotes, setDamageNotes] = useState("");
  const [damageSubmitting, setDamageSubmitting] = useState(false);

  // ── Modals & Drawers ────────────────────────────────────────────────────────
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kotOrderId, setKotOrderId] = useState<string | null>(null);
  const [invoiceOrderId, setInvoiceOrderId] = useState<string | null>(null);
  const [assignRiderOrder, setAssignRiderOrder] = useState<any>(null);
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // ── Operational Settings ────────────────────────────────────────────────────
  const [settingsForm, setSettingsForm] = useState<any>({
    phone: "",
    whatsapp: "",
    preparation_buffer_mins: 15,
  });

  // ── Load Dashboard & Initial Queue Data ─────────────────────────────────────
  const loadDashboardData = useCallback(async () => {
    try {
      const [dashRes, ordersRes, notifsRes, cashPosRes] = await Promise.all([
        fetchBranchDashboard().catch(() => null),
        fetchBranchOrders({
          status: statusFilter,
          search: searchQuery,
          priority: priorityFilter !== "ALL" ? priorityFilter : "",
          pageSize: "100",
        }).catch(() => ({ orders: [] })),
        fetchBranchNotifications().catch(() => ({ notifications: [] })),
        fetchBranchCashPosition().catch(() => null),
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
      if (cashPosRes && cashPosRes.success) {
        setCashPosition(cashPosRes);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, priorityFilter]);

  useEffect(() => {
    loadDashboardData();
    const t = setInterval(loadDashboardData, 20_000);
    return () => clearInterval(t);
  }, [loadDashboardData]);

  const visibleOrders = useMemo(
    () => (deliveryDateFilter === "all" ? orders : orders.filter((o) => String(o.delivery_date || "").slice(0, 10) === deliveryDateFilter)),
    [orders, deliveryDateFilter]
  );

  // ── Tab-Specific Data Loader ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === "purchases") {
      fetchBranchPurchases(purchaseStatusFilter !== "ALL" ? { status: purchaseStatusFilter } : {}).then((res) => {
        if (res.success && res.data) {
          setPurchases(res.data.purchases || []);
          setPurchaseTotal(res.data.total || 0);
        }
      });
      fetchSuppliers().then((res) => {
        if (res.success && res.data) setSuppliers(res.data.suppliers || []);
      });
    } else if (activeTab === "expenses") {
      fetchBranchExpenses(expenseStatusFilter !== "ALL" ? { status: expenseStatusFilter } : {}).then((res) => {
        if (res.success && res.data) {
          setExpenses(res.data.expenses || []);
          setExpenseTotal(res.data.total || 0);
        }
      });
      fetchExpenseCategories().then((res) => {
        if (res.success && res.data) setExpenseCategories(res.data.categories || []);
      });
    } else if (activeTab === "cash") {
      fetchBranchCashPosition().then((res) => {
        if (res.success) setCashPosition(res);
      });
      fetchBranchRiderCodCustody().then((res) => {
        if (res.success) setRiderCodList(res.riders || []);
      });
      fetchBranchBankDepositSlips().then((res) => {
        if (res.success) setDepositSlips(res.slips || []);
      });
      fetchBranchBankAccounts().then((res) => {
        if (res.success) setBankAccounts(res.bankAccounts || []);
      });
    } else if (activeTab === "inventory") {
      fetchBranchInventory().then((res) => {
        if (res.success && res.items) setInventory(res.items);
      });
      fetchBranchProducts().then((res) => {
        if (res.success && res.products) setProducts(res.products);
      });
    } else if (activeTab === "reports") {
      fetchBranchReports("sales", reportRange).then((res) => {
        if (res.success) setReportsData(res);
      });
    }
  }, [activeTab, purchaseStatusFilter, expenseStatusFilter, reportRange]);

  // ── Status Switcher ─────────────────────────────────────────────────────────
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

  // ── Denomination Math ───────────────────────────────────────────────────────
  const computedDenominationsTotal = useMemo(() => {
    return (
      (denominations.notes_2000 || 0) * 2000 +
      (denominations.notes_500 || 0) * 500 +
      (denominations.notes_200 || 0) * 200 +
      (denominations.notes_100 || 0) * 100 +
      (denominations.notes_50 || 0) * 50 +
      (denominations.notes_20 || 0) * 20 +
      (denominations.notes_10 || 0) * 10 +
      (denominations.notes_5 || 0) * 5 +
      (denominations.coins || 0) * 1
    );
  }, [denominations]);

  // ── Purchase Lines Math ─────────────────────────────────────────────────────
  const computedPurchaseTotals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxable = 0;
    let totalGst = 0;
    let grandTotal = 0;

    for (const line of purchaseLines) {
      const lineSub = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
      const lineDisc = Number(line.discount) || 0;
      const lineTaxable = Math.max(0, lineSub - lineDisc);
      const gstRate = Number(line.gst_rate) || 0;
      const lineGst = (lineTaxable * gstRate) / 100;
      const lineTotal = lineTaxable + lineGst;

      subtotal += lineSub;
      totalDiscount += lineDisc;
      taxable += lineTaxable;
      totalGst += lineGst;
      grandTotal += lineTotal;
    }

    return { subtotal, totalDiscount, taxable, totalGst, grandTotal };
  }, [purchaseLines]);

  // ── Inventory Category Mapping (Locked CoA Invariant 2) ─────────────────────
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const cat = (item.category_name || item.name || "").toLowerCase();
      const isPkg = cat.includes("box") || cat.includes("packaging") || cat.includes("board") || cat.includes("bag");
      const isAcc = cat.includes("candle") || cat.includes("knife") || cat.includes("topper") || cat.includes("card") || cat.includes("accessory");
      const isCake = !isPkg && !isAcc;

      if (inventoryAccountFilter === "1131") return isAcc;
      if (inventoryAccountFilter === "1132") return isCake;
      if (inventoryAccountFilter === "1133") return isPkg;
      return true;
    });
  }, [inventory, inventoryAccountFilter]);

  // ── Formatters ──────────────────────────────────────────────────────────────
  const fmt = (n: number | null | undefined) => {
    if (n == null) return "₹0.00";
    return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-20">
      <SameDayOrderAlarm onAccepted={loadDashboardData} />
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TOP OPERATIONAL HEADER & STATUS CONTROLS ────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-brand-navy dark:text-white">
              {branch.name}
            </h1>
            <span className="px-2.5 py-1 rounded-lg bg-brand-surface-muted dark:bg-zinc-800 text-xs font-mono font-bold text-brand-text-muted dark:text-zinc-300">
              {branch.code}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected (Live Branch Scope)
            </span>
          </div>
          <p className="text-xs text-brand-text-muted dark:text-zinc-400 mt-1">
            Manager: <b className="text-brand-text dark:text-zinc-200">{branch.manager_name}</b> • Operational Storefront & Fulfillment Engine
          </p>
        </div>

        {/* Branch Mode Switcher & Logout */}
        <div className="relative flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-brand-text-muted">Branch Mode</p>
            <p className="text-xs font-bold">
              {branch.is_paused ? (
                <span className="text-brand-gold dark:text-brand-gold">
                  ⏸ Paused ({branch.pause_remaining_minutes || 0}m left)
                </span>
              ) : branch.is_open ? (
                <span className="text-emerald-600 dark:text-emerald-400">🟢 OPEN & Operating</span>
              ) : (
                <span className="text-brand-primary dark:text-rose-400">🔴 CLOSED</span>
              )}
            </p>
          </div>

          <div className="relative">
            <button
              onClick={() => setPauseMenuOpen(!pauseMenuOpen)}
              disabled={statusUpdating}
              className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              ⚙️ Mode ▾
            </button>

            {pauseMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-brand-border dark:border-zinc-700 py-2 z-30 animate-in fade-in">
                <button
                  onClick={() => handleStatusChange("OPEN")}
                  className="w-full px-4 py-2 text-left text-xs font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2"
                >
                  🟢 Set Status: OPEN
                </button>
                <div className="border-t border-brand-border dark:border-zinc-700 my-1" />
                <p className="px-4 py-1 text-[10px] font-bold uppercase text-brand-text-muted">Pause Incoming Orders</p>
                <button
                  onClick={() => handleStatusChange("PAUSED", 15)}
                  className="w-full px-4 py-1.5 text-left text-xs text-brand-text dark:text-zinc-200 hover:bg-brand-surface-muted dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  ⏸ Pause for 15 Minutes
                </button>
                <button
                  onClick={() => handleStatusChange("PAUSED", 30)}
                  className="w-full px-4 py-1.5 text-left text-xs text-brand-text dark:text-zinc-200 hover:bg-brand-surface-muted dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  ⏸ Pause for 30 Minutes
                </button>
                <button
                  onClick={() => handleStatusChange("PAUSED", 60)}
                  className="w-full px-4 py-1.5 text-left text-xs text-brand-text dark:text-zinc-200 hover:bg-brand-surface-muted dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  ⏸ Pause for 60 Minutes
                </button>
                <div className="border-t border-brand-border dark:border-zinc-700 my-1" />
                <button
                  onClick={() => handleStatusChange("CLOSED")}
                  className="w-full px-4 py-2 text-left text-xs font-semibold text-brand-primary hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                >
                  🔴 Set Status: CLOSED
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => authLogout({ redirectUrl: "/dashboard/shop/login" })}
            className="px-3.5 py-2 rounded-xl bg-brand-light hover:bg-rose-100 text-brand-primary dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 text-xs font-bold flex items-center gap-1.5 border border-brand-primary/20 dark:border-rose-900/50 shadow-sm transition shrink-0"
            title="Sign out of Branch Manager panel"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 7 BOUNDED NAVIGATION TABS ───────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex border-b border-brand-border dark:border-zinc-800 gap-2 overflow-x-auto pb-1 text-sm font-semibold">
        {[
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
          { id: "orders", label: "Orders & Fulfillment", icon: ShoppingBag, count: orders.length },
          { id: "purchases", label: "Purchases & GRN", icon: Package, count: purchaseTotal },
          { id: "expenses", label: "Expenses", icon: Receipt, count: expenseTotal },
          { id: "cash", label: "Cash & Teller", icon: Coins, alert: cashPosition?.drawer_status === "CLOSED" },
          { id: "inventory", label: "Inventory", icon: Warehouse, alert: kpis.low_stock_items > 0 },
          { id: "reports", label: "Branch Reports", icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ManagerTab)}
              className={`px-4 py-2.5 rounded-xl transition whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? "bg-brand-navy text-white shadow-sm font-bold"
                  : "text-brand-text-muted dark:text-zinc-400 hover:bg-brand-surface-muted dark:hover:bg-zinc-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-brand-text dark:text-zinc-300"
                  }`}
                >
                  {tab.count}
                </span>
              )}
              {tab.alert && (
                <span className="w-2 h-2 rounded-full bg-brand-gold animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: DASHBOARD (OPERATIONAL OVERVIEW & CONTROLS) ──────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Operational Control Warnings */}
          {cashPosition?.drawer_status === "CLOSED" && (
            <div className="p-4 bg-brand-gold-light dark:bg-brand-gold-dark/40 rounded-2xl border border-brand-gold/40 dark:border-brand-gold-dark/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-brand-gold dark:text-brand-gold shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-brand-gold-dark dark:text-brand-gold">
                    Day Opening Drawer Float Pending
                  </h4>
                  <p className="text-xs text-brand-gold-dark dark:text-brand-gold">
                    Record your operational cash drawer float before counter sales reconciliation begins. (Physical drawer count only — does not alter GL 1111).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("cash")}
                className="px-3.5 py-1.5 rounded-xl bg-brand-gold hover:bg-brand-gold-dark text-white text-xs font-bold shadow-sm transition shrink-0"
              >
                Open Drawer →
              </button>
            </div>
          )}

          {kpis.low_stock_items > 0 && (
            <div className="p-4 bg-brand-light dark:bg-rose-950/40 rounded-2xl border border-brand-primary/20 dark:border-rose-900/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-brand-primary dark:text-rose-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-rose-900 dark:text-rose-200">
                    {kpis.low_stock_items} Inventory Items Below Minimum Threshold
                  </h4>
                  <p className="text-xs text-brand-primary dark:text-rose-300">
                    Accessories, packaging, or cake ingredients require stock reordering to prevent order fulfillment disruption.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("inventory")}
                className="px-3.5 py-1.5 rounded-xl bg-brand-navy hover:bg-brand-primary text-white text-xs font-bold shadow-sm transition shrink-0"
              >
                View Stock →
              </button>
            </div>
          )}

          {/* 10 Operational KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">Today&apos;s Orders</span>
              <p className="text-2xl font-black text-brand-navy dark:text-white mt-1">{kpis.todays_orders}</p>
              <span className="text-[10px] text-brand-text-muted">Live Branch Queue</span>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-gold/40 dark:border-brand-gold-dark/50 shadow-sm bg-brand-gold-light/20">
              <span className="text-[11px] font-bold text-brand-gold dark:text-brand-gold uppercase tracking-wider">Pending Acceptance</span>
              <p className="text-2xl font-black text-brand-gold dark:text-brand-gold mt-1">{kpis.pending_orders}</p>
              <span className="text-[10px] text-brand-gold/70">Action Required</span>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-sm bg-blue-50/20">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Baking / Preparing</span>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{kpis.preparing_orders}</p>
              <span className="text-[10px] text-blue-600/70">In Kitchen</span>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-primary/30 dark:border-brand-navy/50 shadow-sm bg-brand-light/20">
              <span className="text-[11px] font-bold text-brand-primary dark:text-brand-primary uppercase tracking-wider">Ready for Pickup</span>
              <p className="text-2xl font-black text-brand-primary dark:text-brand-primary mt-1">{kpis.ready_orders}</p>
              <span className="text-[10px] text-brand-primary/70">Packed & Staged</span>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-primary/30 dark:border-brand-navy/50 shadow-sm bg-brand-light/20">
              <span className="text-[11px] font-bold text-brand-primary dark:text-brand-primary uppercase tracking-wider">Out for Delivery</span>
              <p className="text-2xl font-black text-brand-primary dark:text-brand-primary mt-1">{kpis.in_transit_orders}</p>
              <span className="text-[10px] text-brand-primary/70">With Riders</span>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm bg-emerald-50/20">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Delivered Today</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{kpis.delivered_orders}</p>
              <span className="text-[10px] text-emerald-600/70">Fulfilled</span>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-primary/20 dark:border-rose-900/50 shadow-sm bg-brand-light">
              <span className="text-[11px] font-bold text-brand-primary dark:text-rose-400 uppercase tracking-wider">Cancelled Orders</span>
              <p className="text-2xl font-black text-brand-primary dark:text-rose-400 mt-1">{kpis.cancelled_orders}</p>
              <span className="text-[10px] text-brand-primary/70">Today</span>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-gold/40 dark:border-brand-gold-dark/50 shadow-sm bg-brand-gold-light/20">
              <span className="text-[11px] font-bold text-brand-gold dark:text-brand-gold uppercase tracking-wider">Delayed Deliveries</span>
              <p className="text-2xl font-black text-brand-gold dark:text-brand-gold mt-1">{kpis.delayed_orders}</p>
              <span className="text-[10px] text-brand-gold/70">Alert Active</span>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold text-brand-text-muted uppercase tracking-wider">Online Riders</span>
              <p className="text-2xl font-black text-brand-navy dark:text-white mt-1">{kpis.online_riders}</p>
              <span className="text-[10px] text-brand-text-muted">Active Partner Fleet</span>
            </div>

            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-primary/20 dark:border-rose-900/50 shadow-sm bg-brand-light">
              <span className="text-[11px] font-bold text-brand-primary dark:text-rose-400 uppercase tracking-wider">Low Stock Items</span>
              <p className="text-2xl font-black text-brand-primary dark:text-rose-400 mt-1">{kpis.low_stock_items}</p>
              <span className="text-[10px] text-brand-primary/70">Reorder Alert</span>
            </div>
          </div>

          {/* Operational Financial Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-brand-text-muted uppercase">Cash Counter Sales</span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {fmt(cashPosition?.cash_sales || 0)}
                  </p>
                  <p className="text-xs text-brand-text-muted mt-0.5">
                    {cashPosition?.cash_orders_count || 0} counter transactions today
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600">
                  <Coins className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-brand-text-muted uppercase">Active Rider COD Custody</span>
                  <p className="text-2xl font-black text-brand-gold dark:text-brand-gold mt-1">
                    {fmt(cashPosition?.cod_custody || 0)}
                  </p>
                  <p className="text-xs text-brand-text-muted mt-0.5">
                    {cashPosition?.cod_orders_count || 0} delivered orders awaiting remittance
                  </p>
                </div>
                <div className="p-3 bg-brand-gold-light dark:bg-brand-gold-dark/40 rounded-xl text-brand-gold">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-bold text-brand-text-muted uppercase">Bank Deposits Dispatched</span>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {fmt(cashPosition?.deposits_today || 0)}
                  </p>
                  <p className="text-xs text-brand-text-muted mt-0.5">
                    {cashPosition?.deposits_count || 0} deposit slips submitted today
                  </p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: ORDERS & FULFILLMENT ─────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 flex flex-col md:flex-row gap-3 justify-between items-center">
            <div className="w-full md:w-80">
              <input
                type="text"
                placeholder="Search by #order, name, phone, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-brand-border dark:border-zinc-700 bg-brand-surface-muted dark:bg-zinc-950 text-brand-navy dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>

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
                      ? "bg-brand-navy text-white dark:bg-white dark:text-zinc-900 font-bold"
                      : "bg-brand-surface-muted dark:bg-zinc-800 text-brand-text-muted dark:text-zinc-300 hover:bg-brand-surface-muted"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center text-xs">
              <span className="text-brand-text-muted font-bold">Priority:</span>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="p-1.5 text-xs rounded-lg border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 text-brand-navy dark:text-white"
              >
                <option value="ALL">All Priorities</option>
                <option value="EXPRESS">Express</option>
                
                <option value="NORMAL">Normal</option>
              </select>
            </div>
          </div>


          {/* Delivery date filter */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-brand-text-muted">Delivery date:</span>
            {[
              { v: "all", l: "All" },
              { v: todayIST(), l: "Today" },
              { v: todayIST(1), l: "Tomorrow" },
            ].map((d) => (
              <button
                key={d.l}
                type="button"
                onClick={() => setDeliveryDateFilter(d.v)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  deliveryDateFilter === d.v ? "bg-brand-navy text-white" : "bg-white border border-brand-border text-brand-text hover:bg-brand-surface-muted"
                }`}
              >
                {d.l}
              </button>
            ))}
            <input
              type="date"
              aria-label="Pick a delivery date"
              value={deliveryDateFilter === "all" ? "" : deliveryDateFilter}
              onChange={(e) => setDeliveryDateFilter(e.target.value || "all")}
              className="px-2.5 py-1.5 rounded-lg border border-brand-border bg-white text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
            {deliveryDateFilter !== "all" && (
              <span className="text-brand-text-muted">{visibleOrders.length} of {orders.length} orders</span>
            )}
          </div>

          {/* Orders Grid */}
          {loading ? (
            <div className="p-12 text-center text-brand-text-muted text-sm">Loading branch orders...</div>
          ) : visibleOrders.length === 0 ? (
            <div className="p-12 text-center text-brand-text-muted text-sm bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800">
              No branch orders match your query or filter criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleOrders.map((ord) => {
                const isPhoto = ord.is_photo_cake || !!ord.photo_url || (ord.items || []).some((i: any) => (i.title || "").toLowerCase().includes("photo"));
                return (
                  <div
                    key={ord.id}
                    className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm flex flex-col justify-between hover:shadow-md transition"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-brand-navy dark:text-white">
                              #{ord.order_number || ord.id}
                            </span>
                            {String(ord.delivery_date || "").slice(0, 10) === todayIST() ? (
                              <span className="px-2 py-0.5 rounded bg-[#FDECEC] text-[#C93636] text-[10px] font-bold uppercase">Today</span>
                            ) : ord.delivery_date && String(ord.delivery_date).slice(0, 10) > todayIST() ? (
                              <span className="px-2 py-0.5 rounded bg-brand-light text-brand-primary text-[10px] font-bold uppercase">Pre-order · {String(ord.delivery_date).slice(0, 10)}</span>
                            ) : null}
                            {ord.priority === "EXPRESS" && (
                              <span className="px-2 py-0.5 rounded bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold text-[10px] font-black uppercase">
                                ⚡ EXPRESS
                              </span>
                            )}
                            {ord.priority === "MIDNIGHT" && (
                              <span className="px-2 py-0.5 rounded bg-brand-light text-brand-navy dark:bg-brand-navy dark:text-brand-primary text-[10px] font-black uppercase">
                                🌙 MIDNIGHT
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-brand-text dark:text-zinc-300 mt-0.5">
                            {ord.customer_name} • {ord.customer_phone}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          ord.status === "delivered" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                          ord.status === "cancelled" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                          ord.status === "preparing" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                          "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold"
                        }`}>
                          {ord.status}
                        </span>
                      </div>

                      {isPhoto && (
                        <div className="mt-3 p-2 bg-gradient-to-r from-brand-navy/10 to-brand-gold/10 dark:from-brand-navy/30 dark:to-brand-navy/30 rounded-lg border border-brand-gold/30 flex items-center gap-2">
                          <span className="text-xs">📸</span>
                          <span className="text-[11px] font-bold text-brand-navy dark:text-brand-gold">
                            Photo Cake Asset Attached
                          </span>
                        </div>
                      )}

                      {ord.custom_message && (
                        <div className="mt-2 text-xs italic text-brand-primary dark:text-rose-400 bg-brand-light dark:bg-rose-950/20 p-2 rounded-lg border border-brand-primary/20 dark:border-rose-900/30">
                          &ldquo;{ord.custom_message}&rdquo;
                        </div>
                      )}

                      <div className="mt-3 text-xs text-brand-text-muted dark:text-zinc-400 space-y-1">
                        <p className="font-semibold text-brand-text dark:text-zinc-200">
                          {(ord.items || [])[0]?.title || "Gourmet Cake Item"}
                          {(ord.items || []).length > 1 ? ` (+${ord.items.length - 1} more)` : ""}
                        </p>
                        <p className="text-[11px]">
                          Slot: <b className="text-brand-navy dark:text-white">{ord.delivery_slot || "Standard Slot"}</b> ({ord.delivery_date || "Today"})
                        </p>
                        <p className="text-[11px]">
                          Rider: <b className="text-brand-navy dark:text-white">{ord.driver_name || "Unassigned"}</b>
                        </p>
                      </div>

                      {ord.pickup_otp && (
                        <div className="mt-2.5 p-2 bg-brand-gold-light dark:bg-brand-gold-dark/40 rounded-xl border border-brand-gold/40 dark:border-brand-gold-dark/40 flex items-center justify-between text-xs">
                          <span className="font-bold text-brand-gold-dark dark:text-brand-gold flex items-center gap-1">
                            🔑 Pickup OTP:
                          </span>
                          <span className="font-mono font-black text-xs px-2.5 py-0.5 bg-brand-gold text-white rounded-lg shadow-sm tracking-wider">
                            {ord.pickup_otp}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-brand-border dark:border-zinc-800 flex flex-wrap justify-between items-center gap-2">
                      <button
                        onClick={async () => {
                          const res = await fetchBranchOrderDetails(ord.id).catch(() => ({ order: ord }));
                          setSelectedOrder(res.order || ord);
                          setDrawerOpen(true);
                        }}
                        className="text-xs font-bold text-brand-primary dark:text-rose-400 hover:underline"
                      >
                        View Details →
                      </button>

                      <div className="flex gap-1.5">
                        {ord.status === "confirmed" || ord.status === "pending" ? (
                          <button
                            onClick={async () => {
                              await acceptBranchOrder(ord.id);
                              loadDashboardData();
                            }}
                            className="px-2.5 py-1 bg-brand-navy hover:bg-brand-primary text-white font-bold text-[11px] rounded-lg shadow-sm"
                          >
                            ✓ Accept
                          </button>
                        ) : ord.status === "kitchen_accepted" || ord.status === "preparing" ? (
                          <button
                            onClick={async () => {
                              await markBranchOrderReady(ord.id);
                              loadDashboardData();
                            }}
                            className="px-2.5 py-1 bg-brand-primary hover:bg-brand-secondary text-white font-bold text-[11px] rounded-lg shadow-sm"
                          >
                            🎂 Mark Ready
                          </button>
                        ) : null}

                        <button
                          onClick={() => setKotOrderId(ord.id)}
                          className="px-2.5 py-1 bg-brand-surface-muted dark:bg-zinc-800 hover:bg-brand-surface-muted text-brand-text dark:text-zinc-200 font-semibold text-[11px] rounded-lg"
                        >
                          🖨️ KOT
                        </button>
                        <button
                          onClick={() => setInvoiceOrderId(ord.id)}
                          className="px-2.5 py-1 bg-brand-surface-muted dark:bg-zinc-800 hover:bg-brand-surface-muted text-brand-text dark:text-zinc-200 font-semibold text-[11px] rounded-lg"
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
      {/* ── TAB 3: PURCHASES & GRN ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "purchases" && (
        <div className="space-y-6">
          {/* Invariant 1 Policy Banner */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900/60 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
              <p className="font-bold">
                Operational Goods Receipt Note (GRN) & Purchase Flow:
              </p>
              <p>
                Recording a GRN confirms physical stock receipt at this branch. Accounting posting to Inventory (1131/1132/1133), Accounts Payable (2111), and Input GST follows the canonical sequence: <b>Purchase → Accounting Approval → Voucher → General Ledger Posting</b>.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-2 text-xs">
              {["ALL", "DRAFT", "SUBMITTED", "APPROVED", "POSTED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setPurchaseStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    purchaseStatusFilter === s
                      ? "bg-brand-navy text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-brand-text-muted dark:text-zinc-400 border border-brand-border dark:border-zinc-800"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsPurchaseModalOpen(true)}
              className="px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Purchase Entry / PO
            </button>
          </div>

          {/* Purchases Table */}
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-brand-border dark:border-zinc-800 text-brand-text-muted font-bold uppercase text-[10px]">
                  <th className="pb-3">Invoice / PO #</th>
                  <th className="pb-3">Supplier</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Taxable Value</th>
                  <th className="pb-3">GST Total</th>
                  <th className="pb-3">Grand Total</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-zinc-800">
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-brand-text-muted">
                      No branch purchases found.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p.id} className="py-2.5">
                      <td className="py-3 font-bold text-brand-navy dark:text-white">
                        {p.invoice_no || `PO-${p.id.slice(-6)}`}
                      </td>
                      <td className="py-3 font-semibold">{p.supplier_name || p.supplier_id || "Unassigned"}</td>
                      <td className="py-3 text-brand-text-muted">{p.invoice_date || new Date(p.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 font-mono">{fmt(p.taxable_value)}</td>
                      <td className="py-3 font-mono">{fmt((p.cgst || 0) + (p.sgst || 0) + (p.igst || 0))}</td>
                      <td className="py-3 font-bold text-brand-primary dark:text-rose-400 font-mono">{fmt(p.total)}</td>
                      <td className="py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            p.status === "POSTED"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : p.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : p.status === "SUBMITTED"
                              ? "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold"
                              : "bg-brand-surface-muted text-brand-text dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 text-right space-x-2">
                        {p.status === "DRAFT" && (
                          <button
                            onClick={async () => {
                              await submitBranchPurchase(p.id);
                              fetchBranchPurchases().then((res) => {
                                if (res.success && res.data) setPurchases(res.data.purchases || []);
                              });
                            }}
                            className="px-2.5 py-1 bg-brand-gold hover:bg-brand-gold-dark text-white font-bold text-[10px] rounded-lg"
                          >
                            Submit
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            const details = await fetchBranchPurchaseDetails(p.id).catch(() => ({ data: p }));
                            setSelectedPurchaseForGrn(details.data || p);
                            setGrnItems(
                              (details.data?.items || []).map((i: any) => ({
                                item_id: i.id || i.product_id,
                                description: i.description || i.product_name,
                                quantity_ordered: Number(i.quantity || 1),
                                quantity_received: Number(i.quantity || 1),
                                condition: "GOOD",
                              }))
                            );
                            setIsGrnModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-brand-surface-muted hover:bg-brand-surface-muted dark:bg-zinc-800 dark:hover:bg-zinc-700 text-brand-text dark:text-zinc-200 font-bold text-[10px] rounded-lg"
                        >
                          📦 Record GRN
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: EXPENSES ─────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          {/* Invariant 3 Policy Banner */}
          <div className="p-4 bg-brand-light dark:bg-brand-navy/40 rounded-2xl border border-brand-primary/30 dark:border-brand-navy/60 flex items-start gap-3">
            <Info className="w-5 h-5 text-brand-primary dark:text-brand-primary shrink-0 mt-0.5" />
            <div className="text-xs text-brand-navy dark:text-brand-primary space-y-1">
              <p className="font-bold">
                Operational Expense Claims & Control:
              </p>
              <p>
                Branch managers enter store expenses without hardcoding accounting accruals. Approved expense vouchers are credited to <b>2111 Accounts Payable</b> by Central Accounting.
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-2 text-xs">
              {["ALL", "DRAFT", "SUBMITTED", "APPROVED", "POSTED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setExpenseStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    expenseStatusFilter === s
                      ? "bg-brand-navy text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-brand-text-muted dark:text-zinc-400 border border-brand-border dark:border-zinc-800"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Record Store Expense
            </button>
          </div>

          {/* Expenses Table */}
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-brand-border dark:border-zinc-800 text-brand-text-muted font-bold uppercase text-[10px]">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Description</th>
                  <th className="pb-3">Payment Method</th>
                  <th className="pb-3">Total Amount</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border dark:divide-zinc-800">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-brand-text-muted">
                      No branch expenses found.
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="py-2.5">
                      <td className="py-3 text-brand-text-muted">{e.expense_date || new Date(e.created_at).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 font-semibold">{e.category_name || "Operational"}</td>
                      <td className="py-3 font-medium text-brand-navy dark:text-white">{e.description}</td>
                      <td className="py-3 font-mono text-[11px]">{e.payment_method || "CASH"}</td>
                      <td className="py-3 font-bold text-brand-primary dark:text-rose-400 font-mono">{fmt(e.total || e.amount)}</td>
                      <td className="py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            e.status === "POSTED"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : e.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : e.status === "SUBMITTED"
                              ? "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold"
                              : "bg-brand-surface-muted text-brand-text dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {e.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {e.status === "DRAFT" && (
                          <button
                            onClick={async () => {
                              await submitBranchExpense(e.id);
                              fetchBranchExpenses().then((res) => {
                                if (res.success && res.data) setExpenses(res.data.expenses || []);
                              });
                            }}
                            className="px-2.5 py-1 bg-brand-gold hover:bg-brand-gold-dark text-white font-bold text-[10px] rounded-lg"
                          >
                            Submit
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 5: CASH & TELLER ────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "cash" && (
        <div className="space-y-8">
          {/* Section 1: Canonical Teller Cash Drawer & Custody Terminal */}
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-brand-border dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-navy dark:text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  Branch Teller Cash Drawer & Custody Terminal
                </h3>
                <p className="text-xs text-brand-text-muted">
                  Authoritative relational teller sessions, float controls, and 3-tier Segregation of Duties.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    cashPosition?.drawer_status === "OPEN"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold"
                  }`}
                >
                  Drawer Status: {cashPosition?.drawer_status || "CLOSED"}
                </span>
                {cashPosition && (
                  <>
                    <button
                      type="button"
                      onClick={() => exportBranchCashPositionCsv(cashPosition, branch?.code || "BR01")}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={triggerPrint}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-brand-surface-muted dark:bg-zinc-800 text-brand-text dark:text-zinc-300 border border-brand-border dark:border-zinc-700 hover:bg-brand-surface-muted transition shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print / PDF</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-brand-text-muted">Opening Cash Float</span>
                <p className="text-xl font-mono font-bold text-brand-navy dark:text-white">
                  {fmt(cashPosition?.opening_float || 0)}
                </p>
                <p className="text-[11px] text-brand-text-muted">
                  {cashPosition?.drawer_status === "OPEN" ? "Active authorized shift float" : "No active opening float"}
                </p>
              </div>

              <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-brand-text-muted">Expected Drawer Cash</span>
                <p className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {fmt(cashPosition?.expected_drawer_cash || 0)}
                </p>
                <p className="text-[11px] text-brand-text-muted">
                  Live calculated from movements & float
                </p>
              </div>

              <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-brand-text-muted">Canonical Teller Custody</span>
                  <p className="text-xs font-semibold text-brand-text dark:text-zinc-300 mt-1">
                    Manage shifts, count verification & settlements in the Master Teller Workspace.
                  </p>
                </div>
                <a
                  href="/dashboard?tab=teller_custody"
                  className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  <span>Launch Teller Custody Terminal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>


          {/* Section 2: Rider COD Remittance Handover */}
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm space-y-4">
            <div className="border-b border-brand-border dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-brand-navy dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-brand-gold" />
                Delivery Rider COD Remittance Handover
              </h3>
              <p className="text-xs text-brand-text-muted">
                Authoritative full shift settlement. (Invariant 6: Shortages fail-closed without inventing automated GL loss vouchers).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {riderCodList.length === 0 ? (
                <div className="col-span-full py-8 text-center text-brand-text-muted text-xs">
                  No delivery riders currently holding undeposited COD cash for this branch.
                </div>
              ) : (
                riderCodList.map((rider) => (
                  <div
                    key={rider.rider_id}
                    className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-sm text-brand-navy dark:text-white">{rider.rider_name}</h4>
                          <p className="text-xs text-brand-text-muted">{rider.rider_phone}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold font-bold text-[10px]">
                          {rider.orders_count || 0} COD Orders
                        </span>
                      </div>
                      <div className="mt-3">
                        <span className="text-[10px] uppercase font-bold text-brand-text-muted">Total COD Custody</span>
                        <p className="text-xl font-black text-brand-gold dark:text-brand-gold font-mono">
                          {fmt(rider.custody_amount)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-brand-border dark:border-zinc-800 flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedRiderForSettle(rider);
                          setCashPresentedInput(String(rider.custody_amount || 0));
                        }}
                        className="flex-1 py-1.5 bg-brand-gold hover:bg-brand-gold-dark text-white font-bold text-xs rounded-xl transition"
                      >
                        Settle Handover
                      </button>
                      <button
                        onClick={() => {
                          setShortageRider(rider);
                          setShortageAmount(0);
                          setShortageNotes("");
                          setIsShortageModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-brand-light hover:bg-rose-100 text-brand-primary dark:bg-rose-950 dark:text-rose-300 font-bold text-xs rounded-xl transition border border-brand-primary/20 dark:border-rose-900"
                        title="Report cash shortage discrepancy"
                      >
                        Report Shortage
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Rider Settle Drawer / Modal Box */}
            {selectedRiderForSettle && (
              <div className="mt-4 p-5 bg-brand-gold-light/50 dark:bg-brand-gold-dark/20 rounded-2xl border border-brand-gold/40 dark:border-brand-gold-dark/60 space-y-4 animate-in fade-in">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-brand-navy dark:text-white">
                    Settle Shift Cash for {selectedRiderForSettle.rider_name}
                  </h4>
                  <button
                    onClick={() => setSelectedRiderForSettle(null)}
                    className="text-xs text-brand-text-muted hover:text-zinc-600"
                  >
                    ✕ Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-brand-text-muted">Authoritative Custody:</span>
                    <p className="text-lg font-bold text-brand-navy dark:text-white font-mono">
                      {fmt(selectedRiderForSettle.custody_amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-brand-text-muted">Cash Presented by Rider (₹):</span>
                    <input
                      type="number"
                      value={cashPresentedInput}
                      onChange={(e) => setCashPresentedInput(e.target.value)}
                      className="w-full p-2 text-xs rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono mt-1"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={async () => {
                        const presented = Number(cashPresentedInput);
                        const expected = Number(selectedRiderForSettle.custody_amount);
                        if (Math.abs(presented - expected) > 0.01) {
                          alert(`Fail-Closed Rule: Cash presented (${presented}) does not equal Authoritative Custody (${expected}). Use 'Report Shortage' if money is missing.`);
                          return;
                        }
                        setSettlementSubmitting(true);
                        try {
                          await settleRiderCodShift({
                            shift_id: `shift_${Date.now()}`,
                            delivery_partner_id: selectedRiderForSettle.rider_id,
                            total_cash_received: presented,
                            settlement_lines: (selectedRiderForSettle.orders || []).map((o: any) => ({
                              order_id: o.order_id,
                              amount: Number(o.amount),
                            })),
                            notes: "Full shift remittance accepted at counter",
                          });
                          alert("COD Shift Handover settled successfully!");
                          setSelectedRiderForSettle(null);
                          fetchBranchRiderCodCustody().then((r) => setRiderCodList(r.riders || []));
                          fetchBranchCashPosition().then((c) => setCashPosition(c));
                        } catch (err: any) {
                          alert(err.message || "Settlement failed");
                        } finally {
                          setSettlementSubmitting(false);
                        }
                      }}
                      disabled={settlementSubmitting}
                      className="w-full py-2 bg-brand-navy hover:bg-brand-primary text-white font-bold text-xs rounded-xl transition disabled:opacity-50"
                    >
                      Confirm Exact Settlement
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Bank Deposit Slip Preparation */}
          <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-brand-border dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-navy dark:text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  Bank Cash Deposit Slips
                </h3>
                <p className="text-xs text-brand-text-muted">
                  Prepare cash deposit slips with exact denomination counting. (Invariant 7: Central Accounting approves and posts Dr 1118 / Cr 1111).
                </p>
              </div>
              <button
                onClick={() => {
                  setDepositAmount(0);
                  setDenominations({
                    notes_2000: 0,
                    notes_500: 0,
                    notes_200: 0,
                    notes_100: 0,
                    notes_50: 0,
                    notes_20: 0,
                    notes_10: 0,
                    notes_5: 0,
                    coins: 0,
                  });
                  setIsDepositModalOpen(true);
                }}
                className="px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Prepare Bank Deposit Slip
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-brand-border dark:border-zinc-800 text-brand-text-muted font-bold uppercase text-[10px]">
                    <th className="pb-3">Slip #</th>
                    <th className="pb-3">Deposit Date</th>
                    <th className="pb-3">Bank Account</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Prepared By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border dark:divide-zinc-800">
                  {depositSlips.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-brand-text-muted">
                        No bank deposit slips prepared yet for this branch.
                      </td>
                    </tr>
                  ) : (
                    depositSlips.map((ds) => (
                      <tr key={ds.id} className="py-2.5">
                        <td className="py-3 font-bold text-brand-navy dark:text-white">{ds.slip_number}</td>
                        <td className="py-3 text-brand-text-muted">{ds.deposit_date}</td>
                        <td className="py-3 font-semibold">{ds.bank_account_name || ds.bank_account_id}</td>
                        <td className="py-3 font-bold text-blue-600 dark:text-blue-400 font-mono">{fmt(ds.amount)}</td>
                        <td className="py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              ds.status === "POSTED"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                : ds.status === "CONFIRMED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : ds.status === "CANCELLED"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold"
                            }`}
                          >
                            {ds.status}
                          </span>
                        </td>
                        <td className="py-3 text-brand-text-muted">{ds.prepared_by || "Manager"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 6: INVENTORY & SPOILAGE ─────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          {/* Invariant 2 & 4 Policy Banner */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <p className="font-bold">
                Authoritative Inventory Categorization & Spoilage Reporting:
              </p>
              <p>
                Branch stock is strictly organized under authoritative Chart of Accounts: <b>1131 (Accessories)</b>, <b>1132 (Cakes)</b>, and <b>1133 (Packaging)</b>. Disallowed account 1135 is prohibited. Spoilage reports record physical loss without claiming premature Dr 5190 GL entries.
              </p>
            </div>
          </div>

          {/* Account Filter & Damage Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-2 text-xs">
              {[
                { id: "ALL", label: "All Stock" },
                { id: "1131", label: "1131: Accessories" },
                { id: "1132", label: "1132: Cakes" },
                { id: "1133", label: "1133: Packaging" },
              ].map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setInventoryAccountFilter(acc.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    inventoryAccountFilter === acc.id
                      ? "bg-brand-navy text-white dark:bg-white dark:text-zinc-900 shadow-sm"
                      : "bg-white dark:bg-zinc-900 text-brand-text-muted dark:text-zinc-400 border border-brand-border dark:border-zinc-800"
                  }`}
                >
                  {acc.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const damageItems = (inventory || [])
                    .filter((item: any) => (item.damaged_quantity || 0) > 0)
                    .map((item: any) => ({
                      sku: item.sku || item.product_id,
                      name: item.product_name || item.name || "Item",
                      category: item.account_code || "1131",
                      damaged_quantity: item.damaged_quantity || 0,
                      reason_code: item.reason_code || "EXPIRED",
                      notes: item.notes || "Operational Spoilage",
                      reported_at: new Date().toISOString(),
                      reported_by: "Branch Staff",
                    }));
                  exportBranchInventoryDamageCsv(
                    damageItems.length > 0
                      ? damageItems
                      : [
                          {
                            sku: "STOCK-01",
                            name: "Regular Inventory Inspection",
                            category: "1132",
                            damaged_quantity: 0,
                            reason_code: "NO_DAMAGE",
                            notes: "Zero current damaged units",
                            reported_at: new Date().toISOString(),
                            reported_by: "Branch Manager",
                          },
                        ],
                    branch?.code || "BR01"
                  );
                }}
                className="px-3 py-2 bg-brand-surface-muted dark:bg-zinc-800 hover:bg-brand-surface-muted dark:hover:bg-zinc-700 text-brand-text dark:text-zinc-300 text-xs font-bold rounded-xl border border-brand-border dark:border-zinc-700 transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Log</span>
              </button>
              <button
                type="button"
                onClick={triggerPrint}
                className="px-3 py-2 bg-brand-surface-muted dark:bg-zinc-800 hover:bg-brand-surface-muted dark:hover:bg-zinc-700 text-brand-text dark:text-zinc-300 text-xs font-bold rounded-xl border border-brand-border dark:border-zinc-700 transition flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={() => {
                  setDamageItem(null);
                  setDamageQty(1);
                  setDamageReason("EXPIRED");
                  setDamageNotes("");
                  setIsDamageModalOpen(true);
                }}
                className="px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4" />
                Report Damaged / Spoiled Stock
              </button>
            </div>
          </div>

          {/* Inventory Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInventory.map((item) => {
              const cat = (item.category_name || item.name || "").toLowerCase();
              const isPkg = cat.includes("box") || cat.includes("packaging") || cat.includes("board") || cat.includes("bag");
              const isAcc = cat.includes("candle") || cat.includes("knife") || cat.includes("topper") || cat.includes("card") || cat.includes("accessory");
              const glCode = isPkg ? "1133" : isAcc ? "1131" : "1132";

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                    item.is_low_stock
                      ? "bg-brand-light dark:bg-rose-950/20 border-rose-300 dark:border-rose-900"
                      : "bg-white dark:bg-zinc-900 border-brand-border dark:border-zinc-800 shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-brand-navy dark:text-white">{item.name}</h4>
                        <p className="text-xs text-brand-text-muted">
                          {item.category_name} • SKU: {item.sku || "N/A"}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-brand-surface-muted dark:bg-zinc-800 text-[10px] font-mono font-bold text-brand-text-muted dark:text-zinc-300">
                        GL {glCode}
                      </span>
                    </div>

                    <div className="mt-3 flex justify-between items-center text-xs">
                      <span className="text-brand-text-muted">Available Stock:</span>
                      <span className="font-black text-base text-brand-navy dark:text-white font-mono">
                        {item.stock} units
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-brand-text-muted">
                      <span>Low Stock Threshold:</span>
                      <span className="font-mono">{item.low_stock_threshold || 5} units</span>
                    </div>
                  </div>

                  {/* Stock Quick Adjustment & Damage Button */}
                  <div className="mt-4 pt-3 border-t border-brand-border dark:border-zinc-800 flex justify-between items-center gap-2">
                    <div className="flex gap-1">
                      <button
                        onClick={async () => {
                          const newStock = Math.max(0, item.stock - 5);
                          await updateBranchInventoryStock(item.id, newStock);
                          setInventory((prev) =>
                            prev.map((i) => (i.id === item.id ? { ...i, stock: newStock } : i))
                          );
                        }}
                        className="px-2 py-1 bg-brand-surface-muted dark:bg-zinc-800 hover:bg-brand-surface-muted text-xs font-bold rounded"
                      >
                        -5
                      </button>
                      <button
                        onClick={async () => {
                          const newStock = item.stock + 10;
                          await updateBranchInventoryStock(item.id, newStock);
                          setInventory((prev) =>
                            prev.map((i) => (i.id === item.id ? { ...i, stock: newStock } : i))
                          );
                        }}
                        className="px-2 py-1 bg-brand-surface-muted dark:bg-zinc-800 hover:bg-brand-surface-muted text-xs font-bold rounded"
                      >
                        +10
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setDamageItem(item);
                        setDamageQty(1);
                        setDamageReason("EXPIRED");
                        setDamageNotes("");
                        setIsDamageModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-brand-primary dark:text-rose-400 hover:underline"
                    >
                      Report Damage
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 7: BRANCH REPORTS ───────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "reports" && (
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-brand-border dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-brand-border dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-brand-navy dark:text-white">Branch Operational Reports</h2>
              <p className="text-xs text-brand-text-muted">Live operational data strictly scoped to {branch.name}.</p>
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={reportRange}
                onChange={(e) => setReportRange(e.target.value)}
                className="p-2 text-xs rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 font-semibold"
              >
                <option value="today">Today</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!reportsData || !reportsData.rows) return;
                  exportBranchDailySalesCsv(reportsData.rows, branch?.code || "BR01", reportRange);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={triggerPrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-surface-muted dark:bg-zinc-800 hover:bg-brand-surface-muted dark:hover:bg-zinc-700 text-brand-text dark:text-zinc-300 font-bold text-xs rounded-xl border border-brand-border dark:border-zinc-700 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          {reportsData && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800">
                  <span className="text-xs text-brand-text-muted font-bold uppercase">Total Branch Orders</span>
                  <p className="text-2xl font-black mt-1">{reportsData.metrics?.total_orders || 0}</p>
                </div>
                <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800">
                  <span className="text-xs text-brand-text-muted font-bold uppercase">Branch Revenue</span>
                  <p className="text-2xl font-black text-brand-primary dark:text-rose-400 mt-1 font-mono">
                    {fmt(reportsData.metrics?.total_revenue || 0)}
                  </p>
                </div>
                <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800">
                  <span className="text-xs text-brand-text-muted font-bold uppercase">Fulfillment SLA Rate</span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {reportsData.metrics?.fulfillment_rate || 100}%
                  </p>
                </div>
                <div className="p-4 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800">
                  <span className="text-xs text-brand-text-muted font-bold uppercase">Average Order Value</span>
                  <p className="text-2xl font-black mt-1 font-mono">
                    {fmt(reportsData.metrics?.average_order_value || 0)}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold mb-3">Order History Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-brand-border dark:border-zinc-800 text-brand-text-muted font-bold uppercase text-[10px]">
                        <th className="pb-2">Order Number</th>
                        <th className="pb-2">Customer</th>
                        <th className="pb-2">Total Amount</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Created Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border dark:divide-zinc-800">
                      {(reportsData.rows || []).map((r: any, i: number) => (
                        <tr key={i} className="py-2">
                          <td className="py-2.5 font-bold">#{r.order_number}</td>
                          <td className="py-2.5">{r.customer_name}</td>
                          <td className="py-2.5 font-semibold text-brand-primary font-mono">{fmt(r.total)}</td>
                          <td className="py-2.5">
                            <span className="px-2 py-0.5 rounded bg-brand-surface-muted dark:bg-zinc-800 font-bold text-[10px]">
                              {r.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-brand-text-muted">{new Date(r.created_at).toLocaleString("en-IN")}</td>
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
      {/* ── MODALS: PURCHASES, GRN, EXPENSES, DEPOSITS, SPOILAGE ─────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}

      {/* 1. New Purchase / PO Entry Modal */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-brand-border dark:border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-brand-border dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-navy dark:text-white">New Purchase / PO Entry</h3>
                <p className="text-xs text-brand-text-muted">Record supplier purchase for {branch.name}.</p>
              </div>
              <button onClick={() => setIsPurchaseModalOpen(false)} className="text-brand-text-muted hover:text-zinc-600">✕</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Supplier</label>
                <select
                  value={purchaseForm.supplier_id}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_id: e.target.value })}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Invoice / PO Number</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-001"
                  value={purchaseForm.invoice_no}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_no: e.target.value })}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Payment Method</label>
                <select
                  value={purchaseForm.payment_method}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, payment_method: e.target.value })}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  <option value="CASH">Cash</option>
                  <option value="CREDIT">Credit</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-brand-text dark:text-zinc-300 uppercase">Line Items</span>
                <button
                  onClick={() =>
                    setPurchaseLines([
                      ...purchaseLines,
                      { item_type: "CAKE", description: "", quantity: 1, rate: 0, discount: 0, gst_rate: 5 },
                    ])
                  }
                  className="px-2 py-1 bg-brand-surface-muted hover:bg-brand-surface-muted dark:bg-zinc-800 text-[11px] font-bold rounded"
                >
                  + Add Line
                </button>
              </div>

              {purchaseLines.map((line, idx) => (
                <div key={idx} className="p-3 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs items-center">
                  <div className="sm:col-span-1">
                    <label className="text-[10px] text-brand-text-muted font-bold block mb-0.5">CoA Type</label>
                    <select
                      value={line.item_type}
                      onChange={(e) => {
                        const next = [...purchaseLines];
                        next[idx].item_type = e.target.value;
                        setPurchaseLines(next);
                      }}
                      className="w-full p-1.5 rounded-lg border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    >
                      <option value="1131">1131 Accessories</option>
                      <option value="1132">1132 Cakes</option>
                      <option value="1133">1133 Packaging</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-brand-text-muted font-bold block mb-0.5">Description</label>
                    <input
                      type="text"
                      placeholder="Item name"
                      value={line.description}
                      onChange={(e) => {
                        const next = [...purchaseLines];
                        next[idx].description = e.target.value;
                        setPurchaseLines(next);
                      }}
                      className="w-full p-1.5 rounded-lg border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-brand-text-muted font-bold block mb-0.5">Qty</label>
                    <input
                      type="number"
                      value={line.quantity}
                      onChange={(e) => {
                        const next = [...purchaseLines];
                        next[idx].quantity = e.target.value;
                        setPurchaseLines(next);
                      }}
                      className="w-full p-1.5 rounded-lg border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-brand-text-muted font-bold block mb-0.5">Rate (₹)</label>
                    <input
                      type="number"
                      value={line.rate}
                      onChange={(e) => {
                        const next = [...purchaseLines];
                        next[idx].rate = e.target.value;
                        setPurchaseLines(next);
                      }}
                      className="w-full p-1.5 rounded-lg border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[10px] text-brand-text-muted font-bold block mb-0.5">GST %</label>
                      <select
                        value={line.gst_rate}
                        onChange={(e) => {
                          const next = [...purchaseLines];
                          next[idx].gst_rate = e.target.value;
                          setPurchaseLines(next);
                        }}
                        className="p-1.5 rounded-lg border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                      </select>
                    </div>
                    {purchaseLines.length > 1 && (
                      <button
                        onClick={() => setPurchaseLines(purchaseLines.filter((_, i) => i !== idx))}
                        className="text-brand-primary font-bold mt-3"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total Box */}
            <div className="p-3 bg-brand-surface-muted dark:bg-zinc-800 rounded-xl flex justify-between items-center text-xs">
              <span className="font-bold text-brand-text-muted dark:text-zinc-300">Grand Total:</span>
              <span className="text-base font-black text-brand-primary dark:text-rose-400 font-mono">
                {fmt(computedPurchaseTotals.grandTotal)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (purchaseLines.some((l) => !l.description.trim())) {
                    alert("Please fill in description for all line items.");
                    return;
                  }
                  setPurchaseSubmitting(true);
                  try {
                    const payload = {
                      supplier_id: purchaseForm.supplier_id || null,
                      invoice_no: purchaseForm.invoice_no || null,
                      invoice_date: purchaseForm.invoice_date,
                      payment_method: purchaseForm.payment_method,
                      due_date: purchaseForm.due_date || null,
                      subtotal: computedPurchaseTotals.subtotal,
                      discount: computedPurchaseTotals.totalDiscount,
                      taxable_value: computedPurchaseTotals.taxable,
                      cgst: computedPurchaseTotals.totalGst / 2,
                      sgst: computedPurchaseTotals.totalGst / 2,
                      igst: 0,
                      total: computedPurchaseTotals.grandTotal,
                      items: purchaseLines.map((l) => ({
                        item_type: l.item_type === "1131" ? "ACCESSORY" : l.item_type === "1133" ? "PACKAGING" : "CAKE",
                        description: l.description,
                        quantity: Number(l.quantity),
                        rate: Number(l.rate),
                        discount: Number(l.discount || 0),
                        taxable_value: (Number(l.quantity) * Number(l.rate)) - Number(l.discount || 0),
                        cgst_rate: Number(l.gst_rate) / 2,
                        sgst_rate: Number(l.gst_rate) / 2,
                        igst_rate: 0,
                        cgst: ((Number(l.quantity) * Number(l.rate) - Number(l.discount || 0)) * (Number(l.gst_rate) / 2)) / 100,
                        sgst: ((Number(l.quantity) * Number(l.rate) - Number(l.discount || 0)) * (Number(l.gst_rate) / 2)) / 100,
                        igst: 0,
                        total: (Number(l.quantity) * Number(l.rate) - Number(l.discount || 0)) * (1 + Number(l.gst_rate) / 100),
                      })),
                    };
                    const res = await createBranchPurchase(payload);
                    if (res.success) {
                      setIsPurchaseModalOpen(false);
                      fetchBranchPurchases().then((r) => {
                        if (r.success && r.data) setPurchases(r.data.purchases || []);
                      });
                      alert("Purchase entry created in DRAFT status.");
                    } else {
                      alert(res.error || "Failed to create purchase");
                    }
                  } catch (err: any) {
                    alert(err.message || "Failed to create purchase");
                  } finally {
                    setPurchaseSubmitting(false);
                  }
                }}
                disabled={purchaseSubmitting}
                className="px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                Save Purchase (DRAFT)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. GRN Physical Receipt Checklist Modal */}
      {isGrnModalOpen && selectedPurchaseForGrn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full p-6 space-y-4 border border-brand-border dark:border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-brand-border dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-navy dark:text-white">
                  Goods Receipt Note (GRN) Checklist
                </h3>
                <p className="text-xs text-brand-text-muted">
                  PO / Invoice #{selectedPurchaseForGrn.invoice_no || selectedPurchaseForGrn.id}
                </p>
              </div>
              <button onClick={() => setIsGrnModalOpen(false)} className="text-brand-text-muted hover:text-zinc-600">✕</button>
            </div>

            <div className="p-3 bg-brand-gold-light dark:bg-brand-gold-dark/40 rounded-xl border border-brand-gold/40 dark:border-brand-gold-dark/40 text-[11px] text-brand-gold-dark dark:text-brand-gold">
              ⚠️ Invariant 1: Completing this GRN checklist records physical custody at {branch.name}. It does not trigger GL posting until Accounting review.
            </div>

            <div className="space-y-3">
              {grnItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800 text-xs flex justify-between items-center gap-3">
                  <div>
                    <p className="font-bold text-brand-navy dark:text-white">{item.description}</p>
                    <p className="text-[11px] text-brand-text-muted">Ordered: {item.quantity_ordered} units</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="text-[10px] text-brand-text-muted font-bold block mb-0.5">Recv Qty</label>
                      <input
                        type="number"
                        value={item.quantity_received}
                        onChange={(e) => {
                          const next = [...grnItems];
                          next[idx].quantity_received = Number(e.target.value);
                          setGrnItems(next);
                        }}
                        className="w-16 p-1 rounded-lg border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-brand-text-muted font-bold block mb-0.5">Condition</label>
                      <select
                        value={item.condition}
                        onChange={(e) => {
                          const next = [...grnItems];
                          next[idx].condition = e.target.value;
                          setGrnItems(next);
                        }}
                        className="p-1 rounded-lg border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[11px]"
                      >
                        <option value="GOOD">Good / Intact</option>
                        <option value="DEFECTIVE">Defective</option>
                        <option value="TORN_PACKAGING">Torn Packaging</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 text-xs block mb-1">Receiving Remarks / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Received in morning delivery van, outer boxes checked"
                  value={grnNotes}
                  onChange={(e) => setGrnNotes(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsGrnModalOpen(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setGrnSubmitting(true);
                  try {
                    await recordBranchGrnReceipt(selectedPurchaseForGrn.id, {
                      items: grnItems,
                      notes: grnNotes,
                    });
                    alert("Physical GRN receipt checklist recorded successfully!");
                    setIsGrnModalOpen(false);
                  } catch (err: any) {
                    alert(err.message || "Failed to record GRN");
                  } finally {
                    setGrnSubmitting(false);
                  }
                }}
                disabled={grnSubmitting}
                className="px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                Confirm Physical Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Record Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 space-y-4 border border-brand-border dark:border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-brand-border dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-navy dark:text-white">Record Store Expense</h3>
                <p className="text-xs text-brand-text-muted">Submit operational branch expense claim.</p>
              </div>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-brand-text-muted hover:text-zinc-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Expense Category</label>
                <select
                  value={expenseForm.category_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  <option value="">Select Category</option>
                  {expenseCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Milk & Sugar for kitchen prep"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Total Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 450"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Payment Method</label>
                  <select
                    value={expenseForm.payment_method}
                    onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}
                    className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  >
                    <option value="CASH">Cash from Drawer</option>
                    <option value="PETTY_CASH">Petty Cash</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Notes / Bill Reference</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Bill #1203 from Local Dairy"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!expenseForm.description || expenseForm.amount <= 0) {
                    alert("Please provide a description and amount.");
                    return;
                  }
                  setExpenseSubmitting(true);
                  try {
                    await createBranchExpense({
                      category_id: expenseForm.category_id || null,
                      description: expenseForm.description,
                      amount: expenseForm.amount,
                      taxable_value: expenseForm.amount,
                      cgst: 0,
                      sgst: 0,
                      igst: 0,
                      total: expenseForm.amount,
                      payment_method: expenseForm.payment_method,
                      notes: expenseForm.notes,
                    });
                    setIsExpenseModalOpen(false);
                    fetchBranchExpenses().then((r) => {
                      if (r.success && r.data) setExpenses(r.data.expenses || []);
                    });
                    alert("Expense recorded in DRAFT status.");
                  } catch (err: any) {
                    alert(err.message || "Failed to record expense");
                  } finally {
                    setExpenseSubmitting(false);
                  }
                }}
                disabled={expenseSubmitting}
                className="px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                Submit Expense Claim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Prepare Bank Deposit Slip Modal */}
      {isDepositModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 border border-brand-border dark:border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-brand-border dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-navy dark:text-white">Prepare Cash Deposit Slip</h3>
                <p className="text-xs text-brand-text-muted">Record cash counting for transit dispatch.</p>
              </div>
              <button onClick={() => setIsDepositModalOpen(false)} className="text-brand-text-muted hover:text-zinc-600">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Target Bank Account</label>
                <select
                  value={depositBankAccountId}
                  onChange={(e) => setDepositBankAccountId(e.target.value)}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  <option value="">Select Account</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.account_name} ({b.bank_name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Deposit Date</label>
                <input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
            </div>

            {/* Denomination Counter */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-brand-text dark:text-zinc-300 uppercase">
                Physical Currency Denominations
              </span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { key: "notes_2000", label: "₹2,000" },
                  { key: "notes_500", label: "₹500" },
                  { key: "notes_200", label: "₹200" },
                  { key: "notes_100", label: "₹100" },
                  { key: "notes_50", label: "₹50" },
                  { key: "notes_20", label: "₹20" },
                  { key: "notes_10", label: "₹10" },
                  { key: "notes_5", label: "₹5" },
                  { key: "coins", label: "Coins (₹1)" },
                ].map((denom) => (
                  <div key={denom.key} className="p-2 bg-brand-surface-muted dark:bg-zinc-950/60 rounded-xl border border-brand-border dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-brand-text-muted block">{denom.label}</span>
                    <input
                      type="number"
                      min={0}
                      value={denominations[denom.key] || ""}
                      onChange={(e) =>
                        setDenominations({ ...denominations, [denom.key]: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                      className="w-full p-1 text-center font-mono font-bold text-xs bg-white dark:bg-zinc-900 border border-brand-border dark:border-zinc-700 rounded mt-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Match Box */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/40 flex justify-between items-center text-xs">
              <span className="font-bold text-blue-900 dark:text-blue-200">Total Counted:</span>
              <span className="text-base font-black text-blue-600 dark:text-blue-400 font-mono">
                {fmt(computedDenominationsTotal)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsDepositModalOpen(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!depositBankAccountId) {
                    alert("Please select a target bank account.");
                    return;
                  }
                  if (computedDenominationsTotal <= 0) {
                    alert("Deposit amount must be greater than zero.");
                    return;
                  }
                  setDepositSubmitting(true);
                  try {
                    await prepareBankDepositSlip({
                      bank_account_id: depositBankAccountId,
                      deposit_date: depositDate,
                      amount: computedDenominationsTotal,
                      denominations,
                    });
                    alert("Bank deposit slip prepared and submitted to accounting!");
                    setIsDepositModalOpen(false);
                    fetchBranchBankDepositSlips().then((r) => setDepositSlips(r.slips || []));
                  } catch (err: any) {
                    alert(err.message || "Failed to prepare deposit slip");
                  } finally {
                    setDepositSubmitting(false);
                  }
                }}
                disabled={depositSubmitting}
                className="px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                Submit Deposit Slip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Shortage Discrepancy Modal */}
      {isShortageModalOpen && shortageRider && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-brand-border dark:border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-brand-border dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-navy dark:text-white">Report COD Shortage</h3>
                <p className="text-xs text-brand-text-muted">Rider: {shortageRider.rider_name}</p>
              </div>
              <button onClick={() => setIsShortageModalOpen(false)} className="text-brand-text-muted hover:text-zinc-600">✕</button>
            </div>

            <div className="p-3 bg-brand-light dark:bg-rose-950/40 rounded-xl border border-brand-primary/20 dark:border-rose-900/40 text-[11px] text-rose-800 dark:text-rose-300">
              ⚠️ Invariant 6: Shortage exceptions are recorded for supervisor investigation. No automated loss journal is posted.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-brand-text-muted">Total Custody:</span>
                <p className="font-bold text-brand-navy dark:text-white font-mono">
                  {fmt(shortageRider.custody_amount)}
                </p>
              </div>

              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Shortage Amount (₹)</label>
                <input
                  type="number"
                  placeholder="Missing amount"
                  value={shortageAmount}
                  onChange={(e) => setShortageAmount(Number(e.target.value))}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Rider Reason / Explanation</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Customer promised UPI transfer, change not returned"
                  value={shortageNotes}
                  onChange={(e) => setShortageNotes(e.target.value)}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsShortageModalOpen(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (shortageAmount <= 0 || !shortageNotes.trim()) {
                    alert("Please provide shortage amount and explanation.");
                    return;
                  }
                  setShortageSubmitting(true);
                  try {
                    await reportCodShortage({
                      rider_id: shortageRider.rider_id,
                      expected_amount: Number(shortageRider.custody_amount),
                      cash_presented: Number(shortageRider.custody_amount) - shortageAmount,
                      shortage_amount: shortageAmount,
                      notes: shortageNotes,
                    });
                    alert("Shortage discrepancy recorded for supervisor audit.");
                    setIsShortageModalOpen(false);
                  } catch (err: any) {
                    alert(err.message || "Failed to log shortage");
                  } finally {
                    setShortageSubmitting(false);
                  }
                }}
                disabled={shortageSubmitting}
                className="px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                Log Discrepancy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Stock Damage / Spoilage Modal */}
      {isDamageModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 space-y-4 border border-brand-border dark:border-zinc-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-brand-border dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-brand-navy dark:text-white">Report Stock Damage / Spoilage</h3>
                <p className="text-xs text-brand-text-muted">Record physical item spoilage or breakage.</p>
              </div>
              <button onClick={() => setIsDamageModalOpen(false)} className="text-brand-text-muted hover:text-zinc-600">✕</button>
            </div>

            <div className="p-3 bg-brand-gold-light dark:bg-brand-gold-dark/40 rounded-xl border border-brand-gold/40 dark:border-brand-gold-dark/40 text-[11px] text-brand-gold-dark dark:text-brand-gold">
              ⚠️ Invariant 4: Spoilage logging records operational waste. Financial write-off voucher (Dr 5190 / Cr Inventory) will be executed when the accounting service is verified.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Select Item</label>
                <select
                  value={damageItem?.id || ""}
                  onChange={(e) => {
                    const found = inventory.find((i) => i.id === e.target.value);
                    setDamageItem(found);
                  }}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                >
                  <option value="">Select Inventory Item</option>
                  {inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Stock: {item.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Quantity Damaged</label>
                  <input
                    type="number"
                    min={1}
                    value={damageQty}
                    onChange={(e) => setDamageQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Reason Code</label>
                  <select
                    value={damageReason}
                    onChange={(e) => setDamageReason(e.target.value)}
                    className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  >
                    <option value="EXPIRED">Expired Shelf Life</option>
                    <option value="TRANSIT_DAMAGE">Damaged in Transit</option>
                    <option value="DROPPED_IN_STORE">Dropped in Store</option>
                    <option value="QUALITY_DEFECT">Bake / Texture Defect</option>
                    <option value="TEMPERATURE_ABUSE">Cold Storage Fluctuation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-brand-text dark:text-zinc-300 block mb-1">Incident Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Box crushed during shelf stocking"
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  className="w-full p-2 rounded-xl border border-brand-border dark:border-zinc-700 bg-white dark:bg-zinc-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsDamageModalOpen(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!damageItem) {
                    alert("Please select an item.");
                    return;
                  }
                  setDamageSubmitting(true);
                  try {
                    await reportBranchStockDamage({
                      item_id: damageItem.id,
                      sku: damageItem.sku,
                      item_name: damageItem.name,
                      quantity: damageQty,
                      reason_code: damageReason,
                      notes: damageNotes,
                    });
                    alert("Stock damage report logged for accounting review.");
                    setIsDamageModalOpen(false);
                  } catch (err: any) {
                    alert(err.message || "Failed to log damage");
                  } finally {
                    setDamageSubmitting(false);
                  }
                }}
                disabled={damageSubmitting}
                className="px-4 py-2 bg-brand-navy hover:bg-brand-primary text-white text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50"
              >
                Log Damage Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXISTING MODALS & DRAWERS (ORDER LIFECYCLE) ───────────────────────── */}
      <OrderDetailsDrawer
        order={selectedOrder}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRefresh={() => {
          loadDashboardData();
          if (selectedOrder) {
            fetchBranchOrderDetails(selectedOrder.id).then((res) => {
              if (res.success && res.order) setSelectedOrder(res.order);
            });
          }
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
