/**
 * CakeToHome ERP — Purchase Repository
 * Phase 1: Database access layer for purchase, purchase_item, purchase_payment tables.
 *
 * ARCHITECTURE:
 * - branch_id always enforced by caller (service layer) — never from client input
 * - All monetary totals validated server-side (not trusted from input)
 * - Lifecycle: DRAFT → SUBMITTED → APPROVED → POSTED (forward-only with exceptions)
 * - Atomic writes via dbTransaction: purchase + items inserted together
 * - Report queries aggregate from canonical purchase data — no fabrication
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import type {
  PurchaseRow,
  PurchaseItemRow,
  PurchasePaymentRow,
  PurchaseCreateInput,
  PurchaseUpdateInput,
  PurchaseListFilters,
  PurchaseListResult,
  PurchasePaymentInput,
  PurchaseStatus,
  PurchaseRegisterRow,
  SupplierPurchaseSummaryRow,
  ItemWisePurchaseRow,
  BillWisePurchaseRow,
  PurchaseGstHsnRow,
  PurchaseReportFilters,
} from "../types/purchase.types";

// ─── ID Generation ──────────────────────────────────────────────────────────────

function generatePurchaseId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `pur_${ts}${rnd}`;
}

function generateItemId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `puri_${ts}${rnd}`;
}

function generatePaymentId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `purp_${ts}${rnd}`;
}

// ─── Date filter helper ────────────────────────────────────────────────────────

function buildDateFilter(
  alias: string,
  column: string,
  filters: PurchaseReportFilters,
  conditions: string[],
  params: unknown[],
  idx: number
): number {
  if (filters.startDate) {
    conditions.push(`${alias}.${column} >= $${idx++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`${alias}.${column} <= $${idx++}`);
    params.push(filters.endDate);
  }
  return idx;
}

// ─── PurchaseRepository ────────────────────────────────────────────────────────

export class PurchaseRepository {
  // ── CREATE ──────────────────────────────────────────────────────────────────

  /**
   * Create a new purchase with its line items, atomically.
   * branch_id comes from the session — never from client input.
   * Payments are NOT inserted at creation (separate addPayment call).
   */
  static async create(
    input: PurchaseCreateInput,
    branchId: string,
    createdBy: string
  ): Promise<PurchaseRow> {
    const purchaseId = generatePurchaseId();

    return dbTransaction(async (client) => {
      // Insert purchase header
      const insertPurchaseSql = `
        INSERT INTO public.purchase
          (id, supplier_id, branch_id, invoice_no, invoice_date,
           subtotal, discount, taxable_value, cgst, sgst, igst, total,
           payment_method, credit_terms_days, due_date,
           status, created_by, metadata, created_at, updated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'DRAFT',$16,$17,NOW(),NOW())
        RETURNING *
      `;
      const purchaseParams = [
        purchaseId,
        input.supplier_id ?? null,
        branchId,
        input.invoice_no ?? null,
        input.invoice_date ?? null,
        input.subtotal,
        input.discount ?? 0,
        input.taxable_value,
        input.cgst ?? 0,
        input.sgst ?? 0,
        input.igst ?? 0,
        input.total,
        input.payment_method ?? null,
        input.credit_terms_days ?? null,
        input.due_date ?? null,
        createdBy,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ];
      const purchaseResult = await client.query(insertPurchaseSql, purchaseParams);
      const purchase = purchaseResult.rows[0] as PurchaseRow;

      // Insert line items
      const items: PurchaseItemRow[] = [];
      for (const item of input.items) {
        const itemId = generateItemId();
        const insertItemSql = `
          INSERT INTO public.purchase_item
            (id, purchase_id, product_id, variant_id, description,
             quantity, rate, discount, taxable_value,
             cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst,
             total, hsn_code, created_at, updated_at)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
          RETURNING *
        `;
        const itemParams = [
          itemId, purchaseId,
          item.product_id ?? null, item.variant_id ?? null,
          item.description, item.quantity, item.rate,
          item.discount ?? 0, item.taxable_value,
          item.cgst_rate ?? null, item.sgst_rate ?? null, item.igst_rate ?? null,
          item.cgst ?? null, item.sgst ?? null, item.igst ?? null,
          item.total, item.hsn_code ?? null,
        ];
        const itemResult = await client.query(insertItemSql, itemParams);
        items.push(itemResult.rows[0] as PurchaseItemRow);
      }

      return { ...purchase, items, payments: [] };
    });
  }

  // ── READ ────────────────────────────────────────────────────────────────────

  static async findById(id: string, branchId?: string): Promise<PurchaseRow | null> {
    const conditions = ["p.id = $1", "p.deleted_at IS NULL"];
    const params: unknown[] = [id];
    if (branchId) {
      conditions.push("p.branch_id = $2");
      params.push(branchId);
    }

    const sql = `
      SELECT p.*,
             s.name AS supplier_name,
             b.name AS branch_name
      FROM public.purchase p
      LEFT JOIN public.supplier s ON s.id = p.supplier_id AND s.deleted_at IS NULL
      LEFT JOIN public.branch   b ON b.id = p.branch_id
      WHERE ${conditions.join(" AND ")}
    `;
    const result = await dbQuery<PurchaseRow>(sql, params as any[]);
    if (!result.rows[0]) return null;

    const purchase = result.rows[0];

    // Fetch items and payments
    const [itemsResult, paymentsResult] = await Promise.all([
      dbQuery<PurchaseItemRow>(
        "SELECT * FROM public.purchase_item WHERE purchase_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC",
        [id]
      ),
      dbQuery<PurchasePaymentRow>(
        "SELECT * FROM public.purchase_payment WHERE purchase_id = $1 AND deleted_at IS NULL ORDER BY payment_date ASC",
        [id]
      ),
    ]);

    return {
      ...purchase,
      items: itemsResult.rows,
      payments: paymentsResult.rows,
    };
  }

  static async list(filters: PurchaseListFilters = {}): Promise<PurchaseListResult> {
    const conditions: string[] = ["p.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.branch_id) {
      conditions.push(`p.branch_id = $${idx++}`);
      params.push(filters.branch_id);
    }
    if (filters.supplier_id) {
      conditions.push(`p.supplier_id = $${idx++}`);
      params.push(filters.supplier_id);
    }
    if (filters.status) {
      conditions.push(`p.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.startDate) {
      conditions.push(`p.invoice_date >= $${idx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`p.invoice_date <= $${idx++}`);
      params.push(filters.endDate);
    }
    if (filters.search) {
      conditions.push(`(p.invoice_no ILIKE $${idx} OR s.name ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.join(" AND ");
    const limit = Math.min(filters.limit ?? 50, 500);
    const offset = filters.offset ?? 0;

    const baseSql = `
      FROM public.purchase p
      LEFT JOIN public.supplier s ON s.id = p.supplier_id AND s.deleted_at IS NULL
      LEFT JOIN public.branch   b ON b.id = p.branch_id
      WHERE ${where}
    `;

    const [dataResult, countResult] = await Promise.all([
      dbQuery<PurchaseRow>(
        `SELECT p.*, s.name AS supplier_name, b.name AS branch_name
         ${baseSql}
         ORDER BY p.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
      dbQuery<{ count: string }>(
        `SELECT COUNT(*) ${baseSql}`,
        params as any[]
      ),
    ]);

    return {
      purchases: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? "0"),
    };
  }

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  /**
   * Update a purchase (DRAFT only — cannot edit SUBMITTED/APPROVED/POSTED).
   * Replaces items if provided (delete old soft-deleted + insert new).
   * Branch scope enforced: branchId must match the purchase record.
   */
  static async update(
    id: string,
    input: PurchaseUpdateInput,
    branchId: string
  ): Promise<PurchaseRow | null> {
    return dbTransaction(async (client) => {
      // Verify ownership and status
      const existing = await client.query(
        "SELECT id, status, branch_id FROM public.purchase WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL",
        [id, branchId]
      );
      if (!existing.rows[0]) return null;
      if (existing.rows[0].status !== "DRAFT") {
        throw new Error(`Cannot edit purchase in status '${existing.rows[0].status}'. Only DRAFT purchases can be edited.`);
      }

      // Build update sets
      const sets: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;

      const addField = (col: string, val: unknown) => { sets.push(`${col} = $${pIdx++}`); params.push(val); };

      if (input.supplier_id !== undefined)       addField("supplier_id",       input.supplier_id ?? null);
      if (input.invoice_no !== undefined)         addField("invoice_no",         input.invoice_no ?? null);
      if (input.invoice_date !== undefined)       addField("invoice_date",       input.invoice_date ?? null);
      if (input.subtotal !== undefined)           addField("subtotal",           input.subtotal);
      if (input.discount !== undefined)           addField("discount",           input.discount ?? 0);
      if (input.taxable_value !== undefined)      addField("taxable_value",      input.taxable_value);
      if (input.cgst !== undefined)               addField("cgst",               input.cgst ?? 0);
      if (input.sgst !== undefined)               addField("sgst",               input.sgst ?? 0);
      if (input.igst !== undefined)               addField("igst",               input.igst ?? 0);
      if (input.total !== undefined)              addField("total",              input.total);
      if (input.payment_method !== undefined)     addField("payment_method",     input.payment_method ?? null);
      if (input.credit_terms_days !== undefined)  addField("credit_terms_days",  input.credit_terms_days ?? null);
      if (input.due_date !== undefined)           addField("due_date",           input.due_date ?? null);
      if (input.metadata !== undefined)           addField("metadata",           input.metadata ? JSON.stringify(input.metadata) : null);

      if (sets.length > 0) {
        sets.push("updated_at = NOW()");
        params.push(id);
        await client.query(
          `UPDATE public.purchase SET ${sets.join(", ")} WHERE id = $${pIdx} AND deleted_at IS NULL`,
          params
        );
      }

      // Replace items if provided
      if (input.items) {
        await client.query(
          "UPDATE public.purchase_item SET deleted_at = NOW() WHERE purchase_id = $1 AND deleted_at IS NULL",
          [id]
        );
        for (const item of input.items) {
          const itemId = generateItemId();
          await client.query(`
            INSERT INTO public.purchase_item
              (id, purchase_id, product_id, variant_id, description,
               quantity, rate, discount, taxable_value,
               cgst_rate, sgst_rate, igst_rate, cgst, sgst, igst,
               total, hsn_code, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW(),NOW())
          `, [
            itemId, id,
            item.product_id ?? null, item.variant_id ?? null,
            item.description, item.quantity, item.rate,
            item.discount ?? 0, item.taxable_value,
            item.cgst_rate ?? null, item.sgst_rate ?? null, item.igst_rate ?? null,
            item.cgst ?? null, item.sgst ?? null, item.igst ?? null,
            item.total, item.hsn_code ?? null,
          ]);
        }
      }

      return null; // caller fetches fresh via findById
    });
  }

  // ── STATUS TRANSITION ──────────────────────────────────────────────────────

  /**
   * Transition status. Validates lifecycle rules.
   * approved_by set on APPROVED, posted_at set on POSTED.
   * Branch scope enforced if branchId provided.
   */
  static async transitionStatus(
    id: string,
    newStatus: PurchaseStatus,
    userId: string,
    branchId?: string
  ): Promise<{ success: boolean; error?: string; purchase?: PurchaseRow }> {
    const conditions = ["id = $1", "deleted_at IS NULL"];
    const params: unknown[] = [id];
    if (branchId) { conditions.push("branch_id = $2"); params.push(branchId); }

    const existing = await dbQuery<{ id: string; status: PurchaseStatus }>(
      `SELECT id, status FROM public.purchase WHERE ${conditions.join(" AND ")}`,
      params as any[]
    );
    if (!existing.rows[0]) {
      return { success: false, error: "Purchase not found or access denied." };
    }

    const currentStatus = existing.rows[0].status;

    // Import PURCHASE_TRANSITIONS at runtime (avoid circular imports)
    const VALID_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
      DRAFT:     ["SUBMITTED"],
      SUBMITTED: ["APPROVED", "DRAFT"],
      APPROVED:  ["POSTED"],
      POSTED:    [],
    };

    if (!VALID_TRANSITIONS[currentStatus].includes(newStatus)) {
      return {
        success: false,
        error: `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${VALID_TRANSITIONS[currentStatus].join(", ") || "none"}.`,
      };
    }

    const sets: string[] = ["status = $2", "updated_at = NOW()"];
    const updateParams: unknown[] = [id, newStatus];
    let pIdx = 3;

    if (newStatus === "APPROVED") {
      sets.push(`approved_by = $${pIdx++}`);
      updateParams.push(userId);
    }
    if (newStatus === "POSTED") {
      sets.push(`posted_at = $${pIdx++}`);
      updateParams.push(new Date().toISOString());
    }

    await dbQuery(
      `UPDATE public.purchase SET ${sets.join(", ")} WHERE id = $1`,
      updateParams as any[]
    );

    return { success: true };
  }

  // ── SOFT DELETE ────────────────────────────────────────────────────────────

  static async softDelete(id: string, branchId: string): Promise<{ success: boolean; error?: string }> {
    const existing = await dbQuery<{ status: PurchaseStatus }>(
      "SELECT status FROM public.purchase WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL",
      [id, branchId]
    );
    if (!existing.rows[0]) return { success: false, error: "Purchase not found or access denied." };
    if (["APPROVED", "POSTED"].includes(existing.rows[0].status)) {
      return { success: false, error: `Cannot delete a purchase with status '${existing.rows[0].status}'.` };
    }
    await dbQuery(
      "UPDATE public.purchase SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1",
      [id]
    );
    return { success: true };
  }

  // ── PAYMENTS ────────────────────────────────────────────────────────────────

  static async addPayment(
    purchaseId: string,
    input: PurchasePaymentInput,
    branchId: string,
    createdBy: string
  ): Promise<{ success: boolean; payment?: PurchasePaymentRow; error?: string }> {
    // Verify purchase belongs to branch
    const purchase = await dbQuery<{ total: number; status: PurchaseStatus }>(
      "SELECT total, status FROM public.purchase WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL",
      [purchaseId, branchId]
    );
    if (!purchase.rows[0]) return { success: false, error: "Purchase not found or access denied." };
    if (purchase.rows[0].status === "DRAFT") {
      return { success: false, error: "Cannot record payment against a DRAFT purchase. Submit it first." };
    }

    // Verify total payments don't exceed purchase total
    const existingPayments = await dbQuery<{ total_paid: string }>(
      "SELECT COALESCE(SUM(amount),0) AS total_paid FROM public.purchase_payment WHERE purchase_id = $1 AND deleted_at IS NULL",
      [purchaseId]
    );
    const alreadyPaid = parseFloat(existingPayments.rows[0]?.total_paid ?? "0");
    const purchaseTotal = Number(purchase.rows[0].total);
    if (alreadyPaid + input.amount > purchaseTotal + 0.01) {
      return {
        success: false,
        error: `Payment would exceed purchase total. Total: ₹${purchaseTotal.toFixed(2)}, Already paid: ₹${alreadyPaid.toFixed(2)}, Attempted: ₹${input.amount.toFixed(2)}.`,
      };
    }

    const paymentId = generatePaymentId();
    const sql = `
      INSERT INTO public.purchase_payment
        (id, purchase_id, amount, method, payment_date, reference, created_by, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
      RETURNING *
    `;
    const result = await dbQuery<PurchasePaymentRow>(sql, [
      paymentId, purchaseId, input.amount, input.method,
      input.payment_date, input.reference ?? null, createdBy,
    ]);
    return { success: true, payment: result.rows[0] };
  }

  // ── REPORTS ─────────────────────────────────────────────────────────────────

  /** Purchase Register: full list with key fields for the date range */
  static async getPurchaseRegister(filters: PurchaseReportFilters): Promise<PurchaseRegisterRow[]> {
    const conditions = ["p.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.branch_id) { conditions.push(`p.branch_id = $${idx++}`); params.push(filters.branch_id); }
    if (filters.supplier_id) { conditions.push(`p.supplier_id = $${idx++}`); params.push(filters.supplier_id); }
    if (filters.status) { conditions.push(`p.status = $${idx++}`); params.push(filters.status); }
    idx = buildDateFilter("p", "invoice_date", filters, conditions, params, idx);

    const sql = `
      SELECT
        p.id, p.invoice_no, p.invoice_date::TEXT, p.supplier_id,
        s.name AS supplier_name,
        p.branch_id, b.name AS branch_name,
        p.subtotal, p.discount, p.taxable_value,
        p.cgst, p.sgst, p.igst, p.total,
        p.status, p.payment_method, p.due_date::TEXT, p.created_at::TEXT
      FROM public.purchase p
      LEFT JOIN public.supplier s ON s.id = p.supplier_id AND s.deleted_at IS NULL
      LEFT JOIN public.branch   b ON b.id = p.branch_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.invoice_date DESC NULLS LAST, p.created_at DESC
    `;
    const result = await dbQuery<PurchaseRegisterRow>(sql, params as any[]);
    return result.rows;
  }

  /** Supplier-wise purchase summary */
  static async getSupplierWiseSummary(
    filters: PurchaseReportFilters,
    client?: PoolClient
  ): Promise<SupplierPurchaseSummaryRow[]> {
    const conditions = ["p.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.branch_id) { conditions.push(`p.branch_id = $${idx++}`); params.push(filters.branch_id); }
    idx = buildDateFilter("p", "invoice_date", filters, conditions, params, idx);

    const sql = `
      SELECT
        p.supplier_id,
        s.name AS supplier_name,
        s.gstin AS supplier_gstin,
        COUNT(p.id) AS total_bills,
        SUM(p.total) AS total_value,
        SUM(p.taxable_value) AS total_taxable,
        SUM(p.cgst) AS total_cgst,
        SUM(p.sgst) AS total_sgst,
        SUM(p.igst) AS total_igst,
        COALESCE(SUM(pp.paid), 0) AS total_paid,
        COALESCE(SUM(dn.returns), 0) AS total_returns,
        SUM(
          CASE
            WHEN COALESCE((p.metadata->>'is_reversed')::boolean, false) = true THEN 0.00
            ELSE GREATEST(0, p.total - COALESCE(pp.paid, 0) - COALESCE(dn.returns, 0))
          END
        ) AS pending_value
      FROM public.purchase p
      LEFT JOIN public.supplier s ON s.id = p.supplier_id AND s.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) AS paid
        FROM public.purchase_payment
        WHERE purchase_id = p.id AND deleted_at IS NULL
      ) pp ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(total_amount), 0) AS returns
        FROM public.accounting_voucher
        WHERE reference_type = 'PURCHASE_RETURN'
          AND metadata->>'purchase_id' = p.id
          AND status = 'POSTED'
          AND deleted_at IS NULL
      ) dn ON TRUE
      WHERE ${conditions.join(" AND ")}
      GROUP BY p.supplier_id, s.name, s.gstin
      ORDER BY total_value DESC
    `;
    const result = client
      ? await client.query<SupplierPurchaseSummaryRow>(sql, params as any[])
      : await dbQuery<SupplierPurchaseSummaryRow>(sql, params as any[]);
    return result.rows;
  }

  /** Item-wise purchase aggregation (by description + HSN) */
  static async getItemWiseSummary(filters: PurchaseReportFilters): Promise<ItemWisePurchaseRow[]> {
    const conditions = ["p.deleted_at IS NULL", "pi.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.branch_id) { conditions.push(`p.branch_id = $${idx++}`); params.push(filters.branch_id); }
    idx = buildDateFilter("p", "invoice_date", filters, conditions, params, idx);

    const sql = `
      SELECT
        pi.description,
        pi.hsn_code,
        pi.product_id,
        SUM(pi.quantity) AS total_quantity,
        AVG(pi.rate) AS avg_rate,
        SUM(pi.total) AS total_value,
        SUM(pi.taxable_value) AS total_taxable,
        SUM(pi.cgst) AS total_cgst,
        SUM(pi.sgst) AS total_sgst,
        SUM(pi.igst) AS total_igst,
        COUNT(DISTINCT p.id) AS bill_count
      FROM public.purchase_item pi
      JOIN public.purchase p ON p.id = pi.purchase_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY pi.description, pi.hsn_code, pi.product_id
      ORDER BY total_value DESC
    `;
    const result = await dbQuery<ItemWisePurchaseRow>(sql, params as any[]);
    return result.rows;
  }

  /** Bill-wise view (per invoice with payment status) */
  static async getBillWiseSummary(
    filters: PurchaseReportFilters,
    client?: PoolClient
  ): Promise<BillWisePurchaseRow[]> {
    const conditions = ["p.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.branch_id) { conditions.push(`p.branch_id = $${idx++}`); params.push(filters.branch_id); }
    if (filters.supplier_id) { conditions.push(`p.supplier_id = $${idx++}`); params.push(filters.supplier_id); }
    idx = buildDateFilter("p", "invoice_date", filters, conditions, params, idx);

    const sql = `
      SELECT
        p.id, p.invoice_no, p.invoice_date::TEXT,
        s.name AS supplier_name,
        b.name AS branch_name,
        p.total, p.status, p.due_date::TEXT,
        COALESCE((p.metadata->>'is_reversed')::boolean, false) AS is_reversed,
        COALESCE(pp.total_paid, 0) AS total_paid,
        COALESCE(dn.total_returns, 0) AS total_returns,
        CASE
          WHEN COALESCE((p.metadata->>'is_reversed')::boolean, false) = true THEN 0.00
          ELSE GREATEST(0, p.total - COALESCE(pp.total_paid, 0) - COALESCE(dn.total_returns, 0))
        END AS balance_due
      FROM public.purchase p
      LEFT JOIN public.supplier s ON s.id = p.supplier_id AND s.deleted_at IS NULL
      LEFT JOIN public.branch   b ON b.id = p.branch_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(amount), 0) AS total_paid
        FROM public.purchase_payment
        WHERE purchase_id = p.id AND deleted_at IS NULL
      ) pp ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(total_amount), 0) AS total_returns
        FROM public.accounting_voucher
        WHERE reference_type = 'PURCHASE_RETURN'
          AND metadata->>'purchase_id' = p.id
          AND status = 'POSTED'
          AND deleted_at IS NULL
      ) dn ON TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY p.invoice_date DESC NULLS LAST, p.created_at DESC
    `;
    const result = client
      ? await client.query<BillWisePurchaseRow>(sql, params as any[])
      : await dbQuery<BillWisePurchaseRow>(sql, params as any[]);
    return result.rows;
  }

  /** GST/HSN purchase aggregation */
  static async getGstHsnSummary(filters: PurchaseReportFilters): Promise<PurchaseGstHsnRow[]> {
    const conditions = ["p.deleted_at IS NULL", "pi.deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.branch_id) { conditions.push(`p.branch_id = $${idx++}`); params.push(filters.branch_id); }
    idx = buildDateFilter("p", "invoice_date", filters, conditions, params, idx);

    const sql = `
      SELECT
        pi.hsn_code,
        MAX(pi.description) AS description,
        SUM(pi.quantity) AS total_quantity,
        SUM(pi.taxable_value) AS total_taxable,
        MAX(pi.cgst_rate) AS cgst_rate,
        MAX(pi.sgst_rate) AS sgst_rate,
        MAX(pi.igst_rate) AS igst_rate,
        SUM(COALESCE(pi.cgst,0)) AS total_cgst,
        SUM(COALESCE(pi.sgst,0)) AS total_sgst,
        SUM(COALESCE(pi.igst,0)) AS total_igst,
        SUM(COALESCE(pi.cgst,0) + COALESCE(pi.sgst,0) + COALESCE(pi.igst,0)) AS total_tax,
        SUM(pi.total) AS total_value
      FROM public.purchase_item pi
      JOIN public.purchase p ON p.id = pi.purchase_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY pi.hsn_code
      ORDER BY total_taxable DESC
    `;
    const result = await dbQuery<PurchaseGstHsnRow>(sql, params as any[]);
    return result.rows;
  }
}
