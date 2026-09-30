/**
 * CakeToHome ERP — Supplier Repository
 * Phase 1: Database access layer for the supplier master table.
 *
 * ARCHITECTURE:
 * - Uses canonical dbQuery/dbTransaction helpers from lib/db
 * - IDs generated with prefix "sup_" + timestamp+random (matches project convention)
 * - Soft deletion via deleted_at — never hard-deletes
 * - Branch scope is optional (suppliers may serve multiple branches)
 * - No SQL in services — all SQL here
 */

import { dbQuery, dbTransaction } from "../db";
import type {
  SupplierRow,
  SupplierCreateInput,
  SupplierUpdateInput,
  SupplierListFilters,
  SupplierListResult,
} from "../types/purchase.types";

// ─── ID Generation ─────────────────────────────────────────────────────────────

function generateSupplierId(): string {
  const ts = Date.now().toString(36).toUpperCase().padStart(10, "0");
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `sup_${ts}${rnd}`;
}

// ─── SupplierRepository ────────────────────────────────────────────────────────

export class SupplierRepository {
  /**
   * Create a new supplier.
   * Returns the created row.
   */
  static async create(input: SupplierCreateInput, createdBy: string): Promise<SupplierRow> {
    const id = generateSupplierId();
    const sql = `
      INSERT INTO public.supplier
        (id, name, gstin, phone, email, address, city, state, branch_id, is_active, created_by, metadata, created_at, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
      RETURNING *
    `;
    const params = [
      id,
      input.name,
      input.gstin ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.address ?? null,
      input.city ?? null,
      input.state ?? null,
      input.branch_id ?? null,
      input.is_active !== false,
      createdBy,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ];
    const result = await dbQuery<SupplierRow>(sql, params);
    return result.rows[0];
  }

  /**
   * Update an existing supplier (partial update).
   * Ignores fields not provided. Sets updated_at.
   */
  static async update(id: string, input: SupplierUpdateInput): Promise<SupplierRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      sets.push(`${col} = $${idx++}`);
      params.push(val);
    };

    if (input.name !== undefined)             addField("name",             input.name);
    if (input.gstin !== undefined)            addField("gstin",            input.gstin ?? null);
    if (input.phone !== undefined)            addField("phone",            input.phone ?? null);
    if (input.email !== undefined)            addField("email",            input.email ?? null);
    if (input.address !== undefined)          addField("address",          input.address ?? null);
    if (input.city !== undefined)             addField("city",             input.city ?? null);
    if (input.state !== undefined)            addField("state",            input.state ?? null);
    if (input.branch_id !== undefined)        addField("branch_id",        input.branch_id ?? null);
    if (input.is_active !== undefined)        addField("is_active",        input.is_active);
    if (input.metadata !== undefined)         addField("metadata",         input.metadata ? JSON.stringify(input.metadata) : null);

    if (sets.length === 0) return this.findById(id);

    sets.push("updated_at = NOW()");
    params.push(id);

    const sql = `
      UPDATE public.supplier SET ${sets.join(", ")}
      WHERE id = $${idx} AND deleted_at IS NULL
      RETURNING *
    `;
    const result = await dbQuery<SupplierRow>(sql, params as any[]);
    return result.rows[0] ?? null;
  }

  /**
   * Soft-delete a supplier.
   * Fails if supplier has active (non-POSTED) purchases.
   */
  static async softDelete(id: string): Promise<{ success: boolean; reason?: string }> {
    // Guard: no active purchases
    const activePurchases = await dbQuery<{ count: string }>(
      "SELECT COUNT(*) FROM public.purchase WHERE supplier_id = $1 AND status NOT IN ('POSTED') AND deleted_at IS NULL",
      [id]
    );
    if (parseInt(activePurchases.rows[0]?.count ?? "0") > 0) {
      return { success: false, reason: "Supplier has active purchases. Post or delete them first." };
    }
    await dbQuery(
      "UPDATE public.supplier SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    return { success: true };
  }

  /**
   * Find a single supplier by ID (non-deleted).
   */
  static async findById(id: string): Promise<SupplierRow | null> {
    const result = await dbQuery<SupplierRow>(
      "SELECT * FROM public.supplier WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    return result.rows[0] ?? null;
  }

  /**
   * List suppliers with optional filters.
   */
  static async list(filters: SupplierListFilters = {}): Promise<SupplierListResult> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.branch_id) {
      conditions.push(`branch_id = $${idx++}`);
      params.push(filters.branch_id);
    }
    if (filters.is_active !== undefined) {
      conditions.push(`is_active = $${idx++}`);
      params.push(filters.is_active);
    }
    if (filters.search) {
      conditions.push(`(name ILIKE $${idx} OR phone ILIKE $${idx} OR gstin ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const where = conditions.join(" AND ");
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const [dataResult, countResult] = await Promise.all([
      dbQuery<SupplierRow>(
        `SELECT * FROM public.supplier WHERE ${where} ORDER BY name ASC LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, limit, offset]
      ),
      dbQuery<{ count: string }>(
        `SELECT COUNT(*) FROM public.supplier WHERE ${where}`,
        params as any[]
      ),
    ]);

    return {
      suppliers: dataResult.rows,
      total: parseInt(countResult.rows[0]?.count ?? "0"),
    };
  }
}
