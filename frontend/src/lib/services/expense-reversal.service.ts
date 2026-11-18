/**
 * CakeToHome ERP — Expense Reversal Service
 * Phase C5: Compensating reversal workflow for posted operational expenses.
 *
 * ARCHITECTURAL SPECIFICATION:
 * 1. ONLY POSTED EXPENSES CAN BE REVERSED:
 *    - Rejects DRAFT, SUBMITTED, APPROVED, CANCELLED with INVALID_EXPENSE_STATUS.
 *    - Rejects already-reversed expenses with EXPENSE_ALREADY_REVERSED.
 * 2. SEGREGATION OF DUTIES (SoD):
 *    - reversed_by !== expense.created_by
 *    - reversed_by !== expense.approved_by
 *    - Zero Super Admin bypass.
 * 3. TELLER CUSTODY SYNCHRONIZATION (Correction #7):
 *    - Distinguishes accounting reversal from physical cash custody.
 *    - If cash was disbursed from a teller drawer (teller_session_id was populated):
 *      * If target_teller_session_id is provided: verifies session is OPEN at same branch
 *        and atomically records a compensating IN movement (movement_type = 'ADJUSTMENT').
 *      * If physical cash is returned to petty-cash float: debits 1114 Petty Cash float without
 *        touching a closed teller drawer.
 * 4. COMPENSATING REVERSAL VOUCHER & INVERTED JOURNAL:
 *    - Exact inversion of original journal lines:
 *      * newDebit = oldCredit
 *      * newCredit = oldDebit
 *    - Balanced double-entry guaranteed.
 * 5. LINKED REVERSAL AUDIT TRAIL:
 *    - Uses canonical PostingService.linkReversal:
 *      * originalVoucher.reversed_by_voucher_id = reversalVoucher.id
 *      * reversalVoucher.reversal_of_voucher_id = originalVoucher.id
 *      * originalJournal.is_reversed = true, reversed_at = NOW()
 *    - Updates expense: status = 'REVERSED', reversal_voucher_id, reversed_at, reversed_by, reversal_reason.
 */

import { dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { PostingService, PostingServiceError } from "./posting.service";
import { TellerMovementService } from "./teller-movement.service";
import type {
  AccountingVoucherRow,
  AccountingJournalEntryRow,
  AccountingJournalLineRow,
  JournalLineInput,
} from "../types/accounting.types";
import type { ExpenseRow } from "../types/expense.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type ExpenseReversalErrorCode =
  | "EXPENSE_NOT_FOUND"
  | "INVALID_EXPENSE_STATUS"
  | "EXPENSE_ALREADY_REVERSED"
  | "BRANCH_ACCESS_DENIED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "ORIGINAL_VOUCHER_NOT_FOUND"
  | "ORIGINAL_JOURNAL_NOT_FOUND"
  | "TELLER_SESSION_INVALID"
  | "REVERSAL_REASON_REQUIRED"
  | "EXPENSE_REVERSAL_FAILED";

export class ExpenseReversalError extends Error {
  readonly code: ExpenseReversalErrorCode;

  constructor(code: ExpenseReversalErrorCode, message: string) {
    super(message);
    this.name = "ExpenseReversalError";
    this.code = code;
  }
}

export interface ReverseExpenseParams {
  expenseId: string;
  reversedBy: string;
  reversalReason: string;
  reversalDate?: string;
  branchId?: string;
  targetTellerSessionId?: string;
  cashReturnDestination?: "TELLER_DRAWER" | "PETTY_CASH";
  client?: PoolClient;
}

export interface ExpenseReversalResult {
  expense: ExpenseRow;
  original_voucher: AccountingVoucherRow;
  reversal_voucher: AccountingVoucherRow;
  reversal_journal_entry: AccountingJournalEntryRow;
}

export class ExpenseReversalService {
  /**
   * Atomically reverses a POSTED expense, its accounting voucher, its General Ledger lines,
   * and synchronizes physical cash custody if applicable.
   */
  static async reverseExpense(
    params: ReverseExpenseParams
  ): Promise<ExpenseReversalResult> {
    const {
      expenseId,
      reversedBy,
      reversalReason,
      reversalDate,
      branchId,
      targetTellerSessionId,
      cashReturnDestination,
      client,
    } = params;

    if (!reversalReason || !reversalReason.trim()) {
      throw new ExpenseReversalError("REVERSAL_REASON_REQUIRED", "Reversal reason is required.");
    }

    const execute = async (c: PoolClient): Promise<ExpenseReversalResult> => {
      // 1. Lock expense row exclusively
      const expRes = await c.query<ExpenseRow>(
        `SELECT * FROM public.expense WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [expenseId]
      );
      const expense = expRes.rows[0];

      if (!expense) {
        throw new ExpenseReversalError("EXPENSE_NOT_FOUND", `Expense '${expenseId}' not found.`);
      }

      if (branchId && expense.branch_id !== branchId) {
        throw new ExpenseReversalError("BRANCH_ACCESS_DENIED", "Access denied: branch mismatch.");
      }

      if (expense.status === "REVERSED" || expense.reversal_voucher_id) {
        throw new ExpenseReversalError(
          "EXPENSE_ALREADY_REVERSED",
          `Expense '${expenseId}' has already been reversed.`
        );
      }

      if (expense.status !== "POSTED") {
        throw new ExpenseReversalError(
          "INVALID_EXPENSE_STATUS",
          `Cannot reverse expense with status '${expense.status}'. Only POSTED expenses can be reversed.`
        );
      }

      // 2. Strict Segregation of Duties (SoD)
      if (expense.created_by && expense.created_by === reversedBy) {
        throw new ExpenseReversalError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: The creator (${expense.created_by}) cannot reverse their own expense.`
        );
      }

      if (expense.approved_by && expense.approved_by === reversedBy) {
        throw new ExpenseReversalError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: The approver (${expense.approved_by}) cannot reverse this expense.`
        );
      }

      // 2b. A branch-paid expense that was already reimbursed must have that payment undone first
      const reimb = await c.query(
        `SELECT status FROM public.branch_reimbursement WHERE source_type = 'EXPENSE' AND source_id = $1 FOR UPDATE`,
        [expense.id]
      );
      if (reimb.rows[0]?.status === "PAID") {
        throw new ExpenseReversalError(
          "EXPENSE_REVERSAL_FAILED",
          "This expense was already reimbursed to the branch. Undo the reimbursement payment first, then reverse."
        );
      }

      // 3. Fetch original voucher
      if (!expense.voucher_id) {
        throw new ExpenseReversalError("ORIGINAL_VOUCHER_NOT_FOUND", "Original voucher reference is missing from expense.");
      }

      const vRes = await c.query<AccountingVoucherRow>(
        `SELECT * FROM public.accounting_voucher WHERE id = $1 FOR UPDATE`,
        [expense.voucher_id]
      );
      const originalVoucher = vRes.rows[0];
      if (!originalVoucher) {
        throw new ExpenseReversalError("ORIGINAL_VOUCHER_NOT_FOUND", `Original voucher '${expense.voucher_id}' not found.`);
      }

      // 4. Fetch original journal entry and lines
      const jEntryRes = await c.query<AccountingJournalEntryRow>(
        `SELECT * FROM public.accounting_journal_entry WHERE voucher_id = $1 FOR UPDATE`,
        [originalVoucher.id]
      );
      const originalJournal = jEntryRes.rows[0];
      if (!originalJournal) {
        throw new ExpenseReversalError("ORIGINAL_JOURNAL_NOT_FOUND", `Journal entry for voucher '${originalVoucher.id}' not found.`);
      }

      const jLinesRes = await c.query<AccountingJournalLineRow>(
        `SELECT * FROM public.accounting_journal_line WHERE journal_entry_id = $1 ORDER BY line_no ASC`,
        [originalJournal.id]
      );
      const originalLines = jLinesRes.rows;

      if (!originalLines || originalLines.length < 2) {
        throw new ExpenseReversalError("EXPENSE_REVERSAL_FAILED", "Original journal lines missing or incomplete.");
      }

      // 5. Invert Journal Lines: newDebit = oldCredit, newCredit = oldDebit
      const reversalJournalLines: JournalLineInput[] = originalLines.map((line) => ({
        account_id: line.account_id,
        debit_amount: Number(line.credit_amount),
        credit_amount: Number(line.debit_amount),
        branch_id: line.branch_id,
        customer_id: line.customer_id,
        supplier_id: line.supplier_id,
        tax_rate: line.tax_rate,
        tax_class: line.tax_class,
        narration: `Reversal of line ${line.line_no}: ${line.narration || ""}`.trim(),
        metadata: {
          original_line_id: line.id,
          original_voucher_id: originalVoucher.id,
          reversal_reason: reversalReason.trim(),
        },
      }));

      // 6. Handle Physical Cash Custody Synchronization (Correction #7)
      const isCashExpense = expense.payment_method === "CASH" && expense.settlement_type === "DIRECT_PAYMENT";
      if (isCashExpense && expense.teller_session_id) {
        // Physical cash was disbursed from a teller drawer
        const cashAmount = Number(expense.total);

        if (targetTellerSessionId) {
          // Verify target session is OPEN at the same branch
          const sessRes = await c.query<{ id: string; status: string; branch_id: string }>(
            `SELECT id, status, branch_id FROM public.teller_session WHERE id = $1 FOR UPDATE`,
            [targetTellerSessionId]
          );
          const targetSession = sessRes.rows[0];

          if (!targetSession) {
            throw new ExpenseReversalError("TELLER_SESSION_INVALID", `Target teller session '${targetTellerSessionId}' not found.`);
          }
          if (targetSession.status !== "OPEN") {
            throw new ExpenseReversalError("TELLER_SESSION_INVALID", `Target teller session is in state '${targetSession.status}'. Must be OPEN to receive cash.`);
          }
          if (targetSession.branch_id !== expense.branch_id) {
            throw new ExpenseReversalError("TELLER_SESSION_INVALID", "Target teller session belongs to a different branch.");
          }

          // Project compensating IN movement in C4 teller ledger
          await TellerMovementService.projectSystemMovement(
            {
              branch_id: expense.branch_id,
              teller_session_id: targetTellerSessionId,
              direction: "IN",
              movement_type: "ADJUSTMENT",
              amount: cashAmount,
              source_type: "EXPENSE_REVERSAL",
              source_id: expense.id,
              narration: `Cash returned to drawer from reversed expense ${expense.id}: ${reversalReason.trim()}`,
              created_by: reversedBy,
            },
            c
          );
        } else if (cashReturnDestination === "PETTY_CASH") {
          // Cash is returned to branch petty cash float, no teller session manufactured
          // The journal line credited to 1111 is redirected to 1114 Petty Cash
          const pettyAcc = (await AccountingAccountRepository.findByCode("1114", c)) ||
                           (await AccountingAccountRepository.findByCode("1111", c));
          if (pettyAcc) {
            for (const l of reversalJournalLines) {
              // The original credit to 1111 is now a debit in reversal; if re-directed to petty cash:
              if (l.debit_amount > 0 && l.credit_amount === 0) {
                const acc = await AccountingAccountRepository.findById(l.account_id, c);
                if (acc && (acc.code === "1111" || acc.subtype === "CASH")) {
                  l.account_id = pettyAcc.id;
                  l.narration = `Petty cash recovery from reversed expense ${expense.id}`;
                }
              }
            }
          }
        }
      }

      // 7. Validate Reversal Date & Fiscal Period
      const effectiveDate = reversalDate || new Date().toISOString().slice(0, 10);
      const fiscalPeriod = await PostingService.validateFiscalPeriod(effectiveDate, c);
      await PostingService.validateAccountingStartDate(effectiveDate, c);

      // 8. Create Compensating Reversal Voucher
      const defaultPreparer = `sys_rev_${expense.branch_id.replace(/^br_/, "")}`;
      const preparerId = reversedBy === defaultPreparer ? `sys_rev_clerk` : defaultPreparer;

      const reversalVoucherRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "EXPENSE",
          voucher_date: effectiveDate,
          branch_id: expense.branch_id,
          narration: `Reversal of Expense ${expense.id} (Voucher ${originalVoucher.voucher_no}): ${reversalReason.trim()}`,
          reference_type: "EXPENSE",
          reference_id: expense.id,
          reference_event: "REVERSAL",
          reversal_of_voucher_id: originalVoucher.id,
          metadata: {
            original_voucher_id: originalVoucher.id,
            original_voucher_no: originalVoucher.voucher_no,
            original_journal_entry_id: originalJournal.id,
            reversal_reason: reversalReason.trim(),
            reversed_by: reversedBy,
          },
        },
        branchId: expense.branch_id,
        fiscalYear: fiscalPeriod.fiscal_year,
        createdBy: preparerId,
        client: c,
      });

      if (!reversalVoucherRes.success) {
        throw new ExpenseReversalError("EXPENSE_REVERSAL_FAILED", reversalVoucherRes.error || "Failed to create reversal voucher.");
      }
      if (!reversalVoucherRes.data) {
        throw new ExpenseReversalError("EXPENSE_REVERSAL_FAILED", "Reversal voucher draft data is missing.");
      }

      const reversalVoucher = reversalVoucherRes.data;

      // Submit reversal voucher
      const subRes = await PostingService.submitVoucher({
        voucherId: reversalVoucher.id,
        submittedBy: preparerId,
        branchId: expense.branch_id,
        client: c,
      });
      if (!subRes.success) {
        throw new ExpenseReversalError("EXPENSE_REVERSAL_FAILED", subRes.error || "Failed to submit reversal voucher.");
      }

      // Approve reversal voucher (SoD: reversedBy !== preparerId)
      const appRes = await PostingService.approveVoucher({
        voucherId: reversalVoucher.id,
        approvedBy: reversedBy,
        branchId: expense.branch_id,
        client: c,
      });
      if (!appRes.success) {
        throw new ExpenseReversalError("EXPENSE_REVERSAL_FAILED", appRes.error || "Failed to approve reversal voucher.");
      }

      // Post reversal voucher to GL
      const postReversalRes = await PostingService.postVoucher({
        voucherId: reversalVoucher.id,
        postedBy: reversedBy,
        lines: reversalJournalLines,
        branchId: expense.branch_id,
        client: c,
      });

      if (!postReversalRes.success) {
        throw new ExpenseReversalError("EXPENSE_REVERSAL_FAILED", postReversalRes.error || "Failed to post reversal voucher to GL.");
      }
      if (!postReversalRes.data) {
        throw new ExpenseReversalError("EXPENSE_REVERSAL_FAILED", "Reversal posting result data is missing.");
      }

      // 9. Authoritative Linkage via PostingService.linkReversal
      await PostingService.linkReversal({
        originalVoucherId: originalVoucher.id,
        reversalVoucherId: reversalVoucher.id,
        reversedBy,
        branchId: expense.branch_id,
      }, c);

      // 10. Update Operational Expense Record
      const updatedExpRes = await c.query<ExpenseRow>(
        `UPDATE public.expense 
         SET status = 'REVERSED',
             reversal_voucher_id = $1,
             reversed_at = NOW(),
             reversed_by = $2,
             reversal_reason = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [reversalVoucher.id, reversedBy, reversalReason.trim(), expense.id]
      );

      // Branch-paid expense: the amount is no longer owed to the branch
      await c.query(
        `UPDATE public.branch_reimbursement
            SET status = 'REVERSED', reversed_at = NOW(), reversed_by = $2, reversal_reason = $3, updated_at = NOW()
          WHERE source_type = 'EXPENSE' AND source_id = $1 AND status = 'OPEN'`,
        [expense.id, reversedBy, reversalReason.trim()]
      );

      return {
        expense: updatedExpRes.rows[0],
        original_voucher: originalVoucher,
        reversal_voucher: postReversalRes.data.voucher,
        reversal_journal_entry: postReversalRes.data.journal_entry,
      };
    };

    return client ? execute(client) : dbTransaction(execute);
  }
}
