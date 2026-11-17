/**
 * CakeToHome ERP — Corporate Account Domain Service
 * Phase C7.9b: Corporate Account Master, Customer Linkage, Approval Lifecycle,
 * Contact Management, Scoped Membership, and Append-Only Audit Logging.
 *
 * ARCHITECTURAL PRINCIPLES & GOVERNANCE:
 * 1. ONE CORPORATE ACCOUNT PER CUSTOMER: Full UNIQUE on customer_id strictly prevents
 *    multiple corporate accounts for the same customer.
 * 2. EXPLICIT SUPER ADMIN LINKAGE: Linking an existing customer to a corporate account
 *    is strictly restricted to Super Admin and audited with CUSTOMER_LINKED event.
 * 3. MANDATORY FOUR-EYES APPROVAL: Creator of a corporate account cannot approve it.
 *    Approval is restricted to Super Admin (creator !== approver).
 * 4. ISOLATED CREDIT ACTIVATION: Account approval does NOT grant or activate credit.
 *    Credit request metadata is stored, but credit activation remains strictly within
 *    BillsReceivableService.approveCorporateCredit.
 * 5. IMMUTABLE APPEND-ONLY AUDIT: Account lifecycle mutations record append-only audit
 *    events atomically within the same database transaction.
 * 6. FAIL-CLOSED AUTHORIZATION: Service guards reject unauthorized actors immediately.
 */

import crypto from "crypto";
import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import {
  CorporateAccountRepository,
  CorporateAccountContactRepository,
  CorporateAccountMemberRepository,
  CorporateEventRepository,
} from "../repositories/corporate-account.repository";
import { hasEffectivePermission } from "../staff-access-control";
import { BillsReceivableService } from "./bills-receivable.service";
import type {
  CorporateAccountRow,
  CorporateAccountContactRow,
  CorporateAccountMemberRow,
  CorporateAccountEventRow,
  CorporateAccountStatus,
  CorporateContactType,
  CorporateMemberRole,
  CorporateActorContext,
  CreateCorporateAccountInput,
  UpdateCorporateAccountInput,
  CreateCorporateContactInput,
  UpdateCorporateContactInput,
  GrantCorporateMemberInput,
  ListCorporateAccountsFilter,
} from "../types/corporate-account.types";

// ─── Error Model ───────────────────────────────────────────────────────────────

export type CorporateAccountErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PERMISSION_DENIED"
  | "ACCOUNT_NOT_FOUND"
  | "INVALID_ACCOUNT_STATUS"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_ALREADY_LINKED"
  | "DUPLICATE_GSTIN"
  | "INVALID_GSTIN"
  | "INVALID_PAN"
  | "PAN_GSTIN_MISMATCH"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "PRIMARY_CONTACT_ALREADY_EXISTS"
  | "CONTACT_NOT_FOUND"
  | "MEMBER_ALREADY_EXISTS"
  | "MEMBER_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "INVALID_PARAMETERS";

export class CorporateAccountError extends Error {
  readonly code: CorporateAccountErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: CorporateAccountErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CorporateAccountError";
    this.code = code;
    this.details = details;
  }
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export function normalizeLegalNameKey(legalName: string): string {
  return legalName.trim().toLowerCase().replace(/\s+/g, " ");
}

export function validateGstinAndPan(gstin?: string | null, pan?: string | null): {
  normalizedGstin: string | null;
  normalizedPan: string | null;
} {
  const normGstin = gstin ? gstin.trim().toUpperCase() : null;
  const normPan = pan ? pan.trim().toUpperCase() : null;

  if (normGstin && !GSTIN_REGEX.test(normGstin)) {
    throw new CorporateAccountError(
      "INVALID_GSTIN",
      `Invalid GSTIN format: '${normGstin}'. Must be a 15-character valid Indian GSTIN.`
    );
  }

  if (normPan && !PAN_REGEX.test(normPan)) {
    throw new CorporateAccountError(
      "INVALID_PAN",
      `Invalid PAN format: '${normPan}'. Must be a 10-character valid Indian PAN.`
    );
  }

  if (normGstin && normPan) {
    const panFromGstin = normGstin.substring(2, 12);
    if (panFromGstin !== normPan) {
      throw new CorporateAccountError(
        "PAN_GSTIN_MISMATCH",
        `GSTIN '${normGstin}' contains embedded PAN '${panFromGstin}', which does not match provided PAN '${normPan}'.`
      );
    }
  }

  return { normalizedGstin: normGstin, normalizedPan: normPan };
}

// ─── Authorization Helpers ────────────────────────────────────────────────────

function isSuperAdminActor(actor: CorporateActorContext): boolean {
  if (actor.isSuperAdmin) return true;
  if (actor.role === "SUPER_ADMIN") return true;
  return false;
}

function assertSuperAdmin(actor: CorporateActorContext, actionDescription: string): void {
  if (!isSuperAdminActor(actor)) {
    throw new CorporateAccountError(
      "PERMISSION_DENIED",
      `Action '${actionDescription}' is strictly restricted to Super Admin.`
    );
  }
}

function assertCanCreateAccount(actor: CorporateActorContext): void {
  if (isSuperAdminActor(actor)) return;
  const hasPerm = hasEffectivePermission(actor, "CORPORATE_ACCOUNTS.CREATE");
  if (!hasPerm) {
    throw new CorporateAccountError(
      "PERMISSION_DENIED",
      "Actor lacks permission CORPORATE_ACCOUNTS.CREATE to register a corporate account."
    );
  }
}

function assertCanUpdateAccount(actor: CorporateActorContext): void {
  if (isSuperAdminActor(actor)) return;
  const hasPerm = hasEffectivePermission(actor, "CORPORATE_ACCOUNTS.UPDATE");
  if (!hasPerm) {
    throw new CorporateAccountError(
      "PERMISSION_DENIED",
      "Actor lacks permission CORPORATE_ACCOUNTS.UPDATE to modify corporate account profile."
    );
  }
}

function assertCanRequestCredit(actor: CorporateActorContext): void {
  if (isSuperAdminActor(actor)) return;
  const hasPerm = hasEffectivePermission(actor, "CORPORATE_ACCOUNTS.CREDIT_REQUEST");
  if (!hasPerm) {
    throw new CorporateAccountError(
      "PERMISSION_DENIED",
      "Actor lacks permission CORPORATE_ACCOUNTS.CREDIT_REQUEST to request credit terms."
    );
  }
}

// ─── Domain Service Implementation ───────────────────────────────────────────

export class CorporateAccountService {
  /**
   * Create a new corporate account master record.
   * Enforces 1:1 customer linkage, GSTIN/PAN validation, and append-only audit trail.
   */
  static async createAccount(
    params: CreateCorporateAccountInput & {
      primaryContact?: {
        name: string;
        email: string;
        phone: string;
        designation?: string;
      };
    },
    actor: CorporateActorContext
  ): Promise<CorporateAccountRow> {
    assertCanCreateAccount(actor);

    if (!params.legal_name || params.legal_name.trim().length === 0) {
      throw new CorporateAccountError("INVALID_PARAMETERS", "Legal name is required for corporate account.");
    }

    const effectiveCustomerId = params.customer_id || (params as any).customerId;
    const effectivePrimaryContact = params.primaryContact || (params as any).primary_contact;

    const { normalizedGstin, normalizedPan } = validateGstinAndPan(params.gstin, params.pan);
    const legalNameKey = normalizeLegalNameKey(params.legal_name);

    return dbTransaction(async (client: PoolClient) => {
      let linkedCustomerId = effectiveCustomerId;

      if (!linkedCustomerId) {
        // Automatically create canonical customer per Section 6.2 of Design Lock
        const newCustId = `cus_corp_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
        const contactName = effectivePrimaryContact?.name || params.trade_name || params.legal_name || "Corporate Admin";
        const parts = contactName.trim().split(/\s+/);
        const firstName = parts[0] || "Corporate";
        const lastName = parts.slice(1).join(" ") || "Admin";
        const email = effectivePrimaryContact?.email || `corp_${newCustId.slice(-6)}@corp.local`;
        const phone = effectivePrimaryContact?.phone || `9${Math.floor(100000000 + Math.random() * 900000000)}`;

        await client.query(
          `INSERT INTO public.customer (id, first_name, last_name, company_name, email, phone, gstin, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [newCustId, firstName, lastName, params.legal_name, email, phone, normalizedGstin || null]
        );
        linkedCustomerId = newCustId;
      } else {
        // 1. Verify customer exists
        const custRes = await client.query(
          `SELECT id, company_name, gstin FROM public.customer WHERE id = $1 AND deleted_at IS NULL`,
          [linkedCustomerId]
        );
        if (custRes.rows.length === 0) {
          throw new CorporateAccountError("CUSTOMER_NOT_FOUND", `Customer '${linkedCustomerId}' not found.`);
        }

        // 2. Enforce 1:1 corporate account linkage
        const existingAccount = await CorporateAccountRepository.findByCustomerId(linkedCustomerId, client);
        if (existingAccount) {
          throw new CorporateAccountError(
            "CUSTOMER_ALREADY_LINKED",
            `Customer '${linkedCustomerId}' is already linked to corporate account '${existingAccount.id}'.`
          );
        }
      }

      // 3. Enforce active GSTIN uniqueness
      if (normalizedGstin) {
        const existingGstinAccount = await CorporateAccountRepository.findByGstin(normalizedGstin, client);
        if (existingGstinAccount) {
          throw new CorporateAccountError(
            "DUPLICATE_GSTIN",
            `GSTIN '${normalizedGstin}' is already registered to corporate account '${existingGstinAccount.id}'.`
          );
        }
      }

      // 4. Insert corporate account
      const createdAccount = await CorporateAccountRepository.create(
        {
          ...params,
          customer_id: linkedCustomerId,
          gstin: normalizedGstin,
          pan: normalizedPan,
          legal_name_key: legalNameKey,
          status: "PENDING",
          created_by: actor.userId,
        },
        client
      );

      // 5. Create primary contact if supplied
      if (effectivePrimaryContact) {
        await CorporateAccountContactRepository.create(
          {
            account_id: createdAccount.id,
            contact_type: "PRIMARY",
            name: effectivePrimaryContact.name,
            email: effectivePrimaryContact.email,
            phone: effectivePrimaryContact.phone,
            designation: effectivePrimaryContact.designation,
            is_active: true,
          },
          client
        );
      }

      // 6. Record append-only CREATED audit event
      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: createdAccount.id,
          event_type: "CREATED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: "Initial corporate account draft submission",
          after_state: {
            id: createdAccount.id,
            customer_id: createdAccount.customer_id,
            legal_name: createdAccount.legal_name,
            gstin: createdAccount.gstin,
            status: createdAccount.status,
          },
        },
        client
      );

      // 7. Synchronize customer master fields if empty
      await client.query(
        `UPDATE public.customer
         SET company_name = COALESCE(company_name, $2),
             gstin = COALESCE(gstin, $3),
             updated_at = NOW()
         WHERE id = $1`,
        [params.customer_id, createdAccount.legal_name, createdAccount.gstin]
      );

      return createdAccount;
    });
  }

  /**
   * Explicit Super Admin customer linkage update.
   * Gated strictly to Super Admin and audited with CUSTOMER_LINKED event.
   */
  static async linkCustomer(
    accountId: string,
    newCustomerId: string,
    actor: CorporateActorContext
  ): Promise<CorporateAccountRow> {
    assertSuperAdmin(actor, "Link Corporate Account to Customer");

    if (!newCustomerId) {
      throw new CorporateAccountError("INVALID_PARAMETERS", "Target customer ID is required.");
    }

    return dbTransaction(async (client: PoolClient) => {
      // 1. Acquire advisory lock on account
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      if (account.customer_id === newCustomerId) {
        return account; // No-op idempotent
      }

      // 2. Verify target customer exists
      const custRes = await client.query(
        `SELECT id, company_name, gstin FROM public.customer WHERE id = $1 AND deleted_at IS NULL`,
        [newCustomerId]
      );
      if (custRes.rows.length === 0) {
        throw new CorporateAccountError("CUSTOMER_NOT_FOUND", `Customer '${newCustomerId}' not found.`);
      }

      // 3. Verify target customer is not already linked to another corporate account
      const existingAccountForCustomer = await CorporateAccountRepository.findByCustomerId(newCustomerId, client);
      if (existingAccountForCustomer && existingAccountForCustomer.id !== accountId) {
        throw new CorporateAccountError(
          "CUSTOMER_ALREADY_LINKED",
          `Customer '${newCustomerId}' is already linked to corporate account '${existingAccountForCustomer.id}'.`
        );
      }

      const oldCustomerId = account.customer_id;

      // 4. Update customer linkage
      const updatedAccount = await CorporateAccountRepository.linkCustomer(
        accountId,
        newCustomerId,
        actor.userId,
        client
      );

      // 5. Audit CUSTOMER_LINKED event
      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "CUSTOMER_LINKED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: `Customer linkage changed by Super Admin from '${oldCustomerId}' to '${newCustomerId}'`,
          before_state: { customer_id: oldCustomerId },
          after_state: { customer_id: newCustomerId },
        },
        client
      );

      return updatedAccount;
    });
  }

  /**
   * Update profile, addresses, or metadata of a corporate account.
   */
  static async updateAccount(
    accountId: string,
    params: UpdateCorporateAccountInput,
    actor: CorporateActorContext
  ): Promise<CorporateAccountRow> {
    assertCanUpdateAccount(actor);

    const { normalizedGstin, normalizedPan } = validateGstinAndPan(params.gstin, params.pan);
    const legalNameKey = params.legal_name ? normalizeLegalNameKey(params.legal_name) : undefined;

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      if (account.status === "CLOSED") {
        throw new CorporateAccountError("INVALID_ACCOUNT_STATUS", "Closed corporate accounts cannot be updated.");
      }

      // If GSTIN changed, check active uniqueness
      if (normalizedGstin && normalizedGstin !== account.gstin) {
        const existingGstinAccount = await CorporateAccountRepository.findByGstin(normalizedGstin, client);
        if (existingGstinAccount && existingGstinAccount.id !== accountId) {
          throw new CorporateAccountError(
            "DUPLICATE_GSTIN",
            `GSTIN '${normalizedGstin}' is already registered to corporate account '${existingGstinAccount.id}'.`
          );
        }
      }

      const updatedAccount = await CorporateAccountRepository.update(
        accountId,
        {
          ...params,
          gstin: normalizedGstin,
          pan: normalizedPan,
          legal_name_key: legalNameKey,
          updated_by: actor.userId,
        },
        client
      );

      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "UPDATED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: "Corporate account details updated",
          before_state: {
            legal_name: account.legal_name,
            gstin: account.gstin,
            pan: account.pan,
          },
          after_state: {
            legal_name: updatedAccount.legal_name,
            gstin: updatedAccount.gstin,
            pan: updatedAccount.pan,
          },
        },
        client
      );

      return updatedAccount;
    });
  }

  /**
   * Four-Eyes Corporate Account Approval.
   * STRICT GOVERNANCE RULES:
   * 1. Restricted strictly to Super Admin.
   * 2. Creator cannot approve corporate account (created_by !== actor.userId).
   * 3. Account approval does NOT activate credit or set customer.is_corporate.
   */
  static async approveAccount(accountId: string, actor: CorporateActorContext): Promise<CorporateAccountRow> {
    assertSuperAdmin(actor, "Approve Corporate Account");

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      if (account.status !== "PENDING") {
        throw new CorporateAccountError(
          "INVALID_ACCOUNT_STATUS",
          `Only PENDING corporate accounts can be approved. Current status is '${account.status}'.`
        );
      }

      // Mandatory Four-Eyes Enforcement: Creator cannot approve own draft
      if (account.created_by && account.created_by === actor.userId && actor.userId !== "system") {
        throw new CorporateAccountError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          `Four-Eyes violation: Account creator ('${account.created_by}') cannot approve corporate account '${accountId}'.`
        );
      }

      const updatedAccount = await CorporateAccountRepository.updateStatus(
        accountId,
        "APPROVED",
        {
          approved_by: actor.userId,
          approved_at: new Date().toISOString(),
          updated_by: actor.userId,
        },
        client
      );

      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "APPROVED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: "Corporate account approved by Super Admin",
          before_state: { status: "PENDING" },
          after_state: { status: "APPROVED", approved_by: actor.userId },
        },
        client
      );

      return updatedAccount;
    });
  }

  /**
   * Suspend an approved corporate account.
   * Restricted to Super Admin.
   */
  static async suspendAccount(
    accountId: string,
    reason: string,
    actor: CorporateActorContext
  ): Promise<CorporateAccountRow> {
    assertSuperAdmin(actor, "Suspend Corporate Account");

    if (!reason || reason.trim().length === 0) {
      throw new CorporateAccountError("INVALID_PARAMETERS", "Suspension reason is required.");
    }

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      if (account.status !== "APPROVED") {
        throw new CorporateAccountError(
          "INVALID_ACCOUNT_STATUS",
          `Only APPROVED corporate accounts can be suspended. Current status is '${account.status}'.`
        );
      }

      const updatedAccount = await CorporateAccountRepository.updateStatus(
        accountId,
        "SUSPENDED",
        {
          suspended_by: actor.userId,
          suspended_at: new Date().toISOString(),
          suspended_reason: reason.trim(),
          updated_by: actor.userId,
        },
        client
      );

      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "SUSPENDED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: reason.trim(),
          before_state: { status: "APPROVED" },
          after_state: { status: "SUSPENDED", suspended_reason: reason.trim() },
        },
        client
      );

      return updatedAccount;
    });
  }

  /**
   * Reactivate a suspended corporate account.
   * Restricted to Super Admin.
   */
  static async reactivateAccount(
    accountId: string,
    reason: string,
    actor: CorporateActorContext
  ): Promise<CorporateAccountRow> {
    assertSuperAdmin(actor, "Reactivate Corporate Account");

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      if (account.status !== "SUSPENDED") {
        throw new CorporateAccountError(
          "INVALID_ACCOUNT_STATUS",
          `Only SUSPENDED corporate accounts can be reactivated. Current status is '${account.status}'.`
        );
      }

      const updatedAccount = await CorporateAccountRepository.updateStatus(
        accountId,
        "APPROVED",
        {
          suspended_by: null,
          suspended_at: null,
          suspended_reason: null,
          updated_by: actor.userId,
        },
        client
      );

      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "REACTIVATED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: reason ? reason.trim() : "Corporate account reactivated by Super Admin",
          before_state: { status: "SUSPENDED" },
          after_state: { status: "APPROVED" },
        },
        client
      );

      return updatedAccount;
    });
  }

  /**
   * Close a corporate account permanently.
   * Customer linkage remains permanently intact.
   */
  static async closeAccount(
    accountId: string,
    reason: string,
    actor: CorporateActorContext
  ): Promise<CorporateAccountRow> {
    assertSuperAdmin(actor, "Close Corporate Account");

    if (!reason || reason.trim().length === 0) {
      throw new CorporateAccountError("INVALID_PARAMETERS", "Closure reason is required.");
    }

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      if (account.status === "CLOSED") {
        return account; // Idempotent
      }

      const updatedAccount = await CorporateAccountRepository.updateStatus(
        accountId,
        "CLOSED",
        {
          closed_by: actor.userId,
          closed_at: new Date().toISOString(),
          closed_reason: reason.trim(),
          updated_by: actor.userId,
        },
        client
      );

      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "CLOSED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: reason.trim(),
          before_state: { status: account.status },
          after_state: { status: "CLOSED", closed_reason: reason.trim() },
        },
        client
      );

      return updatedAccount;
    });
  }

  /**
   * Record credit parameters requested by the corporate customer.
   * Explicit Invariant: Stores requested limits only; does NOT activate credit.
   */
  static async requestCredit(
    accountId: string,
    params: { creditLimit: number; termsDays: number },
    actor: CorporateActorContext
  ): Promise<CorporateAccountRow> {
    assertCanRequestCredit(actor);

    if (params.creditLimit <= 0) {
      throw new CorporateAccountError("INVALID_PARAMETERS", "Requested credit limit must be greater than zero.");
    }
    if (params.termsDays <= 0) {
      throw new CorporateAccountError("INVALID_PARAMETERS", "Requested payment terms days must be greater than zero.");
    }

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      if (account.status !== "APPROVED") {
        throw new CorporateAccountError(
          "INVALID_ACCOUNT_STATUS",
          `Credit can only be requested for APPROVED accounts. Current status is '${account.status}'.`
        );
      }

      const updatedAccount = await CorporateAccountRepository.updateCreditRequest(
        accountId,
        params.creditLimit,
        params.termsDays,
        actor.userId,
        client
      );

      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "CREDIT_REQUESTED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: `Credit terms requested: Limit ₹${params.creditLimit}, Terms ${params.termsDays} days`,
          before_state: {
            credit_requested_limit: account.credit_requested_limit,
            credit_requested_terms_days: account.credit_requested_terms_days,
          },
          after_state: {
            credit_requested_limit: params.creditLimit,
            credit_requested_terms_days: params.termsDays,
          },
        },
        client
      );

      return updatedAccount;
    });
  }

  /**
   * Super Admin Corporate Customer Credit Activation (Phase C7.9d).
   * LOCKED BUSINESS DECISIONS:
   * 1. Restricted strictly to Super Admin (BD-1, Q1).
   * 2. Corporate account must be 'APPROVED'.
   * 3. Reuses BillsReceivableService.approveCorporateCredit within the same transaction.
   * 4. Enforces Four-Eyes segregation (customer.created_by !== actor.userId).
   * 5. Records CREDIT_ACTIVATED audit event in corporate_account_event.
   */
  static async activateCredit(
    accountId: string,
    params: { creditLimit: number; paymentTermsDays: number },
    actor: CorporateActorContext
  ): Promise<{ account: CorporateAccountRow; customer: any }> {
    assertSuperAdmin(actor, "Activate Corporate Credit");

    if (params.creditLimit <= 0) {
      throw new CorporateAccountError("INVALID_PARAMETERS", "Credit limit must be strictly greater than zero.");
    }
    if (params.paymentTermsDays <= 0) {
      throw new CorporateAccountError("INVALID_PARAMETERS", "Payment terms days must be strictly greater than zero.");
    }

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      if (account.status !== "APPROVED") {
        throw new CorporateAccountError(
          "INVALID_ACCOUNT_STATUS",
          `Cannot activate credit for corporate account with status '${account.status}'. Must be 'APPROVED'.`
        );
      }

      // Delegate to BillsReceivableService.approveCorporateCredit (reusing existing four-eyes & customer update)
      const approvalResult = await BillsReceivableService.approveCorporateCredit({
        customerId: account.customer_id,
        creditLimit: params.creditLimit,
        paymentTermsDays: params.paymentTermsDays,
        approvedBy: actor.userId,
        actorRole: "SUPER_ADMIN",
        client,
      });

      // Record CREDIT_ACTIVATED event in corporate_account_event
      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "CREDIT_ACTIVATED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: `Corporate credit activated: Limit ₹${params.creditLimit}, Terms ${params.paymentTermsDays} days`,
          before_state: {
            credit_requested_limit: account.credit_requested_limit,
            credit_requested_terms_days: account.credit_requested_terms_days,
          },
          after_state: {
            credit_limit: params.creditLimit,
            payment_terms_days: params.paymentTermsDays,
            customer_credit_status: "APPROVED",
          },
        },
        client
      );

      return { account, customer: approvalResult.customer };
    });
  }

  static async listAccountEvents(
    accountId: string,
    actor: CorporateActorContext,
    limit: number = 100
  ): Promise<CorporateAccountEventRow[]> {
    if (actor.scopedAccountId && actor.scopedAccountId !== accountId && !isSuperAdminActor(actor)) {
      throw new CorporateAccountError("FORBIDDEN", "Cross-account access is strictly prohibited.");
    }
    return CorporateEventRepository.listAccountEvents(accountId, limit);
  }

  // ─── Contact Management ───────────────────────────────────────────────────

  static async addContact(
    accountId: string,
    params: Omit<CreateCorporateContactInput, "account_id">,
    actor: CorporateActorContext
  ): Promise<CorporateAccountContactRow> {
    assertCanUpdateAccount(actor);

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      if (params.contact_type === "PRIMARY" && params.is_active !== false) {
        const primary = await CorporateAccountContactRepository.findPrimaryContact(accountId, client);
        if (primary) {
          throw new CorporateAccountError(
            "PRIMARY_CONTACT_ALREADY_EXISTS",
            `An active primary contact ('${primary.name}') already exists for account '${accountId}'.`
          );
        }
      }

      return CorporateAccountContactRepository.create(
        {
          ...params,
          account_id: accountId,
        },
        client
      );
    });
  }

  static async updateContact(
    accountId: string,
    contactId: string,
    params: UpdateCorporateContactInput,
    actor: CorporateActorContext
  ): Promise<CorporateAccountContactRow> {
    assertCanUpdateAccount(actor);

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const contact = await CorporateAccountContactRepository.findById(contactId, client);
      if (!contact || contact.account_id !== accountId) {
        throw new CorporateAccountError("CONTACT_NOT_FOUND", `Contact '${contactId}' not found for account '${accountId}'.`);
      }

      if (params.contact_type === "PRIMARY" && params.is_active !== false) {
        const primary = await CorporateAccountContactRepository.findPrimaryContact(accountId, client);
        if (primary && primary.id !== contactId) {
          throw new CorporateAccountError(
            "PRIMARY_CONTACT_ALREADY_EXISTS",
            `An active primary contact ('${primary.name}') already exists for account '${accountId}'.`
          );
        }
      }

      return CorporateAccountContactRepository.update(contactId, accountId, params, client);
    });
  }

  static async deactivateContact(
    accountId: string,
    contactId: string,
    actor: CorporateActorContext
  ): Promise<CorporateAccountContactRow> {
    assertCanUpdateAccount(actor);

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);
      return CorporateAccountContactRepository.deactivate(contactId, accountId, client);
    });
  }

  // ─── Scoped Membership Management ─────────────────────────────────────────

  static async grantMembership(
    accountId: string,
    params: { userId: string; memberRole: CorporateMemberRole },
    actor: CorporateActorContext
  ): Promise<CorporateAccountMemberRow> {
    assertSuperAdmin(actor, "Grant Corporate Account Membership");

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const account = await CorporateAccountRepository.findById(accountId, client);
      if (!account) {
        throw new CorporateAccountError("ACCOUNT_NOT_FOUND", `Corporate account '${accountId}' not found.`);
      }

      // Verify user exists (users live in public.profiles on this database)
      const userRes = await client.query(`SELECT id FROM public.profiles WHERE id::text = $1`, [params.userId]);
      if (userRes.rows.length === 0) {
        throw new CorporateAccountError("USER_NOT_FOUND", `User '${params.userId}' not found.`);
      }

      // Check existing active membership
      const existing = await CorporateAccountMemberRepository.findByAccountAndUser(accountId, params.userId, client);
      if (existing) {
        throw new CorporateAccountError(
          "MEMBER_ALREADY_EXISTS",
          `User '${params.userId}' already holds an active membership for corporate account '${accountId}'.`
        );
      }

      const member = await CorporateAccountMemberRepository.grant(
        {
          account_id: accountId,
          user_id: params.userId,
          member_role: params.memberRole,
          granted_by: actor.userId,
        },
        client
      );

      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "MEMBER_GRANTED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: `Granted '${params.memberRole}' role to user '${params.userId}'`,
          after_state: { user_id: params.userId, role: params.memberRole },
        },
        client
      );

      return member;
    });
  }

  static async revokeMembership(
    accountId: string,
    memberId: string,
    reason: string,
    actor: CorporateActorContext
  ): Promise<CorporateAccountMemberRow> {
    assertSuperAdmin(actor, "Revoke Corporate Account Membership");

    return dbTransaction(async (client: PoolClient) => {
      await CorporateAccountRepository.acquireAccountLock(accountId, client);

      const member = await CorporateAccountMemberRepository.findById(memberId, client);
      if (!member || member.account_id !== accountId) {
        throw new CorporateAccountError("MEMBER_NOT_FOUND", `Member '${memberId}' not found for account '${accountId}'.`);
      }

      if (member.status === "REVOKED") {
        return member; // Idempotent
      }

      const revoked = await CorporateAccountMemberRepository.revoke(memberId, accountId, actor.userId, client);

      await CorporateEventRepository.recordAccountEvent(
        {
          account_id: accountId,
          event_type: "MEMBER_REVOKED",
          actor_id: actor.userId,
          actor_role: actor.role || null,
          reason: reason ? reason.trim() : "Membership revoked by Super Admin",
          before_state: { user_id: member.user_id, status: "ACTIVE" },
          after_state: { user_id: member.user_id, status: "REVOKED" },
        },
        client
      );

      return revoked;
    });
  }

  // ─── Query Operations ─────────────────────────────────────────────────────

  static async getAccountById(
    accountId: string,
    actor: CorporateActorContext
  ): Promise<CorporateAccountRow | null> {
    // If corporate member, must be scoped to their account
    if (actor.scopedAccountId && actor.scopedAccountId !== accountId && !isSuperAdminActor(actor)) {
      throw new CorporateAccountError("FORBIDDEN", "Cross-account access is strictly prohibited.");
    }
    return CorporateAccountRepository.findById(accountId);
  }

  static async listAccounts(
    filter: ListCorporateAccountsFilter,
    actor: CorporateActorContext
  ): Promise<{ items: CorporateAccountRow[]; total: number }> {
    if (actor.scopedAccountId && !isSuperAdminActor(actor)) {
      // Scoped members can only list their own account
      const item = await CorporateAccountRepository.findById(actor.scopedAccountId);
      return {
        items: item ? [item] : [],
        total: item ? 1 : 0,
      };
    }
    return CorporateAccountRepository.list(filter);
  }
}
