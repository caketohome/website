/**
 * CakeToHome Report Service
 * Business/reporting semantics layer that sits between the repository and API.
 *
 * RESPONSIBILITIES:
 * - Resolves GSTIN from the Admin Panel GST registration source
 * - Applies test/prototype filtering policy
 * - Computes period-over-period comparisons
 * - Composes high-level report DTOs (Daily, Weekly, Monthly)
 * - Ensures UI and Excel receive identical DTOs
 *
 * NEVER fabricates data. Returns null/unavailable for missing information.
 */

import { ReportRepository } from "../repositories/report.repository";
import type {
  ReportFilters,
  TransactionalMetrics,
  ProductPerformanceRow,
  BranchPerformanceRow,
  CityPerformanceRow,
  ServiceAreaRow,
  PaymentSummary,
  GstHsnSummary,
  OrderRegisterRow,
  CustomerAnalyticsSummary,
  CrossSellRow,
  ExceptionRow,
  DeliveryPerformanceSummary,
  ReportKpi,
  DailySalesReport,
  WeeklySalesReport,
  MonthlySalesReport,
  DailyTrendPoint,
  ReportResponse,
} from "../types/report.types";

// ─── GST Resolution ──────────────────────────────────────────────────────────

/**
 * Resolve the seller GSTIN from PostgreSQL (public.gst_registration / public.company).
 * This is the single canonical source — no hardcoded fallback.
 */
async function resolveSellerGstInfo(): Promise<{ gstin: string | null; legalName: string | null; tradeName: string | null }> {
  try {
    const info = await ReportRepository.getSellerGstInfo();
    if (info && info.gstin && info.gstin !== "29AAAAA0000A1Z5" && info.gstin !== "00AAAAA0000A0Z0") {
      return info;
    }
  } catch {
    // Database query failed — graceful degradation to null
  }
  return { gstin: null, legalName: null, tradeName: null };
}

// ─── Report Response Builder ─────────────────────────────────────────────────

async function wrapResponse<T>(data: T, filters: ReportFilters): Promise<ReportResponse<T>> {
  const gstInfo = await resolveSellerGstInfo();
  const totalOrders = await ReportRepository.getTotalOrderCount();

  return {
    success: true,
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      dataSource: "postgresql",
      filters,
      sellerGstin: gstInfo.gstin,
      totalOrdersInDb: totalOrders,
      reportOrderCount: 0, // will be filled by specific report
    },
  };
}

// ─── Date Helpers ────────────────────────────────────────────────────────────

function getPreviousPeriod(startDate: string, endDate: string): { prevStart: string; prevEnd: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1); // day before current period start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return {
    prevStart: prevStart.toISOString().split("T")[0],
    prevEnd: prevEnd.toISOString().split("T")[0],
  };
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ─── Report Service ──────────────────────────────────────────────────────────

export class ReportService {

  // ── KPIs ─────────────────────────────────────────────────────────────────

  static async getKpis(filters: ReportFilters): Promise<ReportKpi[]> {
    const current = await ReportRepository.getTransactionalMetrics(filters);
    const { prevStart, prevEnd } = getPreviousPeriod(filters.startDate, filters.endDate);
    const previous = await ReportRepository.getTransactionalMetrics({
      ...filters, startDate: prevStart, endDate: prevEnd,
    });

    const growth = (curr: number | null, prev: number | null): number | null => {
      if (curr === null || prev === null) return null;
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / Math.abs(prev)) * 100);
    };

    return [
      {
        id: "net_revenue", label: "Net Revenue",
        currentValue: current.netRevenue,
        previousValue: previous.netRevenue,
        growthPct: growth(current.netRevenue, previous.netRevenue),
        isPositive: current.netRevenue >= previous.netRevenue,
        unit: "currency", description: "Revenue after discounts and tax",
      },
      {
        id: "valid_orders", label: "Valid Orders",
        currentValue: current.validOrders,
        previousValue: previous.validOrders,
        growthPct: growth(current.validOrders, previous.validOrders),
        isPositive: current.validOrders >= previous.validOrders,
        unit: "number", description: "Orders excluding cancelled/refunded",
      },
      {
        id: "aov", label: "Average Order Value",
        currentValue: current.aov,
        previousValue: previous.aov,
        growthPct: growth(current.aov, previous.aov),
        isPositive: (current.aov || 0) >= (previous.aov || 0),
        unit: "currency", description: "Net revenue / valid orders",
      },
      {
        id: "gross_profit", label: "Gross Profit",
        currentValue: current.grossProfit,
        previousValue: previous.grossProfit,
        growthPct: growth(current.grossProfit, previous.grossProfit),
        isPositive: (current.grossProfit || 0) >= (previous.grossProfit || 0),
        unit: "currency",
        description: current.cogsPartiallyUnavailable
          ? "Unavailable — cost data missing for some products"
          : "Revenue minus cost of goods",
        unavailable: current.grossProfit === null,
      },
      {
        id: "gross_margin", label: "Gross Margin",
        currentValue: current.grossMarginPct,
        previousValue: previous.grossMarginPct,
        growthPct: growth(current.grossMarginPct, previous.grossMarginPct),
        isPositive: (current.grossMarginPct || 0) >= (previous.grossMarginPct || 0),
        unit: "percentage",
        description: current.cogsPartiallyUnavailable
          ? "Unavailable — cost data missing"
          : "Profit as percentage of revenue",
        unavailable: current.grossMarginPct === null,
      },
      {
        id: "total_tax", label: "GST Collected",
        currentValue: current.totalTax,
        previousValue: previous.totalTax,
        growthPct: growth(current.totalTax, previous.totalTax),
        isPositive: current.totalTax >= previous.totalTax,
        unit: "currency", description: "Total tax collected (CGST + SGST + IGST)",
      },
    ];
  }

  // ── Sales/Transactional Metrics ──────────────────────────────────────────

  static async getTransactionalMetrics(filters: ReportFilters): Promise<ReportResponse<TransactionalMetrics>> {
    const data = await ReportRepository.getTransactionalMetrics(filters);
    const response = await wrapResponse(data, filters);
    response.meta.reportOrderCount = data.totalOrders;
    return response;
  }

  // ── Product Performance ──────────────────────────────────────────────────

  static async getProductPerformance(filters: ReportFilters): Promise<ReportResponse<ProductPerformanceRow[]>> {
    const data = await ReportRepository.getProductPerformance(filters);
    return wrapResponse(data, filters);
  }

  // ── Branch Performance ───────────────────────────────────────────────────

  static async getBranchPerformance(filters: ReportFilters): Promise<ReportResponse<BranchPerformanceRow[]>> {
    const data = await ReportRepository.getBranchPerformance(filters);
    return wrapResponse(data, filters);
  }

  // ── City Performance ─────────────────────────────────────────────────────

  static async getCityPerformance(filters: ReportFilters): Promise<ReportResponse<CityPerformanceRow[]>> {
    const data = await ReportRepository.getCityPerformance(filters);
    return wrapResponse(data, filters);
  }

  // ── Service Area / Map Fence Performance ─────────────────────────────────────

  static async getServiceAreaPerformance(filters: ReportFilters): Promise<ReportResponse<ServiceAreaRow[]>> {
    const data = await ReportRepository.getServiceAreaPerformance(filters);
    return wrapResponse(data, filters);
  }

  // ── Payment Breakdown ────────────────────────────────────────────────────

  static async getPaymentBreakdown(filters: ReportFilters): Promise<ReportResponse<PaymentSummary>> {
    const data = await ReportRepository.getPaymentBreakdown(filters);
    return wrapResponse(data, filters);
  }

  // ── GST/HSN Summary ─────────────────────────────────────────────────────

  static async getGstHsnSummary(filters: ReportFilters): Promise<ReportResponse<GstHsnSummary>> {
    const data = await ReportRepository.getGstHsnSummary(filters);
    // Override GSTIN from service-level resolution
    const gstInfo = await resolveSellerGstInfo();
    data.sellerGstin = gstInfo.gstin;
    data.sellerLegalName = gstInfo.legalName;
    data.sellerTradeName = gstInfo.tradeName;
    return wrapResponse(data, filters);
  }

  // ── Order Register ───────────────────────────────────────────────────────

  static async getOrderRegister(filters: ReportFilters): Promise<ReportResponse<OrderRegisterRow[]>> {
    const data = await ReportRepository.getOrderRegister(filters);
    const response = await wrapResponse(data, filters);
    response.meta.reportOrderCount = data.length;
    return response;
  }

  // ── Customer Analytics ───────────────────────────────────────────────────

  static async getCustomerAnalytics(filters: ReportFilters): Promise<ReportResponse<CustomerAnalyticsSummary>> {
    const data = await ReportRepository.getCustomerAnalytics(filters);
    return wrapResponse(data, filters);
  }

  // ── Cross-Sell ───────────────────────────────────────────────────────────

  static async getCrossSellAnalysis(filters: ReportFilters): Promise<ReportResponse<CrossSellRow[]>> {
    const data = await ReportRepository.getCrossSellAnalysis(filters);
    return wrapResponse(data, filters);
  }

  // ── Delivery Performance ─────────────────────────────────────────────────

  static async getDeliveryPerformance(filters: ReportFilters): Promise<ReportResponse<DeliveryPerformanceSummary>> {
    const data = await ReportRepository.getDeliveryPerformance(filters);
    return wrapResponse(data, filters);
  }

  // ── Exception Center ─────────────────────────────────────────────────────

  static async getExceptionAudit(filters: ReportFilters): Promise<ReportResponse<ExceptionRow[]>> {
    const data = await ReportRepository.getExceptionAudit(filters);
    return wrapResponse(data, filters);
  }

  // ── Daily Sales Report (composite) ───────────────────────────────────────

  static async getDailySalesReport(filters: ReportFilters): Promise<ReportResponse<DailySalesReport>> {
    const [stats, payments, products, branches] = await Promise.all([
      ReportRepository.getTransactionalMetrics(filters),
      ReportRepository.getPaymentBreakdown(filters),
      ReportRepository.getProductPerformance(filters),
      ReportRepository.getBranchPerformance(filters),
    ]);

    const totalUnits = products.reduce((s, p) => s + p.quantitySold, 0);
    const topProducts = products.slice(0, 5);
    const bestSelling = products[0]?.productName || "—";
    const leastSelling = products.length > 0 ? products[products.length - 1].productName : "—";

    // Most popular category
    const catAgg = new Map<string, number>();
    for (const p of products) {
      catAgg.set(p.category, (catAgg.get(p.category) || 0) + p.quantitySold);
    }
    const topCategory = Array.from(catAgg.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

    const data: DailySalesReport = {
      stats,
      paymentSummary: payments.breakdown,
      paymentTotals: {
        totalCollected: payments.totalCollected,
        totalRefunds: payments.totalRefunds,
        netCollected: payments.netCollected,
      },
      productSummary: {
        totalUnitsSold: totalUnits,
        topProducts,
        bestSellingCake: bestSelling,
        leastSellingCake: leastSelling,
        topCategory,
      },
      branchSummary: branches,
    };

    const response = await wrapResponse(data, filters);
    response.meta.reportOrderCount = stats.totalOrders;
    return response;
  }

  // ── Weekly Sales Report (composite) ──────────────────────────────────────

  static async getWeeklySalesReport(filters: ReportFilters): Promise<ReportResponse<WeeklySalesReport>> {
    const [stats, products, payments, delivery, customers, branches, cities] = await Promise.all([
      ReportRepository.getTransactionalMetrics(filters),
      ReportRepository.getProductPerformance(filters),
      ReportRepository.getPaymentBreakdown(filters),
      ReportRepository.getDeliveryPerformance(filters),
      ReportRepository.getCustomerAnalytics(filters),
      ReportRepository.getBranchPerformance(filters),
      ReportRepository.getCityPerformance(filters),
    ]);

    const data: WeeklySalesReport = {
      stats,
      top3Cakes: products.slice(0, 3),
      leastSellingCakes: products.slice(-3),
      productRankings: products,
      payments: payments.breakdown.map(p => ({ ...p, percentage: p.percentage })),
      delivery,
      customers,
      branches,
      cities,
    };

    const response = await wrapResponse(data, filters);
    response.meta.reportOrderCount = stats.totalOrders;
    return response;
  }

  // ── Monthly Sales Report (composite) ─────────────────────────────────────

  static async getMonthlySalesReport(filters: ReportFilters): Promise<ReportResponse<MonthlySalesReport>> {
    const { prevStart, prevEnd } = getPreviousPeriod(filters.startDate, filters.endDate);

    const [stats, prevStats, delivery, customers, cities, areas, products] = await Promise.all([
      ReportRepository.getTransactionalMetrics(filters),
      ReportRepository.getTransactionalMetrics({ ...filters, startDate: prevStart, endDate: prevEnd }),
      ReportRepository.getDeliveryPerformance(filters),
      ReportRepository.getCustomerAnalytics(filters),
      ReportRepository.getCityPerformance(filters),
      ReportRepository.getServiceAreaPerformance(filters),
      ReportRepository.getProductPerformance(filters),
    ]);

    // Build daily trend
    const dates = generateDateRange(filters.startDate, filters.endDate);
    const orderRegister = await ReportRepository.getOrderRegister(filters);
    const dailyAgg = new Map<string, { sales: number; orders: number }>();
    for (const d of dates) dailyAgg.set(d, { sales: 0, orders: 0 });

    for (const o of orderRegister) {
      const dateKey = o.orderDate.split("T")[0];
      const ex = dailyAgg.get(dateKey);
      if (ex) {
        ex.sales += o.grandTotal;
        ex.orders++;
      }
    }

    const dailyTrend: DailyTrendPoint[] = dates.map((d, idx) => ({
      date: d,
      day: idx + 1,
      netSales: dailyAgg.get(d)?.sales || 0,
      orders: dailyAgg.get(d)?.orders || 0,
    }));

    const growthPctNumeric = prevStats.netRevenue > 0
      ? Math.round(((stats.netRevenue - prevStats.netRevenue) / prevStats.netRevenue) * 100)
      : (stats.netRevenue > 0 ? 100 : 0);

    const data: MonthlySalesReport = {
      stats,
      currentMonthSales: stats.netRevenue,
      prevMonthSales: prevStats.netRevenue,
      growthPctDisplay: `${growthPctNumeric >= 0 ? "+" : ""}${growthPctNumeric}%`,
      growthPctNumeric,
      dailyTrend,
      delivery,
      customers,
      cityPerformance: cities,
      serviceAreaPerformance: areas,
      productPerformance: products,
    };

    const response = await wrapResponse(data, filters);
    response.meta.reportOrderCount = stats.totalOrders;
    return response;
  }
}
