/**
 * CakeToHome ERP — Bank Account Service
 * Phase 4F Step 4.10 Substep 4.10.2: Bank Master & Multi-Branch Treasury Architecture
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - Bank accounts are controlled master records in PostgreSQL public.bank_account.
 * 2. ZERO CLIENT TRUST FOR ACCOUNTING ACCOUNTS:
 *    - All operational bank accounts resolve strictly to GL 1112 Bank Operating A/c.
 *    - Client-supplied GL accounts are strictly rejected (ARBITRARY_GL_ACCOUNT_FORBIDDEN).
 * 3. STRICT SERVER-SIDE VALIDATION:
 *    - IFSC validation via regex: ^[A-Z]{4}0[A-Z0-9]{6}$.
 *    - Masked account number length >= 4 (plaintext bank credentials/credentials strictly prohibited).
 * 4. BRANCH ISOLATION & BOLA DEFENSE:
 *    - Branch-scoped users can only create, view, and modify accounts for their authorized branch.
 *    - Super Admin can create enterprise-wide (branch_id = null) or branch-specific accounts.
 * 5. CONTROLLED LIFECYCLE:
 *    - status: 'ACTIVE' | 'INACTIVE' | 'FROZEN'.
 *    - Inactive/frozen accounts cannot participate in new cash deposit slips.
 */

import { dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { BankAccountRepository, BankAccountError } from "../repositories/bank-account.repository";
import { hasEffectivePermission } from "../staff-access-control";
import type {
  BankAccountRow,
  BankAccountStatus,
  CreateBankAccountParams,
  UpdateBankAccountParams,
  ListBankAccountsFilter,
  BankMasterErrorCode,
} from "../types/accounting.types";

export class BankAccountServiceError extends Error {
  readonly code: BankMasterErrorCode;

  constructor(code: BankMasterErrorCode, message: string) {
    super(message);
    this.name = "BankAccountServiceError";
    this.code = code;
  }
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export class BankAccountService {
  /**
   * Helper to resolve actor context and branch authorization safely.
   */
  private static resolveActorScope(actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    branch_id?: string | null;
    branchId?: string | null;
    permissions?: string[];
    [key: string]: unknown;
  }): { isSuperAdmin: boolean; actorBranch: string | null; actorId: string } {
    if (!actorContext) {
      throw new BankAccountServiceError("PERMISSION_DENIED", "Missing actor context for bank master operation.");
    }

    const role = (actorContext.role || "").toUpperCase();
    const actorId = actorContext.id || actorContext.user_id || "";
    const isSuperAdmin = role === "SUPER_ADMIN" || actorId === "admin_01";
    const actorBranch = actorContext.branch_id || actorContext.branchId || null;

    return { isSuperAdmin, actorBranch, actorId };
  }

  /**
   * Creates a new bank account master.
   */
  static async createBankAccount(
    params: CreateBankAccountParams,
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const { isSuperAdmin, actorBranch } = this.resolveActorScope(params.actorContext);

    // 1. RBAC Permission check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "BANK.MANAGE") ||
      hasEffectivePermission(params.actorContext, "ACCOUNTING.POST");

    if (!hasPerm) {
      throw new BankAccountServiceError(
        "PERMISSION_DENIED",
        "Actor lacks required permission (BANK.MANAGE or ACCOUNTING.POST) to create bank accounts."
      );
    }

    // 2. Reject arbitrary client GL accounts
    if ((params as any).accounting_account_id || (params as any).account_id || (params as any).gl_account) {
      throw new BankAccountServiceError(
        "ARBITRARY_GL_ACCOUNT_FORBIDDEN",
        "Client cannot specify arbitrary GL accounts. Bank accounts resolve to 1112 Bank Operating A/c."
      );
    }

    // 3. Branch scope resolution & BOLA defense
    let targetBranchId: string | null = null;
    if (!isSuperAdmin) {
      if (!actorBranch) {
        throw new BankAccountServiceError(
          "BRANCH_ACCESS_DENIED",
          "Non-super-admin user has no authorized branch assignment."
        );
      }
      if (params.branch_id && params.branch_id !== actorBranch) {
        throw new BankAccountServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch bank account creation denied: User branch '${actorBranch}' cannot create for branch '${params.branch_id}'.`
        );
      }
      targetBranchId = actorBranch;
    } else {
      targetBranchId = params.branch_id || null;
    }

    // 4. Server-side validation
    const bankName = (params.bank_name || "").trim();
    if (!bankName) {
      throw new BankAccountServiceError("INVALID_BANK_NAME", "Bank name cannot be empty.");
    }

    const maskedAcc = (params.account_number_masked || "").trim();
    if (maskedAcc.length < 4) {
      throw new BankAccountServiceError(
        "INVALID_MASKED_ACCOUNT",
        "Masked account number must have at least 4 characters."
      );
    }

    const ifsc = (params.ifsc_code || "").trim().toUpperCase();
    if (!IFSC_REGEX.test(ifsc)) {
      throw new BankAccountServiceError(
        "INVALID_IFSC_CODE",
        `Invalid IFSC code format: '${params.ifsc_code}'. Must match standard Indian IFSC format (e.g., SBIN0001234).`
      );
    }

    const status: BankAccountStatus = params.status || "ACTIVE";
    if (!["ACTIVE", "INACTIVE", "FROZEN"].includes(status)) {
      throw new BankAccountServiceError("BANK_MASTER_ERROR", `Invalid bank account status: '${status}'.`);
    }

    try {
      return await BankAccountRepository.create(
        {
          company_id: params.company_id || "company_default",
          branch_id: targetBranchId,
          bank_name: bankName,
          account_number_masked: maskedAcc,
          ifsc_code: ifsc,
          status,
          metadata: {
            ...params.metadata,
            operational_gl_account: "1112",
          },
        },
        client
      );
    } catch (err: any) {
      if (err instanceof BankAccountError) {
        throw new BankAccountServiceError(err.code as BankMasterErrorCode, err.message);
      }
      throw err;
    }
  }

  /**
   * Retrieves a bank account by ID with branch scoping.
   */
  static async getBankAccount(
    id: string,
    actorContext?: {
      id?: string;
      user_id?: string;
      role?: string;
      branch_id?: string | null;
      branchId?: string | null;
      permissions?: string[];
      [key: string]: unknown;
    },
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const account = await BankAccountRepository.findById(id, client);
    if (!account) {
      throw new BankAccountServiceError("BANK_ACCOUNT_NOT_FOUND", `Bank account '${id}' not found.`);
    }

    if (actorContext) {
      const { isSuperAdmin, actorBranch } = this.resolveActorScope(actorContext);

      // Permission check
      const hasView =
        isSuperAdmin ||
        hasEffectivePermission(actorContext, "BANK.VIEW") ||
        hasEffectivePermission(actorContext, "ACCOUNTING.VIEW");

      if (!hasView) {
        throw new BankAccountServiceError("PERMISSION_DENIED", "Actor lacks permission to view bank accounts.");
      }

      // Branch isolation: if account is branch-specific, actor must match
      if (!isSuperAdmin && account.branch_id && account.branch_id !== actorBranch) {
        throw new BankAccountServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch bank account access denied: Account branch '${account.branch_id}' does not match actor branch '${actorBranch}'.`
        );
      }
    }

    return account;
  }

  /**
   * Lists bank accounts with strict branch isolation.
   */
  static async listBankAccounts(
    filter: ListBankAccountsFilter = {},
    client?: PoolClient
  ): Promise<BankAccountRow[]> {
    const { isSuperAdmin, actorBranch } = this.resolveActorScope(filter.actorContext);

    // Permission check
    const hasView =
      isSuperAdmin ||
      hasEffectivePermission(filter.actorContext, "BANK.VIEW") ||
      hasEffectivePermission(filter.actorContext, "ACCOUNTING.VIEW");

    if (!hasView) {
      throw new BankAccountServiceError("PERMISSION_DENIED", "Actor lacks permission to list bank accounts.");
    }

    // Branch scoping
    let queryBranchId: string | null | undefined = filter.branchId;
    if (!isSuperAdmin) {
      if (!actorBranch) {
        throw new BankAccountServiceError(
          "BRANCH_ACCESS_DENIED",
          "Non-super-admin user has no authorized branch assignment."
        );
      }
      queryBranchId = actorBranch;
    }

    return await BankAccountRepository.list(
      {
        branchId: queryBranchId,
        companyId: filter.companyId,
        status: filter.status,
        includeEnterprise: isSuperAdmin ? filter.includeEnterprise : true,
      },
      client
    );
  }

  /**
   * Updates an existing bank account.
   */
  static async updateBankAccount(
    params: UpdateBankAccountParams,
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const { isSuperAdmin, actorBranch } = this.resolveActorScope(params.actorContext);

    // Permission check
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "BANK.MANAGE") ||
      hasEffectivePermission(params.actorContext, "ACCOUNTING.POST");

    if (!hasPerm) {
      throw new BankAccountServiceError("PERMISSION_DENIED", "Actor lacks permission to update bank accounts.");
    }

    const execute = async (c: PoolClient): Promise<BankAccountRow> => {
      const existing = await BankAccountRepository.findById(params.id, c, true);
      if (!existing) {
        throw new BankAccountServiceError("BANK_ACCOUNT_NOT_FOUND", `Bank account '${params.id}' not found.`);
      }

      // Branch isolation
      if (!isSuperAdmin && existing.branch_id && existing.branch_id !== actorBranch) {
        throw new BankAccountServiceError(
          "BRANCH_ACCESS_DENIED",
          `Cross-branch bank account update denied: Account belongs to branch '${existing.branch_id}'.`
        );
      }

      // Validation
      if (params.bank_name !== undefined && !params.bank_name.trim()) {
        throw new BankAccountServiceError("INVALID_BANK_NAME", "Bank name cannot be empty.");
      }

      if (params.account_number_masked !== undefined && params.account_number_masked.trim().length < 4) {
        throw new BankAccountServiceError(
          "INVALID_MASKED_ACCOUNT",
          "Masked account number must have at least 4 characters."
        );
      }

      if (params.ifsc_code !== undefined && !IFSC_REGEX.test(params.ifsc_code.trim().toUpperCase())) {
        throw new BankAccountServiceError("INVALID_IFSC_CODE", `Invalid IFSC code format: '${params.ifsc_code}'.`);
      }

      if (params.status !== undefined && !["ACTIVE", "INACTIVE", "FROZEN"].includes(params.status)) {
        throw new BankAccountServiceError("BANK_MASTER_ERROR", `Invalid status: '${params.status}'.`);
      }

      return await BankAccountRepository.update(params.id, params, c);
    };

    return client ? await execute(client) : await dbTransaction(execute);
  }

  /**
   * Sets bank account status (ACTIVE, INACTIVE, FROZEN).
   */
  static async setBankAccountStatus(
    id: string,
    status: BankAccountStatus,
    actorContext?: {
      id?: string;
      user_id?: string;
      role?: string;
      branch_id?: string | null;
      branchId?: string | null;
      permissions?: string[];
      [key: string]: unknown;
    },
    client?: PoolClient
  ): Promise<BankAccountRow> {
    return await this.updateBankAccount({ id, status, actorContext }, client);
  }
}
