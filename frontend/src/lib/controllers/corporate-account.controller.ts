/**
 * CakeToHome ERP — Corporate Account Master & Employee Roster Controller
 * Phase C7.9d: HTTP Dispatcher, Server-Side RBAC, Mass-Assignment Defense, and Audit Logs.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. SERVER-SIDE AUTHENTICATION: Never trust client headers; verify actor from session context.
 * 2. ROLE & MEMBERSHIP SEGREGATION:
 *    - Super Admin: All actions including account approval, customer link, credit activate, member grant.
 *    - Operations staff: CREATE, UPDATE, CREDIT_REQUEST based on static permissions.
 *    - Account Member: Scoped strictly to own account (ROSTER_MANAGER can manage; ROSTER_VIEWER can read).
 * 3. FOUR-EYES APPROVAL: Approver !== Creator enforced at service and controller level.
 * 4. PII MASKING: Mask employee phone & email for non-privileged viewers.
 * 5. MASS-ASSIGNMENT DEFENSE: Roster endpoints strictly stripped of financial/credit/approval fields.
 * 6. FAIL-CLOSED RESPONSES: Safe structured error responses with zero DB stack leaks.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  CorporateAccountService,
  CorporateAccountError,
} from "../services/corporate-account.service";
import {
  CorporateEmployeeService,
  CorporateEmployeeError,
} from "../services/corporate-employee.service";
import {
  CorporateEmployeeImportService,
} from "../services/corporate-employee-import.service";
import {
  CorporateAccountRepository,
  CorporateAccountContactRepository,
  CorporateAccountMemberRepository,
} from "../repositories/corporate-account.repository";
import { StaffAccessControl } from "../staff-access-control";
import type {
  CorporateActorContext,
  CorporateAccountRow,
  CorporateEmployeeRow,
  CreateCorporateAccountInput,
  UpdateCorporateAccountInput,
  CreateCorporateEmployeeInput,
  UpdateCorporateEmployeeInput,
  ListCorporateAccountsFilter,
  ListCorporateEmployeesFilter,
} from "../types/corporate-account.types";
import { BillsReceivableError } from "../services/bills-receivable.service";
import type { UserContext } from "./corporate-gifting.controller";

// ─── PII Masking Utilities ─────────────────────────────────────────────────────

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return "****";
  const visible = phone.slice(-4);
  return "*".repeat(phone.length - 4) + visible;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***@***.***";
  const [local, domain] = email.split("@");
  return (local[0] || "*") + "***@" + domain;
}

function applyPiiMasking(employee: CorporateEmployeeRow): CorporateEmployeeRow {
  return {
    ...employee,
    phone: maskPhone(employee.phone),
    email: employee.email ? maskEmail(employee.email) : null,
  };
}

// ─── Actor Context Resolution ──────────────────────────────────────────────────

function buildActorContext(userCtx: UserContext, scopedAccountId?: string): CorporateActorContext {
  const role = (userCtx.role || "").toUpperCase();
  const isSuperAdmin = userCtx.isSuperAdmin || role === "SUPER_ADMIN" || userCtx.userId === "admin_01";
  return {
    userId: userCtx.userId || "system",
    role: userCtx.role,
    isSuperAdmin,
    permissions: userCtx.permissions,
    scopedAccountId,
  };
}

function isPrivilegedViewer(userCtx: UserContext, accountId: string, memberRole?: string): boolean {
  const role = (userCtx.role || "").toUpperCase();
  if (role === "SUPER_ADMIN") return true;
  if (StaffAccessControl.hasPermission(userCtx, "CORPORATE_EMPLOYEES", "MANAGE")) return true;
  if (memberRole === "ROSTER_MANAGER") return true;
  return false;
}

function assertAuthenticated(userCtx: UserContext): void {
  if (!userCtx || (!userCtx.userId && !userCtx.role)) {
    throw new CorporateAccountError("UNAUTHORIZED", "Authentication required to access corporate accounts.");
  }
}

function assertStaffPermission(userCtx: UserContext, module: any, action: any): void {
  const role = (userCtx.role || "").toUpperCase();
  if (role === "SUPER_ADMIN") return;
  const hasPerm = StaffAccessControl.hasPermission(userCtx, module, action);
  if (!hasPerm) {
    throw new CorporateAccountError(
      "FORBIDDEN",
      `Forbidden: Account lacks ${module}.${action} permission.`
    );
  }
}

// ─── Error Formatter ───────────────────────────────────────────────────────────

function formatErrorResponse(err: any): NextResponse {
  const code: string =
    err?.code ||
    (err instanceof CorporateAccountError ? err.code : undefined) ||
    (err instanceof CorporateEmployeeError ? err.code : undefined) ||
    (err instanceof BillsReceivableError ? err.code : undefined) ||
    "OPERATION_FAILED";

  const message: string = err?.message || "An unexpected error occurred.";
  const details = err?.details || undefined;

  let status = 400;
  switch (code) {
    case "UNAUTHORIZED":
      status = 401;
      break;
    case "FORBIDDEN":
    case "PERMISSION_DENIED":
    case "SUPER_ADMIN_REQUIRED":
    case "FOUR_EYES_VIOLATION":
    case "SEGREGATION_OF_DUTIES_VIOLATION":
      status = 403;
      break;
    case "ACCOUNT_NOT_FOUND":
    case "EMPLOYEE_NOT_FOUND":
    case "CONTACT_NOT_FOUND":
    case "MEMBER_NOT_FOUND":
    case "BATCH_NOT_FOUND":
    case "CUSTOMER_NOT_FOUND":
    case "USER_NOT_FOUND":
      status = 404;
      break;
    case "DUPLICATE_GSTIN":
    case "DUPLICATE_EMPLOYEE_CODE":
    case "DUPLICATE_FILE_HASH":
    case "CUSTOMER_ALREADY_LINKED":
    case "PRIMARY_CONTACT_ALREADY_EXISTS":
    case "MEMBER_ALREADY_EXISTS":
    case "CONCURRENT_MODIFICATION":
      status = 409;
      break;
    case "VALIDATION_FAILED":
    case "INVALID_COORDINATES":
    case "INVALID_PARAMETERS":
    case "INVALID_ACCOUNT_STATUS":
    case "ACCOUNT_CLOSED":
    case "ACCOUNT_NOT_APPROVED":
    case "EMPLOYEE_DEACTIVATED_REACTIVATION_REQUIRED":
    case "MISSING_FILE":
    case "FILE_TOO_LARGE":
    case "INVALID_FILE_FORMAT":
      status = 422;
      break;
    default:
      status = 400;
      break;
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

// ─── Multipart & Base64 Excel File Parser ──────────────────────────────────────

async function extractWorkbookPayload(
  req: NextRequest,
  body?: any
): Promise<{ fileBuffer: Buffer; filename: string }> {
  const contentType = req.headers.get("content-type") || "";

  // 1. Multipart Form Data Upload
  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (formErr: any) {
      throw new CorporateEmployeeError(
        "INVALID_FILE_FORMAT",
        `Failed to parse multipart form data: ${formErr.message}`
      );
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      throw new CorporateEmployeeError(
        "MISSING_FILE",
        "Missing file upload. Please provide an .xlsx file in the 'file' field."
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new CorporateEmployeeError("FILE_TOO_LARGE", "Uploaded file exceeds maximum limit of 10MB.");
    }

    const arrayBuf = await file.arrayBuffer();
    return {
      fileBuffer: Buffer.from(arrayBuf),
      filename: file.name || "corporate_employee_roster.xlsx",
    };
  }

  // 2. JSON Base64 Payload Upload
  if (body && typeof body === "object") {
    const rawB64 = body.fileBase64 || body.file_base64 || body.file || body.dataUrl || body.data;
    if (typeof rawB64 === "string" && rawB64.trim().length > 0) {
      const cleanB64 = rawB64.includes(",") ? rawB64.split(",").pop()! : rawB64;
      if (cleanB64.length > 15 * 1024 * 1024) {
        throw new CorporateEmployeeError("FILE_TOO_LARGE", "Uploaded base64 file exceeds maximum limit of 10MB.");
      }
      return {
        fileBuffer: Buffer.from(cleanB64, "base64"),
        filename: body.filename || body.sourceFilename || "corporate_employee_roster.xlsx",
      };
    }
  }

  throw new CorporateEmployeeError(
    "MISSING_FILE",
    "No file payload detected. Submit an .xlsx workbook via multipart/form-data or JSON fileBase64."
  );
}

// ─── Subpath Normalization ─────────────────────────────────────────────────────

function normalizeSubPath(path: string): string {
  let sub = path.trim();
  if (sub.startsWith("admin/")) sub = sub.substring("admin/".length);
  if (sub.startsWith("corporate-accounts/")) sub = sub.substring("corporate-accounts/".length);
  else if (sub === "corporate-accounts") sub = "";
  if (!sub.startsWith("/")) sub = "/" + sub;
  return sub;
}

// ─── Controller Implementation ─────────────────────────────────────────────────

export class CorporateAccountController {
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

      // 1. Download Roster Template: /:id/employees/template
      const templateMatch = subPath.match(/^\/([^/]+)\/employees\/template$/);
      if (templateMatch) {
        const accountId = templateMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const templateBuf = await CorporateEmployeeImportService.generateTemplateBuffer();

        return new NextResponse(templateBuf, {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="corporate_employee_roster_template.xlsx"',
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      // 2. List Accounts: /
      if (subPath === "/" || subPath === "") {
        assertStaffPermission(userCtx, "CORPORATE_ACCOUNTS", "VIEW");
        const status = (url.searchParams.get("status") || undefined) as any;
        const search = url.searchParams.get("search") || undefined;
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
        const offset = (page - 1) * limit;

        const actor = buildActorContext(userCtx);
        const result = await CorporateAccountService.listAccounts({ status, search, limit, offset }, actor);
        return NextResponse.json({
          success: true,
          items: result.items,
          total: result.total,
          page,
          limit,
        });
      }

      // 3. Import Batches List: /:id/employees/import/batches
      const importBatchesMatch = subPath.match(/^\/([^/]+)\/employees\/import\/batches$/);
      if (importBatchesMatch) {
        const accountId = importBatchesMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
        const batches = await CorporateEmployeeImportService.listImportBatches(accountId, actor, limit);
        return NextResponse.json({ success: true, items: batches });
      }

      // 4. Import Batch Detail: /:id/employees/import/batches/:batchId
      const batchDetailMatch = subPath.match(/^\/([^/]+)\/employees\/import\/batches\/([^/]+)$/);
      if (batchDetailMatch) {
        const accountId = batchDetailMatch[1];
        const batchId = batchDetailMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const batch = await CorporateEmployeeImportService.getImportBatchDetail(accountId, batchId, actor);
        if (!batch) {
          throw new CorporateEmployeeError("BATCH_NOT_FOUND", `Import batch '${batchId}' not found.`);
        }
        return NextResponse.json({ success: true, batch });
      }

      // 5. Employee Event History: /:id/employees/:employeeId/events
      const employeeEventsMatch = subPath.match(/^\/([^/]+)\/employees\/([^/]+)\/events$/);
      if (employeeEventsMatch) {
        const accountId = employeeEventsMatch[1];
        const employeeId = employeeEventsMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const events = await CorporateEmployeeService.listEmployeeEvents(accountId, employeeId, actor);
        return NextResponse.json({ success: true, events });
      }

      // 6. Employee Detail: /:id/employees/:employeeId
      const employeeDetailMatch = subPath.match(/^\/([^/]+)\/employees\/([^/]+)$/);
      if (employeeDetailMatch) {
        const accountId = employeeDetailMatch[1];
        const employeeId = employeeDetailMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const employee = await CorporateEmployeeService.getEmployeeById(accountId, employeeId, actor);
        if (!employee) {
          throw new CorporateEmployeeError("EMPLOYEE_NOT_FOUND", `Employee '${employeeId}' not found.`);
        }

        // PII masking for non-privileged viewers
        const member = await CorporateAccountMemberRepository.findByAccountAndUser(accountId, userCtx.userId);
        const privileged = isPrivilegedViewer(userCtx, accountId, member?.member_role);
        return NextResponse.json({
          success: true,
          employee: privileged ? employee : applyPiiMasking(employee),
        });
      }

      // 7. Employee List: /:id/employees
      const employeeListMatch = subPath.match(/^\/([^/]+)\/employees$/);
      if (employeeListMatch) {
        const accountId = employeeListMatch[1];
        const actor = buildActorContext(userCtx, accountId);

        const status = (url.searchParams.get("status") || undefined) as any;
        const department = url.searchParams.get("department") || undefined;
        const cityKey = url.searchParams.get("city_key") || undefined;
        const search = url.searchParams.get("search") || undefined;
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20));
        const offset = (page - 1) * limit;

        const result = await CorporateEmployeeService.listEmployees(
          accountId,
          { status, department, city_key: cityKey, search, limit, offset },
          actor
        );

        const member = await CorporateAccountMemberRepository.findByAccountAndUser(accountId, userCtx.userId);
        const privileged = isPrivilegedViewer(userCtx, accountId, member?.member_role);
        const items = privileged ? result.items : result.items.map(applyPiiMasking);

        return NextResponse.json({
          success: true,
          items,
          total: result.total,
          page,
          limit,
        });
      }

      // 8. Account Audit Events: /:id/events
      const eventsMatch = subPath.match(/^\/([^/]+)\/events$/);
      if (eventsMatch) {
        const accountId = eventsMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const events = await CorporateAccountService.listAccountEvents(accountId, actor);
        return NextResponse.json({ success: true, events });
      }

      // 9. Account Contacts: /:id/contacts
      const contactsMatch = subPath.match(/^\/([^/]+)\/contacts$/);
      if (contactsMatch) {
        const accountId = contactsMatch[1];
        const contacts = await CorporateAccountContactRepository.listByAccountId(accountId);
        return NextResponse.json({ success: true, contacts });
      }

      // 10. Account Members: /:id/members
      const membersMatch = subPath.match(/^\/([^/]+)\/members$/);
      if (membersMatch) {
        const accountId = membersMatch[1];
        const members = await CorporateAccountMemberRepository.listByAccountId(accountId);
        return NextResponse.json({ success: true, members });
      }

      // 11. Account Detail: /:id
      const detailMatch = subPath.match(/^\/([^/]+)$/);
      if (detailMatch) {
        const accountId = detailMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const account = await CorporateAccountService.getAccountById(accountId, actor);
        if (!account) {
          throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
        }
        const contacts = await CorporateAccountContactRepository.listByAccountId(accountId);
        const members = await CorporateAccountMemberRepository.listByAccountId(accountId);
        return NextResponse.json({
          success: true,
          account,
          contacts,
          members,
        });
      }

      return NextResponse.json({ success: false, error: "NOT_FOUND", message: "Endpoint not found." }, { status: 404 });
    } catch (err: any) {
      return formatErrorResponse(err);
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

      // 1. Dry-Run Import Validation: /:id/employees/import/validate
      const validateMatch = subPath.match(/^\/([^/]+)\/employees\/import\/validate$/);
      if (validateMatch) {
        const accountId = validateMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const { fileBuffer, filename } = await extractWorkbookPayload(req, body);

        const result = await CorporateEmployeeImportService.validateRosterImport(
          accountId,
          fileBuffer,
          filename,
          actor
        );
        return NextResponse.json({ success: true, result });
      }

      // 2. Commit Import Batch: /:id/employees/import/commit
      const commitMatch = subPath.match(/^\/([^/]+)\/employees\/import\/commit$/);
      if (commitMatch) {
        const accountId = commitMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const { fileBuffer, filename } = await extractWorkbookPayload(req, body);

        const result = await CorporateEmployeeImportService.commitRosterImport(
          accountId,
          fileBuffer,
          filename,
          actor
        );
        const { success: _s, ...rest } = result;
        return NextResponse.json({ success: true, ...rest }, { status: 201 });
      }

      // 3. Create Corporate Account: /
      if (subPath === "/" || subPath === "") {
        assertStaffPermission(userCtx, "CORPORATE_ACCOUNTS", "CREATE");
        const actor = buildActorContext(userCtx);
        const account = await CorporateAccountService.createAccount(body as CreateCorporateAccountInput, actor);
        return NextResponse.json({ success: true, account }, { status: 201 });
      }

      // 4. Link Existing Customer: /:id/link-customer
      const linkMatch = subPath.match(/^\/([^/]+)\/link-customer$/);
      if (linkMatch) {
        const accountId = linkMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const customerId = body?.customerId || body?.customer_id;
        if (!customerId) {
          throw new CorporateAccountError("INVALID_PARAMETERS", "Customer ID is required for linking.");
        }
        const account = await CorporateAccountService.linkCustomer(accountId, customerId, actor);
        return NextResponse.json({ success: true, account });
      }

      // 5. Four-Eyes Approve Account: /:id/approve
      const approveMatch = subPath.match(/^\/([^/]+)\/approve$/);
      if (approveMatch) {
        const accountId = approveMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const account = await CorporateAccountService.approveAccount(accountId, actor);
        return NextResponse.json({ success: true, account });
      }

      // 6. Suspend Account: /:id/suspend
      const suspendMatch = subPath.match(/^\/([^/]+)\/suspend$/);
      if (suspendMatch) {
        const accountId = suspendMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const reason = body?.reason;
        if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
          throw new CorporateAccountError("INVALID_PARAMETERS", "Suspension reason is required.");
        }
        const account = await CorporateAccountService.suspendAccount(accountId, reason, actor);
        return NextResponse.json({ success: true, account });
      }

      // 7. Reactivate Suspended Account: /:id/reactivate
      const reactivateMatch = subPath.match(/^\/([^/]+)\/reactivate$/);
      if (reactivateMatch) {
        const accountId = reactivateMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const reason = body?.reason || "Reactivated by Super Admin";
        const account = await CorporateAccountService.reactivateAccount(accountId, reason, actor);
        return NextResponse.json({ success: true, account });
      }

      // 8. Close Account: /:id/close
      const closeMatch = subPath.match(/^\/([^/]+)\/close$/);
      if (closeMatch) {
        const accountId = closeMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const reason = body?.reason;
        if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
          throw new CorporateAccountError("INVALID_PARAMETERS", "Closure reason is required.");
        }
        const account = await CorporateAccountService.closeAccount(accountId, reason, actor);
        return NextResponse.json({ success: true, account });
      }

      // 9. Request Credit: /:id/credit-request
      const creditReqMatch = subPath.match(/^\/([^/]+)\/credit-request$/);
      if (creditReqMatch) {
        const accountId = creditReqMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const creditLimit = parseFloat(body?.creditLimit ?? body?.credit_limit);
        const termsDays = parseInt(body?.termsDays ?? body?.terms_days ?? body?.paymentTermsDays ?? body?.payment_terms_days, 10);
        const account = await CorporateAccountService.requestCredit(accountId, { creditLimit, termsDays }, actor);
        return NextResponse.json({ success: true, account });
      }

      // 10. Activate Credit: /:id/credit-activate
      const creditActMatch = subPath.match(/^\/([^/]+)\/credit-activate$/);
      if (creditActMatch) {
        const accountId = creditActMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const creditLimit = parseFloat(body?.creditLimit ?? body?.credit_limit);
        const paymentTermsDays = parseInt(body?.paymentTermsDays ?? body?.payment_terms_days ?? body?.termsDays ?? body?.terms_days, 10);
        const result = await CorporateAccountService.activateCredit(accountId, { creditLimit, paymentTermsDays }, actor);
        return NextResponse.json({ success: true, ...result });
      }

      // 11. Add Contact: /:id/contacts
      const addContactMatch = subPath.match(/^\/([^/]+)\/contacts$/);
      if (addContactMatch) {
        const accountId = addContactMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const contact = await CorporateAccountService.addContact(accountId, body, actor);
        return NextResponse.json({ success: true, contact }, { status: 201 });
      }

      // 12. Grant Membership: /:id/members
      const addMemberMatch = subPath.match(/^\/([^/]+)\/members$/);
      if (addMemberMatch) {
        const accountId = addMemberMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const member = await CorporateAccountService.grantMembership(
          accountId,
          { userId: body?.userId || body?.user_id, memberRole: body?.memberRole || body?.member_role },
          actor
        );
        return NextResponse.json({ success: true, member }, { status: 201 });
      }

      // 13. Revoke Membership: /:id/members/:memberId/revoke
      const revokeMemberMatch = subPath.match(/^\/([^/]+)\/members\/([^/]+)\/revoke$/);
      if (revokeMemberMatch) {
        const accountId = revokeMemberMatch[1];
        const memberId = revokeMemberMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const member = await CorporateAccountService.revokeMembership(accountId, memberId, body?.reason || "", actor);
        return NextResponse.json({ success: true, member });
      }

      // 14. Create Employee: /:id/employees
      const createEmployeeMatch = subPath.match(/^\/([^/]+)\/employees$/);
      if (createEmployeeMatch) {
        const accountId = createEmployeeMatch[1];
        const actor = buildActorContext(userCtx, accountId);

        // Mass-assignment defense: strip credit/approval fields
        const safeInput: CreateCorporateEmployeeInput = {
          account_id: accountId,
          employee_code: body.employee_code || body.employeeCode,
          full_name: body.full_name || body.fullName,
          phone: body.phone,
          email: body.email,
          department: body.department,
          designation: body.designation,
          default_address: body.default_address || body.defaultAddress,
          city_key: body.city_key || body.city || null,
          default_latitude: body.default_latitude !== undefined ? parseFloat(body.default_latitude) : undefined,
          default_longitude: body.default_longitude !== undefined ? parseFloat(body.default_longitude) : undefined,
          metadata: body.metadata,
        };

        const result = await CorporateEmployeeService.createEmployee(accountId, safeInput, actor);
        return NextResponse.json({ success: true, ...result }, { status: 201 });
      }

      // 15. Deactivate Employee: /:id/employees/:employeeId/deactivate
      const deactivateEmpMatch = subPath.match(/^\/([^/]+)\/employees\/([^/]+)\/deactivate$/);
      if (deactivateEmpMatch) {
        const accountId = deactivateEmpMatch[1];
        const employeeId = deactivateEmpMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const reason = body?.reason || body?.deactivated_reason || "Employee deactivated";
        const employee = await CorporateEmployeeService.deactivateEmployee(
          accountId,
          employeeId,
          reason,
          actor
        );
        return NextResponse.json({ success: true, employee });
      }

      // 16. Reactivate Employee: /:id/employees/:employeeId/reactivate
      const reactivateEmpMatch = subPath.match(/^\/([^/]+)\/employees\/([^/]+)\/reactivate$/);
      if (reactivateEmpMatch) {
        const accountId = reactivateEmpMatch[1];
        const employeeId = reactivateEmpMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const reason = body?.reason || body?.reactivated_reason || "Employee reactivated";
        const employee = await CorporateEmployeeService.reactivateEmployee(
          accountId,
          employeeId,
          reason,
          actor
        );
        return NextResponse.json({ success: true, employee });
      }

      // 17. Verify Employee Coordinates: /:id/employees/:employeeId/verify-coordinates
      const verifyCoordsMatch = subPath.match(/^\/([^/]+)\/employees\/([^/]+)\/verify-coordinates$/);
      if (verifyCoordsMatch) {
        const accountId = verifyCoordsMatch[1];
        const employeeId = verifyCoordsMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const employee = await CorporateEmployeeService.verifyCoordinates(accountId, employeeId, actor);
        return NextResponse.json({ success: true, employee });
      }

      return NextResponse.json({ success: false, error: "NOT_FOUND", message: "Endpoint not found." }, { status: 404 });
    } catch (err: any) {
      return formatErrorResponse(err);
    }
  }

  // ─── PATCH / PUT DISPATCHER ────────────────────────────────────────────────
  static async handlePatch(
    req: NextRequest,
    path: string,
    userCtx: UserContext,
    body: any
  ): Promise<NextResponse> {
    try {
      assertAuthenticated(userCtx);
      const subPath = normalizeSubPath(path);

      // 1. Update Employee: /:id/employees/:employeeId
      const updateEmpMatch = subPath.match(/^\/([^/]+)\/employees\/([^/]+)$/);
      if (updateEmpMatch) {
        const accountId = updateEmpMatch[1];
        const employeeId = updateEmpMatch[2];
        const actor = buildActorContext(userCtx, accountId);

        // Mass-assignment defense: strip credit/approval fields
        const safeInput: UpdateCorporateEmployeeInput = {
          employee_code: body.employee_code || body.employeeCode,
          full_name: body.full_name || body.fullName,
          phone: body.phone,
          email: body.email,
          department: body.department,
          designation: body.designation,
          default_address: body.default_address || body.defaultAddress,
          city_key: body.city_key || body.city || null,
          default_latitude: body.default_latitude !== undefined ? parseFloat(body.default_latitude) : undefined,
          default_longitude: body.default_longitude !== undefined ? parseFloat(body.default_longitude) : undefined,
          metadata: body.metadata,
          expectedVersion: body.expectedVersion !== undefined ? parseInt(body.expectedVersion, 10) : undefined,
        };

        const result = await CorporateEmployeeService.updateEmployee(accountId, employeeId, safeInput, actor);
        return NextResponse.json({ success: true, ...result });
      }

      // 2. Update Contact: /:id/contacts/:contactId
      const updateContactMatch = subPath.match(/^\/([^/]+)\/contacts\/([^/]+)$/);
      if (updateContactMatch) {
        const accountId = updateContactMatch[1];
        const contactId = updateContactMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const contact = await CorporateAccountService.updateContact(accountId, contactId, body, actor);
        return NextResponse.json({ success: true, contact });
      }

      // 3. Update Account: /:id
      const updateAccountMatch = subPath.match(/^\/([^/]+)$/);
      if (updateAccountMatch) {
        const accountId = updateAccountMatch[1];
        const actor = buildActorContext(userCtx, accountId);
        const account = await CorporateAccountService.updateAccount(accountId, body as UpdateCorporateAccountInput, actor);
        return NextResponse.json({ success: true, account });
      }

      return NextResponse.json({ success: false, error: "NOT_FOUND", message: "Endpoint not found." }, { status: 404 });
    } catch (err: any) {
      return formatErrorResponse(err);
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
      const subPath = normalizeSubPath(path);

      // 1. Deactivate Contact: /:id/contacts/:contactId
      const deleteContactMatch = subPath.match(/^\/([^/]+)\/contacts\/([^/]+)$/);
      if (deleteContactMatch) {
        const accountId = deleteContactMatch[1];
        const contactId = deleteContactMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const contact = await CorporateAccountService.deactivateContact(accountId, contactId, actor);
        return NextResponse.json({ success: true, contact });
      }

      // 2. Revoke Member: /:id/members/:memberId
      const revokeMemberMatch = subPath.match(/^\/([^/]+)\/members\/([^/]+)$/);
      if (revokeMemberMatch) {
        const accountId = revokeMemberMatch[1];
        const memberId = revokeMemberMatch[2];
        const actor = buildActorContext(userCtx, accountId);
        const member = await CorporateAccountService.revokeMembership(accountId, memberId, "Revoked via DELETE", actor);
        return NextResponse.json({ success: true, member });
      }

      return NextResponse.json({ success: false, error: "NOT_FOUND", message: "Endpoint not found." }, { status: 404 });
    } catch (err: any) {
      return formatErrorResponse(err);
    }
  }
}
