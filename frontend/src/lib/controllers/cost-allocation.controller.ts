/**
 * CakeToHome ERP — Cost Allocation API Controller
 * Phase C7.6 Step 4D: Exposes Cost Allocation rules and workflow via REST endpoints.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. STRICT AUTHENTICATION & RBAC:
 *    - All endpoints require an authoritative server-resolved staff session.
 *    - Least-privilege permissions enforced per action:
 *        VIEW, MANAGE_RULES, RUN_PREVIEW, EXECUTE, APPROVE, REVERSE
 * 2. SEGREGATION OF DUTIES (MAKER-CHECKER):
 *    - Zero bypass for Super Admin or any privileged role.
 *    - Maker (executed_by) cannot approve (approved_by) or reverse (reversed_by) their own run.
 * 3. SERVER-AUTHORITATIVE AUDIT & AMOUNTS:
 *    - executed_by, approved_by, reversed_by, amounts, and vouchers are NEVER accepted from client.
 * 4. FINANCIAL LEDGER INTEGRITY:
 *    - Zero direct SQL mutations to ledger tables; all postings route through canonical domain services.
 *    - Preview dry-runs execute with 0 database writes.
 * 5. BOLA & BRANCH SCOPE DEFENSE:
 *    - Corporate allocations require corporate finance authority.
 */

import { NextRequest, NextResponse } from "next/server";
import { StaffAccessControl } from "../staff-access-control";
import { CostAllocationRepository } from "../repositories/cost-allocation.repository";
import { CostCentreRepository } from "../repositories/cost-centre.repository";
import { CostAllocationWorkflowService } from "../services/cost-allocation-workflow.service";
import {
  CostAllocationDomainError,
  type CreateCostAllocationRuleInput,
  type UpdateCostAllocationRuleInput,
  type CostAllocationRuleTargetInput,
} from "../types/accounting.types";

interface UserContext {
  userId: string;
  role: string;
  phone?: string;
  branchId?: string | null;
  partnerId?: string | null;
  permissions?: string[];
  isSuperAdmin: boolean;
}

/**
 * Standardized Cost Allocation Error Mapper
 */
export function handleCostAllocationError(err: any): NextResponse {
  let code = err?.code || (err instanceof CostAllocationDomainError ? err.code : null);
  let message = err?.message || "An unexpected error occurred.";

  // Handle PostgreSQL unique constraint violations
  if (err?.code === "23505" || err?.detail?.includes("already exists")) {
    code = "DUPLICATE_RULE_CODE";
    message = "A rule or record with this unique code already exists.";
  }

  if (code) {
    let status = 400;
    switch (code) {
      case "UNAUTHORIZED":
        status = 401;
        break;
      case "FORBIDDEN":
      case "PERMISSION_DENIED":
      case "BRANCH_ACCESS_DENIED":
      case "SEGREGATION_OF_DUTIES_VIOLATION":
        status = 403;
        break;
      case "RULE_NOT_FOUND":
      case "RUN_NOT_FOUND":
      case "TARGET_NOT_FOUND":
      case "SOURCE_ACCOUNT_NOT_FOUND":
      case "SOURCE_COST_CENTRE_NOT_FOUND":
      case "TARGET_COST_CENTRE_NOT_FOUND":
      case "NOT_FOUND":
        status = 404;
        break;
      case "DUPLICATE_RULE_CODE":
      case "DUPLICATE_RUN_NUMBER":
      case "SOURCE_LINE_ALREADY_ALLOCATED":
      case "RUN_ALREADY_POSTED":
      case "RUN_ALREADY_REVERSED":
      case "CONCURRENT_ALLOCATION_CONFLICT":
        status = 409;
        break;
      case "POSTING_BEFORE_ACCOUNTING_START_DATE":
      case "FISCAL_PERIOD_NOT_CONFIGURED":
      case "FISCAL_PERIOD_LOCKED":
        status = 422;
        break;
      default:
        status = 400;
        break;
    }
    return NextResponse.json({ success: false, error: code, message }, { status });
  }

  // Fallback for internal errors: never disclose call stack or secrets
  console.error("[CostAllocationController Error]", err);
  return NextResponse.json(
    {
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: "An internal server error occurred while processing the cost allocation request.",
    },
    { status: 500 }
  );
}

/**
 * Helper to normalize route subpath
 */
function normalizeSubPath(path: string): string {
  let sub = path;
  if (sub.startsWith("admin/accounting/cost-allocations")) {
    sub = sub.replace("admin/accounting/cost-allocations", "");
  } else if (sub.startsWith("admin/cost-allocations")) {
    sub = sub.replace("admin/cost-allocations", "");
  }
  if (!sub.startsWith("/")) {
    sub = "/" + sub;
  }
  // Strip trailing slash if any
  if (sub.length > 1 && sub.endsWith("/")) {
    sub = sub.slice(0, -1);
  }
  return sub;
}

/**
 * Verifies staff authentication
 */
function assertAuthenticated(userCtx: UserContext): void {
  if (!userCtx || (!userCtx.userId && !userCtx.role)) {
    throw new CostAllocationDomainError("UNAUTHORIZED", "Authentication required.", 401);
  }
}

/**
 * Verifies staff feature permission
 */
function assertPermission(userCtx: UserContext, action: string): void {
  assertAuthenticated(userCtx);
  const hasPerm =
    userCtx.isSuperAdmin ||
    StaffAccessControl.hasPermission(userCtx, "COST_ALLOCATION", action);

  if (!hasPerm) {
    throw new CostAllocationDomainError(
      "FORBIDDEN",
      `Forbidden: Account lacks COST_ALLOCATION.${action} permission.`,
      403
    );
  }
}

/**
 * BOLA / Branch Scoping: Corporate cost allocations require corporate finance scope
 */
function assertCorporateScope(userCtx: UserContext): void {
  assertAuthenticated(userCtx);
  if (!userCtx.isSuperAdmin && userCtx.branchId) {
    throw new CostAllocationDomainError(
      "BRANCH_ACCESS_DENIED",
      "Forbidden: Corporate cost allocation operations cannot be executed from a branch-restricted account.",
      403
    );
  }
}

export class CostAllocationController {
  // ─── GET DISPATCHER ────────────────────────────────────────────────────────
  static async handleGet(
    req: NextRequest,
    path: string,
    userCtx: UserContext
  ): Promise<NextResponse> {
    try {
      assertAuthenticated(userCtx);
      assertPermission(userCtx, "VIEW");

      const subPath = normalizeSubPath(path);
      const url = new URL(req.url);

      // 1. GET /rules
      if (subPath === "/rules") {
        const isActiveParam = url.searchParams.get("is_active");
        const is_active =
          isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
        const include_deleted = url.searchParams.get("include_deleted") === "true";
        const rule_type = (url.searchParams.get("rule_type") as any) || undefined;
        const source_cost_centre_id = url.searchParams.get("source_cost_centre_id") || undefined;
        const effective_date =
          url.searchParams.get("effective_date") || url.searchParams.get("date") || undefined;
        const search = url.searchParams.get("search") || undefined;
        const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
        const limit = Math.max(1, Math.min(100, isNaN(limitParam) ? 50 : limitParam));

        const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
        const offsetParam = url.searchParams.get("offset");
        const offset =
          offsetParam !== null
            ? Math.max(0, parseInt(offsetParam, 10) || 0)
            : Math.max(0, (pageParam - 1) * limit);

        const result = await CostAllocationRepository.listRules({
          is_active,
          include_deleted,
          rule_type,
          source_cost_centre_id,
          effective_date,
          search,
          limit,
          offset,
        });

        return NextResponse.json({ success: true, data: result }, { status: 200 });
      }

      // 2. GET /rules/:id
      const ruleDetailMatch = subPath.match(/^\/rules\/([^/]+)$/);
      if (ruleDetailMatch) {
        const ruleId = ruleDetailMatch[1];
        const rule = await CostAllocationRepository.findRuleById(ruleId);
        if (!rule) {
          throw new CostAllocationDomainError(
            "RULE_NOT_FOUND",
            `Allocation rule '${ruleId}' not found.`,
            404
          );
        }
        return NextResponse.json({ success: true, data: rule }, { status: 200 });
      }

      // 3. GET /runs
      if (subPath === "/runs") {
        const status = (url.searchParams.get("status") as any) || undefined;
        const rule_id = url.searchParams.get("rule_id") || undefined;
        const source_cost_centre_id = url.searchParams.get("source_cost_centre_id") || undefined;
        const fiscal_year = url.searchParams.get("fiscal_year") || undefined;
        const period_name =
          url.searchParams.get("period_name") || url.searchParams.get("fiscal_period") || undefined;
        const from_date = url.searchParams.get("from_date") || undefined;
        const to_date = url.searchParams.get("to_date") || undefined;
        const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
        const limit = Math.max(1, Math.min(100, isNaN(limitParam) ? 50 : limitParam));

        const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
        const offsetParam = url.searchParams.get("offset");
        const offset =
          offsetParam !== null
            ? Math.max(0, parseInt(offsetParam, 10) || 0)
            : Math.max(0, (pageParam - 1) * limit);

        const result = await CostAllocationRepository.listRuns({
          status,
          rule_id,
          source_cost_centre_id,
          fiscal_year,
          period_name,
          from_date,
          to_date,
          limit,
          offset,
        });

        return NextResponse.json({ success: true, data: result }, { status: 200 });
      }

      // 4. GET /runs/:id
      const runDetailMatch = subPath.match(/^\/runs\/([^/]+)$/);
      if (runDetailMatch) {
        const runId = runDetailMatch[1];
        const run = await CostAllocationRepository.findRunById(runId);
        if (!run) {
          throw new CostAllocationDomainError(
            "RUN_NOT_FOUND",
            `Allocation run '${runId}' not found.`,
            404
          );
        }
        const lines = await CostAllocationRepository.findRunLines(runId);
        return NextResponse.json({ success: true, data: { ...run, lines } }, { status: 200 });
      }

      // 5. GET /cost-centres (helper for UI dropdowns)
      if (subPath === "/cost-centres") {
        const costCentres = await CostCentreRepository.list({
          is_active: true,
          limit: 100,
        });
        return NextResponse.json({ success: true, data: costCentres }, { status: 200 });
      }

      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: `Unknown cost allocation endpoint: ${path}` },
        { status: 404 }
      );
    } catch (err) {
      return handleCostAllocationError(err);
    }
  }

  // ─── POST DISPATCHER ───────────────────────────────────────────────────────
  static async handlePost(
    req: NextRequest,
    path: string,
    userCtx: UserContext,
    body: any
  ): Promise<NextResponse> {
    try {
      assertAuthenticated(userCtx);
      const subPath = normalizeSubPath(path);

      // 1. POST /preview
      if (subPath === "/preview") {
        assertPermission(userCtx, "RUN_PREVIEW");

        const ruleId = body?.rule_id || body?.ruleId;
        const allocationDate = body?.allocation_date || body?.allocationDate;

        if (!ruleId || typeof ruleId !== "string") {
          throw new CostAllocationDomainError("VALIDATION_FAILED", "rule_id is required.", 400);
        }
        if (!allocationDate) {
          throw new CostAllocationDomainError("VALIDATION_FAILED", "allocation_date is required.", 400);
        }

        const preview = await CostAllocationWorkflowService.previewAllocation({
          ruleId,
          allocationDate,
          fiscalYear: body?.fiscal_year || body?.fiscalYear,
          periodName: body?.period_name || body?.periodName,
          sourceJournalLineIds: body?.source_journal_line_ids || body?.sourceJournalLineIds,
          actorContext: userCtx,
        });

        return NextResponse.json({ success: true, data: preview }, { status: 200 });
      }

      // 2. POST /rules
      if (subPath === "/rules") {
        assertPermission(userCtx, "MANAGE_RULES");
        assertCorporateScope(userCtx);

        if (!body?.rule_code || typeof body.rule_code !== "string" || !body.rule_code.trim()) {
          throw new CostAllocationDomainError("VALIDATION_FAILED", "rule_code is required.", 400);
        }
        if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
          throw new CostAllocationDomainError("VALIDATION_FAILED", "name is required.", 400);
        }
        if (body?.rule_type && body.rule_type !== "FIXED_PERCENTAGE") {
          throw new CostAllocationDomainError(
            "RULE_TYPE_NOT_SUPPORTED",
            `Rule type '${body.rule_type}' is unauthorized. Only FIXED_PERCENTAGE is supported.`,
            400
          );
        }
        if (!body?.source_cost_centre_id) {
          throw new CostAllocationDomainError(
            "VALIDATION_FAILED",
            "source_cost_centre_id is required.",
            400
          );
        }
        if (!body?.source_account_id) {
          throw new CostAllocationDomainError("VALIDATION_FAILED", "source_account_id is required.", 400);
        }
        if (!body?.effective_from) {
          throw new CostAllocationDomainError("VALIDATION_FAILED", "effective_from is required.", 400);
        }
        if (body?.effective_to && new Date(body.effective_to) < new Date(body.effective_from)) {
          throw new CostAllocationDomainError(
            "VALIDATION_FAILED",
            "effective_to cannot be prior to effective_from.",
            400
          );
        }
        if (!Array.isArray(body?.targets) || body.targets.length === 0) {
          throw new CostAllocationDomainError(
            "NO_TARGETS_CONFIGURED",
            "At least one target is required.",
            400
          );
        }

        // Validate percentage sum
        const totalPercentage = body.targets.reduce(
          (sum: number, t: any) => sum + (parseFloat(t.percentage) || 0),
          0
        );
        if (Math.abs(totalPercentage - 100.0) > 0.0001) {
          throw new CostAllocationDomainError(
            "PERCENTAGE_SUM_INVALID",
            `Target percentages must sum exactly to 100.00%. Current sum: ${totalPercentage.toFixed(2)}%.`,
            400
          );
        }

        const input: CreateCostAllocationRuleInput = {
          rule_code: body.rule_code.trim().toUpperCase(),
          name: body.name.trim(),
          description: body.description?.trim() || undefined,
          rule_type: "FIXED_PERCENTAGE",
          source_cost_centre_id: body.source_cost_centre_id,
          source_account_id: body.source_account_id,
          is_active: body.is_active ?? true,
          effective_from: body.effective_from,
          effective_to: body.effective_to || undefined,
          metadata: body.metadata || {},
          targets: body.targets.map((t: any, idx: number) => ({
            target_cost_centre_id: t.target_cost_centre_id,
            target_account_id: t.target_account_id || undefined,
            percentage: parseFloat(t.percentage),
            sort_order: t.sort_order ?? idx,
            notes: t.notes || undefined,
          })),
        };

        const createdRule = await CostAllocationRepository.createRule(input, userCtx.userId);
        return NextResponse.json({ success: true, data: createdRule }, { status: 201 });
      }

      // 3. POST /rules/:id/activate
      const activateMatch = subPath.match(/^\/rules\/([^/]+)\/activate$/);
      if (activateMatch) {
        assertPermission(userCtx, "MANAGE_RULES");
        assertCorporateScope(userCtx);

        const ruleId = activateMatch[1];
        const activated = await CostAllocationRepository.updateRule(ruleId, { is_active: true });
        if (!activated) {
          throw new CostAllocationDomainError(
            "RULE_NOT_FOUND",
            `Allocation rule '${ruleId}' not found.`,
            404
          );
        }
        return NextResponse.json({ success: true, data: activated }, { status: 200 });
      }

      // 4. POST /rules/:id/deactivate
      const deactivateMatch = subPath.match(/^\/rules\/([^/]+)\/deactivate$/);
      if (deactivateMatch) {
        assertPermission(userCtx, "MANAGE_RULES");
        assertCorporateScope(userCtx);

        const ruleId = deactivateMatch[1];
        const deactivated = await CostAllocationRepository.deactivateRule(ruleId);
        if (!deactivated) {
          throw new CostAllocationDomainError(
            "RULE_NOT_FOUND",
            `Allocation rule '${ruleId}' not found.`,
            404
          );
        }
        return NextResponse.json({ success: true, data: deactivated }, { status: 200 });
      }

      // 5. POST /runs
      if (subPath === "/runs") {
        assertPermission(userCtx, "EXECUTE");
        assertCorporateScope(userCtx);

        const ruleId = body?.rule_id || body?.ruleId;
        const allocationDate = body?.allocation_date || body?.allocationDate;

        if (!ruleId || typeof ruleId !== "string") {
          throw new CostAllocationDomainError("VALIDATION_FAILED", "rule_id is required.", 400);
        }
        if (!allocationDate) {
          throw new CostAllocationDomainError("VALIDATION_FAILED", "allocation_date is required.", 400);
        }

        // Server-authoritative actor: ignore client-provided executed_by or approved_by
        const runResult = await CostAllocationWorkflowService.executeAllocationRun({
          ruleId,
          allocationDate,
          fiscalYear: body?.fiscal_year || body?.fiscalYear,
          periodName: body?.period_name || body?.periodName,
          narration: body?.narration,
          sourceJournalLineIds: body?.source_journal_line_ids || body?.sourceJournalLineIds,
          executedBy: userCtx.userId,
          status: "SUBMITTED",
          actorContext: userCtx,
        });

        return NextResponse.json({ success: true, data: runResult }, { status: 201 });
      }

      // 6. POST /runs/:id/submit
      const submitMatch = subPath.match(/^\/runs\/([^/]+)\/submit$/);
      if (submitMatch) {
        assertPermission(userCtx, "EXECUTE");
        assertCorporateScope(userCtx);

        const runId = submitMatch[1];
        const run = await CostAllocationRepository.findRunById(runId);
        if (!run) {
          throw new CostAllocationDomainError(
            "RUN_NOT_FOUND",
            `Allocation run '${runId}' not found.`,
            404
          );
        }

        if (run.status === "SUBMITTED") {
          return NextResponse.json(
            { success: true, data: run, message: "Run is already in SUBMITTED status." },
            { status: 200 }
          );
        }

        if (run.status === "POSTED" || run.status === "REVERSED") {
          throw new CostAllocationDomainError(
            "INVALID_RUN_STATE",
            `Cannot submit run in '${run.status}' state.`,
            409
          );
        }

        const updated = await CostAllocationRepository.updateRunStatus(runId, "SUBMITTED");

        return NextResponse.json({ success: true, data: updated }, { status: 200 });
      }

      // 7. POST /runs/:id/approve
      const approveMatch = subPath.match(/^\/runs\/([^/]+)\/approve$/);
      if (approveMatch) {
        assertPermission(userCtx, "APPROVE");
        assertCorporateScope(userCtx);

        const runId = approveMatch[1];
        // Server-authoritative approver: ignore client-provided approved_by
        const result = await CostAllocationWorkflowService.approveAndPostRun({
          runId,
          approvedBy: userCtx.userId,
          branchId: userCtx.branchId || undefined,
          actorContext: userCtx,
        });

        return NextResponse.json({ success: true, data: result }, { status: 200 });
      }

      // 8. POST /runs/:id/reverse
      const reverseMatch = subPath.match(/^\/runs\/([^/]+)\/reverse$/);
      if (reverseMatch) {
        assertPermission(userCtx, "REVERSE");
        assertCorporateScope(userCtx);

        const runId = reverseMatch[1];
        const reason = body?.reason || body?.reversal_reason;
        if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
          throw new CostAllocationDomainError(
            "VALIDATION_FAILED",
            "A meaningful reversal reason of at least 5 characters is required.",
            400
          );
        }

        const reversalDate =
          body?.reversal_date || body?.reversalDate || new Date().toISOString().slice(0, 10);

        // Server-authoritative reverser: ignore client-provided reversed_by
        const result = await CostAllocationWorkflowService.reverseRun({
          runId,
          reversedBy: userCtx.userId,
          reason: reason.trim(),
          reversalDate,
          branchId: userCtx.branchId || undefined,
          actorContext: userCtx,
        });

        return NextResponse.json({ success: true, data: result }, { status: 200 });
      }

      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: `Unknown cost allocation endpoint: ${path}` },
        { status: 404 }
      );
    } catch (err) {
      return handleCostAllocationError(err);
    }
  }

  // ─── PUT DISPATCHER ────────────────────────────────────────────────────────
  static async handlePut(
    req: NextRequest,
    path: string,
    userCtx: UserContext,
    body: any
  ): Promise<NextResponse> {
    try {
      assertAuthenticated(userCtx);
      assertPermission(userCtx, "MANAGE_RULES");
      assertCorporateScope(userCtx);

      const subPath = normalizeSubPath(path);

      // 1. PUT /rules/:id/targets
      const targetsMatch = subPath.match(/^\/rules\/([^/]+)\/targets$/);
      if (targetsMatch) {
        const ruleId = targetsMatch[1];
        const existingRule = await CostAllocationRepository.findRuleById(ruleId);
        if (!existingRule) {
          throw new CostAllocationDomainError(
            "RULE_NOT_FOUND",
            `Allocation rule '${ruleId}' not found.`,
            404
          );
        }

        if (!Array.isArray(body?.targets) || body.targets.length === 0) {
          throw new CostAllocationDomainError(
            "NO_TARGETS_CONFIGURED",
            "At least one target is required.",
            400
          );
        }

        const totalPercentage = body.targets.reduce(
          (sum: number, t: any) => sum + (parseFloat(t.percentage) || 0),
          0
        );
        if (Math.abs(totalPercentage - 100.0) > 0.0001) {
          throw new CostAllocationDomainError(
            "PERCENTAGE_SUM_INVALID",
            `Target percentages must sum exactly to 100.00%. Current sum: ${totalPercentage.toFixed(2)}%.`,
            400
          );
        }

        const formattedTargets: CostAllocationRuleTargetInput[] = body.targets.map(
          (t: any, idx: number) => ({
            target_cost_centre_id: t.target_cost_centre_id,
            target_account_id: t.target_account_id || undefined,
            percentage: parseFloat(t.percentage),
            sort_order: t.sort_order ?? idx,
            notes: t.notes || undefined,
          })
        );

        const updatedTargets = await CostAllocationRepository.replaceRuleTargets(
          ruleId,
          formattedTargets
        );

        return NextResponse.json({ success: true, data: updatedTargets }, { status: 200 });
      }

      // 2. PUT /rules/:id
      const ruleMatch = subPath.match(/^\/rules\/([^/]+)$/);
      if (ruleMatch) {
        const ruleId = ruleMatch[1];
        if (body?.effective_from && body?.effective_to) {
          if (new Date(body.effective_to) < new Date(body.effective_from)) {
            throw new CostAllocationDomainError(
              "VALIDATION_FAILED",
              "effective_to cannot be prior to effective_from.",
              400
            );
          }
        }

        const updateInput: UpdateCostAllocationRuleInput = {
          name: body?.name?.trim() || undefined,
          description:
            body?.description !== undefined ? body.description?.trim() || null : undefined,
          effective_from: body?.effective_from || undefined,
          effective_to: body?.effective_to !== undefined ? body.effective_to || null : undefined,
          is_active: body?.is_active !== undefined ? Boolean(body.is_active) : undefined,
          metadata: body?.metadata || undefined,
        };

        const updated = await CostAllocationRepository.updateRule(ruleId, updateInput);
        if (!updated) {
          throw new CostAllocationDomainError(
            "RULE_NOT_FOUND",
            `Allocation rule '${ruleId}' not found.`,
            404
          );
        }

        return NextResponse.json({ success: true, data: updated }, { status: 200 });
      }

      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: `Unknown cost allocation endpoint: ${path}` },
        { status: 404 }
      );
    } catch (err) {
      return handleCostAllocationError(err);
    }
  }

  // ─── DELETE DISPATCHER ─────────────────────────────────────────────────────
  static async handleDelete(
    req: NextRequest,
    path: string,
    userCtx: UserContext
  ): Promise<NextResponse> {
    try {
      assertAuthenticated(userCtx);
      assertPermission(userCtx, "MANAGE_RULES");
      assertCorporateScope(userCtx);

      const subPath = normalizeSubPath(path);

      // DELETE /rules/:id
      const ruleMatch = subPath.match(/^\/rules\/([^/]+)$/);
      if (ruleMatch) {
        const ruleId = ruleMatch[1];
        const deleted = await CostAllocationRepository.softDeleteRule(ruleId);
        if (!deleted) {
          throw new CostAllocationDomainError(
            "RULE_NOT_FOUND",
            `Allocation rule '${ruleId}' not found.`,
            404
          );
        }
        return NextResponse.json(
          { success: true, data: deleted, message: `Rule '${ruleId}' soft-deleted.` },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: false, error: "NOT_FOUND", message: `Unknown cost allocation endpoint: ${path}` },
        { status: 404 }
      );
    } catch (err) {
      return handleCostAllocationError(err);
    }
  }
}
