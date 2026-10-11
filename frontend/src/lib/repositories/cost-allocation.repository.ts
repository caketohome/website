/**
 * CakeToHome ERP — Cost Allocation Repository
 * Phase C7.6 Step 4B: Data access layer for Cost Allocation rules, targets, runs, and lines.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. DIMENSIONAL REPOSITORY:
 *    - Cost allocation rules define reallocation between cost centre dimensions on eligible operational accounts.
 * 2. PARAMETERIZED SQL:
 *    - Zero string interpolation; 100% strictly parameterized SQL queries.
 * 3. TRANSACTION INTEGRITY:
 *    - All methods accept an optional PoolClient for participation in external atomic transactions.
 *    - If no client is provided and multi-row operations are executed, dbTransaction is utilized.
 * 4. SNAPSHOT IMMUTABILITY:
 *    - Posted and submitted runs preserve their rule_snapshot permanently.
 * 5. DETERMINISTIC SORTING:
 *    - Rules, targets, runs, and run lines are sorted deterministically for audit repeatability.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import {
  CostAllocationRepositoryError,
  type CostAllocationRuleRow,
  type CostAllocationRuleTargetRow,
  type CostAllocationRuleTargetInput,
  type CreateCostAllocationRuleInput,
  type UpdateCostAllocationRuleInput,
  type CostAllocationRuleWithTargets,
  type CostAllocationRuleListFilters,
  type CostAllocationRunRow,
  type CostAllocationRunLineRow,
  type CreateCostAllocationRunInput,
  type CostAllocationRunWithLines,
  type CostAllocationRunListFilters,
  type CostAllocationSourceLineHistoryRow,
  type CostAllocationRunStatus,
} from "../types/accounting.types";

export class CostAllocationRepository {
  // ─── RULE OPERATIONS ────────────────────────────────────────────────────────

  /**
   * Insert a new cost allocation rule and optionally its initial targets.
   */
  static async createRule(
    input: CreateCostAllocationRuleInput,
    createdBy: string | null = null,
    client?: PoolClient
  ): Promise<CostAllocationRuleWithTargets> {
    const execute = async (c: PoolClient | null): Promise<CostAllocationRuleWithTargets> => {
      const ruleSql = `
        INSERT INTO public.cost_allocation_rule (
          rule_code,
          name,
          description,
          rule_type,
          source_cost_centre_id,
          source_account_id,
          version,
          is_active,
          effective_from,
          effective_to,
          metadata,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10, $11, NOW(), NOW()
        )
        RETURNING *;
      `;

      const ruleParams = [
        input.rule_code.trim().toUpperCase(),
        input.name.trim(),
        input.description?.trim() || null,
        input.rule_type || "FIXED_PERCENTAGE",
        input.source_cost_centre_id,
        input.source_account_id,
        input.is_active ?? true,
        input.effective_from,
        input.effective_to || null,
        input.metadata ? JSON.stringify(input.metadata) : "{}",
        createdBy || null,
      ];

      const ruleRes = c
        ? await c.query<CostAllocationRuleRow>(ruleSql, ruleParams)
        : await dbQuery<CostAllocationRuleRow>(ruleSql, ruleParams);

      const createdRule = ruleRes.rows[0];
      const targets: CostAllocationRuleTargetRow[] = [];

      if (input.targets && input.targets.length > 0) {
        for (let i = 0; i < input.targets.length; i++) {
          const t = input.targets[i];
          const targetSql = `
            INSERT INTO public.cost_allocation_rule_target (
              rule_id,
              target_cost_centre_id,
              target_account_id,
              percentage,
              sort_order,
              created_at,
              updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, NOW(), NOW()
            )
            RETURNING *;
          `;
          const targetParams = [
            createdRule.id,
            t.target_cost_centre_id,
            t.target_account_id || null,
            t.percentage,
            t.sort_order ?? i,
          ];

          const tRes = c
            ? await c.query<CostAllocationRuleTargetRow>(targetSql, targetParams)
            : await dbQuery<CostAllocationRuleTargetRow>(targetSql, targetParams);

          targets.push(tRes.rows[0]);
        }
      }

      return {
        ...createdRule,
        targets,
      };
    };

    if (client) {
      return execute(client);
    }
    // If targets are provided and no client was passed, execute inside an atomic transaction
    if (input.targets && input.targets.length > 0) {
      return dbTransaction(async (txClient) => execute(txClient));
    }
    return execute(null);
  }

  /**
   * Find an allocation rule by its primary key ID, enriched with metadata and targets.
   */
  static async findRuleById(
    id: string,
    includeDeleted = false,
    client?: PoolClient
  ): Promise<CostAllocationRuleWithTargets | null> {
    const sql = `
      SELECT 
        r.*,
        cc.code AS source_cost_centre_code,
        cc.name AS source_cost_centre_name,
        a.code AS source_account_code,
        a.name AS source_account_name
      FROM public.cost_allocation_rule r
      JOIN public.cost_centre cc ON cc.id = r.source_cost_centre_id
      JOIN public.accounting_account a ON a.id = r.source_account_id
      WHERE r.id = $1 ${includeDeleted ? "" : "AND r.deleted_at IS NULL"}
      LIMIT 1;
    `;
    const res = client
      ? await client.query<CostAllocationRuleRow>(sql, [id])
      : await dbQuery<CostAllocationRuleRow>(sql, [id]);

    if (!res.rows[0]) return null;

    const targets = await this.findTargetsByRuleId(id, client);
    return {
      ...res.rows[0],
      targets,
    };
  }

  /**
   * Find an allocation rule by its natural code (case-insensitive), enriched with targets.
   */
  static async findRuleByCode(
    ruleCode: string,
    includeDeleted = false,
    client?: PoolClient
  ): Promise<CostAllocationRuleWithTargets | null> {
    const sql = `
      SELECT 
        r.*,
        cc.code AS source_cost_centre_code,
        cc.name AS source_cost_centre_name,
        a.code AS source_account_code,
        a.name AS source_account_name
      FROM public.cost_allocation_rule r
      JOIN public.cost_centre cc ON cc.id = r.source_cost_centre_id
      JOIN public.accounting_account a ON a.id = r.source_account_id
      WHERE UPPER(r.rule_code) = UPPER($1) ${includeDeleted ? "" : "AND r.deleted_at IS NULL"}
      LIMIT 1;
    `;
    const res = client
      ? await client.query<CostAllocationRuleRow>(sql, [ruleCode.trim()])
      : await dbQuery<CostAllocationRuleRow>(sql, [ruleCode.trim()]);

    if (!res.rows[0]) return null;

    const targets = await this.findTargetsByRuleId(res.rows[0].id, client);
    return {
      ...res.rows[0],
      targets,
    };
  }

  /**
   * List allocation rules with flexible filtering, search, and pagination.
   */
  static async listRules(
    filters: CostAllocationRuleListFilters = {},
    client?: PoolClient
  ): Promise<{ rules: CostAllocationRuleRow[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (!filters.include_deleted) {
      conditions.push(`r.deleted_at IS NULL`);
    }

    if (filters.is_active !== undefined) {
      conditions.push(`r.is_active = $${idx++}`);
      params.push(filters.is_active);
    }

    if (filters.rule_type) {
      conditions.push(`r.rule_type = $${idx++}`);
      params.push(filters.rule_type);
    }

    if (filters.source_cost_centre_id) {
      conditions.push(`r.source_cost_centre_id = $${idx++}`);
      params.push(filters.source_cost_centre_id);
    }

    if (filters.source_account_id) {
      conditions.push(`r.source_account_id = $${idx++}`);
      params.push(filters.source_account_id);
    }

    if (filters.effective_date) {
      conditions.push(`r.effective_from <= $${idx++}`);
      params.push(filters.effective_date);
      conditions.push(`(r.effective_to IS NULL OR r.effective_to >= $${idx++})`);
      params.push(filters.effective_date);
    }

    if (filters.search) {
      conditions.push(`(r.rule_code ILIKE $${idx} OR r.name ILIKE $${idx})`);
      params.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count query
    const countSql = `
      SELECT COUNT(*)::int as total
      FROM public.cost_allocation_rule r
      ${whereClause};
    `;
    const countRes = client
      ? await client.query<{ total: number }>(countSql, params)
      : await dbQuery<{ total: number }>(countSql, params);

    const total = countRes.rows[0]?.total ?? 0;

    // Data query
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    params.push(limit);
    const limitParam = `$${idx++}`;
    params.push(offset);
    const offsetParam = `$${idx++}`;

    const dataSql = `
      SELECT 
        r.*,
        cc.code AS source_cost_centre_code,
        cc.name AS source_cost_centre_name,
        a.code AS source_account_code,
        a.name AS source_account_name
      FROM public.cost_allocation_rule r
      JOIN public.cost_centre cc ON cc.id = r.source_cost_centre_id
      JOIN public.accounting_account a ON a.id = r.source_account_id
      ${whereClause}
      ORDER BY r.created_at DESC, r.id ASC
      LIMIT ${limitParam} OFFSET ${offsetParam};
    `;

    const dataRes = client
      ? await client.query<CostAllocationRuleRow>(dataSql, params)
      : await dbQuery<CostAllocationRuleRow>(dataSql, params);

    return {
      rules: dataRes.rows,
      total,
    };
  }

  /**
   * Update permitted rule attributes (name, description, effective dates, active status, metadata).
   * Note: source account, source cost centre, and version cannot be modified through this method (preserves version immutability).
   */
  static async updateRule(
    id: string,
    input: UpdateCostAllocationRuleInput,
    client?: PoolClient
  ): Promise<CostAllocationRuleRow | null> {
    const updates: string[] = ["updated_at = NOW()"];
    const params: any[] = [id];
    let idx = 2;

    if (input.name !== undefined) {
      updates.push(`name = $${idx++}`);
      params.push(input.name.trim());
    }

    if (input.description !== undefined) {
      updates.push(`description = $${idx++}`);
      params.push(input.description?.trim() || null);
    }

    if (input.effective_from !== undefined) {
      updates.push(`effective_from = $${idx++}`);
      params.push(input.effective_from);
    }

    if (input.effective_to !== undefined) {
      updates.push(`effective_to = $${idx++}`);
      params.push(input.effective_to || null);
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
      UPDATE public.cost_allocation_rule
      SET ${updates.join(", ")}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;

    const res = client
      ? await client.query<CostAllocationRuleRow>(sql, params)
      : await dbQuery<CostAllocationRuleRow>(sql, params);

    return res.rows[0] ?? null;
  }

  /**
   * Deactivate a rule (is_active = false).
   */
  static async deactivateRule(
    id: string,
    client?: PoolClient
  ): Promise<CostAllocationRuleRow | null> {
    const sql = `
      UPDATE public.cost_allocation_rule
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const res = client
      ? await client.query<CostAllocationRuleRow>(sql, [id])
      : await dbQuery<CostAllocationRuleRow>(sql, [id]);

    return res.rows[0] ?? null;
  }

  /**
   * Soft-delete a rule (deleted_at = NOW(), is_active = false).
   */
  static async softDeleteRule(
    id: string,
    client?: PoolClient
  ): Promise<CostAllocationRuleRow | null> {
    const sql = `
      UPDATE public.cost_allocation_rule
      SET deleted_at = NOW(), is_active = false, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;
    const res = client
      ? await client.query<CostAllocationRuleRow>(sql, [id])
      : await dbQuery<CostAllocationRuleRow>(sql, [id]);

    return res.rows[0] ?? null;
  }

  // ─── TARGET OPERATIONS ──────────────────────────────────────────────────────

  /**
   * Retrieve all targets for a given rule in deterministic sort order.
   * Enriches targets with joined cost centre and account names/codes.
   */
  static async findTargetsByRuleId(
    ruleId: string,
    client?: PoolClient
  ): Promise<CostAllocationRuleTargetRow[]> {
    const sql = `
      SELECT 
        t.*,
        cc.code AS target_cost_centre_code,
        cc.name AS target_cost_centre_name,
        a.code AS target_account_code,
        a.name AS target_account_name
      FROM public.cost_allocation_rule_target t
      JOIN public.cost_centre cc ON cc.id = t.target_cost_centre_id
      LEFT JOIN public.accounting_account a ON a.id = t.target_account_id
      WHERE t.rule_id = $1
      ORDER BY t.sort_order ASC, t.id ASC;
    `;
    const res = client
      ? await client.query<CostAllocationRuleTargetRow>(sql, [ruleId])
      : await dbQuery<CostAllocationRuleTargetRow>(sql, [ruleId]);

    return res.rows;
  }

  /**
   * Replace all target cost centres for a rule atomically.
   */
  static async replaceRuleTargets(
    ruleId: string,
    targets: CostAllocationRuleTargetInput[],
    client?: PoolClient
  ): Promise<CostAllocationRuleTargetRow[]> {
    const execute = async (c: PoolClient | null): Promise<CostAllocationRuleTargetRow[]> => {
      // 1. Delete existing targets
      const deleteSql = `DELETE FROM public.cost_allocation_rule_target WHERE rule_id = $1;`;
      if (c) {
        await c.query(deleteSql, [ruleId]);
      } else {
        await dbQuery(deleteSql, [ruleId]);
      }

      // 2. Insert new targets
      const inserted: CostAllocationRuleTargetRow[] = [];
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const insertSql = `
          INSERT INTO public.cost_allocation_rule_target (
            rule_id,
            target_cost_centre_id,
            target_account_id,
            percentage,
            sort_order,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, NOW(), NOW()
          )
          RETURNING *;
        `;
        const params = [
          ruleId,
          t.target_cost_centre_id,
          t.target_account_id || null,
          t.percentage,
          t.sort_order ?? i,
        ];
        const res = c
          ? await c.query<CostAllocationRuleTargetRow>(insertSql, params)
          : await dbQuery<CostAllocationRuleTargetRow>(insertSql, params);

        inserted.push(res.rows[0]);
      }

      // Re-fetch enriched
      return this.findTargetsByRuleId(ruleId, c || undefined);
    };

    if (client) {
      return execute(client);
    }
    return dbTransaction(async (txClient) => execute(txClient));
  }

  // ─── RUN OPERATIONS ─────────────────────────────────────────────────────────

  /**
   * Create an allocation run record and its line items atomically.
   */
  static async createRun(
    input: CreateCostAllocationRunInput,
    executedBy: string | null = null,
    client?: PoolClient
  ): Promise<CostAllocationRunWithLines> {
    const execute = async (c: PoolClient | null): Promise<CostAllocationRunWithLines> => {
      const runSql = `
        INSERT INTO public.cost_allocation_run (
          run_number,
          rule_id,
          rule_version,
          fiscal_year,
          period_name,
          allocation_date,
          source_cost_centre_id,
          source_account_id,
          total_source_amount,
          total_allocated_amount,
          rounding_difference,
          status,
          accounting_voucher_id,
          rule_snapshot,
          narration,
          metadata,
          executed_by,
          executed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()
        )
        RETURNING *;
      `;

      const runParams = [
        input.run_number.trim().toUpperCase(),
        input.rule_id,
        input.rule_version ?? 1,
        input.fiscal_year,
        input.period_name,
        input.allocation_date,
        input.source_cost_centre_id,
        input.source_account_id,
        input.total_source_amount,
        input.total_allocated_amount,
        input.rounding_difference ?? 0.0,
        input.status || "DRAFT",
        input.accounting_voucher_id || null,
        JSON.stringify(input.rule_snapshot),
        input.narration,
        input.metadata ? JSON.stringify(input.metadata) : "{}",
        executedBy || null,
      ];

      const runRes = c
        ? await c.query<CostAllocationRunRow>(runSql, runParams)
        : await dbQuery<CostAllocationRunRow>(runSql, runParams);

      const createdRun = runRes.rows[0];
      const lines: CostAllocationRunLineRow[] = [];

      if (input.lines && input.lines.length > 0) {
        for (let i = 0; i < input.lines.length; i++) {
          const l = input.lines[i];
          const lineSql = `
            INSERT INTO public.cost_allocation_run_line (
              run_id,
              source_journal_line_id,
              target_cost_centre_id,
              target_account_id,
              target_percentage,
              allocated_amount,
              sort_order,
              created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, NOW()
            )
            RETURNING *;
          `;
          const lineParams = [
            createdRun.id,
            l.source_journal_line_id || null,
            l.target_cost_centre_id,
            l.target_account_id,
            l.target_percentage,
            l.allocated_amount,
            l.sort_order ?? i,
          ];

          const lRes = c
            ? await c.query<CostAllocationRunLineRow>(lineSql, lineParams)
            : await dbQuery<CostAllocationRunLineRow>(lineSql, lineParams);

          lines.push(lRes.rows[0]);
        }
      }

      return {
        ...createdRun,
        lines,
      };
    };

    if (client) {
      return execute(client);
    }
    if (input.lines && input.lines.length > 0) {
      return dbTransaction(async (txClient) => execute(txClient));
    }
    return execute(null);
  }

  /**
   * Find a run by its primary key ID, enriched with metadata and lines.
   */
  static async findRunById(
    id: string,
    client?: PoolClient
  ): Promise<CostAllocationRunWithLines | null> {
    const sql = `
      SELECT 
        r.*,
        cc.code AS source_cost_centre_code,
        cc.name AS source_cost_centre_name,
        a.code AS source_account_code,
        a.name AS source_account_name,
        v.voucher_no AS voucher_no
      FROM public.cost_allocation_run r
      JOIN public.cost_centre cc ON cc.id = r.source_cost_centre_id
      JOIN public.accounting_account a ON a.id = r.source_account_id
      LEFT JOIN public.accounting_voucher v ON v.id = r.accounting_voucher_id
      WHERE r.id = $1
      LIMIT 1;
    `;
    const res = client
      ? await client.query<CostAllocationRunRow>(sql, [id])
      : await dbQuery<CostAllocationRunRow>(sql, [id]);

    if (!res.rows[0]) return null;

    const lines = await this.findRunLines(id, client);
    return {
      ...res.rows[0],
      lines,
    };
  }

  /**
   * Find a run by its unique natural run number, enriched with metadata and lines.
   */
  static async findRunByNumber(
    runNumber: string,
    client?: PoolClient
  ): Promise<CostAllocationRunWithLines | null> {
    const sql = `
      SELECT 
        r.*,
        cc.code AS source_cost_centre_code,
        cc.name AS source_cost_centre_name,
        a.code AS source_account_code,
        a.name AS source_account_name,
        v.voucher_no AS voucher_no
      FROM public.cost_allocation_run r
      JOIN public.cost_centre cc ON cc.id = r.source_cost_centre_id
      JOIN public.accounting_account a ON a.id = r.source_account_id
      LEFT JOIN public.accounting_voucher v ON v.id = r.accounting_voucher_id
      WHERE UPPER(r.run_number) = UPPER($1)
      LIMIT 1;
    `;
    const res = client
      ? await client.query<CostAllocationRunRow>(sql, [runNumber.trim()])
      : await dbQuery<CostAllocationRunRow>(sql, [runNumber.trim()]);

    if (!res.rows[0]) return null;

    const lines = await this.findRunLines(res.rows[0].id, client);
    return {
      ...res.rows[0],
      lines,
    };
  }

  /**
   * List allocation runs with filtering by status, rule, fiscal period, or dates.
   */
  static async listRuns(
    filters: CostAllocationRunListFilters = {},
    client?: PoolClient
  ): Promise<{ runs: CostAllocationRunRow[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.status) {
      conditions.push(`r.status = $${idx++}`);
      params.push(filters.status);
    }

    if (filters.rule_id) {
      conditions.push(`r.rule_id = $${idx++}`);
      params.push(filters.rule_id);
    }

    if (filters.source_cost_centre_id) {
      conditions.push(`r.source_cost_centre_id = $${idx++}`);
      params.push(filters.source_cost_centre_id);
    }

    if (filters.fiscal_year) {
      conditions.push(`r.fiscal_year = $${idx++}`);
      params.push(filters.fiscal_year);
    }

    if (filters.period_name) {
      conditions.push(`r.period_name = $${idx++}`);
      params.push(filters.period_name);
    }

    if (filters.from_date) {
      conditions.push(`r.allocation_date >= $${idx++}`);
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      conditions.push(`r.allocation_date <= $${idx++}`);
      params.push(filters.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*)::int as total FROM public.cost_allocation_run r ${whereClause};`;
    const countRes = client
      ? await client.query<{ total: number }>(countSql, params)
      : await dbQuery<{ total: number }>(countSql, params);

    const total = countRes.rows[0]?.total ?? 0;

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    params.push(limit);
    const limitParam = `$${idx++}`;
    params.push(offset);
    const offsetParam = `$${idx++}`;

    const dataSql = `
      SELECT 
        r.*,
        cc.code AS source_cost_centre_code,
        cc.name AS source_cost_centre_name,
        a.code AS source_account_code,
        a.name AS source_account_name,
        v.voucher_no AS voucher_no
      FROM public.cost_allocation_run r
      JOIN public.cost_centre cc ON cc.id = r.source_cost_centre_id
      JOIN public.accounting_account a ON a.id = r.source_account_id
      LEFT JOIN public.accounting_voucher v ON v.id = r.accounting_voucher_id
      ${whereClause}
      ORDER BY r.allocation_date DESC, r.executed_at DESC, r.id ASC
      LIMIT ${limitParam} OFFSET ${offsetParam};
    `;

    const dataRes = client
      ? await client.query<CostAllocationRunRow>(dataSql, params)
      : await dbQuery<CostAllocationRunRow>(dataSql, params);

    return {
      runs: dataRes.rows,
      total,
    };
  }

  /**
   * Find lines for an allocation run in deterministic sort order.
   * Enriches lines with joined cost centre and account names/codes.
   */
  static async findRunLines(
    runId: string,
    client?: PoolClient
  ): Promise<CostAllocationRunLineRow[]> {
    const sql = `
      SELECT 
        l.*,
        cc.code AS target_cost_centre_code,
        cc.name AS target_cost_centre_name,
        a.code AS target_account_code,
        a.name AS target_account_name
      FROM public.cost_allocation_run_line l
      JOIN public.cost_centre cc ON cc.id = l.target_cost_centre_id
      JOIN public.accounting_account a ON a.id = l.target_account_id
      WHERE l.run_id = $1
      ORDER BY l.sort_order ASC, l.id ASC;
    `;
    const res = client
      ? await client.query<CostAllocationRunLineRow>(sql, [runId])
      : await dbQuery<CostAllocationRunLineRow>(sql, [runId]);

    return res.rows;
  }

  /**
   * Query previous allocation history for a set of source journal lines across POSTED or SUBMITTED runs.
   * Provides duplicate-run detection at the repository boundary.
   */
  static async findSourceLineAllocationHistory(
    sourceJournalLineIds: string[],
    client?: PoolClient
  ): Promise<CostAllocationSourceLineHistoryRow[]> {
    if (!sourceJournalLineIds || sourceJournalLineIds.length === 0) {
      return [];
    }

    const sql = `
      SELECT 
        l.source_journal_line_id,
        r.id AS run_id,
        r.run_number,
        r.status,
        l.allocated_amount,
        r.allocation_date::text AS allocation_date
      FROM public.cost_allocation_run_line l
      JOIN public.cost_allocation_run r ON r.id = l.run_id
      WHERE l.source_journal_line_id = ANY($1)
        AND r.status IN ('SUBMITTED', 'POSTED')
      ORDER BY r.allocation_date DESC, l.id ASC;
    `;
    const res = client
      ? await client.query<CostAllocationSourceLineHistoryRow>(sql, [sourceJournalLineIds])
      : await dbQuery<CostAllocationSourceLineHistoryRow>(sql, [sourceJournalLineIds]);

    return res.rows;
  }

  /**
   * Update run status and related audit/voucher references.
   * Note: rule_snapshot and source calculation amounts are strictly immutable and cannot be updated.
   */
  static async updateRunStatus(
    id: string,
    status: CostAllocationRunStatus,
    extra?: {
      approved_by?: string | null;
      approved_at?: Date | string | null;
      reversed_by?: string | null;
      reversed_at?: Date | string | null;
      reversal_reason?: string | null;
      accounting_voucher_id?: string | null;
      reversal_voucher_id?: string | null;
    },
    client?: PoolClient
  ): Promise<CostAllocationRunRow | null> {
    const updates: string[] = ["status = $2"];
    const params: any[] = [id, status];
    let idx = 3;

    if (extra?.approved_by !== undefined) {
      updates.push(`approved_by = $${idx++}`);
      params.push(extra.approved_by);
    }
    if (extra?.approved_at !== undefined) {
      updates.push(`approved_at = $${idx++}`);
      params.push(extra.approved_at);
    }
    if (extra?.reversed_by !== undefined) {
      updates.push(`reversed_by = $${idx++}`);
      params.push(extra.reversed_by);
    }
    if (extra?.reversed_at !== undefined) {
      updates.push(`reversed_at = $${idx++}`);
      params.push(extra.reversed_at);
    }
    if (extra?.reversal_reason !== undefined) {
      updates.push(`reversal_reason = $${idx++}`);
      params.push(extra.reversal_reason);
    }
    if (extra?.accounting_voucher_id !== undefined) {
      updates.push(`accounting_voucher_id = $${idx++}`);
      params.push(extra.accounting_voucher_id);
    }
    if (extra?.reversal_voucher_id !== undefined) {
      updates.push(`reversal_voucher_id = $${idx++}`);
      params.push(extra.reversal_voucher_id);
    }

    const sql = `
      UPDATE public.cost_allocation_run
      SET ${updates.join(", ")}
      WHERE id = $1
      RETURNING *;
    `;

    const res = client
      ? await client.query<CostAllocationRunRow>(sql, params)
      : await dbQuery<CostAllocationRunRow>(sql, params);

    return res.rows[0] ?? null;
  }
}
