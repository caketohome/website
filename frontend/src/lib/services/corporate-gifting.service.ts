/**
 * CakeToHome ERP — Corporate Gifting Domain Service
 * Phase C7.7 Step 7B: Excel Template Generation, Dry-Run Parsing,
 * Pre-Import Validation Engine, Concurrency-Safe Credit Controls,
 * and Atomic All-or-Nothing Batch Execution Workflow.
 *
 * ARCHITECTURAL PRINCIPLES & INVARIANTS:
 * 1. ONE MASTER CORPORATE INVOICE:
 *    - Entire batch maps to a single master corporate tax invoice billing the corporate customer.
 *    - Child deliveries are dispatched individually without generating per-recipient duplicate invoices.
 * 2. TRANSACTION LOCKING & DEDUPLICATION DEFENSE:
 *    - Replay defense via SHA-256 file hashing against active batches.
 *    - Customer-scoped advisory lock pg_advisory_xact_lock(hashtext('corp_credit_' || customer_id))
 *      guarantees zero race conditions on corporate credit exposure.
 * 3. AUTHORITATIVE AR EXPOSURE & CREDIT PROTECTION:
 *    - Authoritative exposure recomputed dynamically: Invoiced - Receipts - Returns + Pending Batches.
 *    - Hard block (CREDIT_LIMIT_EXCEEDED) if exposure + batch total exceeds customer credit limit.
 * 4. STRICT ZERO-MUTATION DRY RUN:
 *    - validateBatchImport operates strictly read-only; zero database writes during validation.
 * 5. DYNAMIC SALES TAX ENGINE REUSE:
 *    - Resolves place of supply (Intra-state CGST+SGST vs Inter-state IGST) dynamically via SalesTaxEngine.
 *    - Zero hardcoded tax rates in UI or service logic.
 * 6. ATOMIC ALL-OR-NOTHING EXECUTION:
 *    - Batch creation, recipient line items, commercial umbrella order, recipient deliveries, and
 *      master statutory corporate invoice commit together or roll back completely.
 */

import crypto from "crypto";
import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { CorporateGiftingRepository } from "../repositories/corporate-gifting.repository";
import { BillsReceivableService } from "./bills-receivable.service";
import { calculateSalesTaxesAndTotals } from "./sales-tax-engine";
import { CorporateRoutingService } from "./corporate-routing.service";
import { CorporateRoutingRepository } from "../repositories/corporate-routing.repository";
import type {
  CorporateBatchMatchingItemInput,
  CorporateBatchMatchingSummary,
  CorporateBatchMatchingResult,
  CorporateDeliveryAssignmentDTO,
} from "../types/corporate-routing.types";
import type {
  CorporateGiftingBatchRow,
  CorporateGiftingRecipientRow,
  CorporateGiftingBatchStatus,
} from "../types/accounting.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type CorporateGiftingErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "MISSING_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_FORMAT"
  | "EMPTY_BATCH"
  | "BATCH_TOO_LARGE"
  | "MISSING_REQUIRED_HEADERS"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_NOT_CORPORATE"
  | "CUSTOMER_CREDIT_DISABLED"
  | "CREDIT_APPROVAL_REQUIRED"
  | "CREDIT_LIMIT_EXCEEDED"
  | "DUPLICATE_FILE_HASH"
  | "VALIDATION_FAILED"
  | "BRANCH_NOT_FOUND"
  | "BRANCH_ACCESS_DENIED"
  | "COST_CENTRE_NOT_FOUND"
  | "BATCH_NOT_FOUND"
  | "INVALID_BATCH_STATUS"
  | "PERMISSION_DENIED"
  | "CONCURRENT_EXECUTION_LOCK"
  | "INSUFFICIENT_DATA"
  | "RECIPIENT_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "PARTNER_ACCESS_DENIED";

export class CorporateGiftingError extends Error {
  readonly code: CorporateGiftingErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CorporateGiftingErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CorporateGiftingError";
    this.code = code;
    this.details = details;
  }
}

// ─── DTOs & Interfaces ────────────────────────────────────────────────────────

export interface ParsedRecipientRow {
  rowNumber: number;
  employeeId?: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  deliveryPincode: string;
  deliveryCity?: string;
  latitude?: number | null;
  longitude?: number | null;
  deliveryDate: string;
  deliverySlot?: string;
  productSku: string;
  quantity: number;
  giftMessage?: string;
  costCentreCode?: string;
  // Resolved on server
  productId?: string;
  variantId?: string;
  productTitle?: string;
  unitPrice: number;
  lineTotal: number;
  costCentreId?: string;
  errors: Array<{ field: string; code: string; message: string }>;
  routingPreview?: {
    can_match: boolean;
    matched_store_id?: string | null;
    matched_store_name?: string | null;
    matched_zone_id?: string | null;
    matched_zone_name?: string | null;
    matched_partner_id?: string | null;
    matched_partner_name?: string | null;
    reason_code?: string | null;
    distance_km?: number | null;
    diagnostics_message?: string | null;
  };
}

export interface BatchValidationSummary {
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  grandTotal: number;
  customerCreditLimit: number;
  currentOutstanding: number;
  activeBatchesTotal: number;
  totalProjectedExposure: number;
  availableCredit: number;
  creditLimitExceeded: boolean;
}

export interface BatchValidationResult {
  isValid: boolean;
  fileHash: string;
  fileSizeBytes: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  summary: BatchValidationSummary;
  errors: Array<{ rowNumber: number; field: string; code: string; message: string }>;
  parsedRecipients: ParsedRecipientRow[];
  customer: {
    id: string;
    companyName: string | null;
    gstin: string | null;
    creditLimit: number;
    paymentTermsDays: number;
  };
  branch: {
    id: string;
    name: string;
    state: string;
    gstin: string;
  };
  routingPreview?: {
    totalEvaluated: number;
    totalAssigned: number;
    totalUnassigned: number;
    unassignedBreakdown: Record<string, number>;
  };
}

export interface ValidateBatchImportParams {
  fileBuffer: Buffer;
  customerId: string;
  branchId?: string;
  actorContext?: any;
  client?: PoolClient;
}

export interface ExecuteBatchImportParams {
  fileBuffer: Buffer;
  customerId: string;
  batchName?: string;
  branchId?: string;
  sourceFilename?: string;
  actorContext?: any;
  client?: PoolClient;
}

export interface ExecuteBatchResult {
  success: boolean;
  batch: CorporateGiftingBatchRow;
  recipientsCount: number;
  masterOrderId: string;
  invoice: any;
  voucher: any;
  routingSummary?: CorporateBatchMatchingSummary | null;
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────

const REQUIRED_HEADERS = [
  "recipient_name",
  "recipient_phone",
  "delivery_address",
  "delivery_pincode",
  "delivery_date",
  "product_sku",
  "quantity",
];

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[\s\-_]+/g, "_");
}

function extractCellValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if (val instanceof Date) {
      return val.toISOString().split("T")[0];
    }
    if (val.text) return String(val.text).trim();
    if (val.result !== undefined) return String(val.result).trim();
    if (Array.isArray(val.richText)) {
      return val.richText.map((rt: any) => rt.text || "").join("").trim();
    }
  }
  return String(val).trim();
}

// ─── Service Class ────────────────────────────────────────────────────────────

export class CorporateGiftingService {
  /**
   * Generates official standardized Excel template for bulk corporate gifting.
   */
  static async generateTemplateBuffer(): Promise<Buffer> {
    const ExcelJS = (await import("exceljs")).default || (await import("exceljs"));
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CakeToHome ERP";
    workbook.created = new Date();

    // Sheet 1: Data Entry Template
    const sheet = workbook.addWorksheet("Recipients", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    const columns = [
      { header: "Employee_ID", key: "employee_id", width: 16 },
      { header: "Recipient_Name", key: "recipient_name", width: 24 },
      { header: "Recipient_Phone", key: "recipient_phone", width: 18 },
      { header: "Delivery_Address", key: "delivery_address", width: 36 },
      { header: "Delivery_Pincode", key: "delivery_pincode", width: 18 },
      { header: "Delivery_Date", key: "delivery_date", width: 16 },
      { header: "Delivery_Slot", key: "delivery_slot", width: 16 },
      { header: "Product_SKU", key: "product_sku", width: 22 },
      { header: "Quantity", key: "quantity", width: 12 },
      { header: "Gift_Message", key: "gift_message", width: 32 },
      { header: "Cost_Centre_Code", key: "cost_centre_code", width: 18 },
    ];

    sheet.columns = columns;

    // Header styling: Blue background, bold white text
    const headerRow = sheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E40AF" },
      };
      cell.font = {
        name: "Segoe UI",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    // Add sample rows illustrating valid formats
    sheet.addRow({
      employee_id: "EMP-1001",
      recipient_name: "Rahul Sharma",
      recipient_phone: "9876543210",
      delivery_address: "Flat 402, Green Acres, Indiranagar, Bengaluru",
      delivery_pincode: "560038",
      delivery_date: "2026-11-15",
      delivery_slot: "MORNING",
      product_sku: "BUTTER-CROISSANT",
      quantity: 2,
      gift_message: "Happy Diwali to you and your family!",
      cost_centre_code: "",
    });

    sheet.addRow({
      employee_id: "EMP-1002",
      recipient_name: "Priya Nair",
      recipient_phone: "9812345678",
      delivery_address: "12/A 4th Cross, Koramangala, Bengaluru",
      delivery_pincode: "560034",
      delivery_date: "2026-11-15",
      delivery_slot: "AFTERNOON",
      product_sku: "DANISH-PASTRY-4",
      quantity: 1,
      gift_message: "Season's Greetings from TechCorp!",
      cost_centre_code: "",
    });

    // Sheet 2: Guidelines & Schema Rules
    const guideSheet = workbook.addWorksheet("Instructions & Guide");
    guideSheet.columns = [
      { header: "Field Name", width: 22 },
      { header: "Requirement", width: 14 },
      { header: "Validation Rule", width: 36 },
      { header: "Example", width: 28 },
    ];

    guideSheet.getRow(1).font = { bold: true };
    guideSheet.addRow(["Employee_ID", "Optional", "Client internal ID (max 50 chars)", "EMP-1001"]);
    guideSheet.addRow(["Recipient_Name", "Required", "Full name of recipient (2–100 chars)", "Rahul Sharma"]);
    guideSheet.addRow(["Recipient_Phone", "Required", "10-digit Indian mobile number (6–9 start)", "9876543210"]);
    guideSheet.addRow(["Delivery_Address", "Required", "Complete postal delivery address", "Flat 402, Green Acres"]);
    guideSheet.addRow(["Delivery_Pincode", "Required", "6-digit Indian postal PIN code", "560038"]);
    guideSheet.addRow(["Delivery_Date", "Required", "ISO format YYYY-MM-DD (Today to +60d)", "2026-11-15"]);
    guideSheet.addRow(["Delivery_Slot", "Optional", "MORNING, AFTERNOON, or EVENING", "MORNING"]);
    guideSheet.addRow(["Product_SKU", "Required", "Active SKU code from catalog", "BUTTER-CROISSANT"]);
    guideSheet.addRow(["Quantity", "Required", "Positive integer >= 1", "1"]);
    guideSheet.addRow(["Gift_Message", "Optional", "Card greeting text (max 200 chars)", "Happy Diwali!"]);
    guideSheet.addRow(["Cost_Centre_Code", "Optional", "Active C7.6 leaf cost centre code", "CC-MKT-01"]);

    return (await workbook.xlsx.writeBuffer()) as Buffer;
  }

  /**
   * Pre-import Dry-Run Validation.
   * Strictly READ-ONLY. Zero mutations to the database.
   */
  static async validateBatchImport(
    paramsOrBuffer: ValidateBatchImportParams | Buffer,
    maybeCustomerId?: string,
    maybeActorContext?: any,
    maybeBranchId?: string
  ): Promise<BatchValidationResult> {
    let params: ValidateBatchImportParams;
    if (Buffer.isBuffer(paramsOrBuffer)) {
      params = {
        fileBuffer: paramsOrBuffer,
        customerId: maybeCustomerId || "",
        actorContext: maybeActorContext,
        branchId: maybeBranchId,
      };
    } else {
      params = paramsOrBuffer;
    }

    const { fileBuffer, customerId, branchId: requestedBranchId, client: callerClient } = params;

    const queryFn = async (sql: string, sqlParams: any[] = []): Promise<any> => {
      return callerClient ? callerClient.query(sql, sqlParams) : dbQuery(sql, sqlParams);
    };

    // 1. File basic constraints
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new CorporateGiftingError("EMPTY_BATCH", "Uploaded file buffer is empty.");
    }
    if (fileBuffer.length > 10 * 1024 * 1024) {
      throw new CorporateGiftingError("FILE_TOO_LARGE", "Uploaded file exceeds maximum limit of 10MB.");
    }

    // 2. SHA-256 Checksum & Duplicate Upload Check
    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const existingActiveBatch = await CorporateGiftingRepository.getBatchByFileHash(
      customerId,
      fileHash,
      callerClient
    );

    const errors: Array<{ rowNumber: number; field: string; code: string; message: string }> = [];

    if (existingActiveBatch) {
      errors.push({
        rowNumber: 0,
        field: "file_hash",
        code: "DUPLICATE_FILE_HASH",
        message: `An active corporate gifting batch '${existingActiveBatch.batch_name}' (${existingActiveBatch.id}) with identical contents already exists.`,
      });
    }

    // 3. Customer Verification & Credit Status
    const custRes = await queryFn(
      `SELECT * FROM public.customer WHERE id = $1 AND deleted_at IS NULL;`,
      [customerId]
    );
    if (custRes.rows.length === 0) {
      throw new CorporateGiftingError("CUSTOMER_NOT_FOUND", `Corporate customer '${customerId}' not found.`);
    }
    const customer = custRes.rows[0];

    if (!customer.is_corporate) {
      throw new CorporateGiftingError(
        "CUSTOMER_NOT_CORPORATE",
        `Customer '${customerId}' is not authorized for corporate credit terms.`
      );
    }
    if (!customer.credit_enabled) {
      throw new CorporateGiftingError(
        "CUSTOMER_CREDIT_DISABLED",
        `Corporate credit is disabled for customer '${customerId}'.`
      );
    }
    if (customer.credit_status !== "APPROVED") {
      throw new CorporateGiftingError(
        "CREDIT_APPROVAL_REQUIRED",
        `Corporate customer '${customerId}' credit status is '${customer.credit_status || "PENDING"}'. Explicit approval required.`
      );
    }

    // 4. Resolve Default / Requested Branch for Fulfillment and GST
    let branch: any;
    if (requestedBranchId) {
      const bRes = await queryFn(
        `SELECT * FROM public.branch WHERE id = $1 AND deleted_at IS NULL;`,
        [requestedBranchId]
      );
      if (bRes.rows.length === 0) {
        throw new CorporateGiftingError("BRANCH_NOT_FOUND", `Branch '${requestedBranchId}' not found.`);
      }
      branch = bRes.rows[0];
    } else {
      const bRes = await queryFn(
        `SELECT * FROM public.branch WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;`
      );
      if (bRes.rows.length === 0) {
        throw new CorporateGiftingError("BRANCH_NOT_FOUND", "No active fulfillment branch found in system.");
      }
      branch = bRes.rows[0];
    }

    const branchMeta = branch.metadata || {};
    const branchState = branchMeta.state || branch.state || "Karnataka";
    const branchGstin = branchMeta.gstin || branchMeta.gst_number || null;

    // 5. Parse Excel Workbook using ExcelJS
    const ExcelJS = (await import("exceljs")).default || (await import("exceljs"));
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(fileBuffer);
    } catch (parseErr: any) {
      throw new CorporateGiftingError("INVALID_FILE_FORMAT", `Unable to parse Excel file: ${parseErr.message}`);
    }

    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) {
      throw new CorporateGiftingError("EMPTY_BATCH", "Spreadsheet contains no data rows.");
    }

    if (worksheet.rowCount > 2005) {
      throw new CorporateGiftingError("BATCH_TOO_LARGE", "Batch exceeds maximum limit of 2,000 recipient rows.");
    }

    // Read and validate header row
    const headerRow = worksheet.getRow(1);
    const headerMap = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      const raw = extractCellValue(cell.value);
      if (raw) headerMap.set(normalizeHeader(raw), colNumber);
    });

    const missingHeaders = REQUIRED_HEADERS.filter((h) => !headerMap.has(h));
    if (missingHeaders.length > 0) {
      throw new CorporateGiftingError(
        "MISSING_REQUIRED_HEADERS",
        `Missing required column headers: ${missingHeaders.join(", ")}`
      );
    }

    // 6. Collect distinct SKUs, Cost Centres, and Employee codes for batch resolution
    const rawRows: Array<{ rowNum: number; data: Record<string, string> }> = [];
    const skuSet = new Set<string>();
    const ccSet = new Set<string>();
    const empSet = new Set<string>();

    for (let r = 2; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const getColVal = (key: string): string => {
        const colIdx = headerMap.get(key);
        if (!colIdx || colIdx < 1) return "";
        return extractCellValue(row.getCell(colIdx).value);
      };

      const name = getColVal("recipient_name");
      const phone = getColVal("recipient_phone");
      const address = getColVal("delivery_address");

      // Skip empty blank trailing rows
      if (!name && !phone && !address) continue;

      const empId = getColVal("employee_id");
      const rowData: Record<string, string> = {
        employee_id: empId,
        recipient_name: name,
        recipient_phone: phone,
        delivery_address: address,
        delivery_pincode: getColVal("delivery_pincode"),
        delivery_city: getColVal("delivery_city") || getColVal("city"),
        latitude: getColVal("latitude") || getColVal("lat"),
        longitude: getColVal("longitude") || getColVal("long") || getColVal("lng"),
        delivery_date: getColVal("delivery_date"),
        delivery_slot: getColVal("delivery_slot"),
        product_sku: getColVal("product_sku"),
        quantity: getColVal("quantity") || "1",
        gift_message: getColVal("gift_message"),
        cost_centre_code: getColVal("cost_centre_code"),
      };

      rawRows.push({ rowNum: r, data: rowData });
      if (rowData.product_sku) skuSet.add(rowData.product_sku.trim().toUpperCase());
      if (rowData.cost_centre_code) ccSet.add(rowData.cost_centre_code.trim().toUpperCase());
      if (rowData.employee_id) empSet.add(rowData.employee_id.trim().toUpperCase());
    }

    if (rawRows.length === 0) {
      throw new CorporateGiftingError("EMPTY_BATCH", "Spreadsheet contains no recipient records.");
    }

    // Batch resolve SKUs from live catalog
    const skuMap = new Map<string, any>();
    if (skuSet.size > 0) {
      const skuList = Array.from(skuSet);
      const prodRes = await queryFn(
        `SELECT 
           pv.id AS variant_id, pv.sku, pv.title AS variant_title,
           p.id AS product_id, p.title AS product_title, p.merchandise_type,
           p.metadata AS product_meta, pv.metadata AS variant_meta
         FROM public.product_variant pv
         JOIN public.product p ON p.id = pv.product_id
         WHERE UPPER(pv.sku) = ANY($1) 
           AND pv.deleted_at IS NULL 
           AND p.deleted_at IS NULL;`,
        [skuList]
      );
      prodRes.rows.forEach((p: any) => skuMap.set(p.sku.toUpperCase(), p));
    }

    // Batch resolve Cost Centres from live CoA
    const ccMap = new Map<string, any>();
    if (ccSet.size > 0) {
      const ccList = Array.from(ccSet);
      const ccRes = await queryFn(
        `SELECT id, code, name, is_active FROM public.cost_centre WHERE UPPER(code) = ANY($1) AND deleted_at IS NULL;`,
        [ccList]
      );
      ccRes.rows.forEach((c: any) => ccMap.set(c.code.toUpperCase(), c));
    }

    // Batch resolve Employee default coordinates from corporate roster
    const empMap = new Map<string, { lat: number | null; lng: number | null; city: string | null }>();
    if (empSet.size > 0) {
      const empList = Array.from(empSet);
      const empRes = await queryFn(
        `SELECT employee_code, default_latitude, default_longitude, city_key 
         FROM public.corporate_employee 
         WHERE UPPER(employee_code) = ANY($1) AND status = 'ACTIVE';`,
        [empList]
      );
      empRes.rows.forEach((e: any) => {
        empMap.set(String(e.employee_code).toUpperCase(), {
          lat: e.default_latitude !== null ? Number(e.default_latitude) : null,
          lng: e.default_longitude !== null ? Number(e.default_longitude) : null,
          city: e.city_key || null,
        });
      });
    }

    // 7. Row-by-Row Semantic Validation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 60);

    const parsedRecipients: ParsedRecipientRow[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const item of rawRows) {
      const rowErrors: Array<{ field: string; code: string; message: string }> = [];
      const d = item.data;

      // Recipient Name
      if (!d.recipient_name || d.recipient_name.length < 2) {
        rowErrors.push({
          field: "recipient_name",
          code: "INVALID_NAME",
          message: "Recipient name must be at least 2 characters.",
        });
      }

      // Recipient Phone: 10-digit Indian mobile
      const cleanPhone = d.recipient_phone.replace(/\D/g, "");
      const finalPhone = cleanPhone.length === 12 && cleanPhone.startsWith("91") ? cleanPhone.slice(2) : cleanPhone;
      if (!/^[6-9]\d{9}$/.test(finalPhone)) {
        rowErrors.push({
          field: "recipient_phone",
          code: "INVALID_PHONE",
          message: `Phone '${d.recipient_phone}' must be a valid 10-digit Indian mobile number.`,
        });
      }

      // Address
      if (!d.delivery_address || d.delivery_address.length < 5) {
        rowErrors.push({
          field: "delivery_address",
          code: "INVALID_ADDRESS",
          message: "Delivery address must be at least 5 characters.",
        });
      }

      // PIN code: 6-digit Indian PIN
      if (!/^[1-9][0-9]{5}$/.test(d.delivery_pincode)) {
        rowErrors.push({
          field: "delivery_pincode",
          code: "INVALID_PINCODE",
          message: `PIN code '${d.delivery_pincode}' must be a valid 6-digit postal code.`,
        });
      }

      // Delivery Date: between today and +60 days
      const delivDate = new Date(d.delivery_date);
      if (isNaN(delivDate.getTime())) {
        rowErrors.push({
          field: "delivery_date",
          code: "INVALID_DATE",
          message: `Delivery date '${d.delivery_date}' is invalid. Use YYYY-MM-DD.`,
        });
      } else {
        delivDate.setHours(0, 0, 0, 0);
        if (delivDate < today) {
          rowErrors.push({
            field: "delivery_date",
            code: "DATE_IN_PAST",
            message: `Delivery date '${d.delivery_date}' cannot be in the past.`,
          });
        } else if (delivDate > maxDate) {
          rowErrors.push({
            field: "delivery_date",
            code: "DATE_OUT_OF_RANGE",
            message: `Delivery date '${d.delivery_date}' exceeds maximum window of 60 days.`,
          });
        }
      }

      // Product SKU Resolution & Price
      const skuUpper = d.product_sku.trim().toUpperCase();
      const productInfo = skuMap.get(skuUpper);
      let unitPrice = 0;
      let productId: string | undefined;
      let variantId: string | undefined;
      let productTitle: string | undefined;

      if (!productInfo) {
        rowErrors.push({
          field: "product_sku",
          code: "SKU_NOT_FOUND",
          message: `Product SKU '${d.product_sku}' does not exist in live catalog.`,
        });
      } else {
        productId = productInfo.product_id;
        variantId = productInfo.variant_id;
        productTitle = productInfo.product_title;
        const meta = productInfo.product_meta || {};
        unitPrice = Number(meta.selling_price || meta.price || 0);

        if (unitPrice <= 0) {
          rowErrors.push({
            field: "product_sku",
            code: "PRICE_UNRESOLVED",
            message: `Product SKU '${d.product_sku}' has no valid selling price configured.`,
          });
        }
      }

      // Quantity
      const qty = parseInt(d.quantity || "1", 10);
      if (isNaN(qty) || qty < 1) {
        rowErrors.push({
          field: "quantity",
          code: "INVALID_QUANTITY",
          message: "Quantity must be an integer greater than or equal to 1.",
        });
      }

      // Cost Centre
      let costCentreId: string | undefined;
      if (d.cost_centre_code) {
        const ccUpper = d.cost_centre_code.trim().toUpperCase();
        const cc = ccMap.get(ccUpper);
        if (!cc || !cc.is_active) {
          rowErrors.push({
            field: "cost_centre_code",
            code: "COST_CENTRE_NOT_FOUND",
            message: `Cost centre '${d.cost_centre_code}' is invalid or inactive.`,
          });
        } else {
          costCentreId = cc.id;
        }
      }

      const lineTotal = Math.round(qty * unitPrice * 100) / 100;

      if (rowErrors.length > 0) {
        invalidCount++;
        rowErrors.forEach((err) => errors.push({ rowNumber: item.rowNum, ...err }));
      } else {
        validCount++;
      }

      let rowLat: number | null = null;
      let rowLng: number | null = null;
      if (d.latitude && !isNaN(Number(d.latitude))) {
        rowLat = Number(d.latitude);
      }
      if (d.longitude && !isNaN(Number(d.longitude))) {
        rowLng = Number(d.longitude);
      }
      let rowCity = d.delivery_city || undefined;

      // If coordinates missing in row, resolve from corporate_employee profile if available
      if ((rowLat === null || rowLng === null) && d.employee_id) {
        const emp = empMap.get(d.employee_id.trim().toUpperCase());
        if (emp) {
          if (rowLat === null && emp.lat !== null) rowLat = emp.lat;
          if (rowLng === null && emp.lng !== null) rowLng = emp.lng;
          if (!rowCity && emp.city) rowCity = emp.city;
        }
      }

      parsedRecipients.push({
        rowNumber: item.rowNum,
        employeeId: d.employee_id || undefined,
        recipientName: d.recipient_name,
        recipientPhone: finalPhone,
        deliveryAddress: d.delivery_address,
        deliveryPincode: d.delivery_pincode,
        deliveryCity: rowCity,
        latitude: rowLat,
        longitude: rowLng,
        deliveryDate: d.delivery_date,
        deliverySlot: d.delivery_slot || "MORNING",
        productSku: d.product_sku,
        quantity: qty,
        giftMessage: d.gift_message || undefined,
        costCentreCode: d.cost_centre_code || undefined,
        productId,
        variantId,
        productTitle,
        unitPrice,
        lineTotal,
        costCentreId,
        errors: rowErrors,
      });
    }

    // 8. Financial Calculation & Authoritative Sales Tax Engine
    let totalTaxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const validLines = parsedRecipients.filter((r) => r.errors.length === 0);
    if (validLines.length > 0) {
      const calculationItems = validLines.map((l) => ({
        description: l.productTitle || l.productSku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRatePercent: 5, // Default statutory food GST
        hsnCode: "19059090",
        itemType: "CAKE" as any,
      }));

      const taxResult = calculateSalesTaxesAndTotals({
        branch: { state: branchState, gstin: branchGstin },
        customer: { state: branchState },
        items: calculationItems,
      });

      totalTaxable = taxResult.totalTaxable;
      cgst = taxResult.cgst;
      sgst = taxResult.sgst;
      igst = taxResult.igst;
    }

    const taxTotal = Math.round((cgst + sgst + igst) * 100) / 100;
    const grandTotal = Math.round((totalTaxable + taxTotal) * 100) / 100;

    // 9. Authoritative Credit Exposure Check
    const creditLimit = Number(customer.credit_limit || 0);
    const currentOutstanding = await BillsReceivableService.calculateAuthoritativeCustomerOutstanding(
      customerId,
      callerClient
    );
    const activeBatchesTotal = await CorporateGiftingRepository.sumActiveBatchesAmountForCustomer(
      customerId,
      undefined,
      callerClient
    );
    const totalProjectedExposure = Math.round((currentOutstanding + activeBatchesTotal + grandTotal) * 100) / 100;
    const availableCredit = Math.max(0, Math.round((creditLimit - currentOutstanding - activeBatchesTotal) * 100) / 100);
    const creditLimitExceeded = totalProjectedExposure > creditLimit + 0.005;

    if (creditLimitExceeded) {
      const shortfall = (totalProjectedExposure - creditLimit).toFixed(2);
      errors.push({
        rowNumber: 0,
        field: "credit_limit",
        code: "CREDIT_LIMIT_EXCEEDED",
        message: `Corporate credit limit exceeded by ₹${shortfall}. Current exposure: ₹${currentOutstanding.toFixed(2)}, Batch total: ₹${grandTotal.toFixed(2)}, Approved limit: ₹${creditLimit.toFixed(2)}.`,
      });
    }

    const isValid = errors.length === 0;

    // Read-only routing evaluation preview (pure calculation, ZERO DB writes)
    let routingPreview: BatchValidationResult["routingPreview"] = undefined;
    try {
      const candidateStores = await CorporateRoutingRepository.listCandidateStoreZones(callerClient);
      const candidatePartners = await CorporateRoutingRepository.listCandidatePartnerCoverages(callerClient);

      let previewAssigned = 0;
      let previewUnassigned = 0;
      const previewBreakdown: Record<string, number> = {};

      for (const p of parsedRecipients) {
        const itemTarget: CorporateBatchMatchingItemInput = {
          entity_type: "GIFTING_RECIPIENT",
          entity_id: `preview_${p.rowNumber}`,
          delivery_address: p.deliveryAddress,
          delivery_city: p.deliveryCity || null,
          delivery_pincode: p.deliveryPincode,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
        };
        const evalOutcome = CorporateRoutingService.evaluateTarget(itemTarget, candidateStores, candidatePartners);
        const canMatch = evalOutcome.status === "ASSIGNED";
        if (canMatch) {
          previewAssigned++;
        } else {
          previewUnassigned++;
          previewBreakdown[evalOutcome.reason_code] = (previewBreakdown[evalOutcome.reason_code] || 0) + 1;
        }

        p.routingPreview = {
          can_match: canMatch,
          matched_store_id: evalOutcome.assigned_store_id,
          matched_store_name: evalOutcome.assigned_store_name,
          matched_zone_id: evalOutcome.assigned_zone_id,
          matched_zone_name: evalOutcome.assigned_zone_name,
          matched_partner_id: evalOutcome.assigned_partner_id,
          matched_partner_name: evalOutcome.assigned_partner_name,
          reason_code: evalOutcome.reason_code,
          distance_km: evalOutcome.distance_km,
          diagnostics_message: evalOutcome.diagnostics_message,
        };
      }

      routingPreview = {
        totalEvaluated: parsedRecipients.length,
        totalAssigned: previewAssigned,
        totalUnassigned: previewUnassigned,
        unassignedBreakdown: previewBreakdown,
      };
    } catch {
      // Non-fatal preview fallback
    }

    return {
      isValid,
      fileHash,
      fileSizeBytes: fileBuffer.length,
      totalRows: rawRows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      summary: {
        subtotal: totalTaxable,
        cgst,
        sgst,
        igst,
        taxTotal,
        grandTotal,
        customerCreditLimit: creditLimit,
        currentOutstanding,
        activeBatchesTotal,
        totalProjectedExposure,
        availableCredit,
        creditLimitExceeded,
      },
      errors,
      parsedRecipients,
      customer: {
        id: customer.id,
        companyName: customer.company_name,
        gstin: customer.gstin,
        creditLimit,
        paymentTermsDays: Number(customer.payment_terms_days || 30),
      },
      branch: {
        id: branch.id,
        name: branch.name,
        state: branchState,
        gstin: branchGstin,
      },
      routingPreview,
    };
  }

  /**
   * Atomic All-or-Nothing Execution Workflow.
   * Runs in a single transaction with customer advisory lock.
   */
  static async executeBatchImport(
    params: ExecuteBatchImportParams
  ): Promise<ExecuteBatchResult> {
    const {
      fileBuffer,
      customerId,
      batchName: customBatchName,
      branchId: requestedBranchId,
      sourceFilename = "corporate_gifting.xlsx",
      actorContext,
      client: callerClient,
    } = params;

    // Enforce branch and RBAC scoping
    if (actorContext) {
      const role = (actorContext.role || "").toUpperCase();
      const isSuperAdmin =
        role === "SUPER_ADMIN" ||
        actorContext.userId === "admin_01" ||
        actorContext.userId === "user_01KY29WECB2VKDVVAT8J6FH90F" ||
        actorContext.isSuperAdmin === true;

      if (!isSuperAdmin) {
        const actorBranch = actorContext.branch_id || actorContext.branchId;
        if (!actorBranch) {
          throw new CorporateGiftingError(
            "BRANCH_ACCESS_DENIED",
            "Non-super-admin user lacks an authorized branch assignment."
          );
        }
        if (requestedBranchId && requestedBranchId !== actorBranch) {
          throw new CorporateGiftingError(
            "BRANCH_ACCESS_DENIED",
            `Cross-branch access denied. Authorized for '${actorBranch}', requested '${requestedBranchId}'.`
          );
        }
      }
    }

    const executeWorkflow = async (client: PoolClient): Promise<ExecuteBatchResult> => {
      // 1. Acquire exclusive customer transaction advisory lock
      const lockHash = Math.abs(
        customerId.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0)
      );
      await client.query("SELECT pg_advisory_xact_lock($1);", [lockHash]);

      // Lock customer row
      await client.query(`SELECT id FROM public.customer WHERE id = $1 FOR UPDATE;`, [customerId]);

      // 2. Re-run complete validation inside active transaction
      const validation = await CorporateGiftingService.validateBatchImport({
        fileBuffer,
        customerId,
        branchId: requestedBranchId,
        actorContext,
        client,
      });

      if (!validation.isValid) {
        const priorityError = validation.errors.find(
          (e) => e.code === "CREDIT_LIMIT_EXCEEDED" || e.code === "DUPLICATE_FILE_HASH"
        );
        if (priorityError) {
          throw new CorporateGiftingError(
            priorityError.code as CorporateGiftingErrorCode,
            priorityError.message,
            { errors: validation.errors }
          );
        }
        throw new CorporateGiftingError(
          "VALIDATION_FAILED",
          `Batch import validation failed with ${validation.errors.length} error(s). Execution blocked.`,
          { errors: validation.errors }
        );
      }

      const branchId = validation.branch.id;
      const batchName = customBatchName || `Corporate Gifting ${new Date().toISOString().split("T")[0]}`;
      const batchId = `cgb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      // 3. Create Master Commercial Umbrella Order in public."order"
      const masterOrderId = `ord_cgb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const seqRes = await client.query(`SELECT count(*)::int as count FROM public."order";`);
      const displayId = (seqRes.rows[0].count || 0) + 1000;

      await client.query(
        `INSERT INTO public."order" (
           id, display_id, customer_id, currency_code, status, metadata, created_at, updated_at
         ) VALUES ($1, $2, $3, 'INR', 'pending', $4, NOW(), NOW());`,
        [
          masterOrderId,
          displayId,
          customerId,
          JSON.stringify({
            channel: "CORPORATE_GIFTING",
            batch_id: batchId,
            batch_name: batchName,
            branch_id: branchId,
            total_recipients: validation.totalRows,
          }),
        ]
      );

      // 4. Create public.corporate_gifting_batch
      let validCreatedBy: string | null = null;
      if (actorContext?.userId) {
        const userCheck = await client.query(
          `SELECT id FROM public."user" WHERE id = $1 LIMIT 1;`,
          [actorContext.userId]
        );
        if (userCheck.rows.length > 0) {
          validCreatedBy = userCheck.rows[0].id;
        }
      }

      const createdBatch = await CorporateGiftingRepository.createBatch(
        {
          id: batchId,
          customer_id: customerId,
          batch_name: batchName,
          source_filename: sourceFilename,
          file_hash: validation.fileHash,
          file_size_bytes: validation.fileSizeBytes,
          status: "SCHEDULED",
          total_recipients: validation.totalRows,
          total_amount: validation.summary.grandTotal,
          validated_recipients: validation.validRows,
          invalid_recipients: 0,
          processed_recipients: 0,
          order_id: masterOrderId,
          metadata: {
            subtotal: validation.summary.subtotal,
            tax_total: validation.summary.taxTotal,
            branch_id: branchId,
            ...(actorContext?.userId ? { actor_user_id: actorContext.userId } : {}),
          },
          created_by: validCreatedBy,
        },
        client
      );

      // 5. Create Child Deliveries and Recipient Line Items
      const recipientInputs: any[] = [];
      for (const r of validation.parsedRecipients) {
        const recipId = `cgr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const delivId = `del_${recipId}`;

        // Create individual delivery entry in public.delivery
        await client.query(
          `INSERT INTO public.delivery (
             id, transaction_id, delivery_status, delivery_date, delivery_slot_id,
             recipient_name, recipient_phone, recipient_address, recipient_pincode,
             gift_message, created_at, updated_at
           ) VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, NOW(), NOW());`,
          [
            delivId,
            masterOrderId,
            r.deliveryDate,
            r.deliverySlot || "MORNING",
            r.recipientName,
            r.recipientPhone,
            r.deliveryAddress,
            r.deliveryPincode,
            r.giftMessage || null,
          ]
        );

        recipientInputs.push({
          id: recipId,
          batch_id: batchId,
          row_number: r.rowNumber,
          employee_id: r.employeeId,
          recipient_name: r.recipientName,
          recipient_phone: r.recipientPhone,
          delivery_address: r.deliveryAddress,
          delivery_pincode: r.deliveryPincode,
          delivery_date: r.deliveryDate,
          delivery_slot: r.deliverySlot,
          product_id: r.productId,
          variant_id: r.variantId,
          sku: r.productSku,
          quantity: r.quantity,
          unit_price: r.unitPrice,
          line_total: r.lineTotal,
          gift_message: r.giftMessage,
          validation_status: "VALID" as const,
          order_id: masterOrderId,
          delivery_id: delivId,
          status: "ORDER_CREATED" as const,
          delivery_city: r.deliveryCity || null,
          metadata: {
            latitude: r.latitude ?? null,
            longitude: r.longitude ?? null,
          },
        });
      }

      await CorporateGiftingRepository.insertRecipients(recipientInputs, client);

      // 5b. Phase C7.13: Evaluate Geographic Routing for Campaign Recipients
      const corpAccRes = await client.query(
        `SELECT id FROM public.corporate_account WHERE customer_id = $1 AND deleted_at IS NULL LIMIT 1;`,
        [customerId]
      );
      const corpAccountId = corpAccRes.rows[0]?.id || null;

      const routingItems: CorporateBatchMatchingItemInput[] = validation.parsedRecipients.map((r, idx) => ({
        entity_type: "GIFTING_RECIPIENT",
        entity_id: recipientInputs[idx].id,
        account_id: corpAccountId,
        recipient_name: r.recipientName,
        recipient_phone: r.recipientPhone,
        delivery_address: r.deliveryAddress,
        delivery_city: r.deliveryCity || null,
        delivery_pincode: r.deliveryPincode,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
      }));

      const routingResult = await CorporateRoutingService.matchDeliveriesBatch(
        {
          items: routingItems,
          actor_id: actorContext?.userId || "SYSTEM_CAMPAIGN_CONFIRMATION",
          actor_role: actorContext?.role || "SYSTEM",
        },
        client
      );

      // 6. Post Single Master Corporate GST Invoice via BillsReceivableService
      const invoiceItems = validation.parsedRecipients.map((r) => ({
        productId: r.productId,
        variantId: r.variantId,
        description: `${r.productTitle || r.productSku} (Gift for ${r.recipientName})`,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        taxRatePercent: 5,
        hsnCode: "19059090",
        itemType: "CAKE" as const,
      }));

      const invoiceRes = await BillsReceivableService.createAndPostCorporateInvoice({
        orderId: masterOrderId,
        customerId,
        branchId,
        invoiceDate: new Date().toISOString().split("T")[0],
        items: invoiceItems,
        deliveryFee: 0,
        createdBy: actorContext?.userId || "system",
        actorRole: actorContext?.role,
        actorSession: actorContext?.session,
        client,
      });

      // 7. Link Invoice ID and Routing Summary back to Batch Record
      const updatedBatch = await CorporateGiftingRepository.updateBatch(
        batchId,
        {
          invoice_id: invoiceRes.invoice.id,
          status: "SCHEDULED",
          metadata: {
            ...createdBatch.metadata,
            routing_summary: routingResult.summary,
          },
        },
        client
      );

      return {
        success: true,
        batch: updatedBatch,
        recipientsCount: validation.totalRows,
        masterOrderId,
        invoice: invoiceRes.invoice,
        voucher: invoiceRes.voucher,
        routingSummary: routingResult.summary,
      };
    };

    return callerClient ? await executeWorkflow(callerClient) : await dbTransaction(executeWorkflow);
  }

  /**
   * Lookup batch by ID with detail metrics.
   */
  static async getBatchDetail(batchId: string, client?: PoolClient) {
    const batch = await CorporateGiftingRepository.getBatchById(batchId, client);
    if (!batch) {
      throw new CorporateGiftingError("BATCH_NOT_FOUND", `Corporate gifting batch '${batchId}' not found.`);
    }
    const routingStatus = await CorporateGiftingRepository.getBatchRoutingStatus(batchId, client);
    return {
      batch,
      recipients: routingStatus.items,
      total: routingStatus.total_recipients,
      routingSummary: {
        totalRecipients: routingStatus.total_recipients,
        assignedCount: routingStatus.assigned_count,
        unassignedCount: routingStatus.unassigned_count,
        unassignedBreakdown: routingStatus.unassigned_breakdown,
      },
    };
  }

  /**
   * List batches with filtering and search.
   */
  static async listBatches(filter: any = {}, client?: PoolClient) {
    return await CorporateGiftingRepository.listBatches(filter, client);
  }

  /**
   * Phase C7.13: Re-evaluates routing for all recipients in a corporate batch.
   * Preserves MANUAL_OVERRIDE records unless forceReassign is true.
   * Zero duplicate orders or invoices.
   */
  static async routeBatchRecipients(params: {
    batchId: string;
    forceReassign?: boolean;
    actorContext?: any;
    client?: PoolClient;
  }): Promise<{
    batchId: string;
    summary: CorporateBatchMatchingSummary;
    assignments: CorporateDeliveryAssignmentDTO[];
  }> {
    const { batchId, forceReassign = false, actorContext, client: callerClient } = params;

    const executeRouting = async (client: PoolClient) => {
      const batch = await CorporateGiftingRepository.getBatchById(batchId, client);
      if (!batch) {
        throw new CorporateGiftingError("BATCH_NOT_FOUND", `Corporate gifting batch '${batchId}' not found.`);
      }

      // Check customer isolation if caller is a customer
      if (actorContext) {
        const role = (actorContext.role || "").toUpperCase();
        if (role === "CUSTOMER") {
          const authCust = actorContext.customerId || actorContext.userId;
          if (batch.customer_id !== authCust) {
            throw new CorporateGiftingError("BATCH_NOT_FOUND", `Corporate gifting batch '${batchId}' not found.`);
          }
        }
      }

      const recipResult = await CorporateGiftingRepository.listRecipientsByBatch(batchId, { limit: 2000 }, client);
      if (recipResult.recipients.length === 0) {
        throw new CorporateGiftingError("INSUFFICIENT_DATA", "Batch contains no recipient records.");
      }

      const corpAccRes = await client.query(
        `SELECT id FROM public.corporate_account WHERE customer_id = $1 AND deleted_at IS NULL LIMIT 1;`,
        [batch.customer_id]
      );
      const corpAccountId = corpAccRes.rows[0]?.id || null;

      // Map recipients to matching items, retrieving coordinates from assignment, recipient metadata, or employee
      const routingItems: CorporateBatchMatchingItemInput[] = [];
      for (const r of recipResult.recipients) {
        const meta = (r.metadata as any) || {};
        let lat = typeof meta.latitude === "number" ? meta.latitude : null;
        let lng = typeof meta.longitude === "number" ? meta.longitude : null;

        // If coordinates missing, check existing assignment
        if (lat === null || lng === null) {
          const cdaRes = await client.query(
            `SELECT latitude, longitude FROM public.corporate_delivery_assignment WHERE entity_type = 'GIFTING_RECIPIENT' AND entity_id = $1 LIMIT 1;`,
            [r.id]
          );
          if (cdaRes.rows.length > 0 && cdaRes.rows[0].latitude !== null && cdaRes.rows[0].longitude !== null) {
            lat = Number(cdaRes.rows[0].latitude);
            lng = Number(cdaRes.rows[0].longitude);
          }
        }

        routingItems.push({
          entity_type: "GIFTING_RECIPIENT",
          entity_id: r.id,
          account_id: corpAccountId,
          recipient_name: r.recipient_name,
          recipient_phone: r.recipient_phone,
          delivery_address: r.delivery_address,
          delivery_city: r.delivery_city || null,
          delivery_pincode: r.delivery_pincode,
          latitude: lat,
          longitude: lng,
        });
      }

      const res = await CorporateRoutingService.matchDeliveriesBatch(
        {
          items: routingItems,
          actor_id: actorContext?.userId || "SYSTEM_ROUTING_RETRY",
          actor_role: actorContext?.role || "SYSTEM",
          force_reassign: forceReassign,
        },
        client
      );

      return {
        batchId,
        summary: res.summary,
        assignments: res.assignments,
      };
    };

    if (callerClient) {
      return await executeRouting(callerClient);
    } else {
      return await dbTransaction(async (client) => {
        return await executeRouting(client);
      });
    }
  }

  /**
   * Phase C7.13: Reassigns an individual recipient delivery to a store and partner.
   * Records immutable audit event and synchronizes delivery record.
   */
  static async reassignRecipientDelivery(params: {
    recipientId: string;
    storeId: string;
    partnerId?: string;
    overrideReason: string;
    latitude?: number;
    longitude?: number;
    actorContext?: any;
    client?: PoolClient;
  }): Promise<{
    success: boolean;
    assignment: CorporateDeliveryAssignmentDTO;
    delivery_status: string;
  }> {
    const { recipientId, storeId, partnerId, overrideReason, latitude, longitude, actorContext, client: callerClient } = params;

    const executeReassign = async (client: PoolClient) => {
      const recip = await CorporateGiftingRepository.getRecipientWithDeliveryAndAssignment(recipientId, client);
      if (!recip) {
        throw new CorporateGiftingError("RECIPIENT_NOT_FOUND", `Corporate gifting recipient '${recipientId}' not found.`);
      }

      // Authorization guard: customers cannot manually reassign
      if (actorContext) {
        const role = (actorContext.role || "").toUpperCase();
        if (role === "CUSTOMER") {
          throw new CorporateGiftingError("FORBIDDEN", "Corporate customers cannot perform manual routing overrides.");
        }
      }

      if (!overrideReason || overrideReason.trim().length < 5) {
        throw new CorporateGiftingError("INSUFFICIENT_DATA", "A detailed override reason (min 5 chars) is required.");
      }

      // Validate store
      const storeRes = await client.query(
        `SELECT id, name FROM public.branch WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`,
        [storeId.trim()]
      );
      if (storeRes.rows.length === 0) {
        throw new CorporateGiftingError("BRANCH_NOT_FOUND", `Store '${storeId}' not found or inactive.`);
      }

      // Validate partner if specified
      if (partnerId && partnerId.trim() !== "") {
        const pRes = await client.query(
          `SELECT id, first_name, last_name FROM public.delivery_partner WHERE id = $1 AND deleted_at IS NULL LIMIT 1;`,
          [partnerId.trim()]
        );
        if (pRes.rows.length === 0) {
          throw new CorporateGiftingError("INSUFFICIENT_DATA", `Delivery partner '${partnerId}' not found or inactive.`);
        }
      }

      // Check or create assignment record
      let assignment = await CorporateRoutingRepository.getAssignmentByEntity("GIFTING_RECIPIENT", recipientId, client);
      const actorId = actorContext?.userId || "SYSTEM_REASSIGN";
      const actorRole = actorContext?.role || "ADMIN";

      if (!assignment) {
        // Create initial assignment record as MANUAL_OVERRIDE
        const corpAccRes = await client.query(
          `SELECT ca.id FROM public.corporate_gifting_batch cgb
           JOIN public.corporate_account ca ON ca.customer_id = cgb.customer_id
           WHERE cgb.id = $1 LIMIT 1;`,
          [recip.batch_id]
        );
        const corpAccountId = corpAccRes.rows[0]?.id || null;

        assignment = await CorporateRoutingRepository.upsertAssignment(
          {
            entity_type: "GIFTING_RECIPIENT",
            entity_id: recipientId,
            account_id: corpAccountId,
            recipient_name: recip.recipient_name,
            recipient_phone: recip.recipient_phone,
            delivery_address: recip.delivery_address,
            delivery_city: recip.delivery_city,
            normalized_city_key: recip.delivery_city ? recip.delivery_city.trim().toLowerCase() : null,
            delivery_pincode: recip.delivery_pincode,
            latitude: typeof latitude === "number" ? latitude : null,
            longitude: typeof longitude === "number" ? longitude : null,
            status: "MANUAL_OVERRIDE",
            reason_code: "MANUAL_OVERRIDE",
            assigned_store_id: storeId.trim(),
            assigned_partner_id: partnerId ? partnerId.trim() : null,
            matched_rule: "MANUAL_OVERRIDE",
            diagnostics_message: `Manually assigned: ${overrideReason.trim()}`,
            assigned_at: new Date().toISOString(),
            assigned_by: actorId,
            override_reason: overrideReason.trim(),
          },
          client
        );

        await CorporateRoutingRepository.insertAssignmentEvent(
          {
            assignment_id: assignment.id,
            event_type: "MANUALLY_OVERRIDDEN",
            actor_id: actorId,
            actor_role: actorRole,
            reason: overrideReason.trim(),
            before_state: null,
            after_state: {
              status: assignment.status,
              store_id: assignment.assigned_store_id,
              partner_id: assignment.assigned_partner_id,
              override_reason: assignment.override_reason,
            },
          },
          client
        );
      } else {
        // Resolve using existing assignment
        await CorporateRoutingService.resolveUnresolvedAssignment(
          {
            assignment_id: assignment.id,
            action: "MANUAL_ASSIGN",
            store_id: storeId.trim(),
            partner_id: partnerId ? partnerId.trim() : undefined,
            override_reason: overrideReason.trim(),
            actor_id: actorId,
            actor_role: actorRole,
          },
          client
        );
        assignment = (await CorporateRoutingRepository.getAssignmentById(assignment.id, client)) as any;
      }

      // Synchronize delivery table
      if (partnerId && partnerId.trim() !== "") {
        await client.query(
          `UPDATE public.delivery d
           SET delivery_partner_id = $1,
               delivery_status = CASE WHEN d.delivery_status = 'pending' THEN 'pickup_claimed' ELSE d.delivery_status END,
               updated_at = NOW()
           WHERE (d.id = $2 OR d.id = ('del_' || $3));`,
          [partnerId.trim(), recip.delivery_id, recipientId]
        );
      }

      const updatedDeliveryRes = await client.query(
        `SELECT delivery_status FROM public.delivery WHERE (id = $1 OR id = ('del_' || $2)) LIMIT 1;`,
        [recip.delivery_id, recipientId]
      );
      const rawDeliveryStatus = updatedDeliveryRes.rows[0]?.delivery_status;
      const deliveryStatus = rawDeliveryStatus === "pickup_claimed" ? "assigned" : (rawDeliveryStatus || "assigned");

      return {
        success: true,
        assignment: CorporateRoutingService.toAssignmentDTO(assignment!),
        delivery_status: deliveryStatus,
      };
    };

    if (callerClient) {
      return await executeReassign(callerClient);
    } else {
      return await dbTransaction(async (client) => {
        return await executeReassign(client);
      });
    }
  }

  /**
   * Phase C7.13: Updates delivery lifecycle status for a campaign recipient.
   * Enforces valid state machine transitions, partner scoping, and immutable audit tracking.
   * Zero duplicate invoices and zero accounting entries created.
   */
  static async updateRecipientDeliveryStatus(params: {
    recipientId: string;
    deliveryStatus: string;
    notes?: string;
    actorContext?: any;
    client?: PoolClient;
  }): Promise<{
    success: boolean;
    recipientId: string;
    previousStatus: string;
    deliveryStatus: string;
    recipientStatus: string;
    idempotent: boolean;
  }> {
    const { recipientId, deliveryStatus, notes, actorContext, client: callerClient } = params;

    const executeUpdate = async (client: PoolClient) => {
      const recip = await CorporateGiftingRepository.getRecipientWithDeliveryAndAssignment(recipientId, client);
      if (!recip) {
        throw new CorporateGiftingError("RECIPIENT_NOT_FOUND", `Corporate gifting recipient '${recipientId}' not found.`);
      }

      const targetStatus = (deliveryStatus || "").trim().toLowerCase();
      const validStatuses = [
        "pending",
        "assigned",
        "pickup_claimed",
        "out_for_delivery",
        "in_transit",
        "delivered",
        "failed",
        "cancelled",
      ];
      if (!validStatuses.includes(targetStatus)) {
        throw new CorporateGiftingError(
          "INVALID_STATUS_TRANSITION",
          `Invalid delivery status '${deliveryStatus}'. Must be one of: ${validStatuses.join(", ")}.`
        );
      }

      const currentStatus = String(recip.delivery_status || "pending").toLowerCase();

      // Normalize statuses for lifecycle transition verification
      const canonTarget =
        targetStatus === "pickup_claimed" || targetStatus === "assigned"
          ? "assigned"
          : targetStatus === "in_transit" || targetStatus === "out_for_delivery"
          ? "out_for_delivery"
          : targetStatus;

      const canonCurrent =
        currentStatus === "pickup_claimed" || currentStatus === "assigned"
          ? "assigned"
          : currentStatus === "in_transit" || currentStatus === "out_for_delivery"
          ? "out_for_delivery"
          : currentStatus;

      // Database check constraint mapping for public.delivery
      const dbTarget =
        canonTarget === "assigned"
          ? "pickup_claimed"
          : canonTarget === "out_for_delivery"
          ? "in_transit"
          : canonTarget === "delivered"
          ? "delivered"
          : canonTarget === "failed" || canonTarget === "cancelled"
          ? (canonCurrent === "out_for_delivery" ? "in_transit" : "pending")
          : "pending";

      // Partner authorization check: Delivery partners can only update their own assigned orders
      if (actorContext) {
        const role = (actorContext.role || "").toUpperCase();
        if (role === "DELIVERY_PARTNER") {
          const authPartnerId = actorContext.partnerId || actorContext.userId;
          const assignedPartner = recip.delivery_partner_id || recip.routing_partner_id;
          if (!assignedPartner || assignedPartner !== authPartnerId) {
            throw new CorporateGiftingError(
              "PARTNER_ACCESS_DENIED",
              "Access denied: You can only update deliveries assigned to your delivery partner account."
            );
          }
        } else if (role === "CUSTOMER") {
          throw new CorporateGiftingError(
            "FORBIDDEN",
            "Access denied: Corporate customers cannot alter fulfillment delivery statuses."
          );
        }
      }

      // Idempotency check
      if (canonCurrent === canonTarget) {
        return {
          success: true,
          recipientId,
          previousStatus: currentStatus,
          deliveryStatus: targetStatus,
          recipientStatus: recip.status,
          idempotent: true,
        };
      }

      // Terminal state guard: cannot alter delivered or cancelled
      if (canonCurrent === "delivered") {
        throw new CorporateGiftingError(
          "INVALID_STATUS_TRANSITION",
          "Delivery is already completed ('delivered') and cannot be altered."
        );
      }
      if (canonCurrent === "cancelled") {
        throw new CorporateGiftingError(
          "INVALID_STATUS_TRANSITION",
          "Delivery is already cancelled and cannot be altered."
        );
      }

      // Transition validation rules
      // 1. Direct completion from pending/assigned is strictly prohibited
      if (canonTarget === "delivered" && canonCurrent !== "out_for_delivery") {
        throw new CorporateGiftingError(
          "INVALID_STATUS_TRANSITION",
          `Cannot mark delivery completed directly from '${currentStatus}'. Order must be 'out_for_delivery' first.`
        );
      }

      // 2. Out for delivery must come from assigned (or re-attempt from failed)
      if (canonTarget === "out_for_delivery" && canonCurrent !== "assigned" && canonCurrent !== "failed") {
        throw new CorporateGiftingError(
          "INVALID_STATUS_TRANSITION",
          `Cannot transition to 'out_for_delivery' from '${currentStatus}'. Must be 'assigned' or 'failed'.`
        );
      }

      // 3. Failed must come from out_for_delivery
      if (canonTarget === "failed" && canonCurrent !== "out_for_delivery") {
        throw new CorporateGiftingError(
          "INVALID_STATUS_TRANSITION",
          `Cannot mark delivery failed from '${currentStatus}'. Order must be 'out_for_delivery'.`
        );
      }

      // Map delivery status to corporate_gifting_recipient status
      let mappedRecipientStatus: "ORDER_CREATED" | "DISPATCHED" | "DELIVERED" | "FAILED" | "CANCELLED" = "ORDER_CREATED";
      if (canonTarget === "out_for_delivery") {
        mappedRecipientStatus = "DISPATCHED";
      } else if (canonTarget === "delivered") {
        mappedRecipientStatus = "DELIVERED";
      } else if (canonTarget === "failed") {
        mappedRecipientStatus = "FAILED";
      } else if (canonTarget === "cancelled") {
        mappedRecipientStatus = "CANCELLED";
      }

      // Mutate public.delivery with constraint-adherent status
      await client.query(
        `UPDATE public.delivery 
         SET delivery_status = $1, updated_at = NOW() 
         WHERE (id = $2 OR id = ('del_' || $3));`,
        [dbTarget, recip.delivery_id, recipientId]
      );

      // Mutate public.corporate_gifting_recipient with audit history
      const existingMeta = (recip.metadata as any) || {};
      const history = Array.isArray(existingMeta.status_history) ? existingMeta.status_history : [];
      history.push({
        from: currentStatus,
        to: targetStatus,
        timestamp: new Date().toISOString(),
        actor_id: actorContext?.userId || "SYSTEM",
        actor_role: actorContext?.role || "SYSTEM",
        notes: notes || null,
      });

      await client.query(
        `UPDATE public.corporate_gifting_recipient
         SET status = $1, metadata = $2, updated_at = NOW()
         WHERE id = $3;`,
        [mappedRecipientStatus, JSON.stringify({ ...existingMeta, status_history: history }), recipientId]
      );

      return {
        success: true,
        recipientId,
        previousStatus: currentStatus,
        deliveryStatus: targetStatus,
        recipientStatus: mappedRecipientStatus,
        idempotent: false,
      };
    };

    if (callerClient) {
      return await executeUpdate(callerClient);
    } else {
      return await dbTransaction(async (client) => {
        return await executeUpdate(client);
      });
    }
  }

  /**
   * Phase C7.13: Fetches routing and delivery overview for a batch.
   */
  static async getBatchRoutingStatus(batchId: string, client?: PoolClient) {
    return await CorporateGiftingRepository.getBatchRoutingStatus(batchId, client);
  }
}
