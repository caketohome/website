/**
 * CakeToHome ERP Reporting — Canonical Report DTOs
 * Shared type definitions consumed by both UI and Excel export.
 * All financial values are in INR (paise-free, rounded to 2 decimals).
 * 
 * DESIGN DECISIONS:
 * - Fields that may be unavailable use `number | null` (not 0)
 * - COGS/profit/margin are nullable because cost data may not exist
 * - Delivery timing fields are nullable because timestamps may not exist
 * - GSTIN comes from admin panel GST registration, never hardcoded
 */

// ─── Common Filter / Query Types ─────────────────────────────────────────────

export interface ReportDateRange {
  start: Date;
  end: Date;
}

export interface ReportFilters {
  startDate: string;       // ISO date YYYY-MM-DD
  endDate: string;         // ISO date YYYY-MM-DD
  branchIds?: string[];    // Filter by specific branches
  city?: string;           // Filter by city
  status?: string[];       // Filter by order status
  paymentMethod?: string;  // Filter by normalized payment method
  searchQuery?: string;    // Free-text search
}

/** Canonical payment method normalization */
export type NormalizedPaymentMethod =
  | "COD"
  | "UPI"
  | "CARD"
  | "NETBANKING"
  | "ONLINE"
  | "WALLET"
  | "UNKNOWN";

/** Order classification for test/prototype filtering */
export type OrderClassification =
  | "PRODUCTION"
  | "TEST"
  | "PROTOTYPE"
  | "UNKNOWN";

// ─── Transactional / Sales Metrics ──────────────────────────────────────────

export interface TransactionalMetrics {
  /** Date range these metrics cover */
  periodStart: string;
  periodEnd: string;
  /** Total orders in the period (all statuses) */
  totalOrders: number;
  /** Orders excluding cancelled/refunded */
  validOrders: number;
  /** Orders with status = delivered */
  deliveredOrders: number;
  /** Orders with status = cancelled */
  cancelledOrders: number;
  /** Sum of order totals for valid orders */
  grossRevenue: number;
  /** Total discounts applied */
  totalDiscounts: number;
  /** Total tax collected */
  totalTax: number;
  /** Gross revenue minus discounts minus tax */
  netRevenue: number;
  /** Total delivery fees collected */
  deliveryFees: number;
  /** Total refund amounts */
  totalRefunds: number;
  /** Average order value (net revenue / valid orders) */
  aov: number | null;
  /** COGS — null if cost data unavailable */
  totalCogs: number | null;
  /** Gross profit — null if COGS unavailable */
  grossProfit: number | null;
  /** Gross margin % — null if COGS unavailable */
  grossMarginPct: number | null;
  /** CGST collected */
  cgst: number;
  /** SGST collected */
  sgst: number;
  /** IGST collected */
  igst: number;
  /** Whether any order lacks COGS data */
  cogsPartiallyUnavailable: boolean;
}

/** KPI card for dashboard display */
export interface ReportKpi {
  id: string;
  label: string;
  currentValue: number | null;
  previousValue: number | null;
  growthPct: number | null;
  isPositive: boolean;
  unit: "currency" | "number" | "percentage";
  description: string;
  /** True when the underlying data is unavailable */
  unavailable?: boolean;
}

// ─── Product Performance ─────────────────────────────────────────────────────

export interface ProductPerformanceRow {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  hsnCode: string;
  uqc: string;
  gstRatePct: number;
  quantitySold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  taxableValue: number;
  gstAmount: number;
  /** COGS — null if cost_price not available for this product */
  unitCost: number | null;
  totalCogs: number | null;
  grossProfit: number | null;
  grossMarginPct: number | null;
  refundQuantity: number;
  refundAmount: number;
  avgSellingPrice: number;
  /** True when cost data is unavailable for this product */
  cogsUnavailable: boolean;
}

// ─── Branch Performance ──────────────────────────────────────────────────────

export interface BranchPerformanceRow {
  branchId: string;
  branchName: string;
  branchCode: string;
  city: string;
  state: string;
  ordersCount: number;
  deliveredCount: number;
  cancelledCount: number;
  grossSales: number;
  netSales: number;
  totalCogs: number | null;
  grossProfit: number | null;
  marginPct: number | null;
  aov: number | null;
  customerCount: number;
  cogsUnavailable: boolean;
}

// ─── City Performance ────────────────────────────────────────────────────────

export interface CityPerformanceRow {
  city: string;
  orders: number;
  units: number;
  grossSales: number;
  discounts: number;
  tax: number;
  netSales: number;
  delivered: number;
  cancelled: number;
  aov: number | null;
}

// ─── Service Area / Map Fence Performance ────────────────────────────────────
// NOTE: CakeToHome uses polygon/radius map fencing — not pincode — as the
// delivery and reporting dimension. Pincode is legacy metadata only.

export interface ServiceAreaRow {
  /** Human-readable zone name (e.g. "Kollam Central") */
  zoneName: string;
  /** Zone ID from delivery_zone table */
  zoneId: string;
  /** Branch that owns this service area */
  branchId: string;
  branchName: string;
  city: string;
  orders: number;
  revenue: number;
  delivered: number;
  cancelled: number;
  aov: number | null;
  /** True if this zone has polygon geometry; false if radius/legacy only */
  hasPolygon: boolean;
  /** Radius in km if radius-based zone; null if polygon-only */
  radiusKm: number | null;
}

/** @deprecated Use ServiceAreaRow — pincode is not the delivery dimension */
export type AreaPincodeRow = ServiceAreaRow;

// ─── Payment Breakdown ───────────────────────────────────────────────────────

export interface PaymentBreakdownRow {
  method: NormalizedPaymentMethod;
  count: number;
  grossAmount: number;
  refundAmount: number;
  netAmount: number;
  percentage: number;
}

export interface PaymentSummary {
  totalCollected: number;
  totalRefunds: number;
  netCollected: number;
  breakdown: PaymentBreakdownRow[];
}

// ─── GST / HSN Summary ──────────────────────────────────────────────────────

export interface GstHsnRow {
  hsnCode: string;
  description: string;
  uom: string;
  quantity: number;
  taxableValue: number;
  gstRatePct: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  totalValue: number;
}

export interface GstHsnSummary {
  items: GstHsnRow[];
  totals: GstHsnRow;
  /** GSTIN from admin panel — null if not configured */
  sellerGstin: string | null;
  sellerLegalName: string | null;
  sellerTradeName: string | null;
}

// ─── GST Detailed Register ──────────────────────────────────────────────────

export interface GstDetailedRegisterRow {
  invoiceNumber: string;
  orderId: string;
  orderDate: string;
  customerName: string;
  customerGstin: string;
  city: string;
  branchName: string;
  classification: "B2C" | "B2B";
  productName: string;
  sku: string;
  hsnCode: string;
  description: string;
  uqc: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  gstRatePct: number;
  cgstRatePct: number;
  cgstAmount: number;
  sgstRatePct: number;
  sgstAmount: number;
  igstRatePct: number;
  igstAmount: number;
  totalTax: number;
  invoiceTotal: number;
}

// ─── Order Register ──────────────────────────────────────────────────────────

export interface OrderRegisterRow {
  orderId: string;
  orderNumber: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  orderDate: string;
  deliveryDate: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  branchId: string | null;
  branchName: string;
  city: string;
  area: string;
  pincode: string;
  productNames: string;
  itemCount: number;
  grossAmount: number;
  discount: number;
  taxAmount: number;
  deliveryFee: number;
  /** gross - discount (net before tax) */
  taxableAmount: number;
  /** gross - discount + tax + delivery = grand total */
  grandTotal: number;
  paymentMethod: NormalizedPaymentMethod;
  paymentStatus: string;
  orderStatus: string;
  /** COGS for this order — null if any item lacks cost data */
  cogs: number | null;
  profit: number | null;
  marginPct: number | null;
  cogsUnavailable: boolean;
  classification: OrderClassification;
}

// ─── Customer Analytics ──────────────────────────────────────────────────────

export interface CustomerRow {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpend: number;
  aov: number;
  segment: "New Buyer" | "Repeat Customer" | "VIP Gold";
}

export interface CustomerAnalyticsSummary {
  totalCustomers: number;
  newCustomers: number;
  repeatCustomers: number;
  repeatPurchaseRate: number;
  ltv: number;
  avgOrdersPerCustomer: number;
  topCustomers: CustomerRow[];
}

// ─── Delivery Performance ────────────────────────────────────────────────────

export interface DeliveryPerformanceSummary {
  totalDeliveries: number;
  deliveredOrders: number;
  /** null if delivery timing data unavailable */
  onTimeDeliveries: number | null;
  /** null if delivery timing data unavailable */
  delayedDeliveries: number | null;
  failedDeliveries: number;
  /** null if delivery timing data unavailable */
  avgDeliveryMinutes: number | null;
  /** null if delivery timing data unavailable */
  slaCompliancePct: number | null;
  /** Explicit flag: true when delivery timing data is not available */
  timingDataUnavailable: boolean;
}

// ─── Cross-Sell / Basket Analysis ────────────────────────────────────────────

export interface CrossSellRow {
  primaryItem: string;
  coPurchasedItem: string;
  coPurchaseCount: number;
  attachRatePct: number;
  addedRevenue: number;
}

// ─── Exception / Data Quality ────────────────────────────────────────────────

export type ExceptionSeverity = "critical" | "high" | "medium" | "low";

export type ExceptionCategory =
  | "tax_gst"
  | "financial"
  | "product"
  | "customer"
  | "branch"
  | "order"
  | "data_quality";

export interface ExceptionRow {
  id: string;
  severity: ExceptionSeverity;
  category: ExceptionCategory;
  ruleId: string;
  title: string;
  description: string;
  affectedCount: number;
  entityType: string;
  entityId: string;
  entityName: string;
  detectedAt: string;
}

// ─── Daily / Weekly / Monthly Report Composites ──────────────────────────────

export interface DailySalesReport {
  stats: TransactionalMetrics;
  paymentSummary: PaymentBreakdownRow[];
  paymentTotals: { totalCollected: number; totalRefunds: number; netCollected: number };
  productSummary: {
    totalUnitsSold: number;
    topProducts: ProductPerformanceRow[];
    bestSellingCake: string;
    leastSellingCake: string;
    topCategory: string;
  };
  branchSummary: BranchPerformanceRow[];
}

export interface WeeklySalesReport {
  stats: TransactionalMetrics;
  top3Cakes: ProductPerformanceRow[];
  leastSellingCakes: ProductPerformanceRow[];
  productRankings: ProductPerformanceRow[];
  payments: (PaymentBreakdownRow & { percentage: number })[];
  delivery: DeliveryPerformanceSummary;
  customers: CustomerAnalyticsSummary;
  branches: BranchPerformanceRow[];
  cities: CityPerformanceRow[];
}

export interface DailyTrendPoint {
  date: string;
  day: number;
  netSales: number;
  orders: number;
}

export interface MonthlySalesReport {
  stats: TransactionalMetrics;
  currentMonthSales: number;
  prevMonthSales: number;
  growthPctDisplay: string;
  growthPctNumeric: number;
  dailyTrend: DailyTrendPoint[];
  delivery: DeliveryPerformanceSummary;
  customers: CustomerAnalyticsSummary;
  cityPerformance: CityPerformanceRow[];
  serviceAreaPerformance: ServiceAreaRow[];
  productPerformance: ProductPerformanceRow[];
}

// ─── Report API Response Envelope ────────────────────────────────────────────

export interface ReportResponse<T> {
  success: boolean;
  data: T;
  meta: {
    generatedAt: string;
    dataSource: "postgresql";
    filters: ReportFilters;
    /** GSTIN from admin panel — null if not configured */
    sellerGstin: string | null;
    totalOrdersInDb: number;
    reportOrderCount: number;
  };
  error?: string;
}
