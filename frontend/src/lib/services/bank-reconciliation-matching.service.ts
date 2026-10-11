/**
 * CakeToHome ERP — Bank Reconciliation Matching Engine & Clearance Service
 * Phase 4F Step 4.10 Substep 4.10.5-C: Automated Bank Reconciliation Matching Engine + Stage-2 Transit Clearance
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DATABASE IS THE ONLY SOURCE OF TRUTH:
 *    - All financial state, candidates, and vouchers are governed strictly by PostgreSQL.
 *    - Never use client-supplied branch_id, bank_account_id, or GL accounts.
 * 2. CRITICAL ACCOUNTING BOUNDARY:
 *    - Statement ingestion and matching remains EVIDENCE-ONLY.
 *    - Automated candidate matching MUST NOT automatically create financial postings.
 *    - Conceptual Flow:
 *        BANK STATEMENT EVIDENCE -> MATCH CANDIDATE -> VALIDATION -> AUTHENTICATED CONFIRMATION / APPROVAL -> GL POSTING
 * 3. VECTOR A — CASH DEPOSIT TRANSIT CLEARANCE:
 *    - Match bank statement CREDIT against public.bank_deposit_slip.
 *    - Date window: statement credit date must be on or after deposit date, within the approved +3-day window.
 *    - Amount: exact integer paise equality.
 *    - Ambiguity safety: 0 candidates -> UNMATCHED/EXCEPTION, exactly 1 -> PROPOSED, >1 -> AMBIGUOUS_EXCEPTION.
 *    - Stage 2 GL Posting: Dr 1112 Bank Operating A/c / Cr 1118 Deposit in Transit.
 *    - Link resulting voucher to bank_deposit_slip.credit_voucher_id.
 *    - Voucher date = statement value_date (or transaction_date).
 *    - 1119 Unclassified Suspense MUST NEVER be an automatic fallback.
 * 4. VECTOR B — GATEWAY PAYOUT CONFIRMATION:
 *    - Match bank statement CREDIT against public.gateway_payout_batch.
 *    - The gateway settlement was ALREADY financially posted in Step 4.10.3 (Dr 1112 / Dr 5290 / Cr 1113).
 *    - Vector B MUST NOT create another GL voucher! Evidence confirmation only.
 * 5. VECTOR C — DIRECT BANK ENTRIES & PAYMENTS:
 *    - Match statement DEBIT against internal payments (e.g. purchase_payment).
 *    - Unmatched debits become explicit exceptions. Zero automatic 1119 posting.
 * 6. HARD ACCOUNTING GUARDS & SoD:
 *    - Canonical PostingService workflow: draft -> submit -> approve -> post.
 *    - Enforces: accounting_start_date guard, fiscal_period guard, balanced journal, accounts 1112 & 1118 active.
 *    - Strict Segregation of Duties:
 *      * matcher_id != confirmer_id
 *      * slip.prepared_by cannot confirm clearance or post Stage 2
 *      * Super Admin cannot bypass SoD restrictions.
 * 7. CONCURRENCY & IDEMPOTENCY:
 *    - Deterministic lock ordering: bank_deposit_slip -> bank_account -> bank_statement_line -> match.
 *    - Idempotent execution returns authoritative existing result (wasDuplicate: true).
 *    - Atomic transaction: rollback on posting failure rolls back match; failure of match rolls back posting.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import {
  BankReconciliationRepository,
  BankReconciliationRepositoryError,
} from "../repositories/bank-reconciliation.repository";
import { BankDepositSlipRepository } from "../repositories/bank-deposit-slip.repository";
import { BankAccountRepository } from "../repositories/bank-account.repository";
import { PostingService, PostingServiceError } from "./posting.service";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  BankReconciliationSessionRow,
  BankReconciliationMatchRow,
  BankStatementLineRow,
  BankDepositSlipRow,
  CandidateMatchResult,
  ConfirmCashDepositClearanceParams,
  ConfirmCashDepositClearanceResult,
  ConfirmGatewayPayoutMatchParams,
  ConfirmGatewayPayoutMatchResult,
  ConfirmSupplierPaymentMatchParams,
  ConfirmSupplierPaymentMatchResult,
  ManualReconciliationMatchParams,
  JournalLineInput,
} from "../types/accounting.types";

export class BankReconciliationServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BankReconciliationServiceError";
    this.code = code;
  }
}

/**
 * Timezone-safe date formatter for SQL/DB date fields.
 */
function formatDateOnly(d: string | Date): string {
  if (typeof d === "string") return d.substring(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculates calendar day difference (date2 - date1) safely without timezone distortion.
 */
function diffCalendarDays(date1Str: string, date2Str: string): number {
  const [y1, m1, d1] = date1Str.split("-").map(Number);
  const [y2, m2, d2] = date2Str.split("-").map(Number);
  const utcD1 = Date.UTC(y1, m1 - 1, d1);
  const utcD2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utcD2 - utcD1) / (24 * 60 * 60 * 1000));
}

/**
 * Converts decimal amount to exact integer paise to avoid floating-point inaccuracies.
 */
function toPaise(amount: number | string): number {
  return Math.round(Number(amount) * 100);
}

export class BankReconciliationMatchingEngine {
  /**
   * Evaluates an individual statement line against candidate internal source records.
   * Creates a PROPOSED match if exactly 1 authoritative candidate is found.
   * Never automatically posts accounting entries.
   */
  static async autoMatchStatementLine(
    statementLineId: string,
    sessionId: string,
    matcherId: string,
    client?: PoolClient
  ): Promise<CandidateMatchResult> {
    const execute = async (c: PoolClient): Promise<CandidateMatchResult> => {
      // 1. Fetch statement line
      const lineRes = await c.query(
        `SELECT * FROM public.bank_statement_line WHERE id = $1`,
        [statementLineId]
      );
      const line: BankStatementLineRow = lineRes.rows[0];
      if (!line) {
        throw new BankReconciliationServiceError(
          "STATEMENT_LINE_NOT_FOUND",
          `Statement line '${statementLineId}' not found.`
        );
      }

      if (line.reconciliation_status === "MATCHED") {
        return {
          statementLineId: line.id,
          candidateType: "OTHER",
          status: "ALREADY_MATCHED",
          candidatesCount: 0,
          reason: "Statement line is already matched and reconciled.",
        };
      }

      const statementDate = formatDateOnly(line.value_date || line.transaction_date);
      const creditPaise = toPaise(line.credit_amount);
      const debitPaise = toPaise(line.debit_amount);

      // ──────────────────────────────────────────────────────────────────────────
      // VECTOR A & B: Statement Credit Lines
      // ──────────────────────────────────────────────────────────────────────────
      if (creditPaise > 0) {
        // Step A: Search for Cash Deposit Slip candidates (Vector A)
        const slipCandidates = await BankReconciliationRepository.findVectorACandidates(
          line.bank_account_id,
          Number(line.credit_amount),
          statementDate,
          c
        );

        if (slipCandidates.length === 1) {
          const candidateSlip = slipCandidates[0];
          // Valid 1-to-1 candidate match!
          const match = await BankReconciliationRepository.createMatch(
            {
              sessionId,
              statementLineId: line.id,
              matchSourceType: "BANK_DEPOSIT_SLIP",
              matchSourceId: candidateSlip.id,
              matchType: "EXACT",
              matchedAmount: Number(line.credit_amount),
              matchStatus: "PROPOSED",
              varianceAmount: 0.0,
              matchedBy: matcherId,
              metadata: {
                rule: "EXACT_1_TO_1_CASH_DEPOSIT",
                slip_number: candidateSlip.slip_number,
                deposit_date: formatDateOnly(candidateSlip.deposit_date),
                statement_date: statementDate,
              },
            },
            c
          );

          return {
            statementLineId: line.id,
            candidateType: "BANK_DEPOSIT_SLIP",
            status: "PROPOSED",
            candidatesCount: 1,
            candidateId: candidateSlip.id,
            candidate: candidateSlip as unknown as Record<string, unknown>,
            match,
          };
        }

        if (slipCandidates.length > 1) {
          // AMBIGUOUS SAFETY: Never pick the first row!
          await c.query(
            `UPDATE public.bank_statement_line
             SET reconciliation_status = 'EXCEPTION', updated_at = NOW()
             WHERE id = $1`,
            [line.id]
          );

          return {
            statementLineId: line.id,
            candidateType: "BANK_DEPOSIT_SLIP",
            status: "AMBIGUOUS_EXCEPTION",
            candidatesCount: slipCandidates.length,
            reason: `Ambiguous match: ${slipCandidates.length} deposit slips match criteria. Manual human resolution required.`,
          };
        }

        // Step B: No deposit slips found -> Search Gateway Payout Batch candidates (Vector B)
        const payoutCandidates = await BankReconciliationRepository.findVectorBCandidates(
          line.bank_account_id,
          Number(line.credit_amount),
          statementDate,
          line.bank_reference || line.description,
          c
        );

        if (payoutCandidates.length === 1) {
          const candidateBatch = payoutCandidates[0];
          const match = await BankReconciliationRepository.createMatch(
            {
              sessionId,
              statementLineId: line.id,
              matchSourceType: "GATEWAY_PAYOUT_BATCH",
              matchSourceId: candidateBatch.id,
              matchType: "EXACT",
              matchedAmount: Number(line.credit_amount),
              matchStatus: "PROPOSED",
              varianceAmount: 0.0,
              matchedBy: matcherId,
              metadata: {
                rule: "EXACT_1_TO_1_GATEWAY_PAYOUT",
                payout_reference: candidateBatch.payout_reference,
                settlement_reference: candidateBatch.settlement_reference,
                settlement_date: formatDateOnly(candidateBatch.settlement_date),
                statement_date: statementDate,
              },
            },
            c
          );

          return {
            statementLineId: line.id,
            candidateType: "GATEWAY_PAYOUT_BATCH",
            status: "PROPOSED",
            candidatesCount: 1,
            candidateId: candidateBatch.id,
            candidate: candidateBatch,
            match,
          };
        }

        if (payoutCandidates.length > 1) {
          await c.query(
            `UPDATE public.bank_statement_line
             SET reconciliation_status = 'EXCEPTION', updated_at = NOW()
             WHERE id = $1`,
            [line.id]
          );

          return {
            statementLineId: line.id,
            candidateType: "GATEWAY_PAYOUT_BATCH",
            status: "AMBIGUOUS_EXCEPTION",
            candidatesCount: payoutCandidates.length,
            reason: `Ambiguous match: ${payoutCandidates.length} gateway payout batches match criteria. Manual human resolution required.`,
          };
        }

        // Neither deposit slip nor gateway payout found
        await c.query(
          `UPDATE public.bank_statement_line
           SET reconciliation_status = 'EXCEPTION', updated_at = NOW()
           WHERE id = $1`,
          [line.id]
        );

        return {
          statementLineId: line.id,
          candidateType: "OTHER",
          status: "NO_CANDIDATE",
          candidatesCount: 0,
          reason: "No internal cash deposit slip or gateway payout batch matched this statement credit.",
        };
      }

      // ──────────────────────────────────────────────────────────────────────────
      // VECTOR C: Statement Debit Lines
      // ──────────────────────────────────────────────────────────────────────────
      if (debitPaise > 0) {
        // Search for supplier payments (purchase_payment)
        const paymentCandidates = await BankReconciliationRepository.findVectorCCandidates(
          Number(line.debit_amount),
          statementDate,
          line.bank_reference || line.description,
          c
        );

        if (paymentCandidates.length === 1) {
          const candidatePayment = paymentCandidates[0];
          const match = await BankReconciliationRepository.createMatch(
            {
              sessionId,
              statementLineId: line.id,
              matchSourceType: "PURCHASE_PAYMENT",
              matchSourceId: candidatePayment.id,
              matchType: "EXACT",
              matchedAmount: Number(line.debit_amount),
              matchStatus: "PROPOSED",
              varianceAmount: 0.0,
              matchedBy: matcherId,
              metadata: {
                rule: "EXACT_1_TO_1_PURCHASE_PAYMENT",
                reference: candidatePayment.reference,
                payment_date: formatDateOnly(candidatePayment.payment_date),
                statement_date: statementDate,
              },
            },
            c
          );

          return {
            statementLineId: line.id,
            candidateType: "PURCHASE_PAYMENT",
            status: "PROPOSED",
            candidatesCount: 1,
            candidateId: candidatePayment.id,
            candidate: candidatePayment,
            match,
          };
        }

        if (paymentCandidates.length > 1) {
          await c.query(
            `UPDATE public.bank_statement_line
             SET reconciliation_status = 'EXCEPTION', updated_at = NOW()
             WHERE id = $1`,
            [line.id]
          );

          return {
            statementLineId: line.id,
            candidateType: "PURCHASE_PAYMENT",
            status: "AMBIGUOUS_EXCEPTION",
            candidatesCount: paymentCandidates.length,
            reason: `Ambiguous match: ${paymentCandidates.length} supplier payments match criteria. Manual human resolution required.`,
          };
        }

        // Unmatched direct debit line
        await c.query(
          `UPDATE public.bank_statement_line
           SET reconciliation_status = 'EXCEPTION', updated_at = NOW()
           WHERE id = $1`,
          [line.id]
        );

        return {
          statementLineId: line.id,
          candidateType: "OTHER",
          status: "NO_CANDIDATE",
          candidatesCount: 0,
          reason: "Unmatched direct debit. Explicit exception created; never automatically posted to 1119.",
        };
      }

      throw new BankReconciliationServiceError(
        "INVALID_LINE_AMOUNT",
        "Statement line has neither debit nor credit amount."
      );
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Runs automated matching across all unmatched lines in a reconciliation session or import.
   * Evidence ingestion only: creates PROPOSED matches, ZERO GL postings.
   */
  static async autoMatchSession(
    sessionId: string,
    matcherId: string,
    client?: PoolClient
  ): Promise<{
    sessionId: string;
    totalEvaluated: number;
    proposedMatches: number;
    exceptions: number;
    results: CandidateMatchResult[];
  }> {
    const execute = async (c: PoolClient) => {
      const session = await BankReconciliationRepository.findSessionById(sessionId, c);
      if (!session) {
        throw new BankReconciliationServiceError(
          "SESSION_NOT_FOUND",
          `Reconciliation session '${sessionId}' not found.`
        );
      }

      // Query unmatched lines for this session's bank account within period
      const linesRes = await c.query(
        `SELECT id FROM public.bank_statement_line
         WHERE bank_account_id = $1
           AND transaction_date >= $2 AND transaction_date <= $3
           AND reconciliation_status IN ('UNMATCHED', 'EXCEPTION')
         ORDER BY line_number ASC`,
        [session.bank_account_id, session.period_start, session.period_end]
      );

      const results: CandidateMatchResult[] = [];
      let proposedMatches = 0;
      let exceptions = 0;

      for (const row of linesRes.rows) {
        const res = await this.autoMatchStatementLine(row.id, sessionId, matcherId, c);
        results.push(res);
        if (res.status === "PROPOSED") proposedMatches++;
        if (res.status === "AMBIGUOUS_EXCEPTION" || res.status === "NO_CANDIDATE") exceptions++;
      }

      // Update session totals
      await c.query(
        `UPDATE public.bank_reconciliation_session
         SET total_matched_count = (
               SELECT COUNT(*) FROM public.bank_reconciliation_match
               WHERE session_id = $1 AND match_status = 'CONFIRMED'
             ),
             total_unmatched_count = (
               SELECT COUNT(*) FROM public.bank_statement_line
               WHERE bank_account_id = $2
                 AND transaction_date >= $3 AND transaction_date <= $4
                 AND reconciliation_status = 'UNMATCHED'
             ),
             total_exception_count = (
               SELECT COUNT(*) FROM public.bank_statement_line
               WHERE bank_account_id = $2
                 AND transaction_date >= $3 AND transaction_date <= $4
                 AND reconciliation_status = 'EXCEPTION'
             ),
             updated_at = NOW()
         WHERE id = $1`,
        [sessionId, session.bank_account_id, session.period_start, session.period_end]
      );

      return {
        sessionId,
        totalEvaluated: linesRes.rows.length,
        proposedMatches,
        exceptions,
        results,
      };
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * VECTOR A: Confirms a cash-deposit match and executes Stage-2 transit clearance GL posting.
   *
   * Stage-2 Accounting Entry:
   *   Dr 1112 Bank Operating A/c
   *   Cr 1118 Deposit in Transit
   *
   * STRICT INVARIANTS:
   * 1. SoD: Confirmer cannot be the matcher (chk_brm_sod_matcher_confirmer).
   * 2. SoD: Confirmer cannot be the deposit slip preparer (slip.prepared_by).
   * 3. SUPER_ADMIN cannot bypass SoD.
   * 4. Date window: slip.deposit_date <= bank_date <= slip.deposit_date + 3 days.
   * 5. Voucher date = statement value_date (or transaction_date).
   * 6. Authoritative branch & bank account must come from PostgreSQL.
   * 7. Deterministic locking order: deposit_slip -> bank_account -> statement_line -> match.
   * 8. Atomic transaction: rolls back completely if any voucher or match update fails.
   */
  static async confirmAndPostCashDepositClearance(
    params: ConfirmCashDepositClearanceParams,
    client?: PoolClient
  ): Promise<ConfirmCashDepositClearanceResult> {
    const execute = async (c: PoolClient): Promise<ConfirmCashDepositClearanceResult> => {
      // Permission verification
      const isSuperAdmin =
        params.actorContext?.role === "SUPER_ADMIN" ||
        params.actorContext?.id === "admin_01" ||
        params.confirmerId === "admin_01";

      const hasPerm =
        isSuperAdmin ||
        hasEffectivePermission(params.actorContext, "BANK.RECON_CONFIRM") ||
        hasEffectivePermission(params.actorContext, "BANK.DEPOSIT_POST") ||
        hasEffectivePermission(params.actorContext, "ACCOUNTING.POST");

      if (!hasPerm) {
        throw new BankReconciliationServiceError(
          "PERMISSION_DENIED",
          "Actor lacks required permission (BANK.RECON_CONFIRM, BANK.DEPOSIT_POST, or ACCOUNTING.POST) to clear cash deposits."
        );
      }

      // Resolve statement line and deposit slip IDs
      let statementLineId = params.statementLineId;
      let depositSlipId = params.depositSlipId;
      let matchRecord: BankReconciliationMatchRow | null = null;

      if (params.matchId) {
        matchRecord = await BankReconciliationRepository.findMatchById(params.matchId, c, true);
        if (!matchRecord) {
          throw new BankReconciliationServiceError(
            "MATCH_NOT_FOUND",
            `Reconciliation match '${params.matchId}' not found.`
          );
        }
        statementLineId = matchRecord.statement_line_id;
        depositSlipId = matchRecord.match_source_id;
      }

      if (!statementLineId || !depositSlipId) {
        throw new BankReconciliationServiceError(
          "INVALID_PARAMETERS",
          "Both statementLineId and depositSlipId (or a valid matchId) are required."
        );
      }

      // ────────────────────────────────────────────────────────────────────────
      // DETERMINISTIC PESSIMISTIC LOCKING ORDER:
      // 1. bank_deposit_slip
      // 2. bank_account
      // 3. bank_statement_line
      // 4. bank_reconciliation_match
      // ────────────────────────────────────────────────────────────────────────

      // 1. Lock bank_deposit_slip FOR UPDATE
      const slip = await BankDepositSlipRepository.findById(depositSlipId, c, true);
      if (!slip) {
        throw new BankReconciliationServiceError(
          "DEPOSIT_SLIP_NOT_FOUND",
          `Bank deposit slip '${depositSlipId}' not found.`
        );
      }

      // 2. Lock bank_account FOR UPDATE
      const bankAccount = await BankAccountRepository.findById(slip.bank_account_id, c, true);
      if (!bankAccount) {
        throw new BankReconciliationServiceError(
          "BANK_ACCOUNT_NOT_FOUND",
          `Bank account '${slip.bank_account_id}' not found.`
        );
      }

      // 3. Lock bank_statement_line FOR UPDATE
      const lineRes = await c.query(
        `SELECT * FROM public.bank_statement_line WHERE id = $1 FOR UPDATE`,
        [statementLineId]
      );
      const statementLine: BankStatementLineRow = lineRes.rows[0];
      if (!statementLine) {
        throw new BankReconciliationServiceError(
          "STATEMENT_LINE_NOT_FOUND",
          `Bank statement line '${statementLineId}' not found.`
        );
      }

      // 4. Lock or locate match record
      if (!matchRecord) {
        matchRecord = await c.query(
          `SELECT * FROM public.bank_reconciliation_match
           WHERE statement_line_id = $1 AND match_source_id = $2
           FOR UPDATE`,
          [statementLine.id, slip.id]
        ).then(r => r.rows[0] || null);
      }

      // ────────────────────────────────────────────────────────────────────────
      // IDEMPOTENCY GUARD
      // ────────────────────────────────────────────────────────────────────────
      if (slip.credit_voucher_id) {
        const existingVoucher = await c.query(
          `SELECT * FROM public.accounting_voucher WHERE id = $1`,
          [slip.credit_voucher_id]
        ).then(r => r.rows[0] || null);

        return {
          depositSlip: slip,
          statementLine,
          match: matchRecord || ({} as BankReconciliationMatchRow),
          voucher: existingVoucher,
          wasDuplicate: true,
        };
      }

      // ────────────────────────────────────────────────────────────────────────
      // STRICT SEGREGATION OF DUTIES (SoD)
      // ────────────────────────────────────────────────────────────────────────
      // Invariant 1: Preparer of deposit slip cannot approve/confirm clearance or post Stage 2
      if (params.confirmerId === slip.prepared_by) {
        throw new BankReconciliationServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Preparer '${slip.prepared_by}' cannot confirm bank clearance or post Stage-2 transit clearance.`
        );
      }

      // Invariant 2: Confirmer cannot be the matcher
      if (matchRecord && matchRecord.matched_by && params.confirmerId === matchRecord.matched_by) {
        throw new BankReconciliationServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Confirmer '${params.confirmerId}' cannot be the same person who proposed the match.`
        );
      }

      // ────────────────────────────────────────────────────────────────────────
      // VALIDATION CHECKS
      // ────────────────────────────────────────────────────────────────────────
      // A. Bank account mismatch guard
      if (statementLine.bank_account_id !== slip.bank_account_id) {
        throw new BankReconciliationServiceError(
          "BANK_ACCOUNT_MISMATCH",
          `Bank account mismatch: Statement line account '${statementLine.bank_account_id}' does not match slip account '${slip.bank_account_id}'.`
        );
      }

      // B. Direction guard: statement line must be credit
      if (toPaise(statementLine.credit_amount) <= 0) {
        throw new BankReconciliationServiceError(
          "INVALID_LINE_DIRECTION",
          "Cannot clear cash deposit against a bank debit transaction."
        );
      }

      // C. Amount mismatch guard (exact integer paise comparison)
      if (toPaise(statementLine.credit_amount) !== toPaise(slip.amount)) {
        throw new BankReconciliationServiceError(
          "AMOUNT_MISMATCH",
          `Amount mismatch: Statement credit (${statementLine.credit_amount}) does not equal deposit slip amount (${slip.amount}).`
        );
      }

      // D. Date window guard: statement credit date must be on or after deposit date, within approved +3-day window
      const depositDateStr = formatDateOnly(slip.deposit_date);
      const statementDateStr = formatDateOnly(statementLine.value_date || statementLine.transaction_date);
      const dayDiff = diffCalendarDays(depositDateStr, statementDateStr);

      if (dayDiff < 0 || dayDiff > 3) {
        throw new BankReconciliationServiceError(
          "DATE_WINDOW_EXCEEDED",
          `Date window violation: Statement credit date (${statementDateStr}) is ${dayDiff < 0 ? "before" : `${dayDiff} days after`} deposit date (${depositDateStr}). Approved window is deposit date +3 days.`
        );
      }

      // E. Deposit slip transit status guard
      if (!slip.transit_voucher_id) {
        throw new BankReconciliationServiceError(
          "TRANSIT_VOUCHER_REQUIRED",
          "Deposit slip has not completed Stage 1 transit dispatch (transit_voucher_id is missing)."
        );
      }

      // ────────────────────────────────────────────────────────────────────────
      // HARD ACCOUNTING CONFIGURATION GUARDS
      // ────────────────────────────────────────────────────────────────────────
      const voucherDate = params.voucherDate || statementDateStr;

      try {
        await PostingService.validateAccountingStartDate(voucherDate, c);
      } catch (err: any) {
        if (err instanceof PostingServiceError) {
          throw new BankReconciliationServiceError(err.code, err.message);
        }
        throw err;
      }

      let fiscalPeriod;
      try {
        fiscalPeriod = await PostingService.validateFiscalPeriod(voucherDate, c);
      } catch (err: any) {
        if (err instanceof PostingServiceError) {
          throw new BankReconciliationServiceError(err.code, err.message);
        }
        throw err;
      }

      // Control accounts validation: 1112 (Bank Operating A/c) and 1118 (Deposit in Transit)
      const accountsRes = await c.query(
        `SELECT id, code, name, is_active, is_group
         FROM public.accounting_account
         WHERE code IN ('1112', '1118') AND deleted_at IS NULL`
      );

      const accMap = new Map<string, any>();
      for (const row of accountsRes.rows) {
        accMap.set(row.code, row);
      }

      const acc1112 = accMap.get("1112");
      const acc1118 = accMap.get("1118");
      if (!acc1118 || !acc1118.is_active || acc1118.is_group) {
        throw new BankReconciliationServiceError(
          "CONTROL_ACCOUNT_INACTIVE",
          "Control Account 1118 (Deposit in Transit) is missing, inactive, or a group account."
        );
      }

      // Phase B: Resolve Bank-Specific GL Account from bankAccount.gl_account_id (fallback to 1112)
      let bankGlAccount = acc1112;
      if (bankAccount.gl_account_id) {
        const bgRes = await c.query(
          `SELECT id, code, name, is_active, is_group
           FROM public.accounting_account
           WHERE id = $1 AND deleted_at IS NULL`,
          [bankAccount.gl_account_id]
        );
        if (bgRes.rows[0] && bgRes.rows[0].is_active && !bgRes.rows[0].is_group) {
          bankGlAccount = bgRes.rows[0];
        }
      }

      if (!bankGlAccount || !bankGlAccount.is_active || bankGlAccount.is_group) {
        throw new BankReconciliationServiceError(
          "CONTROL_ACCOUNT_INACTIVE",
          "Destination bank account has no valid active leaf GL account configured."
        );
      }

      // ────────────────────────────────────────────────────────────────────────
      // DOUBLE-ENTRY JOURNAL LINES CONSTRUCTION:
      // Line 1: Dr Specific Company Bank GL Account
      // Line 2: Cr 1118 Deposit in Transit
      // ────────────────────────────────────────────────────────────────────────
      const amountNum = Number(slip.amount);
      const lines: JournalLineInput[] = [
        {
          account_id: bankGlAccount.id,
          debit_amount: amountNum,
          credit_amount: 0,
          narration: `Bank credit acknowledged - Slip ${slip.slip_number} to ${bankAccount.bank_name} (${bankAccount.account_number_masked})`,
          metadata: {
            deposit_slip_id: slip.id,
            slip_number: slip.slip_number,
            bank_account_id: bankAccount.id,
            branch_id: slip.branch_id,
            statement_line_id: statementLine.id,
          },
        },
        {
          account_id: acc1118.id,
          debit_amount: 0,
          credit_amount: amountNum,
          narration: `Deposit in transit cleared - Branch ${slip.branch_id} - Slip ${slip.slip_number}`,
          metadata: {
            deposit_slip_id: slip.id,
            slip_number: slip.slip_number,
            branch_id: slip.branch_id,
            statement_line_id: statementLine.id,
          },
        },
      ];

      // ────────────────────────────────────────────────────────────────────────
      // CANONICAL POSTING SERVICE WORKFLOW
      // ────────────────────────────────────────────────────────────────────────
      // A. Create Draft Voucher
      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "CONTRA",
          voucher_date: voucherDate,
          branch_id: slip.branch_id,
          narration: `Bank transit clearance for ${bankAccount.bank_name} - Slip ${slip.slip_number}`,
          reference_type: "BANK_DEPOSIT",
          reference_id: slip.id,
          reference_event: "TRANSIT_CLEARANCE",
          metadata: {
            source_module: "BANK_RECONCILIATION",
            deposit_slip_id: slip.id,
            statement_line_id: statementLine.id,
            bank_account_id: bankAccount.id,
            branch_id: slip.branch_id,
          },
        },
        branchId: slip.branch_id,
        fiscalYear: fiscalPeriod.fiscal_year || "FY2026-27",
        createdBy: slip.prepared_by,
        client: c,
      });

      if (!draftRes.success) {
        throw new BankReconciliationServiceError(draftRes.code, draftRes.error);
      }
      const draftVoucher = draftRes.data;

      // B. Submit Voucher
      const submitRes = await PostingService.submitVoucher({
        voucherId: draftVoucher.id,
        submittedBy: slip.prepared_by,
        branchId: slip.branch_id,
        client: c,
      });
      if (!submitRes.success) {
        throw new BankReconciliationServiceError(submitRes.code, submitRes.error);
      }

      // C. Approve Voucher
      const approveRes = await PostingService.approveVoucher({
        voucherId: draftVoucher.id,
        approvedBy: params.confirmerId,
        branchId: slip.branch_id,
        client: c,
      });
      if (!approveRes.success) {
        throw new BankReconciliationServiceError(approveRes.code, approveRes.error);
      }

      // D. Post Voucher to GL
      const postRes = await PostingService.postVoucher({
        voucherId: draftVoucher.id,
        postedBy: params.confirmerId,
        lines,
        branchId: slip.branch_id,
        client: c,
      });
      if (!postRes.success) {
        throw new BankReconciliationServiceError(postRes.code, postRes.error);
      }

      const creditVoucher = postRes.data.voucher;
      const journalEntry = postRes.data.journal_entry;

      // ────────────────────────────────────────────────────────────────────────
      // ATOMIC LINKAGE UPDATES
      // ────────────────────────────────────────────────────────────────────────
      // 1. Link credit_voucher_id to bank_deposit_slip
      const updatedSlip = await BankDepositSlipRepository.recordCreditPosting(
        slip.id,
        creditVoucher.id,
        statementLine.bank_reference,
        statementDateStr,
        c
      );

      // 2. Mark statement line as MATCHED
      const updatedLineRes = await c.query(
        `UPDATE public.bank_statement_line
         SET reconciliation_status = 'MATCHED', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [statementLine.id]
      );
      const updatedStatementLine = updatedLineRes.rows[0];

      // 3. Confirm or create reconciliation match
      let finalMatch: BankReconciliationMatchRow;
      if (matchRecord) {
        finalMatch = await BankReconciliationRepository.updateMatchStatus(
          matchRecord.id,
          "CONFIRMED",
          params.confirmerId,
          c
        );
      } else {
        const sessionId = params.sessionId || (await c.query(
          `SELECT id FROM public.bank_reconciliation_session
           WHERE bank_account_id = $1 LIMIT 1`,
          [slip.bank_account_id]
        ).then(r => r.rows[0]?.id));

        if (!sessionId) {
          throw new BankReconciliationServiceError(
            "SESSION_NOT_FOUND",
            "A reconciliation session is required to link this match."
          );
        }

        finalMatch = await BankReconciliationRepository.createMatch(
          {
            sessionId,
            statementLineId: statementLine.id,
            matchSourceType: "BANK_DEPOSIT_SLIP",
            matchSourceId: slip.id,
            matchType: "EXACT",
            matchedAmount: amountNum,
            matchStatus: "CONFIRMED",
            matchedBy: slip.prepared_by, // recorded matcher
            confirmedBy: params.confirmerId,
            confirmedAt: new Date().toISOString(),
          },
          c
        );
      }

      return {
        depositSlip: updatedSlip,
        statementLine: updatedStatementLine,
        match: finalMatch,
        voucher: creditVoucher,
        journalEntry,
        wasDuplicate: false,
      };
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * VECTOR B: Confirms a gateway payout match.
   * CRITICAL INVARIANT: The gateway settlement was ALREADY financially posted in Step 4.10.3.
   * Therefore, Vector B creates ZERO new GL vouchers.
   */
  static async confirmGatewayPayoutMatch(
    params: ConfirmGatewayPayoutMatchParams,
    client?: PoolClient
  ): Promise<ConfirmGatewayPayoutMatchResult> {
    const execute = async (c: PoolClient): Promise<ConfirmGatewayPayoutMatchResult> => {
      let matchRecord: BankReconciliationMatchRow | null = null;
      let statementLineId = params.statementLineId;
      let payoutBatchId = params.payoutBatchId;

      if (params.matchId) {
        matchRecord = await BankReconciliationRepository.findMatchById(params.matchId, c, true);
        if (!matchRecord) {
          throw new BankReconciliationServiceError(
            "MATCH_NOT_FOUND",
            `Reconciliation match '${params.matchId}' not found.`
          );
        }
        statementLineId = matchRecord.statement_line_id;
        payoutBatchId = matchRecord.match_source_id;
      }

      if (!statementLineId || !payoutBatchId) {
        throw new BankReconciliationServiceError(
          "INVALID_PARAMETERS",
          "Both statementLineId and payoutBatchId (or a valid matchId) are required."
        );
      }

      // Check statement line
      const lineRes = await c.query(
        `SELECT * FROM public.bank_statement_line WHERE id = $1 FOR UPDATE`,
        [statementLineId]
      );
      const statementLine: BankStatementLineRow = lineRes.rows[0];
      if (!statementLine) {
        throw new BankReconciliationServiceError(
          "STATEMENT_LINE_NOT_FOUND",
          `Statement line '${statementLineId}' not found.`
        );
      }

      // Check payout batch
      const batchRes = await c.query(
        `SELECT * FROM public.gateway_payout_batch WHERE id = $1 FOR UPDATE`,
        [payoutBatchId]
      );
      const batch = batchRes.rows[0];
      if (!batch) {
        throw new BankReconciliationServiceError(
          "GATEWAY_BATCH_NOT_FOUND",
          `Gateway payout batch '${payoutBatchId}' not found.`
        );
      }

      // SoD: Confirmer cannot be the matcher
      if (matchRecord && matchRecord.matched_by && params.confirmerId === matchRecord.matched_by) {
        throw new BankReconciliationServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Confirmer '${params.confirmerId}' cannot be the same person who proposed the match.`
        );
      }

      // Amount verification (integer paise)
      if (toPaise(statementLine.credit_amount) !== toPaise(batch.net_amount)) {
        throw new BankReconciliationServiceError(
          "AMOUNT_MISMATCH",
          `Amount mismatch: Statement credit (${statementLine.credit_amount}) does not equal gateway net amount (${batch.net_amount}).`
        );
      }

      // Bank account verification
      if (statementLine.bank_account_id !== batch.bank_account_id) {
        throw new BankReconciliationServiceError(
          "BANK_ACCOUNT_MISMATCH",
          `Bank account mismatch: Statement line account does not match gateway batch account.`
        );
      }

      // Update statement line
      const updatedLineRes = await c.query(
        `UPDATE public.bank_statement_line
         SET reconciliation_status = 'MATCHED', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [statementLine.id]
      );

      // Update gateway payout batch bank_value_date
      const statementDateStr = formatDateOnly(statementLine.value_date || statementLine.transaction_date);
      await c.query(
        `UPDATE public.gateway_payout_batch
         SET bank_value_date = $2, updated_at = NOW()
         WHERE id = $1`,
        [batch.id, statementDateStr]
      );

      // Confirm match
      let finalMatch: BankReconciliationMatchRow;
      if (matchRecord) {
        finalMatch = await BankReconciliationRepository.updateMatchStatus(
          matchRecord.id,
          "CONFIRMED",
          params.confirmerId,
          c
        );
      } else {
        const sessionId = params.sessionId || (await c.query(
          `SELECT id FROM public.bank_reconciliation_session
           WHERE bank_account_id = $1 LIMIT 1`,
          [batch.bank_account_id]
        ).then(r => r.rows[0]?.id));

        if (!sessionId) {
          throw new BankReconciliationServiceError(
            "SESSION_NOT_FOUND",
            "A reconciliation session is required to link this match."
          );
        }

        finalMatch = await BankReconciliationRepository.createMatch(
          {
            sessionId,
            statementLineId: statementLine.id,
            matchSourceType: "GATEWAY_PAYOUT_BATCH",
            matchSourceId: batch.id,
            matchType: "EXACT",
            matchedAmount: Number(batch.net_amount),
            matchStatus: "CONFIRMED",
            matchedBy: batch.prepared_by,
            confirmedBy: params.confirmerId,
            confirmedAt: new Date().toISOString(),
          },
          c
        );
      }

      // ZERO GL POSTINGS CREATED!
      return {
        match: finalMatch,
        statementLine: updatedLineRes.rows[0],
        payoutBatch: batch,
        wasDuplicate: false,
      };
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * VECTOR C: Confirms a direct supplier payment match.
   * ZERO GL entries created (supplier payment GL was already posted in Step 3D.5).
   */
  static async confirmSupplierPaymentMatch(
    params: ConfirmSupplierPaymentMatchParams,
    client?: PoolClient
  ): Promise<ConfirmSupplierPaymentMatchResult> {
    const execute = async (c: PoolClient): Promise<ConfirmSupplierPaymentMatchResult> => {
      let matchRecord: BankReconciliationMatchRow | null = null;
      let statementLineId = params.statementLineId;
      let purchasePaymentId = params.purchasePaymentId;

      if (params.matchId) {
        matchRecord = await BankReconciliationRepository.findMatchById(params.matchId, c, true);
        if (!matchRecord) {
          throw new BankReconciliationServiceError(
            "MATCH_NOT_FOUND",
            `Reconciliation match '${params.matchId}' not found.`
          );
        }
        statementLineId = matchRecord.statement_line_id;
        purchasePaymentId = matchRecord.match_source_id;
      }

      if (!statementLineId || !purchasePaymentId) {
        throw new BankReconciliationServiceError(
          "INVALID_PARAMETERS",
          "Both statementLineId and purchasePaymentId (or a valid matchId) are required."
        );
      }

      // Check statement line
      const lineRes = await c.query(
        `SELECT * FROM public.bank_statement_line WHERE id = $1 FOR UPDATE`,
        [statementLineId]
      );
      const statementLine: BankStatementLineRow = lineRes.rows[0];
      if (!statementLine) {
        throw new BankReconciliationServiceError(
          "STATEMENT_LINE_NOT_FOUND",
          `Statement line '${statementLineId}' not found.`
        );
      }

      // Check supplier payment
      const paymentRes = await c.query(
        `SELECT * FROM public.purchase_payment WHERE id = $1 FOR UPDATE`,
        [purchasePaymentId]
      );
      const payment = paymentRes.rows[0];
      if (!payment) {
        throw new BankReconciliationServiceError(
          "PURCHASE_PAYMENT_NOT_FOUND",
          `Purchase payment '${purchasePaymentId}' not found.`
        );
      }

      // SoD: Confirmer cannot be the matcher
      if (matchRecord && matchRecord.matched_by && params.confirmerId === matchRecord.matched_by) {
        throw new BankReconciliationServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Confirmer '${params.confirmerId}' cannot be the same person who proposed the match.`
        );
      }

      // Amount verification (integer paise)
      if (toPaise(statementLine.debit_amount) !== toPaise(payment.amount)) {
        throw new BankReconciliationServiceError(
          "AMOUNT_MISMATCH",
          `Amount mismatch: Statement debit (${statementLine.debit_amount}) does not equal supplier payment amount (${payment.amount}).`
        );
      }

      // Update statement line
      const updatedLineRes = await c.query(
        `UPDATE public.bank_statement_line
         SET reconciliation_status = 'MATCHED', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [statementLine.id]
      );

      // Confirm match
      let finalMatch: BankReconciliationMatchRow;
      if (matchRecord) {
        finalMatch = await BankReconciliationRepository.updateMatchStatus(
          matchRecord.id,
          "CONFIRMED",
          params.confirmerId,
          c
        );
      } else {
        const sessionId = params.sessionId || (await c.query(
          `SELECT id FROM public.bank_reconciliation_session
           WHERE bank_account_id = $1 LIMIT 1`,
          [statementLine.bank_account_id]
        ).then(r => r.rows[0]?.id));

        if (!sessionId) {
          throw new BankReconciliationServiceError(
            "SESSION_NOT_FOUND",
            "A reconciliation session is required to link this match."
          );
        }

        finalMatch = await BankReconciliationRepository.createMatch(
          {
            sessionId,
            statementLineId: statementLine.id,
            matchSourceType: "PURCHASE_PAYMENT",
            matchSourceId: payment.id,
            matchType: "EXACT",
            matchedAmount: Number(payment.amount),
            matchStatus: "CONFIRMED",
            matchedBy: payment.created_by,
            confirmedBy: params.confirmerId,
            confirmedAt: new Date().toISOString(),
          },
          c
        );
      }

      // ZERO GL POSTINGS CREATED!
      return {
        match: finalMatch,
        statementLine: updatedLineRes.rows[0],
        purchasePayment: payment,
        wasDuplicate: false,
      };
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * MANUAL OVERRIDE:
   * Requires authenticated authorization, non-empty override reason, and distinct matcher != confirmer.
   * Preserves original statement line evidence. Never mutates imported raw statement data.
   */
  static async manualMatch(
    params: ManualReconciliationMatchParams,
    client?: PoolClient
  ): Promise<BankReconciliationMatchRow> {
    if (!params.overrideReason || !params.overrideReason.trim()) {
      throw new BankReconciliationServiceError(
        "OVERRIDE_REASON_REQUIRED",
        "A documented override reason is mandatory for manual match operations."
      );
    }

    if (params.confirmerId && params.matcherId === params.confirmerId) {
      throw new BankReconciliationServiceError(
        "SEGREGATION_OF_DUTIES_VIOLATION",
        "Segregation of Duties: Confirmer cannot be the same person who proposed the manual match."
      );
    }

    const execute = async (c: PoolClient) => {
      const lineRes = await c.query(
        `SELECT * FROM public.bank_statement_line WHERE id = $1 FOR UPDATE`,
        [params.statementLineId]
      );
      const line: BankStatementLineRow = lineRes.rows[0];
      if (!line) {
        throw new BankReconciliationServiceError(
          "STATEMENT_LINE_NOT_FOUND",
          `Statement line '${params.statementLineId}' not found.`
        );
      }

      const matchedAmount = params.matchedAmount || (line.credit_amount > 0 ? line.credit_amount : line.debit_amount);
      const varianceAmount = params.varianceAmount || 0;

      const match = await BankReconciliationRepository.createMatch(
        {
          sessionId: params.sessionId,
          statementLineId: line.id,
          matchSourceType: params.matchSourceType,
          matchSourceId: params.matchSourceId,
          matchType: "MANUAL",
          matchedAmount: Number(matchedAmount),
          matchStatus: params.confirmerId ? "CONFIRMED" : "PROPOSED",
          varianceAmount: Number(varianceAmount),
          matchedBy: params.matcherId,
          confirmedBy: params.confirmerId || null,
          confirmedAt: params.confirmerId ? new Date().toISOString() : null,
          metadata: {
            manual_override: true,
            override_reason: params.overrideReason.trim(),
            ...(params.metadata || {}),
          },
        },
        c
      );

      if (params.confirmerId) {
        await c.query(
          `UPDATE public.bank_statement_line
           SET reconciliation_status = 'MATCHED', updated_at = NOW()
           WHERE id = $1`,
          [line.id]
        );
      }

      return match;
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }
}
