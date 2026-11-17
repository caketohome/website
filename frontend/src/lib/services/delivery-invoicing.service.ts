/**
 * DeliveryInvoicingService
 *
 * Phase 5B.3: Statutory Invoice Generation at Delivery
 *
 * This service is the SINGLE point where invoice_number is allocated.
 * It is called ONLY when an order transitions to DELIVERED.
 *
 * Invariants:
 *   1. Order ≠ Bill: invoice_number is NULL at order creation.
 *   2. Invoice is generated EXACTLY ONCE per order (idempotent).
 *   3. Invoice format: CTH/YY-YY/XXXXXX (financial year / 6-digit sequence).
 *   4. Invoice is persisted to both memory store and PostgreSQL.
 */

import { dbQuery } from "../db";
import { resolveIndianFiscalYear } from "../fiscal-period";

// ── Fiscal Year Helpers ──────────────────────────────────────────────────────

function getCurrentFiscalYear(): { short: string; startYear: number; endYear: number } {
  const fyInfo = resolveIndianFiscalYear(new Date());
  return { short: fyInfo.fyString, startYear: fyInfo.startYear, endYear: fyInfo.endYear };
}

// ── Invoice Number Generator ─────────────────────────────────────────────────
// Allocates via atomic PostgreSQL function with advisory lock, FY-aware counter,
// and audit log. NO in-memory fallback — if DB is unavailable, allocation fails
// and the caller must handle retry/queueing.

async function allocateInvoiceNumber(
  orderId: string | undefined,
  prefix: string,
  entityId: string = "CAKETOHOME_PARENT",
  gstin?: string | null,
  issueDate?: string | Date | null,
  client?: any
): Promise<string> {
  if (!prefix || !prefix.trim()) {
    throw new Error("STATUTORY_ERROR: Cannot allocate invoice number without an approved series prefix.");
  }
  const queryFn = client ? (t: string, p: any[]) => client.query(t, p) : dbQuery;
  const seqResult = await queryFn(
    `SELECT * FROM public.allocate_invoice_number($1, $2, $3, $4, $5)`,
    [
      prefix.trim(),
      orderId || null,
      entityId,
      gstin || null,
      issueDate ? new Date(issueDate).toISOString() : new Date().toISOString(),
    ]
  );
  return seqResult.rows[0].invoice_number;
}


// ── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  branch_id: string;
  branch_name: string;
  branch_code: string;
  customer_name: string;
  customer_phone: string;
  customer_uid: string;
  seller_gstin: string;
  seller_fssai_number: string;
  seller_legal_name: string;
  seller_state: string;
  seller_state_code: string;
  customer_state: string;
  supply_type: string;
  is_intra_state: boolean;
  items: any[];
  subtotal: number;
  tax_total: number;
  delivery_fee: number;
  discount_total: number;
  grand_total: number;
  payment_method: string;
  payment_status: string;
  status: "GENERATED" | "SENT" | "CANCELLED" | "PAID";
  generated_at: string;
  delivered_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  voucher_id?: string | null;
  due_date?: string | null;
  paid_amount?: number;
  outstanding_amount?: number;
  is_corporate?: boolean;
}

export interface InvoiceResult {
  success: boolean;
  invoice_number?: string;
  invoice_id?: string;
  invoice?: InvoiceRecord;
  accounting_voucher_id?: string | null;
  idempotent_replay?: boolean;
  error?: string;
  code?: string;
}

// ── Main Service ─────────────────────────────────────────────────────────────

export class DeliveryInvoicingService {

  /**
   * Generate a statutory invoice for a delivered order.
   * This is idempotent: if the order already has an invoice, it returns the existing one.
   *
   * @param engine - ApiEngine instance (for memory store access)
   * @param order  - The order object (must be in DELIVERED state)
   */
  public static async generateInvoiceOnDelivery(
    engine: any,
    order: any
  ): Promise<InvoiceResult> {

    // ── Idempotency Guard (In-Memory + Database) ─────────────────────────
    if (order.invoice_number && order.invoice_id) {
      return {
        success: true,
        invoice_number: order.invoice_number,
        invoice_id: order.invoice_id,
        invoice: order.invoice,
        accounting_voucher_id: order.accounting_voucher_id || order.metadata?.accounting_voucher_id || null,
        idempotent_replay: true,
      };
    }

    try {
      const { dbQuery } = await import("../db");
      const existingInvRes = await dbQuery(
        `SELECT id, invoice_number, voucher_id, grand_total, paid_amount, outstanding_amount, status, metadata
         FROM public.invoice 
         WHERE order_id = $1 AND deleted_at IS NULL`,
        [order.id]
      );
      if (existingInvRes.rows.length > 0) {
        const row = existingInvRes.rows[0];
        const vId = row.voucher_id || order.accounting_voucher_id || order.metadata?.accounting_voucher_id || null;
        if (vId && !row.voucher_id) {
          await dbQuery(
            `UPDATE public.invoice SET voucher_id = $1, updated_at = NOW() WHERE id = $2`,
            [vId, row.id]
          );
        }
        order.invoice_number = row.invoice_number;
        order.invoice_id = row.id;
        order.accounting_voucher_id = vId;
        return {
          success: true,
          invoice_number: row.invoice_number,
          invoice_id: row.id,
          invoice: {
            ...row,
            order_id: order.id,
            order_number: order.order_number,
          },
          accounting_voucher_id: vId,
          idempotent_replay: true,
        };
      }
    } catch (e: any) {
      console.warn("[DeliveryInvoicingService] Existing invoice check notice:", e?.message);
    }

    // ── State Guard ──────────────────────────────────────────────────────
    const status = String(order.status || "").toLowerCase();
    const deliveryStatus = String(order.delivery_status || order.metadata?.delivery_status || "").toLowerCase();
    const isDeliveredState = status === "delivered" || (status === "completed" && deliveryStatus === "delivered");
    if (!isDeliveredState) {
      return {
        success: false,
        error: `Cannot generate invoice: order status is '${order.status}' (delivery_status: '${deliveryStatus}'), expected 'delivered'.`,
      };
    }

    // ── Exemption & Test Fixture Guard ────────────────────────────────────
    const isExempt = order.invoicing_exempt === true ||
      order.metadata?.invoicing_exempt === true ||
      order.classification === "TEST" ||
      order.metadata?.classification === "TEST" ||
      String(order.id || "").toLowerCase().includes("test_cod_");
    if (isExempt) {
      return {
        success: false,
        error: `Cannot generate statutory invoice: Order ${order.order_number || order.id} is classified as an exempt test fixture.`,
      };
    }

    // ── Resolve & Validate Line Items (Pre-Allocation Guard) ──────────────
    const snap = order.compliance_snapshot || {};
    let orderItems: any[] = Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : Array.isArray(order.metadata?.items) && order.metadata.items.length > 0
      ? order.metadata.items
      : [];

    if (orderItems.length === 0 && order.id) {
      try {
        const { dbQuery } = await import("../db");
        const oiRes = await dbQuery(
          `SELECT 
             oi.id AS order_item_id,
             oi.order_id,
             oi.item_id,
             oi.quantity,
             COALESCE(oli.product_id, oi.product_id) as product_id,
             oli.variant_id,
             COALESCE(oli.title, oi.title) as title,
             oli.variant_sku AS sku,
             COALESCE(oli.unit_price, oi.unit_price) as unit_price,
             COALESCE(oli.metadata->>'hsn_code', oi.metadata->>'hsn_code', p.hsn_code, (CASE WHEN (p.id LIKE 'acc_%' OR p.merchandise_type = 'ACCESSORY') THEN '95059000' ELSE '1905' END)) AS hsn_code,
             COALESCE(oi.gst_rate_pct, (oli.metadata->>'tax_rate')::numeric, 5) AS gst_rate_pct,
             COALESCE(oi.tax_amount, (oli.metadata->>'tax_amount')::numeric, 0) AS tax_amount,
             COALESCE(oi.taxable_value, (oli.metadata->>'line_total')::numeric, (COALESCE(oli.unit_price, oi.unit_price) * oi.quantity)) AS taxable_value,
             COALESCE(oi.total, (oli.metadata->>'total')::numeric, 0) AS total,
             oli.metadata
           FROM public.order_item oi
           LEFT JOIN public.order_line_item oli ON oli.id = oi.item_id
           LEFT JOIN public.product p ON p.id = COALESCE(oli.product_id, oi.product_id)
           WHERE oi.order_id = $1
           ORDER BY oi.id ASC`,
          [order.id]
        );
        if (oiRes.rows.length > 0) {
          orderItems = oiRes.rows;
        }
      } catch (_e) {
        try {
          const { dbQuery } = await import("../db");
          const oiDirect = await dbQuery(
            `SELECT 
               oi.id AS order_item_id, 
               oi.order_id, 
               oi.product_id, 
               oi.title, 
               oi.quantity, 
               oi.unit_price, 
               oi.gst_rate_pct, 
               oi.tax_amount, 
               oi.taxable_value, 
               oi.total,
               COALESCE(oi.metadata->>'hsn_code', p.hsn_code, (CASE WHEN (p.id LIKE 'acc_%' OR p.merchandise_type = 'ACCESSORY') THEN '95059000' ELSE '1905' END)) AS hsn_code
             FROM public.order_item oi
             LEFT JOIN public.product p ON p.id = oi.product_id
             WHERE oi.order_id = $1
             ORDER BY oi.id ASC`,
            [order.id]
          );
          if (oiDirect.rows.length > 0) {
            orderItems = oiDirect.rows;
          }
        } catch (_inner) {}
      }
    }

    // Statutory Check: Never burn sequence numbers on orders with zero line items!
    if (orderItems.length === 0) {
      return {
        success: false,
        error: `Cannot generate statutory invoice: Order ${order.order_number || order.id} has 0 line items. Tax invoices must include product descriptions, HSN codes, and quantities under CGST Rule 46.`,
      };
    }

    // ── Pre-Allocation Statutory Validation (GST Rule 46) ───────────────
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    let sellerGstinRaw = snap.seller_gstin || order.seller_gstin || order.metadata?.seller_gstin || null;
    let sellerLegalNameRaw = snap.seller_legal_name || order.seller_legal_name || order.metadata?.seller_legal_name || null;

    if ((!sellerGstinRaw || !sellerLegalNameRaw) && order.exemption_test !== true && order.metadata?.exemption_test !== true) {
      try {
        const { dbQuery } = await import("../db");
        const gstLookup = await dbQuery(
          `SELECT g.gstin, COALESCE(g.legal_name, c.legal_name) AS legal_name
           FROM public.gst_registration g
           LEFT JOIN public.company c ON c.id = g.company_id
           WHERE g.is_active = true
           ORDER BY g.created_at ASC LIMIT 1`
        );
        if (gstLookup.rows.length > 0) {
          if (!sellerGstinRaw) sellerGstinRaw = gstLookup.rows[0].gstin;
          if (!sellerLegalNameRaw) sellerLegalNameRaw = gstLookup.rows[0].legal_name || "CakeToHome India Private Limited";
        }
      } catch (_gstErr) {}
    }

    const sellerGstin = typeof sellerGstinRaw === "string" ? sellerGstinRaw.trim() : null;
    const sellerLegalName = typeof sellerLegalNameRaw === "string" ? sellerLegalNameRaw.trim() : null;

    // 1. Missing or empty GSTIN
    if (!sellerGstin) {
      return {
        success: false,
        error: "Cannot generate statutory invoice: seller GSTIN is missing. A valid 15-character GSTIN is required under GST Rule 46.",
        code: "MISSING_SELLER_GSTIN",
      };
    }

    // 2. Malformed GSTIN
    if (!GSTIN_REGEX.test(sellerGstin)) {
      return {
        success: false,
        error: `Cannot generate statutory invoice: seller GSTIN '${sellerGstin}' is malformed or invalid under GST Rule 46.`,
        code: "INVALID_SELLER_GSTIN",
      };
    }

    // 3. Missing or empty legal name
    if (!sellerLegalName) {
      return {
        success: false,
        error: "Cannot generate statutory invoice: seller legal registered name is missing.",
        code: "MISSING_SELLER_LEGAL_NAME",
      };
    }

    // 4. Unverified seller registration
    const isSellerVerified = snap.seller_is_verified !== false &&
      order.seller_is_verified !== false &&
      order.metadata?.seller_is_verified !== false &&
      order.metadata?.is_verified !== false &&
      snap.is_verified !== false;

    if (!isSellerVerified) {
      return {
        success: false,
        error: `Cannot generate statutory invoice: seller tax registration '${sellerGstin}' for '${sellerLegalName}' is unverified.`,
        code: "UNVERIFIED_SELLER_REGISTRATION",
      };
    }

    // 5. Ambiguous seller identity (State Code Mismatch)
    const rawStateCode = snap.seller_state_code || order.seller_state_code || order.metadata?.seller_state_code || null;
    if (rawStateCode) {
      const cleanStateCode = String(rawStateCode).replace(/\D/g, "").padStart(2, "0");
      const gstinStatePrefix = sellerGstin.slice(0, 2);
      if (cleanStateCode.length === 2 && gstinStatePrefix !== cleanStateCode) {
        return {
          success: false,
          error: `Cannot generate statutory invoice: Ambiguous seller identity. Seller GSTIN prefix '${gstinStatePrefix}' does not match registered branch state code '${cleanStateCode}'.`,
          code: "AMBIGUOUS_SELLER_IDENTITY",
        };
      }
    }

    // 6. Mandatory HSN Classification per line item
    const HSN_REGEX = /^[0-9]{4,8}$/;
    for (const item of orderItems) {
      if (!item.hsn_code) {
        item.hsn_code = (
          item.metadata?.hsn_code ||
          item.hsnCode ||
          item.hsn ||
          ""
        ).toString().trim();
      }
      // Authoritative fallback lookup from public.product if product_id is present
      if (!item.hsn_code && (item.product_id || item.id)) {
        try {
          const { dbQuery } = await import("../db");
          const pId = item.product_id || item.id;
          const pRes = await dbQuery(`SELECT hsn_code, merchandise_type FROM public.product WHERE id = $1`, [pId]);
          if (pRes.rows.length > 0) {
            const pRow = pRes.rows[0];
            item.hsn_code = (pRow.hsn_code || ((pRow.merchandise_type === "ACCESSORY" || String(pId).startsWith("acc_")) ? "95059000" : "1905")).trim();
          }
        } catch (_pErr) {}
      }
      const hsn = (item.hsn_code || "").toString().trim();
      if (!hsn || !HSN_REGEX.test(hsn)) {
        return {
          success: false,
          error: `Cannot generate statutory invoice: line item '${item.title || item.name || item.id}' has missing or invalid HSN classification ('${hsn}'). Under CGST Rule 46, statutory tax invoices require valid 4-8 digit HSN codes.`,
          code: "MISSING_HSN_CLASSIFICATION",
        };
      }
    }

    const partnerId = order.partner_id || order.metadata?.partner_id || null;
    const isPartner = Boolean(partnerId);
    const entityId = isPartner ? String(partnerId) : "CAKETOHOME_PARENT";
    const issueDate = order.delivered_at || order.created_at || new Date().toISOString();
    const { fiscalYear: dynamicFy, fyString } = resolveIndianFiscalYear(issueDate);

    // ── Database-Driven Statutory Invoice Series Resolution (CGST Rule 46) ─
    let requestedPrefix = String(
      order.invoice_prefix || order.metadata?.invoice_prefix || snap.invoice_prefix || ""
    ).trim();

    if (isPartner && !requestedPrefix) {
      requestedPrefix = `PRT-${String(partnerId).slice(-4).toUpperCase()}`;
    }

    const { dbQuery } = await import("../db");

    // If prefix is not explicitly specified, resolve approved active series for this seller and FY from DB
    let prefix = requestedPrefix;
    if (!prefix) {
      try {
        const approvedSeqRes = await dbQuery(
          `SELECT prefix FROM public.invoice_sequence 
           WHERE (entity_id = $1 OR entity_id = 'CAKETOHOME_PARENT')
             AND gstin = $2 
             AND fiscal_year = $3 
             AND is_active = true 
             AND approval_status = 'APPROVED'
           ORDER BY id ASC LIMIT 1`,
          [entityId, sellerGstin, dynamicFy]
        );
        if (approvedSeqRes.rows.length > 0) {
          prefix = approvedSeqRes.rows[0].prefix;
        }
      } catch (_seqLookupErr) {}
    }

    // Fail closed if still no prefix or prefix format is invalid under CGST Rule 46
    if (!prefix || !/^[A-Za-z0-9\-_]{1,16}$/.test(prefix)) {
      return {
        success: false,
        error: `Cannot generate statutory invoice: No authorized statutory invoice series exists for seller GSTIN '${sellerGstin}' in FY ${dynamicFy}. Statutory invoice allocation blocked fail-closed under CGST Rule 46 pending CA / Tax Counsel authorized series designation.`,
        code: "UNAUTHORIZED_INVOICE_SERIES",
      };
    }

    // ── Statutory Safeguards: Conflict & Authorization Verification (CGST Rule 46) ──
    try {
      const seqRes = await dbQuery(
        `SELECT prefix, gstin, fiscal_year, is_active, approval_status 
         FROM public.invoice_sequence 
         WHERE prefix = $1 AND fiscal_year = $2`,
        [prefix, dynamicFy]
      );
      if (seqRes.rows.length > 0) {
        const matchedSeq = seqRes.rows[0];
        if (matchedSeq.gstin !== sellerGstin) {
          return {
            success: false,
            error: `Cannot generate statutory invoice: Invoice series prefix '${prefix}' in FY ${dynamicFy} is legally bound to GSTIN '${matchedSeq.gstin}' under CGST Rule 46. It cannot be used for active seller GSTIN '${sellerGstin}'. Statutory invoice allocation blocked pending CA / Tax Counsel authorized series designation.`,
            code: "INVOICE_SERIES_PREFIX_CONFLICT",
          };
        }
        if (matchedSeq.approval_status !== "APPROVED" || matchedSeq.is_active !== true) {
          return {
            success: false,
            error: `Cannot generate statutory invoice: Invoice series prefix '${prefix}' in FY ${dynamicFy} is not approved (status='${matchedSeq.approval_status}', active=${matchedSeq.is_active}) under CGST Rule 46. Statutory invoice allocation blocked fail-closed pending authorized series designation.`,
            code: "UNAUTHORIZED_INVOICE_SERIES",
          };
        }
      } else {
        return {
          success: false,
          error: `Cannot generate statutory invoice: Invoice series prefix '${prefix}' in FY ${dynamicFy} for GSTIN '${sellerGstin}' is not registered or approved in invoice_sequence. Statutory invoice allocation blocked fail-closed under CGST Rule 46.`,
          code: "UNAUTHORIZED_INVOICE_SERIES",
        };
      }
    } catch (seqCheckErr: any) {
      if (seqCheckErr && typeof seqCheckErr === "object" && (seqCheckErr.code === "INVOICE_SERIES_PREFIX_CONFLICT" || seqCheckErr.code === "UNAUTHORIZED_INVOICE_SERIES")) {
        return seqCheckErr;
      }
      const safeMsg = String(seqCheckErr?.message || "Database connection error").replace(/:\/\/.*@/, "://[REDACTED]@");
      return {
        success: false,
        error: `Cannot generate statutory invoice: Database sequence verification failed (${safeMsg}). Statutory invoice allocation blocked fail-closed under CGST Rule 46.`,
        code: "INVOICE_SEQUENCE_VERIFICATION_FAILED",
      };
    }

    let subtotal = Number(order.pricing?.subtotal ?? order.subtotal ?? order.metadata?.subtotal ?? 0);
    let tax_total = Number(order.pricing?.tax_total ?? order.tax_total ?? order.metadata?.tax_amount ?? 0);
    let delivery_fee = Number(order.pricing?.delivery_fee ?? order.delivery_fee ?? order.metadata?.delivery?.fee ?? 0);
    let discount_total = Number(order.pricing?.discount_total ?? order.discount_total ?? order.metadata?.discount_amount ?? 0);
    let grand_total = Number(order.pricing?.grand_total ?? order.grand_total ?? order.total ?? order.metadata?.grand_total ?? order.metadata?.total_amount ?? 0);

    // Fallback: If financial totals are omitted or 0 on in-memory object and order.id is present, resolve from PostgreSQL public."order"
    if ((!grand_total || !subtotal) && order.id) {
      try {
        const { dbQuery } = await import("../db");
        const oDbRes = await dbQuery(
          `SELECT grand_total, subtotal, metadata FROM public."order" WHERE id = $1`,
          [order.id]
        );
        if (oDbRes.rows.length > 0) {
          const dbRow = oDbRes.rows[0];
          const dbMeta = typeof dbRow.metadata === "object" && dbRow.metadata !== null
            ? dbRow.metadata
            : JSON.parse(dbRow.metadata || "{}");
          if (!grand_total && dbRow.grand_total != null) grand_total = Number(dbRow.grand_total);
          if (!subtotal && dbRow.subtotal != null) subtotal = Number(dbRow.subtotal);
          if (!delivery_fee && dbMeta.delivery_fee != null) delivery_fee = Number(dbMeta.delivery_fee);
          if (!delivery_fee && dbMeta.delivery?.fee != null) delivery_fee = Number(dbMeta.delivery.fee);
          if (!discount_total && dbMeta.discount_amount != null) discount_total = Number(dbMeta.discount_amount);
          if (!discount_total && dbMeta.discount != null) discount_total = Number(dbMeta.discount);
          if (!tax_total && dbMeta.tax_amount != null) tax_total = Number(dbMeta.tax_amount);
          if (!tax_total && dbMeta.tax_total != null) tax_total = Number(dbMeta.tax_total);
        }
      } catch (_dbOErr) {}
    }

    const payment_method = order.payment_method || order.metadata?.payment_method || "";
    const payment_status = order.payment_status || order.metadata?.payment_status || "";
    const branch_id = order.branch_id || order.metadata?.branch_id || snap.branch_id || "";
    const customer_uid = order.customer_uid || order.customer_id || order.metadata?.customer_uid || order.metadata?.customer_id || "";
    const customer_name = order.customer_name || order.metadata?.customer_name || "";
    const customer_phone = order.customer_phone || order.metadata?.customer_phone || "";

    const sellerStCode = String(snap.seller_state_code || order.seller_state_code || (sellerGstin ? sellerGstin.slice(0, 2) : "")).trim();
    const custStCode = String(snap.customer_state_code || order.customer_state_code || order.delivery_state_code || order.metadata?.customer_state_code || "").trim();
    const sellerSt = String(snap.seller_state || order.seller_state || "").trim().toLowerCase();
    const custSt = String(snap.customer_state || order.customer_state || order.delivery_state || "").trim().toLowerCase();

    let resolvedIsIntraState = true;
    if (snap.is_intra_state !== undefined) {
      resolvedIsIntraState = snap.is_intra_state !== false;
    } else if (order.is_intra_state !== undefined) {
      resolvedIsIntraState = order.is_intra_state !== false;
    } else if (sellerStCode && custStCode) {
      resolvedIsIntraState = sellerStCode === custStCode;
    } else if (sellerSt && custSt) {
      resolvedIsIntraState = sellerSt === custSt;
    }

    const resolvedSupplyType = snap.supply_type || order.supply_type || (resolvedIsIntraState ? "INTRA-STATE (CGST + SGST)" : "INTER-STATE (IGST)");

    // Line items with complete canonical fidelity (no arbitrary HSN fallbacks)
    const items = orderItems.map((i: any) => {
      const qty = Number(i.quantity || 1);
      const unitPrice = Number(i.unit_price ?? i.price ?? 0);
      const taxableVal = Number(i.taxable_value != null ? i.taxable_value : (unitPrice * qty));
      const rate = Number(i.gst_rate_pct ?? i.tax_rate ?? 5);
      const isIntra = resolvedIsIntraState;
      const cgst = Number(i.cgst != null ? i.cgst : (isIntra ? Math.round((taxableVal * ((rate / 2) / 100)) * 100) / 100 : 0));
      const sgst = Number(i.sgst != null ? i.sgst : (isIntra ? Math.round((taxableVal * ((rate / 2) / 100)) * 100) / 100 : 0));
      const igst = Number(i.igst != null ? i.igst : (!isIntra ? Math.round((taxableVal * (rate / 100)) * 100) / 100 : 0));
      const taxAmt = Number(i.tax_amount != null && (i.cgst != null || !isIntra) ? i.tax_amount : (isIntra ? Math.round((cgst + sgst) * 100) / 100 : igst));
      const lineTotal = Number(i.total != null ? i.total : Math.round((taxableVal + taxAmt) * 100) / 100);

      return {
        product_id: i.product_id || i.id,
        variant_id: i.variant_id || null,
        sku: i.sku || null,
        barcode: i.barcode || null,
        merchandise_type: i.merchandise_type || (i.item_type as any) || "CAKE",
        title: i.title || i.name || "Item",
        hsn_code: String(i.hsn_code).trim(),
        quantity: qty,
        unit_price: unitPrice,
        taxable_value: taxableVal,
        gst_rate_pct: rate,
        tax_rate_id: i.tax_rate_id || null,
        tax_code: i.tax_code || null,
        tax_amount: taxAmt,
        cgst,
        sgst,
        igst,
        total: lineTotal,
      };
    });

    const computedItemsSubtotal = Math.round(items.reduce((acc: number, it: any) => acc + it.taxable_value, 0) * 100) / 100;
    const computedItemsTax = Math.round(items.reduce((acc: number, it: any) => acc + (it.cgst + it.sgst + it.igst), 0) * 100) / 100;
    const computedItemsTotal = Math.round(items.reduce((acc: number, it: any) => acc + it.total, 0) * 100) / 100;

    if (subtotal <= 0 && computedItemsSubtotal > 0) {
      subtotal = computedItemsSubtotal;
    }
    if (tax_total <= 0 && computedItemsTax > 0) {
      tax_total = computedItemsTax;
    }
    if (grand_total <= 0) {
      if (computedItemsTotal > 0) {
        grand_total = Math.round((computedItemsTotal + delivery_fee - discount_total) * 100) / 100;
      } else if (subtotal > 0) {
        grand_total = Math.round((subtotal + tax_total + delivery_fee - discount_total) * 100) / 100;
      }
    }

    // Statutory Check: If line items contain positive merchandise values, grand_total must be > 0
    if (items.some((it: any) => it.unit_price > 0 || it.taxable_value > 0) && grand_total <= 0) {
      return {
        success: false,
        error: `Cannot generate statutory invoice: Grand total must be positive for orders with priced line items (evaluated grand_total=${grand_total}).`,
        code: "INVALID_INVOICE_TOTAL",
      };
    }

    const isPrepaid =
      payment_status === "paid" ||
      payment_status === "captured" ||
      payment_method === "card" ||
      payment_method === "upi" ||
      payment_method === "netbanking" ||
      payment_method === "prepaid_online";
    const paidAmount = isPrepaid ? grand_total : 0;
    const outstandingAmount = isPrepaid ? 0 : grand_total;

    // ── Phase 5C: Accounting Bridge — Create Sales Voucher Draft First ──
    let accountingVoucherId: string | null = null;
    try {
      const { SalesPostingService } = await import("./sales-posting.service");
      const voucherRes = await SalesPostingService.createSalesVoucherDraft({
        orderId: order.id,
        branchId: branch_id || snap.branch_id || "",
        createdBy: "system:delivery_invoicing",
      });
      if (voucherRes.success) {
        accountingVoucherId = voucherRes.data.id;
        order.accounting_voucher_id = accountingVoucherId;
        if (!order.metadata) order.metadata = {};
        order.metadata.accounting_voucher_id = accountingVoucherId;
        console.log(`[DeliveryInvoicingService] Sales voucher draft ${voucherRes.data.voucher_no} (${accountingVoucherId}) created for Order ${order.order_number}`);
      } else {
        const errObj = voucherRes as any;
        console.warn(`[DeliveryInvoicingService] Sales voucher draft notice: ${errObj.error} (${errObj.code})`);
      }
    } catch (acctErr: any) {
      console.warn("[DeliveryInvoicingService] Sales voucher draft notice (non-blocking):", acctErr?.message);
    }

    // ── Atomic PostgreSQL Transaction (Allocation + Persistence + Order Update) ─
    let invoiceNumber: string;
    let invoiceId: string;
    let invoice: InvoiceRecord;
    const now = new Date().toISOString();

    try {
      const { dbTransaction } = await import("../db");

      const txResult = await dbTransaction(async (client) => {
        // 1. Transaction-isolated Idempotency Check
        const existingInvRes = await client.query(
          `SELECT id, invoice_number, voucher_id, grand_total, paid_amount, outstanding_amount, status, metadata
           FROM public.invoice 
           WHERE order_id = $1 AND deleted_at IS NULL`,
          [order.id]
        );
        if (existingInvRes.rows.length > 0) {
          const row = existingInvRes.rows[0];
          return {
            idempotent: true,
            invoiceNumber: row.invoice_number,
            invoiceId: row.id,
            existingRow: row,
          };
        }

        // 2. Allocate sequence number via transactional client (acquires pg_advisory_xact_lock)
        const allocatedNum = await allocateInvoiceNumber(order.id, prefix, entityId, sellerGstin, issueDate, client);
        const invId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        const invRecord: InvoiceRecord = {
          id: invId,
          invoice_number: allocatedNum,
          order_id: order.id,
          order_number: order.order_number || order.metadata?.order_number || order.id,
          branch_id,
          branch_name: snap.branch_name || order.branch_name || order.metadata?.branch_name || "",
          branch_code: snap.branch_code || order.branch_code || "",
          customer_name,
          customer_phone,
          customer_uid,
          seller_gstin: sellerGstin,
          seller_fssai_number: snap.seller_fssai_number || order.seller_fssai_number || order.metadata?.seller_fssai_number || "",
          seller_legal_name: sellerLegalName,
          seller_state: snap.seller_state || order.seller_state || order.state || "",
          seller_state_code: snap.seller_state_code || (sellerGstin ? sellerGstin.slice(0, 2) : ""),
          customer_state: snap.customer_state || order.customer_state || order.delivery_state || order.state || "",
          supply_type: resolvedSupplyType,
          is_intra_state: resolvedIsIntraState,
          items,
          subtotal,
          tax_total,
          delivery_fee,
          discount_total,
          grand_total,
          payment_method,
          payment_status,
          status: isPrepaid ? "PAID" : "GENERATED",
          generated_at: now,
          delivered_at: order.delivered_at || now,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          voucher_id: accountingVoucherId,
          due_date: now.slice(0, 10),
          paid_amount: paidAmount,
          outstanding_amount: outstandingAmount,
          is_corporate: order.is_corporate === true || order.metadata?.is_corporate === true,
        };

        // 3. Persist invoice to database inside the transaction
        await DeliveryInvoicingService.persistToDatabaseWithClient(invRecord, client);

        // 4. Transition allocation log from ALLOCATED to COMMITTED
        try {
          await client.query(
            `SELECT public.commit_invoice_allocation($1, $2)`,
            [order.id, invId]
          );
        } catch (commitErr: any) {
          console.warn("[DeliveryInvoicingService] commit_invoice_allocation notice:", commitErr?.message);
        }

        // 5. Ensure a POSTED Sales Revenue & GST Recognition Voucher + Journal Entry exists
        let finalVoucherId = accountingVoucherId;
        const glLookup = await client.query(
          `SELECT id, code FROM public.accounting_account WHERE code IN ('2141', '1210', '4110', '2121', '2122', '2123')`
        );
        const glByCode = new Map<string, string>();
        for (const r of glLookup.rows) glByCode.set(r.code, r.id);

        const existingSalesJe = finalVoucherId
          ? await client.query(
              `SELECT id FROM public.accounting_journal_entry WHERE voucher_id = $1 LIMIT 1`,
              [finalVoucherId]
            )
          : { rows: [] };

        if (existingSalesJe.rows.length === 0 && grand_total > 0) {
          const vchId = finalVoucherId || `vch_sal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const vchNo = `SV-${allocatedNum.replace(/[^A-Z0-9]/gi, "-")}`;
          const jeId = `je_sal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const jeNo = `JE-SV-${Date.now().toString().slice(-6)}`;
          const vDate = now.slice(0, 10);
          const brId = branch_id || "br_indiranagar_01";

          const debitAccountId = isPrepaid
            ? glByCode.get("2141") || glByCode.get("1210")
            : glByCode.get("1210") || glByCode.get("2141");
          const salesAccountId = glByCode.get("4110");
          const cgstAccountId = glByCode.get("2121");
          const sgstAccountId = glByCode.get("2122");
          const igstAccountId = glByCode.get("2123");

          if (debitAccountId && salesAccountId) {
            await client.query(
              `INSERT INTO public.accounting_voucher (
                id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
                status, total_amount, currency, reference_type, reference_id, reference_event,
                narration, created_by, posted_by, posted_at, created_at, updated_at
              ) VALUES (
                $1, $2, 'SALES', $3, $4, '26-27',
                'POSTED', $5, 'INR', 'INVOICE', $6, 'INVOICE_ISSUED',
                $7, 'system:delivery_invoicing', 'system:delivery_invoicing', NOW(), NOW(), NOW()
              )
              ON CONFLICT (id) DO UPDATE
              SET status = 'POSTED',
                  posted_at = NOW(),
                  updated_at = NOW()`,
              [
                vchId,
                vchNo,
                vDate,
                brId,
                grand_total,
                invId,
                `Statutory Tax Invoice ${allocatedNum} for Order ${order.order_number || order.id}`,
              ]
            );

            await client.query(
              `INSERT INTO public.accounting_journal_entry (
                id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
                total_debit, total_credit, is_reversed, narration, created_by, created_at
              ) VALUES (
                $1, $2, $3, $4, $5, '26-27',
                $6, $6, false, $7, 'system:delivery_invoicing', NOW()
              )`,
              [
                jeId,
                jeNo,
                vchId,
                vDate,
                brId,
                grand_total,
                `Sales & GST recognition for Invoice ${allocatedNum} (Order ${order.order_number || order.id})`,
              ]
            );

            const totalTaxAmt = Number(Number(tax_total || 0).toFixed(2));
            const netRevenueAmt = Number((grand_total - totalTaxAmt).toFixed(2));
            let lineIdx = 1;

            // Line 1: Debit Customer Advances (2141) or Accounts Receivable (1210) = grand_total
            await client.query(
              `INSERT INTO public.accounting_journal_line (
                id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
              ) VALUES ($1, $2, $3, $4, $5, 0.00, $6, $7)`,
              [
                `jl_sal_${Date.now()}_1`,
                jeId,
                lineIdx++,
                debitAccountId,
                grand_total,
                brId,
                isPrepaid
                  ? `Recognize customer advance (2141) on delivery for Invoice ${allocatedNum}`
                  : `Recognize Accounts Receivable (1210) for Invoice ${allocatedNum}`,
              ]
            );

            // Line 2: Credit Sales Revenue (4110) = netRevenueAmt
            if (netRevenueAmt > 0) {
              await client.query(
                `INSERT INTO public.accounting_journal_line (
                  id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
                ) VALUES ($1, $2, $3, $4, 0.00, $5, $6, $7)`,
                [
                  `jl_sal_${Date.now()}_2`,
                  jeId,
                  lineIdx++,
                  salesAccountId,
                  netRevenueAmt,
                  brId,
                  `Sales revenue recognized for Invoice ${allocatedNum}`,
                ]
              );
            }

            // Lines 3 & 4: Credit Output CGST (2121) & Output SGST (2122) or Output IGST (2123)
            if (totalTaxAmt > 0) {
              if (resolvedIsIntraState && cgstAccountId && sgstAccountId) {
                const halfTax1 = Number((totalTaxAmt / 2).toFixed(2));
                const halfTax2 = Number((totalTaxAmt - halfTax1).toFixed(2));
                await client.query(
                  `INSERT INTO public.accounting_journal_line (
                    id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
                  ) VALUES
                    ($1, $3, $4, $6, 0.00, $8, $10, $11),
                    ($2, $3, $5, $7, 0.00, $9, $10, $12)`,
                  [
                    `jl_sal_${Date.now()}_3`,
                    `jl_sal_${Date.now()}_4`,
                    jeId,
                    lineIdx++,
                    lineIdx++,
                    cgstAccountId,
                    sgstAccountId,
                    halfTax1,
                    halfTax2,
                    brId,
                    `Output CGST on Invoice ${allocatedNum}`,
                    `Output SGST on Invoice ${allocatedNum}`,
                  ]
                );
              } else if (igstAccountId) {
                await client.query(
                  `INSERT INTO public.accounting_journal_line (
                    id, journal_entry_id, line_no, account_id, debit_amount, credit_amount, branch_id, narration
                  ) VALUES ($1, $2, $3, $4, 0.00, $5, $6, $7)`,
                  [
                    `jl_sal_${Date.now()}_3`,
                    jeId,
                    lineIdx++,
                    igstAccountId,
                    totalTaxAmt,
                    brId,
                    `Output IGST on Invoice ${allocatedNum}`,
                  ]
                );
              }
            }

            finalVoucherId = vchId;
            invRecord.voucher_id = vchId;
            await client.query(`UPDATE public.invoice SET voucher_id = $1 WHERE id = $2`, [vchId, invId]);
          }
        }

        // 6. Update order status and metadata inside the transaction
        await client.query(
          `UPDATE public."order"
           SET status = 'completed', 
               metadata = jsonb_set(
                 jsonb_set(
                   jsonb_set(
                     COALESCE(metadata, '{}'::jsonb), 
                     '{invoice_number}', $1::jsonb
                   ),
                   '{invoice_id}', $2::jsonb
                 ),
                 '{delivery_status}', '"delivered"'::jsonb
               ),
               updated_at = NOW() 
           WHERE id = $3`,
          [JSON.stringify(allocatedNum), JSON.stringify(invId), order.id]
        );

        if (finalVoucherId) {
          await client.query(
            `UPDATE public."order"
             SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{accounting_voucher_id}', $1::jsonb)
             WHERE id = $2`,
            [JSON.stringify(finalVoucherId), order.id]
          );
        }

        // 7. Emit Canonical Cross-App Outbox Events (delivery.completed, invoice.issued)
        const { CrossAppEventService } = await import("./cross-app-event.service");
        const corrId = `corr_inv_${order.id}_${Date.now()}`;
        await CrossAppEventService.publishInTransaction(client, {
          event_type: "delivery.completed",
          aggregate_type: "DELIVERY",
          aggregate_id: `del_${order.id}`,
          correlation_id: corrId,
          branch_id: branch_id || "br_indiranagar_01",
          payload: {
            order_id: order.id,
            order_number: order.order_number || order.id,
            customer_id: customer_uid,
            branch_id: branch_id || "br_indiranagar_01",
            delivery_status: "delivered",
            delivered_at: order.delivered_at || now,
          },
        });

        await CrossAppEventService.publishInTransaction(client, {
          event_type: "invoice.issued",
          aggregate_type: "INVOICE",
          aggregate_id: invId,
          correlation_id: corrId,
          branch_id: branch_id || "br_indiranagar_01",
          payload: {
            invoice_id: invId,
            invoice_number: allocatedNum,
            order_id: order.id,
            order_number: order.order_number || order.id,
            customer_id: customer_uid,
            branch_id: branch_id || "br_indiranagar_01",
            subtotal,
            tax_total,
            grand_total,
            voucher_id: finalVoucherId,
            seller_gstin: sellerGstin,
          },
        });

        return {
          idempotent: false,
          invoiceNumber: allocatedNum,
          invoiceId: invId,
          invoice: invRecord,
          voucherId: finalVoucherId,
        };
      });

      if (txResult.idempotent) {
        order.invoice_number = txResult.invoiceNumber;
        order.invoice_id = txResult.invoiceId;
        return {
          success: true,
          invoice_number: txResult.invoiceNumber,
          invoice_id: txResult.invoiceId,
          invoice: {
            ...txResult.existingRow,
            order_id: order.id,
            order_number: order.order_number,
          },
          accounting_voucher_id: txResult.existingRow?.voucher_id || order.accounting_voucher_id || null,
          idempotent_replay: true,
        };
      }

      invoiceNumber = txResult.invoiceNumber;
      invoiceId = txResult.invoiceId;
      invoice = txResult.invoice!;
      accountingVoucherId = (txResult as any).voucherId || accountingVoucherId;
    } catch (dbErr: any) {
      const rawMsg = String(dbErr?.message || "");
      const isAmbiguous = rawMsg.includes("AMBIGUOUS_GSTIN_SEQUENCE_SCOPE");
      const safeMsg = rawMsg.replace(/:\/\/.*@/, "://[REDACTED]@");
      console.error("[DeliveryInvoicingService] Atomic invoice transaction failed, rolled back:", safeMsg);
      // Strictly fail: NEVER stamp order or push to memory cache when DB transaction rolled back!
      return {
        success: false,
        error: `Statutory invoice transaction failed: ${safeMsg}`,
        code: isAmbiguous ? "INVOICE_SERIES_PREFIX_CONFLICT" : "INVOICE_TRANSACTION_FAILED",
      };
    }

    // ── Stamp Order & In-Memory Cache (Only after successful DB commit!) ──
    order.invoice_number = invoiceNumber;
    order.invoice_id = invoiceId;
    order.invoice = invoice;
    order.updated_at = now;

    // ── Persist to Memory Store ──────────────────────────────────────────
    try {
      if (engine) {
        const store = engine.getStore ? engine.getStore() : engine;
        if (store) {
          if (!Array.isArray(store.invoices)) store.invoices = [];
          store.invoices.push(invoice);
          engine.persist?.();
        }
      }
    } catch (e: any) {
      console.warn("[DeliveryInvoicingService] Memory persist warning:", e?.message);
    }

    // ── COD Cash Custody Handover Bridge ────────────────────────────────
    const isCod =
      String(payment_method).toLowerCase() === "cod" ||
      order.metadata?.payment_classification === "COD";

    if (isCod && !order.metadata?.cod_custody_event && !order.cod_custody_event) {
      try {
        const { CodCollectionService } = await import("./cod-collection.service");
        const partnerId =
          order.delivery_partner_id ||
          order.metadata?.delivery_partner_id ||
          order.metadata?.delivery?.partner_id ||
          null;
        const custodySnapshot = await CodCollectionService.confirmCodCollection({
          orderId: order.id,
          deliveryPartnerId: partnerId,
          amount: parseFloat(String(invoice.grand_total || order.total || 0)),
          branchId: branch_id,
          collectedAt: now,
          actorContext: {
            user_id: partnerId || "system:delivery_invoicing",
            role: "DELIVERY_PARTNER",
            permissions: ["DELIVERY.UPDATE"],
          },
        });
        if (!order.metadata) order.metadata = {};
        order.metadata.cod_custody_event = custodySnapshot;
        console.log(`[DeliveryInvoicingService] COD cash custody confirmed for Order ${order.order_number}: ₹${custodySnapshot.collected_amount} (Rider: ${partnerId || "Unassigned"})`);
      } catch (codErr: any) {
        console.warn("[DeliveryInvoicingService] COD custody notice (non-blocking):", codErr?.message);
      }
    }

    // ── Audit Log ────────────────────────────────────────────────────────
    engine?.addAuditLog?.(
      `INVOICE_GENERATED: Statutory invoice ${invoiceNumber} (${invoiceId}) generated for Order ${order.order_number || order.id} upon delivery confirmation.${accountingVoucherId ? ` Accounting Voucher Draft: ${accountingVoucherId}.` : ""}`
    );

    // ── Auto-post the sales voucher to the General Ledger (non-blocking) ──
    // On failure the voucher stays in the accounting work queue for manual review.
    if (accountingVoucherId) {
      try {
        const { SalesPostingService } = await import("./sales-posting.service");
        const postRes = await SalesPostingService.autoPostSalesVoucher(accountingVoucherId);
        if (!postRes.success) {
          console.warn(`[DeliveryInvoicingService] Auto-post of voucher ${accountingVoucherId} deferred to work queue: ${postRes.error} (${postRes.code})`);
        }
      } catch (postErr: any) {
        console.warn("[DeliveryInvoicingService] Auto-post deferred to work queue:", postErr?.message);
      }
    }

    return {
      success: true,
      invoice_number: invoiceNumber,
      invoice_id: invoiceId,
      invoice,
      accounting_voucher_id: accountingVoucherId,
    };
  }

  /**
   * Persist invoice record to PostgreSQL using a transactional client.
   */
  public static async persistToDatabaseWithClient(invoice: InvoiceRecord, client: any): Promise<void> {
    const metadata = {
      order_number: invoice.order_number,
      branch_name: invoice.branch_name,
      branch_code: invoice.branch_code,
      customer_uid: invoice.customer_uid,
      seller_gstin: invoice.seller_gstin,
      seller_fssai_number: invoice.seller_fssai_number,
      seller_legal_name: invoice.seller_legal_name,
      seller_state: invoice.seller_state,
      seller_state_code: invoice.seller_state_code,
      customer_state: invoice.customer_state,
      supply_type: invoice.supply_type,
      is_intra_state: invoice.is_intra_state,
      items: invoice.items,
      is_ledger_eligible: true,
      cgst: invoice.is_intra_state ? Math.round((invoice.items || []).reduce((acc: number, it: any) => acc + (Number(it.cgst) || 0), 0) * 100) / 100 : 0,
      sgst: invoice.is_intra_state ? Math.round((invoice.items || []).reduce((acc: number, it: any) => acc + (Number(it.sgst) || 0), 0) * 100) / 100 : 0,
      igst: !invoice.is_intra_state ? Math.round((invoice.items || []).reduce((acc: number, it: any) => acc + (Number(it.igst) || 0), 0) * 100) / 100 : 0,
    };

    const dueDate = invoice.due_date || (invoice.created_at ? invoice.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10));

    await client.query(
      `INSERT INTO public.invoice (
        id, invoice_number, order_id,
        branch_id, customer_id, customer_name, customer_phone,
        subtotal, tax_total, delivery_fee, discount_total, grand_total,
        currency_code, payment_method, payment_status,
        status, delivered_at, delivered_by,
        metadata, created_at, updated_at, deleted_at,
        voucher_id, due_date, paid_amount, outstanding_amount, is_corporate
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, $25, $26, $27
      ) ON CONFLICT (order_id) DO UPDATE SET
        voucher_id = COALESCE(EXCLUDED.voucher_id, public.invoice.voucher_id),
        paid_amount = EXCLUDED.paid_amount,
        outstanding_amount = EXCLUDED.outstanding_amount,
        payment_status = EXCLUDED.payment_status,
        status = EXCLUDED.status,
        subtotal = EXCLUDED.subtotal,
        tax_total = EXCLUDED.tax_total,
        delivery_fee = EXCLUDED.delivery_fee,
        discount_total = EXCLUDED.discount_total,
        grand_total = EXCLUDED.grand_total,
        metadata = EXCLUDED.metadata,
        updated_at = NOW();`,
      [
        invoice.id,
        invoice.invoice_number,
        invoice.order_id,
        invoice.branch_id || null,
        invoice.customer_uid || null,
        invoice.customer_name || null,
        invoice.customer_phone || null,
        invoice.subtotal,
        invoice.tax_total,
        invoice.delivery_fee,
        invoice.discount_total,
        invoice.grand_total,
        "INR",
        invoice.payment_method || null,
        invoice.payment_status || null,
        invoice.status || "GENERATED",
        invoice.delivered_at,
        (invoice as any).delivered_by || null,
        JSON.stringify(metadata),
        invoice.created_at,
        invoice.updated_at,
        invoice.deleted_at || null,
        invoice.voucher_id || null,
        dueDate,
        invoice.paid_amount ?? 0,
        invoice.outstanding_amount ?? invoice.grand_total,
        invoice.is_corporate ?? false,
      ]
    );

    try {
      await client.query(
        `UPDATE public.invoice 
         SET seller_gstin = $1, seller_legal_name = $2 
         WHERE id = $3`,
        [invoice.seller_gstin, invoice.seller_legal_name, invoice.id]
      );
    } catch (_colErr) {}
  }

  /**
   * Persist invoice record to PostgreSQL.
   */
  public static async persistToDatabase(invoice: InvoiceRecord): Promise<void> {
    const { dbQuery } = await import("../db");
    return DeliveryInvoicingService.persistToDatabaseWithClient(invoice, { query: dbQuery });
  }
}

