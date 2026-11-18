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
import type { ExcelExportService as ExcelExportServiceType } from "@frontend/lib/excel-export-service";

const ExcelExportService: typeof ExcelExportServiceType = new Proxy({} as any, {
  get: (_target, prop: string) => async (...args: any[]) => {
    const mod = await import("@frontend/lib/excel-export-service");
    return (mod.ExcelExportService as any)[prop](...args);
  }
});

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
  { id: "area_pincode", label: "Service Areas", icon: MapPin },
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
  const [sellerGstin, setSellerGstin] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState<number>(0);

  const refreshAllData = useCallback(() => {
    Promise.all([
      listBranches(),
      apiClient.get<any[]>("/admin/delivery/partners").catch(() => []),
      apiClient.get<any[]>("/admin/customers").catch(() => []),
      apiClient.get<any>("/admin/compliance/gst-registrations").catch(() => null),
    ]).then(([branches, partners, customers, gstData]) => {
      const branchList = Array.isArray(branches) ? branches : [];
      setAvailableBranches(branchList);
      setAvailablePartners(Array.isArray(partners) ? partners : []);
      setAvailableCustomers(Array.isArray(customers) ? customers : []);
      const regs = Array.isArray(gstData?.registrations) ? gstData.registrations : [];
      const primaryGst = regs.find((r: any) => r.is_active && r.gstin)?.gstin || null;
      setSellerGstin(primaryGst);
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

  // ── Date Resolution: Convert UI timeRange to ISO start/end dates ──
  const resolvedDates = useMemo(() => {
    const now = new Date();
    // Local calendar day: toISOString() is UTC and shifts IST dates (e.g. 1st of month -> last day of previous month)
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = ymd(now);
    let start = today;
    let end = today;

    switch (timeRange) {
      case "today":
        start = end = today;
        break;
      case "yesterday": {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        start = end = ymd(y);
        break;
      }
      case "last_7_days": {
        const d = new Date(now); d.setDate(d.getDate() - 7);
        start = ymd(d);
        end = today;
        break;
      }
      case "last_30_days": {
        const d = new Date(now); d.setDate(d.getDate() - 30);
        start = ymd(d);
        end = today;
        break;
      }
      case "last_90_days": {
        const d = new Date(now); d.setDate(d.getDate() - 90);
        start = ymd(d);
        end = today;
        break;
      }
      case "this_week": {
        const dow = now.getDay();
        const d = new Date(now); d.setDate(d.getDate() - dow);
        start = ymd(d);
        end = today;
        break;
      }
      case "last_week": {
        const dow = now.getDay();
        const endD = new Date(now); endD.setDate(endD.getDate() - dow - 1);
        const startD = new Date(endD); startD.setDate(startD.getDate() - 6);
        start = ymd(startD);
        end = ymd(endD);
        break;
      }
      case "this_month": {
        start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        end = today;
        break;
      }
      case "last_month": {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lme = new Date(now.getFullYear(), now.getMonth(), 0);
        start = ymd(lm);
        end = ymd(lme);
        break;
      }
      case "this_quarter": {
        const q = Math.floor(now.getMonth() / 3);
        start = `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, "0")}-01`;
        end = today;
        break;
      }
      case "last_quarter": {
        const q = Math.floor(now.getMonth() / 3) - 1;
        const y = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const qn = q < 0 ? 3 : q;
        const qs = new Date(y, qn * 3, 1);
        const qe = new Date(y, qn * 3 + 3, 0);
        start = ymd(qs);
        end = ymd(qe);
        break;
      }
      case "this_year":
        start = `${now.getFullYear()}-01-01`;
        end = today;
        break;
      case "last_year": {
        const ly = now.getFullYear() - 1;
        start = `${ly}-01-01`;
        end = `${ly}-12-31`;
        break;
      }
      case "financial_year": {
        const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        start = `${fy}-04-01`;
        end = `${fy + 1}-03-31`;
        break;
      }
      case "custom":
        start = customStartDate || today;
        end = customEndDate || today;
        break;
    }
    return { startDate: start, endDate: end };
  }, [timeRange, customStartDate, customEndDate]);

  // Build API query params from filters
  const apiQueryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("startDate", resolvedDates.startDate);
    p.set("endDate", resolvedDates.endDate);
    if (branchIds.length > 0) p.set("branchIds", branchIds.join(","));
    if (cityFilter && cityFilter !== "all") p.set("city", cityFilter);
    if (searchQuery) p.set("search", searchQuery);
    return p.toString();
  }, [resolvedDates, branchIds, cityFilter, searchQuery]);

  // ── Server-Side Report Data State ──
  const [kpis, setKpis] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ netRevenue: 0, grossProfit: 0 });
  const [dailyData, setDailyData] = useState<any>({ stats: { totalOrders: 0, deliveredOrders: 0, grossRevenue: 0, netRevenue: 0, totalTax: 0, aov: 0 }, paymentSummary: [], branchSummary: [] });
  const [weeklyData, setWeeklyData] = useState<any>({ top3Cakes: [], leastSellingCakes: [], payments: [] });
  const [monthlyData, setMonthlyData] = useState<any>({ currentMonthSales: 0, prevMonthSales: 0, growthPctDisplay: "0%", deliverySla: { totalDeliveries: 0, slaCompliancePct: 100 }, customerRetention: { repeatPurchaseRate: 0, ltv: 0 } });
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [branchPerformance, setBranchPerformance] = useState<any[]>([]);
  const [cityPerformance, setCityPerformance] = useState<any[]>([]);
  const [serviceAreaPerformance, setServiceAreaPerformance] = useState<any[]>([]);
  const [gstSummary, setGstSummary] = useState<any>({ items: [], totals: { quantity: 0, totalValue: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 } });
  const [gstDetailedRegister, setGstDetailedRegister] = useState<any[]>([]);
  const [gstItems, setGstItems] = useState<any[]>([]);
  const [taxSummary, setTaxSummary] = useState<any>({});
  const [rawExceptions, setRawExceptions] = useState<any[]>([]);
  const [deliveryData, setDeliveryData] = useState<any>({ totalDeliveries: 0, onTimeDeliveries: 0, delayedDeliveries: 0, avgDeliveryMinutes: 0 });
  const [customerData, setCustomerData] = useState<any>({ totalCustomers: 0, newCustomers: 0, ltv: 0, repeatPurchaseRate: 0 });
  const [paymentData, setPaymentData] = useState<any>({ breakdown: [], totalCollected: 0, totalRefunds: 0, netCollected: 0 });
  const [geoData, setGeoData] = useState<any>({});
  const [crossSellData, setCrossSellData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState<boolean>(false);

  // ── Fetch Reports from Server-Side API ──
  useEffect(() => {
    let cancelled = false;
    setReportLoading(true);

    const fetchReports = async () => {
      try {
        // Fetch reports based on active section (load only what's needed)
        const baseUrl = `/admin/reports`;
        const q = apiQueryParams;

        // Always fetch KPIs and stats for executive summary
        const [kpiRes, statsRes] = await Promise.all([
          apiClient.get<any>(`${baseUrl}/kpis?${q}`).catch(() => ({ kpis: [] })),
          apiClient.get<any>(`${baseUrl}/transactional?${q}`).catch(() => ({ data: {} })),
        ]);

        if (cancelled) return;
        setKpis(kpiRes?.kpis || []);
        setStats({ netRevenue: 0, grossProfit: 0, ...(statsRes?.data || statsRes || {}) });

        // Fetch section-specific data
        const sectionFetches: Promise<void>[] = [];

        if (["executive_summary", "products", "profitability"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/products?${q}`).then((r) => { if (!cancelled) setProducts(r?.data || []); }).catch(() => {})
          );
        }
        if (["executive_summary", "orders"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/orders?${q}`).then((r) => { if (!cancelled) setOrders(r?.data || []); }).catch(() => {})
          );
        }
        if (["executive_summary", "branches"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/branches?${q}`).then((r) => { if (!cancelled) setBranchPerformance(r?.data || []); }).catch(() => {})
          );
        }
        if (["executive_summary", "city_sales"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/cities?${q}`).then((r) => { if (!cancelled) setCityPerformance(r?.data || []); }).catch(() => {})
          );
        }
        if (["area_pincode"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/service-areas?${q}`).then((r) => { if (!cancelled) setServiceAreaPerformance(r?.data || []); }).catch(() => {})
          );
        }
        if (["executive_summary", "payments", "refunds"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/payments?${q}`).then((r) => { if (!cancelled) setPaymentData(r?.data || { breakdown: [] }); }).catch(() => {})
          );
        }
        if (["tax_gst", "invoices"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/gst?${q}`).then((r) => {
              if (!cancelled) {
                setGstSummary(r?.data || { items: [], totals: {} });
                setGstItems(r?.data?.items || []);
                setTaxSummary(r?.data?.totals || {});
                setGstDetailedRegister(r?.data?.items || []);
              }
            }).catch(() => {})
          );
        }
        if (["delivery"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/delivery?${q}`).then((r) => { if (!cancelled) setDeliveryData(r?.data || {}); }).catch(() => {})
          );
        }
        if (["customers"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/customers?${q}`).then((r) => { if (!cancelled) setCustomerData(r?.data || {}); }).catch(() => {})
          );
        }
        if (["cross_sell"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/cross-sell?${q}`).then((r) => { if (!cancelled) setCrossSellData(r?.data || []); }).catch(() => {})
          );
        }
        if (["exceptions"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/exceptions?${q}`).then((r) => { if (!cancelled) setRawExceptions(r?.data || []); }).catch(() => {})
          );
        }
        if (["daily_sales", "sales"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/daily?${q}`).then((r) => { if (!cancelled) setDailyData(r?.data || {}); }).catch(() => {})
          );
        }
        if (["weekly_sales"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/weekly?${q}`).then((r) => { if (!cancelled) setWeeklyData(r?.data || {}); }).catch(() => {})
          );
        }
        if (["monthly_sales"].includes(activeSection)) {
          sectionFetches.push(
            apiClient.get<any>(`${baseUrl}/monthly?${q}`).then((r) => { if (!cancelled) setMonthlyData(r?.data || {}); }).catch(() => {})
          );
        }

        await Promise.all(sectionFetches);
      } catch (err) {
        console.error("[Enterprise Reports] Failed to fetch report data:", err);
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };

    fetchReports();
    return () => { cancelled = true; };
  }, [apiQueryParams, activeSection, dataVersion]);

  const exceptions = useMemo(() => rawExceptions.filter((e: any) => !resolvedExceptionIds.includes(e.id)), [rawExceptions, resolvedExceptionIds]);

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
  // Statutory GST files come from the GST reporting service (invoice-based, excludes partner sales) — same
  // numbers as the GST returns, unlike the analytics HSN view above which is computed from order lines.
  const [statutoryType, setStatutoryType] = useState<string>("GSTR1");
  const statutoryUrl = (fmt: "xlsx" | "csv") => {
    const p = new URLSearchParams({ startDate: resolvedDates.startDate, endDate: resolvedDates.endDate, type: statutoryType });
    if (branchIds.length > 0) p.set("branchIds", branchIds.join(","));
    return `/api/v1/admin/reports/gst/export/${fmt}?${p.toString()}`;
  };
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
          await ExcelExportService.exportAreaPincodeSales({ areaPincodes: serviceAreaPerformance, filters });
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
      // Screen state only holds the open section's data; fetch every section for the same filters.
      const q = apiQueryParams;
      const get = (p: string, fallback: any) => apiClient.get<any>(`/admin/reports/${p}?${q}`).then((r) => r?.data ?? fallback).catch(() => fallback);
      const [kpiRes, daily, weekly, monthly, prods, branches, cities, areas, payments, delivery, customers, gst, orderReg, crossSell, exc] = await Promise.all([
        apiClient.get<any>(`/admin/reports/kpis?${q}`).catch(() => ({ kpis: [] })),
        get("daily", dailyData), get("weekly", weeklyData), get("monthly", monthlyData),
        get("products", []), get("branches", []), get("cities", []), get("service-areas", []),
        get("payments", { breakdown: [] }), get("delivery", {}), get("customers", {}),
        get("gst", { items: [], totals: {} }), get("orders", []), get("cross-sell", []), get("exceptions", []),
      ]);
      await ExcelExportService.exportCompleteWorkbook({
        kpis: kpiRes?.kpis || [],
        daily,
        weekly,
        monthly,
        products: prods,
        branches,
        cities,
        areaPincodes: areas,
        payments,
        delivery,
        customers,
        gstSummary: gst,
        gstDetailedRegister: gst?.items || [],
        orderRegister: orderReg,
        crossSell,
        exceptions: (exc || []).filter((e: any) => !resolvedExceptionIds.includes(e.id)),
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
            {sellerGstin ? (
              <Badge color="purple" className="text-xs font-semibold px-2.5 py-1">
                GSTIN: {sellerGstin}
              </Badge>
            ) : null}
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
                <SlidersHorizontal className="w-3 h-3 text-brand-primary" /> Compare With
              </label>
              <select
                value={compareMode}
                onChange={(e) => setCompareMode(e.target.value as ComparisonMode)}
                className="h-9 px-3 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-lg font-medium text-ui-fg-base focus:outline-none focus:ring-2 focus:ring-brand-primary"
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
                    className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
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
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 px-1">
                  <button
                    type="button"
                    onClick={handleSelectAllBranches}
                    className="flex-1 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-md border border-emerald-200 dark:border-emerald-800 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllBranches}
                    className="flex-1 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
                  >
                    Clear All
                  </button>
                </div>

                <div className="flex flex-col gap-1 overflow-y-auto max-h-[220px] pr-1">
                  {availableBranches
                    .filter((b) => !branchSearch || b.name.toLowerCase().includes(branchSearch.toLowerCase()))
                    .map((b) => {
                      const isChecked = branchIds.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs font-medium text-slate-800 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBranchSelection(b.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                          />
                          <span className="truncate flex-1 text-slate-800 dark:text-slate-200">{b.name}</span>
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
              <Search className="w-3 h-3 text-brand-gold" /> Search Filter
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Executive Summary (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.id} className="flex flex-col justify-between p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm hover:shadow-md transition-all">
                <div className="flex flex-col gap-1">
                  <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase tracking-wider line-clamp-1">
                    {kpi.label}
                  </Text>
                  <Heading level="h2" className={`text-lg sm:text-xl font-bold ${kpi.currentValue == null ? "text-ui-fg-muted italic text-sm" : "text-ui-fg-base"}`}>
                    {kpi.currentValue != null ? (
                      kpi.unit === "currency" ? `₹${kpi.currentValue.toLocaleString("en-IN")}` : kpi.unit === "percentage" ? `${kpi.currentValue}%` : kpi.currentValue.toLocaleString("en-IN")
                    ) : (
                      "Unavailable"
                    )}
                  </Heading>
                </div>

                {compareMode !== "none" && (
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-ui-border-base/60 text-xs">
                    <span className={`flex items-center font-bold text-[11px] ${kpi.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                      {kpi.isPositive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                      {Math.abs(kpi.growthPct)}%
                    </span>
                    <span className="text-[10px] text-ui-fg-muted">
                      vs {kpi.previousValue != null ? (kpi.unit === "currency" ? `₹${kpi.previousValue.toLocaleString("en-IN")}` : kpi.previousValue) : "N/A"}
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
                  <span className="w-3 h-3 rounded-full bg-emerald-500" /> Net Sales ({stats?.netRevenue != null ? `₹${stats.netRevenue.toLocaleString("en-IN")}` : "Unavailable"})
                </span>
                <span className="flex items-center gap-1.5 text-rose-700">
                  <span className="w-3 h-3 rounded-full bg-rose-500" /> Contribution Profit ({stats?.grossProfit != null ? `₹${stats.grossProfit.toLocaleString("en-IN")}` : "Unavailable (No Cost Data)"})
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
                      <span className="font-bold text-emerald-700">{p.netSales != null ? `₹${p.netSales.toLocaleString("en-IN")}` : "Unavailable"}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 p-3 bg-rose-500/5 rounded-xl border border-rose-500/20">
                  <Text className="text-[11px] font-bold uppercase text-rose-800">⚠️ Bottom 3 Performers</Text>
                  {bottom3Products.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-rose-500/10 last:border-0">
                      <span className="font-semibold text-ui-fg-base truncate max-w-[130px]">{i + 1}. {p.name}</span>
                      <span className="font-bold text-rose-700">{p.netSales != null ? `₹${p.netSales.toLocaleString("en-IN")}` : "Unavailable"}</span>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Daily Sales (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Daily Orders</Text>
              <Heading level="h3" className="text-lg font-bold mt-1">{dailyData?.stats?.totalOrders ?? 0}</Heading>
              <Text className="text-[10px] text-emerald-600 font-semibold mt-1">{dailyData?.stats?.deliveredOrders ?? 0} Delivered</Text>
            </div>
            <div className="p-4 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Gross Sales</Text>
              <Heading level="h3" className="text-lg font-bold mt-1">₹{(dailyData?.stats?.grossRevenue ?? 0).toLocaleString("en-IN")}</Heading>
              <Text className="text-[10px] text-ui-fg-muted mt-1">Tax Inclusive</Text>
            </div>
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-emerald-800 uppercase">Net Sales (Excl. Tax)</Text>
              <Heading level="h3" className="text-lg font-bold text-emerald-700 mt-1">₹{(dailyData?.stats?.netRevenue ?? 0).toLocaleString("en-IN")}</Heading>
              <Text className="text-[10px] text-emerald-600 mt-1">₹{(dailyData?.stats?.totalTax ?? 0).toLocaleString("en-IN")} GST Collected</Text>
            </div>
            <div className="p-4 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Average Order Value</Text>
              <Heading level="h3" className="text-lg font-bold mt-1">₹{(dailyData?.stats?.aov ?? 0).toLocaleString("en-IN")}</Heading>
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
                  {(dailyData?.paymentSummary || []).map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                      <td className="p-3 font-sans font-bold text-ui-fg-base">{p.method}</td>
                      <td className="p-3 text-right font-medium">{p.count}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">₹{(p.gross ?? 0).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right text-rose-600">₹{(p.refundAmount || 0).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-bold text-brand-navy">₹{(p.netAmount || p.gross || 0).toLocaleString("en-IN")}</td>
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
                  {(dailyData?.branchSummary || []).map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                      <td className="p-3 font-sans font-bold text-ui-fg-base">{b.branchName}</td>
                      <td className="p-3 font-mono font-bold text-brand-navy">{b.branchCode}</td>
                      <td className="p-3 font-sans text-ui-fg-subtle">{b.city || "—"}</td>
                      <td className="p-3 text-right font-medium">{b.ordersCount ?? 0}</td>
                      <td className="p-3 text-right font-medium">₹{(b.grossSales ?? 0).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">₹{(b.netSales ?? 0).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-medium">₹{(b.aov ?? 0).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-bold text-brand-navy">{b.deliveredCount ?? 0}</td>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Weekly Report (XLSX)
            </Button>
          </div>

          {/* Top 3 & Least Selling Cake Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top 3 Best Sellers */}
            <div className="flex flex-col gap-3 p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Heading level="h3" className="text-sm font-bold text-emerald-800 pb-2 border-b">🏆 Top 3 Best Selling Cakes</Heading>
              <div className="flex flex-col gap-3">
                {(weeklyData?.top3Cakes || []).map((c: any) => (
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
                      <span className="font-bold text-xs text-emerald-700">₹{(c.netSales ?? 0).toLocaleString("en-IN")}</span>
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
                {(weeklyData?.leastSellingCakes || []).slice(0, 3).map((c: any) => (
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
                      <span className="font-bold text-xs text-rose-700">₹{(c.netSales ?? 0).toLocaleString("en-IN")}</span>
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
                  {(weeklyData?.payments || []).map((p: any, idx: number) => (
                    <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                      <td className="p-3 font-sans font-bold text-ui-fg-base">{p.method}</td>
                      <td className="p-3 text-right font-medium">{p.count}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">₹{(p.gross ?? 0).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right text-rose-600">₹{(p.refundAmount || 0).toLocaleString("en-IN")}</td>
                      <td className="p-3 text-right font-bold text-brand-navy">{p.percentage}%</td>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Monthly Report (XLSX)
            </Button>
          </div>

          {/* Month-over-Month Growth Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Current Month Net Sales</Text>
              <Heading level="h3" className="text-xl font-bold mt-1 text-emerald-700">₹{(monthlyData?.currentMonthSales ?? 0).toLocaleString("en-IN")}</Heading>
              <Text className="text-[10px] text-ui-fg-muted mt-1">Excl. Tax & Discounts</Text>
            </div>
            <div className="p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Previous Month Net Sales</Text>
              <Heading level="h3" className="text-xl font-bold mt-1 text-slate-700">₹{(monthlyData?.prevMonthSales ?? 0).toLocaleString("en-IN")}</Heading>
              <Text className="text-[10px] text-ui-fg-muted mt-1">Audited Baseline</Text>
            </div>
            <div className="p-5 bg-brand-primary/10 border border-brand-primary/20 rounded-2xl shadow-sm">
              <Text className="text-[11px] font-bold text-brand-navy uppercase">Sales Growth %</Text>
              <Heading level="h3" className="text-xl font-bold mt-1 text-brand-navy">{monthlyData?.growthPctDisplay || "0%"}</Heading>
              <Text className="text-[10px] text-brand-primary mt-1">MoM Revenue Velocity</Text>
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
                  <Heading level="h3" className="text-base font-bold mt-1">{monthlyData?.deliverySla?.totalDeliveries ?? 0}</Heading>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <Text className="text-[10px] font-bold text-emerald-800 uppercase">SLA Compliance</Text>
                  <Heading level="h3" className={`text-base font-bold mt-1 ${monthlyData?.deliverySla?.slaCompliancePct != null ? "text-emerald-700" : "text-ui-fg-muted italic text-xs"}`}>
                    {monthlyData?.deliverySla?.slaCompliancePct != null ? `${monthlyData.deliverySla.slaCompliancePct}%` : "Unavailable (No Timing Data)"}
                  </Heading>
                </div>
              </div>
            </div>

            {/* Customer Retention */}
            <div className="flex flex-col gap-3 p-5 bg-ui-bg-base border rounded-2xl shadow-sm">
              <Heading level="h3" className="text-sm font-bold pb-2 border-b">👥 Monthly Customer Retention</Heading>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-brand-gold-light rounded-xl border border-brand-gold/40">
                  <Text className="text-[10px] font-bold text-brand-gold-dark uppercase">Repeat Purchase Rate</Text>
                  <Heading level="h3" className={`text-base font-bold mt-1 ${monthlyData?.customerRetention?.repeatPurchaseRate != null ? "text-brand-gold-dark" : "text-ui-fg-muted italic text-xs"}`}>
                    {monthlyData?.customerRetention?.repeatPurchaseRate != null ? `${monthlyData.customerRetention.repeatPurchaseRate}%` : "Unavailable"}
                  </Heading>
                </div>
                <div className="p-3 bg-brand-light rounded-xl border border-brand-primary/30">
                  <Text className="text-[10px] font-bold text-brand-navy uppercase">Estimated CLTV</Text>
                  <Heading level="h3" className={`text-base font-bold mt-1 ${monthlyData?.customerRetention?.ltv != null ? "text-brand-navy" : "text-ui-fg-muted italic text-xs"}`}>
                    {monthlyData?.customerRetention?.ltv != null ? `₹${monthlyData.customerRetention.ltv.toLocaleString("en-IN")}` : "Unavailable"}
                  </Heading>
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
              <select
                value={statutoryType}
                onChange={(e) => setStatutoryType(e.target.value)}
                className="p-1.5 border rounded-lg text-xs font-semibold bg-white dark:bg-slate-800"
                aria-label="Statutory GST report"
              >
                <option value="GSTR1">GSTR-1</option>
                <option value="GSTR3B">GSTR-3B</option>
                <option value="B2B">B2B invoices</option>
                <option value="B2C">B2C sales</option>
                <option value="HSN_SUMMARY">HSN summary</option>
                <option value="INVOICE_REGISTER">Invoice register</option>
                <option value="SALES_REGISTER">Sales register</option>
                <option value="CREDIT_NOTES">Credit notes</option>
                <option value="VALIDATION">Validation audit</option>
                <option value="COMPLETE_WORKBOOK">All GST sheets</option>
              </select>
              <a href={statutoryUrl("xlsx")} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Statutory XLSX
              </a>
              <a href={statutoryUrl("csv")} className="px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5">
                CSV
              </a>
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
                  {(gstSummary?.items || []).map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                      <td className="p-3 font-bold text-rose-700">{item.hsnCode}</td>
                      <td className="p-3 font-sans font-medium text-ui-fg-base">{item.description}</td>
                      <td className="p-3 text-ui-fg-muted">{item.uom}</td>
                      <td className="p-3 text-right font-bold">{(item.quantity ?? 0).toFixed(3)}</td>
                      <td className="p-3 text-right font-bold text-ui-fg-base">₹{(item.totalValue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right font-bold text-brand-primary">{item.gstRatePct}%</td>
                      <td className="p-3 text-right font-medium">₹{(item.taxableValue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="p-3 text-right">₹{(item.igst ?? 0).toFixed(2)}</td>
                      <td className="p-3 text-right">₹{(item.cgst ?? 0).toFixed(2)}</td>
                      <td className="p-3 text-right">₹{(item.sgst ?? 0).toFixed(2)}</td>
                      <td className="p-3 text-right">₹{(item.cess || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300">
                    <td className="p-3 text-slate-900 dark:text-white">TOTAL</td>
                    <td className="p-3 font-sans text-slate-600" colSpan={2}>Statutory B2C Summary Total</td>
                    <td className="p-3 text-right">{(gstSummary?.totals?.quantity ?? 0).toFixed(3)}</td>
                    <td className="p-3 text-right text-emerald-700 font-extrabold">₹{(gstSummary?.totals?.totalValue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">—</td>
                    <td className="p-3 text-right font-bold">₹{(gstSummary?.totals?.taxableValue ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 text-right">₹{(gstSummary?.totals?.igst ?? 0).toFixed(2)}</td>
                    <td className="p-3 text-right">₹{(gstSummary?.totals?.cgst ?? 0).toFixed(2)}</td>
                    <td className="p-3 text-right">₹{(gstSummary?.totals?.sgst ?? 0).toFixed(2)}</td>
                    <td className="p-3 text-right">₹{(gstSummary?.totals?.cess || 0).toFixed(2)}</td>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export City Report (XLSX)
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
                    <td className="p-3 text-right font-medium">₹{(c.grossSales || 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{(c.netSales || 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-medium">{c.aov != null ? `₹${c.aov.toLocaleString("en-IN")}` : '—'}</td>
                    <td className="p-3 text-right text-emerald-600 font-bold">{c.delivered}</td>
                    <td className="p-3 text-right text-rose-600">{c.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* -- SECTION: 6. SERVICE AREA / MAP FENCE PERFORMANCE -- */}
      {activeSection === "area_pincode" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-sm">
            <div>
              <Heading level="h2" className="text-base font-bold text-ui-fg-base flex items-center gap-2">
                📍 Service Area Performance
              </Heading>
              <Text className="text-xs text-ui-fg-subtle">
                Orders and revenue by delivery zone / service area. Grouped by map fence, not pincode.
              </Text>
            </div>
            <Button
              variant="secondary"
              size="small"
              onClick={() => ExcelExportService.exportAreaPincodeSales({ areaPincodes: serviceAreaPerformance, filters })}
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Service Areas (XLSX)
            </Button>
          </div>

          <div className="overflow-x-auto border border-ui-border-base rounded-xl bg-ui-bg-base p-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-ui-bg-subtle border-b text-[11px] uppercase font-bold text-ui-fg-subtle">
                  <th className="p-3">Service Area / Zone</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3">City</th>
                  <th className="p-3">Fence Type</th>
                  <th className="p-3 text-right">Orders</th>
                  <th className="p-3 text-right">Revenue</th>
                  <th className="p-3 text-right">AOV</th>
                  <th className="p-3 text-right">Delivered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ui-border-base font-mono">
                {serviceAreaPerformance.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-ui-fg-subtle text-xs">
                    No service area data. Zones need human-readable names configured in admin.
                  </td></tr>
                )}
                {serviceAreaPerformance.map((a: any, idx: number) => (
                  <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                    <td className="p-3 font-sans font-bold text-rose-700">{a.zoneName || a.zoneId}</td>
                    <td className="p-3 font-sans text-ui-fg-subtle">{a.branchName}</td>
                    <td className="p-3 font-sans text-ui-fg-subtle">{a.city}</td>
                    <td className="p-3 font-sans text-xs">{a.hasPolygon ? '🔷 Polygon' : a.radiusKm ? `⭕ ${a.radiusKm}km radius` : '—'}</td>
                    <td className="p-3 text-right font-medium">{a.orders}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{(a.revenue || 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-medium">{a.aov != null ? `₹${a.aov.toLocaleString("en-IN")}` : '—'}</td>
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
                className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
              >
                <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Product Sales (XLSX)
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
                    <td className="p-3 text-right font-bold text-ui-fg-base">{(p.quantitySold ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-medium text-ui-fg-subtle">₹{(p.grossSales ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right text-rose-600 font-medium">-₹{(p.discounts ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-ui-fg-base">₹{(p.netSales ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-mono text-ui-fg-muted">₹{p.unitCost ?? 0}</td>
                    <td className="p-3 text-right font-medium text-slate-700">₹{(p.totalCogs ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{(p.grossProfit ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold font-sans">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${p.grossMarginPct >= 50 ? "bg-emerald-100 text-emerald-800" : "bg-brand-gold-light text-brand-gold-dark"}`}>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Branch Performance (XLSX)
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
                    <td className="p-3 font-mono font-bold text-brand-navy">{b.branchCode}</td>
                    <td className="p-3 text-right font-medium">{b.ordersCount ?? 0}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{b.deliveredCount ?? 0}</td>
                    <td className="p-3 text-right text-rose-600">{b.cancelledCount ?? 0}</td>
                    <td className="p-3 text-right font-medium">₹{(b.grossSales ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-ui-fg-base">₹{(b.netSales ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-medium text-slate-600">₹{(b.cogs ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{(b.grossProfit ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-brand-navy">{b.marginPct ?? 0}%</td>
                    <td className="p-3 text-right font-medium">₹{(b.aov ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-brand-navy">{b.onTimeDeliveryPct ?? 100}%</td>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Order Register (XLSX)
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
                    <td className="p-3 text-right font-mono font-bold text-ui-fg-base">₹{(o.netAmount ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">₹{(o.profit ?? 0).toLocaleString("en-IN")}</td>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Payment Report (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-500/10 rounded-xl"><Text className="text-[11px] font-bold text-emerald-800 uppercase">Gross Payment Collected</Text><Heading level="h3" className="text-lg font-bold text-emerald-700">₹{(paymentData?.totalCollected ?? 0).toLocaleString("en-IN")}</Heading></div>
            <div className="p-4 bg-rose-500/10 rounded-xl"><Text className="text-[11px] font-bold text-rose-800 uppercase">Total Refunded</Text><Heading level="h3" className="text-lg font-bold text-rose-700">₹{(paymentData?.totalRefunds ?? 0).toLocaleString("en-IN")}</Heading></div>
            <div className="p-4 bg-brand-primary/10 rounded-xl"><Text className="text-[11px] font-bold text-brand-navy uppercase">Net Settlement</Text><Heading level="h3" className="text-lg font-bold text-brand-navy">₹{(paymentData?.netCollected ?? 0).toLocaleString("en-IN")}</Heading></div>
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
                {(paymentData?.breakdown || []).map((p: any, idx: number) => (
                  <tr key={idx} className="hover:bg-ui-bg-subtle/50">
                    <td className="p-3 font-sans font-bold text-ui-fg-base">{p.method}</td>
                    <td className="p-3 text-right font-medium">{p.count}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{(p.gross ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-3 text-right font-bold text-brand-navy">{(p as any).successPct || 100}%</td>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Delivery Fleet (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-ui-bg-subtle rounded-xl"><Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Total Deliveries</Text><Heading level="h3" className="text-lg font-bold">{deliveryData.totalDeliveries}</Heading></div>
            <div className="p-4 bg-emerald-500/10 rounded-xl"><Text className="text-[11px] font-bold text-emerald-800 uppercase">On-Time Deliveries</Text><Heading level="h3" className="text-lg font-bold text-emerald-700">{deliveryData.onTimeDeliveries}</Heading></div>
            <div className="p-4 bg-rose-500/10 rounded-xl"><Text className="text-[11px] font-bold text-rose-800 uppercase">Delayed Deliveries</Text><Heading level="h3" className="text-lg font-bold text-rose-700">{deliveryData.delayedDeliveries}</Heading></div>
            <div className="p-4 bg-brand-primary/10 rounded-xl"><Text className="text-[11px] font-bold text-brand-navy uppercase">Avg Fulfillment Time</Text><Heading level="h3" className="text-lg font-bold text-brand-navy">{(deliveryData as any).avgFulfillmentMins || deliveryData.avgDeliveryMinutes || 35} mins</Heading></div>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Customer Report (XLSX)
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-ui-bg-subtle rounded-xl"><Text className="text-[11px] font-bold text-ui-fg-subtle uppercase">Total Active Buyers</Text><Heading level="h3" className="text-lg font-bold">{customerData?.totalCustomers != null ? customerData.totalCustomers : "Unavailable"}</Heading></div>
            <div className="p-4 bg-emerald-500/10 rounded-xl"><Text className="text-[11px] font-bold text-emerald-800 uppercase">New Customers</Text><Heading level="h3" className="text-lg font-bold text-emerald-700">{customerData?.newCustomers != null ? customerData.newCustomers : "Unavailable"}</Heading></div>
            <div className="p-4 bg-brand-gold/10 rounded-xl"><Text className="text-[11px] font-bold text-brand-gold-dark uppercase">Repeat Purchase Rate</Text><Heading level="h3" className={`text-lg font-bold ${customerData?.repeatPurchaseRate != null ? "text-brand-gold-dark" : "text-ui-fg-muted italic text-xs"}`}>{customerData?.repeatPurchaseRate != null ? `${customerData.repeatPurchaseRate}%` : "Unavailable"}</Heading></div>
            <div className="p-4 bg-brand-primary/10 rounded-xl"><Text className="text-[11px] font-bold text-brand-navy uppercase">Average Customer LTV</Text><Heading level="h3" className={`text-lg font-bold ${customerData?.ltv != null ? "text-brand-navy" : "text-ui-fg-muted italic text-xs"}`}>{customerData?.ltv != null ? `₹${customerData.ltv.toLocaleString("en-IN")}` : "Unavailable"}</Heading></div>
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
              className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
            >
              <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Cross-Sell (XLSX)
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
                    <td className="p-3 font-sans font-bold text-brand-navy">{p.coPurchasedItem}</td>
                    <td className="p-3 text-right font-bold">{p.coPurchaseCount}</td>
                    <td className="p-3 text-right font-bold text-brand-navy">{p.attachRatePct}%</td>
                    <td className="p-3 text-right font-bold text-emerald-700">₹{(p.addedRevenue ?? 0).toLocaleString("en-IN")}</td>
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
                className="flex items-center gap-1.5 text-xs font-extrabold text-brand-navy bg-brand-light border border-brand-primary/30 hover:bg-brand-light"
              >
                <Download className="w-3.5 h-3.5 text-brand-primary" /> Export Exception Audit (XLSX)
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
