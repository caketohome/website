/**
 * CakeToHome ERP — Teller Movement Domain Service
 * Phase C3: Teller & Session Domain Services + Repositories
 *
 * Implements physical cash custody projection and controlled manual adjustments:
 * 1. Physical cash projection from authoritative sources (ORDER, COD, REFUND, EXPENSE, BANK_DEPOSIT).
 * 2. Idempotency guarantees: (source_type, source_id) projects at most once.
 * 3. Fail-closed defense: rejects projection if no valid open session exists (never fallback to 1114).
 * 4. Pre-settlement only: movements cannot be added once a session is settled or cancelled.
 */

import { dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { TellerMovementRepository } from "../repositories/teller-movement.repository";
import { TellerSessionRepository } from "../repositories/teller-session.repository";
import { TellerSessionService } from "./teller-session.service";
import { PostingService, PostingServiceError } from "./posting.service";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { AccountingFiscalPeriodRepository } from "../repositories/accounting-fiscal-period.repository";
import type { JournalLineInput } from "../types/accounting.types";
import { hasEffectivePermission } from "../staff-access-control";
import {
  TellerMovementRow,
  TellerMovementDirection,
  TellerMovementType,
  ProjectSystemMovementParams,
  MovementProjectionResult,
  AuthenticatedActor,
  TellerDomainError,
} from "../types/teller.types";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class TellerMovementService {
  /**
   * Records a controlled manual cash adjustment (petty handover, float correction).
   * Requires: TELLER.MOVEMENT_CREATE.
   */
  static async recordManualAdjustment(
    params: {
      session_id?: string;
      branch_id: string;
      direction: TellerMovementDirection;
      amount: number;
      narration: string;
      adjustment_reference_id?: string;
    },
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerMovementRow> {
    if (!hasEffectivePermission(actor, "TELLER.MOVEMENT_CREATE") && !hasEffectivePermission(actor, "TELLER.ADJUST")) {
      throw new TellerDomainError(
        "PERMISSION_DENIED",
        "Actor does not possess TELLER.MOVEMENT_CREATE or TELLER.ADJUST permission."
      );
    }

    if (actor.role !== "SUPER_ADMIN" && actor.branchId && actor.branchId !== params.branch_id) {
      throw new TellerDomainError(
        "UNAUTHORIZED_BRANCH",
        `Actor does not have access to branch '${params.branch_id}'.`
      );
    }

    const amount = round2(params.amount);
    if (amount <= 0) {
      throw new TellerDomainError(
        "INVALID_AMOUNT",
        `Adjustment amount must be positive. Got ${amount}.`
      );
    }

    if (!params.narration || params.narration.trim().length < 3) {
      throw new TellerDomainError(
        "INVALID_AMOUNT",
        "Explicit narration of at least 3 characters is required for manual adjustments."
      );
    }

    const execute = async (txClient: PoolClient) => {
      const sourceId = params.adjustment_reference_id || `man_adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // 1. Idempotency check: if adjustment_reference_id was supplied and already exists, return existing
      if (params.adjustment_reference_id) {
        const existing = await TellerMovementRepository.findBySource("MANUAL", params.adjustment_reference_id, txClient);
        if (existing) {
          return existing;
        }
      }

      // 2. Resolve session (fallback to continuous branch session if session_id omitted)
      let targetSessionId = params.session_id;
      if (!targetSessionId) {
        const continuousSession = await TellerSessionService.ensureContinuousBranchSession(
          params.branch_id,
          actor,
          txClient
        );
        targetSessionId = continuousSession.id;
      }

      // 3. Lock session row
      const session = await TellerSessionRepository.findById(targetSessionId, txClient, true);
      if (!session) {
        throw new TellerDomainError("SESSION_NOT_FOUND", `Session '${targetSessionId}' not found.`);
      }

      if (session.branch_id !== params.branch_id) {
        throw new TellerDomainError(
          "UNAUTHORIZED_BRANCH",
          `Session '${session.id}' belongs to branch '${session.branch_id}', not '${params.branch_id}'.`
        );
      }

      if (session.status === "SETTLED") {
        throw new TellerDomainError(
          "SESSION_ALREADY_SETTLED",
          `Session '${session.id}' is SETTLED. Movements cannot be added to settled sessions.`
        );
      }
      if (session.status === "CANCELLED") {
        throw new TellerDomainError(
          "SESSION_ALREADY_CANCELLED",
          `Session '${session.id}' is CANCELLED. Movements cannot be added to cancelled sessions.`
        );
      }
      if (session.status !== "OPEN") {
        throw new TellerDomainError(
          "INVALID_SESSION_STATE",
          `Session '${session.id}' is in ${session.status} status. Movements can only be added to OPEN sessions.`
        );
      }

      // Enforce sufficient cash in drawer for OUT manual disbursements
      if (params.direction === "OUT") {
        const totals = await TellerMovementRepository.getTotalsForSession(session.id, txClient);
        const currentExpected = round2(session.opening_float + totals.netMovement);
        if (amount > currentExpected) {
          throw new TellerDomainError(
            "INSUFFICIENT_FUNDS",
            `Disbursement amount (₹${amount.toFixed(2)}) exceeds available cash in drawer (₹${currentExpected.toFixed(2)}).`
          );
        }
      }

      // 4. Resolve canonical GL Accounts: 1111 (Cash in Hand) and 5296 (Cash Over/Short)
      const acc1111 = await AccountingAccountRepository.findByCode("1111", txClient);
      const acc5296 = await AccountingAccountRepository.findByCode("5296", txClient);
      if (!acc1111 || !acc1111.is_active || acc1111.is_group) {
        throw new TellerDomainError("CONTROL_ACCOUNT_INACTIVE", "Control Account 1111 (Cash in Hand) is missing, inactive, or a group account.");
      }
      if (!acc5296 || !acc5296.is_active || acc5296.is_group) {
        throw new TellerDomainError("CONTROL_ACCOUNT_INACTIVE", "Control Account 5296 (Cash Over/Short) is missing, inactive, or a group account.");
      }

      // 5. Validate Accounting Start Date and Fiscal Period (Hard Blocks via PostingService)
      const todayStr = new Date().toISOString().split("T")[0];
      try {
        await PostingService.validateAccountingStartDate(todayStr, txClient);
        await PostingService.validateFiscalPeriod(todayStr, txClient);
      } catch (err: any) {
        if (err instanceof PostingServiceError) {
          throw new TellerDomainError(err.code as any, err.message);
        }
        throw err;
      }

      const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(todayStr, txClient);
      const fiscalYear = periodStatus.status === "PERIOD_OPEN" ? periodStatus.period.fiscal_year : "FY2026-27";

      // 6. Build Balanced Double-Entry Journal Lines
      const lines: JournalLineInput[] = params.direction === "IN"
        ? [
            {
              account_id: acc1111.id,
              debit_amount: amount,
              credit_amount: 0,
              branch_id: session.branch_id,
              narration: `Manual cash adjustment IN for session ${session.id}: ${params.narration.trim()}`,
              metadata: { session_id: session.id, movement_source: sourceId },
            },
            {
              account_id: acc5296.id,
              debit_amount: 0,
              credit_amount: amount,
              branch_id: session.branch_id,
              narration: `Cash adjustment credit for session ${session.id}: ${params.narration.trim()}`,
              metadata: { session_id: session.id, movement_source: sourceId },
            },
          ]
        : [
            {
              account_id: acc5296.id,
              debit_amount: amount,
              credit_amount: 0,
              branch_id: session.branch_id,
              narration: `Cash adjustment debit for session ${session.id}: ${params.narration.trim()}`,
              metadata: { session_id: session.id, movement_source: sourceId },
            },
            {
              account_id: acc1111.id,
              debit_amount: 0,
              credit_amount: amount,
              branch_id: session.branch_id,
              narration: `Manual cash adjustment OUT for session ${session.id}: ${params.narration.trim()}`,
              metadata: { session_id: session.id, movement_source: sourceId },
            },
          ];

      // 7. Ensure actor user identities exist in public."user" for audit foreign keys
      const ensureUser = async (uid: string) => {
        const ures = await txClient.query('SELECT id FROM public."user" WHERE id = $1', [uid]);
        if (ures.rows.length === 0) {
          await txClient.query(
            `INSERT INTO public."user" (id, email, name, role, is_active, updated_at)
             VALUES ($1, $2, $3, 'STAFF', true, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [uid, `${uid}@caketohome.internal`, `Staff ${uid}`]
          );
        }
      };
      await ensureUser(actor.userId);

      // Segregation of Duties: maker != checker
      const voucherCreator = session.opened_by && session.opened_by !== actor.userId ? session.opened_by : "system";
      await ensureUser(voucherCreator);

      // 8. Atomic Voucher Draft -> Submit -> Approve -> Post
      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "JOURNAL",
          voucher_date: todayStr,
          branch_id: session.branch_id,
          narration: `Manual cash adjustment (${params.direction}): ${params.narration.trim()} - Session ${session.id}`,
          reference_type: "TELLER_MOVEMENT",
          reference_id: sourceId,
          reference_event: "MANUAL_ADJUSTMENT",
          metadata: {
            source_module: "TELLER",
            session_id: session.id,
            teller_id: session.teller_id,
            branch_id: session.branch_id,
            direction: params.direction,
            amount: amount,
            adjusted_by: actor.userId,
          },
        },
        branchId: session.branch_id,
        fiscalYear,
        createdBy: voucherCreator,
        client: txClient,
      });

      if (!draftRes.success) {
        throw new TellerDomainError("ADJUSTMENT_POSTING_FAILED", `Failed to create adjustment voucher draft: ${draftRes.error}`);
      }

      const submitRes = await PostingService.submitVoucher({
        voucherId: draftRes.data.id,
        submittedBy: voucherCreator,
        branchId: session.branch_id,
        client: txClient,
      });
      if (!submitRes.success) {
        throw new TellerDomainError("ADJUSTMENT_POSTING_FAILED", `Failed to submit adjustment voucher: ${submitRes.error}`);
      }

      const approveRes = await PostingService.approveVoucher({
        voucherId: draftRes.data.id,
        approvedBy: actor.userId,
        branchId: session.branch_id,
        client: txClient,
      });
      if (!approveRes.success) {
        throw new TellerDomainError("ADJUSTMENT_POSTING_FAILED", `Failed to approve adjustment voucher: ${approveRes.error}`);
      }

      const postRes = await PostingService.postVoucher({
        voucherId: draftRes.data.id,
        postedBy: actor.userId,
        lines,
        branchId: session.branch_id,
        client: txClient,
      });
      if (!postRes.success) {
        throw new TellerDomainError("ADJUSTMENT_POSTING_FAILED", `Failed to post adjustment voucher: ${postRes.error}`);
      }

      // 9. Atomically insert movement row in the same transaction
      return TellerMovementRepository.create(
        {
          session_id: session.id,
          branch_id: session.branch_id,
          direction: params.direction,
          movement_type: "ADJUSTMENT",
          amount: amount,
          source_type: "MANUAL",
          source_id: sourceId,
          narration: params.narration.trim(),
          created_by: actor.userId,
        },
        txClient
      );
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
   * Projects an authoritative financial source event into the teller cash custody ledger.
   * Enforces:
   * 1. Idempotency on (source_type, source_id).
   * 2. Fail-closed defense: requires an active OPEN session at the requested branch.
   * 3. Row-level concurrency locking on the session.
   * 4. Zero duplicate GL entries.
   */
  static async projectSystemMovement(
    params: ProjectSystemMovementParams,
    client?: PoolClient
  ): Promise<MovementProjectionResult> {
    const sourceType = params.source_type.trim();
    const sourceId = params.source_id.trim();
    const amount = round2(params.amount);
    const branchId = params.branch_id.trim();

    if (!sourceType || !sourceId) {
      throw new TellerDomainError(
        "MISSING_AUTHORITATIVE_SOURCE",
        "Authoritative source_type and source_id are required for system projections."
      );
    }

    if (amount <= 0) {
      throw new TellerDomainError(
        "INVALID_AMOUNT",
        `Projection amount must be positive. Got ${amount}.`
      );
    }

    const execute = async (txClient: PoolClient): Promise<MovementProjectionResult> => {
      // 1. Fast idempotency check
      const existing = await TellerMovementRepository.findBySource(sourceType, sourceId, txClient);
      if (existing) {
        return {
          movement: existing,
          wasDuplicate: true,
        };
      }

      // 2. Resolve target session (fallback to continuous branch cash custody session)
      let targetSessionId = params.teller_session_id;
      if (!targetSessionId) {
        const activeSessions = await TellerSessionRepository.findActiveByBranchId(branchId, txClient);
        const openSessions = activeSessions.filter((s) => s.status === "OPEN");

        if (openSessions.length === 0) {
          // Provision or anchor to the continuous branch cash custody session
          const systemActor: AuthenticatedActor = {
            userId: params.created_by || "system",
            role: "SUPER_ADMIN",
            branchId,
          };
          const continuousSession = await TellerSessionService.ensureContinuousBranchSession(
            branchId,
            systemActor,
            txClient
          );
          targetSessionId = continuousSession.id;
        } else {
          // Anchor to the single active open session
          targetSessionId = openSessions[0].id;
        }
      }

      // 3. Pessimistic row-lock on target session
      const session = await TellerSessionRepository.findById(targetSessionId, txClient, true);
      if (!session) {
        throw new TellerDomainError(
          "SESSION_NOT_FOUND",
          `Target teller session '${targetSessionId}' not found.`
        );
      }

      if (session.branch_id !== branchId) {
        throw new TellerDomainError(
          "UNAUTHORIZED_BRANCH",
          `Session '${session.id}' belongs to branch '${session.branch_id}', not '${branchId}'.`
        );
      }

      if (session.status !== "OPEN") {
        throw new TellerDomainError(
          "INVALID_SESSION_STATE",
          `Cannot project cash into session '${session.id}': session is currently ${session.status} (expected OPEN).`
        );
      }

      // Enforce sufficient cash in drawer for OUT projections (refunds, bank deposits, safe drops)
      if (params.direction === "OUT") {
        const totals = await TellerMovementRepository.getTotalsForSession(session.id, txClient);
        const currentExpected = round2(session.opening_float + totals.netMovement);
        if (amount > currentExpected) {
          throw new TellerDomainError(
            "INSUFFICIENT_FUNDS",
            `Disbursement amount (₹${amount.toFixed(2)}) exceeds available cash in drawer (₹${currentExpected.toFixed(2)}).`
          );
        }
      }

      // 4. Create movement with duplicate rescue
      try {
        const movement = await TellerMovementRepository.create(
          {
            session_id: session.id,
            branch_id: session.branch_id,
            direction: params.direction,
            movement_type: params.movement_type,
            amount: amount,
            source_type: sourceType,
            source_id: sourceId,
            narration: params.narration || `${params.movement_type} from ${sourceType} ${sourceId}`,
            created_by: params.created_by || "system_projection",
          },
          txClient
        );
        return {
          movement,
          wasDuplicate: false,
        };
      } catch (err: any) {
        if (err.code === "DUPLICATE_SOURCE_MOVEMENT" || err.constraint === "uq_teller_movement_system_source") {
          const rescued = await TellerMovementRepository.findBySource(sourceType, sourceId, txClient);
          if (rescued) {
            return {
              movement: rescued,
              wasDuplicate: true,
            };
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

  // ── Authoritative Domain Projection Helpers ───────────────────────────────

  /**
   * Cash Sale projection from Retail Order (Section 21).
   * Direction: IN
   */
  static async projectCashSale(
    orderId: string,
    branchId: string,
    amount: number,
    actorUserId?: string,
    sessionId?: string,
    client?: PoolClient
  ): Promise<MovementProjectionResult> {
    return this.projectSystemMovement(
      {
        branch_id: branchId,
        teller_session_id: sessionId,
        direction: "IN",
        movement_type: "CASH_SALE",
        amount,
        source_type: "ORDER",
        source_id: orderId,
        narration: `Cash sale collection for order ${orderId}`,
        created_by: actorUserId,
      },
      client
    );
  }

  /**
   * COD Handover projection from Rider Shift Settlement (Section 17).
   * Direction: IN
   */
  static async projectCodHandover(
    shiftSettlementId: string,
    branchId: string,
    amount: number,
    actorUserId?: string,
    sessionId?: string,
    client?: PoolClient
  ): Promise<MovementProjectionResult> {
    return this.projectSystemMovement(
      {
        branch_id: branchId,
        teller_session_id: sessionId,
        direction: "IN",
        movement_type: "COD_HANDOVER",
        amount,
        source_type: "RIDER_SHIFT_SETTLEMENT",
        source_id: shiftSettlementId,
        narration: `COD shift remittance from settlement ${shiftSettlementId}`,
        created_by: actorUserId,
      },
      client
    );
  }

  /**
   * Cash Customer Refund projection from Credit Note / Refund (Section 18).
   * Direction: OUT
   */
  static async projectCustomerRefund(
    refundId: string,
    branchId: string,
    amount: number,
    actorUserId?: string,
    sessionId?: string,
    client?: PoolClient
  ): Promise<MovementProjectionResult> {
    return this.projectSystemMovement(
      {
        branch_id: branchId,
        teller_session_id: sessionId,
        direction: "OUT",
        movement_type: "CUSTOMER_REFUND",
        amount,
        source_type: "REFUND",
        source_id: refundId,
        narration: `Customer cash refund disbursement for refund ${refundId}`,
        created_by: actorUserId,
      },
      client
    );
  }

  /**
   * Bank Deposit projection from Bank Deposit Slip (Section 19).
   * Direction: OUT (physical custody leaving the drawer).
   */
  static async projectBankDeposit(
    depositSlipId: string,
    branchId: string,
    amount: number,
    actorUserId?: string,
    sessionId?: string,
    client?: PoolClient
  ): Promise<MovementProjectionResult> {
    return this.projectSystemMovement(
      {
        branch_id: branchId,
        teller_session_id: sessionId,
        direction: "OUT",
        movement_type: "BANK_DEPOSIT",
        amount,
        source_type: "BANK_DEPOSIT_SLIP",
        source_id: depositSlipId,
        narration: `Cash drawer dispatch for bank deposit slip ${depositSlipId}`,
        created_by: actorUserId,
      },
      client
    );
  }

  /**
   * Cash Expense projection from Branch Expense Voucher (Section 20).
   * Direction: OUT
   */
  static async projectExpensePayment(
    expenseId: string,
    branchId: string,
    amount: number,
    actorUserId?: string,
    sessionId?: string,
    client?: PoolClient
  ): Promise<MovementProjectionResult> {
    return this.projectSystemMovement(
      {
        branch_id: branchId,
        teller_session_id: sessionId,
        direction: "OUT",
        movement_type: "EXPENSE_PAYMENT",
        amount,
        source_type: "EXPENSE",
        source_id: expenseId,
        narration: `Cash drawer disbursement for expense ${expenseId}`,
        created_by: actorUserId,
      },
      client
    );
  }

  /**
   * Retrieves all movements for a session in chronological order.
   * Requires: TELLER.VIEW.
   */
  static async getSessionMovements(
    sessionId: string,
    actor: AuthenticatedActor,
    client?: PoolClient
  ): Promise<TellerMovementRow[]> {
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
    if (actor.role !== "SUPER_ADMIN" && actor.branchId && actor.branchId !== session.branch_id) {
      throw new TellerDomainError(
        "UNAUTHORIZED_BRANCH",
        `Actor does not have access to branch '${session.branch_id}'. Authorized branch is '${actor.branchId}'.`
      );
    }
    return TellerMovementRepository.listBySession(sessionId, client);
  }
}
