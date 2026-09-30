import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "../../../../../../lib/security/auth-session";
import { hasEffectivePermission } from "../../../../../../lib/staff-access-control";
import { ProductService } from "../../../../../../lib/services/product.service";
import type { CreatePackagingProductInput } from "../../../../../../lib/types/domain";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/admin/catalog/packaging
 *
 * Creates a catalog packaging product with its default variant.
 * Enforces:
 * - Server-verified session (401 if missing)
 * - PRODUCTS.CREATE permission resolution (403 if unauthorized)
 * - Zero trust of caller-supplied userId/role
 * - Strict schema validation
 * - merchandise_type = PACKAGING
 * - Atomic product + variant creation
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate via verified server session
    const session = resolveServerSession(req);
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: "Unauthorized: Active authenticated session required." },
        { status: 401 }
      );
    }

    // 2. Authorize via centralized permission resolver (NO endpoint-level SUPER_ADMIN bypass)
    const isPermitted = hasEffectivePermission(session, "PRODUCTS.CREATE");
    if (!isPermitted) {
      return NextResponse.json(
        { error: "Forbidden: PRODUCTS.CREATE permission required." },
        { status: 403 }
      );
    }

    // 3. Parse and sanitize payload — discard caller-supplied identity/role
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json(
        { error: "Validation error: JSON request body is required." },
        { status: 400 }
      );
    }

    // Explicitly discard caller-supplied identity claims
    const {
      userId: _discardedUserId,
      role: _discardedRole,
      actorId: _discardedActorId,
      ...sanitizedInput
    } = rawBody;

    // 4. Delegate to ProductService with verified session actor
    const result = await ProductService.createPackagingProduct(
      sanitizedInput as CreatePackagingProductInput,
      session.userId
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err: any) {
    if (err.code === "DUPLICATE_SKU" || err.code === "DUPLICATE_HANDLE") {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
    }
    if (err.message?.startsWith("Validation error")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
