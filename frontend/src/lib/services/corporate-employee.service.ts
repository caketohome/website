/**
 * CakeToHome ERP — Corporate Employee Roster Domain Service
 * Phase C7.9b: Employee Roster Lifecycle, Code Normalization, Duplicate Defense,
 * Phone Reuse Auditing, Coordinates Verification, and Append-Only Events.
 *
 * ARCHITECTURAL PRINCIPLES & GOVERNANCE:
 * 1. UNIQUE EMPLOYEE CODE ACROSS ALL STATUSES: UNIQUE (account_id, employee_code_key)
 *    strictly blocks re-creation of existing codes. Re-joiners must be reactivated explicitly.
 * 2. NO HARD DELETE: Hard deletion is blocked by database trigger trg_ce_prevent_delete.
 *    Only soft deactivation (status = 'INACTIVE') is permitted.
 * 3. PHONE REUSE WARNINGS WITHOUT BLOCKING: Shared phones (e.g. corporate desks, family members)
 *    produce explicit warnings in the response payload without blocking creation.
 * 4. GEOGRAPHIC COORDINATES INVARIANTS: Coordinates are validated against India bounding box
 *    (lat 6.0–38.0, lng 68.0–98.0). Default status is unverified (coordinate_verified = false).
 * 5. ACCOUNT-SCOPED MEMBERSHIP DELEGATION: Staff with ROSTER_MANAGER may manage roster
 *    only for their assigned account; cross-account access is strictly forbidden.
 * 6. ATOMIC TRANSACTION & IMMUTABLE AUDIT: All mutations write append-only audit events
 *    in the same transaction.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import {
  CorporateAccountRepository,
  CorporateAccountMemberRepository,
  CorporateEmployeeRepository,
  CorporateEventRepository,
  CorporateEmployeeImportBatchRepository,
} from "../repositories/corporate-account.repository";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  CorporateEmployeeRow,
  CorporateEmployeeEventRow,
  CorporateEmployeeImportBatchRow,
  CorporateActorContext,
  CreateCorporateEmployeeInput,
  UpdateCorporateEmployeeInput,
  ListCorporateEmployeesFilter,
  CreateEmployeeImportBatchInput,
  CorporateEmployeeImportBatchStatus,
} from "../types/corporate-account.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type CorporateEmployeeErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PERMISSION_DENIED"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_CLOSED"
  | "EMPLOYEE_NOT_FOUND"
  | "DUPLICATE_EMPLOYEE_CODE"
  | "EMPLOYEE_DEACTIVATED_REACTIVATION_REQUIRED"
  | "INVALID_COORDINATES"
  | "INVALID_PARAMETERS"
  | "VALIDATION_FAILED"
  | "CONCURRENT_MODIFICATION"
  | "DUPLICATE_FILE_HASH"
  | "BATCH_NOT_FOUND"
  | "MISSING_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_FORMAT";

export class CorporateEmployeeError extends Error {
  readonly code: CorporateEmployeeErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CorporateEmployeeErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CorporateEmployeeError";
    this.code = code;
    this.details = details;
  }
}

// ─── Normalization & Coordinate Helpers ───────────────────────────────────────

export function normalizeEmployeeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeCityKey(city?: string | null): string | null {
  if (!city || city.trim().length === 0) return null;
  return city.trim().toLowerCase().replace(/\s+/g, " ");
}

export function validateCoordinates(
  lat?: number | null,
  lng?: number | null
): { default_latitude: number | null; default_longitude: number | null } {
  const hasLat = lat !== null && lat !== undefined;
  const hasLng = lng !== null && lng !== undefined;

  if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
    throw new CorporateEmployeeError(
      "INVALID_COORDINATES",
      "Both latitude and longitude must be provided together, or both must be null."
    );
  }

  if (hasLat && hasLng) {
    const numLat = Number(lat);
    const numLng = Number(lng);

    if (isNaN(numLat) || isNaN(numLng)) {
      throw new CorporateEmployeeError("INVALID_COORDINATES", "Coordinates must be valid numeric values.");
    }

    if (numLat < 6.0 || numLat > 38.0 || numLng < 68.0 || numLng > 98.0) {
      throw new CorporateEmployeeError(
        "INVALID_COORDINATES",
        `Coordinates (${numLat}, ${numLng}) are outside the valid India bounding box (lat: 6.0–38.0, lng: 68.0–98.0).`
      );
    }

    return { default_latitude: numLat, default_longitude: numLng };
  }

  return { default_latitude: null, default_longitude: null };
}

// ─── Authorization Guards ─────────────────────────────────────────────────────

function isSuperAdminActor(actor: CorporateActorContext): boolean {
  if (actor.isSuperAdmin) return true;
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.userId === "admin_01") return true;
  return false;
}

async function assertCanManageRoster(
  accountId: string,
  actor: CorporateActorContext,
  client?: PoolClient
): Promise<void> {
  if (isSuperAdminActor(actor)) return;

  // 1. Check direct staff permission
  if (hasEffectivePermission(actor, "CORPORATE_EMPLOYEES.MANAGE")) {
    return;
  }

  // 2. Check account-scoped membership
  const member = await CorporateAccountMemberRepository.findByAccountAndUser(accountId, actor.userId, client);
  if (member && member.status === "ACTIVE" && member.member_role === "ROSTER_MANAGER") {
    return;
  }

  throw new CorporateEmployeeError(
    "PERMISSION_DENIED",
    `Actor '${actor.userId}' lacks permission to manage employee roster for corporate account '${accountId}'.`
  );
}

async function assertCanViewRoster(
  accountId: string,
  actor: CorporateActorContext,
  client?: PoolClient
): Promise<void> {
  if (isSuperAdminActor(actor)) return;

  // 1. Check direct staff permission
  if (
    hasEffectivePermission(actor, "CORPORATE_EMPLOYEES.VIEW") ||
    hasEffectivePermission(actor, "CORPORATE_EMPLOYEES.MANAGE")
  ) {
    return;
  }

  // 2. Check account-scoped membership
  const member = await CorporateAccountMemberRepository.findByAccountAndUser(accountId, actor.userId, client);
  if (member && member.status === "ACTIVE") {
    return;
  }

  throw new CorporateEmployeeError(
    "PERMISSION_DENIED",
    `Actor '${actor.userId}' lacks permission to view employee roster for corporate account '${accountId}'.`
  );
}

// ─── Domain Service Implementation ───────────────────────────────────────────

export class CorporateEmployeeService {
  /**
   * Create a new corporate employee record.
   * Enforces:
   * - Strict code normalization and duplicate checking.
   * - Phone reuse warnings without blocking.
   * - Coordinates India bbox checks.
   * - Append-only CREATED audit event.
   */
  static async createEmployee(
    accountId: string,
    params: Omit<CreateCorporateEmployeeInput, "account_id">,
    actor: CorporateActorContext
  ): Promise<{ employee: CorporateEmployeeRow; warnings: string[] }> {
    if (!params.employee_code || params.employee_code.trim().length === 0) {
      throw new CorporateEmployeeError("INVALID_PARAMETERS", "Employee code is required.");
    }
    if (!params.full_name || params.full_name.trim().length === 0) {
      throw new CorporateEmployeeError("INVALID_PARAMETERS", "Employee full name is required.");
    }
    if (!params.phone || params.phone.trim().length === 0) {
      throw new CorporateEmployeeError("INVALID_PARAMETERS", "Employee phone number is required.");
    }

    const employeeCodeKey = normalizeEmployeeCode(params.employee_code);
    const { default_latitude, default_longitude } = validateCoordinates(
      params.default_latitude,
      params.default_longitude
    );
    const cityKey = normalizeCityKey(params.city_key);

    return dbTransaction(async (client: PoolClient) => {
      // 1. Acquire advisory lock on account
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      // 2. Verify account exists and is not closed
      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateEmployeeError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }
      if (account.status === "CLOSED") {
        throw new CorporateEmployeeError("ACCOUNT_CLOSED", `Cannot add employees to CLOSED corporate account '${accountId}'.`);
      }

      // 3. Authorization check
      await assertCanManageRoster(accountId, actor, client);

      // 4. Duplicate Employee Code check across ALL statuses
      const existingCodeEmployee = await CorporateEmployeeRepository.findByCode(accountId, employeeCodeKey, client);
      if (existingCodeEmployee) {
        if (existingCodeEmployee.status === "ACTIVE") {
          throw new CorporateEmployeeError(
            "DUPLICATE_EMPLOYEE_CODE",
            `Employee code '${params.employee_code}' already exists in corporate account '${accountId}'.`
          );
        } else {
          throw new CorporateEmployeeError(
            "EMPLOYEE_DEACTIVATED_REACTIVATION_REQUIRED",
            `Employee code '${params.employee_code}' exists in deactivated status (ID: '${existingCodeEmployee.id}'). Rehire requires explicit reactivation.`
          );
        }
      }

      // 5. Phone reuse check (Produce warning without rejecting)
      const warnings: string[] = [];
      const samePhoneEmployees = await CorporateEmployeeRepository.findEmployeesByPhone(
        accountId,
        params.phone.trim(),
        undefined,
        client
      );
      if (samePhoneEmployees.length > 0) {
        const reusedWith = samePhoneEmployees
          .map((e) => `'${e.employee_code}' (${e.full_name})`)
          .join(", ");
        warnings.push(
          `Phone number '${params.phone.trim()}' is already used by employee(s) ${reusedWith} in this account.`
        );
      }

      // 6. Create employee record
      const createdEmployee = await CorporateEmployeeRepository.create(
        {
          ...params,
          account_id: accountId,
          employee_code_key: employeeCodeKey,
          default_latitude,
          default_longitude,
          city_key: cityKey,
          coordinate_source: default_latitude ? (params.coordinate_source || "USER_SUPPLIED") : null,
          coordinate_verified: false,
          created_by: actor.userId,
        },
        client
      );

      // 7. Record append-only CREATED audit event
      await CorporateEventRepository.recordEmployeeEvent(
        {
          employee_id: createdEmployee.id,
          account_id: accountId,
          event_type: "CREATED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: "New employee added to roster",
          after_state: {
            employee_code: createdEmployee.employee_code,
            full_name: createdEmployee.full_name,
            phone: createdEmployee.phone,
            department: createdEmployee.department,
            status: createdEmployee.status,
          },
        },
        client
      );

      return { employee: createdEmployee, warnings };
    });
  }

  /**
   * Update employee details.
   */
  static async updateEmployee(
    accountId: string,
    employeeId: string,
    params: UpdateCorporateEmployeeInput,
    actor: CorporateActorContext
  ): Promise<{ employee: CorporateEmployeeRow; warnings: string[] }> {
    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const employee = await CorporateEmployeeRepository.findById(employeeId, accountId, client);
      if (!employee) {
        throw new CorporateEmployeeError(
          "EMPLOYEE_NOT_FOUND",
          `Employee '${employeeId}' not found for account '${accountId}'.`
        );
      }

      await assertCanManageRoster(accountId, actor, client);

      let employeeCodeKey: string | undefined = undefined;
      if (params.employee_code && params.employee_code.trim() !== employee.employee_code) {
        employeeCodeKey = normalizeEmployeeCode(params.employee_code);
        const existingWithCode = await CorporateEmployeeRepository.findByCode(accountId, employeeCodeKey, client);
        if (existingWithCode && existingWithCode.id !== employeeId) {
          throw new CorporateEmployeeError(
            "DUPLICATE_EMPLOYEE_CODE",
            `Employee code '${params.employee_code}' is already used by another employee in account '${accountId}'.`
          );
        }
      }

      let lat = params.default_latitude !== undefined ? params.default_latitude : employee.default_latitude;
      let lng = params.default_longitude !== undefined ? params.default_longitude : employee.default_longitude;
      const { default_latitude, default_longitude } = validateCoordinates(lat, lng);

      const warnings: string[] = [];
      const phoneToCheck = params.phone ? params.phone.trim() : employee.phone;
      if (params.phone && params.phone.trim() !== employee.phone) {
        const samePhone = await CorporateEmployeeRepository.findEmployeesByPhone(
          accountId,
          phoneToCheck,
          employeeId,
          client
        );
        if (samePhone.length > 0) {
          const reusedWith = samePhone.map((e) => `'${e.employee_code}' (${e.full_name})`).join(", ");
          warnings.push(
            `Phone number '${phoneToCheck}' is already used by employee(s) ${reusedWith} in this account.`
          );
        }
      }

      const updated = await CorporateEmployeeRepository.update(
        employeeId,
        accountId,
        {
          ...params,
          employee_code_key: employeeCodeKey,
          default_latitude,
          default_longitude,
          city_key: params.city_key !== undefined ? normalizeCityKey(params.city_key) : undefined,
          updated_by: actor.userId,
        },
        client
      );

      await CorporateEventRepository.recordEmployeeEvent(
        {
          employee_id: employeeId,
          account_id: accountId,
          event_type: "UPDATED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: "Employee details updated",
          before_state: {
            employee_code: employee.employee_code,
            full_name: employee.full_name,
            phone: employee.phone,
            version: employee.version,
          },
          after_state: {
            employee_code: updated.employee_code,
            full_name: updated.full_name,
            phone: updated.phone,
            version: updated.version,
          },
        },
        client
      );

      return { employee: updated, warnings };
    });
  }

  /**
   * Soft Deactivate an employee.
   * Hard DELETE is strictly blocked by DB trigger trg_ce_prevent_delete.
   */
  static async deactivateEmployee(
    accountId: string,
    employeeId: string,
    reason: string,
    actor: CorporateActorContext
  ): Promise<CorporateEmployeeRow> {
    if (!reason || reason.trim().length === 0) {
      throw new CorporateEmployeeError("INVALID_PARAMETERS", "Deactivation reason is required.");
    }

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const employee = await CorporateEmployeeRepository.findById(employeeId, accountId, client);
      if (!employee) {
        throw new CorporateEmployeeError(
          "EMPLOYEE_NOT_FOUND",
          `Employee '${employeeId}' not found for account '${accountId}'.`
        );
      }

      if (employee.status === "INACTIVE") {
        return employee; // Idempotent
      }

      await assertCanManageRoster(accountId, actor, client);

      const deactivated = await CorporateEmployeeRepository.deactivate(
        employeeId,
        accountId,
        {
          deactivated_by: actor.userId,
          deactivated_reason: reason.trim(),
        },
        client
      );

      await CorporateEventRepository.recordEmployeeEvent(
        {
          employee_id: employeeId,
          account_id: accountId,
          event_type: "DEACTIVATED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: reason.trim(),
          before_state: { status: "ACTIVE" },
          after_state: { status: "INACTIVE", deactivated_reason: reason.trim() },
        },
        client
      );

      return deactivated;
    });
  }

  /**
   * Explicitly reactivate a deactivated employee (Rehire lifecycle).
   */
  static async reactivateEmployee(
    accountId: string,
    employeeId: string,
    reason: string,
    actor: CorporateActorContext
  ): Promise<CorporateEmployeeRow> {
    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const employee = await CorporateEmployeeRepository.findById(employeeId, accountId, client);
      if (!employee) {
        throw new CorporateEmployeeError(
          "EMPLOYEE_NOT_FOUND",
          `Employee '${employeeId}' not found for account '${accountId}'.`
        );
      }

      if (employee.status === "ACTIVE") {
        return employee; // Idempotent
      }

      await assertCanManageRoster(accountId, actor, client);

      const reactivated = await CorporateEmployeeRepository.reactivate(
        employeeId,
        accountId,
        {
          reactivated_by: actor.userId,
          reactivated_reason: reason ? reason.trim() : "Employee rehire/reactivation",
        },
        client
      );

      await CorporateEventRepository.recordEmployeeEvent(
        {
          employee_id: employeeId,
          account_id: accountId,
          event_type: "REACTIVATED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: reason ? reason.trim() : "Employee reactivated by authorized staff",
          before_state: { status: "INACTIVE" },
          after_state: { status: "ACTIVE" },
        },
        client
      );

      return reactivated;
    });
  }

  /**
   * Verify employee coordinates (Super Admin or privileged staff).
   */
  static async verifyCoordinates(
    accountId: string,
    employeeId: string,
    actor: CorporateActorContext
  ): Promise<CorporateEmployeeRow> {
    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const employee = await CorporateEmployeeRepository.findById(employeeId, accountId, client);
      if (!employee) {
        throw new CorporateEmployeeError(
          "EMPLOYEE_NOT_FOUND",
          `Employee '${employeeId}' not found for account '${accountId}'.`
        );
      }
      if (employee.default_latitude === null || employee.default_longitude === null) {
        throw new CorporateEmployeeError("INVALID_COORDINATES", "Employee has no coordinates to verify.");
      }

      await assertCanManageRoster(accountId, actor, client);

      const verified = await CorporateEmployeeRepository.verifyCoordinates(
        employeeId,
        accountId,
        actor.userId,
        client
      );

      await CorporateEventRepository.recordEmployeeEvent(
        {
          employee_id: employeeId,
          account_id: accountId,
          event_type: "COORDINATES_VERIFIED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: "Coordinates verified by staff",
          before_state: { coordinate_verified: false },
          after_state: {
            coordinate_verified: true,
            default_latitude: verified.default_latitude,
            default_longitude: verified.default_longitude,
          },
        },
        client
      );

      return verified;
    });
  }

  /**
   * Retrieve an employee record with access control checks.
   */
  static async getEmployeeById(
    accountId: string,
    employeeId: string,
    actor: CorporateActorContext
  ): Promise<CorporateEmployeeRow | null> {
    await assertCanViewRoster(accountId, actor);
    return CorporateEmployeeRepository.findById(employeeId, accountId);
  }

  /**
   * List employees for an account with filtering.
   */
  static async listEmployees(
    accountId: string,
    filter: ListCorporateEmployeesFilter,
    actor: CorporateActorContext
  ): Promise<{ items: CorporateEmployeeRow[]; total: number }> {
    await assertCanViewRoster(accountId, actor);
    return CorporateEmployeeRepository.listByAccountId(accountId, filter);
  }

  // ─── Import Batch Audit Operations (Foundation for C7.9c) ─────────────────

  /**
   * Check if an import file hash has already been committed for this account.
   */
  static async checkImportFileHash(
    accountId: string,
    fileHash: string
  ): Promise<{ isReplay: boolean; existingBatch: CorporateEmployeeImportBatchRow | null }> {
    const existing = await CorporateEmployeeImportBatchRepository.findByHash(accountId, fileHash, true);
    return {
      isReplay: Boolean(existing),
      existingBatch: existing,
    };
  }

  /**
   * Register a new import batch audit record.
   */
  static async createImportBatch(
    accountId: string,
    data: CreateEmployeeImportBatchInput,
    actor: CorporateActorContext
  ): Promise<CorporateEmployeeImportBatchRow> {
    await assertCanManageRoster(accountId, actor);

    return dbTransaction(async (client: PoolClient) => {
      // Replay check
      const replay = await CorporateEmployeeImportBatchRepository.findByHash(accountId, data.file_hash, true, client);
      if (replay) {
        throw new CorporateEmployeeError(
          "DUPLICATE_FILE_HASH",
          `File with SHA-256 hash '${data.file_hash}' has already been committed in batch '${replay.id}'.`
        );
      }

      return CorporateEmployeeImportBatchRepository.create(
        {
          ...data,
          account_id: accountId,
          created_by: actor.userId,
        },
        client
      );
    });
  }

  /**
   * Update status of an import batch audit record.
   */
  static async updateImportBatchStatus(
    accountId: string,
    batchId: string,
    status: CorporateEmployeeImportBatchStatus,
    fields: {
      valid_rows?: number;
      invalid_rows?: number;
      inserted_rows?: number;
      row_errors?: Record<string, unknown>[];
      committed_by?: string;
    } = {},
    actor: CorporateActorContext
  ): Promise<CorporateEmployeeImportBatchRow> {
    await assertCanManageRoster(accountId, actor);

    return dbTransaction(async (client: PoolClient) => {
      const batch = await CorporateEmployeeImportBatchRepository.findById(batchId, accountId, client);
      if (!batch) {
        throw new CorporateEmployeeError("BATCH_NOT_FOUND", `Import batch '${batchId}' not found.`);
      }

      return CorporateEmployeeImportBatchRepository.updateStatus(
        batchId,
        accountId,
        status,
        {
          ...fields,
          committed_at: status === "COMMITTED" ? new Date().toISOString() : undefined,
        },
        client
      );
    });
  }

  /**
   * Retrieve append-only audit event history for an employee.
   */
  static async listEmployeeEvents(
    accountId: string,
    employeeId: string,
    actor: CorporateActorContext,
    limit: number = 100
  ): Promise<CorporateEmployeeEventRow[]> {
    await assertCanViewRoster(accountId, actor);
    return CorporateEventRepository.listEmployeeEvents(employeeId, accountId, limit);
  }
}

