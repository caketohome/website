/**
 * CakeToHome ERP — Teller Session Domain Service
 * Phase C3: Teller & Session Domain Services + Repositories
 *
 * Implements the locked session lifecycle:
 * OPEN -> CLOSING -> PENDING_VERIFICATION -> SETTLED (or CANCELLED)
 *
 * Invariants:
 * 1. Single active session per teller.
 * 2. Authoritative expected_cash calculated strictly from movement ledger.
 * 3. 3-tier Segregation of Duties (opener != verifier, closer != verifier, verifier != settler).
 * 4. Deterministic row locks (SELECT ... FOR UPDATE) preventing concurrency races.
 * 5. Settlement preparation boundary verifies all prerequisites without posting vouchers in C3.
 */

import { dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { TellerRepository } from "../repositories/teller.repository";
import { TellerSessionRepository } from "../repositories/teller-session.repository";
import { TellerMovementRepository } from "../repositories/teller-movement.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { AccountingFiscalPeriodRepository } from "../repositories/accounting-fiscal-period.repository";
import { PostingService } from "./posting.service";
import { TellerService } from "./teller.service";
import { hasEffectivePermission } from "../staff-access-control";
import type { JournalLineInput } from "../types/accounting.types";
import {
  TellerSessionRow,
  TellerSessionStatus,
  OpenSessionParams,
  CloseSessionParams,
  VerifySessionParams,
  PrepareSettlementParams,
  SettlementPreparationResult,
  SettleSessionParams,
  SessionSettlementResult,
  AuthenticatedActor,
  TellerDomainError,
} from "../types/teller.types";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class TellerSessionService {
  /**
   * Validates actor authorization for branch operations.
   */
  private static validateBranchAccess(actor: AuthenticatedActor, branchId: string): void {
    if (actor.role === "SUPER_ADMIN") return;
    if (actor.branchId && actor.branchId !== branchId) {
      throw new TellerDomainError(
        "UNAUTHORIZED_BRANCH",
        `Actor does not have access to branch '${branchId}'. Authorized branch is '${actor.branchId}'.`
      );
    }
  }


  /**
   * Opens a new teller session.
   * Requires: TELLER.SESSION_OPEN.
   */
  static async openSession(
    params: OpenSessionParams,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    if (!hasEffectivePermission(actor, "TELLER.SESSION_OPEN")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.SESSION_OPEN permission."
      );
    }

    const openingFloat = round2(params.opening_float);
    if (openingFloat < 0) {
      throw new TellerDomainError(
        "INVALID_AMOUNT",
        `Opening float cannot be negative. Got ${openingFloat}.`
      );
    }

    const execute = async (txClient: PoolClient) => {
      // 1. Resolve Active Teller for branch/user
      let teller: any = null;
      if (params.teller_id) {
        teller = await TellerRepository.findById(params.teller_id, txClient, true);
      }

      const targetBranchId = params.branch_id || (teller ? teller.branch_id : actor.branchId);

      if (!teller && targetBranchId) {
        teller = await TellerService.ensureDefaultBranchTeller(targetBranchId, actor, txClient);
      }

      if (!teller) {
        teller = await TellerRepository.findActiveByUserId(actor.userId, txClient, true);
      }

      if (!teller) {
        throw new TellerDomainError(
          "TELLER_NOT_FOUND",
          params.teller_id
            ? `Teller '${params.teller_id}' not found.`
            : `No teller counter station found or configured for branch '${targetBranchId || "UNKNOWN"}'.`
        );
      }

      if (teller.status !== "ACTIVE") {
        throw new TellerDomainError(
          "TELLER_INACTIVE",
          `Teller '${teller.code}' is INACTIVE. Activate it before opening a session.`
        );
      }

      // 2. Validate Branch
      const effectiveBranchId = targetBranchId || teller.branch_id;
      if (effectiveBranchId !== teller.branch_id) {
        throw new TellerDomainError(
          "UNAUTHORIZED_BRANCH",
          `Branch mismatch: Teller '${teller.code}' belongs to branch '${teller.branch_id}', not '${effectiveBranchId}'.`
        );
      }
      this.validateBranchAccess(actor, effectiveBranchId);

      // 3. Check for existing active session on this teller or branch
      const existingSession = await TellerSessionRepository.findActiveByTellerId(
        teller.id,
        txClient,
        true
      );
      if (existingSession) {
        throw new TellerDomainError(
          "ACTIVE_SESSION_EXISTS",
          `Teller '${teller.code}' already has an active session '${existingSession.id}' in ${existingSession.status} state.`
        );
      }


      // 5. Create Session (expected_cash initially = opening_float)
      return TellerSessionRepository.create(
        {
          teller_id: teller.id,
          branch_id: effectiveBranchId,
          opening_float: openingFloat,
          expected_cash: openingFloat,
          opened_by: actor.userId,
          notes: params.notes,
        },
        txClient
      );
    };

    if (client) {
      return execute(client);
    }
    return dbTransaction(execute);
  }

  /**
   * Calculates expected cash for a session from the authoritative movement ledger.
   * Formula: opening_float + sum(IN movements) - sum(OUT movements).
   */
  static async calculateExpectedCash(
    sessionId: string,
    client?: PoolClient
  ): Promise<number> {
    const session = await TellerSessionRepository.findById(sessionId, client);
    if (!session) {
      throw new TellerDomainError("SESSION_NOT_FOUND", `Session '${sessionId}' not found.`);
    }

    const totals = await TellerMovementRepository.getTotalsForSession(sessionId, client);
    const expected = round2(session.opening_float + totals.netMovement);
    return expected;
  }

  /**
   * Closes a teller session and records the physical cash count.
   * Transitions: OPEN -> CLOSING.
   * Requires: TELLER.SESSION_CLOSE.
   */
  static async closeSession(
    params: CloseSessionParams,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    if (!hasEffectivePermission(actor, "TELLER.SESSION_CLOSE")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.SESSION_CLOSE permission."
      );
    }

    const closingCount = round2(params.closing_count);
    if (closingCount < 0) {
      throw new TellerDomainError(
        "INVALID_AMOUNT",
        `Physical closing count cannot be negative. Got ${closingCount}.`
      );
    }

    const execute = async (txClient: PoolClient) => {
      // 1. Pessimistic lock on session row
      const session = await TellerSessionRepository.findById(params.session_id, txClient, true);
      if (!session) {
        throw new TellerDomainError("SESSION_NOT_FOUND", `Session '${params.session_id}' not found.`);
      }
      this.validateBranchAccess(actor, session.branch_id);

      // 2. Validate current state
      if (session.status === "SETTLED") {
        throw new TellerDomainError(
          "SESSION_ALREADY_SETTLED",
          `Session '${session.id}' is already SETTLED and cannot be closed.`
        );
      }
      if (session.status === "CANCELLED") {
        throw new TellerDomainError(
          "SESSION_ALREADY_CANCELLED",
          `Session '${session.id}' is CANCELLED and cannot be closed.`
        );
      }
      if (session.status !== "OPEN") {
        throw new TellerDomainError(
          "CONCURRENT_STATE_TRANSITION",
          `Session '${session.id}' is currently ${session.status} (expected OPEN). Double close rejected.`
        );
      }

      // 3. Authoritative expected cash calculation from movement ledger
      const totals = await TellerMovementRepository.getTotalsForSession(session.id, txClient);
      const expectedCash = round2(session.opening_float + totals.netMovement);
      if (expectedCash < 0) {
        throw new TellerDomainError(
          "INVALID_EXPECTED_CASH",
          `Expected cash calculation resulted in invalid negative balance (₹${expectedCash.toFixed(2)}). Session closing rejected. Inspect unvouched movements.`
        );
      }
      const variance = round2(closingCount - expectedCash);


      // 5. Persist close details
      return TellerSessionRepository.closeSession(
        session.id,
        {
          expected_cash: expectedCash,
          closing_count: closingCount,
          variance: variance,
          closed_by: actor.userId,
          notes: params.notes,
        },
        txClient
      );
    };

    if (client) {
      return execute(client);
    }
    return dbTransaction(execute);
  }

  /**
   * Supervisor verification of physical closing cash count.
   * Transitions: CLOSING -> PENDING_VERIFICATION.
   * Requires: TELLER.SESSION_VERIFY.
   * Enforces SoD: verified_by != opened_by AND verified_by != closed_by.
   */
  static async verifySession(
    params: VerifySessionParams,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    if (!hasEffectivePermission(actor, "TELLER.SESSION_VERIFY")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.SESSION_VERIFY permission."
      );
    }

    const execute = async (txClient: PoolClient) => {
      // 1. Lock session row
      const session = await TellerSessionRepository.findById(params.session_id, txClient, true);
      if (!session) {
        throw new TellerDomainError("SESSION_NOT_FOUND", `Session '${params.session_id}' not found.`);
      }
      this.validateBranchAccess(actor, session.branch_id);

      if (session.status === "SETTLED") {
        throw new TellerDomainError(
          "SESSION_ALREADY_SETTLED",
          `Session '${session.id}' is already SETTLED.`
        );
      }
      if (session.status === "CANCELLED") {
        throw new TellerDomainError(
          "SESSION_ALREADY_CANCELLED",
          `Session '${session.id}' is CANCELLED.`
        );
      }
      if (session.status !== "CLOSING" && session.status !== "PENDING_VERIFICATION") {
        throw new TellerDomainError(
          "INVALID_SESSION_STATE",
          `Session '${session.id}' is in ${session.status} state. Only CLOSING sessions can be verified.`
        );
      }
      if (session.closing_count === null) {
        throw new TellerDomainError(
          "INVALID_SESSION_STATE",
          `Session '${session.id}' has no closing count recorded. Close the session first.`
        );
      }

      // 2. Strict SoD: Verifier cannot be Opener or Closer
      if (actor.userId === session.opened_by) {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          `Segregation of Duties violation: session opener '${session.opened_by}' cannot verify cash count.`
        );
      }
      if (session.closed_by && actor.userId === session.closed_by) {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          `Segregation of Duties violation: session closer '${session.closed_by}' cannot verify cash count.`
        );
      }

      // 3. Recalculate expected cash from ledger to detect concurrent movements or tampering
      const totals = await TellerMovementRepository.getTotalsForSession(session.id, txClient);
      const recalculatedExpected = round2(session.opening_float + totals.netMovement);
      if (recalculatedExpected < 0) {
        throw new TellerDomainError(
          "INVALID_EXPECTED_CASH",
          `Recalculated expected cash resulted in invalid negative balance (₹${recalculatedExpected.toFixed(2)}). Session verification rejected. Inspect unvouched movements.`
        );
      }
      const recalculatedVariance = round2(session.closing_count - recalculatedExpected);


      // 5. Persist verification
      return TellerSessionRepository.verifySession(
        session.id,
        {
          expected_cash: recalculatedExpected,
          closing_count: session.closing_count,
          variance: recalculatedVariance,
          verified_by: actor.userId,
          notes: params.notes,
        },
        txClient
      );
    };

    if (client) {
      return execute(client);
    }
    return dbTransaction(execute);
  }

  /**
   * Prepares and validates settlement prerequisites (Section 14).
   * Validates all financial, SoD, and mathematical invariants without posting GL.
   * Requires: TELLER.SETTLE.
   */
  static async prepareSettlement(
    params: PrepareSettlementParams,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<SettlementPreparationResult> {
    if (!hasEffectivePermission(actor, "TELLER.SETTLE")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.SETTLE permission."
      );
    }

    const execute = async (txClient: PoolClient): Promise<SettlementPreparationResult> => {
      const session = await TellerSessionRepository.findById(params.session_id, txClient, true);
      if (!session) {
        throw new TellerDomainError("SESSION_NOT_FOUND", `Session '${params.session_id}' not found.`);
      }
      this.validateBranchAccess(actor, session.branch_id);

      if (session.status === "SETTLED") {
        throw new TellerDomainError(
          "SESSION_ALREADY_SETTLED",
          `Session '${session.id}' is already SETTLED.`
        );
      }
      if (session.status !== "PENDING_VERIFICATION") {
        throw new TellerDomainError(
          "SESSION_NOT_VERIFIED",
          `Session '${session.id}' is in ${session.status} status. It must be PENDING_VERIFICATION before settlement.`
        );
      }
      if (session.closing_count === null || session.variance === null) {
        throw new TellerDomainError(
          "INVALID_SESSION_STATE",
          `Session '${session.id}' is missing closing count or variance.`
        );
      }
      if (!session.verified_by) {
        throw new TellerDomainError(
          "SESSION_NOT_VERIFIED",
          `Session '${session.id}' has not been verified by a supervisor.`
        );
      }

      // SoD: Settler cannot be Opener, Closer, or Verifier
      if (actor.userId === session.opened_by) {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          `Segregation of Duties violation: session opener '${session.opened_by}' cannot settle the session.`
        );
      }
      if (session.closed_by && actor.userId === session.closed_by) {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          `Segregation of Duties violation: session closer '${session.closed_by}' cannot settle the session.`
        );
      }
      if (session.verified_by && actor.userId === session.verified_by) {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          `Segregation of Duties violation: count verifier '${session.verified_by}' cannot settle the session.`
        );
      }

      // Recalculate ledger totals
      const totals = await TellerMovementRepository.getTotalsForSession(session.id, txClient);
      const recalculatedExpected = round2(session.opening_float + totals.netMovement);
      const recalculatedVariance = round2(session.closing_count - recalculatedExpected);

      if (recalculatedVariance !== session.variance) {
        throw new TellerDomainError(
          "INVALID_AMOUNT",
          `Variance mismatch: persisted variance (${session.variance}) != recalculated variance (${recalculatedVariance}).`
        );
      }

      // Determine GL adjustment requirement
      let settlementEntry: SettlementPreparationResult["settlement_entry"] = null;
      let voucherRequired = false;

      if (recalculatedVariance !== 0) {
        voucherRequired = true;
        if (recalculatedVariance < 0) {
          // Shortage: Dr 5296 / Cr 1111
          settlementEntry = {
            debit_account_code: "5296",
            debit_account_name: "Cash Over / Short",
            credit_account_code: "1111",
            credit_account_name: "Cash in Hand",
            amount: Math.abs(recalculatedVariance),
          };
        } else {
          // Excess: Dr 1111 / Cr 5296
          settlementEntry = {
            debit_account_code: "1111",
            debit_account_name: "Cash in Hand",
            credit_account_code: "5296",
            credit_account_name: "Cash Over / Short",
            amount: recalculatedVariance,
          };
        }
      }

      return {
        session_id: session.id,
        branch_id: session.branch_id,
        teller_id: session.teller_id,
        status: session.status,
        opening_float: session.opening_float,
        total_in: totals.totalIn,
        total_out: totals.totalOut,
        expected_cash: recalculatedExpected,
        closing_count: session.closing_count,
        variance: recalculatedVariance,
        voucher_required: voucherRequired,
        settlement_entry: settlementEntry,
        sod_audit: {
          opened_by: session.opened_by,
          closed_by: session.closed_by,
          verified_by: session.verified_by,
          settler_user_id: actor.userId,
        },
      };
    };

    if (client) {
      return execute(client);
    }
    return dbTransaction(execute);
  }

  /**
   * Settles a verified teller session and orchestrates General Ledger posting.
   * Atomic Transaction:
   * 1. Locks session row exclusively (SELECT ... FOR UPDATE).
   * 2. Checks idempotency: if already SETTLED, returns { session, wasAlreadySettled: true }.
   * 3. Validates status is PENDING_VERIFICATION and verifies 3-tier SoD.
   * 4. Zero-Variance:
   *    - Transitions session to SETTLED with settlement_voucher_id = NULL.
   *    - Zero voucher or journal rows created.
   * 5. Non-Zero Variance:
   *    - Resolves active accounts 1111 and 5296 via AccountingAccountRepository.
   *    - Validates accounting start date & fiscal period via PostingService.
   *    - Creates Draft Voucher (reference_type: "TELLER_SESSION", reference_id: session.id, reference_event: "SETTLEMENT_VARIANCE").
   *    - Submits voucher.
   *    - Approves voucher (approvedBy: actor.userId, createdBy: session.verified_by).
   *    - Posts voucher to General Ledger with balanced lines preserving branch dimension.
   *    - Transitions session to SETTLED with settlement_voucher_id = postedVoucher.id.
   * 6. Fails closed on any error, triggering automatic transaction rollback.
   */
  static async settleSession(
    params: SettleSessionParams,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<SessionSettlementResult> {
    if (!hasEffectivePermission(actor, "TELLER.SETTLE")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.SETTLE permission."
      );
    }

    const execute = async (txClient: PoolClient): Promise<SessionSettlementResult> => {
      // 1. Pessimistic lock on session row
      const targetSessionId = (params.session_id || params.sessionId)!;
      const session = await TellerSessionRepository.findById(targetSessionId, txClient, true);
      if (!session) {
        throw new TellerDomainError("SESSION_NOT_FOUND", `Session '${targetSessionId}' not found.`);
      }
      this.validateBranchAccess(actor, session.branch_id);

      // 2. Idempotency Check: Already Settled
      if (session.status === "SETTLED") {
        return {
          session,
          wasAlreadySettled: true,
          settlement_voucher_id: session.settlement_voucher_id,
        };
      }

      // 3. Status Check: Must be PENDING_VERIFICATION
      if (session.status === "CANCELLED") {
        throw new TellerDomainError("SESSION_ALREADY_CANCELLED", `Session '${session.id}' is CANCELLED.`);
      }
      if (session.status !== "PENDING_VERIFICATION") {
        throw new TellerDomainError(
          "SESSION_NOT_VERIFIED",
          `Session '${session.id}' is in ${session.status} status. It must be PENDING_VERIFICATION before settlement.`
        );
      }

      // Precondition validations
      if (session.closing_count === null || session.expected_cash === null || session.variance === null) {
        throw new TellerDomainError(
          "INVALID_SESSION_STATE",
          `Session '${session.id}' is missing closing count, expected cash, or variance.`
        );
      }
      if (Number(session.expected_cash) < 0) {
        throw new TellerDomainError(
          "INVALID_EXPECTED_CASH",
          `Session '${session.id}' has impossible negative expected cash (₹${Number(session.expected_cash).toFixed(2)}). Settlement halted. Inspect unvouched movements.`
        );
      }
      if (!session.verified_by || !session.verified_at) {
        throw new TellerDomainError(
          "SESSION_NOT_VERIFIED",
          `Session '${session.id}' has not been verified by a supervisor.`
        );
      }

      // 4. 3-Tier Segregation of Duties (SoD)
      if (actor.userId === session.opened_by) {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          `Segregation of Duties violation: session opener '${session.opened_by}' cannot settle the session.`
        );
      }
      if (session.closed_by && actor.userId === session.closed_by) {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          `Segregation of Duties violation: session closer '${session.closed_by}' cannot settle the session.`
        );
      }
      if (session.verified_by && actor.userId === session.verified_by) {
        throw new TellerDomainError(
          "SOD_VIOLATION",
          `Segregation of Duties violation: count verifier '${session.verified_by}' cannot settle the session.`
        );
      }

      const variance = round2(session.variance);

      // 5. Zero-Variance Settlement (variance === 0.00)
      if (variance === 0) {
        const settledSession = await TellerSessionRepository.settleSession(
          session.id,
          {
            settled_by: actor.userId,
            settlement_voucher_id: null,
            notes: params.notes,
          },
          txClient
        );

        return {
          session: settledSession,
          wasAlreadySettled: false,
          settlement_voucher_id: null,
          voucher: null,
          journal_entry: null,
        };
      }

      // 6. Non-Zero Variance Settlement (Shortage or Excess)
      const absVariance = round2(Math.abs(variance));

      // Resolve accounting accounts 1111 and 5296
      const acc1111 = await AccountingAccountRepository.findByCode("1111", txClient);
      if (!acc1111 || !acc1111.is_active || acc1111.is_group) {
        throw new TellerDomainError(
          "SETTLEMENT_POSTING_FAILED",
          "Account 1111 (Cash in Hand) is missing, inactive, or a group account."
        );
      }

      const acc5296 = await AccountingAccountRepository.findByCode("5296", txClient);
      if (!acc5296 || !acc5296.is_active || acc5296.is_group) {
        throw new TellerDomainError(
          "SETTLEMENT_POSTING_FAILED",
          "Account 5296 (Cash Over / Short) is missing, inactive, or a group account."
        );
      }

      const settlementDate = params.settlement_date || params.settlementDate || new Date().toISOString().split("T")[0];

      // Validate Accounting Start Date and Fiscal Period (Hard Blocks via PostingService)
      await PostingService.validateAccountingStartDate(settlementDate, txClient);
      await PostingService.validateFiscalPeriod(settlementDate, txClient);

      // Resolve Fiscal Year
      const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(settlementDate, txClient);
      const fiscalYear = periodStatus.status === "PERIOD_OPEN" ? periodStatus.period.fiscal_year : "FY2026-27";

      // Build balanced journal lines preserving the branch dimension
      const lines: JournalLineInput[] = variance < 0
        ? [
            {
              account_id: acc5296.id,
              debit_amount: absVariance,
              credit_amount: 0,
              branch_id: session.branch_id,
              narration: `Cash shortage on settlement of teller session ${session.id}`,
            },
            {
              account_id: acc1111.id,
              debit_amount: 0,
              credit_amount: absVariance,
              branch_id: session.branch_id,
              narration: `Cash shortage deduction from physical drawer for session ${session.id}`,
            },
          ]
        : [
            {
              account_id: acc1111.id,
              debit_amount: absVariance,
              credit_amount: 0,
              branch_id: session.branch_id,
              narration: `Cash excess recorded on settlement of teller session ${session.id}`,
            },
            {
              account_id: acc5296.id,
              debit_amount: 0,
              credit_amount: absVariance,
              branch_id: session.branch_id,
              narration: `Cash excess credit on settlement of teller session ${session.id}`,
            },
          ];

      // 6a. Create Voucher Draft (Source Identity: TELLER_SESSION:session.id:SETTLEMENT_VARIANCE)
      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "JOURNAL",
          voucher_date: settlementDate,
          branch_id: session.branch_id,
          narration: `Teller session cash variance settlement for Session ${session.id} (${variance < 0 ? "Shortage" : "Excess"}: ${absVariance})`,
          reference_type: "TELLER_SESSION",
          reference_id: session.id,
          reference_event: "SETTLEMENT_VARIANCE",
          metadata: {
            source_module: "TELLER",
            teller_session_id: session.id,
            teller_id: session.teller_id,
            branch_id: session.branch_id,
            variance: session.variance,
            closing_count: session.closing_count,
            expected_cash: session.expected_cash,
            settled_by: actor.userId,
            verified_by: session.verified_by,
            opened_by: session.opened_by,
          },
        },
        branchId: session.branch_id,
        fiscalYear,
        createdBy: session.verified_by, // Certified by the verifier who established the count
        client: txClient,
      });

      if (!draftRes.success) {
        throw new TellerDomainError(
          "SETTLEMENT_POSTING_FAILED",
          `Failed to create settlement voucher draft: ${draftRes.error}`
        );
      }
      const draftVoucher = draftRes.data;

      // 6b. Submit Voucher
      const submitRes = await PostingService.submitVoucher({
        voucherId: draftVoucher.id,
        submittedBy: session.verified_by,
        branchId: session.branch_id,
        client: txClient,
      });
      if (!submitRes.success) {
        throw new TellerDomainError(
          "SETTLEMENT_POSTING_FAILED",
          `Failed to submit settlement voucher: ${submitRes.error}`
        );
      }

      // 6c. Approve Voucher (by settlement actor; satisfies approvedBy != createdBy)
      const approveRes = await PostingService.approveVoucher({
        voucherId: draftVoucher.id,
        approvedBy: actor.userId,
        branchId: session.branch_id,
        client: txClient,
      });
      if (!approveRes.success) {
        throw new TellerDomainError(
          "SETTLEMENT_POSTING_FAILED",
          `Failed to approve settlement voucher: ${approveRes.error}`
        );
      }

      // 6d. Post Voucher to General Ledger
      const postRes = await PostingService.postVoucher({
        voucherId: draftVoucher.id,
        postedBy: actor.userId,
        lines,
        branchId: session.branch_id,
        client: txClient,
      });
      if (!postRes.success) {
        throw new TellerDomainError(
          "SETTLEMENT_POSTING_FAILED",
          `Failed to post settlement voucher: ${postRes.error}`
        );
      }

      // 6e. Update Session Status to SETTLED with settlement_voucher_id
      const settledSession = await TellerSessionRepository.settleSession(
        session.id,
        {
          settled_by: actor.userId,
          settlement_voucher_id: postRes.data.voucher.id,
          notes: params.notes,
        },
        txClient
      );

      return {
        session: settledSession,
        wasAlreadySettled: false,
        settlement_voucher_id: postRes.data.voucher.id,
        voucher: postRes.data.voucher,
        journal_entry: postRes.data.journal_entry,
      };
    };

    if (client) {
      if ((client as any)._txStatus !== "T") {
        try {
          await client.query("BEGIN");
          const res = await execute(client);
          await client.query("COMMIT");
          return res;
        } catch (err) {
          try { await client.query("ROLLBACK"); } catch (_) {}
          throw err;
        }
      }
      return execute(client);
    }
    return dbTransaction(execute);
  }

  /**
   * Retrieves a teller session by ID with branch scoping and permission check.
   * Requires: TELLER.VIEW.
   */
  static async getSession(
    sessionId: string,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    if (!hasEffectivePermission(actor, "TELLER.VIEW") && !hasEffectivePermission(actor, "TELLER.REPORT_VIEW")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.VIEW or TELLER.REPORT_VIEW permission."
      );
    }
    const session = await TellerSessionRepository.findById(sessionId, client);
    if (!session) {
      throw new TellerDomainError("SESSION_NOT_FOUND", `Session '${sessionId}' not found.`);
    }
    this.validateBranchAccess(actor, session.branch_id);
    return session;
  }

  /**
   * Retrieves active session for a teller with branch scoping.
   * Requires: TELLER.VIEW.
   */
  static async getActiveSession(
    tellerIdOrBranchId: string,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerSessionRow | null> {
    if (!hasEffectivePermission(actor, "TELLER.VIEW")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.VIEW permission."
      );
    }
    let session = await TellerSessionRepository.findActiveByTellerId(tellerIdOrBranchId, client);
    if (!session) {
      const branchSessions = await TellerSessionRepository.findActiveByBranchId(tellerIdOrBranchId, client);
      if (branchSessions.length > 0) {
        session = branchSessions[0];
      }
    }
    if (!session) return null;
    this.validateBranchAccess(actor, session.branch_id);
    return session;
  }

  /**
   * Lists teller sessions matching optional filters with branch scoping.
   * Requires: TELLER.VIEW.
   */
  static async listSessions(
    filters: { branchId?: string; tellerId?: string; status?: TellerSessionStatus },
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerSessionRow[]> {
    if (!hasEffectivePermission(actor, "TELLER.VIEW") && !hasEffectivePermission(actor, "TELLER.REPORT_VIEW")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.VIEW or TELLER.REPORT_VIEW permission."
      );
    }
    let targetBranchId = filters.branchId;
    if (actor.role !== "SUPER_ADMIN" && actor.branchId) {
      if (targetBranchId && targetBranchId !== actor.branchId) {
        throw new TellerDomainError(
          "UNAUTHORIZED_BRANCH",
          `Actor does not have access to branch '${targetBranchId}'. Authorized branch is '${actor.branchId}'.`
        );
      }
      targetBranchId = actor.branchId;
    }
    return TellerSessionRepository.listSessions({ ...filters, branchId: targetBranchId }, client);
  }

  /**
   * Guarantees a persistent continuous branch cash custody session anchor exists.
   * Derives available cash from branch records without requiring manual shift creation.
   * If an active OPEN session already exists for the branch, reuses it.
   * Otherwise, provisions the canonical branch continuous custody session anchor.
   */
  static async ensureContinuousBranchSession(
    branchId: string,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerSessionRow> {
    this.validateBranchAccess(actor, branchId);

    const execute = async (txClient: PoolClient): Promise<TellerSessionRow> => {
      // 1. Check for any existing active session at this branch
      const branchSessions = await TellerSessionRepository.findActiveByBranchId(branchId, txClient);
      const openSession = branchSessions.find((s) => s.status === "OPEN");
      if (openSession) {
        return openSession;
      }

      // 2. Ensure default canonical branch teller station exists (Main Cash Drawer)
      const teller = await TellerService.ensureDefaultBranchTeller(branchId, actor, txClient);

      // Pessimistically serialize concurrent session creation on the branch teller station
      await txClient.query("SELECT id FROM public.teller WHERE id = $1 FOR UPDATE", [teller.id]);

      // Check if teller has an open session under lock
      const tellerActive = await TellerSessionRepository.findActiveByTellerId(teller.id, txClient, false);
      if (tellerActive && tellerActive.status === "OPEN") {
        return tellerActive;
      }

      // 3. Ensure user exists
      // 4. Create continuous branch cash custody session anchor
      const timestamp = Date.now();
      const continuousId = `sess_custody_${branchId}_${timestamp}`;

      try {
        return await TellerSessionRepository.create(
          {
            id: continuousId,
            teller_id: teller.id,
            branch_id: branchId,
            opening_float: 0.00,
            expected_cash: 0.00,
            opened_by: actor.userId,
            notes: "Continuous branch cash custody session anchor",
          },
          txClient
        );
      } catch (err: any) {
        if (err.code === "23505") {
          // Concurrent transaction won the race; return the active session
          const existing = await TellerSessionRepository.findActiveByTellerId(teller.id, txClient, false);
          if (existing && existing.status === "OPEN") {
            return existing;
          }
        }
        throw err;
      }
    };

    if (client) {
      return execute(client);
    }
    return dbTransaction(execute);
  }
}

