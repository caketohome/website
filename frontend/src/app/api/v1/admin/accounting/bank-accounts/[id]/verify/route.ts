import { NextRequest, NextResponse } from "next/server";
import { resolveServerSession } from "@/lib/security/auth-session";
import { dbTransaction, dbQuery } from "@/lib/db";
import type { PoolClient } from "pg";

export const dynamic = "force-dynamic";

const VALID_VERIFICATION_STATUSES = [
  "NOT_SUBMITTED",
  "PENDING_VERIFICATION",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
  "REQUIRES_REVIEW"
] as const;

type VerificationStatus = typeof VALID_VERIFICATION_STATUSES[number];

function requireFinanceOrAdmin(req: NextRequest): { session: any; errorResponse: NextResponse | null } {
  const session = resolveServerSession(req);
  if (!session || !session.userId) {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required for accounting bank verification." },
        { status: 401 }
      )
    };
  }

  const role = (session.role || "").toUpperCase();
  if (role !== "FINANCE" && role !== "SUPER_ADMIN" && role !== "ADMIN") {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Financial verification requires FINANCE or SUPER_ADMIN privileges." },
        { status: 403 }
      )
    };
  }

  return { session, errorResponse: null };
}

/**
 * GET /api/v1/admin/accounting/bank-accounts/[id]/verify
 * Returns current verification status, audit history, and supporting evidence.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, errorResponse } = requireFinanceOrAdmin(req);
  if (errorResponse) return errorResponse;

  const bankAccountId = params.id;
  if (!bankAccountId) {
    return NextResponse.json(
      { success: false, error: "MISSING_ID", message: "Bank account ID is required." },
      { status: 400 }
    );
  }

  try {
    const res = await dbQuery(
      `SELECT id, account_name, bank_name, account_number_masked, ifsc_code,
              branch_name, status, is_primary, currency,
              verification_status, verified_by, verified_at,
              verification_remarks, verification_document_url, verification_history
       FROM public.bank_account
       WHERE id = $1`,
      [bankAccountId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "ACCOUNT_NOT_FOUND", message: `Bank account '${bankAccountId}' not found.` },
        { status: 404 }
      );
    }

    const row = res.rows[0];
    return NextResponse.json({
      success: true,
      bank_account_id: row.id,
      account_name: row.account_name,
      bank_name: row.bank_name,
      account_number_masked: row.account_number_masked,
      ifsc_code: row.ifsc_code,
      verification_status: row.verification_status || "NOT_SUBMITTED",
      verified_by: row.verified_by,
      verified_at: row.verified_at,
      verification_remarks: row.verification_remarks,
      verification_document_url: row.verification_document_url,
      verification_history: row.verification_history || []
    }, { status: 200 });

  } catch (err: any) {
    console.error("[BankAccountVerify GET] Error:", err.message);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/accounting/bank-accounts/[id]/verify
 * Authorized Manual Bank Settlement Account Verification Workflow.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, errorResponse } = requireFinanceOrAdmin(req);
  if (errorResponse) return errorResponse;

  const bankAccountId = params.id;
  if (!bankAccountId) {
    return NextResponse.json(
      { success: false, error: "MISSING_ID", message: "Bank account ID is required." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { verification_status, remarks, document_url } = body;

    if (!verification_status || !VALID_VERIFICATION_STATUSES.includes(verification_status)) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_STATUS",
          message: `Invalid verification_status. Allowed values: ${VALID_VERIFICATION_STATUSES.join(", ")}`
        },
        { status: 400 }
      );
    }

    const result = await dbTransaction(async (client: PoolClient) => {
      // 1. Fetch current record with row-level lock
      const curRes = await client.query(
        `SELECT id, account_name, bank_name, account_number_masked, verification_status, verification_history
         FROM public.bank_account
         WHERE id = $1
         FOR UPDATE`,
        [bankAccountId]
      );

      if (curRes.rows.length === 0) {
        throw new Error("BANK_ACCOUNT_NOT_FOUND");
      }

      const current = curRes.rows[0];
      const previousStatus = current.verification_status || "NOT_SUBMITTED";

      // 2. Build audit trail entry
      const auditEntry = {
        action: `MANUAL_VERIFICATION_${verification_status}`,
        actor_id: session.userId,
        actor_role: session.role,
        timestamp: new Date().toISOString(),
        previous_status: previousStatus,
        new_status: verification_status,
        remarks: remarks || `Verification status transitioned from ${previousStatus} to ${verification_status}`,
        document_url: document_url || null
      };

      const history = Array.isArray(current.verification_history) ? current.verification_history : [];
      history.push(auditEntry);

      // 3. Update bank account record
      const updateRes = await client.query(
        `UPDATE public.bank_account
         SET 
           verification_status = $1,
           verified_by = $2,
           verified_at = NOW(),
           verification_remarks = $3,
           verification_document_url = $4,
           verification_history = $5::jsonb,
           updated_by = $2,
           updated_at = NOW()
         WHERE id = $6
         RETURNING id, account_name, bank_name, account_number_masked, ifsc_code,
                   verification_status, verified_by, verified_at, verification_remarks,
                   verification_document_url`,
        [
          verification_status,
          session.userId,
          remarks || null,
          document_url || null,
          JSON.stringify(history),
          bankAccountId
        ]
      );

      return {
        updated: updateRes.rows[0],
        auditEntry
      };
    });

    return NextResponse.json({
      success: true,
      message: `Bank account verification status updated to ${verification_status}.`,
      account: result.updated,
      audit: result.auditEntry
    }, { status: 200 });

  } catch (err: any) {
    console.error("[BankAccountVerify POST] Error:", err.message);
    const statusCode = err.message === "BANK_ACCOUNT_NOT_FOUND" ? 404 : 500;
    return NextResponse.json(
      { success: false, error: err.message, message: err.message },
      { status: statusCode }
    );
  }
}
