/**
 * CakeToHome ERP — Accounting Fiscal Period Repository
 * Phase 4F Step 1: Data access layer for public.accounting_fiscal_period.
 *
 * CRITICAL INVARIANT — ZERO PERIODS != OPEN:
 * The current database contains ZERO fiscal periods.
 * Absence of a fiscal period record MUST NEVER be interpreted as "the period is open."
 * Every method in this repository that checks period state returns an explicit discriminated
 * result type (FiscalPeriodStatus) that distinguishes:
 *   - PERIOD_OPEN       — a period exists for the date and is NOT locked
 *   - PERIOD_LOCKED     — a period exists for the date but IS locked
 *   - PERIOD_NOT_CONFIGURED — NO period record exists for the date (or at all)
 *
 * The PostingService (Phase 4F Step 2) MUST:
 * 1. Check accounting_start_date is configured (via AccountingStartDateConfig).
 * 2. Check that a PERIOD_OPEN period exists for the voucher_date.
 * 3. Only then proceed with posting.
 *
 * If PERIOD_NOT_CONFIGURED is returned, posting MUST be refused with an explicit error:
 * "No fiscal period has been configured for this date. Create a fiscal period before posting."
 *
 * NEVER treat a PERIOD_NOT_CONFIGURED as permissive.
 *
 * DB state: accounting_fiscal_period = 0 rows (seeding is FORBIDDEN in Phase 4F Step 1).
 *
 * NO MOCK DATA. NO STATIC ARRAYS. NO JSON IMPORTS.
 * PostgreSQL -> Repository -> Service -> API -> UI
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type { AccountingFiscalPeriodRow } from "../types/accounting.types";

// ─── Discriminated Result Type ──────────────────────────────────────────────────

/**
 * Explicit discriminated union for fiscal period lookup results.
 *
 * PERIOD_NOT_CONFIGURED must ALWAYS be treated as a hard blocking condition by callers.
 * It must NEVER be treated as "open" or permissive.
 */
export type FiscalPeriodStatus =
  | { status: "PERIOD_OPEN"; period: AccountingFiscalPeriodRow }
  | { status: "PERIOD_LOCKED"; period: AccountingFiscalPeriodRow }
  | { status: "PERIOD_NOT_CONFIGURED" };

// ─── Accounting Start Date Config ───────────────────────────────────────────────

/**
 * Discriminated result for accounting start date configuration check.
 *
 * The posting engine MUST check this before accepting any posting.
 * UNCONFIGURED must be treated as a hard blocking condition.
 */
export type AccountingStartDateConfig =
  | { configured: true; startDate: string }
  | { configured: false };

// ─── AccountingFiscalPeriodRepository ──────────────────────────────────────────

export class AccountingFiscalPeriodRepository {
  // ── PERIOD LOOKUP ─────────────────────────────────────────────────────────────

  /**
   * Check the fiscal period status for a given date.
   *
   * This is the PRIMARY guard used by the PostingService before any posting.
   *
   * Returns:
   *   PERIOD_OPEN         — safe to post
   *   PERIOD_LOCKED       — blocked (period.is_locked = true)
   *   PERIOD_NOT_CONFIGURED — blocked (no period record covers this date)
   *
   * CRITICAL: PERIOD_NOT_CONFIGURED is NOT the same as PERIOD_OPEN.
   * The PostingService MUST refuse posting on PERIOD_NOT_CONFIGURED.
   *
   * @param dateStr  Date in YYYY-MM-DD format (the voucher_date being posted).
   * @param client   Optional transaction client.
   */
  static async getPeriodStatusForDate(
    dateStr: string,
    client?: PoolClient
  ): Promise<FiscalPeriodStatus> {
    const sql = `
      SELECT * FROM public.accounting_fiscal_period
      WHERE $1::date BETWEEN start_date AND end_date
      LIMIT 1
    `;
    const res = client
      ? await client.query<AccountingFiscalPeriodRow>(sql, [dateStr])
      : await dbQuery<AccountingFiscalPeriodRow>(sql, [dateStr]);

    const period = res.rows[0];

    if (!period) {
      // NO period record covers this date.
      // This MUST be treated as BLOCKED — not open.
      return { status: "PERIOD_NOT_CONFIGURED" };
    }

    if (period.is_locked) {
      return { status: "PERIOD_LOCKED", period };
    }

    return { status: "PERIOD_OPEN", period };
  }

  /**
   * Check whether a specific date falls within a locked period.
   * Returns true if locked, false if open, null if no period is configured.
   *
   * IMPORTANT: null (PERIOD_NOT_CONFIGURED) must be treated as BLOCKING by the caller.
   * Do NOT interpret null as "not locked = open."
   *
   * This is a convenience method for simple locked-vs-open checks.
   * Use getPeriodStatusForDate for the full discriminated result.
   *
   * @param dateStr  Date in YYYY-MM-DD format.
   * @param client   Optional transaction client.
   */
  static async isDateLocked(
    dateStr: string,
    client?: PoolClient
  ): Promise<boolean | null> {
    const result = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(dateStr, client);

    if (result.status === "PERIOD_NOT_CONFIGURED") {
      return null; // null = no period configured — caller must treat as BLOCKING
    }
    if (result.status === "PERIOD_LOCKED") {
      return true;
    }
    return false; // PERIOD_OPEN
  }

  /**
   * Fetch a fiscal period by its primary key ID.
   */
  static async findById(
    id: string,
    client?: PoolClient
  ): Promise<AccountingFiscalPeriodRow | null> {
    const sql = `
      SELECT * FROM public.accounting_fiscal_period
      WHERE id = $1
      LIMIT 1
    `;
    const res = client
      ? await client.query<AccountingFiscalPeriodRow>(sql, [id])
      : await dbQuery<AccountingFiscalPeriodRow>(sql, [id]);
    return res.rows[0] ?? null;
  }

  // ── LIST ──────────────────────────────────────────────────────────────────────

  /**
   * List all fiscal periods, with optional fiscal year filter.
   * Ordered chronologically by start_date.
   *
   * Returns an empty array if no periods have been configured yet.
   * An empty array MUST be treated as "no periods configured" by callers —
   * NOT as "all periods are open."
   *
   * @param fiscalYear  Optional: filter to a specific fiscal year (e.g. "FY2627").
   * @param client      Optional transaction client.
   */
  static async list(
    fiscalYear?: string,
    client?: PoolClient
  ): Promise<AccountingFiscalPeriodRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (fiscalYear) {
      conditions.push(`fiscal_year = $${idx++}`);
      params.push(fiscalYear);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT * FROM public.accounting_fiscal_period
      ${where}
      ORDER BY start_date ASC
    `;

    const res = client
      ? await client.query<AccountingFiscalPeriodRow>(sql, params)
      : await dbQuery<AccountingFiscalPeriodRow>(sql, params as unknown[]);

    return res.rows;
  }

  // ── ACCOUNTING START DATE ─────────────────────────────────────────────────────

  /**
   * Read-only check of the accounting start date configuration.
   *
   * Queries public.setting WHERE key = 'accounting_start_date'.
   * The current database state is: 0 matching rows = UNCONFIGURED.
   *
   * This method:
   * - Returns { configured: false } when accounting_start_date is absent.
   * - Returns { configured: true, startDate: 'YYYY-MM-DD' } when present.
   *
   * SECURITY:
   * - NEVER modifies public.setting.
   * - NEVER sets or infers accounting_start_date.
   * - NEVER falls back to a default date.
   * - If { configured: false }, the PostingService MUST refuse all postings.
   *
   * Implementation note:
   * The existing SettingRepository.findByKey() uses group + key lookup.
   * The accounting_start_date is stored with group='accounting' and key='accounting_start_date'
   * (or possibly just key='accounting_start_date' without a group — checked via raw query
   * to be authoritative against the live DB schema).
   */
  static async getAccountingStartDateConfig(
    client?: PoolClient
  ): Promise<AccountingStartDateConfig> {
    // Raw query to ensure we match the actual DB structure regardless of group conventions.
    // Uses ILIKE on key to be resilient to minor naming variations.
    const sql = `
      SELECT value FROM public.setting
      WHERE key = 'accounting_start_date'
        AND deleted_at IS NULL
      LIMIT 1
    `;
    const res = client
      ? await client.query<{ value: string }>(sql, [])
      : await dbQuery<{ value: string }>(sql, []);

    const row = res.rows[0];

    if (!row || !row.value) {
      return { configured: false };
    }

    // Validate the value is a valid date string before trusting it
    const dateStr = String(row.value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // Value exists but is malformed — treat as unconfigured to avoid silent errors
      return { configured: false };
    }

    return { configured: true, startDate: dateStr };
  }

  // ── PERIOD OVERLAP CHECK ──────────────────────────────────────────────────────

  /**
   * Check whether a proposed new period would overlap with any existing period.
   * Used by the finance admin before creating a new fiscal period (Phase 4F later step).
   *
   * Returns the conflicting period if an overlap exists, or null if no overlap.
   *
   * @param startDate  Proposed start date (YYYY-MM-DD).
   * @param endDate    Proposed end date (YYYY-MM-DD).
   * @param excludeId  Optional: exclude a specific period ID (for update operations).
   */
  static async findOverlappingPeriod(
    startDate: string,
    endDate: string,
    excludeId?: string,
    client?: PoolClient
  ): Promise<AccountingFiscalPeriodRow | null> {
    const conditions = [
      "start_date <= $2::date",
      "end_date >= $1::date",
    ];
    const params: unknown[] = [startDate, endDate];
    let idx = 3;

    if (excludeId) {
      conditions.push(`id <> $${idx++}`);
      params.push(excludeId);
    }

    const sql = `
      SELECT * FROM public.accounting_fiscal_period
      WHERE ${conditions.join(" AND ")}
      LIMIT 1
    `;

    const res = client
      ? await client.query<AccountingFiscalPeriodRow>(sql, params)
      : await dbQuery<AccountingFiscalPeriodRow>(sql, params as unknown[]);

    return res.rows[0] ?? null;
  }

  /**
   * Automatic fiscal-year rollover: if the Indian fiscal year (April–March) containing `date`
   * has no periods yet, create its 12 monthly periods (e.g. FY2027-28: Apr-2027 .. Mar-2028).
   *
   * Only the current or the next fiscal year is created, so a mistyped far-future date cannot
   * create stray years. Balances need no copying: balance-sheet accounts carry forward because
   * they are computed from all journal lines; P&L accounts are reset into Retained Earnings by
   * the Year-End Close.
   *
   * @returns true if periods were created.
   */
  static async ensureFiscalYearForDate(date: string, client?: PoolClient): Promise<boolean> {
    const m = /^(\d{4})-(\d{2})-\d{2}/.exec(date);
    if (!m) return false;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const fyStartYear = month >= 4 ? year : year - 1;

    const nowIst = new Date(Date.now() + 5.5 * 3600 * 1000);
    const currentFyStart = nowIst.getUTCMonth() + 1 >= 4 ? nowIst.getUTCFullYear() : nowIst.getUTCFullYear() - 1;
    if (fyStartYear > currentFyStart + 1) return false;

    const fiscalYear = `FY${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`;
    const sql = `
      WITH lock AS (SELECT pg_advisory_xact_lock(hashtext('fiscal_year_rollover::' || $1)))
      INSERT INTO public.accounting_fiscal_period (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
      SELECT $1, to_char(mo, 'Mon-YYYY'), mo::date, (mo + interval '1 month - 1 day')::date, false, NOW()
      FROM lock, generate_series($2::date, $2::date + interval '11 months', interval '1 month') AS mo
      WHERE NOT EXISTS (SELECT 1 FROM public.accounting_fiscal_period WHERE fiscal_year = $1)
        AND NOT EXISTS (
          SELECT 1 FROM public.accounting_fiscal_period
          WHERE start_date <= ($2::date + interval '1 year - 1 day')::date AND end_date >= $2::date
        )
    `;
    const params = [fiscalYear, `${fyStartYear}-04-01`];
    const res = client ? await client.query(sql, params) : await dbQuery(sql, params);
    return (res.rowCount ?? 0) > 0;
  }
}
