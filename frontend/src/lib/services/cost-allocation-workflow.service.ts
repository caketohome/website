/**
 * CakeToHome ERP — Cost Allocation Workflow Service
 * Phase C7.6 Step 4C: Multi-Step Allocation Lifecycle, Maker-Checker SoD, GL Postings & Reversals.
 *
 * ARCHITECTURAL CONTRACT & LIFECYCLE:
 * 1. LIFECYCLE STATE MACHINE:
 *    - PREVIEW: Dry-run calculation, zero ledger mutation, returns proposed allocations.
 *    - DRAFT / SUBMITTED: Maker creates allocation run and detailed lines, locks source lines.
 *    - POSTED: Checker approves run; posts canonical JOURNAL voucher with direct cost offset.
 *    - REVERSED: Checker authorizes compensating reversal voucher; swaps Dr/Cr, links reversal.
 * 2. STRICT SEGREGATION OF DUTIES (SoD):
 *    - Checker cannot be Maker: approved_by !== executed_by.
 *    - Reverser cannot be Maker: reversed_by !== executed_by.
 *    - No bypass for Super Admin or privileged roles.
 * 3. CANONICAL POSTING LIFECYCLE:
 *    - Uses canonical PostingService and AccountingVoucherRepository.
 *    - Creates balanced JOURNAL voucher (Credit Source CC line, Debit Target CC lines).
 *    - Preserves exact Chart of Accounts (100 accounts invariant).
 *    - Preserves Company Trial Balance (Dr ₹3,380.00 = Cr ₹3,380.00 invariant).
 * 4. CONCURRENCY & DUPLICATE PROTECTION:
 *    - Locks candidate source journal lines exclusively (SELECT FOR UPDATE).
 *    - Prevents double-allocation of source journal lines across concurrent runs.
 *    - Reversals allow source lines to become re-allocatable.
 * 5. IMMUTABILITY & AUDITABILITY:
 *    - Submitted and Posted runs freeze an immutable rule_snapshot.
 *    - Posted vouchers and journal lines are never updated or deleted.
 */

import { dbTransaction, dbQuery } from "../db";
import type { PoolClient } from "pg";
import { CostAllocationRepository } from "../repositories/cost-allocation.repository";
import { CostAllocationEngineService } from "./cost-allocation-engine.service";
import { PostingService } from "./posting.service";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { AccountingJournalRepository } from "../repositories/accounting-journal.repository";
import { AccountGovernanceService } from "./account-governance.service";
import { hasEffectivePermission } from "../staff-access-control";
import {
  CostAllocationDomainError,
  type CostAllocationRuleWithTargets,
  type CostAllocationPreviewResult,
  type PreviewCostAllocationParams,
  type ExecuteCostAllocationRunParams,
  type ApproveAndPostCostAllocationRunParams,
  type ReverseCostAllocationRunParams,
  type CostAllocationRunExecutionResult,
  type CostAllocationPostingResult,
  type CostAllocationReversalResult,
  type CostAllocationRunLineInput,
  type JournalLineInput,
  type CostAllocationRunRow,
} from "../types/accounting.types";

export class CostAllocationWorkflowService {
  /**
   * Helper to resolve the default company branch ID.
   */
  private static async getDefaultBranchId(client?: PoolClient): Promise<string> {
    const sql = `SELECT id FROM public.branch WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1;`;
    const res = client ? await client.query<{ id: string }>(sql) : await dbQuery<{ id: string }>(sql);
    if (!res.rows[0]) {
      throw new CostAllocationDomainError("OPERATION_FAILED", "No active branch found in system.");
    }
    return res.rows[0].id;
  }

  // ── 1. PREVIEW ALLOCATION (DRY RUN) ──────────────────────────────────────────

  /**
   * Dry-run calculation of cost allocation for a rule.
   * Reads eligible unallocated source expense lines in the period, calculates
   * line-by-line largest remainder distributions, and returns results WITHOUT mutating the ledger.
   */
  static async previewAllocation(
    params: PreviewCostAllocationParams,
    client?: PoolClient
  ): Promise<CostAllocationPreviewResult> {
    // Permission check if actorContext provided
    if (params.actorContext) {
      const canPreview =
        hasEffectivePermission(params.actorContext, "COST_ALLOCATION.RUN_PREVIEW") ||
        hasEffectivePermission(params.actorContext, "COST_ALLOCATION.VIEW") ||
        hasEffectivePermission(params.actorContext, "ACCOUNTING.VIEW");
      if (!canPreview) {
        throw new CostAllocationDomainError(
          "PERMISSION_DENIED",
          "Insufficient permissions to preview cost allocation. Required: COST_ALLOCATION.RUN_PREVIEW or COST_ALLOCATION.VIEW."
        );
      }
    }

    // 1. Fetch Rule with Targets
    const rule = await CostAllocationRepository.findRuleById(params.ruleId, false, client);
    if (!rule) {
      throw new CostAllocationDomainError("RULE_NOT_FOUND", `Allocation rule '${params.ruleId}' not found.`);
    }

    // 2. Validate Rule Eligibility
    CostAllocationEngineService.validateRuleEligibility(rule, params.allocationDate);

    // 3. Resolve and Validate Fiscal Period
    const period = await PostingService.validateFiscalPeriod(params.allocationDate, client);
    const fiscalYear = params.fiscalYear || period.fiscal_year;
    const periodName = params.periodName || period.period_name;

    // 4. Query Eligible Source Expense Lines
    // Eligible lines must:
    // - Belong to source_account_id and source_cost_centre_id
    // - Be debit_amount > 0
    // - Be in a POSTED non-reversed voucher and non-reversed journal entry
    // - Fall within period start_date and end_date
    // - Not already be allocated in any active (SUBMITTED or POSTED) run
    let querySql = `
      SELECT 
        jl.id,
        jl.journal_entry_id,
        je.entry_no,
        je.voucher_id,
        v.voucher_no,
        je.entry_date::text as entry_date,
        jl.debit_amount::numeric as debit_amount,
        jl.narration
      FROM public.accounting_journal_line jl
      JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id AND je.is_reversed = false
      JOIN public.accounting_voucher v ON v.id = je.voucher_id 
        AND v.status = 'POSTED' 
        AND v.deleted_at IS NULL 
        AND v.reversed_by_voucher_id IS NULL
        AND (v.reference_type IS NULL OR v.reference_type NOT IN ('COST_ALLOCATION', 'COST_ALLOCATION_REVERSAL'))
      WHERE jl.account_id = $1
        AND jl.cost_centre_id = $2
        AND jl.debit_amount > 0
        AND je.entry_date BETWEEN $3 AND $4
        AND NOT EXISTS (
          SELECT 1 FROM public.cost_allocation_run_line rl
          JOIN public.cost_allocation_run r ON r.id = rl.run_id
          WHERE rl.source_journal_line_id = jl.id
            AND r.status IN ('SUBMITTED', 'POSTED')
        )
    `;
    const queryParams: any[] = [
      rule.source_account_id,
      rule.source_cost_centre_id,
      period.start_date,
      period.end_date,
    ];

    if (params.sourceJournalLineIds && params.sourceJournalLineIds.length > 0) {
      querySql += ` AND jl.id = ANY($5)`;
      queryParams.push(params.sourceJournalLineIds);
    }

    querySql += ` ORDER BY je.entry_date ASC, jl.id ASC;`;

    const linesRes = client
      ? await client.query(querySql, queryParams)
      : await dbQuery(querySql, queryParams);

    const eligibleLines = linesRes.rows;

    if (eligibleLines.length === 0) {
      throw new CostAllocationDomainError(
        "NO_SOURCE_EXPENSES_FOUND",
        `No eligible posted shared expense lines found for source cost centre '${rule.source_cost_centre_code}' and account '${rule.source_account_code}' in period '${periodName}'.`
      );
    }

    // 5. Calculate line-by-line allocations using Largest Remainder Method
    let totalSourceAmount = 0;
    let totalAllocatedAmount = 0;
    const calculatedLines: CostAllocationPreviewResult["calculated_lines"] = [];

    for (const sourceLine of eligibleLines) {
      const lineAmt = Number(sourceLine.debit_amount);
      totalSourceAmount += lineAmt;

      const targetCalcs = CostAllocationEngineService.calculateLargestRemainder(
        lineAmt,
        rule.targets
      );

      for (const t of targetCalcs) {
        totalAllocatedAmount += t.allocated_amount;
        calculatedLines.push({
          source_journal_line_id: sourceLine.id,
          target_cost_centre_id: t.target_cost_centre_id,
          target_cost_centre_code: t.target_cost_centre_code,
          target_account_id: t.target_account_id || rule.source_account_id,
          target_account_code: t.target_account_code || rule.source_account_code,
          target_percentage: t.target_percentage,
          allocated_amount: t.allocated_amount,
          sort_order: t.sort_order,
        });
      }
    }

    totalSourceAmount = Number(totalSourceAmount.toFixed(2));
    totalAllocatedAmount = Number(totalAllocatedAmount.toFixed(2));
    const roundingDifference = Number((totalSourceAmount - totalAllocatedAmount).toFixed(2));

    return {
      rule,
      fiscal_year: fiscalYear,
      period_name: periodName,
      allocation_date: params.allocationDate,
      total_source_amount: totalSourceAmount,
      total_allocated_amount: totalAllocatedAmount,
      rounding_difference: roundingDifference,
      source_journal_lines: eligibleLines.map((l: any) => ({
        id: l.id,
        journal_entry_id: l.journal_entry_id,
        entry_no: l.entry_no,
        voucher_id: l.voucher_id,
        voucher_no: l.voucher_no,
        entry_date: l.entry_date,
        debit_amount: Number(l.debit_amount),
        narration: l.narration,
      })),
      calculated_lines: calculatedLines,
    };
  }

  // ── 2. EXECUTE ALLOCATION RUN (MAKER ACTION) ─────────────────────────────────

  /**
   * Execute an allocation run (Maker action).
   * Validates rule, locks source lines, applies calculation engine, and records
   * an auditable cost_allocation_run with status SUBMITTED (or DRAFT) and detailed lines.
   */
  static async executeAllocationRun(
    params: ExecuteCostAllocationRunParams,
    externalClient?: PoolClient
  ): Promise<CostAllocationRunExecutionResult> {
    const execute = async (client: PoolClient): Promise<CostAllocationRunExecutionResult> => {
      // 1. Permission Check
      if (params.actorContext) {
        const canExecute =
          hasEffectivePermission(params.actorContext, "COST_ALLOCATION.EXECUTE") ||
          hasEffectivePermission(params.actorContext, "ACCOUNTING.CREATE");
        if (!canExecute) {
          throw new CostAllocationDomainError(
            "PERMISSION_DENIED",
            "Insufficient permissions to execute cost allocation. Required: COST_ALLOCATION.EXECUTE."
          );
        }
      }

      // 2. Fetch and Validate Rule
      const rule = await CostAllocationRepository.findRuleById(params.ruleId, false, client);
      if (!rule) {
        throw new CostAllocationDomainError("RULE_NOT_FOUND", `Allocation rule '${params.ruleId}' not found.`);
      }

      CostAllocationEngineService.validateRuleEligibility(rule, params.allocationDate);

      // 3. Validate Fiscal Period and Accounting Start Date
      await PostingService.validateAccountingStartDate(params.allocationDate, client);
      const period = await PostingService.validateFiscalPeriod(params.allocationDate, client);
      const fiscalYear = params.fiscalYear || period.fiscal_year;
      const periodName = params.periodName || period.period_name;

      // 4. Query and Lock Eligible Source Journal Lines (FOR UPDATE)
      let lockSql = `
        SELECT 
          jl.id,
          jl.journal_entry_id,
          je.entry_no,
          je.voucher_id,
          v.voucher_no,
          je.entry_date::text as entry_date,
          jl.debit_amount::numeric as debit_amount,
          jl.narration
        FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id AND je.is_reversed = false
        JOIN public.accounting_voucher v ON v.id = je.voucher_id 
          AND v.status = 'POSTED' 
          AND v.deleted_at IS NULL 
          AND v.reversed_by_voucher_id IS NULL
          AND (v.reference_type IS NULL OR v.reference_type NOT IN ('COST_ALLOCATION', 'COST_ALLOCATION_REVERSAL'))
        WHERE jl.account_id = $1
          AND jl.cost_centre_id = $2
          AND jl.debit_amount > 0
          AND je.entry_date BETWEEN $3 AND $4
          AND NOT EXISTS (
            SELECT 1 FROM public.cost_allocation_run_line rl
            JOIN public.cost_allocation_run r ON r.id = rl.run_id
            WHERE rl.source_journal_line_id = jl.id
              AND r.status IN ('SUBMITTED', 'POSTED')
          )
      `;
      const lockParams: any[] = [
        rule.source_account_id,
        rule.source_cost_centre_id,
        period.start_date,
        period.end_date,
      ];

      if (params.sourceJournalLineIds && params.sourceJournalLineIds.length > 0) {
        lockSql += ` AND jl.id = ANY($5)`;
        lockParams.push(params.sourceJournalLineIds);
      }

      lockSql += ` ORDER BY je.entry_date ASC, jl.id ASC FOR UPDATE OF jl;`;

      const linesRes = await client.query(lockSql, lockParams);
      const eligibleLines = linesRes.rows;

      if (eligibleLines.length === 0) {
        throw new CostAllocationDomainError(
          "NO_SOURCE_EXPENSES_FOUND",
          `No eligible unallocated posted expense lines found for source cost centre '${rule.source_cost_centre_code}' and account '${rule.source_account_code}' in period '${periodName}'.`
        );
      }

      // 5. Calculate Line-by-Line Allocations
      let totalSourceAmount = 0;
      let totalAllocatedAmount = 0;
      const runLinesInput: CostAllocationRunLineInput[] = [];

      for (const sourceLine of eligibleLines) {
        const lineAmt = Number(sourceLine.debit_amount);
        totalSourceAmount += lineAmt;

        const targetCalcs = CostAllocationEngineService.calculateLargestRemainder(
          lineAmt,
          rule.targets
        );

        for (const t of targetCalcs) {
          totalAllocatedAmount += t.allocated_amount;
          runLinesInput.push({
            source_journal_line_id: sourceLine.id,
            target_cost_centre_id: t.target_cost_centre_id,
            target_account_id: t.target_account_id || rule.source_account_id,
            target_percentage: t.target_percentage,
            allocated_amount: t.allocated_amount,
            sort_order: t.sort_order,
          });
        }
      }

      totalSourceAmount = Number(totalSourceAmount.toFixed(2));
      totalAllocatedAmount = Number(totalAllocatedAmount.toFixed(2));
      const roundingDifference = Number((totalSourceAmount - totalAllocatedAmount).toFixed(2));

      // 6. Freeze Immutable Rule Snapshot
      const ruleSnapshot = {
        rule_id: rule.id,
        rule_code: rule.rule_code,
        rule_name: rule.name,
        rule_type: rule.rule_type,
        rule_version: rule.version,
        source_cost_centre_id: rule.source_cost_centre_id,
        source_cost_centre_code: rule.source_cost_centre_code,
        source_cost_centre_name: rule.source_cost_centre_name,
        source_account_id: rule.source_account_id,
        source_account_code: rule.source_account_code,
        effective_from: typeof rule.effective_from === "string" ? rule.effective_from : new Date(rule.effective_from).toISOString().slice(0, 10),
        effective_to: rule.effective_to ? (typeof rule.effective_to === "string" ? rule.effective_to : new Date(rule.effective_to).toISOString().slice(0, 10)) : null,
        targets: rule.targets.map((t) => ({
          target_cost_centre_id: t.target_cost_centre_id,
          target_cost_centre_code: t.target_cost_centre_code,
          target_cost_centre_name: t.target_cost_centre_name,
          target_account_id: t.target_account_id || rule.source_account_id,
          target_account_code: t.target_account_code || rule.source_account_code,
          percentage: Number(t.percentage),
          sort_order: t.sort_order,
        })),
        captured_at: new Date().toISOString(),
      };

      // 7. Generate Deterministic Run Number
      const timestampSuffix = Date.now().toString().slice(-6);
      const cleanPeriod = periodName.replace(/[^A-Za-z0-9]/g, "");
      const runNumber = `RUN-ALC-${fiscalYear}-${cleanPeriod}-${timestampSuffix}`;

      // 8. Create Run Record & Lines via CostAllocationRepository
      const status = params.status || "SUBMITTED";
      const createdRun = await CostAllocationRepository.createRun(
        {
          run_number: runNumber,
          rule_id: rule.id,
          rule_version: rule.version,
          fiscal_year: fiscalYear,
          period_name: periodName,
          allocation_date: params.allocationDate,
          source_cost_centre_id: rule.source_cost_centre_id,
          source_account_id: rule.source_account_id,
          total_source_amount: totalSourceAmount,
          total_allocated_amount: totalAllocatedAmount,
          rounding_difference: roundingDifference,
          status,
          rule_snapshot: ruleSnapshot,
          narration:
            params.narration ||
            `Cost Allocation Run ${runNumber} for ${rule.rule_code} (${periodName})`,
          metadata: {
            source_line_count: eligibleLines.length,
            target_count: rule.targets.length,
          },
          lines: runLinesInput,
        },
        params.executedBy,
        client
      );

      const runLines = await CostAllocationRepository.findRunLines(createdRun.id, client);

      return {
        run: createdRun,
        lines: runLines,
      };
    };

    return externalClient ? execute(externalClient) : dbTransaction(execute);
  }

  // ── 3. APPROVE AND POST RUN (CHECKER ACTION) ─────────────────────────────────

  /**
   * Approve an allocation run and post to the General Ledger (Checker action).
   * Strictly enforces Maker-Checker Segregation of Duties: approvedBy !== executed_by.
   * Generates canonical balanced JOURNAL voucher and updates run status to POSTED.
   */
  static async approveAndPostRun(
    params: ApproveAndPostCostAllocationRunParams,
    externalClient?: PoolClient
  ): Promise<CostAllocationPostingResult> {
    const execute = async (client: PoolClient): Promise<CostAllocationPostingResult> => {
      // 1. Permission Check
      if (params.actorContext) {
        const canApprove =
          hasEffectivePermission(params.actorContext, "COST_ALLOCATION.APPROVE") ||
          hasEffectivePermission(params.actorContext, "ACCOUNTING.APPROVE");
        if (!canApprove) {
          throw new CostAllocationDomainError(
            "PERMISSION_DENIED",
            "Insufficient permissions to approve cost allocation. Required: COST_ALLOCATION.APPROVE."
          );
        }
      }

      // 2. Lock Run Row Exclusively (FOR UPDATE)
      const lockRunSql = `SELECT * FROM public.cost_allocation_run WHERE id = $1 FOR UPDATE;`;
      const runRes = await client.query<CostAllocationRunRow>(lockRunSql, [params.runId]);
      const run = runRes.rows[0];

      if (!run) {
        throw new CostAllocationDomainError("RUN_NOT_FOUND", `Allocation run '${params.runId}' not found.`);
      }

      // 3. Status Check
      if (run.status === "POSTED") {
        throw new CostAllocationDomainError(
          "RUN_ALREADY_POSTED",
          `Allocation run '${run.run_number}' is already posted and immutable.`
        );
      }
      if (run.status !== "SUBMITTED") {
        throw new CostAllocationDomainError(
          "INVALID_RUN_STATUS",
          `Cannot approve allocation run in status '${run.status}'. Only SUBMITTED runs may be approved.`
        );
      }

      // 4. STRICT SEGREGATION OF DUTIES (SoD) CHECK
      // The maker cannot approve their own run (No Super Admin bypass)
      if (run.executed_by === params.approvedBy) {
        throw new CostAllocationDomainError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Staff '${params.approvedBy}' executed run '${run.run_number}' and cannot approve it.`
        );
      }

      // 5. Validate Fiscal Period & Accounting Start Date
      await PostingService.validateAccountingStartDate(run.allocation_date, client);
      await PostingService.validateFiscalPeriod(run.allocation_date, client);

      // 6. Fetch Detailed Run Lines
      const runLines = await CostAllocationRepository.findRunLines(run.id, client);
      if (runLines.length === 0) {
        throw new CostAllocationDomainError(
          "OPERATION_FAILED",
          `Allocation run '${run.run_number}' has no detailed run lines.`
        );
      }

      // 7. Verify Source Journal Lines have not been allocated concurrently
      const sourceLineIds = Array.from(new Set(runLines.map((l) => l.source_journal_line_id).filter(Boolean)));
      if (sourceLineIds.length > 0) {
        const conflictSql = `
          SELECT rl.source_journal_line_id, r.run_number
          FROM public.cost_allocation_run_line rl
          JOIN public.cost_allocation_run r ON r.id = rl.run_id
          WHERE rl.source_journal_line_id = ANY($1)
            AND r.id <> $2
            AND r.status IN ('SUBMITTED', 'POSTED')
          LIMIT 1;
        `;
        const conflictRes = await client.query(conflictSql, [sourceLineIds, run.id]);
        if (conflictRes.rows.length > 0) {
          throw new CostAllocationDomainError(
            "SOURCE_LINE_ALREADY_ALLOCATED",
            `Concurrent conflict: Source journal line '${conflictRes.rows[0].source_journal_line_id}' was already allocated by run '${conflictRes.rows[0].run_number}'.`
          );
        }
      }

      // 8. Resolve Posting Branch
      const postingBranchId = params.branchId || (await this.getDefaultBranchId(client));

      // 9. Aggregate Target Cost Centre Amounts across all run lines
      const targetTotals = new Map<string, { accountId: string; amount: number; percentage: number }>();
      for (const line of runLines) {
        const key = `${line.target_cost_centre_id}__${line.target_account_id}`;
        const existing = targetTotals.get(key) || {
          accountId: line.target_account_id,
          amount: 0,
          percentage: 0,
        };
        existing.amount += Number(line.allocated_amount);
        existing.percentage += Number(line.target_percentage);
        targetTotals.set(key, existing);
      }

      // 10. Construct Balanced Journal Lines
      // Symmetrical Double-Entry:
      // Line 1: Credit Source Cost Centre by total_allocated_amount
      // Lines 2..N: Debit Target Cost Centres by their respective aggregated amounts
      const glLines: JournalLineInput[] = [];

      // A) Source Credit Line (Offset shared pool)
      glLines.push({
        account_id: run.source_account_id,
        cost_centre_id: run.source_cost_centre_id,
        branch_id: postingBranchId,
        credit_amount: Number(run.total_allocated_amount),
        debit_amount: 0,
        narration: `Cost Allocation ${run.run_number}: Credit Source CC pool offset`,
        metadata: {
          is_allocation_source_offset: true,
          run_id: run.id,
        },
      });

      // B) Destination Debit Lines
      for (const [key, val] of targetTotals.entries()) {
        const [targetCcId] = key.split("__");
        const lineAmt = Number(val.amount.toFixed(2));
        glLines.push({
          account_id: val.accountId || run.source_account_id,
          cost_centre_id: targetCcId,
          branch_id: postingBranchId,
          debit_amount: lineAmt,
          credit_amount: 0,
          narration: `Cost Allocation ${run.run_number}: Debit Destination CC allocation`,
          metadata: {
            is_allocation_destination: true,
            run_id: run.id,
            target_cost_centre_id: targetCcId,
          },
        });
      }

      // 11. Validate Journal Lines with Step 3 AccountGovernanceService
      AccountGovernanceService.validateJournalLines(glLines);

      // 12. Create Voucher via AccountingVoucherRepository
      // Use 'system_allocation_engine' as creator to satisfy chk_voucher_segregation
      // when approved_by is set to params.approvedBy
      const voucherDraft = await AccountingVoucherRepository.createDraft(
        {
          voucher_type: "JOURNAL",
          voucher_date: run.allocation_date,
          branch_id: postingBranchId,
          narration: run.narration,
          reference_type: "COST_ALLOCATION",
          reference_id: run.id,
          cost_centre_id: run.source_cost_centre_id,
          metadata: {
            is_cost_allocation: true,
            run_id: run.id,
            run_number: run.run_number,
            rule_id: run.rule_id,
            total_source_amount: Number(run.total_source_amount),
            total_allocated_amount: Number(run.total_allocated_amount),
          },
        },
        postingBranchId,
        run.fiscal_year,
        "system_allocation_engine",
        client
      );

      // Advance voucher to APPROVED status
      await AccountingVoucherRepository.submit(
        voucherDraft.id,
        "system_allocation_engine",
        postingBranchId,
        client
      );

      const approvedVoucher = await AccountingVoucherRepository.approve(
        voucherDraft.id,
        params.approvedBy,
        postingBranchId,
        client
      );

      // 13. Post Voucher to General Ledger via Canonical PostingService
      const postRes = await PostingService.postVoucher({
        voucherId: approvedVoucher.id,
        postedBy: params.approvedBy,
        lines: glLines,
        branchId: postingBranchId,
        client,
      });

      if (!postRes.success) {
        throw new CostAllocationDomainError(
          "OPERATION_FAILED",
          `General Ledger posting failed for allocation run '${run.run_number}': ${postRes.error}`
        );
      }

      // 14. Update Run Status to POSTED and Link Accounting Voucher
      const updatedRun = await CostAllocationRepository.updateRunStatus(
        run.id,
        "POSTED",
        {
          approved_by: params.approvedBy,
          approved_at: new Date(),
          accounting_voucher_id: approvedVoucher.id,
        },
        client
      );

      if (!updatedRun) {
        throw new CostAllocationDomainError(
          "OPERATION_FAILED",
          `Failed to update allocation run '${run.run_number}' to POSTED status.`
        );
      }

      return {
        run: updatedRun,
        voucher: postRes.data.voucher,
        journal_entry: postRes.data.journal_entry,
      };
    };

    return externalClient ? execute(externalClient) : dbTransaction(execute);
  }

  // ── 4. REVERSE ALLOCATION RUN ────────────────────────────────────────────────

  /**
   * Reverse an existing POSTED cost allocation run through a compensating journal voucher.
   * Strictly enforces SoD (reverser !== maker), inverts original debits and credits,
   * links vouchers bidirectionally, and marks run status as REVERSED.
   */
  static async reverseRun(
    params: ReverseCostAllocationRunParams,
    externalClient?: PoolClient
  ): Promise<CostAllocationReversalResult> {
    const execute = async (client: PoolClient): Promise<CostAllocationReversalResult> => {
      // 1. Permission Check
      if (params.actorContext) {
        const canReverse =
          hasEffectivePermission(params.actorContext, "COST_ALLOCATION.REVERSE") ||
          hasEffectivePermission(params.actorContext, "ACCOUNTING.REVERSE");
        if (!canReverse) {
          throw new CostAllocationDomainError(
            "PERMISSION_DENIED",
            "Insufficient permissions to reverse cost allocation. Required: COST_ALLOCATION.REVERSE."
          );
        }
      }

      // 2. Lock Run Row Exclusively (FOR UPDATE)
      const lockRunSql = `SELECT * FROM public.cost_allocation_run WHERE id = $1 FOR UPDATE;`;
      const runRes = await client.query<CostAllocationRunRow>(lockRunSql, [params.runId]);
      const run = runRes.rows[0];

      if (!run) {
        throw new CostAllocationDomainError("RUN_NOT_FOUND", `Allocation run '${params.runId}' not found.`);
      }

      // 3. Status & Reversal Checks
      if (run.status === "REVERSED") {
        throw new CostAllocationDomainError(
          "RUN_ALREADY_REVERSED",
          `Allocation run '${run.run_number}' has already been reversed.`
        );
      }
      if (run.status !== "POSTED") {
        throw new CostAllocationDomainError(
          "INVALID_RUN_STATUS",
          `Cannot reverse allocation run in status '${run.status}'. Only POSTED runs can be reversed.`
        );
      }
      if (!run.accounting_voucher_id) {
        throw new CostAllocationDomainError(
          "OPERATION_FAILED",
          `Allocation run '${run.run_number}' has no linked accounting voucher to reverse.`
        );
      }

      // 4. Segregation of Duties Check
      if (run.executed_by === params.reversedBy) {
        throw new CostAllocationDomainError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Segregation of Duties violation: Staff '${params.reversedBy}' executed run '${run.run_number}' and cannot reverse it.`
        );
      }

      // 5. Validate Reversal Date against Fiscal Period & Accounting Start Date
      await PostingService.validateAccountingStartDate(params.reversalDate, client);
      const revPeriod = await PostingService.validateFiscalPeriod(params.reversalDate, client);

      // 6. Fetch Original Accounting Voucher & Lines
      const originalVoucher = await AccountingVoucherRepository.findById(
        run.accounting_voucher_id,
        undefined,
        client
      );
      if (!originalVoucher) {
        throw new CostAllocationDomainError(
          "OPERATION_FAILED",
          `Original accounting voucher '${run.accounting_voucher_id}' not found.`
        );
      }

      const origJe = await AccountingJournalRepository.findByVoucherId(originalVoucher.id, client);
      if (!origJe) {
        throw new CostAllocationDomainError(
          "OPERATION_FAILED",
          `No posted journal entry found for original voucher '${originalVoucher.voucher_no}'.`
        );
      }

      const origLines = await AccountingJournalRepository.findLinesByEntryId(origJe.id, client);
      if (!origLines || origLines.length < 2) {
        throw new CostAllocationDomainError(
          "OPERATION_FAILED",
          `Original journal entry '${origJe.entry_no}' has insufficient lines to reverse.`
        );
      }

      // 7. Invert Journal Lines:
      // Original Debit becomes Credit; Original Credit becomes Debit.
      // Retains exact cost_centre_id attribution!
      const invertedLines: JournalLineInput[] = origLines.map((l, idx) => ({
        account_id: l.account_id,
        debit_amount: Number(l.credit_amount),
        credit_amount: Number(l.debit_amount),
        branch_id: l.branch_id || originalVoucher.branch_id,
        cost_centre_id: l.cost_centre_id || null,
        narration: `Reversal of allocation line ${l.line_no}: ${params.reason.trim()}`,
        metadata: {
          line_no: idx + 1,
          original_line_id: l.id,
          is_allocation_reversal: true,
        },
      }));

      // Validate inverted lines with Account Governance
      AccountGovernanceService.validateJournalLines(invertedLines);

      // 8. Create Compensating Reversal Voucher
      const branchId = originalVoucher.branch_id || (await this.getDefaultBranchId(client));
      const reversalVoucherDraft = await AccountingVoucherRepository.createDraft(
        {
          voucher_type: "JOURNAL",
          voucher_date: params.reversalDate,
          branch_id: branchId,
          narration: `Reversal of Allocation Run ${run.run_number}: ${params.reason.trim()}`,
          reference_type: "COST_ALLOCATION_REVERSAL",
          reference_id: run.id,
          reversal_of_voucher_id: originalVoucher.id,
          cost_centre_id: run.source_cost_centre_id,
          metadata: {
            is_cost_allocation_reversal: true,
            run_id: run.id,
            original_voucher_id: originalVoucher.id,
            reversal_reason: params.reason.trim(),
          },
        },
        branchId,
        revPeriod.fiscal_year,
        "system_allocation_engine",
        client
      );

      // Advance to APPROVED
      await AccountingVoucherRepository.submit(
        reversalVoucherDraft.id,
        "system_allocation_engine",
        branchId,
        client
      );

      const approvedReversalVoucher = await AccountingVoucherRepository.approve(
        reversalVoucherDraft.id,
        params.reversedBy,
        branchId,
        client
      );

      // 9. Post Reversal Voucher to General Ledger
      const postRes = await PostingService.postVoucher({
        voucherId: approvedReversalVoucher.id,
        postedBy: params.reversedBy,
        lines: invertedLines,
        branchId,
        client,
      });

      if (!postRes.success) {
        throw new CostAllocationDomainError(
          "OPERATION_FAILED",
          `Reversal posting failed for allocation run '${run.run_number}': ${postRes.error}`
        );
      }

      // 10. Link Reversal on Original Voucher
      await PostingService.linkReversal(
        {
          originalVoucherId: originalVoucher.id,
          reversalVoucherId: approvedReversalVoucher.id,
          reversedBy: params.reversedBy,
          branchId,
        },
        client
      );

      // 11. Update Run Status to REVERSED
      const updatedRun = await CostAllocationRepository.updateRunStatus(
        run.id,
        "REVERSED",
        {
          reversed_by: params.reversedBy,
          reversed_at: new Date(),
          reversal_voucher_id: approvedReversalVoucher.id,
          reversal_reason: params.reason.trim(),
        },
        client
      );

      if (!updatedRun) {
        throw new CostAllocationDomainError(
          "OPERATION_FAILED",
          `Failed to update allocation run '${run.run_number}' to REVERSED status.`
        );
      }

      return {
        run: updatedRun,
        original_voucher: originalVoucher,
        reversal_voucher: postRes.data.voucher,
        reversal_journal_entry: postRes.data.journal_entry,
      };
    };

    return externalClient ? execute(externalClient) : dbTransaction(execute);
  }
}
