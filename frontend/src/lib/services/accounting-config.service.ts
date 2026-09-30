/**
 * CakeToHome ERP — Accounting Configuration Service
 * Phase 5A.2 Component A: Accounting Start Date Management
 *
 * READ/WRITE service for the accounting_start_date system setting.
 *
 * SECURITY:
 *   - Only SUPER_ADMIN can set/change the accounting start date.
 *   - Once any journal entry exists, the date becomes IMMUTABLE (lock-after-first-posting).
 *   - No client-side authority over the value.
 *   - No historical transactions may be inferred or silently imported.
 *
 * MECHANISM:
 *   - Reads/writes public.setting WHERE key = 'accounting_start_date'.
 *   - Uses AccountingFiscalPeriodRepository.getAccountingStartDateConfig() for reads.
 *   - Direct parameterized SQL for writes (UPSERT into public.setting).
 *
 * NO MOCK DATA. NO STATIC ARRAYS. NO JSON IMPORTS.
 * PostgreSQL -> Repository -> Service -> API -> UI
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { AccountingFiscalPeriodRepository, type AccountingStartDateConfig } from "../repositories/accounting-fiscal-period.repository";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type AccountingConfigErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_DATE_FORMAT"
  | "DATE_IN_FUTURE"
  | "START_DATE_IMMUTABLE"
  | "START_DATE_AFTER_FISCAL_PERIOD"
  | "CONFIG_OPERATION_FAILED";

export class AccountingConfigError extends Error {
  readonly code: AccountingConfigErrorCode;

  constructor(code: AccountingConfigErrorCode, message: string) {
    super(message);
    this.name = "AccountingConfigError";
    this.code = code;
  }
}

// ─── AccountingConfigService ───────────────────────────────────────────────────

export class AccountingConfigService {
  /**
   * Read the current accounting start date configuration.
   * Delegates to the existing frozen repository method.
   */
  static async getConfig(): Promise<AccountingStartDateConfig> {
    return AccountingFiscalPeriodRepository.getAccountingStartDateConfig();
  }

  /**
   * Set or update the accounting start date.
   *
   * CONSTRAINTS:
   * 1. Only SUPER_ADMIN may call this.
   * 2. Date must be valid YYYY-MM-DD, not in the future.
   * 3. If any accounting_journal_entry rows exist, the date is IMMUTABLE.
   * 4. Cannot be set to a date after any existing fiscal period start_date.
   * 5. Writes to public.setting via atomic UPSERT.
   *
   * @throws {AccountingConfigError} On authorization, validation, or immutability failure.
   */
  static async setAccountingStartDate(
    startDate: string,
    actorId: string,
    actorRole: string
  ): Promise<{ startDate: string }> {
    // 1. Authorization: SUPER_ADMIN only
    if (actorRole !== "SUPER_ADMIN") {
      throw new AccountingConfigError(
        "UNAUTHORIZED",
        "Only SUPER_ADMIN can set the accounting start date."
      );
    }

    // 2. Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new AccountingConfigError(
        "INVALID_DATE_FORMAT",
        `Invalid date format '${startDate}'. Expected YYYY-MM-DD.`
      );
    }

    const parsed = new Date(startDate + "T00:00:00Z");
    if (isNaN(parsed.getTime())) {
      throw new AccountingConfigError(
        "INVALID_DATE_FORMAT",
        `Date '${startDate}' is not a valid calendar date.`
      );
    }

    // 3. Date must not be in the future
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    if (startDate > todayStr) {
      throw new AccountingConfigError(
        "DATE_IN_FUTURE",
        `Accounting start date '${startDate}' cannot be in the future (today is ${todayStr}).`
      );
    }

    // 4-6: Atomic transaction for immutability check + write
    const result = await dbTransaction(async (client: PoolClient) => {
      // 4. Immutability check: if any journal entries exist, block
      const jeCheck = await client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM public.accounting_journal_entry"
      );
      if (jeCheck.rows[0].count > 0) {
        throw new AccountingConfigError(
          "START_DATE_IMMUTABLE",
          `Cannot change accounting start date: ${jeCheck.rows[0].count} journal entries already exist. The start date is locked after the first posting.`
        );
      }

      // 5. Validate against existing fiscal periods
      const fpCheck = await client.query<{ min_start: string }>(
        "SELECT MIN(start_date)::text AS min_start FROM public.accounting_fiscal_period"
      );
      if (fpCheck.rows[0].min_start && startDate > fpCheck.rows[0].min_start) {
        throw new AccountingConfigError(
          "START_DATE_AFTER_FISCAL_PERIOD",
          `Accounting start date '${startDate}' is after existing fiscal period starting '${fpCheck.rows[0].min_start}'. The start date must be on or before the earliest fiscal period.`
        );
      }

      // 6. UPSERT into public.setting
      // Check if the setting already exists
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM public.setting WHERE key = 'accounting_start_date' AND deleted_at IS NULL LIMIT 1"
      );

      if (existing.rows[0]) {
        // Update existing
        await client.query(
          `UPDATE public.setting
           SET value = $1, updated_at = NOW(), description = $2
           WHERE id = $3`,
          [startDate, `Accounting start date set by ${actorId} at ${new Date().toISOString()}`, existing.rows[0].id]
        );
      } else {
        // Insert new
        await client.query(
          `INSERT INTO public.setting (id, "group", key, value, is_json, is_secret, description, created_at, updated_at)
           VALUES (gen_random_uuid()::text, 'accounting', 'accounting_start_date', $1, false, false, $2, NOW(), NOW())`,
          [startDate, `Accounting start date set by ${actorId} at ${new Date().toISOString()}`]
        );
      }

      return { startDate };
    });

    return result;
  }

  /**
   * Check whether the accounting start date is immutable (journal entries exist).
   */
  static async isStartDateImmutable(): Promise<boolean> {
    const res = await dbQuery<{ count: number }>(
      "SELECT count(*)::int AS count FROM public.accounting_journal_entry"
    );
    return res.rows[0].count > 0;
  }
}
