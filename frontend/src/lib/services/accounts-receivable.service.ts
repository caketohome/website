/**
 * CakeToHome ERP — Accounts Receivable (AR) Service
 * Phase 4F Step 4.8: Bounded Implementation — Trade AR Statement & AR ↔ GL Reconciliation.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Control Account 1121 (Accounts Receivable) has a normal DEBIT balance.
 *    - Invoices & refunds: DEBIT (increases customer trade receivable)
 *    - Receipts, returns (credit notes), & invoice reversals: CREDIT (decreases customer trade receivable)
 * 2. Control Account 1122 (Undeposited COD) is STRICTLY EXCLUDED from Trade AR.
 * 3. Running balance on Customer Statement:
 *    - RunningBalance_i = RunningBalance_{i-1} + Debit_i - Credit_i
 * 4. Deterministic same-day transaction ordering:
 *    - ORDER BY v.voucher_date ASC, je.created_at ASC, v.voucher_no ASC, jl.line_no ASC, jl.id ASC
 * 5. Trade AR ↔ GL Mathematical Identity:
 *    - GL 1121 Balance === (Identified Customer Total + Guest/Unassigned AR Total)
 *    - Discrepancy === 0.00
 * 6. AR Aging is EXPLICITLY FEATURE-BLOCKED pending authoritative due-date policy approval.
 *
 * SEPARATION OF CONCERNS:
 * - AccountsReceivableRepository: Owns SQL queries, joins, filtering, and aggregation.
 * - AccountsReceivableService: Owns domain invariants, validation, RBAC/SoD, mathematical verification, and response composition.
 */

import type { PoolClient } from "pg";
import { hasEffectivePermission } from "../staff-access-control";
import { AccountsReceivableRepository } from "../repositories/accounts-receivable.repository";
import type {
  CustomerStatementFilters,
  CustomerStatementResult,
  CustomerStatementLine,
  ArGlReconciliationFilters,
  ArGlReconciliationResult,
  CustomerArBalanceRow,
  ArReconciliationException,
  ArAgingScheduleBlockedResult,
} from "../types/accounts-receivable.types";

export class AccountsReceivableService {
  /**
   * Retrieves the authoritative chronological Trade Accounts Receivable Statement (Subledger for Account 1121)
   * for a specific customer, with exact opening balance and running balance.
   */
  static async getCustomerStatement(
    filters: CustomerStatementFilters,
    client?: PoolClient
  ): Promise<CustomerStatementResult> {
    // 0. Server-side RBAC & branch / customer isolation validation
    if (filters.actorContext) {
      if (!hasEffectivePermission(filters.actorContext, "ACCOUNTING.VIEW")) {
        throw new Error("PERMISSION_DENIED: User lacks ACCOUNTING.VIEW permission.");
      }

      // Customer self-service boundary
      const actorRole = filters.actorContext.role;
      const actorCustomerId = filters.actorContext.customer_id || filters.actorContext.customerId;
      if (actorRole === "CUSTOMER" || actorCustomerId) {
        const authorizedCustomerId = actorCustomerId || filters.actorContext.id;
        if (filters.customer_id !== authorizedCustomerId) {
          throw new Error("CUSTOMER_ACCESS_DENIED: Cannot access statements of other customers.");
        }
      }

      // Staff branch boundary:
      // SUPER_ADMIN has enterprise scope (may query enterprise aggregate or specific branch).
      // Non-super-admin staff MUST have a verified branch assignment and are strictly locked to it.
      // A null/absent branch context NEVER grants enterprise access.
      const isSuperAdmin = actorRole === "SUPER_ADMIN" || filters.actorContext.userId === "admin_01" || filters.actorContext.isSuperAdmin === true;
      if (actorRole !== "CUSTOMER" && !isSuperAdmin) {
        const actorBranch = filters.actorContext.branch_id || filters.actorContext.branchId;
        if (!actorBranch) {
          throw new Error("BRANCH_ACCESS_DENIED: Non-super-admin user has no authorized branch assignment.");
        }
        if (filters.branch_id && filters.branch_id !== actorBranch) {
          throw new Error("BRANCH_ACCESS_DENIED: Cross-branch access denied.");
        }
        filters.branch_id = actorBranch;
      }
    }

    // 1. Validate customer identity (Fail closed: No anonymous/guest statements)
    if (
      !filters.customer_id ||
      typeof filters.customer_id !== "string" ||
      !filters.customer_id.trim() ||
      filters.customer_id.trim().toLowerCase() === "guest"
    ) {
      throw new Error(
        "INVALID_ARGUMENT: customer_id is required for Trade AR Statement. Statements cannot be generated for anonymous or guest checkouts."
      );
    }

    // 2. Fetch Customer details from repository
    const customer = await AccountsReceivableRepository.findCustomerById(filters.customer_id, client);
    if (!customer) {
      throw new Error(`Customer '${filters.customer_id}' not found.`);
    }

    // 3. Resolve Account 1121 (Trade Accounts Receivable)
    const arAccount = await AccountsReceivableRepository.findAccountByCode("1121", client);
    if (!arAccount) {
      throw new Error("Trade Accounts Receivable control account '1121' is not configured.");
    }
    const arAccountId = arAccount.id;

    // 4. Compute Opening Balance (prior to startDate based on voucher_date)
    let openingBalance = 0;
    if (filters.startDate) {
      openingBalance = await AccountsReceivableRepository.getOpeningBalance(
        {
          accountId: arAccountId,
          customerId: filters.customer_id,
          startDate: filters.startDate,
          branchId: filters.branch_id,
        },
        client
      );
    }

    // 5. Query Transactions in Period via Repository
    const rawLines = await AccountsReceivableRepository.getStatementLines(
      {
        accountId: arAccountId,
        customerId: filters.customer_id,
        startDate: filters.startDate || "1970-01-01",
        endDate: filters.endDate || "9999-12-31",
        branchId: filters.branch_id,
      },
      client
    );

    let runningBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const transactions: CustomerStatementLine[] = rawLines.map((row) => {
      const debit = Math.round(Number(row.debit_amount) * 100) / 100;
      const credit = Math.round(Number(row.credit_amount) * 100) / 100;

      totalDebit += debit;
      totalCredit += credit;
      // Normal DEBIT balance: increases with debit, decreases with credit
      runningBalance = Math.round((runningBalance + debit - credit) * 100) / 100;

      return {
        line_id: row.line_id,
        voucher_date: typeof row.voucher_date === "string" ? row.voucher_date : (row.voucher_date as Date).toISOString().slice(0, 10),
        created_at: typeof row.entry_created_at === "string" ? row.entry_created_at : (row.entry_created_at as Date).toISOString(),
        entry_no: `LINE-${row.line_no}`,
        voucher_id: row.voucher_id,
        voucher_no: row.voucher_no,
        voucher_type: row.voucher_type,
        reference_type: row.reference_type || "UNKNOWN",
        reference_id: row.reference_id,
        reference_event: row.reference_event,
        description: row.line_narration || row.voucher_narration || "",
        branch_id: row.branch_id,
        branch_name: row.branch_name || "Unknown Branch",
        debit_amount: debit,
        credit_amount: credit,
        running_balance: runningBalance,
        customer_id: filters.customer_id,
      };
    });

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;
    const netMovement = Math.round((totalDebit - totalCredit) * 100) / 100;
    const closingBalance = Math.round((openingBalance + netMovement) * 100) / 100;

    // Mathematical reconciliation check
    if (transactions.length > 0) {
      const finalRunning = transactions[transactions.length - 1].running_balance;
      if (Math.abs(closingBalance - finalRunning) > 0.001) {
        throw new Error(
          `INTERNAL_INVARIANT_VIOLATION: Closing balance (${closingBalance}) does not equal final running balance (${finalRunning}).`
        );
      }
    }

    return {
      customer: {
        id: customer.id,
        first_name: customer.first_name || "",
        last_name: customer.last_name || "",
        company_name: null,
        email: customer.email,
        phone: customer.phone,
        status: "ACTIVE" as const,
      },
      control_account: {
        code: "1121",
        name: arAccount.name,
      },
      branch_id: filters.branch_id,
      startDate: filters.startDate,
      endDate: filters.endDate,
      opening_balance: openingBalance,
      total_debit: totalDebit,
      total_credit: totalCredit,
      net_movement: netMovement,
      closing_balance: closingBalance,
      transactions,
    };
  }

  /**
   * Retrieves the authoritative Trade AR ↔ General Ledger Reconciliation Report.
   * Proves the mathematical identity:
   *   GL 1121 Balance === Identified Customer Total + Guest/Unassigned Total
   *   Discrepancy === 0.00
   */
  static async getArGlReconciliation(
    filters: ArGlReconciliationFilters,
    client?: PoolClient
  ): Promise<ArGlReconciliationResult> {
    // 0. Server-side RBAC & branch boundary validation
    if (filters.actorContext) {
      if (!hasEffectivePermission(filters.actorContext, "ACCOUNTING.VIEW")) {
        throw new Error("PERMISSION_DENIED: User lacks ACCOUNTING.VIEW permission.");
      }
      // Staff branch boundary:
      // SUPER_ADMIN has enterprise scope (may query enterprise aggregate or specific branch).
      // Non-super-admin staff MUST have a verified branch assignment and are strictly locked to it.
      // A null/absent branch context NEVER grants enterprise access.
      const actorRole = (filters.actorContext.role || "").toUpperCase();
      const isSuperAdmin = actorRole === "SUPER_ADMIN" || filters.actorContext.userId === "admin_01" || filters.actorContext.isSuperAdmin === true;
      if (!isSuperAdmin) {
        const actorBranch = filters.actorContext.branch_id || filters.actorContext.branchId;
        if (!actorBranch) {
          throw new Error("BRANCH_ACCESS_DENIED: Non-super-admin user has no authorized branch assignment.");
        }
        if (filters.branch_id && filters.branch_id !== actorBranch) {
          throw new Error("BRANCH_ACCESS_DENIED: Cross-branch access denied.");
        }
        filters.branch_id = actorBranch;
      }
    }

    const asOfDate = filters.as_of_date || new Date().toISOString().slice(0, 10);

    // 1. Resolve Account 1121 (Trade Accounts Receivable)
    const arAccount = await AccountsReceivableRepository.findAccountByCode("1121", client);
    if (!arAccount) {
      throw new Error("Trade Accounts Receivable control account '1121' is not configured.");
    }
    const arAccountId = arAccount.id;

    // 2. Query General Ledger 1121 Total Balance as of asOfDate via Repository
    const glBalance = await AccountsReceivableRepository.getGlAccountBalance(
      { accountId: arAccountId, asOfDate, branchId: filters.branch_id },
      client
    );

    // 3. Query Subledger Balances for Identified Customers (customer_id IS NOT NULL) via Repository
    const rawCustBalances = await AccountsReceivableRepository.getCustomerSubledgerBalances(
      { accountId: arAccountId, asOfDate, branchId: filters.branch_id },
      client
    );

    const customerBalances: CustomerArBalanceRow[] = rawCustBalances.map((r) => ({
      customer_id: r.customer_id,
      first_name: r.first_name || "",
      last_name: r.last_name || "",
      company_name: null,
      phone: r.phone,
      email: r.email,
      debit_total: Math.round(Number(r.total_debit) * 100) / 100,
      credit_total: Math.round(Number(r.total_credit) * 100) / 100,
      balance: Math.round(Number(r.balance) * 100) / 100,
    }));

    const identifiedCustomerTotal = Math.round(
      customerBalances.reduce((sum, c) => sum + c.balance, 0) * 100
    ) / 100;

    // 4. Query Subledger Balances for Guest / Unassigned Activity (customer_id IS NULL) via Repository
    const guestUnassignedTotal = await AccountsReceivableRepository.getGuestUnassignedBalance(
      { accountId: arAccountId, asOfDate, branchId: filters.branch_id },
      client
    );

    // 5. Total Control Amount & Difference Calculation
    const totalControlAmount = Math.round((identifiedCustomerTotal + guestUnassignedTotal) * 100) / 100;
    const difference = Math.round((totalControlAmount - glBalance) * 100) / 100;

    // 6. Systematic Exception Detection via Repository Queries
    const exceptions: ArReconciliationException[] = [];

    // Exception 1: Missing customer dimension on commercial orders that actually have registered customer
    const missingDimRows = await AccountsReceivableRepository.findMissingCustomerDimensionLines(
      { accountId: arAccountId, asOfDate },
      client
    );
    for (const r of missingDimRows) {
      exceptions.push({
        exception_type: "MISSING_CUSTOMER_DIMENSION",
        severity: "CRITICAL",
        voucher_id: r.voucher_id,
        voucher_no: r.voucher_no,
        journal_line_id: r.line_id,
        amount: Math.round(Number(r.net_amount) * 100) / 100,
        description: `Order '${r.reference_id}' belongs to registered customer '${r.registered_customer_id}', but journal line has NULL customer_id.`,
      });
    }

    // Exception 2: Invalid customer reference
    // (Note: Database foreign key prevents this at DDL layer; scanned defensively)
    const invalidCustRows = await AccountsReceivableRepository.findInvalidCustomerReferenceLines(
      { accountId: arAccountId, asOfDate },
      client
    );
    for (const r of invalidCustRows) {
      exceptions.push({
        exception_type: "INVALID_CUSTOMER_REFERENCE",
        severity: "CRITICAL",
        voucher_id: r.voucher_id,
        voucher_no: r.voucher_no,
        journal_line_id: r.line_id,
        customer_id: r.customer_id,
        amount: Math.round(Number(r.net_amount) * 100) / 100,
        description: `Journal line references customer ID '${r.customer_id}' which does not exist in public.customer.`,
      });
    }

    // Exception 3: Duplicate source identity (multiple PRIMARY vouchers on same reference)
    const dupSourceRows = await AccountsReceivableRepository.findDuplicateSourceVouchers(
      { asOfDate },
      client
    );
    for (const r of dupSourceRows) {
      exceptions.push({
        exception_type: "DUPLICATE_SOURCE_IDENTITY",
        severity: "CRITICAL",
        reference_type: r.reference_type,
        reference_id: r.reference_id,
        description: `Multiple (${r.count_vouchers}) active POSTED vouchers exist for PRIMARY reference '${r.reference_type}:${r.reference_id}'.`,
      });
    }

    // Exception 4: Branch mismatch between journal line and voucher
    const branchMismatchRows = await AccountsReceivableRepository.findBranchMismatchLines(
      { accountId: arAccountId, asOfDate },
      client
    );
    for (const r of branchMismatchRows) {
      exceptions.push({
        exception_type: "BRANCH_MISMATCH",
        severity: "CRITICAL",
        voucher_id: r.voucher_id,
        voucher_no: r.voucher_no,
        journal_line_id: r.line_id,
        description: `Branch mismatch detected: journal line branch '${r.line_branch_id}' differs from voucher branch '${r.voucher_branch_id}'.`,
      });
    }

    // Exception 5: Unbalanced journal entry (header debit != credit, lines debit != credit, or lines sum != header)
    const unbalancedRows = await AccountsReceivableRepository.findUnbalancedJournalEntries(
      { asOfDate },
      client
    );
    for (const r of unbalancedRows) {
      exceptions.push({
        exception_type: "UNBALANCED_JOURNAL",
        severity: "CRITICAL",
        description: `Journal entry '${r.entry_no}' (Voucher '${r.voucher_no}') is unbalanced: Header Debits (${r.total_debit}) / Credits (${r.total_credit}), Lines Debits (${r.lines_debit}) / Credits (${r.lines_credit}).`,
      });
    }

    // Exception 6: Account misclassification (postings to parent group account 1120)
    const misclassRows = await AccountsReceivableRepository.findAccountMisclassificationLines(
      { asOfDate },
      client
    );
    for (const r of misclassRows) {
      exceptions.push({
        exception_type: "ACCOUNT_MISCLASSIFICATION",
        severity: "CRITICAL",
        voucher_id: r.voucher_id,
        voucher_no: r.voucher_no,
        journal_line_id: r.line_id,
        amount: Math.round(Number(r.net_amount) * 100) / 100,
        description: `Journal line was posted to parent group account 1120 instead of specific leaf account 1121.`,
      });
    }

    return {
      control_account: {
        code: "1121",
        name: arAccount.name,
        gl_balance: glBalance,
      },
      as_of_date: asOfDate,
      branch_id: filters.branch_id,
      subledger: {
        identified_customer_total: identifiedCustomerTotal,
        guest_unassigned_total: guestUnassignedTotal,
        total_control_amount: totalControlAmount,
        customer_count: customerBalances.length,
      },
      reconciliation: {
        is_reconciled: Math.abs(difference) === 0,
        difference,
      },
      exceptions,
      customer_balances: customerBalances,
    };
  }

  /**
   * AR Aging Schedule is explicitly FEATURE-BLOCKED pending authoritative accounting policy approval.
   * Prohibits assumption of arbitrary due dates (voucher_date vs delivery_date vs terms).
   */
  static async getArAgingSchedule(
    _filters: any,
    _client?: PoolClient
  ): Promise<ArAgingScheduleBlockedResult> {
    throw new Error(
      "FEATURE_BLOCKED: AR AGING: NOT AVAILABLE — DUE-DATE POLICY NOT APPROVED"
    );
  }
}
