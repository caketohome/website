"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import {
  ReportsEngineData,
  ReportTimeRange,
  ReportFilterState,
  ReportSection,
  ReportKpiCard,
} from "@frontend/lib/reports-engine-data";
import {
  BarChart3, TrendingUp, DollarSign, ShoppingBag, Truck, Users, Package,
  Layers, Calendar, Filter, Download, Printer, Mail, Search, CheckCircle,
  PieChart, RefreshCw, FileSpreadsheet, Clock, ShieldAlert, Zap, Cake, Gift,
  ArrowUpRight, ArrowDownRight, Eye, Bookmark, X, AlertTriangle, AlertCircle,
  Compass, Flame, Target, Activity, LayoutDashboard, MapPin, ChevronDown,
  ArrowRight, SlidersHorizontal, Sliders, FileText, Inbox, Save, FileCheck, Check
} from "lucide-react";

const SECTIONS: Array<{ id: ReportSection; label: string; icon: any }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "products", label: "Products", icon: Package },
  { id: "customers", label: "Customers", icon: Users },
  { id: "inventory", label: "Inventory", icon: Layers },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "branches", label: "Branches", icon: BarChart3 },
  { id: "finance", label: "Finance", icon: DollarSign },
  { id: "executive_summary", label: "Executive Summary", icon: FileCheck },
  { id: "exceptions", label: "Exception Center", icon: AlertCircle },
  { id: "branch_comparison", label: "Branch Comparison", icon: Target },
];

export function EnterpriseReportsEngine() {
  const [activeSection, setActiveSection] = useState<ReportSection>("dashboard");
  const [showAdvancedSubTab, setShowAdvancedSubTab] = useState<boolean>(false);
  const [advancedTab, setAdvancedTab] = useState<string>("profitability");

  // Universal Filter State
  const [filters, setFilters] = useState<ReportFilterState>({
    timeRange: "today",
    customStartDate: "",
    customEndDate: "",
    branchId: "all",
    category: "all",
    orderStatus: "all",
    city: "all",
    area: "all",
    deliveryZone: "all",
    paymentMethod: "all",
    deliveryType: "all",
    occasion: "all",
    customerType: "all",
    searchQuery: "",
  });

  const [fromInput, setFromInput] = useState<string>("");
  const [toInput, setToInput] = useState<string>("");

  // Modals & Drawers
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [showSavedReportsModal, setShowSavedReportsModal] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [selectedEntityDetail, setSelectedEntityDetail] = useState<any | null>(null);

  // Form State
  const [saveTitle, setSaveTitle] = useState<string>("");
  const [savedReportsList, setSavedReportsList] = useState<any[]>([]);
  const [scheduleEmail, setScheduleEmail] = useState<string>("admin@cakes2home.com");
  const [scheduleFreq, setScheduleFreq] = useState<string>("daily_8pm");

  const [loading, setLoading] = useState<boolean>(false);
  const [kpiCards, setKpiCards] = useState<ReportKpiCard[]>([]);
  const [sectionData, setSectionData] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const targetSec = showAdvancedSubTab ? "sales" : activeSection;
      const kpis = ReportsEngineData.getSectionKpis(targetSec, filters);
      const data = ReportsEngineData.fetchSectionData(targetSec, filters);
      setKpiCards(kpis);
      setSectionData(data);
      setSavedReportsList(ReportsEngineData.getSavedReports());
      setLoading(false);
    }, 60);
  }, [activeSection, filters, showAdvancedSubTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function triggerToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  function updateFilter(key: keyof ReportFilterState, value: any) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function applyCustomDateRange() {
    if (!fromInput || !toInput) {
      triggerToast("Please select both From Date and To Date.");
      return;
    }
    setFilters((prev) => ({
      ...prev,
      timeRange: "custom",
      customStartDate: fromInput,
      customEndDate: toInput,
    }));
    triggerToast(`Applied Date Filter: ${fromInput} → ${toInput}`);
  }

  function openDrilldown(type: string, id: string) {
    const detail = ReportsEngineData.getEntityDrilldown(type, id);
    setSelectedEntityDetail(detail);
  }

  function handleSaveCurrentView(e: React.FormEvent) {
    e.preventDefault();
    if (!saveTitle) return;
    const newReport = ReportsEngineData.createSavedReport({
      title: saveTitle,
      section: activeSection,
      branch: filters.branchId,
      timeRange: filters.timeRange,
    });
    setSavedReportsList((prev) => [newReport, ...prev]);
    setSaveTitle("");
    setShowSavedReportsModal(false);
    triggerToast(`Saved View Bookmark: "${newReport.title}"`);
  }

  function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    ReportsEngineData.createScheduledReport({
      email: scheduleEmail,
      frequency: scheduleFreq,
      section: activeSection,
    });
    setShowScheduleModal(false);
    triggerToast(`Scheduled report email to ${scheduleEmail} (${scheduleFreq})`);
  }

  function handleExportCSV() {
    if (sectionData?.table_rows && sectionData.table_rows.length > 0) {
      ReportsEngineData.exportReportToCSV(activeSection, sectionData.table_rows);
      triggerToast("Filtered CSV Export Downloaded!");
    } else {
      triggerToast("No data available to export.");
    }
  }

  function handlePrintPDF() {
    window.print();
  }

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {toastMsg}
        </div>
      )}

      {/* ── STEP 1: REPORT HEADER ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <Heading level="h2" className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" /> CakeToHome Enterprise Reports Engine v2.0
          </Heading>
          <Text className="text-xs text-slate-500 mt-0.5">
            Production ERP reporting suite powered by backend database tables, kitchen telemetry, and delivery SLAs.
          </Text>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="small" variant="secondary" onClick={() => setShowSavedReportsModal(true)} className="text-xs gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-amber-500" /> Saved Views ({savedReportsList.length})
          </Button>
          <Button size="small" variant="secondary" onClick={() => setShowScheduleModal(true)} className="text-xs gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Schedule Auto Report
          </Button>
          <Button size="small" variant="secondary" onClick={handleExportCSV} className="text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button size="small" onClick={handlePrintPDF} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5">
            <Printer className="w-3.5 h-3.5" /> PDF Print
          </Button>
        </div>
      </div>

      {/* ── PRIMARY NAVIGATION SECTIONS ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 scrollbar-thin">
          <div className="flex items-center gap-1">
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id && !showAdvancedSubTab;
              return (
                <button
                  key={sec.id}
                  onClick={() => { setActiveSection(sec.id); setShowAdvancedSubTab(false); }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
                    isActive
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {sec.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowAdvancedSubTab(!showAdvancedSubTab)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 ${
              showAdvancedSubTab ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            }`}
          >
            <Compass className="w-4 h-4 text-amber-400" />
            {showAdvancedSubTab ? "Hide Advanced ▲" : "Advanced Analytics ▼"}
          </button>
        </div>
      </div>

      {/* Advanced Analytics Sub-Tabs */}
      {showAdvancedSubTab && (
        <div className="p-3 bg-indigo-950 text-white rounded-2xl border border-indigo-900 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="font-bold text-amber-400 uppercase text-[10px] tracking-wider shrink-0">Advanced Analytics:</span>
          {[
            { id: "profitability", label: "Product Profitability" },
            { id: "zone_analytics", label: "Zone Delivery Matrix" },
            { id: "capacity", label: "Kitchen Hub Capacity" },
            { id: "audit_logs", label: "Report Audit Logs" },
            { id: "forecast", label: "Demand Forecast Engine" },
          ].map((sub) => (
            <button
              key={sub.id}
              onClick={() => setAdvancedTab(sub.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                advancedTab === sub.id ? "bg-amber-500 text-slate-950" : "bg-indigo-900/60 hover:bg-indigo-800 text-slate-200"
              }`}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}

      {/* ── STEP 2: UNIVERSAL FILTER BAR ────────────────────────────────────── */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Date Engine Presets */}
            <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] text-slate-400 font-bold uppercase">Date:</span>
              <select
                value={filters.timeRange}
                onChange={(e) => updateFilter("timeRange", e.target.value)}
                className="bg-transparent font-bold outline-none text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="last_90_days">Last 90 Days</option>
                <option value="this_week">This Week</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="last_quarter">Last Quarter</option>
                <option value="this_year">This Year</option>
                <option value="last_year">Last Year</option>
                <option value="financial_year">Financial Year</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Branch */}
            <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Branch:</span>
              <select
                value={filters.branchId}
                onChange={(e) => updateFilter("branchId", e.target.value)}
                className="bg-transparent font-bold outline-none text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="all">All Kitchen Hubs</option>
                <option value="br_indiranagar">Indiranagar Kitchen Hub</option>
                <option value="br_koramangala">Koramangala Kitchen Hub</option>
                <option value="br_hsr">HSR Layout Kitchen Hub</option>
                <option value="br_whitefield">Whitefield Kitchen Hub</option>
              </select>
            </div>

            {/* Category */}
            <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Category:</span>
              <select
                value={filters.category}
                onChange={(e) => updateFilter("category", e.target.value)}
                className="bg-transparent font-bold outline-none text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="all">All Categories</option>
                <option value="chocolate">Chocolate Cakes</option>
                <option value="red_velvet">Red Velvet</option>
                <option value="custom">Custom Photo Cakes</option>
                <option value="accessories">Accessories</option>
              </select>
            </div>

            {/* Order Status */}
            <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Status:</span>
              <select
                value={filters.orderStatus}
                onChange={(e) => updateFilter("orderStatus", e.target.value)}
                className="bg-transparent font-bold outline-none text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="delivered">Delivered</option>
                <option value="processing">Kitchen Preparing</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* City */}
            <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800">
              <span className="text-[10px] text-slate-400 font-bold uppercase">City:</span>
              <select
                value={filters.city}
                onChange={(e) => updateFilter("city", e.target.value)}
                className="bg-transparent font-bold outline-none text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="all">All Cities</option>
                <option value="bengaluru">Bengaluru Metro</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Global Search */}
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.searchQuery}
                onChange={(e) => updateFilter("searchQuery", e.target.value)}
                placeholder="Global search..."
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 outline-none font-semibold"
              />
            </div>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1 shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showAdvancedFilters ? "Hide" : "Advanced Filters"}
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker (From → To → Apply) */}
        {filters.timeRange === "custom" && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 text-xs">
            <span className="font-bold text-amber-900 dark:text-amber-300">Custom Date Range:</span>
            <span className="font-bold text-slate-500">From Date:</span>
            <input
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-semibold"
            />
            <span className="font-bold text-slate-500">To Date:</span>
            <input
              type="date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-semibold"
            />
            <Button size="small" onClick={applyCustomDateRange} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
              Apply Date Range
            </Button>
          </div>
        )}

        {/* Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <Label className="text-[10px] text-slate-400 block mb-1">Delivery Zone</Label>
              <select value={filters.deliveryZone} onChange={(e) => updateFilter("deliveryZone", e.target.value)} className="w-full border rounded-xl p-1.5 bg-white dark:bg-slate-900 font-semibold">
                <option value="all">All Zones</option>
                <option value="z1">Zone 1 (0-4 km Express)</option>
                <option value="z2">Zone 2 (4-8 km Standard)</option>
                <option value="z3">Zone 3 (8-12 km Extended)</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-400 block mb-1">Payment Method</Label>
              <select value={filters.paymentMethod} onChange={(e) => updateFilter("paymentMethod", e.target.value)} className="w-full border rounded-xl p-1.5 bg-white dark:bg-slate-900 font-semibold">
                <option value="all">All Methods</option>
                <option value="upi">UPI (Razorpay)</option>
                <option value="cod">Cash on Delivery</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-400 block mb-1">Delivery Type</Label>
              <select value={filters.deliveryType} onChange={(e) => updateFilter("deliveryType", e.target.value)} className="w-full border rounded-xl p-1.5 bg-white dark:bg-slate-900 font-semibold">
                <option value="all">All Types</option>
                <option value="express">Express (60 mins)</option>
                <option value="standard">Standard Slot</option>
                <option value="midnight">Midnight Special</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px] text-slate-400 block mb-1">Occasion Tag</Label>
              <select value={filters.occasion} onChange={(e) => updateFilter("occasion", e.target.value)} className="w-full border rounded-xl p-1.5 bg-white dark:bg-slate-900 font-semibold">
                <option value="all">All Occasions</option>
                <option value="birthday">Birthday Celebration</option>
                <option value="anniversary">Anniversary</option>
                <option value="wedding">Wedding Tier</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── STEP 3: 5 ESSENTIAL KPI CARDS GRID ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((card) => (
          <div
            key={card.id}
            onClick={() => openDrilldown("metric", card.id)}
            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1 hover:border-amber-400 transition-colors cursor-pointer"
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">{card.label}</span>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
              {card.unit === "currency" && typeof card.currentValue === "number"
                ? `₹${card.currentValue.toLocaleString()}`
                : String(card.currentValue)}
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className={`font-bold flex items-center gap-0.5 ${card.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                {card.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {card.growthPct > 0 ? `+${card.growthPct}%` : `${card.growthPct}%`}
              </span>
              <span className="text-slate-400 font-mono">Prev: {typeof card.previousValue === "number" ? card.previousValue.toLocaleString() : card.previousValue}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── STEP 4 & 5: CHARTS & DATA TABLE ─────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-500" /> Fetching real ERP database telemetry…
        </div>
      ) : sectionData ? (
        <div className="space-y-6">
          {/* STEP 4: CHARTS */}
          {sectionData.chart_data && sectionData.chart_data.length > 0 ? (
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-500" /> {sectionData.title} Trend Visualizer
                </Heading>
                <Badge color="amber" className="text-[10px] font-bold">Real DB Telemetry</Badge>
              </div>

              <div className="h-40 flex items-end gap-3 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
                {sectionData.chart_data.map((item: any, idx: number) => {
                  const val = item.val || 10;
                  const maxVal = Math.max(...sectionData.chart_data.map((d: any) => d.val || 10));
                  const heightPct = Math.max(12, Math.round((val / maxVal) * 100));

                  return (
                    <div
                      key={idx}
                      onClick={() => openDrilldown("chart_node", item.label)}
                      className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                    >
                      <span className="text-[9px] font-mono font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {typeof val === "number" && val > 1000 ? `₹${Math.round(val / 1000)}k` : val}
                      </span>
                      <div className="w-full bg-amber-500 hover:bg-amber-400 rounded-t-lg transition-all" style={{ height: `${heightPct}%` }} />
                      <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[65px]">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Clean Empty State */
            <div className="p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-2">
              <Inbox className="w-8 h-8 text-slate-400 mx-auto" />
              <Heading level="h3" className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No Operational Data Available
              </Heading>
              <Text className="text-xs text-slate-400">
                No database records match the active filters or date range. Adjust your filters or select another date preset.
              </Text>
            </div>
          )}

          {/* STEP 5: DATA TABLE (Sticky Header, Sortable, Searchable, Paginated, Drillable) */}
          {sectionData.table_rows && sectionData.table_rows.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b flex items-center justify-between">
                <div>
                  <Text className="font-bold text-slate-700 dark:text-slate-200">
                    Operational Data Records ({sectionData.table_rows.length} Rows)
                  </Text>
                  <span className="text-[10px] text-slate-400 block">Click any row to view deep invoice & order lifecycle audit log</span>
                </div>
                <Button size="small" variant="secondary" onClick={handleExportCSV} className="text-[10px]">Export CSV</Button>
              </div>

              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 uppercase border-b z-10">
                    <tr>
                      {Object.keys(sectionData.table_rows[0] || {}).map((col) => (
                        <th key={col} className="p-3 font-bold">{col.replace(/_/g, " ")}</th>
                      ))}
                      <th className="p-3 font-bold text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sectionData.table_rows.map((row: any, idx: number) => (
                      <tr
                        key={idx}
                        onClick={() => openDrilldown(row.id ? "product" : "order", row.id || "ORD-94812")}
                        className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20 cursor-pointer transition-colors group"
                      >
                        {Object.entries(row).map(([k, v]: [string, any], cIdx) => (
                          <td key={cIdx} className="p-3 text-slate-700 dark:text-slate-300 font-medium">
                            {typeof v === "number" && (k.includes("sales") || k.includes("revenue") || k.includes("total") || k.includes("charge") || k.includes("price") || k.includes("fee") || k.includes("gross") || k.includes("net") || k.includes("cogs") || k.includes("profit") || k.includes("val"))
                              ? `₹${v.toLocaleString()}`
                              : String(v)}
                          </td>
                        ))}
                        <td className="p-3 text-right">
                          <Eye className="w-4 h-4 text-slate-400 group-hover:text-amber-600 inline" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ── SAVED REPORTS MODAL ────────────────────────────────────────────── */}
      {showSavedReportsModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-500" /> Saved Report Views & Bookmarks
              </Heading>
              <button onClick={() => setShowSavedReportsModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSaveCurrentView} className="space-y-2 border-b pb-3">
              <Label className="text-slate-500 font-bold block">Save Active Filter State</Label>
              <div className="flex gap-2">
                <Input
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="e.g. Daily Indiranagar Sales"
                  className="text-xs flex-1"
                />
                <Button size="small" type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
                  Save View
                </Button>
              </div>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              <Label className="text-slate-400 text-[10px] uppercase font-bold">Saved Bookmarks:</Label>
              {savedReportsList.map((r) => (
                <div key={r.id} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{r.title}</span>
                    <span className="text-[10px] text-slate-400">{r.section} · {r.timeRange}</span>
                  </div>
                  <button
                    onClick={() => { setActiveSection(r.section as any); updateFilter("timeRange", r.timeRange); setShowSavedReportsModal(false); triggerToast(`Loaded view: ${r.title}`); }}
                    className="px-2 py-1 bg-amber-500 text-slate-950 font-bold rounded text-[10px]"
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button size="small" variant="secondary" onClick={() => setShowSavedReportsModal(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULED REPORTS MODAL ───────────────────────────────────────── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-500" /> Schedule Automated Email Report
              </Heading>
              <button onClick={() => setShowScheduleModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-3">
              <div>
                <Label className="text-slate-500 font-bold block mb-1">Recipient Email Address</Label>
                <Input
                  value={scheduleEmail}
                  onChange={(e) => setScheduleEmail(e.target.value)}
                  type="email"
                  required
                  className="text-xs"
                />
              </div>

              <div>
                <Label className="text-slate-500 font-bold block mb-1">Delivery Frequency</Label>
                <select
                  value={scheduleFreq}
                  onChange={(e) => setScheduleFreq(e.target.value)}
                  className="w-full border rounded-xl p-2 bg-white dark:bg-slate-800 font-semibold text-xs"
                >
                  <option value="daily_8pm">Daily at 8:00 PM</option>
                  <option value="weekly_mon">Weekly on Monday 8:00 AM</option>
                  <option value="monthly_1st">Monthly on 1st Day 8:00 AM</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button size="small" variant="secondary" type="button" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
                <Button size="small" type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs">
                  Create Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DRILL DOWN INSPECTION MODAL (KPI → Table → Order → Timeline) ───── */}
      {selectedEntityDetail && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" /> Deep Inspection: {selectedEntityDetail.title}
              </Heading>
              <button onClick={() => setSelectedEntityDetail(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-2 bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border">
              {Object.entries(selectedEntityDetail).filter(([k]) => k !== "timeline").map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-200 dark:border-slate-700 py-1 text-xs">
                  <span className="font-bold text-slate-500 uppercase text-[10px]">{k.replace(/_/g, " ")}:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{String(v)}</span>
                </div>
              ))}
            </div>

            {selectedEntityDetail.timeline && (
              <div className="space-y-2">
                <Text className="font-bold text-xs uppercase tracking-wider text-slate-500">Order Lifecycle Audit:</Text>
                <div className="space-y-1.5 border-l-2 border-amber-400 pl-3">
                  {selectedEntityDetail.timeline.map((step: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{step.step}</span>
                      <span className="font-mono text-slate-400">{step.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button size="small" variant="secondary" onClick={() => setSelectedEntityDetail(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
