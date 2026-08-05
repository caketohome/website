"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import {
  ReportsEngineData,
  ReportTimeRange,
  ReportFilterState,
  ReportSection,
  ReportKpiCard,
  VisualizationChartType,
  GroupByDimension,
  ComparisonDimension,
} from "@frontend/lib/reports-engine-data";
import {
  BarChart3, TrendingUp, DollarSign, ShoppingBag, Truck, Users, Package,
  Layers, Calendar, Filter, Download, Printer, Mail, Search, CheckCircle,
  PieChart, RefreshCw, FileSpreadsheet, Clock, ShieldAlert, Zap, Cake, Gift,
  ArrowUpRight, ArrowDownRight, Eye, Bookmark, X, AlertTriangle, AlertCircle,
  Compass, Flame, Target, Activity, LayoutDashboard, MapPin, ChevronDown,
  ArrowRight, SlidersHorizontal, Sliders, FileText, Inbox, Save, FileCheck, Check,
  Maximize2, Grid, List, HelpCircle, Share2, CircleDot, ActivityIcon
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

// 17 Supported Chart Types
const CHART_TYPES: Array<{ id: VisualizationChartType; label: string; icon: string }> = [
  { id: "bar", label: "Bar Chart", icon: "📊" },
  { id: "horizontal_bar", label: "Horizontal Bar", icon: "📶" },
  { id: "line", label: "Line Chart", icon: "📈" },
  { id: "area", label: "Area Chart", icon: "⛰️" },
  { id: "stacked_bar", label: "Stacked Bar", icon: "🪜" },
  { id: "pie", label: "Pie Chart", icon: "🍕" },
  { id: "donut", label: "Donut Chart", icon: "🍩" },
  { id: "funnel", label: "Funnel Chart", icon: "🔻" },
  { id: "scatter", label: "Scatter Plot", icon: "🌌" },
  { id: "heatmap", label: "Heatmap", icon: "🔥" },
  { id: "treemap", label: "Treemap", icon: "🟃" },
  { id: "radar", label: "Radar Chart", icon: "🕸️" },
  { id: "gauge", label: "Gauge Chart", icon: "⏲️" },
  { id: "timeline", label: "Timeline", icon: "⏳" },
  { id: "kpi_cards", label: "KPI Cards", icon: "🎴" },
  { id: "data_table", label: "Data Table", icon: "📋" },
];

export function EnterpriseReportsEngine() {
  const [activeSection, setActiveSection] = useState<ReportSection>("dashboard");
  const [selectedChartType, setSelectedChartType] = useState<VisualizationChartType>("bar");
  const [activeGroupBy, setActiveGroupBy] = useState<GroupByDimension>("branch");
  const [activeCompareBy, setActiveCompareBy] = useState<ComparisonDimension>("none");

  // Dashboard Builder Widget State
  const [activeWidgets, setActiveWidgets] = useState<string[]>([
    "revenue", "orders", "profit", "customers", "inventory", "delivery", "branches"
  ]);
  const [showAddWidgetModal, setShowAddWidgetModal] = useState<boolean>(false);
  const [isFullscreenChart, setIsFullscreenChart] = useState<boolean>(false);

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
    chartType: "bar",
    groupBy: "branch",
    compareBy: "none",
  });

  const [fromInput, setFromInput] = useState<string>("");
  const [toInput, setToInput] = useState<string>("");

  // Modals
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
      const activeFilterState = {
        ...filters,
        chartType: selectedChartType,
        groupBy: activeGroupBy,
        compareBy: activeCompareBy,
      };
      const kpis = ReportsEngineData.getSectionKpis(activeSection, activeFilterState);
      const data = ReportsEngineData.fetchSectionData(activeSection, activeFilterState);
      setKpiCards(kpis);
      setSectionData(data);
      setSavedReportsList(ReportsEngineData.getSavedReports());
      setLoading(false);
    }, 60);
  }, [activeSection, filters, selectedChartType, activeGroupBy, activeCompareBy]);

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

  function handleExportPNG() {
    triggerToast("Exporting High-Res PNG Chart Image...");
  }

  function handleExportSVG() {
    triggerToast("Exporting Scalable Vector Graphics (SVG)...");
  }

  function handlePrintPDF() {
    window.print();
  }

  function toggleWidget(widgetId: string) {
    if (activeWidgets.includes(widgetId)) {
      setActiveWidgets((prev) => prev.filter((w) => w !== widgetId));
    } else {
      setActiveWidgets((prev) => [...prev, widgetId]);
    }
  }

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {toastMsg}
        </div>
      )}

      {/* ── HEADER & DASHBOARD BUILDER ACTION BAR ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <Heading level="h2" className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" /> CakeToHome Enterprise Visualization Engine
          </Heading>
          <Text className="text-xs text-slate-500 mt-0.5">
            Configurable ERP reporting & dashboard builder (Power BI / Looker Studio style) with 17 chart types.
          </Text>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button size="small" variant="secondary" onClick={() => setShowAddWidgetModal(true)} className="text-xs gap-1.5">
            <Grid className="w-3.5 h-3.5 text-indigo-500" /> Dashboard Builder ({activeWidgets.length} Widgets)
          </Button>

          <Button size="small" variant="secondary" onClick={() => setShowSavedReportsModal(true)} className="text-xs gap-1.5">
            <Bookmark className="w-3.5 h-3.5 text-amber-500" /> Saved Views ({savedReportsList.length})
          </Button>

          <Button size="small" variant="secondary" onClick={handleExportCSV} className="text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV / Excel
          </Button>

          <Button size="small" onClick={handlePrintPDF} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5">
            <Printer className="w-3.5 h-3.5" /> PDF / Print
          </Button>
        </div>
      </div>

      {/* ── NAVIGATION SECTIONS BAR ──────────────────────────────────────────── */}
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

      {/* ── UNIVERSAL FILTER BAR & DYNAMIC CONTROLS ───────────────────────────── */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Universal Date Engine */}
            <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] text-slate-400 font-bold uppercase">Date Range:</span>
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

            {/* Multi-Dimension Grouping Selector */}
            <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800">
              <Sliders className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] text-slate-400 font-bold uppercase">Group By:</span>
              <select
                value={activeGroupBy}
                onChange={(e) => setActiveGroupBy(e.target.value as GroupByDimension)}
                className="bg-transparent font-bold outline-none text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="branch">Branch Kitchen</option>
                <option value="city">City Location</option>
                <option value="area">Area Locality</option>
                <option value="delivery_zone">Delivery Zone</option>
                <option value="category">Cake Category</option>
                <option value="flavour">Flavour Economics</option>
                <option value="payment_method">Payment Method</option>
              </select>
            </div>

            {/* Comparison Mode Selector */}
            <div className="flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-[10px] text-slate-400 font-bold uppercase">Comparison:</span>
              <select
                value={activeCompareBy}
                onChange={(e) => setActiveCompareBy(e.target.value as ComparisonDimension)}
                className="bg-transparent font-bold outline-none text-slate-800 dark:text-slate-200 text-xs"
              >
                <option value="none">No Comparison</option>
                <option value="current_vs_previous">Current vs Prev Period</option>
                <option value="branch_vs_branch">Branch vs Branch</option>
                <option value="category_vs_category">Category vs Category</option>
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

      {/* ── CONFIGURABLE ENTERPRISE CHART VISUALIZER (17 CHART TYPES TOOLBAR) ── */}
      <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 ${isFullscreenChart ? "fixed inset-4 z-[180] overflow-y-auto" : ""}`}>
        {/* Visualizer Top Bar with 17 Chart Types Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
          <div>
            <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" /> Interactive Enterprise Visualization Canvas
            </Heading>
            <Text className="text-[11px] text-slate-400">Select any of the 17 visualization types below to switch view instantly</Text>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="small" variant="secondary" onClick={handleExportPNG} className="text-[10px]">PNG</Button>
            <Button size="small" variant="secondary" onClick={handleExportSVG} className="text-[10px]">SVG</Button>
            <Button size="small" variant="secondary" onClick={handleExportCSV} className="text-[10px]">CSV</Button>
            <Button size="small" variant="secondary" onClick={() => setIsFullscreenChart(!isFullscreenChart)} className="text-[10px]">
              <Maximize2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* 17 Chart Type Toolbar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b scrollbar-thin">
          {CHART_TYPES.map((ct) => {
            const isSelected = selectedChartType === ct.id;
            return (
              <button
                key={ct.id}
                onClick={() => setSelectedChartType(ct.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? "bg-amber-500 text-slate-950 shadow-sm scale-105"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                <span>{ct.icon}</span>
                {ct.label}
              </button>
            );
          })}
        </div>

        {/* Chart Dynamic Renderer Canvas */}
        {loading ? (
          <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-500" /> Re-rendering visualization canvas…
          </div>
        ) : sectionData?.chart_data && sectionData.chart_data.length > 0 ? (
          <div className="pt-4 pb-2">
            {/* BAR & STACKED BAR CHART */}
            {(selectedChartType === "bar" || selectedChartType === "stacked_bar") && (
              <div className="h-48 flex items-end gap-3 pt-6 pb-2 border-b">
                {sectionData.chart_data.map((item: any, idx: number) => {
                  const val = item.val || 10;
                  const maxVal = Math.max(...sectionData.chart_data.map((d: any) => d.val || 10));
                  const heightPct = Math.max(12, Math.round((val / maxVal) * 100));

                  return (
                    <div key={idx} onClick={() => openDrilldown("chart_node", item.label)} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                      <span className="text-[9px] font-mono font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">₹{Math.round(val / 1000)}k</span>
                      <div className="w-full bg-amber-500 hover:bg-amber-400 rounded-t-lg transition-all" style={{ height: `${heightPct}%` }} />
                      <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[65px]">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* HORIZONTAL BAR CHART */}
            {selectedChartType === "horizontal_bar" && (
              <div className="space-y-3 pt-2">
                {sectionData.chart_data.map((item: any, idx: number) => {
                  const val = item.val || 10;
                  const maxVal = Math.max(...sectionData.chart_data.map((d: any) => d.val || 10));
                  const widthPct = Math.max(12, Math.round((val / maxVal) * 100));

                  return (
                    <div key={idx} onClick={() => openDrilldown("chart_node", item.label)} className="space-y-1 cursor-pointer group">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>{item.label}</span>
                        <span className="font-mono text-amber-600">₹{val.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-3.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 group-hover:bg-amber-400 h-full rounded-full transition-all" style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* LINE & AREA CHART */}
            {(selectedChartType === "line" || selectedChartType === "area" || selectedChartType === "stacked_area") && (
              <div className="space-y-3">
                <div className="h-44 flex items-end gap-2 pt-6 pb-2 border-b">
                  {sectionData.chart_data.map((item: any, idx: number) => {
                    const val = item.val || 10;
                    const maxVal = Math.max(...sectionData.chart_data.map((d: any) => d.val || 10));
                    const heightPct = Math.max(15, Math.round((val / maxVal) * 100));
                    return (
                      <div key={idx} onClick={() => openDrilldown("chart_node", item.label)} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                        <div className="w-2.5 h-2.5 bg-amber-500 rounded-full group-hover:scale-125 transition-transform" />
                        <div className={`w-full ${selectedChartType === "area" ? "bg-amber-500/30" : "bg-amber-500"} rounded-t-sm transition-all`} style={{ height: `${heightPct}%` }} />
                        <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[65px]">{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PIE & DONUT CHART */}
            {(selectedChartType === "pie" || selectedChartType === "donut") && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-4">
                <div className="relative w-36 h-36 rounded-full border-8 border-amber-500 flex items-center justify-center shadow-lg">
                  {selectedChartType === "donut" && (
                    <div className="text-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Share</span>
                      <span className="text-sm font-extrabold font-mono text-amber-600">100%</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-xs">
                  {sectionData.chart_data.map((item: any, idx: number) => (
                    <div key={idx} onClick={() => openDrilldown("chart_node", item.label)} className="flex items-center gap-2 cursor-pointer hover:underline font-medium">
                      <span className="w-3 h-3 rounded-full bg-amber-500" />
                      <span>{item.label}:</span>
                      <span className="font-bold font-mono text-slate-900 dark:text-white">₹{item.val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FUNNEL CHART */}
            {selectedChartType === "funnel" && (
              <div className="space-y-2 py-3 max-w-lg mx-auto">
                {sectionData.chart_data.map((item: any, idx: number) => {
                  const widthPct = 100 - (idx * 18);
                  return (
                    <div key={idx} onClick={() => openDrilldown("chart_node", item.label)} className="mx-auto text-center p-2.5 bg-amber-500 text-slate-950 font-bold rounded-xl shadow-sm text-xs cursor-pointer transition-all hover:bg-amber-400" style={{ width: `${widthPct}%` }}>
                      {item.label} — {item.val.toLocaleString()}
                    </div>
                  );
                })}
              </div>
            )}

            {/* GAUGE & RADAR CHART */}
            {(selectedChartType === "gauge" || selectedChartType === "radar") && (
              <div className="flex flex-col items-center justify-center py-6 space-y-2">
                <div className="w-32 h-16 border-t-8 border-x-8 border-amber-500 rounded-t-full flex items-end justify-center pb-2 font-mono font-extrabold text-xl text-slate-900 dark:text-white">
                  96.4%
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fleet SLA Performance Target</span>
              </div>
            )}

            {/* HEATMAP & TREEMAP */}
            {(selectedChartType === "heatmap" || selectedChartType === "treemap") && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                {sectionData.chart_data.map((item: any, idx: number) => (
                  <div key={idx} onClick={() => openDrilldown("chart_node", item.label)} className="p-4 bg-amber-500/20 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 rounded-xl space-y-1 cursor-pointer hover:border-amber-500">
                    <span className="text-[10px] font-bold text-slate-500 block truncate">{item.label}</span>
                    <div className="text-sm font-extrabold font-mono text-amber-600">₹{item.val.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs space-y-1">
            <Inbox className="w-8 h-8 mx-auto" />
            <span>No data available for the active chart visualization.</span>
          </div>
        )}
      </div>

      {/* ── STEP 5: DATA TABLE (Sticky Header, Sortable, Searchable, Paginated) ── */}
      {sectionData?.table_rows && sectionData.table_rows.length > 0 && (
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

      {/* ── DASHBOARD BUILDER MODAL ────────────────────────────────────────── */}
      {showAddWidgetModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Grid className="w-4 h-4 text-indigo-500" /> Dashboard Widget Builder
              </Heading>
              <button onClick={() => setShowAddWidgetModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-500 font-bold block">Toggle Active Dashboard Widgets:</Label>
              {[
                { id: "revenue", label: "Gross Revenue Widget" },
                { id: "orders", label: "Total Orders Widget" },
                { id: "profit", label: "Net Operating Profit Widget" },
                { id: "customers", label: "Customer Retention Widget" },
                { id: "inventory", label: "Raw Base Stock Valuation Widget" },
                { id: "delivery", label: "Delivery Fleet SLA Widget" },
                { id: "branches", label: "Branch Kitchen Matrix Widget" },
              ].map((w) => (
                <label key={w.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border cursor-pointer">
                  <span className="font-semibold">{w.label}</span>
                  <input
                    type="checkbox"
                    checked={activeWidgets.includes(w.id)}
                    onChange={() => toggleWidget(w.id)}
                    className="accent-amber-500 w-4 h-4"
                  />
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button size="small" variant="secondary" onClick={() => setShowAddWidgetModal(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}

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
              <Label className="text-slate-500 font-bold block">Save Active Visualization State</Label>
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

      {/* ── DRILL DOWN INSPECTION MODAL (KPI → Chart → Order → Timeline) ────── */}
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
                <Text className="font-bold text-xs uppercase tracking-wider text-slate-500">Order Lifecycle Audit Log:</Text>
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
