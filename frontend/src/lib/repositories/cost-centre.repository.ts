/**
 * CakeToHome ERP — Cost Centre Repository
 * Phase C7.6 Step 1: Data access layer for public.cost_centre master records.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Cost centres are MANAGEMENT ACCOUNTING DIMENSIONS, NOT General Ledger accounts.
 * 2. Pure database-backed storage; no in-memory mocks as source of truth.
 * 3. Soft deletion via deleted_at; records referenced by accounting lines cannot be physically pruned.
 * 4. Recursive ancestor and descendant traversal for cycle prevention.
 * 5. Parameterized SQL queries with transaction support (client parameter).
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  CostCentreRow,
  CostCentreInput,
  CostCentreUpdateInput,
  CostCentreListFilters,
} from "../types/accounting.types";

export class CostCentreRepository {
  /**
   * Insert a new cost centre record into public.cost_centre.
   */
  static async create(
    input: CostCentreInput,
    createdBy: string | null = null,
    client?: PoolClient
  ): Promise<CostCentreRow> {
    const sql = `
      INSERT INTO public.cost_centre
        (code, name, department, parent_id, company_id, branch_id, is_active, metadata, created_by, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *;
    `;
    const params = [
      input.code.trim().toUpperCase(),
      input.name.trim(),
      input.department.trim().toUpperCase(),
      input.parent_id ?? null,
      input.company_id ?? null,
      input.branch_id ?? null,
      input.is_active ?? true,
      input.metadata ? JSON.stringify(input.metadata) : "{}",
      createdBy ?? null,
    ];

    const res = client
      ? await client.query<CostCentreRow>(sql, params)
      : await dbQuery<CostCentreRow>(sql, params);

    return res.rows[0];
  }

  /**
   * Find a cost centre by its primary key ID.
   */
  static async findById(
    id: string,
    includeDeleted = false,
    client?: PoolClient
  ): Promise<CostCentreRow | null> {
    const sql = `
      SELECT * FROM public.cost_centre
      WHERE id = $1 ${includeDeleted ? "" : "AND deleted_at IS NULL"}
      LIMIT 1;
    `;
    const res = client
      ? await client.query<CostCentreRow>(sql, [id])
      : await dbQuery<CostCentreRow>(sql, [id]);

    return res.rows[0] ?? null;
  }

  /**
   * Find a cost centre by its unique natural code.
   */
  static async findByCode(
    code: string,
    includeDeleted = false,
    client?: PoolClient
  ): Promise<CostCentreRow | null> {
    const sql = `
      SELECT * FROM public.cost_centre
      WHERE UPPER(code) = UPPER($1) ${includeDeleted ? "" : "AND deleted_at IS NULL"}
      LIMIT 1;
    `;
    const res = client
      ? await client.query<CostCentreRow>(sql, [code.trim()])
      : await dbQuery<CostCentreRow>(sql, [code.trim()]);

    return res.rows[0] ?? null;
  }

  /**
   * List cost centres with server-side filters.
   */
  static async list(
    filters: CostCentreListFilters = {},
    client?: PoolClient
  ): Promise<CostCentreRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (!filters.include_deleted) {
      conditions.push("deleted_at IS NULL");
    }

    if (filters.department) {
      conditions.push(`department = $${idx++}`);
      params.push(filters.department.trim().toUpperCase());
    }

    if (filters.parent_id !== undefined) {
      if (filters.parent_id === null) {
        conditions.push("parent_id IS NULL");
      } else {
        conditions.push(`parent_id = $${idx++}`);
        params.push(filters.parent_id);
      }
    }

    if (filters.branch_id !== undefined) {
      if (filters.branch_id === null) {
        conditions.push("branch_id IS NULL");
      } else {
        conditions.push(`branch_id = $${idx++}`);
        params.push(filters.branch_id);
      }
    }

    if (filters.company_id !== undefined) {
      if (filters.company_id === null) {
        conditions.push("company_id IS NULL");
      } else {
        conditions.push(`company_id = $${idx++}`);
        params.push(filters.company_id);
      }
    }

    if (typeof filters.is_active === "boolean") {
      conditions.push(`is_active = $${idx++}`);
      params.push(filters.is_active);
    }

    if (filters.search) {
      conditions.push(`(code ILIKE $${idx} OR name ILIKE $${idx})`);
      params.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitClause = filters.limit ? `LIMIT ${Math.max(1, filters.limit)}` : "";
    const offsetClause = filters.offset ? `OFFSET ${Math.max(0, filters.offset)}` : "";

    const sql = `
      SELECT * FROM public.cost_centre
      ${whereClause}
      ORDER BY code ASC
      ${limitClause}
      ${offsetClause};
    `;

    const res = client
      ? await client.query<CostCentreRow>(sql, params)
      : await dbQuery<CostCentreRow>(sql, params);

    return res.rows;
  }

  /**
   * Update mutable fields of an existing cost centre.
   */
  static async update(
    id: string,
    input: CostCentreUpdateInput,
    client?: PoolClient
  ): Promise<CostCentreRow> {
    const updates: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [id];
    let idx = 2;

    if (input.name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(input.name.trim());
    }

    if (input.department !== undefined) {
      updates.push(`department = $${idx++}`);
      params.push(input.department.trim().toUpperCase());
    }

    if (input.parent_id !== undefined) {
      updates.push(`parent_id = $${idx++}`);
      params.push(input.parent_id);
    }

    if (input.company_id !== undefined) {
      updates.push(`company_id = $${idx++}`);
      params.push(input.company_id);
    }

    if (input.branch_id !== undefined) {
      updates.push(`branch_id = $${idx++}`);
      params.push(input.branch_id);
    }

    if (input.is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      params.push(input.is_active);
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${idx++}`);
      params.push(input.metadata ? JSON.stringify(input.metadata) : "{}");
    }

    const sql = `
      UPDATE public.cost_centre
      SET ${updates.join(", ")}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;

    const res = client
      ? await client.query<CostCentreRow>(sql, params)
      : await dbQuery<CostCentreRow>(sql, params);

    if (res.rows.length === 0) {
      throw new Error(`Cost centre '${id}' not found or already deleted.`);
    }

    return res.rows[0];
  }

  /**
   * Deactivate a cost centre without deleting it.
   */
  static async deactivate(id: string, client?: PoolClient): Promise<CostCentreRow> {
    const sql = `
      UPDATE public.cost_centre
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const res = client
      ? await client.query<CostCentreRow>(sql, [id])
      : await dbQuery<CostCentreRow>(sql, [id]);

    if (res.rows.length === 0) {
      throw new Error(`Cost centre '${id}' not found or already deleted.`);
    }

    return res.rows[0];
  }

  /**
   * Reactivate a previously deactivated cost centre.
   */
  static async reactivate(id: string, client?: PoolClient): Promise<CostCentreRow> {
    const sql = `
      UPDATE public.cost_centre
      SET is_active = true, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const res = client
      ? await client.query<CostCentreRow>(sql, [id])
      : await dbQuery<CostCentreRow>(sql, [id]);

    if (res.rows.length === 0) {
      throw new Error(`Cost centre '${id}' not found or already deleted.`);
    }

    return res.rows[0];
  }

  /**
   * Soft delete a cost centre by setting deleted_at and deactivating.
   */
  static async softDelete(id: string, client?: PoolClient): Promise<CostCentreRow> {
    const sql = `
      UPDATE public.cost_centre
      SET deleted_at = NOW(), is_active = false, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const res = client
      ? await client.query<CostCentreRow>(sql, [id])
      : await dbQuery<CostCentreRow>(sql, [id]);

    if (res.rows.length === 0) {
      throw new Error(`Cost centre '${id}' not found or already deleted.`);
    }

    return res.rows[0];
  }

  /**
   * Hard delete a cost centre if and only if zero accounting references exist and zero children exist.
   */
  static async hardDelete(id: string, client?: PoolClient): Promise<boolean> {
    const sql = `
      DELETE FROM public.cost_centre
      WHERE id = $1
      RETURNING id;
    `;
    const res = client
      ? await client.query<{ id: string }>(sql, [id])
      : await dbQuery<{ id: string }>(sql, [id]);

    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Find immediate active children of a parent cost centre.
   */
  static async findChildren(
    parentId: string,
    includeDeleted = false,
    client?: PoolClient
  ): Promise<CostCentreRow[]> {
    const sql = `
      SELECT * FROM public.cost_centre
      WHERE parent_id = $1 ${includeDeleted ? "" : "AND deleted_at IS NULL"}
      ORDER BY code ASC;
    `;
    const res = client
      ? await client.query<CostCentreRow>(sql, [parentId])
      : await dbQuery<CostCentreRow>(sql, [parentId]);

    return res.rows;
  }

  /**
   * Trace all ancestor IDs upwards using a recursive CTE.
   * Traverses from the given cost centre to root parents.
   * Depth bounded to 50 to prevent infinite recursion.
   */
  static async getAncestorIds(
    costCentreId: string,
    client?: PoolClient
  ): Promise<string[]> {
    const sql = `
      WITH RECURSIVE ancestors AS (
        SELECT parent_id, 1 as depth
        FROM public.cost_centre
        WHERE id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT cc.parent_id, a.depth + 1
        FROM public.cost_centre cc
        JOIN ancestors a ON cc.id = a.parent_id
        WHERE a.parent_id IS NOT NULL AND a.depth < 50
      )
      SELECT DISTINCT parent_id
      FROM ancestors
      WHERE parent_id IS NOT NULL;
    `;
    const res = client
      ? await client.query<{ parent_id: string }>(sql, [costCentreId])
      : await dbQuery<{ parent_id: string }>(sql, [costCentreId]);

    return res.rows.map((r) => r.parent_id);
  }

  /**
   * Trace all descendant IDs downwards using a recursive CTE.
   */
  static async getDescendantIds(
    costCentreId: string,
    client?: PoolClient
  ): Promise<string[]> {
    const sql = `
      WITH RECURSIVE descendants AS (
        SELECT id, 1 as depth
        FROM public.cost_centre
        WHERE parent_id = $1 AND deleted_at IS NULL
        UNION ALL
        SELECT cc.id, d.depth + 1
        FROM public.cost_centre cc
        JOIN descendants d ON cc.parent_id = d.id
        WHERE d.depth < 50
      )
      SELECT DISTINCT id
      FROM descendants;
    `;
    const res = client
      ? await client.query<{ id: string }>(sql, [costCentreId])
      : await dbQuery<{ id: string }>(sql, [costCentreId]);

    return res.rows.map((r) => r.id);
  }

  /**
   * Count accounting references and child records for a cost centre.
   */
  static async countReferences(
    costCentreId: string,
    client?: PoolClient
  ): Promise<{ voucherCount: number; journalLineCount: number; childCount: number }> {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM public.accounting_voucher WHERE cost_centre_id = $1) as voucher_count,
        (SELECT COUNT(*) FROM public.accounting_journal_line WHERE cost_centre_id = $1) as line_count,
        (SELECT COUNT(*) FROM public.cost_centre WHERE parent_id = $1 AND deleted_at IS NULL) as child_count;
    `;
    const res = client
      ? await client.query<{ voucher_count: string; line_count: string; child_count: string }>(sql, [costCentreId])
      : await dbQuery<{ voucher_count: string; line_count: string; child_count: string }>(sql, [costCentreId]);

    const row = res.rows[0];
    return {
      voucherCount: parseInt(row?.voucher_count ?? "0", 10),
      journalLineCount: parseInt(row?.line_count ?? "0", 10),
      childCount: parseInt(row?.child_count ?? "0", 10),
    };
  }

  /**
   * Check if a branch exists in public.branch.
   */
  static async checkBranchExists(branchId: string, client?: PoolClient): Promise<boolean> {
    const sql = `SELECT 1 FROM public.branch WHERE id = $1 LIMIT 1;`;
    const res = client
      ? await client.query(sql, [branchId])
      : await dbQuery(sql, [branchId]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Check if a company exists in public.company.
   */
  static async checkCompanyExists(companyId: string, client?: PoolClient): Promise<boolean> {
    const sql = `SELECT 1 FROM public.company WHERE id = $1 LIMIT 1;`;
    const res = client
      ? await client.query(sql, [companyId])
      : await dbQuery(sql, [companyId]);
    return (res.rowCount ?? 0) > 0;
  }
}
