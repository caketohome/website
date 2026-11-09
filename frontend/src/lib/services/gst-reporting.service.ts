/**
 * CakeToHome ERP — GST Reporting Service
 * Dedicated service for statutory GST report generation and Excel export.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. PostgreSQL is the single source of truth for all report data.
 *    - Orders (public."order"), invoices (persisted in order metadata & invoice table),
 *      expenses (public.expense), GST registrations (public.gst_registration).
 * 2. Pure data aggregation — zero mutations, zero side-effects.
 * 3. Reuses existing ReportRepository, ReportService, and ExcelExportService.
 * 4. Separates invoice-level tax calculation from posted accounting tax balances.
 * 5. Never double-counts cancelled, reversed, duplicate, or superseded documents.
 * 6. Clearly distinguishes management reports, draft returns, and portal-compatible files.
 * 7. Exact paise precision with 2-decimal rounding.
 *
 * REPORT CATALOG:
 *   - GST Summary (Executive KPIs with period comparison)
 *   - Invoice Register (GSTR-1 B2B + B2C invoice-level audit)
 *   - GST Sales Transaction Register (line-item detail)
 *   - B2B Sales (GSTIN-registered buyers)
 *   - B2C Sales (unregistered consumers)
 *   - Credit/Debit Notes (returns, refunds)
 *   - HSN Summary (statutory HSN-wise aggregation)
 *   - Tax Rate Summary (rate-slab distribution)
 *   - GSTR-1 Draft Summary (outward supply return)
 *   - GSTR-3B Draft Summary (monthly summary return)
 *   - Input Tax Credit (purchase-side ITC from expenses)
 *   - Data Quality / Validation Audit
 *   - Complete 11-sheet Excel Master Workbook
 */

import { dbQuery } from "../db";
import { ReportRepository } from "../repositories/report.repository";
import { ReportService } from "./report.service";
import { ExcelExportService, setExportBusinessIdentity } from "../excel-export-service";
import type {
  ReportFilters,
  GstHsnSummary,
  ReportKpi,
  TransactionalMetrics,
} from "../types/report.types";

// ─── GST Report Types ────────────────────────────────────────────────────────

/** Filters specific to GST reporting, extending base ReportFilters */
export interface GstReportFilters extends ReportFilters {
  /** Specific GSTIN of the filing entity (auto-resolved if omitted) */
  filingGstin?: string;
  /** Return period in MMYYYY format (e.g. "082026") */
  returnPeriod?: string;
  /** Report type selector */
  reportType?: GstReportType;
}

export type GstReportType =
  | "SUMMARY"
  | "INVOICE_REGISTER"
  | "SALES_REGISTER"
  | "B2B"
  | "B2C"
  | "CREDIT_NOTES"
  | "HSN_SUMMARY"
  | "TAX_SUMMARY"
  | "GSTR1"
  | "GSTR3B"
  | "INPUT_TAX"
  | "VALIDATION"
  | "COMPLETE_WORKBOOK";

/** Invoice-level row for the B2B/B2C invoice register */
export interface GstInvoiceRegisterRow {
  invoiceNumber: string | null;
  invoiceDate: string;
  orderNumber: string;
  orderId: string;
  customerName: string;
  customerGstin: string | null;
  customerType: "B2B" | "B2C";
  branchName: string;
  branchGstin: string | null;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  isReverseCharge: boolean;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  totalTax: number;
  totalValue: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  complianceStatus: "COMPLIANT" | "PENDING_INVOICE" | "NOT_INVOICED";
}

/** Sales register line-item detail row */
export interface GstSalesRegisterRow {
  invoiceDate: string;
  invoiceNumber: string | null;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerGstin: string | null;
  customerType: "B2B" | "B2C";
  placeOfSupply: string;
  state: string;
  branchName: string;
  branchGstin: string | null;
  productName: string;
  sku: string;
  hsnCode: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  grossAmount: number;
  taxableValue: number;
  gstRatePct: number;
  cgstRatePct: number;
  cgst: number;
  sgstRatePct: number;
  sgst: number;
  igstRatePct: number;
  igst: number;
  totalTax: number;
  totalValue: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  complianceStatus: "COMPLIANT" | "PENDING_INVOICE" | "NOT_INVOICED";
}

/** Credit / Debit note row */
export interface GstCreditNoteRow {
  cnNumber: string;
  cnDate: string;
  origInvoice: string;
  orderId: string;
  customerName: string;
  customerGstin: string | null;
  reason: string;
  reasonCode: string;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalRefund: number;
  /** Source of this CN: 'PERSISTED_REFUND' = from refund table, 'ORDER_STATUS' = inferred */
  source: "PERSISTED_REFUND" | "ORDER_STATUS";
  /** Refund record ID if sourced from persisted refund table */
  refundRecordId: string | null;
}

/** Purchase-side ITC row from expense records */
export interface GstInputTaxRow {
  expenseId: string;
  expenseDate: string;
  vendorName: string;
  vendorGstin: string | null;
  category: string;
  hsnSacCode: string;
  description: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  itcEligibility: string;
  rcmApplicable: boolean;
  invoiceNumber: string | null;
}

/** GSTR-1 summary table row */
export interface Gstr1SummaryRow {
  tableRef: string;
  description: string;
  invoiceCount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
}

/** GSTR-3B summary table row */
export interface Gstr3bSummaryRow {
  tableRef: string;
  description: string;
  taxableValue: number;
  integratedTax: number;
  centralTax: number;
  stateUtTax: number;
  cess: number;
}

/** Tax rate slab summary row */
export interface TaxRateSlabRow {
  rateSlab: string;
  ratePct: number;
  taxableSales: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  invoiceCount: number;
}

/** Data quality warning */
export interface GstDataQualityWarning {
  id: string;
  title: string;
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  action: string;
  status: "OPEN" | "PASS";
}

/**
 * Complete GST report payload — consumed by both UI and Excel export.
 *
 * IMPORTANT DISCLAIMERS:
 * - GSTR-1 and GSTR-3B sections are MANAGEMENT REPORTS for internal review.
 *   They are NOT portal-upload compatible files. Filing requires the official
 *   GST Portal (gst.gov.in) or certified GSP software.
 * - Credit notes sourced from order status alone (source='ORDER_STATUS') are
 *   NOT statutory documents. Only persisted refund records are authoritative.
 * - HSN codes marked 'UNCLASSIFIED' lack product-level classification and
 *   must be reviewed before statutory filing.
 */
export interface GstReportPayload {
  filters: GstReportFilters;
  generatedAt: string;
  filingGstin: string | null;
  legalName: string | null;
  tradeName: string | null;
  kpis: ReportKpi[];
  invoiceRegister: GstInvoiceRegisterRow[];
  salesRegister: GstSalesRegisterRow[];
  creditNotes: GstCreditNoteRow[];
  hsnSummary: GstHsnSummary;
  taxRateSlabs: TaxRateSlabRow[];
  gstr1Summary: Gstr1SummaryRow[];
  gstr3bSummary: Gstr3bSummaryRow[];
  inputTaxCredit: GstInputTaxRow[];
  dataQualityWarnings: GstDataQualityWarning[];
  metrics: TransactionalMetrics;
  /** Explicit disclaimers for consumers of this payload */
  disclaimers: string[];
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Valid order statuses that should be included in GST reports */
const GST_VALID_STATUSES = ["delivered", "completed", "paid"];
const GST_EXCLUDED_STATUSES = ["cancelled", "canceled", "refunded", "draft", "abandoned"];

// ─── GST Reporting Service ───────────────────────────────────────────────────

export class GstReportingService {

  // ── 1. Seller Identity Resolution ──────────────────────────────────────────

  private static async resolveFilingIdentity(filters: GstReportFilters): Promise<{
    gstin: string | null;
    legalName: string | null;
    tradeName: string | null;
  }> {
    if (filters.filingGstin) {
      // Lookup specific GSTIN from registry
      try {
        const res = await dbQuery(
          `SELECT g.gstin, g.legal_name, c.trade_name
           FROM public.gst_registration g
           LEFT JOIN public.company c ON c.id = g.company_id
           WHERE g.gstin = $1 AND g.is_active = true
           LIMIT 1`,
          [filters.filingGstin]
        );
        if (res.rows.length > 0) {
          return {
            gstin: res.rows[0].gstin,
            legalName: res.rows[0].legal_name || null,
            tradeName: res.rows[0].trade_name || null,
          };
        }
      } catch {}
    }
    // Default: first active registration
    return ReportRepository.getSellerGstInfo();
  }

  // ── 2. Invoice Register (B2B + B2C) ────────────────────────────────────────

  static async getInvoiceRegister(filters: GstReportFilters): Promise<GstInvoiceRegisterRow[]> {
    const orderRegister = await ReportRepository.getOrderRegister(filters);
    const gstInfo = await this.resolveFilingIdentity(filters);
    const rows: GstInvoiceRegisterRow[] = [];

    for (const order of orderRegister) {
      if (GST_EXCLUDED_STATUSES.includes(order.orderStatus.toLowerCase())) continue;
      if (order.classification === "TEST" || order.classification === "PROTOTYPE") continue;

      const hasGstin = !!(order as any).customerGstin &&
        (order as any).customerGstin !== "URP" &&
        (order as any).customerGstin !== "";
      const customerType: "B2B" | "B2C" = hasGstin ? "B2B" : "B2C";

      // Derive tax split from order-level data
      const taxAmount = order.taxAmount;
      let cgst = 0, sgst = 0, igst = 0;
      // Attempt to derive from order metadata
      if (taxAmount > 0) {
        // Default: intra-state (CGST + SGST) since CakeToHome primarily operates within state
        cgst = round2(taxAmount / 2);
        sgst = round2(taxAmount - cgst);
        igst = 0;
      }

      // STRICT STATUTORY REQUIREMENT: Never substitute orderNumber for legal statutory invoiceNumber!
      const invoiceNumber = order.invoiceNumber || null;
      const orderSt = (order.orderStatus || "").toLowerCase();
      const isDelivered = orderSt === "delivered" || orderSt === "completed" || (order as any).deliveryStatus === "delivered";
      const complianceStatus: "COMPLIANT" | "PENDING_INVOICE" | "NOT_INVOICED" =
        invoiceNumber ? "COMPLIANT" : (isDelivered ? "PENDING_INVOICE" : "NOT_INVOICED");

      rows.push({
        invoiceNumber,
        invoiceDate: (order.invoiceDate || order.orderDate).split("T")[0],
        orderNumber: order.orderNumber,
        orderId: order.orderId,
        customerName: order.customerName,
        customerGstin: hasGstin ? (order as any).customerGstin : null,
        customerType,
        branchName: order.branchName,
        branchGstin: gstInfo.gstin,
        placeOfSupply: order.city || "Unknown",
        placeOfSupplyCode: "",
        isReverseCharge: false,
        taxableAmount: order.taxableAmount,
        cgst,
        sgst,
        igst,
        cess: 0,
        totalTax: round2(cgst + sgst + igst),
        totalValue: order.grandTotal,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        complianceStatus,
      });
    }

    return rows;
  }

  // ── 3. Sales Register (line-item detail) ───────────────────────────────────

  static async getSalesRegister(filters: GstReportFilters): Promise<GstSalesRegisterRow[]> {
    // Query orders with full metadata and LEFT JOIN public.invoice for statutory invoice numbering
    const sqlFilters = this.buildGstDateFilter(filters);
    const sql = `
      SELECT o.id, o.customer_id, o.status::text as status, o.metadata, o.created_at,
             i.invoice_number AS real_invoice_number, i.created_at AS real_invoice_date
      FROM public."order" o
      LEFT JOIN public.invoice i ON i.order_id = o.id
      WHERE o.deleted_at IS NULL
        AND o.created_at >= $1::timestamptz
        AND o.created_at <= $2::timestamptz
      ORDER BY o.created_at DESC
    `;
    const result = await dbQuery(sql, [
      `${filters.startDate}T00:00:00+05:30`,
      `${filters.endDate}T23:59:59+05:30`,
    ]);

    const gstInfo = await this.resolveFilingIdentity(filters);
    const rows: GstSalesRegisterRow[] = [];

    for (const row of result.rows) {
      const meta = row.metadata || {};
      const status = (row.status || "").toLowerCase();

      if (GST_EXCLUDED_STATUSES.includes(status)) continue;
      if (meta.invoicing_exempt === true || meta.classification === "TEST" || String(row.id || "").toLowerCase().includes("test_cod_") || String(row.id || "").toLowerCase().includes("ord_test_")) continue;

      const customerName = meta.customer_name || "Unknown";
      const customerPhone = meta.customer_phone || "";
      const customerGstin = meta.customer_gstin || meta.compliance_snapshot?.customer_gstin || null;
      const hasGstin = customerGstin && customerGstin !== "URP" && customerGstin !== "";
      const customerType: "B2B" | "B2C" = hasGstin ? "B2B" : "B2C";

      const branchName = meta.branch_name || "Unknown";
      const deliveryAddr = meta.delivery_address;
      const city = typeof deliveryAddr === "object" ? (deliveryAddr?.city || "Unknown") : (meta.delivery_city || "Unknown");
      const state = typeof deliveryAddr === "object" ? (deliveryAddr?.state || "") : (meta.delivery_state || "");

      const compSnap = meta.compliance_snapshot;
      const isIntraState = compSnap?.is_intra_state !== false;

      // STRICT STATUTORY REQUIREMENT: Only committed database invoices (public.invoice) are reported.
      // Never fall back to uncommitted order metadata or order created date!
      const statutoryInvoiceNum = row.real_invoice_number || null;
      const statutoryInvoiceDate = row.real_invoice_date
        ? new Date(row.real_invoice_date).toISOString().split("T")[0]
        : "";

      // STRICT STATUTORY REQUIREMENT: Never substitute orderNumber/row.id for legal statutory invoiceNumber!
      const invoiceNumber = statutoryInvoiceNum || null;
      const invoiceDate = statutoryInvoiceDate;
      const orderNumber = meta.order_number || row.id;
      const isDelivered = status === "delivered" || status === "completed" || meta.delivery_status === "delivered";
      const complianceStatus: "COMPLIANT" | "PENDING_INVOICE" | "NOT_INVOICED" =
        invoiceNumber ? "COMPLIANT" : (isDelivered ? "PENDING_INVOICE" : "NOT_INVOICED");

      const items: any[] = Array.isArray(meta.items) ? meta.items : [];

      for (const item of items) {
        const qty = Number(item.quantity || 1);
        const unitPrice = Number(item.unit_price || item.price || 0);
        const grossAmount = round2(qty * unitPrice);
        const itemDiscount = Number(item.discount || 0);
        const taxableValue = round2(grossAmount - itemDiscount);
        const gstRatePct = Number(item.gst_rate_pct || item.tax_rate || 5);

        let cgst = 0, sgst = 0, igst = 0;
        if (typeof item.cgst === "number" && typeof item.sgst === "number") {
          cgst = item.cgst;
          sgst = item.sgst;
          igst = Number(item.igst || 0);
        } else {
          const lineItemTax = Number(item.tax_amount || round2(taxableValue * gstRatePct / 100));
          if (isIntraState) {
            cgst = round2(lineItemTax / 2);
            sgst = round2(lineItemTax - cgst);
          } else {
            igst = lineItemTax;
          }
        }
        const totalTax = round2(cgst + sgst + igst);
        const totalValue = round2(taxableValue + totalTax);

        rows.push({
          invoiceDate,
          invoiceNumber,
          orderNumber,
          customerName,
          customerPhone,
          customerGstin: hasGstin ? customerGstin : null,
          customerType,
          placeOfSupply: city,
          state,
          branchName,
          branchGstin: gstInfo.gstin,
          productName: item.title || item.product_name || "Item",
          sku: item.sku || "",
          hsnCode: item.hsn_code || "UNCLASSIFIED",
          quantity: qty,
          uom: item.uom || "PCS",
          unitPrice,
          grossAmount,
          taxableValue,
          gstRatePct,
          cgstRatePct: isIntraState ? gstRatePct / 2 : 0,
          cgst,
          sgstRatePct: isIntraState ? gstRatePct / 2 : 0,
          sgst,
          igstRatePct: isIntraState ? 0 : gstRatePct,
          igst,
          totalTax,
          totalValue,
          paymentMethod: meta.payment_method || "",
          paymentStatus: (meta.payment_status || "").toLowerCase(),
          orderStatus: status,
          complianceStatus,
        });
      }
    }

    return rows;
  }

  // ── 4. Credit / Debit Notes ────────────────────────────────────────────────
  // CORRECTED: Prioritize persisted refund records from `order_lifecycle_refund`
  // and `refund` tables. Only fall back to order-status inference when a
  // persisted refund record links to the order. Orders that are merely
  // cancelled without a persisted refund document are excluded — a status
  // change alone is not a statutory credit note.

  static async getCreditNotes(filters: GstReportFilters): Promise<GstCreditNoteRow[]> {
    const rows: GstCreditNoteRow[] = [];
    let cnSeq = 1;

    // ── Step 1: Query persisted refund records ───────────────────────────
    try {
      const refundSql = `
        SELECT olr.id as refund_id, olr.order_id, olr.amount, olr.reason_code,
               olr.reason, olr.status as refund_status, olr.created_at,
               o.metadata as order_meta, o.status::text as order_status
        FROM public.order_lifecycle_refund olr
        JOIN public."order" o ON o.id = olr.order_id
        WHERE olr.deleted_at IS NULL
          AND o.deleted_at IS NULL
          AND olr.status NOT IN ('DRAFT', 'VOID', 'REJECTED')
          AND olr.created_at >= $1::timestamptz
          AND olr.created_at <= $2::timestamptz
        ORDER BY olr.created_at DESC
      `;
      const refundResult = await dbQuery(refundSql, [
        `${filters.startDate}T00:00:00+05:30`,
        `${filters.endDate}T23:59:59+05:30`,
      ]);

      for (const row of refundResult.rows) {
        const meta = row.order_meta || {};
        const refundAmount = Number(row.amount || 0);
        if (refundAmount === 0) continue;

        // Derive tax from the refund amount using the order's tax rate
        const orderTotal = Number(meta.total || meta.grand_total || meta.total_amount || 1);
        const orderTax = Number(meta.tax_amount || meta.tax_total || 0);
        const taxProportion = orderTotal > 0 ? orderTax / orderTotal : 0;
        const refundTax = round2(refundAmount * taxProportion);
        const refundTaxable = round2(refundAmount - refundTax);
        const cgst = round2(refundTax / 2);
        const sgst = round2(refundTax - cgst);

        rows.push({
          cnNumber: `CN-${filters.startDate.replace(/-/g, "").slice(2)}-${String(cnSeq++).padStart(4, "0")}`,
          cnDate: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "",
          origInvoice: meta.invoice_number || meta.order_number || row.order_id,
          orderId: row.order_id,
          customerName: meta.customer_name || "Unknown",
          customerGstin: meta.customer_gstin || null,
          reason: row.reason || (row.reason_code === "shipping_issue" ? "Shipping Issue" : "Customer Refund"),
          reasonCode: row.reason_code || "unspecified",
          taxable: refundTaxable,
          cgst,
          sgst,
          igst: 0,
          totalRefund: refundAmount,
          source: "PERSISTED_REFUND",
          refundRecordId: row.refund_id,
        });
      }
    } catch (err) {
      // order_lifecycle_refund table may not be populated yet
      console.warn("[GstReportingService.getCreditNotes] Refund table query:", err);
    }

    // ── Step 2: Also check for refunds in the refund table ───────────────
    try {
      const refundTableSql = `
        SELECT r.id, r.amount, r.note, r.refund_reason_id, r.created_at,
               r.metadata, r.payment_id
        FROM public.refund r
        WHERE r.deleted_at IS NULL
          AND r.created_at >= $1::timestamptz
          AND r.created_at <= $2::timestamptz
        ORDER BY r.created_at DESC
      `;
      const refundRows = await dbQuery(refundTableSql, [
        `${filters.startDate}T00:00:00+05:30`,
        `${filters.endDate}T23:59:59+05:30`,
      ]);

      // Deduplicate: skip if order_id was already processed from lifecycle table
      const processedOrderIds = new Set(rows.map(r => r.orderId));

      for (const row of refundRows.rows) {
        const refundMeta = row.metadata || {};
        const orderId = refundMeta.order_id || "";
        if (processedOrderIds.has(orderId)) continue;

        const refundAmount = Number(row.amount || (row.raw_amount ? JSON.parse(JSON.stringify(row.raw_amount)).amount : 0));
        if (refundAmount === 0) continue;

        rows.push({
          cnNumber: `CN-${filters.startDate.replace(/-/g, "").slice(2)}-${String(cnSeq++).padStart(4, "0")}`,
          cnDate: row.created_at ? new Date(row.created_at).toISOString().split("T")[0] : "",
          origInvoice: refundMeta.invoice_number || refundMeta.order_number || orderId,
          orderId,
          customerName: refundMeta.customer_name || "Unknown",
          customerGstin: refundMeta.customer_gstin || null,
          reason: row.note || "Refund",
          reasonCode: "refund_table",
          taxable: refundAmount,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalRefund: refundAmount,
          source: "PERSISTED_REFUND",
          refundRecordId: row.id,
        });
        processedOrderIds.add(orderId);
      }
    } catch (err) {
      console.warn("[GstReportingService.getCreditNotes] Refund table query:", err);
    }

    // NOTE: Cancelled orders WITHOUT a persisted refund record are deliberately
    // excluded. A mere status change to 'cancelled' does not constitute a
    // statutory credit note. If the business needs to issue a CN for a
    // cancellation, it must go through the refund workflow which persists
    // a record in order_lifecycle_refund or refund tables.

    return rows;
  }

  // ── 5. Input Tax Credit (Purchase-side from expenses) ──────────────────────

  static async getInputTaxCredit(filters: GstReportFilters): Promise<GstInputTaxRow[]> {
    try {
      const sql = `
        SELECT
          e.id, e.expense_date,
          COALESCE(s.name, e.metadata->>'vendor_name', 'General Vendor') as vendor_name,
          COALESCE(e.vendor_gstin, s.gstin) as vendor_gstin,
          COALESCE(e.category_id, 'General') as category,
          e.hsn_sac_code, e.description,
          e.taxable_value, e.cgst, e.sgst, e.igst,
          e.itc_eligibility, e.rcm_applicable,
          e.reference_no as invoice_number,
          e.status, e.deleted_at
        FROM public.expense e
        LEFT JOIN public.supplier s ON s.id = e.supplier_id
        WHERE e.deleted_at IS NULL
          AND e.expense_date >= $1::date
          AND e.expense_date <= $2::date
          AND e.status NOT IN ('DRAFT', 'VOID', 'REJECTED')
        ORDER BY e.expense_date DESC
      `;
      const result = await dbQuery(sql, [filters.startDate, filters.endDate]);

      return result.rows.map(row => {
        const rawElig = (row.itc_eligibility || "ELIGIBLE").toUpperCase();
        const itcEligibility = rawElig.includes("INELIGIBLE") ? "INELIGIBLE" : "ELIGIBLE";
        return {
          expenseId: row.id,
          expenseDate: row.expense_date ? new Date(row.expense_date).toISOString().split("T")[0] : "",
          vendorName: row.vendor_name || "Unknown Vendor",
          vendorGstin: row.vendor_gstin || null,
          category: row.category || "General",
          hsnSacCode: row.hsn_sac_code || "",
          description: row.description || "",
          taxableValue: round2(Number(row.taxable_value || 0)),
          cgst: round2(Number(row.cgst || 0)),
          sgst: round2(Number(row.sgst || 0)),
          igst: round2(Number(row.igst || 0)),
          totalTax: round2(Number(row.cgst || 0) + Number(row.sgst || 0) + Number(row.igst || 0)),
          itcEligibility,
          rcmApplicable: Boolean(row.rcm_applicable),
          invoiceNumber: row.invoice_number || null,
        };
      });
    } catch (err) {
      // Expense table may not exist yet — graceful degradation
      console.warn("[GstReportingService.getInputTaxCredit] Notice:", err);
      return [];
    }
  }

  // ── 6. Tax Rate Slab Summary ───────────────────────────────────────────────

  static buildTaxRateSlabs(salesRegister: GstSalesRegisterRow[]): TaxRateSlabRow[] {
    const slabMap = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; count: number }>();
    const standardRates = [0, 5, 12, 18, 28];

    // Initialize standard slabs
    for (const rate of standardRates) {
      slabMap.set(rate, { taxable: 0, cgst: 0, sgst: 0, igst: 0, count: 0 });
    }

    for (const row of salesRegister) {
      const rate = row.gstRatePct;
      const existing = slabMap.get(rate) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, count: 0 };
      existing.taxable += row.taxableValue;
      existing.cgst += row.cgst;
      existing.sgst += row.sgst;
      existing.igst += row.igst;
      existing.count++;
      slabMap.set(rate, existing);
    }

    return Array.from(slabMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rate, data]) => ({
        rateSlab: `${rate}% Slab`,
        ratePct: rate,
        taxableSales: round2(data.taxable),
        cgst: round2(data.cgst),
        sgst: round2(data.sgst),
        igst: round2(data.igst),
        totalTax: round2(data.cgst + data.sgst + data.igst),
        invoiceCount: data.count,
      }));
  }

  // ── 7. GSTR-1 Draft Summary ────────────────────────────────────────────────

  static buildGstr1Summary(
    invoiceRegister: GstInvoiceRegisterRow[],
    creditNotes: GstCreditNoteRow[],
    hsnSummary: GstHsnSummary,
  ): Gstr1SummaryRow[] {
    // Statutory requirement: Only orders with authoritative statutory invoices can be reported in GSTR-1 outward supplies
    const b2bInvoices = invoiceRegister.filter(i => i.customerType === "B2B" && i.invoiceNumber !== null);
    const b2cInvoices = invoiceRegister.filter(i => i.customerType === "B2C" && i.invoiceNumber !== null);

    const sumField = <T>(arr: T[], fn: (item: T) => number): number =>
      round2(arr.reduce((s, item) => s + fn(item), 0));

    return [
      {
        tableRef: "Table 4A, 4B",
        description: "B2B Taxable Invoices",
        invoiceCount: b2bInvoices.length,
        taxableValue: sumField(b2bInvoices, i => i.taxableAmount),
        cgst: sumField(b2bInvoices, i => i.cgst),
        sgst: sumField(b2bInvoices, i => i.sgst),
        igst: sumField(b2bInvoices, i => i.igst),
        cess: 0,
      },
      {
        tableRef: "Table 7",
        description: "B2C (Small) Outward Supplies",
        invoiceCount: b2cInvoices.length,
        taxableValue: sumField(b2cInvoices, i => i.taxableAmount),
        cgst: sumField(b2cInvoices, i => i.cgst),
        sgst: sumField(b2cInvoices, i => i.sgst),
        igst: sumField(b2cInvoices, i => i.igst),
        cess: 0,
      },
      {
        tableRef: "Table 9B",
        description: "Credit / Debit Notes (Registered & Unregistered)",
        invoiceCount: creditNotes.length,
        taxableValue: sumField(creditNotes, cn => cn.taxable),
        cgst: sumField(creditNotes, cn => cn.cgst),
        sgst: sumField(creditNotes, cn => cn.sgst),
        igst: sumField(creditNotes, cn => cn.igst),
        cess: 0,
      },
      {
        tableRef: "Table 12",
        description: "HSN Summary of Outward Supplies",
        invoiceCount: hsnSummary.items.length,
        taxableValue: hsnSummary.totals.taxableValue,
        cgst: hsnSummary.totals.cgst,
        sgst: hsnSummary.totals.sgst,
        igst: hsnSummary.totals.igst,
        cess: hsnSummary.totals.cess,
      },
    ];
  }

  // ── 8. GSTR-3B Draft Summary ───────────────────────────────────────────────

  static buildGstr3bSummary(
    salesRegister: GstSalesRegisterRow[],
    inputTaxCredit: GstInputTaxRow[],
  ): Gstr3bSummaryRow[] {
    const totalTaxable = round2(salesRegister.reduce((s, r) => s + r.taxableValue, 0));
    const totalCgst = round2(salesRegister.reduce((s, r) => s + r.cgst, 0));
    const totalSgst = round2(salesRegister.reduce((s, r) => s + r.sgst, 0));
    const totalIgst = round2(salesRegister.reduce((s, r) => s + r.igst, 0));

    const eligibleItc = inputTaxCredit.filter(i => i.itcEligibility === "ELIGIBLE" || i.itcEligibility === "eligible");
    const itcCgst = round2(eligibleItc.reduce((s, r) => s + r.cgst, 0));
    const itcSgst = round2(eligibleItc.reduce((s, r) => s + r.sgst, 0));
    const itcIgst = round2(eligibleItc.reduce((s, r) => s + r.igst, 0));

    return [
      {
        tableRef: "3.1(a)",
        description: "Outward Taxable Supplies (Other than zero rated, nil rated and exempted)",
        taxableValue: totalTaxable,
        integratedTax: totalIgst,
        centralTax: totalCgst,
        stateUtTax: totalSgst,
        cess: 0,
      },
      {
        tableRef: "3.1(b)",
        description: "Outward Taxable Supplies (Zero rated)",
        taxableValue: 0,
        integratedTax: 0,
        centralTax: 0,
        stateUtTax: 0,
        cess: 0,
      },
      {
        tableRef: "3.1(c)",
        description: "Other Outward Supplies (Nil rated, exempted)",
        taxableValue: 0,
        integratedTax: 0,
        centralTax: 0,
        stateUtTax: 0,
        cess: 0,
      },
      {
        tableRef: "4.A",
        description: "Eligible Input Tax Credit (ITC Available)",
        taxableValue: round2(eligibleItc.reduce((s, r) => s + r.taxableValue, 0)),
        integratedTax: itcIgst,
        centralTax: itcCgst,
        stateUtTax: itcSgst,
        cess: 0,
      },
      {
        tableRef: "6.1",
        description: "Net Tax Payable (Output Tax − Input Tax Credit)",
        taxableValue: 0,
        integratedTax: round2(totalIgst - itcIgst),
        centralTax: round2(totalCgst - itcCgst),
        stateUtTax: round2(totalSgst - itcSgst),
        cess: 0,
      },
    ];
  }

  // ── 9. Data Quality Validation ─────────────────────────────────────────────

  static runDataQualityChecks(
    invoiceRegister: GstInvoiceRegisterRow[],
    salesRegister: GstSalesRegisterRow[],
    hsnSummary: GstHsnSummary,
  ): GstDataQualityWarning[] {
    const warnings: GstDataQualityWarning[] = [];
    let warnId = 1;

    // Check 0: Delivered orders missing legal statutory invoice (CRITICAL STATUTORY AUDIT)
    const deliveredMissingInvoice = invoiceRegister.filter(i => 
      !i.invoiceNumber && (i.complianceStatus === "PENDING_INVOICE" || i.orderStatus.toLowerCase() === "delivered" || i.orderStatus.toLowerCase() === "completed")
    );
    if (deliveredMissingInvoice.length > 0) {
      warnings.push({
        id: `DQ_${warnId++}`,
        title: "STATUTORY: Delivered Orders Missing Legal Tax Invoice",
        description: `${deliveredMissingInvoice.length} delivered order(s) lack an authoritative statutory invoice number. Under CGST Section 31, tax invoices must be issued at the time of delivery. These orders are flagged as 'PENDING_INVOICE' and strictly excluded from GSTR-1 outward tables (Tables 4 & 7) to prevent filing incomplete statutory documents.`,
        severity: "HIGH",
        action: "Process affected orders through the durable numbering retry queue to generate legal invoices.",
        status: "OPEN",
      });
    }

    // Check 1: Missing / Unclassified HSN codes — ALWAYS flag (no threshold)
    const missingHsn = salesRegister.filter(r => !r.hsnCode || r.hsnCode === "UNCLASSIFIED");
    if (missingHsn.length > 0) {
      const pct = Math.round((missingHsn.length / salesRegister.length) * 100);
      warnings.push({
        id: `DQ_${warnId++}`,
        title: "STATUTORY: Items Without HSN Classification",
        description: `${missingHsn.length} of ${salesRegister.length} line items (${pct}%) have no HSN code. ` +
          `These are marked 'UNCLASSIFIED' in the export. Statutory GST filings require a valid HSN code for every item. ` +
          `Do NOT use default codes for filing — classify each product in the Product Master.`,
        severity: "HIGH",
        action: "Assign HSN codes in Admin Panel → Products → Tax Classification",
        status: "OPEN",
      });
    }

    // Check 2: Zero-value invoices
    const zeroInvoices = invoiceRegister.filter(i => i.totalValue === 0);
    if (zeroInvoices.length > 0) {
      warnings.push({
        id: `DQ_${warnId++}`,
        title: "Zero-Value Invoices Detected",
        description: `${zeroInvoices.length} invoice(s) have total value = ₹0.00. These may be test orders or data anomalies.`,
        severity: "HIGH",
        action: "Review and classify as test orders if appropriate",
        status: "OPEN",
      });
    }

    // Check 3: B2B invoices without customer GSTIN
    const b2bMissingGstin = invoiceRegister.filter(i => i.customerType === "B2B" && !i.customerGstin);
    if (b2bMissingGstin.length > 0) {
      warnings.push({
        id: `DQ_${warnId++}`,
        title: "B2B Invoices Missing Customer GSTIN",
        description: `${b2bMissingGstin.length} B2B invoice(s) lack customer GSTIN. These cannot be uploaded to GSTR-1 Table 4A/4B.`,
        severity: "HIGH",
        action: "Update customer GSTIN in customer master",
        status: "OPEN",
      });
    }

    // Check 4: Tax amount reconciliation
    const regTaxTotal = round2(salesRegister.reduce((s, r) => s + r.totalTax, 0));
    const invTaxTotal = round2(invoiceRegister.reduce((s, i) => s + i.totalTax, 0));
    const taxDiff = round2(Math.abs(regTaxTotal - invTaxTotal));
    if (taxDiff > 1.0 && invoiceRegister.length > 0) {
      warnings.push({
        id: `DQ_${warnId++}`,
        title: "Tax Amount Reconciliation Difference",
        description: `Line-item tax total (₹${regTaxTotal.toFixed(2)}) differs from invoice-level tax total (₹${invTaxTotal.toFixed(2)}) by ₹${taxDiff.toFixed(2)}.`,
        severity: "MEDIUM",
        action: "Review discount allocation and rounding across line items",
        status: "OPEN",
      });
    }

    // Check 5: Seller GSTIN configured
    if (!hsnSummary.sellerGstin) {
      warnings.push({
        id: `DQ_${warnId++}`,
        title: "Seller GSTIN Not Configured",
        description: "No active GST registration found in the system. GSTR-1 and GSTR-3B exports will not include the filing GSTIN.",
        severity: "HIGH",
        action: "Configure GST Registration in Admin Panel → Company → GST Settings",
        status: "OPEN",
      });
    }

    if (warnings.length === 0) {
      warnings.push({
        id: "AUDIT_OK",
        title: "All Validations Passed",
        description: "No data quality issues found across invoices, HSN codes, and tax calculations.",
        severity: "LOW",
        action: "None",
        status: "PASS",
      });
    }

    return warnings;
  }

  // ── 10. Complete GST Report Payload ────────────────────────────────────────

  static async generateFullReport(filters: GstReportFilters): Promise<GstReportPayload> {
    const gstInfo = await this.resolveFilingIdentity(filters);

    // Configure ExcelExportService identity
    if (gstInfo.tradeName || gstInfo.legalName) {
      setExportBusinessIdentity(
        `${gstInfo.tradeName || gstInfo.legalName} (${gstInfo.legalName || ""})`.trim(),
        gstInfo.gstin || undefined,
      );
    }

    // Parallel data fetching from PostgreSQL
    const [
      kpis,
      invoiceRegister,
      salesRegister,
      creditNotes,
      hsnSummary,
      inputTaxCredit,
      metrics,
    ] = await Promise.all([
      ReportService.getKpis(filters),
      this.getInvoiceRegister(filters),
      this.getSalesRegister(filters),
      this.getCreditNotes(filters),
      ReportRepository.getGstHsnSummary(filters),
      this.getInputTaxCredit(filters),
      ReportRepository.getTransactionalMetrics(filters),
    ]);

    // Override HSN summary seller info
    hsnSummary.sellerGstin = gstInfo.gstin;
    hsnSummary.sellerLegalName = gstInfo.legalName;
    hsnSummary.sellerTradeName = gstInfo.tradeName;

    // Derived computations (pure, deterministic)
    const taxRateSlabs = this.buildTaxRateSlabs(salesRegister);
    const gstr1Summary = this.buildGstr1Summary(invoiceRegister, creditNotes, hsnSummary);
    const gstr3bSummary = this.buildGstr3bSummary(salesRegister, inputTaxCredit);
    const dataQualityWarnings = this.runDataQualityChecks(invoiceRegister, salesRegister, hsnSummary);

    return {
      filters,
      generatedAt: new Date().toISOString(),
      filingGstin: gstInfo.gstin,
      legalName: gstInfo.legalName,
      tradeName: gstInfo.tradeName,
      kpis,
      invoiceRegister,
      salesRegister,
      creditNotes,
      hsnSummary,
      taxRateSlabs,
      gstr1Summary,
      gstr3bSummary,
      inputTaxCredit,
      dataQualityWarnings,
      metrics,
      disclaimers: [
        "GSTR-1 and GSTR-3B sections are MANAGEMENT REPORTS for internal review only. They are NOT portal-upload compatible files. Filing requires the official GST Portal (gst.gov.in) or certified GSP software.",
        "Credit notes are sourced exclusively from persisted refund records (order_lifecycle_refund, refund tables). Orders cancelled without a persisted refund document are not included.",
        "Items marked 'UNCLASSIFIED' in the HSN column have no product-level HSN classification. Statutory GST filings require a valid HSN code for every item — do not file with unclassified items.",
        "Input Tax Credit (ITC) amounts are derived from approved expense records only. Verify supplier invoices, eligibility conditions, and reversals independently before claiming ITC.",
      ],
    };
  }

  // ── 11. Excel Export — Complete 11-Sheet Workbook ───────────────────────────

  static async exportCompleteWorkbook(filters: GstReportFilters): Promise<Buffer> {
    const payload = await this.generateFullReport(filters);

    // Map payload to the format expected by ExcelExportService
    const excelData = {
      filters: {
        customStartDate: filters.startDate,
        customEndDate: filters.endDate,
        branchIds: filters.branchIds,
        city: filters.city,
      },
      kpis: payload.kpis,
      invoiceRegister: payload.invoiceRegister.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        orderNumber: inv.orderNumber,
        customerName: inv.customerName,
        customerGstin: inv.customerGstin || "URP",
        branchName: inv.branchName,
        placeOfSupply: inv.placeOfSupply,
        taxableAmount: inv.taxableAmount,
        cgst: inv.cgst,
        sgst: inv.sgst,
        igst: inv.igst,
        totalValue: inv.totalValue,
      })),
      salesRegister: payload.salesRegister,
      creditNotes: payload.creditNotes,
      hsnSummary: payload.hsnSummary.items,
      dataQualityWarnings: payload.dataQualityWarnings,
    };

    const buffer = await ExcelExportService.generateGstWorkbookXlsx(excelData);
    return Buffer.from(buffer);
  }

  // ── 12. Single-Sheet Excel Exports ─────────────────────────────────────────

  static async exportSingleReport(
    filters: GstReportFilters,
    reportType: GstReportType,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const payload = await this.generateFullReport(filters);
    const excelData = {
      filters: {
        customStartDate: filters.startDate,
        customEndDate: filters.endDate,
        branchIds: filters.branchIds,
        city: filters.city,
      },
      kpis: payload.kpis,
      invoiceRegister: payload.invoiceRegister.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        orderNumber: inv.orderNumber,
        customerName: inv.customerName,
        customerGstin: inv.customerGstin || "URP",
        branchName: inv.branchName,
        placeOfSupply: inv.placeOfSupply,
        taxableAmount: inv.taxableAmount,
        cgst: inv.cgst,
        sgst: inv.sgst,
        igst: inv.igst,
        totalValue: inv.totalValue,
      })),
      salesRegister: payload.salesRegister,
      creditNotes: payload.creditNotes,
      hsnSummary: payload.hsnSummary.items,
      dataQualityWarnings: payload.dataQualityWarnings,
    };

    let buffer: ArrayBuffer;
    let filename: string;

    switch (reportType) {
      case "SUMMARY":
        buffer = await ExcelExportService.exportGstSummary(excelData);
        filename = `CakeToHome_GST_Summary_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "INVOICE_REGISTER":
        buffer = await ExcelExportService.exportInvoiceRegister(excelData);
        filename = `CakeToHome_Invoice_Register_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "SALES_REGISTER":
        buffer = await ExcelExportService.exportGstTransactions(excelData);
        filename = `CakeToHome_GST_Sales_Register_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "B2B":
        buffer = await ExcelExportService.exportB2B(excelData);
        filename = `CakeToHome_B2B_Sales_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "B2C":
        buffer = await ExcelExportService.exportB2C(excelData);
        filename = `CakeToHome_B2C_Sales_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "CREDIT_NOTES":
        buffer = await ExcelExportService.exportCreditNotes(excelData);
        filename = `CakeToHome_Credit_Notes_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "HSN_SUMMARY":
        buffer = await ExcelExportService.exportHsnSummary(excelData);
        filename = `CakeToHome_HSN_Summary_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "TAX_SUMMARY":
        buffer = await ExcelExportService.exportTaxSummary(excelData);
        filename = `CakeToHome_Tax_Rate_Summary_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "GSTR1":
        buffer = await ExcelExportService.exportGstr1(excelData);
        filename = `CakeToHome_GSTR1_Draft_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "GSTR3B":
        buffer = await ExcelExportService.exportGstr3b(excelData);
        filename = `CakeToHome_GSTR3B_Draft_${filters.startDate}_to_${filters.endDate}`;
        break;
      case "VALIDATION":
        buffer = await ExcelExportService.exportValidationErrors(excelData);
        filename = `CakeToHome_Validation_Audit_${filters.startDate}_to_${filters.endDate}`;
        break;
      default:
        buffer = await ExcelExportService.generateGstWorkbookXlsx(excelData);
        filename = `CakeToHome_GST_Complete_Workbook_${filters.startDate}_to_${filters.endDate}`;
        break;
    }

    return { buffer: Buffer.from(buffer), filename };
  }

  // ── 13. CSV Export (for simplified data interchange) ────────────────────────

  static async exportCsv(
    filters: GstReportFilters,
    reportType: GstReportType,
  ): Promise<{ csv: string; filename: string }> {
    const payload = await this.generateFullReport(filters);

    let csvContent: string;
    let filename: string;

    switch (reportType) {
      case "INVOICE_REGISTER": {
        const headers = [
          "Invoice No", "Date", "Order No", "Customer", "GSTIN", "Type",
          "Branch", "Place of Supply", "Taxable Amt", "CGST", "SGST", "IGST", "Total", "Compliance Status",
        ];
        const rows = payload.invoiceRegister.map(inv => [
          inv.invoiceNumber || "PENDING_INVOICE", inv.invoiceDate, inv.orderNumber, inv.customerName,
          inv.customerGstin || "URP", inv.customerType, inv.branchName, inv.placeOfSupply,
          inv.taxableAmount.toFixed(2), inv.cgst.toFixed(2), inv.sgst.toFixed(2),
          inv.igst.toFixed(2), inv.totalValue.toFixed(2), inv.complianceStatus,
        ]);
        csvContent = [headers.join(","), ...rows.map(r => this.csvRow(r))].join("\n");
        filename = `CakeToHome_Invoice_Register_${filters.startDate}_to_${filters.endDate}`;
        break;
      }
      case "HSN_SUMMARY": {
        const headers = [
          "HSN Code", "Description", "UQC", "Qty", "Taxable Value",
          "GST %", "CGST", "SGST", "IGST", "Total Tax", "Total Value",
        ];
        const rows = payload.hsnSummary.items.map(h => [
          h.hsnCode, h.description, h.uom, h.quantity.toString(),
          h.taxableValue.toFixed(2), h.gstRatePct.toString(),
          h.cgst.toFixed(2), h.sgst.toFixed(2), h.igst.toFixed(2),
          h.totalTax.toFixed(2), h.totalValue.toFixed(2),
        ]);
        csvContent = [headers.join(","), ...rows.map(r => this.csvRow(r))].join("\n");
        filename = `CakeToHome_HSN_Summary_${filters.startDate}_to_${filters.endDate}`;
        break;
      }
      case "INPUT_TAX": {
        const headers = [
          "Expense ID", "Date", "Vendor", "Vendor GSTIN", "Category",
          "HSN/SAC", "Description", "Taxable", "CGST", "SGST", "IGST",
          "Total Tax", "ITC Eligibility", "RCM", "Invoice No",
        ];
        const rows = payload.inputTaxCredit.map(itc => [
          itc.expenseId, itc.expenseDate, itc.vendorName, itc.vendorGstin || "",
          itc.category, itc.hsnSacCode, itc.description,
          itc.taxableValue.toFixed(2), itc.cgst.toFixed(2), itc.sgst.toFixed(2),
          itc.igst.toFixed(2), itc.totalTax.toFixed(2),
          itc.itcEligibility, itc.rcmApplicable ? "Yes" : "No",
          itc.invoiceNumber || "",
        ]);
        csvContent = [headers.join(","), ...rows.map(r => this.csvRow(r))].join("\n");
        filename = `CakeToHome_Input_Tax_Credit_${filters.startDate}_to_${filters.endDate}`;
        break;
      }
      default: {
        // Default: sales register CSV
        const headers = [
          "Invoice Date", "Invoice No", "Order No", "Customer", "GSTIN", "Type",
          "Product", "HSN", "Qty", "Unit Price", "Taxable", "GST %",
          "CGST", "SGST", "IGST", "Total Tax", "Total Value", "Compliance Status",
        ];
        const rows = payload.salesRegister.map(s => [
          s.invoiceDate, s.invoiceNumber || "PENDING_INVOICE", s.orderNumber, s.customerName,
          s.customerGstin || "URP", s.customerType, s.productName, s.hsnCode,
          s.quantity.toString(), s.unitPrice.toFixed(2), s.taxableValue.toFixed(2),
          s.gstRatePct.toString(), s.cgst.toFixed(2), s.sgst.toFixed(2),
          s.igst.toFixed(2), s.totalTax.toFixed(2), s.totalValue.toFixed(2), s.complianceStatus,
        ]);
        csvContent = [headers.join(","), ...rows.map(r => this.csvRow(r))].join("\n");
        filename = `CakeToHome_GST_Sales_Register_${filters.startDate}_to_${filters.endDate}`;
        break;
      }
    }

    return { csv: csvContent, filename };
  }

  // ── Internal Helpers ───────────────────────────────────────────────────────

  private static buildGstDateFilter(filters: GstReportFilters): { startDate: string; endDate: string } {
    return {
      startDate: filters.startDate,
      endDate: filters.endDate,
    };
  }

  /**
   * Sanitize a cell value for CSV output to prevent formula injection.
   * - Escapes embedded double-quotes per RFC 4180 (replace " with "")
   * - Prefixes values starting with =, +, -, @, \t, \r with a single quote
   *   to prevent formula execution when opened in Excel or Google Sheets.
   */
  private static sanitizeCsvCell(value: string): string {
    if (!value || typeof value !== "string") return value || "";
    // Escape embedded double-quotes
    let safe = value.replace(/"/g, '""');
    // Prefix formula-triggering characters
    if (/^[=+\-@\t\r]/.test(safe)) {
      safe = "'" + safe;
    }
    return safe;
  }

  /** Build a CSV row with sanitized values wrapped in double-quotes */
  private static csvRow(values: (string | null | undefined)[]): string {
    return values.map(v => `"${this.sanitizeCsvCell(v || "")}"`).join(",");
  }
}
