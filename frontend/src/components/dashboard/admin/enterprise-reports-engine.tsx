"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Heading, Text, Badge, Input, Button } from "@medusajs/ui";
import {
  ReportsEngineData,
  ReportFilterState,
  ReportSection,
  ComparisonMode,
  ReportTimeRange,
} from "@frontend/lib/reports-engine-data";
import { ExcelExportService, setExportBusinessIdentity } from "@frontend/lib/excel-export-service";
import { apiClient } from "@frontend/lib/api-client";
import { getReportDefinition } from "@frontend/lib/report-registry";
import {
  LayoutDashboard, TrendingUp, Package, ShoppingBag, BarChart3,
  FileText, Truck, Users, DollarSign, MapPin, Sparkles, AlertCircle,
  Calendar, Download, Printer, Search, ArrowUpRight, ArrowDownRight,
  Filter, SlidersHorizontal, RefreshCw, CheckCircle2, ChevronRight, ChevronDown, X, Building2
} from "lucide-react";
import { listBranches } from "@frontend/lib/data/branches";

const SECTIONS: Array<{ id: ReportSection; label: string; icon: any }> = [
  { id: "executive_summary", label: "Executive Summary", icon: LayoutDashboard },
  { id: "daily_sales", label: "Daily Sales", icon: Calendar },
  { id: "weekly_sales", label: "Weekly Sales", icon: TrendingUp },
  { id: "monthly_sales", label: "Monthly Sales", icon: BarChart3 },
  { id: "sales", label: "Sales & Revenue", icon: DollarSign },
  { id: "products", label: "Products & Profitability", icon: Package },
  { id: "branches", label: "Branch Performance", icon: Building2 },
  { id: "city_sales", label: "City & Regional Sales", icon: MapPin },
  { id: "area_pincode", label: "Area & Pincode", icon: MapPin },
  { id: "tax_gst", label: "Tax & GST Register", icon: FileText },
  { id: "orders", label: "Order Register", icon: ShoppingBag },
  { id: "payments", label: "Payments & Refunds", icon: DollarSign },
  { id: "delivery", label: "Delivery & Fleet", icon: Truck },
  { id: "customers", label: "Customer Analytics", icon: Users },
  { id: "cross_sell", label: "Cross-Sell & Upsell", icon: Sparkles },
  { id: "exceptions", label: "Exception Center", icon: AlertCircle },
];

export function EnterpriseReportsEngine() {
  const [activeSection, setActiveSection] = useState<ReportSection>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("section") as ReportSection;
      if (p && SECTIONS.some((s) => s.id === p)) {
        return p;
      }
    }
    return "executive_summary";
  });

  // Dynamic Kitchen Hub / Branch List from Canonical API
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [showBranchPopover, setShowBranchPopover] = useState<boolean>(false);
  const [branchSearch, setBranchSearch] = useState<string>("");
  const [availablePartners, setAvailablePartners] = useState<any[]>([]);
  const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
  const [dataVersion, setDataVersion] = useState<number>(0);

  const refreshAllData = useCallback(() => {
    Promise.all([
      listBranches(),
      apiClient.get<any[]>("/admin/delivery/partners").catch(() => []),
      apiClient.get<any[]>("/admin/customers").catch(() => []),
    ]).then(([branches, partners, customers]) => {
      const branchList = Array.isArray(branches) ? branches : [];
      setAvailableBranches(branchList);
      setAvailablePartners(Array.isArray(partners) ? partners : []);
      setAvailableCustomers(Array.isArray(customers) ? customers : []);
      setDataVersion((v) => v + 1);
    });
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Available Cities
  const availableCities = useMemo(() => {
    const cities = new Set<string>();
    availableBranches.forEach((b) => {
      if (b.city) cities.add(b.city);
    });
    return ["all", ...Array.from(cities)];
  }, [availableBranches]);

  // Master Filter State
  const [timeRange, setTimeRange] = useState<ReportTimeRange>("this_month");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [compareMode, setCompareMode] = useState<ComparisonMode>("previous_period");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [productSortBy, setProductSortBy] = useState<"revenue" | "profit" | "margin" | "quantity" | "refunded">("revenue");
  const [topProductsMetric, setTopProductsMetric] = useState<"revenue" | "profit" | "quantity">("revenue");
  const [gstReportType, setGstReportType] = useState<"hsn_summary" | "tax_summary" | "invoice_register" | "gst_transactions" | "b2b_sales" | "b2c_sales" | "credit_notes" | "gstr1" | "gstr3b" | "validation_audit" | "gst_summary">("hsn_summary");

  // Exception audit resolution state
  const [resolvedExceptionIds, setResolvedExceptionIds] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const handleSelectAllBranches = () => {
    setBranchIds(availableBranches.map((b) => b.id));
  };

  const handleClearAllBranches = () => {
    setBranchIds([]);
  };

  const toggleBranchSelection = (id: string) => {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const branchButtonLabel = useMemo(() => {
    if (!branchIds || branchIds.length === 0) {
      return "All Operating Kitchens";
    }
    if (availableBranches.length > 0 && branchIds.length === availableBranches.length) {
      return `All branches selected (${availableBranches.length})`;
    }
    if (branchIds.length === 1) {
      const match = availableBranches.find((b) => b.id === branchIds[0]);
      return match ? match.name : branchIds[0];
    }
    return `${branchIds.length} branches selected`;
  }, [branchIds, availableBranches]);

  const filters: ReportFilterState = useMemo(() => ({
    timeRange,
    customStartDate,
    customEndDate,
    compareMode,
    branchIds,
    city: cityFilter,
    searchQuery,
    productSortBy,
    topProductsMetric,
  }), [timeRange, customStartDate, customEndDate, compareMode, branchIds, cityFilter, searchQuery, productSortBy, topProductsMetric]);

  // Authoritative Derived Data Sets (from ReportsEngineData V3)
  const kpis = useMemo(() => ReportsEngineData.getExecutiveKpis(filters), [filters, dataVersion]);
  const stats = useMemo(() => ReportsEngineData.getTransactionalMetrics(filters), [filters, dataVersion]);
  const dailyData = useMemo(() => ReportsEngineData.getDailySalesReport(filters), [filters, dataVersion]);
  const weeklyData = useMemo(() => ReportsEngineData.getWeeklySalesReport(filters), [filters, dataVersion]);
  const monthlyData = useMemo(() => ReportsEngineData.getMonthlySalesReport(filters), [filters, dataVersion]);
  const products = useMemo(() => ReportsEngineData.getProductPerformance(filters), [filters, dataVersion]);
  const orders = useMemo(() => ReportsEngineData.getOrderLifecycle(filters), [filters, dataVersion]);
  const branchPerformance = useMemo(() => ReportsEngineData.getBranchPerformance(filters, availableBranches), [filters, availableBranches, dataVersion]);
  const cityPerformance = useMemo(() => ReportsEngineData.getCityPerformance(filters), [filters, dataVersion]);
  const areaPincodePerformance = useMemo(() => ReportsEngineData.getAreaPincodePerformance(filters), [filters, dataVersion]);
  const gstSummary = useMemo(() => ReportsEngineData.getGstHsnSummary(filters), [filters, dataVersion]);
  const gstDetailedRegister = useMemo(() => ReportsEngineData.getGstDetailedRegister(filters), [filters, dataVersion]);
  const gstItems = useMemo(() => ReportsEngineData.getGstReport(filters), [filters, dataVersion]);
  const taxSummary = useMemo(() => ReportsEngineData.getTaxSummaryReport(filters), [filters, dataVersion]);
  const rawExceptions = useMemo(() => ReportsEngineData.getExceptionCenterAudit(filters, products, orders), [filters, products, orders, dataVersion]);
  const exceptions = useMemo(() => rawExceptions.filter((e: any) => !resolvedExceptionIds.includes(e.id)), [rawExceptions, resolvedExceptionIds]);
  const deliveryData = useMemo(() => ReportsEngineData.getDeliveryFleetPerformance(filters, availablePartners), [filters, availablePartners, dataVersion]);
  const customerData = useMemo(() => ReportsEngineData.getCustomerAnalytics(filters, availableCustomers), [filters, availableCustomers, dataVersion]);
  const paymentData = useMemo(() => ReportsEngineData.getPaymentsRefunds(filters), [filters, dataVersion]);
  const geoData = useMemo(() => ReportsEngineData.getGeographicSales(filters), [filters, dataVersion]);
  const crossSellData = useMemo(() => ReportsEngineData.getCrossSellUpsell(filters), [filters, dataVersion]);

  // Top 3 & Bottom 3 Products for Executive Summary
  const top3Products = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      if (topProductsMetric === "revenue") return b.netSales - a.netSales;
      if (topProductsMetric === "quantity") return b.quantitySold - a.quantitySold;
      return b.grossProfit - a.grossProfit;
    });
    return sorted.slice(0, 3);
  }, [products, topProductsMetric]);

  const bottom3Products = useMemo(() => {
    const sorted = [...products].sort((a, b) => {
      if (topProductsMetric === "revenue") return a.netSales - b.netSales;
      if (topProductsMetric === "quantity") return a.quantitySold - b.quantitySold;
      return a.grossProfit - b.grossProfit;
    });
    return sorted.slice(0, 3);
  }, [products, topProductsMetric]);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const activeReportDef = useMemo(() => getReportDefinition(activeSection), [activeSection]);

  const handleExportActiveReport = async () => {
    setIsExporting(true);
    try {
      switch (activeSection) {
        case "executive_summary":
          await ExcelExportService.exportExecutiveSummary({
            kpis,
            stats,
            top3: top3Products,
            bottom3: bottom3Products,
            paymentBreakdown: paymentData?.breakdown || [],
            deliverySla: deliveryData || {},
            customerRetention: customerData || {},
            cityPerformance: cityPerformance || [],
            filters,
          });
          break;
        case "daily_sales":
          await ExcelExportService.exportDailySalesReport({ daily: dailyData, filters });
          break;
        case "weekly_sales":
          await ExcelExportService.exportWeeklySalesReport({ weekly: weeklyData, filters });
          break;
        case "monthly_sales":
          await ExcelExportService.exportMonthlySalesReport({ monthly: monthlyData, filters });
          break;
        case "sales":
          await ExcelExportService.exportDailySalesReport({ daily: dailyData, filters });
          break;
        case "tax_gst":
          await ExcelExportService.exportGstHsnSummary({ gstSummary, filters });
          break;
        case "products":
          await ExcelExportService.exportProductPerformance({ products, filters });
          break;
        case "orders":
          await ExcelExportService.exportOrderRegister({ orders, filters });
          break;
        case "city_sales":
          await ExcelExportService.exportCityPerformance({ cities: cityPerformance, filters });
          break;
        case "area_pincode":
          await ExcelExportService.exportAreaPincodeSales({ areaPincodes: areaPincodePerformance, filters });
          break;
        case "branches":
          await ExcelExportService.exportBranchPerformance({ cities: branchPerformance, filters });
          break;
        case "payments":
          await ExcelExportService.exportPaymentsRefunds({ payments: paymentData, filters });
          break;
        case "delivery":
          await ExcelExportService.exportDeliveryFleet({ delivery: deliveryData, filters });
          break;
        case "customers":
          await ExcelExportService.exportCustomerAnalytics({ customers: customerData, filters });
          break;
        case "cross_sell":
          await ExcelExportService.exportCrossSellUpsell({ crossSell: crossSellData, filters });
          break;
        case "exceptions":
          await ExcelExportService.exportExceptionCenter({ exceptions, filters });
          break;
        default:
          await handleExportCompleteWorkbook();
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCompleteWorkbook = async () => {
    setIsExporting(true);
    try {
      await ExcelExportService.exportCompleteWorkbook({
        kpis,
        daily: dailyData,
        weekly: weeklyData,
        monthly: monthlyData,
        products,
        branches: branchPerformance,
        cities: cityPerformance,
        areaPincodes: areaPincodePerformance,
        payments: paymentData,
        delivery: deliveryData,
        customers: customerData,
        gstSummary,
        gstDetailedRegister,
        orderRegister: orders,
        crossSell: crossSellData,
        exceptions: exceptions,
        filters,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* ── TOP EXECUTIVE CONTROLS & DATE FILTER BAR ────────────────────── */}
      <div className="flex flex-col gap-4 bg-ui-bg-base border border-ui-border-base rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-ui-border-base">
          <div>
            <Heading level="h1" className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-ui-fg-base">
              📊 CakeToHome ERP Reporting & Operations
            </Heading>
            <Text className="text-xs sm:text-sm text-ui-fg-subtle">
              Unified transactional reconciliation, statutory GST B2C HSN summary, and real Excel exports.
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="small"
              onClick={handleExportCompleteWorkbook}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> {isExporting ? "Generating XLSX..." : "Export Complete Workbook (16 Sheets XLSX)"}
            </Button>
            <Badge color="purple" className="text-xs font-semibold px-2.5 py-1">
              GSTIN: 29AAAAA0000A1Z5
            </Badge>
          </div>
        </div>

        {/* ── FILTER & COMPARISON TOOLBAR ────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Time Range Selector */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-ui-fg-subtle flex items-center gap-1">
              <Calendar className="w-3 h-3 text-rose-500" /> Time Range
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as ReportTimeRange)}
              className="h-9 px-3 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-lg font-medium text-ui-fg-base focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Custom Date Inputs if Custom selected */}
          {timeRange === "custom" ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold text-ui-fg-subtle">From Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-9 px-2 text-xs bg-ui-bg-subtle border rounded-lg"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold text-ui-fg-subtle">To Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-9 px-2 text-xs bg-ui-bg-subtle border rounded-lg"
                />
              </div>
            </div>
          ) : (
            /* Comparison Engine Dropdown */
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold uppercase tracking-wider text-ui-fg-subtle flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-indigo-500" /> Compare With
              </label>
              <select
                value={compareMode}
                onChange={(e) => setCompareMode(e.target.value as ComparisonMode)}
                className="h-9 px-3 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-lg font-medium text-ui-fg-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="previous_period">Previous Equivalent Period</option>
                <option value="previous_month">Previous Month</option>
                <option value="previous_year">Previous Year</option>
                <option value="none">No Comparison</option>
              </select>
            </div>
          )}

          {/* City / Region Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-ui-fg-subtle flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-500" /> Operating City
            </label>
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="h-9 px-3 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-lg font-medium text-ui-fg-base focus:outline-none focus:ring-2 focus:ring-rose-500"
            >
              {availableCities.map((c) => (
                <option key={c} value={c}>{c === "all" ? "All Operating Cities" : c}</option>
              ))}
            </select>
          </div>

          {/* Multi-Select Kitchen Hub / Branch Filter */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-[11px] font-bold uppercase tracking-wider text-ui-fg-subtle flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-500" /> Kitchen Hubs / Branches
            </label>
            <button
              type="button"
              onClick={() => setShowBranchPopover(!showBranchPopover)}
              className="h-9 px-3 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-lg font-medium text-ui-fg-base flex items-center justify-between hover:bg-ui-bg-subtle/80 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <span className="truncate max-w-[180px] font-semibold text-emerald-700">{branchButtonLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-ui-fg-subtle ml-1" />
            </button>

            {showBranchPopover && (
              <div className="absolute top-16 left-0 z-[1000] w-80 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl flex flex-col gap-2.5 opacity-100 min-w-[300px]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Select Operating Locations ({availableBranches.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBranchPopover(false)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200"
                  >
                    Done
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search branches..."
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 px-1">
                  <button
                    type="button"
                    onClick={handleSelectAllBranches}
                    className="flex-1 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-md"
                  >
                    [ Select All ]
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllBranches}
                    className="flex-1 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 rounded-md"
                  >
                    [ Clear All ]
                  </button>
                </div>

                <div className="flex flex-col gap-1 overflow-y-auto max-h-[220px] pr-1">
                  {availableBranches
                    .filter((b) => !branchSearch || b.name.toLowerCase().includes(branchSearch.toLowerCase()))
                    .map((b) => {
                      const isChecked = branchIds.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 cursor-pointer text-xs font-medium">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBranchSelection(b.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="truncate flex-1">{b.name}</span>
                          {b.code && <span className="text-[10px] text-slate-400 uppercase font-mono">{b.code}</span>}
                        </label>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Search Bar */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-ui-fg-subtle flex items-center gap-1">
              <Search className="w-3 h-3 text-amber-500" /> Search Filter
            </label>
            <Input
              placeholder="Search product, SKU, HSN, invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ── NAVIGATION TABS ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-ui-border-base">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                  : "bg-ui-bg-base text-ui-fg-subtle hover:bg-ui-bg-subtle hover:text-ui-fg-base border border-ui-border-base"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-ui-fg-subtle"}`} />
              {sec.label}
              {sec.id === "exceptions" && exceptions.length > 0 && (
                <Badge color="red" className="text-[9px] px-1.5 py-0.5 rounded-full ml-1">
                  {exceptions.length}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* ── SECTION: EXECUTIVE SUMMARY ───────────────────────────────────── */}
      {activeSection === "executive_summary" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                📈 Executive Management Summary & Operations Dashboard
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Real-time snapshot of business KPIs, revenue vs margins, delivery SLA, and payment mix.
              </Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={handleExportActiveReport}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100 shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Executive Summary (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.id} className="flex flex-col justify-between p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col gap-1">
                  <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase tracking-wider line-clamp-1">
                    {kpi.label}
                  </Text>
                  <Heading level="h2" className="text-lg sm:text-xl font-bold text-ui-fg-base">
                    {kpi.unit === "currency" ? `₹${kpi.currentValue.toLocaleString("en-IN")}` : kpi.unit === "percentage" ? `${kpi.currentValue}%` : kpi.currentValue.toLocaleString("en-IN")}
                  </Heading>
                </div>

                {compareMode !== "none" && (
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-ui-border-base/60 text-xs">
                    <span className={`flex items-center font-bold text-[11px] ${kpi.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                      {kpi.isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                      {Math.abs(kpi.growthPct)}%
                    </span>
                    <span className="text-[10px] text-ui-fg-muted">
                      vs {kpi.unit === "currency" ? `₹${kpi.previousValue.toLocaleString("en-IN")}` : kpi.previousValue}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-3 p-5 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-ui-border-base">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <Heading level="h3" className="text-sm font-bold">Net Sales vs Contribution Profit</Heading>
                </div>
                <Badge color="green">Real-time Reconciliation</Badge>
              </div>

              <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-2 px-2 bg-gradient-to-b from-ui-bg-subtle/20 to-ui-bg-subtle/80 rounded-xl border border-ui-border-base/50">
                {[45, 62, 58, 74, 82, 90, 88, 96, 105, 118].map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div className="w-full bg-emerald-500/80 rounded-t-sm transition-all group-hover:bg-emerald-600" style={{ height: `${val * 0.9}px` }} />
                    <div className="w-full bg-rose-500/80 rounded-t-sm transition-all group-hover:bg-rose-600" style={{ height: `${val * 0.4}px` }} />
                    <span className="text-[9px] text-ui-fg-muted font-mono">D{idx + 1}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-6 pt-2 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-700">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" /> Net Sales (₹{stats.netSalesExclTax.toLocaleString("en-IN")})
                </span>
                <span className="flex items-center gap-1.5 text-rose-700">
                  <span className="w-3 h-3 rounded-full bg-rose-500" /> Contribution Profit (₹{stats.grossProfit.toLocaleString("en-IN")})
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-5 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-ui-border-base">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-rose-600" />
                  <Heading level="h3" className="text-sm font-bold">Top 3 & Bottom 3 Performers</Heading>
                </div>

                <div className="flex items-center gap-1 bg-ui-bg-subtle p-1 rounded-lg border text-[10px]">
                  <button
                    onClick={() => setTopProductsMetric("revenue")}
                    className={`px-2 py-0.5 rounded font-bold ${topProductsMetric === "revenue" ? "bg-rose-600 text-white" : "text-ui-fg-subtle"}`}
                  >
                    Revenue
                  </button>
                  <button
                    onClick={() => setTopProductsMetric("profit")}
                    className={`px-2 py-0.5 rounded font-bold ${topProductsMetric === "profit" ? "bg-rose-600 text-white" : "text-ui-fg-subtle"}`}
                  >
                    Profit
                  </button>
                  <button
                    onClick={() => setTopProductsMetric("quantity")}
                    className={`px-2 py-0.5 rounded font-bold ${topProductsMetric === "quantity" ? "bg-rose-600 text-white" : "text-ui-fg-subtle"}`}
                  >
                    Qty
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/20">
                  <Text className="text-[11px] font-bold uppercase text-emerald-800">🏆 Top 3 Best Sellers</Text>
                  {top3Products.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-emerald-500/10 last:border-0">
                      <span className="font-semibold text-ui-fg-base truncate max-w-[130px]">{i + 1}. {p.name}</span>
                      <span className="font-bold text-emerald-700">₹{p.netSales.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                  <Text className="text-[11px] font-bold uppercase text-rose-800">⚠️ Bottom 3 Performers</Text>
                  {bottom3Products.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-rose-500/10 last:border-0">
                      <span className="font-semibold text-ui-fg-base truncate max-w-[130px]">{i + 1}. {p.name}</span>
                      <span className="font-bold text-rose-700">₹{p.netSales.toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION: 1. DAILY SALES REPORT ──────────────────────────────── */}
      {activeSection === "daily_sales" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                📅 Daily Operational Sales & Cash Reconciliation
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Daily transactional summary, payment gateway gross/refund reconciliation & kitchen hub volume.
              </Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => ExcelExportService.exportDailySalesReport({ daily: dailyData, filters })}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Daily Sales (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Daily Orders</Text>
              <Heading level="h3" className="text-lg font-bold mt-1">{dailyData.stats.totalOrders}</Heading>
              <Text className="text-[10px] text-emerald-600 font-semibold mt-1">{dailyData.stats.deliveredOrders} Delivered</Text>
            </div>
            <div className="p-4 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Gross Sales</Text>
              <Heading level="h3" className="text-lg font-bold mt-1">₹{dailyData.stats.grossRevenue.toLocaleString("en-IN")}</Heading>
              <Text className="text-[10px] text-ui-fg-muted mt-1">Tax Inclusive</Text>
            </div>
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-emerald-800 uppercase">Net Sales (Excl. Tax)</Text>
              <Heading level="h3" className="text-lg font-bold text-emerald-700 mt-1">₹{dailyData.stats.netSalesExclTax.toLocaleString("en-IN")}</Heading>
              <Text className="text-[10px] text-emerald-600 mt-1">₹{dailyData.stats.gstCollected.toLocaleString("en-IN")} GST Collected</Text>
            </div>
            <div className="p-4 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Average Order Value</Text>
              <Heading level="h3" className="text-lg font-bold mt-1">₹{dailyData.stats.aov.toLocaleString("en-IN")}</Heading>
              <Text className="text-[10px] text-ui-fg-muted mt-1">Per Placed Order</Text>
            </div>
          </div>

          {/* Daily Payment Reconciliation Table */}
          <div className="flex flex-col gap-4 p-5 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <Heading level="h3" className="text-sm font-bold pb-2 border-b border-ui-border-base">💵 Daily Payment Gateway Reconciliation</Heading>
            <div className="overflow-x-auto border border-ui-border-base rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                    <th className="p-3">Payment Method</th>
                    <th className="p-3 text-right">Orders Count</th>
                    <th className="p-3 text-right">Gross Collections</th>
                    <th className="p-3 text-right">Refund Amount</th>
                    <th className="p-3 text-right">Net Settled Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border-base font-mono">
                  {dailyData.paymentSummary.map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                      <td className="p-3 font-sans font-bold text-ui-fg-base">{p.method}</td>
                      <td className="p-3 text-right font-medium">{p.count}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">₹{p.gross.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right text-rose-600">₹{(p.refundAmount || 0).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-bold text-indigo-700">₹{(p.netAmount || p.gross).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Branch Breakdown Table */}
          <div className="flex flex-col gap-4 p-5 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <Heading level="h3" className="text-sm font-bold pb-2 border-b border-ui-border-base">🏢 Daily Kitchen Hub Volume & Revenue</Heading>
            <div className="overflow-x-auto border border-ui-border-base rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                    <th className="p-3">Kitchen Hub</th>
                    <th className="p-3">Hub Code</th>
                    <th className="p-3">City</th>
                    <th className="p-3 text-right">Orders</th>
                    <th className="p-3 text-right">Gross Sales</th>
                    <th className="p-3 text-right">Net Sales</th>
                    <th className="p-3 text-right">AOV</th>
                    <th className="p-3 text-right">Delivered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border-base font-mono">
                  {dailyData.branchSummary.map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                      <td className="p-3 font-sans font-bold text-ui-fg-base">{b.branchName}</td>
                      <td className="p-3 font-mono font-bold text-indigo-700">{b.branchCode}</td>
                      <td className="p-3 font-sans text-ui-fg-subtle">{b.city || "—"}</td>
                      <td className="p-3 text-right font-medium">{b.ordersCount}</td>
                      <td className="p-3 text-right font-medium">₹{b.grossSales.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">₹{b.netSales.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-medium">₹{b.aov.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-bold text-sky-700">{b.deliveredCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION: 2. WEEKLY SALES REPORT ─────────────────────────────── */}
      {activeSection === "weekly_sales" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                📈 Weekly Sales & Product Performance
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Weekly best selling cakes, least selling cake opportunities, and payment method percentage split.
              </Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => ExcelExportService.exportWeeklySalesReport({ weekly: weeklyData, filters })}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Weekly Report (XLSX)
            </Button>
          </div>

          {/* Top 3 & Least Selling Cake Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top 3 Best Sellers */}
            <div className="flex flex-col gap-3 p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Heading level="h3" className="text-sm font-bold text-emerald-800 pb-2 border-b">🏆 Top 3 Best Selling Cakes</Heading>
              <div className="flex flex-col gap-3">
                {weeklyData.top3Cakes.map((c: any) => (
                  <div key={c.sku} className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                        #{c.rank}
                      </span>
                      <div>
                        <span className="font-bold text-xs text-slate-900">{c.name}</span>
                        <p className="text-[10px] text-slate-500 font-mono">{c.sku} | Avg Price: ₹{c.avgSellingPrice}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xs text-emerald-700">₹{c.netSales.toLocaleString("en-IN")}</span>
                      <p className="text-[10px] text-slate-500 font-semibold">{c.quantitySold} Units Sold</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Least Selling Cakes */}
            <div className="flex flex-col gap-3 p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Heading level="h3" className="text-sm font-bold text-rose-800 pb-2 border-b">⚠️ Least Selling Cakes (Rotation Candidates)</Heading>
              <div className="flex flex-col gap-3">
                {weeklyData.leastSellingCakes.slice(0, 3).map((c: any) => (
                  <div key={c.sku} className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center">
                        #{c.rank}
                      </span>
                      <div>
                        <span className="font-bold text-xs text-slate-900">{c.name}</span>
                        <p className="text-[10px] text-slate-500 font-mono">{c.sku} | Avg Price: ₹{c.avgSellingPrice}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xs text-rose-700">₹{c.netSales.toLocaleString("en-IN")}</span>
                      <p className="text-[10px] text-slate-500 font-semibold">{c.quantitySold} Units Sold</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weekly Payment Mix Breakdown */}
          <div className="flex flex-col gap-4 p-5 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <Heading level="h3" className="text-sm font-bold pb-2 border-b border-ui-border-base">💳 Weekly Payment Method Mix & % Share</Heading>
            <div className="overflow-x-auto border border-ui-border-base rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                    <th className="p-3">Payment Method</th>
                    <th className="p-3 text-right">Orders</th>
                    <th className="p-3 text-right">Gross Collections</th>
                    <th className="p-3 text-right">Refunds</th>
                    <th className="p-3 text-right">% of Total Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border-base font-mono">
                  {weeklyData.payments.map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                      <td className="p-3 font-sans font-bold text-ui-fg-base">{p.method}</td>
                      <td className="p-3 text-right font-medium">{p.count}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">₹{p.gross.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right text-rose-600">₹{(p.refundAmount || 0).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-bold text-indigo-700">{p.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION: 3. MONTHLY SALES REPORT ────────────────────────────── */}
      {activeSection === "monthly_sales" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                📊 Monthly Executive Growth & SLA Performance
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Month-over-month sales growth, delivery fleet SLA compliance & customer retention metrics.
              </Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => ExcelExportService.exportMonthlySalesReport({ monthly: monthlyData, filters })}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Monthly Report (XLSX)
            </Button>
          </div>

          {/* Month-over-Month Growth Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Current Month Net Sales</Text>
              <Heading level="h3" className="text-xl font-bold mt-1 text-emerald-700">₹{monthlyData.currentMonthSales.toLocaleString("en-IN")}</Heading>
              <Text className="text-[10px] text-ui-fg-muted mt-1">Excl. Tax & Discounts</Text>
            </div>
            <div className="p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Previous Month Net Sales</Text>
              <Heading level="h3" className="text-xl font-bold mt-1 text-slate-700">₹{monthlyData.prevMonthSales.toLocaleString("en-IN")}</Heading>
              <Text className="text-[10px] text-ui-fg-muted mt-1">Audited Baseline</Text>
            </div>
            <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-indigo-800 uppercase">Sales Growth %</Text>
              <Heading level="h3" className="text-xl font-bold mt-1 text-indigo-700">{monthlyData.growthPctDisplay}</Heading>
              <Text className="text-[10px] text-indigo-600 mt-1">MoM Revenue Velocity</Text>
            </div>
          </div>

          {/* Delivery SLA & Customer Retention Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Delivery SLA */}
            <div className="flex flex-col gap-3 p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Heading level="h3" className="text-sm font-bold pb-2 border-b">🚚 Monthly Delivery SLA Compliance</Heading>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-ui-bg-subtle rounded-xl">
                  <Text className="text-[10px] font-bold text-ui-fg-subtle uppercase">Total Dispatched</Text>
                  <Heading level="h3" className="text-base font-bold mt-1">{monthlyData.deliverySla.totalDeliveries}</Heading>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <Text className="text-[10px] font-bold text-emerald-800 uppercase">SLA Compliance</Text>
                  <Heading level="h3" className="text-base font-bold mt-1 text-emerald-700">{monthlyData.deliverySla.slaCompliancePct}%</Heading>
                </div>
              </div>
            </div>

            {/* Customer Retention */}
            <div className="flex flex-col gap-3 p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Heading level="h3" className="text-sm font-bold pb-2 border-b">👥 Monthly Customer Retention</Heading>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <Text className="text-[10px] font-bold text-amber-800 uppercase">Repeat Purchase Rate</Text>
                  <Heading level="h3" className="text-base font-bold mt-1 text-amber-700">{monthlyData.customerRetention.repeatPurchaseRate}%</Heading>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <Text className="text-[10px] font-bold text-purple-800 uppercase">Estimated CLTV</Text>
                  <Heading level="h3" className="text-base font-bold mt-1 text-purple-700">₹{monthlyData.customerRetention.ltv.toLocaleString("en-IN")}</Heading>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION: 4. STATUTORY GST & HSN SUMMARY ────────────────────── */}
      {activeSection === "tax_gst" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                🏛️ Statutory GST / HSN Summary (SALES B2C)
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Exact statutory B2C HSN format matching reference sample with intra-state CGST/SGST split and totals row.
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="small"
                onClick={() => ExcelExportService.exportGstHsnSummary({ gstSummary, filters })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export B2C HSN Summary (XLSX)
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => ExcelExportService.exportGstDetailedRegister({ register: gstDetailedRegister, filters })}
                className="text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" /> Export Detailed Register
              </Button>
            </div>
          </div>

          {/* Statutory Reference Table */}
          <div className="flex flex-col gap-4 p-5 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                SALES B2C HSN CODE SUMMARY (PERIOD: {filters.customStartDate || "CURRENT"})
              </span>
              <Badge color="purple">GSTR-1 Section 12 Compliant</Badge>
            </div>

            <div className="overflow-x-auto border border-ui-border-base rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold text-[11px]">
                    <th className="p-3">HSNCODE</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">UQC</th>
                    <th className="p-3 text-right">Total QTY</th>
                    <th className="p-3 text-right">TOTAL VALUE</th>
                    <th className="p-3 text-right">GST %</th>
                    <th className="p-3 text-right">Taxable Amt</th>
                    <th className="p-3 text-right">IGST</th>
                    <th className="p-3 text-right">CGST</th>
                    <th className="p-3 text-right">SGST</th>
                    <th className="p-3 text-right">CESS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ui-border-base font-mono">
                  {gstSummary.items.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                      <td className="p-3 font-bold text-rose-700">{item.hsnCode}</td>
                      <td className="p-3 font-sans font-medium text-ui-fg-base">{item.description}</td>
                      <td className="p-3 text-ui-fg-muted">{item.uom}</td>
                      <td className="p-3 text-right font-bold">{item.quantity.toFixed(3)}</td>
                      <td className="p-3 text-right font-bold text-ui-fg-base">₹{item.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-bold text-indigo-600">{item.gstRatePct}%</td>
                      <td className="p-3 text-right font-medium">₹{item.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">₹{item.igst.toFixed(2)}</td>
                      <td className="p-3 text-right">₹{item.cgst.toFixed(2)}</td>
                      <td className="p-3 text-right">₹{item.sgst.toFixed(2)}</td>
                      <td className="p-3 text-right">₹{(item.cess || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300">
                    <td className="p-3 text-slate-900 dark:text-white">TOTAL</td>
                    <td className="p-3 font-sans text-slate-600" colSpan={2}>Statutory B2C Summary Total</td>
                    <td className="p-3 text-right">{gstSummary.totals.quantity.toFixed(3)}</td>
                    <td className="p-3 text-right text-emerald-700 font-extrabold">₹{gstSummary.totals.totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">—</td>
                    <td className="p-3 text-right font-bold">₹{gstSummary.totals.taxableValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">₹{gstSummary.totals.igst.toFixed(2)}</td>
                    <td className="p-3 text-right">₹{gstSummary.totals.cgst.toFixed(2)}</td>
                    <td className="p-3 text-right">₹{gstSummary.totals.sgst.toFixed(2)}</td>
                    <td className="p-3 text-right">₹{(gstSummary.totals.cess || 0).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION: 5. CITY & REGIONAL SALES ───────────────────────────── */}
      {activeSection === "city_sales" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                🏙️ City & Regional Sales Distribution
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Multi-city operational breakdown of orders, units, gross revenue, net revenue & AOV.
              </Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => ExcelExportService.exportCityPerformance({ cities: cityPerformance, filters })}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export City Report (XLSX)
            </Button>
          </div>

          <div className="overflow-x-auto border border-ui-border-base rounded-xl bg-ui-bg-base p-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                  <th className="p-3">City</th>
                  <th className="p-3 text-right">Total Orders</th>
                  <th className="p-3 text-right">Units Sold</th>
                  <th className="p-3 text-right">Gross Sales</th>
                  <th className="p-3 text-right">Net Sales</th>
                  <th className="p-3 text-right">AOV</th>
                  <th className="p-3 text-right">Delivered</th>
                  <th className="p-3 text-right">Cancelled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base font-mono">
                {cityPerformance.map((c: any, idx: number) => (
                  <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                    <td className="p-3 font-sans font-bold text-ui-fg-base">{c.city}</td>
                    <td className="p-3 text-right font-medium">{c.orders}</td>
                    <td className="p-3 text-right font-medium">{c.units}</td>
                    <td className="p-3 text-right font-medium">₹{c.grossSales.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{c.netSales.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-medium">₹{c.aov.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right text-emerald-600 font-bold">{c.delivered}</td>
                    <td className="p-3 text-right text-rose-600">{c.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION: 6. AREA & PINCODE SALES ────────────────────────────── */}
      {activeSection === "area_pincode" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                📍 Area & Pincode Sales Density
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Granular delivery locality, postal code revenue density, and kitchen hub attribution.
              </Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => ExcelExportService.exportAreaPincodeSales({ areaPincodes: areaPincodePerformance, filters })}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Area Pincode (XLSX)
            </Button>
          </div>

          <div className="overflow-x-auto border border-ui-border-base rounded-xl bg-ui-bg-base p-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                  <th className="p-3">Pincode</th>
                  <th className="p-3">Area / Locality</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Kitchen Hub</th>
                  <th className="p-3 text-right">Orders</th>
                  <th className="p-3 text-right">Revenue</th>
                  <th className="p-3 text-right">AOV</th>
                  <th className="p-3 text-right">Delivered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base font-mono">
                {areaPincodePerformance.map((a: any, idx: number) => (
                  <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                    <td className="p-3 font-mono font-bold text-slate-800">{a.pincode}</td>
                    <td className="p-3 font-sans font-bold text-rose-700">{a.area}</td>
                    <td className="p-3 font-sans text-ui-fg-subtle">{a.city}</td>
                    <td className="p-3 font-sans text-ui-fg-subtle">{a.branch}</td>
                    <td className="p-3 text-right font-medium">{a.orders}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{a.revenue.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-medium">₹{a.aov.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right text-emerald-600 font-bold">{a.delivered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION: PRODUCTS & PROFITABILITY ────────────────────────────── */}
      {activeSection === "products" && (
        <div className="flex flex-col gap-4 bg-ui-bg-base border border-ui-border-base rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ui-border-base">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                📦 Product Performance & Contribution Profitability Register
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Product-level breakdown of Gross Sales, Discounts, Net Revenue, COGS, Unit Cost & Profit Margin %.
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="small"
                onClick={() => ExcelExportService.exportProductPerformance({ products, filters })}
                className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" /> Export Product Sales (XLSX)
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border border-ui-border-base rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                  <th className="p-3">SKU / Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">HSN Code</th>
                  <th className="p-3 text-right">Qty Sold</th>
                  <th className="p-3 text-right">Gross Sales</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Net Sales</th>
                  <th className="p-3 text-right">Unit COGS</th>
                  <th className="p-3 text-right">Total COGS</th>
                  <th className="p-3 text-right">Gross Profit</th>
                  <th className="p-3 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-ui-bg-subtle/50 font-mono">
                    <td className="p-3 font-sans">
                      <div className="flex flex-col">
                        <span className="font-bold text-ui-fg-base">{p.name}</span>
                        <span className="text-[10px] font-mono text-ui-fg-muted">{p.sku}</span>
                      </div>
                    </td>
                    <td className="p-3 font-sans text-ui-fg-subtle">{p.category}</td>
                    <td className="p-3 font-mono text-ui-fg-muted">{p.hsnCode}</td>
                    <td className="p-3 text-right font-bold text-ui-fg-base">{p.quantitySold.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-medium text-ui-fg-subtle">₹{p.grossSales.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right text-rose-600 font-medium">-₹{p.discounts.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-ui-fg-base">₹{p.netSales.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-mono text-ui-fg-muted">₹{p.unitCost}</td>
                    <td className="p-3 text-right font-medium text-slate-700">₹{p.totalCogs.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{p.grossProfit.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${p.grossMarginPct >= 50 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {p.grossMarginPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION: BRANCH PERFORMANCE ─────────────────────────────────── */}
      {activeSection === "branches" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                🏢 {activeReportDef.title}
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">{activeReportDef.description}</Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => ExcelExportService.exportBranchPerformance({ cities: branchPerformance, filters })}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Branch Performance (XLSX)
            </Button>
          </div>

          <div className="overflow-x-auto border border-ui-border-base rounded-xl bg-ui-bg-base p-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                  <th className="p-3 text-center">Rank</th>
                  <th className="p-3">Branch Name</th>
                  <th className="p-3">Hub Code</th>
                  <th className="p-3 text-right">Total Orders</th>
                  <th className="p-3 text-right">Delivered</th>
                  <th className="p-3 text-right">Cancelled</th>
                  <th className="p-3 text-right">Gross Sales</th>
                  <th className="p-3 text-right">Net Sales</th>
                  <th className="p-3 text-right">COGS</th>
                  <th className="p-3 text-right">Gross Profit</th>
                  <th className="p-3 text-right">Margin %</th>
                  <th className="p-3 text-right">AOV</th>
                  <th className="p-3 text-right">On-Time %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base font-mono">
                {branchPerformance.map((b, idx) => (
                  <tr key={b.id} className="hover:bg-ui-bg-subtle/50">
                    <td className="p-3 text-center font-sans font-bold text-ui-fg-muted">#{idx + 1}</td>
                    <td className="p-3 font-sans font-bold text-ui-fg-base">{b.branchName}</td>
                    <td className="p-3 font-mono font-bold text-indigo-700">{b.branchCode}</td>
                    <td className="p-3 text-right font-medium">{b.ordersCount}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{b.deliveredCount}</td>
                    <td className="p-3 text-right text-rose-600">{b.cancelledCount}</td>
                    <td className="p-3 text-right font-medium">₹{b.grossSales.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-ui-fg-base">₹{b.netSales.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-medium text-slate-600">₹{b.cogs.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{b.grossProfit.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-purple-700">{b.marginPct}%</td>
                    <td className="p-3 text-right font-medium">₹{b.aov.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-sky-700">{b.onTimeDeliveryPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION: ORDERS & LIFECYCLE AUDIT ────────────────────────────── */}
      {activeSection === "orders" && (
        <div className="flex flex-col gap-4 bg-ui-bg-base border border-ui-border-base rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-ui-border-base">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base">
                🛍️ Order Reconciliation & Operational Lifecycle Audit
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Real order line items, invoice numbers, delivery cycle timestamps, payment methods & margins.
              </Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => ExcelExportService.exportOrderRegister({ orders, filters })}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Order Register (XLSX)
            </Button>
          </div>

          <div className="overflow-x-auto border border-ui-border-base rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                  <th className="p-3">Order ID / Invoice</th>
                  <th className="p-3">Customer & Phone</th>
                  <th className="p-3">Branch Hub</th>
                  <th className="p-3">Items Purchased</th>
                  <th className="p-3 text-right">Net Amount</th>
                  <th className="p-3 text-right">Profit</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3">Cycle Time</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-ui-bg-subtle/50">
                    <td className="p-3">
                      <div className="flex flex-col font-mono">
                        <span className="font-bold text-ui-fg-base">{o.id}</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">{o.invoiceNumber}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-ui-fg-base">{o.customerName}</span>
                        <span className="text-[10px] text-ui-fg-muted">{o.customerPhone}</span>
                      </div>
                    </td>
                    <td className="p-3 font-medium text-ui-fg-subtle">{o.branchName}</td>
                    <td className="p-3 font-medium text-ui-fg-base truncate max-w-[180px]">{o.productNames}</td>
                    <td className="p-3 text-right font-mono font-bold text-ui-fg-base">₹{o.netAmount.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">₹{o.profit.toLocaleString("en-IN")}</td>
                    <td className="p-3">
                      <Badge color="blue" className="text-[10px]">{o.paymentMethod}</Badge>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-ui-fg-subtle">
                      ⏱️ {o.totalCycleTimeMins} mins
                    </td>
                    <td className="p-3 text-center">
                      <Button variant="secondary" size="small" onClick={() => setSelectedOrder(o)} className="text-[10px] py-1 px-2">
                        View Audit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION: PAYMENTS & REFUNDS ──────────────────────────────────── */}
      {activeSection === "payments" && (
        <div className="flex flex-col gap-5 bg-ui-bg-base border border-ui-border-base rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ui-border-base">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                💵 Payments & Refund Reconciliation
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">Payment gateway settlements, refund logs, and success rates.</Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={handleExportActiveReport}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Payment Report (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-500/10 rounded-xl"><Text className="text-[11px] font-bold text-emerald-800 uppercase">Gross Payment Collected</Text><Heading level="h3" className="text-lg font-bold text-emerald-700">₹{paymentData.totalCollected.toLocaleString("en-IN")}</Heading></div>
            <div className="p-4 bg-rose-500/10 rounded-xl"><Text className="text-[11px] font-bold text-rose-800 uppercase">Total Refunded</Text><Heading level="h3" className="text-lg font-bold text-rose-700">₹{paymentData.totalRefunds.toLocaleString("en-IN")}</Heading></div>
            <div className="p-4 bg-indigo-500/10 rounded-xl"><Text className="text-[11px] font-bold text-indigo-800 uppercase">Net Settlement</Text><Heading level="h3" className="text-lg font-bold text-indigo-700">₹{paymentData.netCollected.toLocaleString("en-IN")}</Heading></div>
          </div>

          <div className="overflow-x-auto border border-ui-border-base rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                  <th className="p-3">Payment Method</th>
                  <th className="p-3 text-right">Transactions</th>
                  <th className="p-3 text-right">Gross Collections</th>
                  <th className="p-3 text-right">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base font-mono">
                {paymentData.breakdown.map((p, idx) => (
                  <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                    <td className="p-3 font-sans font-bold text-ui-fg-base">{p.method}</td>
                    <td className="p-3 text-right font-medium">{p.count}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{p.gross.toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-indigo-700">{(p as any).successPct || 100}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION: DELIVERY & FLEET ────────────────────────────────────── */}
      {activeSection === "delivery" && (
        <div className="flex flex-col gap-5 bg-ui-bg-base border border-ui-border-base rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ui-border-base">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                🚚 Delivery Fleet & SLA Performance
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">On-time fulfillment, average dispatch times, and rider metrics.</Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={handleExportActiveReport}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Delivery Fleet (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-ui-bg-subtle rounded-xl"><Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Total Deliveries</Text><Heading level="h3" className="text-lg font-bold">{deliveryData.totalDeliveries}</Heading></div>
            <div className="p-4 bg-emerald-500/10 rounded-xl"><Text className="text-[11px] font-bold text-emerald-800 uppercase">On-Time Deliveries</Text><Heading level="h3" className="text-lg font-bold text-emerald-700">{deliveryData.onTimeDeliveries}</Heading></div>
            <div className="p-4 bg-rose-500/10 rounded-xl"><Text className="text-[11px] font-bold text-rose-800 uppercase">Delayed Deliveries</Text><Heading level="h3" className="text-lg font-bold text-rose-700">{deliveryData.delayedDeliveries}</Heading></div>
            <div className="p-4 bg-sky-500/10 rounded-xl"><Text className="text-[11px] font-bold text-sky-800 uppercase">Avg Fulfillment Time</Text><Heading level="h3" className="text-lg font-bold text-sky-700">{(deliveryData as any).avgFulfillmentMins || deliveryData.avgDeliveryMinutes || 35} mins</Heading></div>
          </div>
        </div>
      )}

      {/* ── SECTION: CUSTOMERS ───────────────────────────────────────────── */}
      {activeSection === "customers" && (
        <div className="flex flex-col gap-5 bg-ui-bg-base border border-ui-border-base rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ui-border-base">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                👥 Customer Retention & Lifetime Value
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">Repeat customer cohorts, lifetime value, and order frequencies.</Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={handleExportActiveReport}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Customer Report (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-ui-bg-subtle rounded-xl"><Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Total Active Buyers</Text><Heading level="h3" className="text-lg font-bold">{customerData.totalCustomers}</Heading></div>
            <div className="p-4 bg-emerald-500/10 rounded-xl"><Text className="text-[11px] font-bold text-emerald-800 uppercase">New Customers</Text><Heading level="h3" className="text-lg font-bold text-emerald-700">{customerData.newCustomers}</Heading></div>
            <div className="p-4 bg-amber-500/10 rounded-xl"><Text className="text-[11px] font-bold text-amber-800 uppercase">Repeat Purchase Rate</Text><Heading level="h3" className="text-lg font-bold text-amber-700">{(customerData as any).repeatRatePct || customerData.repeatPurchaseRate || 0}%</Heading></div>
            <div className="p-4 bg-indigo-500/10 rounded-xl"><Text className="text-[11px] font-bold text-indigo-800 uppercase">Average Customer LTV</Text><Heading level="h3" className="text-lg font-bold text-indigo-700">₹{customerData.ltv.toLocaleString("en-IN")}</Heading></div>
          </div>
        </div>
      )}

      {/* ── SECTION: CROSS-SELL & UPSELL ─────────────────────────────────── */}
      {activeSection === "cross_sell" && (
        <div className="flex flex-col gap-5 bg-ui-bg-base border border-ui-border-base rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ui-border-base">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                ✨ Accessory Cross-Sell & Upsell Attach Rates
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">Cake accessory co-purchases, candles, toppers, and added revenue.</Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={handleExportActiveReport}
              className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" /> Export Cross-Sell (XLSX)
            </Button>
          </div>

          <div className="overflow-x-auto border border-ui-border-base rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                  <th className="p-3">Primary Item</th>
                  <th className="p-3">Co-Purchased Accessory</th>
                  <th className="p-3 text-right">Orders Together</th>
                  <th className="p-3 text-right">Attach Rate %</th>
                  <th className="p-3 text-right">Added Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base font-mono">
                {crossSellData.map((p, idx) => (
                  <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                    <td className="p-3 font-sans font-bold text-ui-fg-base">{p.primaryItem}</td>
                    <td className="p-3 font-sans font-bold text-purple-700">{p.coPurchasedItem}</td>
                    <td className="p-3 text-right font-bold">{p.coPurchaseCount}</td>
                    <td className="p-3 text-right font-bold text-indigo-700">{p.attachRatePct}%</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{p.addedRevenue.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SECTION: EXCEPTION CENTER ───────────────────────────────────── */}
      {activeSection === "exceptions" && (
        <div className="flex flex-col gap-4 bg-ui-bg-base border border-ui-border-base rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ui-border-base">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                ⚠️ ERP Exception Center & Compliance Audit
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Automated detection of un-invoiced orders, missing cost prices, HSN gaps & abnormal margins.
              </Text>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="red">{exceptions.length} Issues Flagged</Badge>
              <Button
                variant="secondary"
                size="small"
                onClick={handleExportActiveReport}
                disabled={isExporting}
                className="flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-50 border border-teal-300 hover:bg-teal-100"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" /> Export Exception Audit (XLSX)
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {exceptions.length === 0 ? (
              <div className="p-8 text-center bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                <span className="font-bold text-sm text-emerald-900">All Clear — No Operational or Financial Exceptions Found</span>
                <span className="text-xs text-emerald-700">All products, tax classifications, cost prices, orders, and invoices pass automated audit validation rules.</span>
              </div>
            ) : (
              exceptions.map((exc) => (
                <div key={exc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-rose-500/5 border border-rose-500/20 rounded-xl gap-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-rose-900">{exc.title}</span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-100 text-rose-800">{exc.severity}</span>
                      </div>
                      <span className="text-xs text-rose-700">{exc.description}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── CLICKED ORDER AUDIT DRAWER MODAL ────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="bg-ui-bg-base w-full max-w-lg h-full shadow-2xl p-6 flex flex-col gap-5 overflow-y-auto border-l">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <Heading level="h2" className="text-base font-bold">{selectedOrder.id}</Heading>
                <Text className="text-xs text-emerald-700 font-mono font-semibold">{selectedOrder.invoiceNumber || "PENDING INVOICE"}</Text>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded-lg hover:bg-ui-bg-subtle">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex justify-between py-1 border-b"><span className="text-ui-fg-subtle">Customer:</span><span className="font-semibold">{selectedOrder.customerName} ({selectedOrder.customerPhone})</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-ui-fg-subtle">Branch Hub:</span><span className="font-semibold">{selectedOrder.branchName}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-ui-fg-subtle">Items:</span><span className="font-semibold">{selectedOrder.productNames}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-ui-fg-subtle">Gross Amount:</span><span className="font-semibold">₹{selectedOrder.grossAmount}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-ui-fg-subtle">Discounts:</span><span className="font-semibold text-rose-600">-₹{selectedOrder.discount}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-ui-fg-subtle">GST (5% / 18%):</span><span className="font-semibold">₹{selectedOrder.taxAmount}</span></div>
              <div className="flex justify-between py-1 border-b"><span className="text-ui-fg-subtle font-bold">Net Customer Payable:</span><span className="font-bold text-ui-fg-base">₹{selectedOrder.netAmount}</span></div>
            </div>

            <div className="flex items-center gap-3 pt-3 mt-auto">
              <Button variant="secondary" onClick={() => setSelectedOrder(null)} className="w-full text-xs font-semibold">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
