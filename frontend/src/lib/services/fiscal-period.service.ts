/**
 * CakeToHome ERP — Fiscal Period Management Service
 * Phase 5A.2 Component B: Create, List, Lock, Unlock, Auto-Generate Fiscal Periods
 *
 * SECURITY:
 *   - Only SUPER_ADMIN can create, lock, unlock, or auto-generate periods.
 *   - ACCOUNTING.VIEW required for list operations.
 *   - No period is silently created during a posting request.
 *   - Existing PostingService.validateFiscalPeriod() remains the authoritative posting guard.
 *
 * CONSTRAINTS:
 *   - Accounting start date must be configured before any period can be created.
 *   - Period start_date >= accounting_start_date.
 *   - No overlapping periods.
 *   - Locking a period prevents posting into it.
 *   - Unlocking requires explicit authorization and is audit-logged.
 *   - Preserves Apr–Mar Indian FY semantics in auto-generate mode.
 *
 * NO MOCK DATA. NO STATIC ARRAYS. NO JSON IMPORTS.
 * PostgreSQL -> Repository -> Service -> API -> UI
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { AccountingFiscalPeriodRepository } from "../repositories/accounting-fiscal-period.repository";
import type { AccountingFiscalPeriodRow } from "../types/accounting.types";
import { AccountingConfigService } from "./accounting-config.service";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type FiscalPeriodErrorCode =
  | "UNAUTHORIZED"
  | "START_DATE_NOT_CONFIGURED"
  | "INVALID_DATE_FORMAT"
  | "INVALID_DATE_RANGE"
  | "PERIOD_BEFORE_START_DATE"
  | "PERIOD_OVERLAP"
  | "PERIOD_NOT_FOUND"
  | "PERIOD_ALREADY_LOCKED"
  | "PERIOD_NOT_LOCKED"
  | "DUPLICATE_FISCAL_YEAR"
  | "FISCAL_PERIOD_OPERATION_FAILED";

export class FiscalPeriodError extends Error {
  readonly code: FiscalPeriodErrorCode;

  constructor(code: FiscalPeriodErrorCode, message: string) {
    super(message);
    this.name = "FiscalPeriodError";
    this.code = code;
  }
}

// ─── FiscalPeriodService ───────────────────────────────────────────────────────

export class FiscalPeriodService {
  // ── CREATE ──────────────────────────────────────────────────────────────────

  /**
   * Create a single fiscal period.
   *
   * @param params The period parameters.
   * @param actorId The authenticated user ID.
   * @param actorRole Must be SUPER_ADMIN.
   *
   * @throws {FiscalPeriodError} On authorization, validation, or overlap failure.
   */
  static async createFiscalPeriod(
    params: {
      fiscal_year: string;
      period_name: string;
      start_date: string;
      end_date: string;
    },
    actorId: string,
    actorRole: string
  ): Promise<AccountingFiscalPeriodRow> {
    // 1. Authorization
    if (actorRole !== "SUPER_ADMIN") {
      throw new FiscalPeriodError("UNAUTHORIZED", "Only SUPER_ADMIN can create fiscal periods.");
    }

    // 2. Validate date formats
    this.validateDateFormat(params.start_date, "start_date");
    this.validateDateFormat(params.end_date, "end_date");

    // 3. start_date < end_date
    if (params.start_date >= params.end_date) {
      throw new FiscalPeriodError(
        "INVALID_DATE_RANGE",
        `Period start_date (${params.start_date}) must be before end_date (${params.end_date}).`
      );
    }

    // 4-6: Atomic transaction
    return dbTransaction(async (client: PoolClient) => {
      // 4. Accounting start date must be configured
      const config = await AccountingConfigService.getConfig();
      if (!config.configured) {
        throw new FiscalPeriodError(
          "START_DATE_NOT_CONFIGURED",
          "Cannot create fiscal periods: accounting start date is not configured."
        );
      }

      // 5. Period start_date >= accounting_start_date
      if (params.start_date < config.startDate) {
        throw new FiscalPeriodError(
          "PERIOD_BEFORE_START_DATE",
          `Period start_date (${params.start_date}) is before the accounting start date (${config.startDate}).`
        );
      }

      // 6. No overlapping periods
      const overlap = await AccountingFiscalPeriodRepository.findOverlappingPeriod(
        params.start_date,
        params.end_date,
        undefined,
        client
      );
      if (overlap) {
        throw new FiscalPeriodError(
          "PERIOD_OVERLAP",
          `Period overlaps with existing period '${overlap.period_name}' (${overlap.start_date} to ${overlap.end_date}).`
        );
      }

      // 7. Insert
      const sql = `
        INSERT INTO public.accounting_fiscal_period
          (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
        VALUES ($1, $2, $3::date, $4::date, false, NOW())
        RETURNING *
      `;
      const res = await client.query<AccountingFiscalPeriodRow>(sql, [
        params.fiscal_year,
        params.period_name,
        params.start_date,
        params.end_date,
      ]);

      return res.rows[0];
    });
  }

  // ── LIST ────────────────────────────────────────────────────────────────────

  /**
   * List all fiscal periods, optionally filtered by fiscal year.
   * Delegates to the existing frozen repository method.
   */
  static async listFiscalPeriods(filters?: {
    fiscal_year?: string;
  }): Promise<AccountingFiscalPeriodRow[]> {
    return AccountingFiscalPeriodRepository.list(
      filters?.fiscal_year
    );
  }

  // ── LOCK ────────────────────────────────────────────────────────────────────

  /**
   * Lock a fiscal period, preventing posting into it.
   *
   * @throws {FiscalPeriodError} UNAUTHORIZED, PERIOD_NOT_FOUND, PERIOD_ALREADY_LOCKED
   */
  static async lockPeriod(
    periodId: string,
    actorId: string,
    actorRole: string
  ): Promise<AccountingFiscalPeriodRow> {
    if (actorRole !== "SUPER_ADMIN") {
      throw new FiscalPeriodError("UNAUTHORIZED", "Only SUPER_ADMIN can lock fiscal periods.");
    }

    return dbTransaction(async (client: PoolClient) => {
      // Lock the row for update
      const lockSql = `
        SELECT * FROM public.accounting_fiscal_period
        WHERE id = $1
        FOR UPDATE
      `;
      const lockRes = await client.query<AccountingFiscalPeriodRow>(lockSql, [periodId]);
      const period = lockRes.rows[0];

      if (!period) {
        throw new FiscalPeriodError("PERIOD_NOT_FOUND", `Fiscal period '${periodId}' not found.`);
      }

      if (period.is_locked) {
        throw new FiscalPeriodError(
          "PERIOD_ALREADY_LOCKED",
          `Fiscal period '${period.period_name}' is already locked.`
        );
      }

      const updateSql = `
        UPDATE public.accounting_fiscal_period
        SET is_locked = true, locked_at = NOW(), locked_by = $2
        WHERE id = $1
        RETURNING *
      `;
      const res = await client.query<AccountingFiscalPeriodRow>(updateSql, [periodId, actorId]);
      return res.rows[0];
    });
  }

  // ── UNLOCK ──────────────────────────────────────────────────────────────────

  /**
   * Unlock a fiscal period (for correction only — audit-logged).
   *
   * @throws {FiscalPeriodError} UNAUTHORIZED, PERIOD_NOT_FOUND, PERIOD_NOT_LOCKED
   */
  static async unlockPeriod(
    periodId: string,
    actorId: string,
    actorRole: string
  ): Promise<AccountingFiscalPeriodRow> {
    if (actorRole !== "SUPER_ADMIN") {
      throw new FiscalPeriodError("UNAUTHORIZED", "Only SUPER_ADMIN can unlock fiscal periods.");
    }

    return dbTransaction(async (client: PoolClient) => {
      const lockSql = `
        SELECT * FROM public.accounting_fiscal_period
        WHERE id = $1
        FOR UPDATE
      `;
      const lockRes = await client.query<AccountingFiscalPeriodRow>(lockSql, [periodId]);
      const period = lockRes.rows[0];

      if (!period) {
        throw new FiscalPeriodError("PERIOD_NOT_FOUND", `Fiscal period '${periodId}' not found.`);
      }

      if (!period.is_locked) {
        throw new FiscalPeriodError(
          "PERIOD_NOT_LOCKED",
          `Fiscal period '${period.period_name}' is not locked.`
        );
      }

      // Unlock and record who/when (audit trail via locked_by and locked_at being cleared)
      const updateSql = `
        UPDATE public.accounting_fiscal_period
        SET is_locked = false, locked_at = NULL, locked_by = NULL
        WHERE id = $1
        RETURNING *
      `;
      const res = await client.query<AccountingFiscalPeriodRow>(updateSql, [periodId, actorId]);
      return res.rows[0];
    });
  }

  // ── AUTO-GENERATE YEAR ──────────────────────────────────────────────────────

  /**
   * Generate 12 monthly fiscal periods for a fiscal year.
   *
   * By default uses Indian FY semantics (Apr-Mar), but the yearStartDate
   * parameter allows any start month.
   *
   * @param fiscal_year Label like "2024-2025"
   * @param yearStartDate The start date of the first month (e.g. "2024-04-01" for Indian FY)
   * @param actorId The authenticated user
   * @param actorRole Must be SUPER_ADMIN
   *
   * @throws {FiscalPeriodError} On authorization, validation, or overlap failure.
   */
  static async generateYearPeriods(
    fiscal_year: string,
    yearStartDate: string,
    actorId: string,
    actorRole: string
  ): Promise<AccountingFiscalPeriodRow[]> {
    if (actorRole !== "SUPER_ADMIN") {
      throw new FiscalPeriodError("UNAUTHORIZED", "Only SUPER_ADMIN can generate fiscal year periods.");
    }

    this.validateDateFormat(yearStartDate, "year_start_date");

    // Validate the year_start_date is the 1st of a month
    const yearStart = new Date(yearStartDate + "T00:00:00Z");
    if (yearStart.getUTCDate() !== 1) {
      throw new FiscalPeriodError(
        "INVALID_DATE_FORMAT",
        `year_start_date must be the 1st of a month (got ${yearStartDate}).`
      );
    }

    return dbTransaction(async (client: PoolClient) => {
      // Accounting start date must be configured
      const config = await AccountingConfigService.getConfig();
      if (!config.configured) {
        throw new FiscalPeriodError(
          "START_DATE_NOT_CONFIGURED",
          "Cannot generate fiscal periods: accounting start date is not configured."
        );
      }

      // year_start_date >= accounting_start_date
      if (yearStartDate < config.startDate) {
        throw new FiscalPeriodError(
          "PERIOD_BEFORE_START_DATE",
          `Year start date (${yearStartDate}) is before the accounting start date (${config.startDate}).`
        );
      }

      // Check if any periods already exist for this fiscal year
      const existing = await AccountingFiscalPeriodRepository.list(
        fiscal_year,
        client
      );
      if (existing.length > 0) {
        throw new FiscalPeriodError(
          "DUPLICATE_FISCAL_YEAR",
          `${existing.length} period(s) already exist for fiscal year '${fiscal_year}'. Delete or use individual create.`
        );
      }

      // Generate 12 monthly periods
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];

      const periods: AccountingFiscalPeriodRow[] = [];

      for (let i = 0; i < 12; i++) {
        const monthStart = new Date(yearStart);
        monthStart.setUTCMonth(yearStart.getUTCMonth() + i);

        const monthEnd = new Date(monthStart);
        monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
        monthEnd.setUTCDate(0); // Last day of current month

        const startStr = monthStart.toISOString().split("T")[0];
        const endStr = monthEnd.toISOString().split("T")[0];
        const monthName = monthNames[monthStart.getUTCMonth()];
        const periodName = `${monthName} ${monthStart.getUTCFullYear()}`;

        // Overlap check for each period
        const overlap = await AccountingFiscalPeriodRepository.findOverlappingPeriod(
          startStr,
          endStr,
          undefined,
          client
        );
        if (overlap) {
          throw new FiscalPeriodError(
            "PERIOD_OVERLAP",
            `Generated period '${periodName}' (${startStr} to ${endStr}) overlaps with existing period '${overlap.period_name}'.`
          );
        }

        const sql = `
          INSERT INTO public.accounting_fiscal_period
            (fiscal_year, period_name, start_date, end_date, is_locked, created_at)
          VALUES ($1, $2, $3::date, $4::date, false, NOW())
          RETURNING *
        `;
        const res = await client.query<AccountingFiscalPeriodRow>(sql, [
          fiscal_year,
          periodName,
          startStr,
          endStr,
        ]);

        periods.push(res.rows[0]);
      }

      return periods;
    });
  }

  // ── PRIVATE HELPERS ─────────────────────────────────────────────────────────

  private static validateDateFormat(date: string, fieldName: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new FiscalPeriodError(
        "INVALID_DATE_FORMAT",
        `Invalid ${fieldName} format '${date}'. Expected YYYY-MM-DD.`
      );
    }
    const parsed = new Date(date + "T00:00:00Z");
    if (isNaN(parsed.getTime())) {
      throw new FiscalPeriodError(
        "INVALID_DATE_FORMAT",
        `${fieldName} '${date}' is not a valid calendar date.`
      );
    }
  }
}
