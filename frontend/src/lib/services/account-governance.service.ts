/**
 * CakeToHome ERP — Account Governance Service
 * Phase C7.6 Step 3: Chart of Accounts Governance & Dimensional Policy Engine
 *
 * ARCHITECTURAL CONTRACT & GOVERNANCE RULES:
 * 1. DIMENSIONAL INTEGRITY:
 *    - Cost centres are dimensions, NOT GL accounts.
 *    - Cost centres identify operating responsibility units (Kitchen, Fleet, Marketing, IT, etc.).
 * 2. BALANCE SHEET IMMUNITY:
 *    - Accounts in 1xxx (Assets), 2xxx (Liabilities), and 3xxx (Equity) are strictly PROHIBITED
 *      from receiving cost-centre assignments.
 *    - Cash, Bank, Receivables, Payables, Taxes (GST/TDS), and Equity belong to the entity/branch,
 *      not operating departments.
 * 3. OPERATIONAL FLEXIBILITY:
 *    - Operational accounts in 4xxx (Revenue) and 5xxx (COGS, Opex, Financial Expenses) are OPTIONAL.
 *    - Permitted to carry cost-centre attribution, or remain null (unallocated / corporate).
 * 4. SUMMARY GROUP PROTECTION:
 *    - All 24 summary group accounts (is_group = true) are PROHIBITED from direct journal postings.
 * 5. DETERMINISTIC & TYPE-SAFE:
 *    - Pure policy resolution based on account code, type, subtype, and is_group.
 *    - Zero schema changes; zero database policy tables.
 */

import type { PoolClient } from "pg";
import { dbQuery } from "../db";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import {
  AccountGovernanceError,
  type CostCentrePolicy,
  type AccountingAccountRow,
  type AccountType,
  type AccountSubtype,
  type JournalLineInput,
} from "../types/accounting.types";

export class AccountGovernanceService {
  /**
   * Resolves the deterministic CostCentrePolicy for an account.
   *
   * Rules:
   * - is_group === true -> PROHIBITED (groups cannot be posted to)
   * - 1xxx (ASSET) -> PROHIBITED
   * - 2xxx (LIABILITY) -> PROHIBITED
   * - 3xxx (EQUITY) -> PROHIBITED
   * - 4xxx (REVENUE) -> OPTIONAL
   * - 5xxx (EXPENSE: 51xx COGS, 52xx Opex, 53xx Fin/Deprec) -> OPTIONAL
   */
  static getCostCentrePolicy(
    account:
      | AccountingAccountRow
      | {
          code: string;
          type: AccountType;
          subtype?: AccountSubtype | string;
          is_group?: boolean;
        }
  ): CostCentrePolicy {
    if (account.is_group) {
      return "PROHIBITED";
    }

    const code = account.code ? account.code.trim() : "";
    const type = account.type;

    // 1xxx Assets
    if (code.startsWith("1") || type === "ASSET") {
      return "PROHIBITED";
    }

    // 2xxx Liabilities
    if (code.startsWith("2") || type === "LIABILITY") {
      return "PROHIBITED";
    }

    // 3xxx Equity
    if (code.startsWith("3") || type === "EQUITY") {
      return "PROHIBITED";
    }

    // 4xxx Revenue
    if (code.startsWith("4") || type === "REVENUE") {
      return "OPTIONAL";
    }

    // 5xxx Expenses (COGS, Opex, Financial Expenses)
    if (code.startsWith("5") || type === "EXPENSE") {
      return "OPTIONAL";
    }

    // Fallback: Default fail-closed for any unknown balance sheet type
    return "PROHIBITED";
  }

  /**
   * Validates a single journal line against its target account's governance policy.
   *
   * @throws {AccountGovernanceError}
   *   - ACCOUNT_GROUP_NON_POSTABLE if is_group === true
   *   - COST_CENTRE_PROHIBITED if policy is PROHIBITED and cost_centre_id is provided
   *   - COST_CENTRE_REQUIRED if policy is REQUIRED and cost_centre_id is missing
   */
  static validateLineCostCentre(
    account: AccountingAccountRow,
    costCentreId?: string | null
  ): void {
    if (account.is_group) {
      throw new AccountGovernanceError(
        "ACCOUNT_GROUP_NON_POSTABLE",
        `Direct journal postings to summary group account ${account.code} (${account.name}) are prohibited.`,
        { accountCode: account.code, accountName: account.name }
      );
    }

    const policy = this.getCostCentrePolicy(account);
    const hasCostCentre =
      costCentreId !== null &&
      costCentreId !== undefined &&
      typeof costCentreId === "string" &&
      costCentreId.trim() !== "";

    if (policy === "PROHIBITED" && hasCostCentre) {
      throw new AccountGovernanceError(
        "COST_CENTRE_PROHIBITED",
        `Cost centre cannot be assigned to balance-sheet account ${account.code} (${account.name}). Cost centre usage is PROHIBITED for this account class (${account.type}).`,
        { accountCode: account.code, accountName: account.name }
      );
    }

    if (policy === "REQUIRED" && !hasCostCentre) {
      throw new AccountGovernanceError(
        "COST_CENTRE_REQUIRED",
        `Cost centre is REQUIRED for account ${account.code} (${account.name}) but none was provided.`,
        { accountCode: account.code, accountName: account.name }
      );
    }
  }

  /**
   * Validates all proposed journal lines in a journal entry against CoA governance rules.
   *
   * Checks:
   * 1. All account IDs exist, are active, and are NOT groups (via AccountingAccountRepository).
   * 2. Each line complies with the account's CostCentrePolicy (PROHIBITED / OPTIONAL / REQUIRED).
   * 3. Any referenced cost_centre_ids exist in public.cost_centre and are active.
   *
   * @throws {AccountGovernanceError}
   */
  static async validateJournalLines(
    lines: JournalLineInput[],
    client?: PoolClient
  ): Promise<Map<string, AccountingAccountRow>> {
    if (!lines || lines.length === 0) {
      return new Map();
    }

    const accountIds = lines.map((l) => l.account_id);
    let accountMap: Map<string, AccountingAccountRow>;

    try {
      accountMap = await AccountingAccountRepository.validatePostingAccounts(
        accountIds,
        client
      );
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("summary group")) {
        throw new AccountGovernanceError("ACCOUNT_GROUP_NON_POSTABLE", msg);
      }
      if (msg.includes("inactive")) {
        throw new AccountGovernanceError("ACCOUNT_INACTIVE", msg);
      }
      throw new AccountGovernanceError("ACCOUNT_NOT_FOUND", msg);
    }

    // Collect cost centres to validate
    const costCentreIdsToValidate = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const account = accountMap.get(line.account_id);

      if (!account) {
        throw new AccountGovernanceError(
          "ACCOUNT_NOT_FOUND",
          `Account ID '${line.account_id}' referenced in line ${i + 1} was not found.`
        );
      }

      // Check line-level policy
      this.validateLineCostCentre(account, line.cost_centre_id);

      if (
        line.cost_centre_id &&
        typeof line.cost_centre_id === "string" &&
        line.cost_centre_id.trim() !== ""
      ) {
        costCentreIdsToValidate.add(line.cost_centre_id.trim());
      }
    }

    // Verify referenced cost centres exist and are active
    if (costCentreIdsToValidate.size > 0) {
      const ccIds = Array.from(costCentreIdsToValidate);
      const sql = `
        SELECT id, code, is_active FROM public.cost_centre
        WHERE id = ANY($1::text[]) AND deleted_at IS NULL;
      `;
      const res = client
        ? await client.query<{ id: string; code: string; is_active: boolean }>(sql, [ccIds])
        : await dbQuery<{ id: string; code: string; is_active: boolean }>(sql, [ccIds]);

      const foundMap = new Map<string, { id: string; code: string; is_active: boolean }>();
      for (const row of res.rows) {
        foundMap.set(row.id, row);
      }

      for (const ccId of ccIds) {
        const cc = foundMap.get(ccId);
        if (!cc) {
          throw new AccountGovernanceError(
            "COST_CENTRE_INVALID",
            `Referenced cost centre ID '${ccId}' does not exist.`
          );
        }
        if (!cc.is_active) {
          throw new AccountGovernanceError(
            "COST_CENTRE_INVALID",
            `Referenced cost centre '${cc.code}' (ID '${ccId}') is inactive and cannot receive postings.`
          );
        }
      }
    }

    return accountMap;
  }
}
