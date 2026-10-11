/**
 * CakeToHome ERP — Corporate Gifting API Controller
 * Phase C7.7 Step 7C: Exposes Corporate Gifting template download, dry-run
 * spreadsheet validation, batch import execution, batch listing, and batch detail endpoints.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. STRICT AUTHENTICATION & RBAC:
 *    - All endpoints require an authoritative server-resolved session.
 *    - Explicit feature-level permissions enforced:
 *        VIEW, TEMPLATE, VALIDATE, EXECUTE.
 *    - Corporate customers are restricted strictly to their own authenticated customerId.
 * 2. ZERO-MUTATION DRY RUN:
 *    - /validate runs completely read-only via validateBatchImport; zero database writes.
 * 3. MASTER INVOICE & CONCURRENCY-SAFE EXECUTION:
 *    - /execute routes through canonical executeBatchImport inside a transaction-level advisory lock.
 *    - Exactly 1 master corporate invoice generated; strictly zero per-recipient duplicate invoices.
 * 4. PII DEFENSE:
 *    - Recipient phone numbers and street addresses are sanitized/masked unless caller
 *      holds explicit recipient delivery / customer management authority or is the owning corporate client.
 * 5. SERVER-AUTHORITATIVE AMOUNTS & REPLAY DEFENSE:
 *    - All prices, taxes, and totals are computed dynamically by the server/database.
 *    - Duplicate SHA-256 file hashes are rejected at the service/database layer.
 */

import { NextRequest, NextResponse } from "next/server";
import { StaffAccessControl } from "../staff-access-control";
import {
  CorporateGiftingService,
  CorporateGiftingError,
  type CorporateGiftingErrorCode,
} from "../services/corporate-gifting.service";
import type { CorporateGiftingBatchStatus } from "../types/accounting.types";

export interface UserContext {
  userId: string;
  role: string;
  phone?: string;
  customerId?: string;
  branchId?: string | null;
  partnerId?: string | null;
  permissions?: string[];
  isSuperAdmin: boolean;
}

/**
 * Standardized Corporate Gifting Error Mapper
 */
export function handleCorporateGiftingError(err: any): NextResponse {
  const code: string =
    err?.code || (err instanceof CorporateGiftingError ? err.code : "OPERATION_FAILED");
  const message: string = err?.message || "An unexpected error occurred.";
  const details = err?.details || undefined;

  let status = 400;
  switch (code) {
    case "UNAUTHORIZED":
      status = 401;
      break;
    case "FORBIDDEN":
    case "PERMISSION_DENIED":
    case "BRANCH_ACCESS_DENIED":
      status = 403;
      break;
    case "CUSTOMER_NOT_FOUND":
    case "BATCH_NOT_FOUND":
    case "COST_CENTRE_NOT_FOUND":
    case "BRANCH_NOT_FOUND":
    case "NOT_FOUND":
      status = 404;
      break;
    case "DUPLICATE_FILE_HASH":
    case "CONCURRENT_EXECUTION_LOCK":
      status = 409;
      break;
    case "FILE_TOO_LARGE":
      status = 413;
      break;
    case "INVALID_FILE_FORMAT":
      status = 415;
      break;
    case "EMPTY_BATCH":
    case "BATCH_TOO_LARGE":
    case "MISSING_REQUIRED_HEADERS":
    case "MISSING_FILE":
    case "VALIDATION_FAILED":
    case "CUSTOMER_NOT_CORPORATE":
    case "CUSTOMER_CREDIT_DISABLED":
    case "CREDIT_APPROVAL_REQUIRED":
    case "CREDIT_LIMIT_EXCEEDED":
    case "INVALID_BATCH_STATUS":
    case "INSUFFICIENT_DATA":
      status = 422;
      break;
    default:
      status = 400;
      break;
  }

  // Fallback for unexpected or internal errors: never expose stack traces or DB details
  if (
    status === 500 ||
    code === "INTERNAL_SERVER_ERROR" ||
    (!err?.code && !(err instanceof CorporateGiftingError))
  ) {
    console.error("[CorporateGiftingController Error]", err);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: "An internal server error occurred while processing corporate gifting request.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: code,
      message,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

/**
 * Normalizes route subpaths
 */
function normalizeSubPath(path: string): string {
  let sub = path;
  if (sub.startsWith("admin/corporate-gifting")) {
    sub = sub.replace("admin/corporate-gifting", "");
  } else if (sub.startsWith("corporate-gifting")) {
    sub = sub.replace("corporate-gifting", "");
  }
  if (!sub.startsWith("/")) {
    sub = "/" + sub;
  }
  if (sub.length > 1 && sub.endsWith("/")) {
    sub = sub.slice(0, -1);
  }
  return sub;
}

/**
 * Asserts user session authentication
 */
function assertAuthenticated(userCtx: UserContext): void {
  if (!userCtx || (!userCtx.userId && !userCtx.role)) {
    throw new CorporateGiftingError("UNAUTHORIZED", "Authentication required.");
  }
}

/**
 * Asserts action authorization
 */
function assertPermission(
  userCtx: UserContext,
  action: "VIEW" | "TEMPLATE" | "VALIDATE" | "EXECUTE"
): void {
  assertAuthenticated(userCtx);

  if (userCtx.isSuperAdmin) {
    return;
  }

  const role = (userCtx.role || "").toUpperCase();

  // Corporate customers are authorized for self-service gifting operations
  if (role === "CUSTOMER") {
    return;
  }

  // Staff accounts require explicit feature permission
  const hasPerm = StaffAccessControl.hasPermission(
    userCtx,
    "CORPORATE_GIFTING",
    action
  );

  if (!hasPerm) {
    throw new CorporateGiftingError(
      "FORBIDDEN",
      `Forbidden: Account lacks CORPORATE_GIFTING.${action} permission.`
    );
  }
}

/**
 * Resolves authoritative customerId, preventing cross-customer tampering
 */
function resolveAuthorizedCustomerId(
  userCtx: UserContext,
  requestedCustomerId?: string
): string {
  assertAuthenticated(userCtx);

  const role = (userCtx.role || "").toUpperCase();

  if (role === "CUSTOMER") {
    const sessionCustomerId = userCtx.customerId || userCtx.userId;
    if (requestedCustomerId && requestedCustomerId !== sessionCustomerId) {
      throw new CorporateGiftingError(
        "FORBIDDEN",
        "Forbidden: Corporate customers cannot access or submit gifting batches for another customer account."
      );
    }
    if (!sessionCustomerId) {
      throw new CorporateGiftingError(
        "CUSTOMER_NOT_FOUND",
        "Authenticated customer record not found."
      );
    }
    return sessionCustomerId;
  }

  // Staff role: customerId must be explicitly specified
  if (!requestedCustomerId || typeof requestedCustomerId !== "string" || !requestedCustomerId.trim()) {
    throw new CorporateGiftingError(
      "CUSTOMER_NOT_FOUND",
      "Missing required 'customerId' parameter for corporate gifting operation."
    );
  }

  return requestedCustomerId.trim();
}

/**
 * Checks if user is authorized to view unmasked recipient PII
 */
function canViewRecipientPii(userCtx: UserContext): boolean {
  if (!userCtx) return false;
  if (userCtx.isSuperAdmin) return true;
  const role = (userCtx.role || "").toUpperCase();
  if (role === "CUSTOMER") return true; // Corporate client uploaded their own recipients
  return (
    StaffAccessControl.hasPermission(userCtx, "CUSTOMERS", "VIEW") ||
    StaffAccessControl.hasPermission(userCtx, "DELIVERY", "VIEW") ||
    StaffAccessControl.hasPermission(userCtx, "CORPORATE_GIFTING", "EXECUTE")
  );
}

/**
 * Sanitizes recipient phone and address if viewer lacks PII clearance
 */
function sanitizeRecipientRow(recipient: any, canViewPii: boolean): any {
  if (canViewPii || !recipient) {
    return recipient;
  }

  const phone = String(recipient.recipient_phone || recipient.recipientPhone || "");
  const maskedPhone =
    phone.length >= 10
      ? phone.slice(0, 2) + "******" + phone.slice(-2)
      : "**********";

  return {
    ...recipient,
    recipient_phone: maskedPhone,
    recipientPhone: maskedPhone,
    delivery_address: "*** Protected Delivery Address ***",
    deliveryAddress: "*** Protected Delivery Address ***",
  };
}

/**
 * Extracts spreadsheet file buffer and metadata from multipart or JSON request
 */
async function extractSpreadsheetUpload(
  req: NextRequest,
  body: any
): Promise<{
  fileBuffer: Buffer;
  customerId?: string;
  batchName?: string;
  costCentreCode?: string;
  sourceFilename?: string;
  branchId?: string;
}> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  // 1. Multipart Form Data Upload
  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formErr: any) {
      throw new CorporateGiftingError(
        "INVALID_FILE_FORMAT",
        `Failed to parse multipart form data: ${formErr.message}`
      );
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      throw new CorporateGiftingError(
        "MISSING_FILE",
        "Missing file upload. Please provide an .xlsx file in the 'file' field."
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new CorporateGiftingError(
        "FILE_TOO_LARGE",
        "Uploaded file exceeds maximum limit of 10MB."
      );
    }

    const arrayBuf = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuf);

    return {
      fileBuffer,
      customerId: (formData.get("customerId") || formData.get("customer_id") || "") as string,
      batchName: (formData.get("batchName") || formData.get("batch_name") || "") as string,
      costCentreCode: (formData.get("costCentreCode") || formData.get("cost_centre_code") || "") as string,
      sourceFilename: file.name || "corporate_gifting.xlsx",
      branchId: (formData.get("branchId") || formData.get("branch_id") || "") as string,
    };
  }

  // 2. JSON Base64 Payload Upload
  if (body && typeof body === "object") {
    const rawB64 = body.fileBase64 || body.file_base64 || body.file || body.dataUrl || body.data;
    if (typeof rawB64 === "string" && rawB64.trim().length > 0) {
      // Strip potential data URL prefix: data:application/vnd...;base64,
      const cleanB64 = rawB64.includes(",") ? rawB64.split(",").pop()! : rawB64;

      // Validate base64 length before allocating buffer (10MB binary ≈ 13.7MB base64)
      if (cleanB64.length > 15 * 1024 * 1024) {
        throw new CorporateGiftingError(
          "FILE_TOO_LARGE",
          "Uploaded base64 file exceeds maximum limit of 10MB."
        );
      }

      const fileBuffer = Buffer.from(cleanB64, "base64");
      return {
        fileBuffer,
        customerId: body.customerId || body.customer_id,
        batchName: body.batchName || body.batch_name,
        costCentreCode: body.costCentreCode || body.cost_centre_code,
        sourceFilename: body.sourceFilename || body.filename || "corporate_gifting.xlsx",
        branchId: body.branchId || body.branch_id,
      };
    }
  }

  throw new CorporateGiftingError(
    "MISSING_FILE",
    "No file payload detected. Submit an .xlsx workbook via multipart/form-data or JSON fileBase64."
  );
}

export class CorporateGiftingController {
  // ─── GET DISPATCHER ────────────────────────────────────────────────────────
  static async handleGet(
    req: NextRequest,
    path: string,
    userCtx: UserContext
  ): Promise<NextResponse> {
    try {
      assertAuthenticated(userCtx);
      const subPath = normalizeSubPath(path);
      const url = new URL(req.url);

      // A. Download Excel Template
      if (subPath === "/template" || subPath === "/download-template") {
        assertPermission(userCtx, "TEMPLATE");
        const templateBuf = await CorporateGiftingService.generateTemplateBuffer();

        return new NextResponse(templateBuf, {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="corporate_gifting_template.xlsx"',
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      // D. List Batches
      if (subPath === "/batches" || subPath === "/") {
        assertPermission(userCtx, "VIEW");

        const qCustomerId = url.searchParams.get("customerId") || url.searchParams.get("customer_id");
        const customerId = (userCtx.role || "").toUpperCase() === "CUSTOMER"
          ? resolveAuthorizedCustomerId(userCtx)
          : qCustomerId ? qCustomerId.trim() : undefined;

        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
        const status = (url.searchParams.get("status") || undefined) as CorporateGiftingBatchStatus | undefined;
        const search = url.searchParams.get("search") || undefined;
        const costCentreId = url.searchParams.get("cost_centre_id") || undefined;

        const offset = (page - 1) * limit;

        const filter: any = {
          limit,
          offset,
        };
        if (customerId) filter.customer_id = customerId;
        if (status) filter.status = status;
        if (search) filter.search = search;
        if (costCentreId) filter.cost_centre_id = costCentreId;

        const result = await CorporateGiftingService.listBatches(filter);

        return NextResponse.json({
          success: true,
          batches: result.batches,
          total: result.total,
          page,
          limit,
        });
      }

      // E. Batch Details (/batches/:id)
      const detailMatch = subPath.match(/^\/batches\/([^/]+)$/);
      if (detailMatch) {
        assertPermission(userCtx, "VIEW");
        const batchId = detailMatch[1];

        const detail = await CorporateGiftingService.getBatchDetail(batchId);
        const batch = detail.batch;

        // Verify customer isolation
        const role = (userCtx.role || "").toUpperCase();
        if (role === "CUSTOMER") {
          const authorizedCustId = resolveAuthorizedCustomerId(userCtx);
          if (batch.customer_id !== authorizedCustId) {
            throw new CorporateGiftingError(
              "BATCH_NOT_FOUND",
              `Corporate gifting batch '${batchId}' not found.`
            );
          }
        }

        // Verify branch access for branch-restricted staff
        if (!userCtx.isSuperAdmin && userCtx.branchId) {
          const batchBranch = (batch.metadata as any)?.branch_id;
          if (batchBranch && batchBranch !== userCtx.branchId) {
            throw new CorporateGiftingError(
              "BRANCH_ACCESS_DENIED",
              "Forbidden: Access denied to corporate batch for a different branch."
            );
          }
        }

        // Apply PII sanitization to recipients
        const canViewPii = canViewRecipientPii(userCtx);
        const sanitizedRecipients = (detail.recipients || []).map((r) =>
          sanitizeRecipientRow(r, canViewPii)
        );

        return NextResponse.json({
          success: true,
          batch,
          recipients: sanitizedRecipients,
          totalRecipients: detail.total,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: "NOT_FOUND",
          message: `Corporate gifting route GET '${subPath}' not found.`,
        },
        { status: 404 }
      );
    } catch (err: any) {
      return handleCorporateGiftingError(err);
    }
  }

  // ─── POST DISPATCHER ───────────────────────────────────────────────────────
  static async handlePost(
    req: NextRequest,
    path: string,
    userCtx: UserContext,
    body?: any
  ): Promise<NextResponse> {
    try {
      assertAuthenticated(userCtx);
      const subPath = normalizeSubPath(path);

      // B. Dry-Run Validation (/validate)
      if (subPath === "/validate") {
        assertPermission(userCtx, "VALIDATE");

        const upload = await extractSpreadsheetUpload(req, body);
        const customerId = resolveAuthorizedCustomerId(userCtx, upload.customerId);

        const actorContext = {
          userId: userCtx.userId,
          role: userCtx.role,
          branchId: userCtx.branchId || null,
          isSuperAdmin: userCtx.isSuperAdmin,
          permissions: userCtx.permissions,
        };

        const validation = await CorporateGiftingService.validateBatchImport({
          fileBuffer: upload.fileBuffer,
          customerId,
          branchId: upload.branchId || userCtx.branchId || undefined,
          actorContext,
        });

        // Sanitize recipient PII if caller lacks clearance
        const canViewPii = canViewRecipientPii(userCtx);
        const sanitizedRecipients = (validation.parsedRecipients || []).map((r) =>
          sanitizeRecipientRow(r, canViewPii)
        );

        return NextResponse.json({
          success: true,
          isValid: validation.isValid,
          fileHash: validation.fileHash,
          fileSizeBytes: validation.fileSizeBytes,
          totalRows: validation.totalRows,
          validRows: validation.validRows,
          invalidRows: validation.invalidRows,
          summary: validation.summary,
          errors: validation.errors,
          parsedRecipients: sanitizedRecipients,
          customer: validation.customer,
          branch: validation.branch,
        });
      }

      // C. Execute Batch Import (/execute or /import)
      if (subPath === "/execute" || subPath === "/import") {
        assertPermission(userCtx, "EXECUTE");

        const upload = await extractSpreadsheetUpload(req, body);
        const customerId = resolveAuthorizedCustomerId(userCtx, upload.customerId);

        const actorContext = {
          userId: userCtx.userId,
          role: userCtx.role,
          branchId: userCtx.branchId || null,
          isSuperAdmin: userCtx.isSuperAdmin,
          permissions: userCtx.permissions,
        };

        const execResult = await CorporateGiftingService.executeBatchImport({
          fileBuffer: upload.fileBuffer,
          customerId,
          batchName: upload.batchName || undefined,
          sourceFilename: upload.sourceFilename || "corporate_gifting.xlsx",
          branchId: upload.branchId || userCtx.branchId || undefined,
          actorContext,
        });

        return NextResponse.json({
          success: true,
          batch: execResult.batch,
          recipientsCount: execResult.recipientsCount,
          masterOrderId: execResult.masterOrderId,
          invoiceId: execResult.invoice?.id || null,
          invoiceNumber: execResult.invoice?.invoice_number || null,
          voucherId: execResult.voucher?.id || null,
          voucherNumber: execResult.voucher?.voucher_no || (execResult.voucher as any)?.voucher_number || null,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: "NOT_FOUND",
          message: `Corporate gifting route POST '${subPath}' not found.`,
        },
        { status: 404 }
      );
    } catch (err: any) {
      return handleCorporateGiftingError(err);
    }
  }
}
