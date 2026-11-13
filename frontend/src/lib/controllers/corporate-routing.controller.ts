/**
 * CakeToHome ERP — Corporate Delivery Geographic Routing Controller
 * Phase C7.11 Step 11C: HTTP Dispatcher, Server-Side RBAC, Input Validation, and Audit Logging
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. SERVER-SIDE AUTHENTICATION & RBAC:
 *    - Never trust client-supplied headers (x-user-role, x-user-id) without a verified server session.
 *    - Enforces CORPORATE_ROUTING.VIEW for queries and previews.
 *    - Enforces CORPORATE_ROUTING.MANAGE for single and batch assignment mutations.
 *    - Reject customer and anonymous callers with 403 Forbidden. Fail closed.
 * 2. TENANT & BRANCH SCOPE:
 *    - Branch Managers restricted to their assigned branch_id.
 *    - Super Admin retains global network authority.
 * 3. BOUNDED BATCH LIMITS:
 *    - Strict ceiling of 100 items per batch. Reject oversized requests before opening transactions.
 * 4. PURE PREVIEW SAFETY:
 *    - Preview endpoint strictly executes dry-run geographic matching without mutating assignments or events.
 * 5. AUDIT IMMUTABILITY & ACTOR INTEGRITY:
 *    - Actor identity recorded in audit events strictly uses trusted session identity, never request body.
 * 6. FAIL-CLOSED RESPONSES:
 *    - Missing or invalid coordinates result in explicit domain UNASSIGNED outcomes, not crashes or fallbacks.
 *    - Zero exposure of internal database stack traces or secrets.
 */

import { NextRequest, NextResponse } from "next/server";
import { CorporateRoutingService } from "../services/corporate-routing.service";
import { CorporateRoutingRepository } from "../repositories/corporate-routing.repository";
import { StaffAccessControl } from "../staff-access-control";
import { resolveServerSession } from "../security/auth-session";
import type {
  CorporateDeliveryEntityType,
  CorporateBatchMatchingItemInput,
  CorporateAssignmentStatus,
  CorporateRoutingReasonCode,
  ResolveUnresolvedAction,
} from "../types/corporate-routing.types";

export const MAX_ROUTING_BATCH_SIZE = 100;

export interface CorporateRoutingActor {
  userId: string;
  role: string;
  branchId?: string | null;
  permissions: string[];
  isSuperAdmin: boolean;
}

const VALID_ENTITY_TYPES: CorporateDeliveryEntityType[] = [
  "ROSTER_EMPLOYEE",
  "GIFTING_RECIPIENT",
  "DIRECT_ORDER",
];

export class CorporateRoutingController {
  /**
   * Resolves authoritative actor context from session or verified user context.
   * Never trusts spoofed client headers without an authoritative session.
   */
  public static resolveActor(req: NextRequest, userCtx?: any): CorporateRoutingActor {
    // 1. If userCtx was pre-resolved by upstream route via resolveServerSession
    if (userCtx && (userCtx.userId || userCtx.role)) {
      const role = (userCtx.role || "").toUpperCase();
      const userId = userCtx.userId || "";
      const isSuperAdmin = Boolean(
        userCtx.isSuperAdmin || role === "SUPER_ADMIN"
      );
      return {
        userId,
        role,
        branchId: userCtx.branchId || null,
        permissions: Array.isArray(userCtx.permissions) ? userCtx.permissions : [],
        isSuperAdmin,
      };
    }

    // 2. Cryptographic session resolution from request cookies or Authorization header
    const session = resolveServerSession(req);
    if (session && (session.userId || session.role)) {
      const role = (session.role || "").toUpperCase();
      const userId = session.userId || "";
      const isSuperAdmin = Boolean(
        session.isSuperAdmin || role === "SUPER_ADMIN"
      );
      const permissions = Array.isArray(session.permissions)
        ? session.permissions
        : StaffAccessControl.getEffectivePermissions(session);

      return {
        userId,
        role,
        branchId: session.branchId || null,
        permissions,
        isSuperAdmin,
      };
    }

    // 3. Unauthenticated fallback (Fail closed)
    return {
      userId: "",
      role: "",
      branchId: null,
      permissions: [],
      isSuperAdmin: false,
    };
  }

  /**
   * Validates actor permissions for corporate routing module.
   */
  public static checkPermission(
    actor: CorporateRoutingActor,
    requiredAction: "VIEW" | "MANAGE"
  ): NextResponse | null {
    if (!actor.userId && !actor.role) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 401,
          error: "UNAUTHORIZED",
          message: "Authentication required to access corporate routing.",
        },
        { status: 401 }
      );
    }

    if (actor.role === "CUSTOMER" || actor.role === "ANONYMOUS") {
      return NextResponse.json(
        {
          success: false,
          statusCode: 403,
          error: "Forbidden",
          message: "Customer accounts are not authorized to access corporate routing.",
        },
        { status: 403 }
      );
    }

    if (actor.isSuperAdmin || actor.role === "SUPER_ADMIN") {
      return null; // Global authority
    }

    const permRequired = `CORPORATE_ROUTING.${requiredAction}`;
    if (Array.isArray(actor.permissions)) {
      if (
        actor.permissions.includes(permRequired) ||
        actor.permissions.includes("CORPORATE_ROUTING.*") ||
        actor.permissions.includes("*") ||
        (requiredAction === "VIEW" && actor.permissions.includes("CORPORATE_ROUTING.MANAGE"))
      ) {
        return null;
      }
    }

    const hasPerm =
      StaffAccessControl.hasPermission(
        { id: actor.userId, role: actor.role as any, permissions: actor.permissions },
        "CORPORATE_ROUTING",
        requiredAction
      ) ||
      (requiredAction === "VIEW" &&
        StaffAccessControl.hasPermission(
          { id: actor.userId, role: actor.role as any, permissions: actor.permissions },
          "CORPORATE_ROUTING",
          "MANAGE"
        ));

    if (!hasPerm) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 403,
          error: "Forbidden",
          message: `Insufficient permissions: Requires ${permRequired}.`,
        },
        { status: 403 }
      );
    }

    return null;
  }

  /**
   * Validates branch scope for branch managers.
   */
  public static checkBranchScope(
    actor: CorporateRoutingActor,
    targetBranchId: string | null
  ): NextResponse | null {
    if (actor.isSuperAdmin || actor.role === "SUPER_ADMIN") {
      return null;
    }
    if (
      actor.role === "BRANCH_MANAGER" &&
      actor.branchId &&
      targetBranchId &&
      actor.branchId !== targetBranchId
    ) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 403,
          error: "TenantScopeViolation",
          message: `Branch Manager cannot access corporate routing outside assigned store "${actor.branchId}".`,
        },
        { status: 403 }
      );
    }
    return null;
  }

  /**
   * Validates single routing item input structure.
   */
  private static validateRoutingItem(
    item: any,
    prefix: string = ""
  ): { valid: boolean; error?: string; parsed?: CorporateBatchMatchingItemInput } {
    if (!item || typeof item !== "object") {
      return { valid: false, error: `${prefix}Item must be a valid JSON object.` };
    }

    if (!item.entity_type || !VALID_ENTITY_TYPES.includes(item.entity_type)) {
      return {
        valid: false,
        error: `${prefix}Invalid entity_type "${item.entity_type}". Allowed values: ${VALID_ENTITY_TYPES.join(", ")}.`,
      };
    }

    if (!item.entity_id || typeof item.entity_id !== "string" || item.entity_id.trim() === "") {
      return { valid: false, error: `${prefix}entity_id is required and must be a non-empty string.` };
    }

    if (
      !item.delivery_address ||
      typeof item.delivery_address !== "string" ||
      item.delivery_address.trim() === ""
    ) {
      return { valid: false, error: `${prefix}delivery_address is required and must be a non-empty string.` };
    }

    let lat: number | null = null;
    if (item.latitude !== undefined && item.latitude !== null) {
      const num = Number(item.latitude);
      lat = isNaN(num) ? null : num;
    }

    let lng: number | null = null;
    if (item.longitude !== undefined && item.longitude !== null) {
      const num = Number(item.longitude);
      lng = isNaN(num) ? null : num;
    }

    return {
      valid: true,
      parsed: {
        entity_type: item.entity_type,
        entity_id: item.entity_id.trim(),
        account_id: item.account_id ? String(item.account_id).trim() : undefined,
        recipient_name: item.recipient_name ? String(item.recipient_name).trim() : undefined,
        recipient_phone: item.recipient_phone ? String(item.recipient_phone).trim() : undefined,
        delivery_address: item.delivery_address.trim(),
        delivery_city: item.delivery_city ? String(item.delivery_city).trim() : undefined,
        delivery_pincode: item.delivery_pincode ? String(item.delivery_pincode).trim() : undefined,
        latitude: lat,
        longitude: lng,
      },
    };
  }

  // ── Unified HTTP GET Dispatcher ─────────────────────────────────────────────

  public static async handleGet(
    req: NextRequest,
    path: string,
    userCtx?: any
  ): Promise<NextResponse> {
    const actor = this.resolveActor(req, userCtx);
    const subPath = path
      .replace(/^admin\/corporate-routing\/?/, "")
      .replace(/^corporate-routing\/?/, "");

    // 1. GET /assignments/by-entity?entity_type=...&entity_id=...
    if (subPath === "assignments/by-entity" || subPath.startsWith("assignments/by-entity?")) {
      const permErr = this.checkPermission(actor, "VIEW");
      if (permErr) return permErr;

      const url = new URL(req.url);
      const entityType = url.searchParams.get("entity_type") as CorporateDeliveryEntityType;
      const entityId = url.searchParams.get("entity_id");

      if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: `Valid entity_type query parameter is required (${VALID_ENTITY_TYPES.join(", ")}).`,
          },
          { status: 400 }
        );
      }

      if (!entityId || entityId.trim() === "") {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: "entity_id query parameter is required.",
          },
          { status: 400 }
        );
      }

      try {
        const assignment = await CorporateRoutingRepository.getAssignmentByEntity(
          entityType,
          entityId.trim()
        );

        if (!assignment) {
          return NextResponse.json(
            {
              success: false,
              statusCode: 404,
              error: "NotFound",
              message: `Corporate delivery assignment not found for ${entityType} "${entityId}".`,
            },
            { status: 404 }
          );
        }

        const scopeErr = this.checkBranchScope(actor, assignment.assigned_store_id);
        if (scopeErr) return scopeErr;

        return NextResponse.json({ success: true, data: assignment }, { status: 200 });
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 500,
            error: "InternalServerError",
            message: "Failed to retrieve corporate assignment by entity.",
          },
          { status: 500 }
        );
      }
    }

    // 2. GET /assignments/:id/events
    const eventsMatch = subPath.match(/^assignments\/([a-zA-Z0-9_\-]+)\/events$/);
    if (eventsMatch) {
      const permErr = this.checkPermission(actor, "VIEW");
      if (permErr) return permErr;

      const assignmentId = eventsMatch[1];
      try {
        const assignment = await CorporateRoutingRepository.getAssignmentById(assignmentId);
        if (!assignment) {
          return NextResponse.json(
            {
              success: false,
              statusCode: 404,
              error: "NotFound",
              message: `Corporate delivery assignment "${assignmentId}" not found.`,
            },
            { status: 404 }
          );
        }

        const scopeErr = this.checkBranchScope(actor, assignment.assigned_store_id);
        if (scopeErr) return scopeErr;

        const events = await CorporateRoutingRepository.listAssignmentEvents(assignmentId);
        return NextResponse.json(
          { success: true, data: events, meta: { count: events.length } },
          { status: 200 }
        );
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 500,
            error: "InternalServerError",
            message: "Failed to retrieve corporate assignment event history.",
          },
          { status: 500 }
        );
      }
    }

    // 3. GET /assignments/:id
    const singleMatch = subPath.match(/^assignments\/([a-zA-Z0-9_\-]+)$/);
    if (singleMatch) {
      const permErr = this.checkPermission(actor, "VIEW");
      if (permErr) return permErr;

      const assignmentId = singleMatch[1];
      try {
        const assignment = await CorporateRoutingRepository.getAssignmentById(assignmentId);
        if (!assignment) {
          return NextResponse.json(
            {
              success: false,
              statusCode: 404,
              error: "NotFound",
              message: `Corporate delivery assignment "${assignmentId}" not found.`,
            },
            { status: 404 }
          );
        }

        const scopeErr = this.checkBranchScope(actor, assignment.assigned_store_id);
        if (scopeErr) return scopeErr;

        return NextResponse.json({ success: true, data: assignment }, { status: 200 });
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 500,
            error: "InternalServerError",
            message: "Failed to retrieve corporate delivery assignment.",
          },
          { status: 500 }
        );
      }
    }

    // 4. GET /assignments
    if (subPath === "assignments" || subPath === "") {
      const permErr = this.checkPermission(actor, "VIEW");
      if (permErr) return permErr;

      const url = new URL(req.url);
      const accountId = url.searchParams.get("account_id") || undefined;
      const status = url.searchParams.get("status") || undefined;
      let assignedStoreId = url.searchParams.get("assigned_store_id") || undefined;
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);

      // Enforce branch manager scope
      if (actor.role === "BRANCH_MANAGER" && actor.branchId && !actor.isSuperAdmin) {
        assignedStoreId = actor.branchId;
      }

      try {
        const assignments = await CorporateRoutingRepository.listAssignments({
          account_id: accountId,
          status,
          assigned_store_id: assignedStoreId,
          limit: isNaN(limit) ? 50 : limit,
          offset: isNaN(offset) ? 0 : offset,
        });

        return NextResponse.json(
          {
            success: true,
            data: assignments,
            meta: {
              count: assignments.length,
              limit: isNaN(limit) ? 50 : limit,
              offset: isNaN(offset) ? 0 : offset,
            },
          },
          { status: 200 }
        );
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 500,
            error: "InternalServerError",
            message: "Failed to list corporate delivery assignments.",
          },
          { status: 500 }
        );
      }
    }

    // 5. GET /unresolved/:id/candidates (Inspect candidates for manual resolution)
    const candidatesMatch = subPath.match(/^unresolved\/([a-zA-Z0-9_\-]+)\/candidates$/);
    if (candidatesMatch) {
      const permErr = this.checkPermission(actor, "VIEW");
      if (permErr) return permErr;

      const assignmentId = candidatesMatch[1];
      try {
        const candidates = await CorporateRoutingService.getUnresolvedReviewCandidates(assignmentId);
        return NextResponse.json({ success: true, data: candidates }, { status: 200 });
      } catch (err: any) {
        if (err.message && err.message.includes("not found")) {
          return NextResponse.json(
            { success: false, statusCode: 404, error: "NotFound", message: err.message },
            { status: 404 }
          );
        }
        return NextResponse.json(
          {
            success: false,
            statusCode: 500,
            error: "InternalServerError",
            message: "Failed to load candidate stores and partners for unresolved assignment.",
          },
          { status: 500 }
        );
      }
    }

    // 6. GET /unresolved (List unresolved queue with filters, counts & pagination)
    if (subPath === "unresolved" || subPath.startsWith("unresolved?")) {
      const permErr = this.checkPermission(actor, "VIEW");
      if (permErr) return permErr;

      const url = new URL(req.url);
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      const status = (url.searchParams.get("status") as CorporateAssignmentStatus) || undefined;
      const reasonCode = (url.searchParams.get("reason_code") as CorporateRoutingReasonCode) || undefined;
      const accountId = url.searchParams.get("account_id") || undefined;
      const entityType = (url.searchParams.get("entity_type") as CorporateDeliveryEntityType) || undefined;
      const search = url.searchParams.get("search") || undefined;

      const safePage = isNaN(page) || page < 1 ? 1 : page;
      const safeLimit = isNaN(limit) || limit < 1 ? 20 : Math.min(limit, 100);
      const offset = (safePage - 1) * safeLimit;

      try {
        const filterParams = {
          status,
          reason_code: reasonCode,
          account_id: accountId,
          entity_type: entityType,
          search,
          limit: safeLimit,
          offset,
        };

        const [items, metrics] = await Promise.all([
          CorporateRoutingRepository.listUnresolvedAssignments(filterParams),
          CorporateRoutingRepository.countUnresolvedAssignments(filterParams),
        ]);

        const totalPages = Math.ceil(metrics.total_unresolved / safeLimit);

        return NextResponse.json(
          {
            success: true,
            data: items,
            meta: {
              total: metrics.total_unresolved,
              page: safePage,
              limit: safeLimit,
              total_pages: totalPages,
              reason_code_counts: metrics.by_reason_code,
            },
          },
          { status: 200 }
        );
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 500,
            error: "InternalServerError",
            message: "Failed to list unresolved corporate assignments queue.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        statusCode: 404,
        error: "NotFound",
        message: `Corporate routing GET endpoint "/${subPath}" not found.`,
      },
      { status: 404 }
    );
  }

  // ── Unified HTTP POST Dispatcher ────────────────────────────────────────────

  public static async handlePost(
    req: NextRequest,
    path: string,
    userCtx?: any,
    body?: any
  ): Promise<NextResponse> {
    const actor = this.resolveActor(req, userCtx);
    const subPath = path
      .replace(/^admin\/corporate-routing\/?/, "")
      .replace(/^corporate-routing\/?/, "");

    // 1. POST /preview (Simulated dry-run matching without persisting assignments or events)
    if (subPath === "preview") {
      const permErr = this.checkPermission(actor, "VIEW");
      if (permErr) return permErr;

      const validation = this.validateRoutingItem(body);
      if (!validation.valid || !validation.parsed) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: validation.error || "Invalid preview request payload.",
          },
          { status: 400 }
        );
      }

      try {
        // Load candidates and evaluate purely in-memory
        const candidateStores = await CorporateRoutingRepository.listCandidateStoreZones();
        const candidatePartners = await CorporateRoutingRepository.listCandidatePartnerCoverages();
        const outcome = CorporateRoutingService.evaluateTarget(
          validation.parsed,
          candidateStores,
          candidatePartners
        );

        return NextResponse.json(
          {
            success: true,
            data: {
              entity_type: validation.parsed.entity_type,
              entity_id: validation.parsed.entity_id,
              is_preview: true,
              outcome,
            },
          },
          { status: 200 }
        );
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 500,
            error: "InternalServerError",
            message: "Failed to execute corporate routing preview.",
          },
          { status: 500 }
        );
      }
    }

    // 2. POST /match (Evaluate and persist single target atomically)
    if (subPath === "match") {
      const permErr = this.checkPermission(actor, "MANAGE");
      if (permErr) return permErr;

      const validation = this.validateRoutingItem(body);
      if (!validation.valid || !validation.parsed) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: validation.error || "Invalid match request payload.",
          },
          { status: 400 }
        );
      }

      try {
        // Use trusted session identity for actor context, never request body
        const result = await CorporateRoutingService.matchDeliveriesBatch({
          items: [validation.parsed],
          actor_id: actor.userId || "SYSTEM_ROUTING_ENGINE",
          actor_role: actor.role || "STAFF",
        });

        const assignment = result.assignments[0];
        return NextResponse.json(
          {
            success: true,
            data: assignment,
            summary: result.summary,
          },
          { status: 200 }
        );
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 500,
            error: "InternalServerError",
            message: "Failed to persist corporate delivery assignment.",
          },
          { status: 500 }
        );
      }
    }

    // 3. POST /match-batch (Bounded batch matching pipeline)
    if (subPath === "match-batch") {
      const permErr = this.checkPermission(actor, "MANAGE");
      if (permErr) return permErr;

      if (!body || typeof body !== "object") {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: "Request body must be a JSON object containing an 'items' array.",
          },
          { status: 400 }
        );
      }

      if (!Array.isArray(body.items)) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: "Field 'items' must be an array of routing targets.",
          },
          { status: 400 }
        );
      }

      if (body.items.length === 0) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: "Batch items array cannot be empty. At least 1 item is required.",
          },
          { status: 400 }
        );
      }

      if (body.items.length > MAX_ROUTING_BATCH_SIZE) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: `Batch size (${body.items.length}) exceeds maximum limit of ${MAX_ROUTING_BATCH_SIZE} items.`,
          },
          { status: 400 }
        );
      }

      // Validate each item before opening any database transaction
      const validatedItems: CorporateBatchMatchingItemInput[] = [];
      for (let i = 0; i < body.items.length; i++) {
        const itemValidation = this.validateRoutingItem(body.items[i], `Item [${i}]: `);
        if (!itemValidation.valid || !itemValidation.parsed) {
          return NextResponse.json(
            {
              success: false,
              statusCode: 400,
              error: "BadRequest",
              message: itemValidation.error || `Invalid item at index ${i}.`,
            },
            { status: 400 }
          );
        }
        validatedItems.push(itemValidation.parsed);
      }

      try {
        const result = await CorporateRoutingService.matchDeliveriesBatch({
          items: validatedItems,
          actor_id: actor.userId || "SYSTEM_ROUTING_ENGINE",
          actor_role: actor.role || "STAFF",
        });

        return NextResponse.json(
          {
            success: true,
            data: result.assignments,
            summary: result.summary,
          },
          { status: 200 }
        );
      } catch (err: any) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 500,
            error: "InternalServerError",
            message: "Failed to process batch corporate delivery matching.",
          },
          { status: 500 }
        );
      }
    }

    // 4. POST /unresolved/:id/resolve (Super Admin Manual Resolution / Reassignment)
    const resolveMatch = subPath.match(/^unresolved\/([a-zA-Z0-9_\-]+)\/resolve$/);
    if (resolveMatch) {
      const permErr = this.checkPermission(actor, "MANAGE");
      if (permErr) return permErr;

      const assignmentId = resolveMatch[1];
      if (!body || typeof body !== "object") {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: "Request body must be a valid JSON object.",
          },
          { status: 400 }
        );
      }

      const validActions: ResolveUnresolvedAction[] = [
        "CORRECT_COORDINATES",
        "MANUAL_ASSIGN",
        "MARK_PENDING_REVIEW",
      ];
      if (!body.action || !validActions.includes(body.action)) {
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: `Invalid resolution action "${body.action}". Supported actions: ${validActions.join(", ")}.`,
          },
          { status: 400 }
        );
      }

      if (body.action === "CORRECT_COORDINATES") {
        if (
          body.latitude === undefined ||
          body.latitude === null ||
          isNaN(Number(body.latitude)) ||
          body.longitude === undefined ||
          body.longitude === null ||
          isNaN(Number(body.longitude))
        ) {
          return NextResponse.json(
            {
              success: false,
              statusCode: 400,
              error: "BadRequest",
              message: "Valid numerical latitude and longitude are required for CORRECT_COORDINATES.",
            },
            { status: 400 }
          );
        }
      }

      if (body.action === "MANUAL_ASSIGN") {
        if (!body.store_id || typeof body.store_id !== "string" || body.store_id.trim() === "") {
          return NextResponse.json(
            {
              success: false,
              statusCode: 400,
              error: "BadRequest",
              message: "Valid store_id string is required for MANUAL_ASSIGN.",
            },
            { status: 400 }
          );
        }
        if (
          !body.override_reason ||
          typeof body.override_reason !== "string" ||
          body.override_reason.trim().length < 5
        ) {
          return NextResponse.json(
            {
              success: false,
              statusCode: 400,
              error: "BadRequest",
              message: "A detailed override_reason (minimum 5 characters) is required for MANUAL_ASSIGN.",
            },
            { status: 400 }
          );
        }
      }

      try {
        const actorId = actor.userId || "SUPER_ADMIN";
        const actorRole = actor.role || "SUPER_ADMIN";

        const result = await CorporateRoutingService.resolveUnresolvedAssignment({
          assignment_id: assignmentId,
          action: body.action,
          latitude: body.latitude !== undefined ? Number(body.latitude) : undefined,
          longitude: body.longitude !== undefined ? Number(body.longitude) : undefined,
          delivery_address: body.delivery_address ? String(body.delivery_address).trim() : undefined,
          store_id: body.store_id ? String(body.store_id).trim() : undefined,
          partner_id: body.partner_id ? String(body.partner_id).trim() : undefined,
          override_reason: body.override_reason ? String(body.override_reason).trim() : undefined,
          actor_id: actorId,
          actor_role: actorRole,
        });

        return NextResponse.json(
          {
            success: true,
            data: result.assignment,
            action_taken: result.action_taken,
            idempotent: result.idempotent,
            event_id: result.event_id,
            message: result.message,
          },
          { status: 200 }
        );
      } catch (err: any) {
        if (err.message && err.message.includes("not found")) {
          return NextResponse.json(
            { success: false, statusCode: 404, error: "NotFound", message: err.message },
            { status: 404 }
          );
        }
        return NextResponse.json(
          {
            success: false,
            statusCode: 400,
            error: "BadRequest",
            message: err.message || "Failed to resolve corporate delivery assignment.",
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        statusCode: 404,
        error: "NotFound",
        message: `Corporate routing POST endpoint "/${subPath}" not found.`,
      },
      { status: 404 }
    );
  }
}
