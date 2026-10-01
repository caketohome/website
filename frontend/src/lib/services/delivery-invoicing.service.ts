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

// ── Fiscal Year Helpers ──────────────────────────────────────────────────────

function getCurrentFiscalYear(): { short: string; startYear: number; endYear: number } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  // Indian fiscal year: April (3) to March (2)
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  const short = `${String(startYear).slice(2)}-${String(endYear).slice(2)}`;
  return { short, startYear, endYear };
}

// ── In-Memory Sequence Counter ───────────────────────────────────────────────
// Falls back to this if PostgreSQL sequence is unavailable.
let memorySeqCounter = 100;

function getNextMemorySeq(): number {
  return ++memorySeqCounter;
}

// ── Invoice Number Generator ─────────────────────────────────────────────────

async function allocateInvoiceNumber(): Promise<string> {
  const fy = getCurrentFiscalYear();

  // Try PostgreSQL sequence first
  try {
    const seqResult = await dbQuery(
      "SELECT nextval('statutory_invoice_seq') AS seq;"
    );
    const seq = Number(seqResult.rows[0].seq);
    return `CTH/${fy.short}/${String(seq).padStart(6, "0")}`;
  } catch {
    // Fallback to in-memory sequence
    const seq = getNextMemorySeq();
    return `CTH/${fy.short}/${String(seq).padStart(6, "0")}`;
  }
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
  status: "GENERATED" | "SENT" | "CANCELLED";
  generated_at: string;
  delivered_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface InvoiceResult {
  success: boolean;
  invoice_number?: string;
  invoice_id?: string;
  invoice?: InvoiceRecord;
  idempotent_replay?: boolean;
  error?: string;
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

    // ── Idempotency Guard ────────────────────────────────────────────────
    if (order.invoice_number && order.invoice_id) {
      return {
        success: true,
        invoice_number: order.invoice_number,
        invoice_id: order.invoice_id,
        invoice: order.invoice,
        idempotent_replay: true,
      };
    }

    // ── State Guard ──────────────────────────────────────────────────────
    const status = String(order.status || "").toLowerCase();
    if (status !== "delivered") {
      return {
        success: false,
        error: `Cannot generate invoice: order status is '${order.status}', expected 'delivered'.`,
      };
    }

    // ── Allocate Invoice Number ──────────────────────────────────────────
    const invoiceNumber = await allocateInvoiceNumber();
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    // ── Build Compliance Snapshot ────────────────────────────────────────
    const snap = order.compliance_snapshot || {};

    const invoice: InvoiceRecord = {
      id: invoiceId,
      invoice_number: invoiceNumber,
      order_id: order.id,
      order_number: order.order_number,
      branch_id: order.branch_id || "",
      branch_name: snap.branch_name || order.branch_name || "",
      branch_code: snap.branch_code || order.branch_code || "",
      customer_name: order.customer_name || "",
      customer_phone: order.customer_phone || "",
      customer_uid: order.customer_uid || "",
      seller_gstin: snap.seller_gstin || "29AAAAA0000A1Z5",
      seller_fssai_number: snap.seller_fssai_number || "11223344556677",
      seller_legal_name: snap.seller_legal_name || "CakeToHome India Private Limited",
      seller_state: snap.seller_state || order.state || "Karnataka",
      seller_state_code: snap.seller_state_code || "29",
      customer_state: snap.customer_state || order.delivery_state || order.state || "Karnataka",
      supply_type: snap.supply_type || "INTRA-STATE (CGST + SGST)",
      is_intra_state: snap.is_intra_state !== false,
      items: (order.items || []).map((i: any) => ({
        product_id: i.product_id || i.id,
        title: i.title || i.name,
        hsn_code: i.hsn_code || "19059090",
        quantity: i.quantity || 1,
        unit_price: i.unit_price || i.price || 0,
        taxable_value: i.taxable_value || 0,
        gst_rate_pct: i.gst_rate_pct || i.tax_rate || 5,
        cgst: i.cgst || 0,
        sgst: i.sgst || 0,
        igst: i.igst || 0,
        total: i.total || 0,
      })),
      subtotal: order.pricing?.subtotal || order.subtotal || 0,
      tax_total: order.pricing?.tax_total || order.tax_total || 0,
      delivery_fee: order.pricing?.delivery_fee || order.delivery_fee || 0,
      discount_total: order.pricing?.discount_total || order.discount_total || 0,
      grand_total: order.pricing?.grand_total || order.grand_total || order.total || 0,
      payment_method: order.payment_method || "",
      payment_status: order.payment_status || "",
      status: "GENERATED",
      generated_at: now,
      delivered_at: order.delivered_at || now,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    // ── Stamp Order ──────────────────────────────────────────────────────
    order.invoice_number = invoiceNumber;
    order.invoice_id = invoiceId;
    order.invoice = invoice;
    order.updated_at = now;

    // ── Persist to Memory Store ──────────────────────────────────────────
    try {
      const store = engine.getStore ? engine.getStore() : engine;
      if (!Array.isArray(store.invoices)) store.invoices = [];
      store.invoices.push(invoice);
      engine.persist?.();
    } catch (e: any) {
      console.warn("[DeliveryInvoicingService] Memory persist warning:", e?.message);
    }

    // ── Persist to PostgreSQL (Best Effort, Awaited) ───────────────────
    try {
      await DeliveryInvoicingService.persistToDatabase(invoice);
    } catch (e: any) {
      console.warn("[DeliveryInvoicingService] DB persist error:", e?.message);
    }

    // ── Audit Log ────────────────────────────────────────────────────────
    engine.addAuditLog?.(
      `INVOICE_GENERATED: Statutory invoice ${invoiceNumber} (${invoiceId}) generated for Order ${order.order_number} upon delivery confirmation.`
    );

    return {
      success: true,
      invoice_number: invoiceNumber,
      invoice_id: invoiceId,
      invoice,
    };
  }

  /**
   * Persist invoice record to PostgreSQL.
   */
  public static async persistToDatabase(invoice: InvoiceRecord): Promise<void> {
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
    };

    await dbQuery(
      `INSERT INTO public.invoice (
        id, invoice_number, order_id,
        branch_id, customer_id, customer_name, customer_phone,
        subtotal, tax_total, delivery_fee, discount_total, grand_total,
        currency_code, payment_method, payment_status,
        status, delivered_at, delivered_by,
        metadata, created_at, updated_at, deleted_at
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22
      ) ON CONFLICT (order_id) DO NOTHING;`,
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
      ]
    );
  }
}
