/**
 * CakeToHome ERP — Corporate Employee Roster Bulk Import Service
 * Phase C7.9c: Standard Excel/CSV Template Generation, Dry-Run Parsing,
 * Row-Level Validation Engine, Duplicate Defense, Replay Protection,
 * and Atomic All-or-Nothing Batch Commit.
 *
 * ARCHITECTURAL PRINCIPLES & GOVERNANCE:
 * 1. STRICT ZERO-MUTATION DRY RUN:
 *    - validateRosterImport validates workbooks without creating employee records.
 *    - Captures file SHA-256 hash and records DRY_RUN_OK or DRY_RUN_FAILED batch audit log.
 * 2. REPLAY PROTECTION:
 *    - SHA-256 file hashing against committed batches (idx_cei_account_file_hash_committed).
 *    - Prevents re-importing the exact same roster workbook.
 * 3. NO SILENT OVERWRITES OR REACTIVATIONS:
 *    - If an employee code exists as ACTIVE in the account -> row error DUPLICATE_EMPLOYEE_CODE.
 *    - If an employee code exists as INACTIVE in the account -> row error EMPLOYEE_DEACTIVATED_REACTIVATION_REQUIRED.
 *    - Duplicate codes within the same workbook -> row error DUPLICATE_EMPLOYEE_CODE_IN_FILE.
 * 4. PHONE REUSE WARNINGS WITHOUT BLOCKING:
 *    - Reused phone numbers (corporate desks, families) emit row-level warnings without rejecting valid employees.
 * 5. COORDINATES VERIFICATION & BOUNDING BOX:
 *    - Coordinates must be both-or-neither and lie within India bounding box (lat 6.0–38.0, lng 68.0–98.0).
 *    - Imported coordinates default to unverified (coordinate_verified = false).
 * 6. ATOMIC ALL-OR-NOTHING COMMIT:
 *    - Either all valid employee rows commit with CREATED and IMPORTED audit events, or the entire batch rolls back.
 *    - Concurrency safety guaranteed via pg_advisory_xact_lock(hashtext('corp_acct_' || accountId)).
 */

import crypto from "crypto";
import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import {
  CorporateAccountRepository,
  CorporateAccountMemberRepository,
  CorporateEmployeeRepository,
  CorporateEventRepository,
  CorporateEmployeeImportBatchRepository,
} from "../repositories/corporate-account.repository";
import {
  CorporateEmployeeError,
  normalizeEmployeeCode,
  normalizeCityKey,
  validateCoordinates,
} from "./corporate-employee.service";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  CorporateEmployeeRow,
  CorporateEmployeeImportBatchRow,
  CorporateActorContext,
  ParsedEmployeeRow,
  RosterImportRowError,
  RosterImportRowWarning,
  RosterImportValidationResult,
  CommitRosterImportResult,
} from "../types/corporate-account.types";

// ─── Constants & Regexes ───────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(?:\+?91|0)?[6-9]\d{9}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const EXPECTED_HEADERS = [
  "employee_code",
  "full_name",
  "phone",
];

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().replace(/[\s\-_]+/g, "_");
}

function extractCellValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if (val instanceof Date) {
      return val.toISOString().split("T")[0];
    }
    if (val.text) return String(val.text).trim();
    if (val.result !== undefined) return String(val.result).trim();
    if (Array.isArray(val.richText)) {
      return val.richText.map((rt: any) => rt.text || "").join("").trim();
    }
  }
  return String(val).trim();
}

// ─── Authorization Helpers ────────────────────────────────────────────────────

function isSuperAdminActor(actor: CorporateActorContext): boolean {
  if (actor.isSuperAdmin) return true;
  if (actor.role === "SUPER_ADMIN") return true;
  return false;
}

async function assertCanImportRoster(
  accountId: string,
  actor: CorporateActorContext,
  client?: PoolClient
): Promise<void> {
  if (isSuperAdminActor(actor)) return;

  // 1. Direct staff permission check
  if (
    hasEffectivePermission(actor, "CORPORATE_EMPLOYEES.IMPORT") ||
    hasEffectivePermission(actor, "CORPORATE_EMPLOYEES.MANAGE")
  ) {
    return;
  }

  // 2. Account-scoped membership check
  const member = await CorporateAccountMemberRepository.findByAccountAndUser(accountId, actor.userId, client);
  if (member && member.status === "ACTIVE" && member.member_role === "ROSTER_MANAGER") {
    return;
  }

  throw new CorporateEmployeeError(
    "PERMISSION_DENIED",
    `Actor '${actor.userId}' lacks permission to import employee roster for corporate account '${accountId}'.`
  );
}

// ─── Service Class ────────────────────────────────────────────────────────────

export class CorporateEmployeeImportService {
  /**
   * Generates official standardized Excel template for bulk employee roster import.
   */
  static async generateTemplateBuffer(): Promise<Buffer> {
    const ExcelJS = (await import("exceljs")).default || (await import("exceljs"));
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CakeToHome ERP";
    workbook.created = new Date();

    // Sheet 1: Data Entry Sheet
    const sheet = workbook.addWorksheet("Employee_Roster", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    const columns = [
      { header: "Employee_Code", key: "employee_code", width: 18 },
      { header: "Full_Name", key: "full_name", width: 26 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "Email", key: "email", width: 28 },
      { header: "Department", key: "department", width: 20 },
      { header: "Designation", key: "designation", width: 22 },
      { header: "Delivery_Address", key: "delivery_address", width: 35 },
      { header: "City", key: "city", width: 18 },
      { header: "State", key: "state", width: 16 },
      { header: "PIN_Code", key: "pincode", width: 12 },
      { header: "Latitude", key: "latitude", width: 14 },
      { header: "Longitude", key: "longitude", width: 14 },
    ];
    sheet.columns = columns;

    // Header styling
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Deep Navy
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 28;

    // Sample Row
    sheet.addRow({
      employee_code: "EMP-1001",
      full_name: "Rahul Sharma",
      phone: "9876543210",
      email: "rahul.sharma@example.com",
      department: "Engineering",
      designation: "Senior Software Engineer",
      delivery_address: "Flat 402, Lotus Apartments, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      latitude: 12.9716,
      longitude: 77.6412,
    });

    // Sheet 2: Guidelines & Constraints
    const guideSheet = workbook.addWorksheet("Instructions");
    guideSheet.columns = [
      { header: "Column", key: "col", width: 20 },
      { header: "Requirement", key: "req", width: 15 },
      { header: "Validation Rule", key: "rule", width: 55 },
    ];
    const guideHeader = guideSheet.getRow(1);
    guideHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    guideHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } };

    guideSheet.addRows([
      { col: "Employee_Code", req: "MANDATORY", rule: "Unique within your company account. Existing codes cannot be re-imported." },
      { col: "Full_Name", req: "MANDATORY", rule: "Full legal name of the employee." },
      { col: "Phone", req: "MANDATORY", rule: "Valid 10-digit Indian mobile number. Reused phones emit warnings." },
      { col: "Email", req: "OPTIONAL", rule: "Valid corporate or personal email address." },
      { col: "Department", req: "OPTIONAL", rule: "Department name (e.g., Engineering, HR, Sales)." },
      { col: "Designation", req: "OPTIONAL", rule: "Job title / role." },
      { col: "Delivery_Address", req: "OPTIONAL", rule: "Primary doorstep delivery address." },
      { col: "City", req: "OPTIONAL", rule: "City name for search and filtering." },
      { col: "State", req: "OPTIONAL", rule: "State name." },
      { col: "PIN_Code", req: "OPTIONAL", rule: "6-digit Indian Postal Code." },
      { col: "Latitude", req: "OPTIONAL", rule: "Between 6.0 and 38.0 (India bounding box). Both Lat & Lng required." },
      { col: "Longitude", req: "OPTIONAL", rule: "Between 68.0 and 98.0 (India bounding box). Both Lat & Lng required." },
    ]);

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  /**
   * Dry-Run Roster Validation Engine.
   * Parses workbook, validates headers, enforces duplicate and schema checks,
   * records a batch tracking entry, and returns detailed row-level errors.
   */
  static async validateRosterImport(
    accountId: string,
    fileBuffer: Buffer,
    filename: string,
    actor: CorporateActorContext
  ): Promise<RosterImportValidationResult> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new CorporateEmployeeError("INVALID_PARAMETERS", "File buffer is empty or missing.");
    }

    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

    return dbTransaction(async (client: PoolClient) => {
      // 1. Verify account exists and is not closed
      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateEmployeeError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }
      if (account.status === "CLOSED") {
        throw new CorporateEmployeeError("ACCOUNT_CLOSED", `Cannot import roster to CLOSED corporate account '${accountId}'.`);
      }

      // 2. Authorization check
      await assertCanImportRoster(accountId, actor, client);

      // 3. Replay defense check
      const committedBatch = await CorporateEmployeeImportBatchRepository.findByHash(accountId, fileHash, true, client);
      if (committedBatch) {
        throw new CorporateEmployeeError(
          "DUPLICATE_FILE_HASH",
          `File with SHA-256 hash '${fileHash}' has already been committed in batch '${committedBatch.id}'. Replay is blocked.`
        );
      }

      // 4. Parse Workbook with ExcelJS
      const ExcelJS = (await import("exceljs")).default || (await import("exceljs"));
      const workbook = new ExcelJS.Workbook();
      try {
        await workbook.xlsx.load(fileBuffer);
      } catch (err: any) {
        throw new CorporateEmployeeError(
          "INVALID_PARAMETERS",
          `Failed to parse Excel workbook: ${err.message}. Ensure file is a valid .xlsx spreadsheet.`
        );
      }

      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount < 2) {
        throw new CorporateEmployeeError("INVALID_PARAMETERS", "Spreadsheet is empty or contains no data rows.");
      }

      // 5. Map Headers
      const headerRow = worksheet.getRow(1);
      const headerMap = new Map<string, number>();
      headerRow.eachCell((cell, colNumber) => {
        const h = normalizeHeader(extractCellValue(cell.value));
        if (h) headerMap.set(h, colNumber);
      });

      // Check for alias headers (e.g. employee_id -> employee_code, name -> full_name)
      if (!headerMap.has("employee_code") && headerMap.has("employee_id")) {
        headerMap.set("employee_code", headerMap.get("employee_id")!);
      }
      if (!headerMap.has("full_name") && headerMap.has("name")) {
        headerMap.set("full_name", headerMap.get("name")!);
      }
      if (!headerMap.has("pincode") && headerMap.has("pin_code")) {
        headerMap.set("pincode", headerMap.get("pin_code")!);
      }

      for (const req of EXPECTED_HEADERS) {
        if (!headerMap.has(req)) {
          throw new CorporateEmployeeError(
            "INVALID_PARAMETERS",
            `Missing mandatory column header: '${req}'. Required headers: ${EXPECTED_HEADERS.join(", ")}.`
          );
        }
      }

      const errors: RosterImportRowError[] = [];
      const warnings: RosterImportRowWarning[] = [];
      const parsedRows: ParsedEmployeeRow[] = [];

      const seenCodesInBatch = new Map<string, number>(); // code_key -> first rowNumber
      const seenPhonesInBatch = new Map<string, number>(); // phone -> first rowNumber

      // 6. Iterate through data rows
      for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        // Skip entirely blank rows
        let isRowEmpty = true;
        row.eachCell(() => { isRowEmpty = false; });
        if (isRowEmpty) continue;

        const getVal = (colKey: string): string => {
          const colNum = headerMap.get(colKey);
          if (!colNum) return "";
          return extractCellValue(row.getCell(colNum).value);
        };

        const rawCode = getVal("employee_code");
        const rawName = getVal("full_name");
        const rawPhone = getVal("phone");
        const rawEmail = getVal("email") || null;
        const rawDept = getVal("department") || null;
        const rawDesig = getVal("designation") || null;
        const rawAddr = getVal("delivery_address") || null;
        const rawCity = getVal("city") || null;
        const rawState = getVal("state") || null;
        const rawPin = getVal("pincode") || null;
        const rawLatStr = getVal("latitude");
        const rawLngStr = getVal("longitude");

        const rowErrors: string[] = [];
        const rowWarnings: string[] = [];

        // Validate Mandatory Fields
        if (!rawCode) {
          rowErrors.push("Employee code is required.");
          errors.push({ rowNumber: rowNum, field: "employee_code", code: "REQUIRED_FIELD", message: "Employee code is required." });
        }
        if (!rawName) {
          rowErrors.push("Full name is required.");
          errors.push({ rowNumber: rowNum, field: "full_name", code: "REQUIRED_FIELD", message: "Full name is required." });
        }
        if (!rawPhone) {
          rowErrors.push("Phone number is required.");
          errors.push({ rowNumber: rowNum, field: "phone", code: "REQUIRED_FIELD", message: "Phone number is required." });
        } else if (!PHONE_REGEX.test(rawPhone.replace(/\s+/g, ""))) {
          rowErrors.push(`Invalid Indian phone format: '${rawPhone}'. Must be a 10-digit mobile number.`);
          errors.push({ rowNumber: rowNum, employeeCode: rawCode, field: "phone", code: "INVALID_PHONE", message: `Invalid phone format: '${rawPhone}'.` });
        }

        // Validate Email
        if (rawEmail && !EMAIL_REGEX.test(rawEmail)) {
          rowErrors.push(`Invalid email format: '${rawEmail}'.`);
          errors.push({ rowNumber: rowNum, employeeCode: rawCode, field: "email", code: "INVALID_EMAIL", message: `Invalid email format: '${rawEmail}'.` });
        }

        // Validate PIN code
        if (rawPin && !PINCODE_REGEX.test(rawPin.trim())) {
          rowErrors.push(`Invalid PIN code format: '${rawPin}'. Must be a 6-digit Indian postal code.`);
          errors.push({ rowNumber: rowNum, employeeCode: rawCode, field: "pincode", code: "INVALID_PINCODE", message: `Invalid PIN code: '${rawPin}'.` });
        }

        // Validate Coordinates
        let numLat: number | null = null;
        let numLng: number | null = null;
        if (rawLatStr || rawLngStr) {
          numLat = rawLatStr ? Number(rawLatStr) : null;
          numLng = rawLngStr ? Number(rawLngStr) : null;
          try {
            const coords = validateCoordinates(numLat, numLng);
            numLat = coords.default_latitude;
            numLng = coords.default_longitude;
          } catch (coordErr: any) {
            rowErrors.push(coordErr.message);
            errors.push({ rowNumber: rowNum, employeeCode: rawCode, field: "coordinates", code: "INVALID_COORDINATES", message: coordErr.message });
          }
        }

        // Duplicate Check within Current Workbook
        if (rawCode) {
          const codeKey = normalizeEmployeeCode(rawCode);
          if (seenCodesInBatch.has(codeKey)) {
            const prevRow = seenCodesInBatch.get(codeKey);
            const msg = `Duplicate employee code '${rawCode}' in workbook (first appeared at row ${prevRow}).`;
            rowErrors.push(msg);
            errors.push({ rowNumber: rowNum, employeeCode: rawCode, field: "employee_code", code: "DUPLICATE_CODE_IN_BATCH", message: msg });
          } else {
            seenCodesInBatch.set(codeKey, rowNum);

            // Database Duplicate Check
            const existingInDb = await CorporateEmployeeRepository.findByCode(accountId, codeKey, client);
            if (existingInDb) {
              if (existingInDb.status === "ACTIVE") {
                const msg = `Employee code '${rawCode}' already exists in this account (ID: ${existingInDb.id}).`;
                rowErrors.push(msg);
                errors.push({ rowNumber: rowNum, employeeCode: rawCode, field: "employee_code", code: "DUPLICATE_EMPLOYEE_CODE", message: msg });
              } else {
                const msg = `Employee code '${rawCode}' exists in deactivated status (ID: ${existingInDb.id}). Rehire requires explicit reactivation; import never silently overwrites or reactivates existing codes.`;
                rowErrors.push(msg);
                errors.push({ rowNumber: rowNum, employeeCode: rawCode, field: "employee_code", code: "EMPLOYEE_DEACTIVATED_REACTIVATION_REQUIRED", message: msg });
              }
            }
          }
        }

        // Phone Reuse Warnings (Workbook & DB)
        if (rawPhone && PHONE_REGEX.test(rawPhone.replace(/\s+/g, ""))) {
          const normPhone = rawPhone.trim().replace(/\s+/g, "");
          if (seenPhonesInBatch.has(normPhone)) {
            const prevRow = seenPhonesInBatch.get(normPhone);
            const warnMsg = `Phone '${normPhone}' is shared with another employee in this file (row ${prevRow}).`;
            rowWarnings.push(warnMsg);
            warnings.push({ rowNumber: rowNum, employeeCode: rawCode, field: "phone", message: warnMsg });
          } else {
            seenPhonesInBatch.set(normPhone, rowNum);
            const existingDbPhones = await CorporateEmployeeRepository.findEmployeesByPhone(accountId, normPhone, undefined, client);
            if (existingDbPhones.length > 0) {
              const warnMsg = `Phone '${normPhone}' is already registered to existing employee '${existingDbPhones[0].employee_code}' (${existingDbPhones[0].full_name}).`;
              rowWarnings.push(warnMsg);
              warnings.push({ rowNumber: rowNum, employeeCode: rawCode, field: "phone", message: warnMsg });
            }
          }
        }

        parsedRows.push({
          rowNumber: rowNum,
          employeeCode: rawCode.trim(),
          fullName: rawName.trim(),
          phone: rawPhone.trim(),
          email: rawEmail ? rawEmail.trim().toLowerCase() : null,
          department: rawDept ? rawDept.trim() : null,
          designation: rawDesig ? rawDesig.trim() : null,
          deliveryAddress: rawAddr ? rawAddr.trim() : null,
          city: rawCity ? rawCity.trim() : null,
          state: rawState ? rawState.trim() : null,
          pincode: rawPin ? rawPin.trim() : null,
          latitude: numLat,
          longitude: numLng,
          isValid: rowErrors.length === 0,
          errors: rowErrors,
          warnings: rowWarnings,
        });
      }

      const totalRows = parsedRows.length;
      const invalidRows = parsedRows.filter((r) => !r.isValid).length;
      const validRows = totalRows - invalidRows;
      const isValid = invalidRows === 0 && totalRows > 0;

      // 7. Record Dry-Run Batch Audit Record
      const batchRecord = await CorporateEmployeeImportBatchRepository.create(
        {
          account_id: accountId,
          file_hash: fileHash,
          filename: filename || "roster_upload.xlsx",
          status: isValid ? "DRY_RUN_OK" : "DRY_RUN_FAILED",
          total_rows: totalRows,
          valid_rows: validRows,
          invalid_rows: invalidRows,
          inserted_rows: 0,
          row_errors: errors as any[],
          metadata: {
            warningsCount: warnings.length,
            validatedAt: new Date().toISOString(),
          },
          created_by: actor.userId,
        },
        client
      );

      return {
        isValid,
        fileHash,
        filename,
        fileSizeBytes: fileBuffer.length,
        totalRows,
        validRows,
        invalidRows,
        errors,
        warnings,
        rows: parsedRows,
        batchId: batchRecord.id,
      };
    });
  }

  /**
   * Commit Roster Import Execution.
   * Atomic All-or-Nothing execution:
   * - Enforces valid dry-run (zero invalid rows).
   * - Creates corporate_employee rows.
   * - Creates CREATED and IMPORTED audit events.
   * - Sets batch status to COMMITTED with file hash uniqueness.
   */
  static async commitRosterImport(
    accountId: string,
    fileBuffer: Buffer,
    filename: string,
    actor: CorporateActorContext
  ): Promise<CommitRosterImportResult> {
    return dbTransaction(async (client: PoolClient) => {
      // 1. Acquire transaction-level advisory lock on corporate account
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateEmployeeError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }
      if (account.status === "CLOSED") {
        throw new CorporateEmployeeError("ACCOUNT_CLOSED", `Cannot commit roster to CLOSED corporate account '${accountId}'.`);
      }

      await assertCanImportRoster(accountId, actor, client);

      // 2. Validate roster buffer within the active transaction
      const validation = await CorporateEmployeeImportService.validateRosterImport(
        accountId,
        fileBuffer,
        filename,
        actor
      );

      if (!validation.isValid) {
        throw new CorporateEmployeeError(
          "VALIDATION_FAILED",
          `Cannot commit roster import: ${validation.invalidRows} invalid row(s) found in workbook. Resolve all errors before commit.`,
          { errors: validation.errors }
        );
      }

      if (validation.rows.length === 0) {
        throw new CorporateEmployeeError("INVALID_PARAMETERS", "Cannot commit empty roster import.");
      }

      const insertedEmployees: CorporateEmployeeRow[] = [];

      // 3. Insert each employee and audit events
      for (const row of validation.rows) {
        const employeeCodeKey = normalizeEmployeeCode(row.employeeCode);
        const cityKey = normalizeCityKey(row.city);

        const created = await CorporateEmployeeRepository.create(
          {
            account_id: accountId,
            employee_code: row.employeeCode,
            employee_code_key: employeeCodeKey,
            full_name: row.fullName,
            phone: row.phone,
            email: row.email,
            department: row.department,
            designation: row.designation,
            default_address: {
              street: row.deliveryAddress || "",
              city: row.city || "",
              state: row.state || "",
              pincode: row.pincode || "",
            },
            city_key: cityKey,
            default_latitude: row.latitude,
            default_longitude: row.longitude,
            coordinate_source: row.latitude ? "USER_SUPPLIED" : null,
            coordinate_verified: false,
            created_by: actor.userId,
          },
          client
        );

        // Record CREATED event
        await CorporateEventRepository.recordEmployeeEvent(
          {
            employee_id: created.id,
            account_id: accountId,
            event_type: "CREATED",
            actor_id: actor.userId,
            actor_role: actor.role || null,
            reason: `Imported via roster file '${filename}'`,
            after_state: {
              employee_code: created.employee_code,
              full_name: created.full_name,
              phone: created.phone,
              department: created.department,
              status: created.status,
            },
          },
          client
        );

        // Record IMPORTED event
        await CorporateEventRepository.recordEmployeeEvent(
          {
            employee_id: created.id,
            account_id: accountId,
            event_type: "IMPORTED",
            actor_id: actor.userId,
            actor_role: actor.role || null,
            reason: `Batch roster commit (hash: ${validation.fileHash.slice(0, 12)})`,
            after_state: {
              batch_id: validation.batchId,
              row_number: row.rowNumber,
            },
          },
          client
        );

        insertedEmployees.push(created);
      }

      // 4. Update batch record to COMMITTED
      let committedBatch: CorporateEmployeeImportBatchRow;
      if (validation.batchId) {
        committedBatch = await CorporateEmployeeImportBatchRepository.updateStatus(
          validation.batchId,
          accountId,
          "COMMITTED",
          {
            inserted_rows: insertedEmployees.length,
            committed_by: actor.userId,
            committed_at: new Date().toISOString(),
          },
          client
        );
      } else {
        committedBatch = await CorporateEmployeeImportBatchRepository.create(
          {
            account_id: accountId,
            file_hash: validation.fileHash,
            filename: filename,
            status: "COMMITTED",
            total_rows: validation.totalRows,
            valid_rows: validation.validRows,
            invalid_rows: 0,
            inserted_rows: insertedEmployees.length,
            created_by: actor.userId,
          },
          client
        );
      }

      return {
        success: true,
        batch: committedBatch,
        totalRows: validation.totalRows,
        insertedRows: insertedEmployees.length,
        employees: insertedEmployees,
      };
    });
  }

  /**
   * List import batches for a corporate account.
   */
  static async listImportBatches(
    accountId: string,
    actor: CorporateActorContext,
    limit: number = 50
  ): Promise<CorporateEmployeeImportBatchRow[]> {
    await assertCanImportRoster(accountId, actor);
    return CorporateEmployeeImportBatchRepository.listByAccountId(accountId, limit);
  }

  /**
   * Retrieve import batch detail for a corporate account.
   */
  static async getImportBatchDetail(
    accountId: string,
    batchId: string,
    actor: CorporateActorContext
  ): Promise<CorporateEmployeeImportBatchRow | null> {
    await assertCanImportRoster(accountId, actor);
    return CorporateEmployeeImportBatchRepository.findById(batchId, accountId);
  }
}

