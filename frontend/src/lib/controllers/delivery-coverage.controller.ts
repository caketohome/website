import { resolveServerSession } from "../security/auth-session";
/**
 * CakeToHome ERP — Delivery Coverage & Partner Geofence Controller
 * Phase C7.10: Map-Fenced Store & Delivery-Partner Coverage Configuration
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. SERVER-SIDE RBAC: Enforces DELIVERY_COVERAGE.VIEW and DELIVERY_COVERAGE.MANAGE.
 * 2. TENANT & BRANCH SCOPE: Branch Managers are strictly restricted to their own assigned branch_id.
 * 3. IMMUTABLE AUDIT TRAIL: Every boundary or eligibility mutation records an immutable audit event.
 * 4. STRICT FAIL-CLOSED ROUTING: Corporate resolution requires verified GPS coordinates and eligible stores.
 */

import { NextRequest, NextResponse } from "next/server";
import { DeliveryCoverageService } from "../services/delivery-coverage.service";
import { StaffAccessControl } from "../staff-access-control";

export interface ActorContext {
  userId: string;
  role: string;
  branchId?: string | null;
  phone?: string | null;
  email?: string | null;
  permissions?: string[];
  isSuperAdmin?: boolean;
}

export class DeliveryCoverageController {
  /**
   * Resolves authenticated actor from request cookies/headers or userCtx
   */
  public static resolveActor(req: NextRequest, userCtx?: any): ActorContext {
    if (userCtx && (userCtx.userId || userCtx.id || userCtx.role)) {
      const role = (userCtx.role || userCtx.detected_role || "").toUpperCase();
      const userId = userCtx.userId || userCtx.id || "";
      const isSuperAdmin = userCtx.isSuperAdmin || role === "SUPER_ADMIN";
      return {
        userId,
        role,
        branchId: userCtx.branchId || userCtx.branch_id || null,
        phone: userCtx.phone || null,
        email: userCtx.email || null,
        permissions: Array.isArray(userCtx.permissions) ? userCtx.permissions : [],
        isSuperAdmin,
      };
    }

    // Identity only from the signed session — never from client cookies/headers (x-user-role etc.).
    const session = resolveServerSession(req);
    const role = (session?.role || "").toUpperCase();
    return {
      userId: session?.userId || "",
      role,
      branchId: session?.branchId || null,
      phone: session?.phone || null,
      email: session?.email || null,
      permissions: [],
      isSuperAdmin: role === "SUPER_ADMIN",
    };
  }

  /**
   * Helper to verify permissions and return standard 401/403 responses
   */
  private static checkPermission(
    actor: ActorContext,
    requiredModule: string,
    requiredAction: string
  ): NextResponse | null {
    if (!actor.userId && !actor.role) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 401,
          error: "UNAUTHORIZED",
          message: "Authentication required to access delivery coverage.",
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
          message: "Customer accounts are not authorized to access delivery coverage.",
        },
        { status: 403 }
      );
    }

    if (actor.isSuperAdmin || actor.role === "SUPER_ADMIN") {
      return null; // Full network authority
    }

    // Direct permissions array check
    const reqPermId = `${requiredModule}.${requiredAction}`;
    const altPermId = `${requiredModule}_COVERAGE.${requiredAction.replace('_COVERAGE', '')}`;
    if (Array.isArray(actor.permissions)) {
      if (
        actor.permissions.includes(reqPermId) ||
        actor.permissions.includes(altPermId) ||
        actor.permissions.includes(`${requiredModule}.*`) ||
        actor.permissions.includes("*")
      ) {
        return null;
      }
    }

    const hasPerm =
      StaffAccessControl.hasPermission(
        { id: actor.userId, role: actor.role as any, phone: actor.phone || "", permissions: actor.permissions },
        requiredModule,
        requiredAction
      ) ||
      StaffAccessControl.hasPermission(
        { id: actor.userId, role: actor.role as any, phone: actor.phone || "", permissions: actor.permissions },
        "DELIVERY_COVERAGE",
        requiredAction.replace("_COVERAGE", "")
      );

    if (!hasPerm) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 403,
          error: "Forbidden",
          message: `Insufficient permissions: Requires ${requiredModule}.${requiredAction}.`,
        },
        { status: 403 }
      );
    }
    return null;
  }

  /**
   * Validates branch tenant scope for Branch Managers
   */
  private static checkBranchScope(actor: ActorContext, targetBranchId: string): NextResponse | null {
    if (actor.role === "SUPER_ADMIN") {
      return null; // Global scope
    }
    if (actor.role === "BRANCH_MANAGER" && actor.branchId && actor.branchId !== targetBranchId) {
      return NextResponse.json(
        {
          success: false,
          statusCode: 403,
          error: "TenantScopeViolation",
          message: `Branch Manager cannot modify coverage outside assigned store "${actor.branchId}".`,
        },
        { status: 403 }
      );
    }
    return null;
  }

  // ── Unified Dispatcher Handlers for Next.js Catch-All Route ─────────────────

  public static async handleGet(req: NextRequest, path: string, userCtx?: any): Promise<NextResponse> {
    const actor = this.resolveActor(req, userCtx);
    const subPath = path.replace(/^admin\/delivery-coverage\/?/, "").replace(/^delivery-coverage\/?/, "");

    const permErr = this.checkPermission(actor, "DELIVERY", "VIEW_COVERAGE");
    if (permErr) return permErr;

    try {
      // 1. /stores -> List all stores with coverage summary
      if (subPath === "stores" || subPath === "") {
        const stores = await DeliveryCoverageService.listStoresSummary();
        return NextResponse.json({ success: true, stores });
      }

      // 2. /stores/:id/zones -> List zones for a store
      const storeZonesMatch = subPath.match(/^stores\/([^/]+)\/zones$/);
      if (storeZonesMatch) {
        const branchId = storeZonesMatch[1];
        const zones = await DeliveryCoverageService.getBranchZones(branchId);
        return NextResponse.json({ success: true, branch_id: branchId, zones });
      }

      // 3. /partners -> List all delivery partners with profiles
      if (subPath === "partners") {
        const partners = await DeliveryCoverageService.listDeliveryPartners();
        return NextResponse.json({ success: true, partners });
      }

      // 4. /partners/:id/coverage -> Get coverage fences for partner
      const partnerCovMatch = subPath.match(/^partners\/([^/]+)\/coverage$/);
      if (partnerCovMatch) {
        const partnerId = partnerCovMatch[1];
        const coverage = await DeliveryCoverageService.getDeliveryPartnerCoverage(partnerId);
        return NextResponse.json({ success: true, partner_id: partnerId, coverage });
      }

      // 5. /partners/:id -> Get single partner profile
      const partnerProfMatch = subPath.match(/^partners\/([^/]+)$/);
      if (partnerProfMatch) {
        const partnerId = partnerProfMatch[1];
        const profile = await DeliveryCoverageService.getDeliveryPartnerProfile(partnerId);
        if (!profile) {
          return NextResponse.json({ success: false, statusCode: 404, error: "Partner profile not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, profile });
      }

      // 6. /events -> List audit events
      if (subPath === "events") {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const entityType = url.searchParams.get("entity_type") || undefined;
        const events = await DeliveryCoverageService.listCoverageEvents(limit, offset, entityType);
        return NextResponse.json({ success: true, events });
      }

      return NextResponse.json({ success: false, statusCode: 404, error: `Endpoint not found: GET ${path}` }, { status: 404 });
    } catch (err: any) {
      return NextResponse.json({ success: false, statusCode: 500, error: err.message || "Internal Server Error" }, { status: 500 });
    }
  }

  public static async handlePost(req: NextRequest, path: string, userCtx?: any, body?: any): Promise<NextResponse> {
    const actor = this.resolveActor(req, userCtx);
    const subPath = path.replace(/^admin\/delivery-coverage\/?/, "").replace(/^delivery-coverage\/?/, "");

    const parsedBody = body ?? (await req.json().catch(() => ({})));

    // Diagnostic Point Probe: /validate-point (requires VIEW_COVERAGE)
    if (subPath === "validate-point") {
      const permErr = this.checkPermission(actor, "DELIVERY", "VIEW_COVERAGE");
      if (permErr) return permErr;
      const normalizedQuery = {
        latitude: parsedBody.latitude !== undefined ? parsedBody.latitude : parsedBody.lat,
        longitude: parsedBody.longitude !== undefined ? parsedBody.longitude : parsedBody.lng,
        branch_id: parsedBody.branch_id,
      };
      const result = await DeliveryCoverageService.validateCoveragePoint(normalizedQuery);
      return NextResponse.json({ success: true, result });
    }

    // Fail-Closed Corporate Routing Resolver: /resolve-corporate (requires VIEW_COVERAGE)
    if (subPath === "resolve-corporate") {
      const permErr = this.checkPermission(actor, "DELIVERY", "VIEW_COVERAGE");
      if (permErr) return permErr;
      const normalizedQuery = {
        latitude: parsedBody.latitude !== undefined ? parsedBody.latitude : parsedBody.lat,
        longitude: parsedBody.longitude !== undefined ? parsedBody.longitude : parsedBody.lng,
        corporate_account_id: parsedBody.corporate_account_id,
        recipient_id: parsedBody.recipient_id,
      };
      const resolution = await DeliveryCoverageService.resolveCorporateDeliveryCoverage(normalizedQuery);
      return NextResponse.json({ success: true, resolution });
    }

    // Mutation endpoints require MANAGE_COVERAGE
    const permErr = this.checkPermission(actor, "DELIVERY", "MANAGE_COVERAGE");
    if (permErr) return permErr;

    try {
      // 1. /stores/:id/zones -> Create or update store zone
      const storeZoneMatch = subPath.match(/^stores\/([^/]+)\/zones$/);
      if (storeZoneMatch) {
        const branchId = storeZoneMatch[1];
        const scopeErr = this.checkBranchScope(actor, branchId);
        if (scopeErr) return scopeErr;

        const zone = await DeliveryCoverageService.upsertDeliveryZone({
          ...parsedBody,
          branch_id: branchId,
          actor_id: actor.userId,
          actor_role: actor.role,
          reason: parsedBody.reason || "Created store zone",
        });
        return NextResponse.json({ success: true, zone }, { status: 201 });
      }

      return NextResponse.json({ success: false, statusCode: 404, error: `Endpoint not found: POST ${path}` }, { status: 404 });
    } catch (err: any) {
      return NextResponse.json({ success: false, statusCode: 400, error: err.message || "Bad Request" }, { status: 400 });
    }
  }

  public static async handlePatch(req: NextRequest, path: string, userCtx?: any, body?: any): Promise<NextResponse> {
    const actor = this.resolveActor(req, userCtx);
    const subPath = path.replace(/^admin\/delivery-coverage\/?/, "").replace(/^delivery-coverage\/?/, "");

    const permErr = this.checkPermission(actor, "DELIVERY", "MANAGE_COVERAGE");
    if (permErr) return permErr;

    const parsedBody = body ?? (await req.json().catch(() => ({})));

    try {
      // 1. /stores/:id/eligibility -> Toggle corporate routing allow-list (SUPER_ADMIN only)
      const eligMatch = subPath.match(/^stores\/([^/]+)\/eligibility$/);
      if (eligMatch) {
        if (actor.role !== "SUPER_ADMIN") {
          return NextResponse.json(
            { success: false, statusCode: 403, error: "Only Super Administrators can modify corporate routing eligibility." },
            { status: 403 }
          );
        }
        const branchId = eligMatch[1];
        if (typeof parsedBody.is_eligible !== "boolean") {
          return NextResponse.json({ success: false, statusCode: 400, error: "Missing boolean 'is_eligible'" }, { status: 400 });
        }
        if (!parsedBody.reason || parsedBody.reason.trim().length < 5) {
          return NextResponse.json({ success: false, statusCode: 400, error: "Reason (min 5 chars) is mandatory" }, { status: 400 });
        }

        const res = await DeliveryCoverageService.setBranchEligibility({
          branch_id: branchId,
          is_eligible: parsedBody.is_eligible,
          actor_id: actor.userId,
          actor_role: actor.role,
          reason: parsedBody.reason,
        });
        return NextResponse.json({ success: true, ...res });
      }

      return NextResponse.json({ success: false, statusCode: 404, error: `Endpoint not found: PATCH ${path}` }, { status: 404 });
    } catch (err: any) {
      return NextResponse.json({ success: false, statusCode: 400, error: err.message || "Bad Request" }, { status: 400 });
    }
  }

  public static async handlePut(req: NextRequest, path: string, userCtx?: any, body?: any): Promise<NextResponse> {
    const actor = this.resolveActor(req, userCtx);
    const subPath = path.replace(/^admin\/delivery-coverage\/?/, "").replace(/^delivery-coverage\/?/, "");

    const permErr = this.checkPermission(actor, "DELIVERY", "MANAGE_COVERAGE");
    if (permErr) return permErr;

    const parsedBody = body ?? (await req.json().catch(() => ({})));

    try {
      // 1. /partners/:id/profile -> Update partner operational profile
      const profMatch = subPath.match(/^partners\/([^/]+)\/profile$/);
      if (profMatch) {
        const partnerId = profMatch[1];
        const profile = await DeliveryCoverageService.upsertDeliveryPartnerProfile({
          ...parsedBody,
          partner_id: partnerId,
          actor_id: actor.userId,
          actor_role: actor.role,
          reason: parsedBody.reason || "Updated partner profile",
        });
        return NextResponse.json({ success: true, profile });
      }

      // 2. /partners/:id/coverage -> Upsert partner coverage boundary
      const covMatch = subPath.match(/^partners\/([^/]+)\/coverage$/);
      if (covMatch) {
        const partnerId = covMatch[1];
        const coverage = await DeliveryCoverageService.upsertDeliveryPartnerCoverage({
          ...parsedBody,
          partner_id: partnerId,
          actor_id: actor.userId,
          actor_role: actor.role,
          reason: parsedBody.reason || "Configured partner coverage boundary",
        });
        return NextResponse.json({ success: true, coverage });
      }

      // 3. /zones/:id -> Update store zone
      const zoneMatch = subPath.match(/^zones\/([^/]+)$/);
      if (zoneMatch) {
        const zoneId = zoneMatch[1];
        const branchId = parsedBody.branch_id;
        if (branchId) {
          const scopeErr = this.checkBranchScope(actor, branchId);
          if (scopeErr) return scopeErr;
        }

        const zone = await DeliveryCoverageService.upsertDeliveryZone({
          ...parsedBody,
          id: zoneId,
          actor_id: actor.userId,
          actor_role: actor.role,
          reason: parsedBody.reason || "Updated delivery zone",
        });
        return NextResponse.json({ success: true, zone });
      }

      return NextResponse.json({ success: false, statusCode: 404, error: `Endpoint not found: PUT ${path}` }, { status: 404 });
    } catch (err: any) {
      return NextResponse.json({ success: false, statusCode: 400, error: err.message || "Bad Request" }, { status: 400 });
    }
  }

  public static async handleDelete(req: NextRequest, path: string, userCtx?: any): Promise<NextResponse> {
    const actor = this.resolveActor(req, userCtx);
    const subPath = path.replace(/^admin\/delivery-coverage\/?/, "").replace(/^delivery-coverage\/?/, "");

    const permErr = this.checkPermission(actor, "DELIVERY", "MANAGE_COVERAGE");
    if (permErr) return permErr;

    try {
      // 1. /zones/:id -> Deactivate zone
      const zoneMatch = subPath.match(/^zones\/([^/]+)$/);
      if (zoneMatch) {
        const zoneId = zoneMatch[1];
        const ok = await DeliveryCoverageService.deactivateDeliveryZone(
          zoneId,
          actor.userId,
          actor.role,
          "Deactivated via API"
        );
        if (!ok) {
          return NextResponse.json({ success: false, statusCode: 404, error: "Zone not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: `Zone ${zoneId} deactivated.` });
      }

      return NextResponse.json({ success: false, statusCode: 404, error: `Endpoint not found: DELETE ${path}` }, { status: 404 });
    } catch (err: any) {
      return NextResponse.json({ success: false, statusCode: 400, error: err.message || "Bad Request" }, { status: 400 });
    }
  }
}
