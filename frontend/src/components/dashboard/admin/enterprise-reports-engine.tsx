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
  ArrowRight, SlidersHorizontal, Sliders, FileText, Inbox
} from "lucide-react";

// 9 Primary Bakery Sections
const SECTIONS: Array<{ id: ReportSection; label: string; icon: any }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "sales", label: "Sales", icon: TrendingUp },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "products", label: "Products", icon: Package },
  { id: "customers", label: "Customers", icon: Users },
  { id: "inventory", label: "Inventory", icon: Layers },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "branches", label: "Branches", icon: BarChart3 },
  { id: "finance", label: "Finance", icon: DollarSign },
];

export function EnterpriseReportsEngine() {
  const [activeSection, setActiveSection] = useState<ReportSection>("overview");

  // Universal Filter State
  const [filters, setFilters] = useState<ReportFilterState>({
    timeRange: "today",
    customStartDate: "",
    customEndDate: "",
    branchId: "all",
    category: "all",
    orderStatus: "all",
    city: "all",
    searchQuery: "",
  });

  const [fromInput, setFromInput] = useState<string>("");
  const [toInput, setToInput] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [kpiCards, setKpiCards] = useState<ReportKpiCard[]>([]);
  const [sectionData, setSectionData] = useState<any>(null);

  // Inspection Modal
  const [selectedEntityDetail, setSelectedEntityDetail] = useState<any | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const kpis = ReportsEngineData.getSectionKpis(activeSection, filters);
      const data = ReportsEngineData.fetchSectionData(activeSection, filters);
      setKpiCards(kpis);
      setSectionData(data);
      setLoading(false);
    }, 80);
  }, [activeSection, filters]);

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
      triggerToast("Please select both From and To dates.");
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

  function handleExportCSV() {
    if (sectionData?.table_rows && sectionData.table_rows.length > 0) {
      ReportsEngineData.exportReportToCSV(activeSection, sectionData.table_rows);
      triggerToast("CSV Export Downloaded!");
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

      {/* Page Title & Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <Heading level="h2" className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" /> CakeToHome Bakery Operations Reports
          </Heading>
          <Text className="text-xs text-slate-500 mt-0.5">
            Production-ready real operational analytics for daily kitchen fulfillment, inventory, and sales.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button size="small" variant="secondary" onClick={handleExportCSV} className="text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button size="small" onClick={handlePrintPDF} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5">
            <Printer className="w-3.5 h-3.5" /> PDF Print
          </Button>
        </div>
      </div>

      {/* ── 9 PRIMARY NAVIGATION SECTIONS ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
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
      </div>

      {/* ── UNIVERSAL DATE & ESSENTIAL FILTER BAR ───────────────────────────── */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Universal Date Presets */}
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
                <option value="this_month">This Month</option>
                <option value="this_year">This Year</option>
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

          {/* Global Search */}
          <div className="relative w-44">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.searchQuery}
              onChange={(e) => updateFilter("searchQuery", e.target.value)}
              placeholder="Filter data rows..."
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 outline-none font-semibold"
            />
          </div>
        </div>

        {/* Custom Date Range Picker (From → To → Apply) */}
        {filters.timeRange === "custom" && (
          <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 text-xs">
            <span className="font-bold text-amber-900 dark:text-amber-300">Custom Date Range:</span>
            <span className="font-bold text-slate-500">From:</span>
            <input
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 font-semibold"
            />
            <span className="font-bold text-slate-500">To:</span>
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
      </div>

      {/* ── 5 ESSENTIAL KPI CARDS GRID ───────────────────────────────────────── */}
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

      {/* ── CHART VISUALIZER OR CLEAN EMPTY STATE ───────────────────────────── */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-500" /> Refreshing report telemetry…
        </div>
      ) : sectionData ? (
        <div className="space-y-6">
          {/* Chart Section */}
          {sectionData.chart_data && sectionData.chart_data.length > 0 ? (
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b pb-3">
                <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-500" /> {sectionData.title} Trend Visualizer
                </Heading>
                <Badge color="amber" className="text-[10px] font-bold">Live Data</Badge>
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
                No records match the active date range and filters. Adjust your filters or select a different date range.
              </Text>
            </div>
          )}

          {/* Data Table with Sticky Header */}
          {sectionData.table_rows && sectionData.table_rows.length > 0 && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b flex items-center justify-between">
                <div>
                  <Text className="font-bold text-slate-700 dark:text-slate-200">
                    Operational Data Records ({sectionData.table_rows.length} Rows)
                  </Text>
                  <span className="text-[10px] text-slate-400 block">Click any row to open deep inspection modal</span>
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

      {/* ── ENTITY INSPECTOR MODAL (KPI → Report → Order → Timeline) ────────── */}
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
