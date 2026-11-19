/**
 * CakeToHome ERP — Bank Account Service
 * Complete Bank & Cash Management + Cross-Application Synchronization Module
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - Bank accounts are controlled master records in PostgreSQL public.bank_account.
 * 2. LOCKED BUSINESS RULE:
 *    - Branches DO NOT own bank accounts. Bank accounts belong strictly to the COMPANY.
 *    - Associated branch can be linked for operational kitchen tracking.
 * 3. 1:1 BANK-SPECIFIC GL MAPPING:
 *    - Each bank account maps strictly to exactly one leaf GL account (type=ASSET, subtype=BANK).
 *    - GL account is validated server-side for status, type, subtype, and uniqueness.
 *    - Auto-provisions a dedicated child bank GL account under 1110 if one is not explicitly selected.
 * 4. OPENING BALANCE BALANCED DOUBLE-ENTRY:
 *    - Opening balance creates an auditable balanced journal voucher:
 *      Debit: Bank GL Account (Asset)
 *      Credit: Opening Balance Offset Account (3300 Equity)
 *    - Debits == Credits.
 * 5. TRANSACTIONAL OUTBOX SYNCHRONIZATION:
 *    - Every mutation emits canonical events to public.outbox_events inside the same DB transaction.
 */

import { resolveHeadOfficeBranchId } from "../org-defaults";
import { voucherFiscalYear } from "../fiscal-period";
import { dbTransaction, dbQuery } from "../db";
import type { PoolClient } from "pg";
import { BankAccountRepository, BankAccountError } from "../repositories/bank-account.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { hasEffectivePermission } from "../staff-access-control";
import { CrossAppEventService } from "./cross-app-event.service";
import type {
  BankAccountRow,
  BankAccountStatus,
  BankAccountType,
  CreateBankAccountParams,
  UpdateBankAccountParams,
  ListBankAccountsFilter,
  BankMasterErrorCode,
  BankTransactionRow,
  BankTransferRow,
  CashAccountRow,
  BankReconciliationRow,
} from "../types/accounting.types";

export class BankAccountServiceError extends Error {
  readonly code: BankMasterErrorCode | string;

  constructor(code: BankMasterErrorCode | string, message: string) {
    super(message);
    this.name = "BankAccountServiceError";
    this.code = code;
  }
}

const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export class BankAccountService {
  /**
   * Helper to resolve actor context and authorization safely.
   */
  private static resolveActorScope(actorContext?: {
    id?: string;
    user_id?: string;
    role?: string;
    permissions?: string[];
    [key: string]: unknown;
  }): { isSuperAdmin: boolean; actorId: string } {
    if (!actorContext) {
      throw new BankAccountServiceError("UNAUTHORIZED", "Missing actor context for bank master operation.");
    }

    const role = (actorContext.role || "").toUpperCase();
    const actorId = actorContext.id || actorContext.user_id || "system";
    const isSuperAdmin =
      role === "SUPER_ADMIN" || role === "ADMIN" || role === "FINANCE";

    return { isSuperAdmin, actorId };
  }

  /**
   * Generates a safe masked representation of a bank account number.
   * Format: •••• •••• •••• 1234
   */
  public static maskAccountNumber(accountNumber: string): string {
    const clean = accountNumber.trim();
    if (clean.length <= 4) {
      return `•••• ${clean}`;
    }
    const last4 = clean.slice(-4);
    return `•••• •••• •••• ${last4}`;
  }

  /**
   * Auto-provisions a dedicated leaf GL account for a bank account under 1110 (Cash and Cash Equivalents).
   */
  private static async provisionBankGlAccount(
    bankName: string,
    accountName: string,
    actorId: string,
    client: PoolClient
  ): Promise<string> {
    const parent = await AccountingAccountRepository.findByCode("1110", client);
    if (!parent) {
      throw new BankAccountServiceError(
        "GL_ACCOUNT_NOT_FOUND",
        "Parent Chart of Accounts account 1110 (Cash and Cash Equivalents) not found."
      );
    }

    const res = await client.query(`
      SELECT code FROM public.accounting_account
      WHERE code LIKE '1112%' AND deleted_at IS NULL
      ORDER BY code DESC
      LIMIT 25;
    `);

    let nextNum = 1;
    for (const row of res.rows) {
      const match = row.code.match(/1112[_-]?(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= nextNum) nextNum = num + 1;
      }
    }

    const suffix = String(nextNum).padStart(2, "0");
    const nextCode = `1112-${suffix}`;
    const glName = `${bankName.trim()} - ${accountName.trim()}`.substring(0, 100);
    const glId = `acc_bank_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await client.query(
      `
      INSERT INTO public.accounting_account (
        id, code, name, type, subtype, parent_id, level, is_group, is_system, is_active,
        tax_rate, tax_class, description, metadata, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'ASSET', 'BANK', $4, 4, false, false, true,
        null, null, $5, '{}', $6, NOW(), NOW()
      );
    `,
      [glId, nextCode, glName, parent.id, `Dedicated GL for Bank Account ${glName}`, actorId]
    );

    return glId;
  }

  /**
   * Creates a new company bank account master record with opening balance double-entry posting
   * and transactional outbox event emission.
   */
  static async createBankAccount(
    params: CreateBankAccountParams,
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const { isSuperAdmin, actorId } = this.resolveActorScope(params.actorContext);

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

    const bankName = (params.bank_name || "").trim();
    if (bankName.length < 2) {
      throw new BankAccountServiceError("INVALID_BANK_NAME", "Bank name must have at least 2 characters.");
    }

    const accountName = (params.account_name || "").trim();
    if (accountName.length < 2) {
      throw new BankAccountServiceError("INVALID_ACCOUNT_NAME", "Account name must have at least 2 characters.");
    }

    const accountNumber = (params.account_number || "").trim();
    if (accountNumber.length < 4) {
      throw new BankAccountServiceError("INVALID_ACCOUNT_NUMBER", "Account number must have at least 4 digits.");
    }

    const ifsc = (params.ifsc_code || "").trim().toUpperCase();
    if (!IFSC_REGEX.test(ifsc)) {
      throw new BankAccountServiceError(
        "INVALID_IFSC_CODE",
        `Invalid IFSC code format: '${params.ifsc_code}'. Must match standard Indian IFSC format (e.g., SBIN0001234).`
      );
    }

    const accountType: BankAccountType = params.account_type || "CURRENT";
    if (!["CURRENT", "SAVINGS", "OVERDRAFT", "VIRTUAL"].includes(accountType)) {
      throw new BankAccountServiceError("INVALID_ACCOUNT_TYPE", `Invalid bank account type: '${accountType}'.`);
    }

    const status: BankAccountStatus = params.status || "ACTIVE";
    if (!["ACTIVE", "INACTIVE", "FROZEN"].includes(status)) {
      throw new BankAccountServiceError("BANK_MASTER_ERROR", `Invalid bank account status: '${status}'.`);
    }

    const openingBalance = Number(params.opening_balance) || 0;
    const openingDate = params.opening_balance_date || new Date().toISOString().split("T")[0];

    const execute = async (c: PoolClient): Promise<BankAccountRow> => {
      const companyId = await CompanyRepository.resolveCompanyId(c);

      const duplicate = await BankAccountRepository.findByAccountNumberAndIfsc(accountNumber, ifsc, c);
      if (duplicate) {
        throw new BankAccountServiceError(
          "DUPLICATE_BANK_ACCOUNT",
          `Bank account with IFSC '${ifsc}' and account number '${accountNumber}' already exists.`
        );
      }

      let glAccountId = params.gl_account_id;
      if (glAccountId && glAccountId !== "AUTO") {
        const glAccount = await AccountingAccountRepository.findById(glAccountId, c);
        if (!glAccount) {
          throw new BankAccountServiceError("GL_ACCOUNT_NOT_FOUND", `GL account '${glAccountId}' does not exist.`);
        }
        if (!glAccount.is_active || glAccount.deleted_at) {
          throw new BankAccountServiceError("GL_ACCOUNT_INACTIVE", `GL account '${glAccount.code}' (${glAccount.name}) is inactive.`);
        }
        if (glAccount.is_group) {
          throw new BankAccountServiceError("GL_ACCOUNT_IS_GROUP", `GL account '${glAccount.code}' (${glAccount.name}) is a summary group and cannot receive postings.`);
        }
        if (glAccount.type !== "ASSET" || glAccount.subtype !== "BANK") {
          throw new BankAccountServiceError(
            "INVALID_GL_ACCOUNT_TYPE",
            `GL account '${glAccount.code}' must have type=ASSET and subtype=BANK. Got type=${glAccount.type}, subtype=${glAccount.subtype}.`
          );
        }

        const existingMapping = await BankAccountRepository.findByGlAccountId(glAccountId, c);
        if (existingMapping) {
          throw new BankAccountServiceError(
            "GL_ACCOUNT_ALREADY_MAPPED",
            `GL account '${glAccount.code}' is already mapped to bank account '${existingMapping.account_name}' (${existingMapping.id}).`
          );
        }
      } else {
        glAccountId = await this.provisionBankGlAccount(bankName, accountName, actorId, c);
      }

      let offsetGlId = params.offset_gl_account_id || null;
      if (!offsetGlId) {
        const offsetRes = await c.query(`SELECT id FROM public.accounting_account WHERE code = '3300' OR subtype = 'OPENING_OFFSET' LIMIT 1;`);
        offsetGlId = offsetRes.rows[0]?.id || null;
      }

      const masked = params.account_number_masked || this.maskAccountNumber(accountNumber);
      const correlationId = `corr_bank_create_${Date.now()}`;

      try {
        const created = await BankAccountRepository.create(
          {
            company_id: companyId,
            account_name: accountName,
            bank_name: bankName,
            account_number: accountNumber,
            account_number_masked: masked,
            ifsc_code: ifsc,
            account_type: accountType,
            branch_name: params.branch_name,
            branch_id: params.branch_id || null,
            gl_account_id: glAccountId,
            bank_charges_gl_account_id: params.bank_charges_gl_account_id || null,
            interest_gl_account_id: params.interest_gl_account_id || null,
            offset_gl_account_id: offsetGlId,
            opening_balance: openingBalance,
            opening_balance_date: openingDate,
            current_balance: openingBalance,
            statement_balance: openingBalance,
            is_primary: Boolean(params.is_primary),
            allow_payments: params.allow_payments !== false,
            allow_receipts: params.allow_receipts !== false,
            reconciliation_required: params.reconciliation_required !== false,
            status,
            metadata: params.metadata || {},
            created_by: actorId,
          },
          c
        );

        let openingVoucherId: string | null = null;
        let openingJournalId: string | null = null;

        if (openingBalance > 0 && offsetGlId) {
          const voucherId = `vch_ob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const voucherNo = `JV-OB-${Date.now().toString().slice(-6)}`;
          const branchId = params.branch_id || (await resolveHeadOfficeBranchId(c));
          const fiscalYear = voucherFiscalYear(openingDate);
          openingVoucherId = voucherId;

          await c.query(
            `
            INSERT INTO public.accounting_voucher (
              id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
              status, total_amount, currency, reference_type, reference_id, reference_event,
              narration, created_by, posted_by, posted_at, created_at, updated_at
            ) VALUES (
              $1, $2, 'OPENING_BALANCE', $3, $4, $5,
              'POSTED', $6, 'INR', 'BANK_ACCOUNT', $7, 'BANK_OPENING_BALANCE',
              $8, $9, $9, NOW(), NOW(), NOW()
            );
          `,
            [
              voucherId,
              voucherNo,
              openingDate,
              branchId,
              fiscalYear,
              openingBalance,
              created.id,
              `Opening balance initialization for ${bankName} - ${accountName}`,
              actorId,
            ]
          );

          const entryId = `je_ob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const entryNo = `JE-OB-${Date.now().toString().slice(-6)}`;
          openingJournalId = entryId;

          await c.query(
            `
            INSERT INTO public.accounting_journal_entry (
              id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
              total_debit, total_credit, is_reversed, narration, created_by, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $7, false, $8, $9, NOW()
            );
          `,
            [
              entryId,
              entryNo,
              voucherId,
              openingDate,
              branchId,
              fiscalYear,
              openingBalance,
              `Balanced journal for opening balance of ${bankName}`,
              actorId,
            ]
          );

          await c.query(
            `
            INSERT INTO public.accounting_journal_line (
              id, journal_entry_id, line_no, account_id, debit_amount, credit_amount,
              branch_id, narration
            ) VALUES (
              $1, $2, 1, $3, $4, 0.00,
              $5, $6
            );
          `,
            [
              `jl_${Date.now()}_1`,
              entryId,
              glAccountId,
              openingBalance,
              branchId,
              `Debit Bank Account ${accountName}`,
            ]
          );

          await c.query(
            `
            INSERT INTO public.accounting_journal_line (
              id, journal_entry_id, line_no, account_id, debit_amount, credit_amount,
              branch_id, narration
            ) VALUES (
              $1, $2, 2, $3, 0.00, $4,
              $5, $6
            );
          `,
            [
              `jl_${Date.now()}_2`,
              entryId,
              offsetGlId,
              openingBalance,
              branchId,
              `Credit Opening Balance Equity Offset`,
            ]
          );

          const txId = `bt_ob_${Date.now()}`;
          await c.query(
            `
            INSERT INTO public.bank_transaction (
              id, bank_account_id, transaction_date, value_date, transaction_type,
              reference_no, description, debit_amount, credit_amount, running_balance,
              reconciliation_status, voucher_id, journal_entry_id, created_by, created_at
            ) VALUES (
              $1, $2, $3, $3, 'OPENING_BALANCE',
              $4, $5, 0.00, $6, $6,
              'RECONCILED', $7, $8, $9, NOW()
            );
          `,
            [
              txId,
              created.id,
              openingDate,
              voucherNo,
              `Opening balance posted to ${glAccountId}`,
              openingBalance,
              voucherId,
              entryId,
              actorId,
            ]
          );

          await CrossAppEventService.publishInTransaction(c, {
            event_type: "accounting_voucher.posted",
            aggregate_type: "ACCOUNTING_VOUCHER",
            aggregate_id: voucherId,
            correlation_id: correlationId,
            branch_id: branchId,
            payload: {
              voucher_id: voucherId,
              voucher_no: voucherNo,
              voucher_type: "OPENING_BALANCE",
              total_amount: openingBalance,
              bank_account_id: created.id,
              gl_account_id: glAccountId,
            },
          });

          await CrossAppEventService.publishInTransaction(c, {
            event_type: "journal_entry.posted",
            aggregate_type: "ACCOUNTING_JOURNAL",
            aggregate_id: entryId,
            correlation_id: correlationId,
            branch_id: branchId,
            payload: {
              journal_entry_id: entryId,
              voucher_id: voucherId,
              total_debit: openingBalance,
              total_credit: openingBalance,
              bank_account_id: created.id,
              gl_account_id: glAccountId,
            },
          });

          await CrossAppEventService.publishInTransaction(c, {
            event_type: "bank_transaction.posted",
            aggregate_type: "BANK_TRANSACTION",
            aggregate_id: txId,
            correlation_id: correlationId,
            branch_id: branchId,
            payload: {
              transaction_id: txId,
              bank_account_id: created.id,
              transaction_type: "OPENING_BALANCE",
              credit_amount: openingBalance,
              running_balance: openingBalance,
            },
          });
        }

        const fullAccount = (await BankAccountRepository.findById(created.id, c)) || created;

        await CrossAppEventService.publishInTransaction(c, {
          event_type: "bank_account.created",
          aggregate_type: "BANK_ACCOUNT",
          aggregate_id: fullAccount.id,
          correlation_id: correlationId,
          branch_id: fullAccount.branch_id || null,
          payload: {
            bank_account_id: fullAccount.id,
            bank_name: fullAccount.bank_name,
            account_name: fullAccount.account_name,
            account_number_masked: fullAccount.account_number_masked,
            ifsc_code: fullAccount.ifsc_code,
            account_type: fullAccount.account_type,
            gl_account_id: fullAccount.gl_account_id,
            gl_account_code: (fullAccount as any).gl_account_code,
            gl_account_name: (fullAccount as any).gl_account_name,
            opening_balance: Number(fullAccount.opening_balance || 0),
            current_balance: Number(fullAccount.current_balance || 0),
            opening_voucher_id: openingVoucherId,
            opening_journal_id: openingJournalId,
            status: fullAccount.status,
          },
        });

        return {
          ...fullAccount,
          account_number: fullAccount.account_number_masked || masked,
        };
      } catch (err: any) {
        if (err instanceof BankAccountError) {
          throw new BankAccountServiceError(err.code as BankMasterErrorCode, err.message);
        }
        throw err;
      }
    };

    const result = client ? await execute(client) : await dbTransaction(execute);
    // Asynchronously flush pending outbox events for immediate subscribers
    CrossAppEventService.processPendingOutboxEvents().catch(() => {});
    return result;
  }

  /**
   * Retrieves a bank account by ID (with account_number safely masked for API responses).
   */
  static async getBankAccount(
    id: string,
    actorContext?: { id?: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown },
    client?: PoolClient
  ): Promise<BankAccountRow> {
    if (actorContext) {
      const { isSuperAdmin } = this.resolveActorScope(actorContext);
      const hasView =
        isSuperAdmin ||
        hasEffectivePermission(actorContext, "BANK.VIEW") ||
        hasEffectivePermission(actorContext, "ACCOUNTING.VIEW");

      if (!hasView) {
        throw new BankAccountServiceError("PERMISSION_DENIED", "Actor lacks permission to view bank accounts.");
      }
    }

    const account = await BankAccountRepository.findById(id, client);
    if (!account) {
      throw new BankAccountServiceError("BANK_ACCOUNT_NOT_FOUND", `Bank account '${id}' not found.`);
    }

    return {
      ...account,
      account_number: account.account_number_masked || this.maskAccountNumber(account.account_number),
    };
  }

  /**
   * Lists bank accounts with optional filtering and guaranteed masking of account_number.
   */
  static async listBankAccounts(
    filter: ListBankAccountsFilter = {},
    client?: PoolClient
  ): Promise<BankAccountRow[]> {
    if (filter.actorContext) {
      const { isSuperAdmin } = this.resolveActorScope(filter.actorContext);
      const hasView =
        isSuperAdmin ||
        hasEffectivePermission(filter.actorContext, "BANK.VIEW") ||
        hasEffectivePermission(filter.actorContext, "ACCOUNTING.VIEW");

      if (!hasView) {
        throw new BankAccountServiceError("PERMISSION_DENIED", "Actor lacks permission to list bank accounts.");
      }
    }

    const rows = await BankAccountRepository.list(
      {
        companyId: filter.companyId,
        status: filter.status,
        search: filter.search,
        branchId: filter.branchId,
      },
      client
    );

    return rows.map((row) => ({
      ...row,
      account_number: row.account_number_masked || this.maskAccountNumber(row.account_number || ""),
    }));
  }

  /**
   * Updates an existing bank account master record and emits bank_account.updated.
   */
  static async updateBankAccount(
    params: UpdateBankAccountParams,
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const { isSuperAdmin, actorId } = this.resolveActorScope(params.actorContext);

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

      if (params.bank_name !== undefined && params.bank_name.trim().length < 2) {
        throw new BankAccountServiceError("INVALID_BANK_NAME", "Bank name must have at least 2 characters.");
      }
      if (params.account_name !== undefined && params.account_name.trim().length < 2) {
        throw new BankAccountServiceError("INVALID_ACCOUNT_NAME", "Account name must have at least 2 characters.");
      }
      if (params.ifsc_code !== undefined) {
        const cleanIfsc = params.ifsc_code.trim().toUpperCase();
        if (!IFSC_REGEX.test(cleanIfsc)) {
          throw new BankAccountServiceError("INVALID_IFSC_CODE", `Invalid IFSC code: '${params.ifsc_code}'.`);
        }
      }

      const updated = await BankAccountRepository.update(
        {
          id: params.id,
          account_name: params.account_name,
          bank_name: params.bank_name,
          ifsc_code: params.ifsc_code,
          account_type: params.account_type,
          branch_name: params.branch_name,
          status: params.status,
          metadata: params.metadata,
          updated_by: actorId,
        },
        c
      );

      await CrossAppEventService.publishInTransaction(c, {
        event_type: "bank_account.updated",
        aggregate_type: "BANK_ACCOUNT",
        aggregate_id: updated.id,
        branch_id: updated.branch_id || null,
        payload: {
          bank_account_id: updated.id,
          bank_name: updated.bank_name,
          account_name: updated.account_name,
          account_number_masked: updated.account_number_masked,
          status: updated.status,
          current_balance: Number(updated.current_balance || 0),
        },
      });

      return {
        ...updated,
        account_number: updated.account_number_masked || this.maskAccountNumber(updated.account_number || ""),
      };
    };

    const result = client ? await execute(client) : await dbTransaction(execute);
    CrossAppEventService.processPendingOutboxEvents().catch(() => {});
    return result;
  }

  /**
   * Sets bank account status (ACTIVE, INACTIVE, FROZEN) and emits bank_account.updated.
   */
  static async setBankAccountStatus(
    id: string,
    status: BankAccountStatus,
    actorContext?: { id?: string; user_id?: string; role?: string; permissions?: string[]; [key: string]: unknown },
    client?: PoolClient
  ): Promise<BankAccountRow> {
    const { isSuperAdmin, actorId } = this.resolveActorScope(actorContext);
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(actorContext, "BANK.MANAGE") ||
      hasEffectivePermission(actorContext, "ACCOUNTING.POST");

    if (!hasPerm) {
      throw new BankAccountServiceError("PERMISSION_DENIED", "Actor lacks permission to change bank account status.");
    }

    if (!["ACTIVE", "INACTIVE", "FROZEN"].includes(status)) {
      throw new BankAccountServiceError("BANK_MASTER_ERROR", `Invalid bank account status: '${status}'.`);
    }

    const execute = async (c: PoolClient): Promise<BankAccountRow> => {
      const existing = await BankAccountRepository.findById(id, c, true);
      if (!existing) {
        throw new BankAccountServiceError("BANK_ACCOUNT_NOT_FOUND", `Bank account '${id}' not found.`);
      }
      const updated = await BankAccountRepository.updateStatus(id, status, actorId, c);

      await CrossAppEventService.publishInTransaction(c, {
        event_type: "bank_account.updated",
        aggregate_type: "BANK_ACCOUNT",
        aggregate_id: updated.id,
        branch_id: updated.branch_id || null,
        payload: {
          bank_account_id: updated.id,
          bank_name: updated.bank_name,
          account_name: updated.account_name,
          account_number_masked: updated.account_number_masked,
          status: updated.status,
          previous_status: existing.status,
        },
      });

      return {
        ...updated,
        account_number: updated.account_number_masked || this.maskAccountNumber(updated.account_number || ""),
      };
    };

    const result = client ? await execute(client) : await dbTransaction(execute);
    CrossAppEventService.processPendingOutboxEvents().catch(() => {});
    return result;
  }

  /**
   * Retrieves transactions for a bank account.
   */
  static async getTransactions(
    bankAccountId: string,
    actorContext?: any,
    client?: PoolClient
  ): Promise<BankTransactionRow[]> {
    if (actorContext) {
      const { isSuperAdmin } = this.resolveActorScope(actorContext);
      const hasView =
        isSuperAdmin ||
        hasEffectivePermission(actorContext, "BANK.VIEW") ||
        hasEffectivePermission(actorContext, "ACCOUNTING.VIEW");
      if (!hasView) throw new BankAccountServiceError("PERMISSION_DENIED", "Permission denied.");
    }
    return await BankAccountRepository.getTransactions(bankAccountId, client);
  }

  /**
   * Records a fund transfer between two company bank accounts (CONTRA voucher)
   * and emits bank_transfer.completed, accounting_voucher.posted, journal_entry.posted, and bank_transaction.posted.
   */
  static async transferFunds(
    params: {
      source_bank_account_id: string;
      dest_bank_account_id: string;
      amount: number;
      transfer_date?: string;
      reference_no?: string;
      description?: string;
      actorContext?: any;
    },
    client?: PoolClient
  ): Promise<BankTransferRow> {
    const { isSuperAdmin, actorId } = this.resolveActorScope(params.actorContext);
    const hasPerm =
      isSuperAdmin ||
      hasEffectivePermission(params.actorContext, "BANK.MANAGE") ||
      hasEffectivePermission(params.actorContext, "ACCOUNTING.POST");
    if (!hasPerm) throw new BankAccountServiceError("PERMISSION_DENIED", "Permission denied to execute bank transfers.");

    if (params.source_bank_account_id === params.dest_bank_account_id) {
      throw new BankAccountServiceError("INVALID_TRANSFER", "Source and destination bank accounts cannot be the same.");
    }

    const amount = Number(params.amount);
    if (!amount || amount <= 0) {
      throw new BankAccountServiceError("INVALID_TRANSFER_AMOUNT", "Transfer amount must be greater than zero.");
    }

    const transferDate = params.transfer_date || new Date().toISOString().split("T")[0];
    const refNo = params.reference_no?.trim() || `TRF-${Date.now().toString().slice(-6)}`;
    const desc = params.description?.trim() || `Internal bank transfer from source to destination`;

    const execute = async (c: PoolClient): Promise<BankTransferRow> => {
      const source = await BankAccountRepository.findById(params.source_bank_account_id, c, true);
      const dest = await BankAccountRepository.findById(params.dest_bank_account_id, c, true);

      if (!source || !dest) {
        throw new BankAccountServiceError("BANK_ACCOUNT_NOT_FOUND", "Source or destination bank account not found.");
      }

      if (source.status !== "ACTIVE" || dest.status !== "ACTIVE") {
        throw new BankAccountServiceError("ACCOUNT_INACTIVE", "Both bank accounts must be ACTIVE to transfer funds.");
      }

      if (Number(source.current_balance || 0) < amount) {
        throw new BankAccountServiceError(
          "INSUFFICIENT_FUNDS",
          `Insufficient balance in source bank account. Available: ₹${source.current_balance}`
        );
      }

      const voucherId = `vch_trf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const voucherNo = `JV-TRF-${Date.now().toString().slice(-6)}`;
      const branchId = source.branch_id || (await resolveHeadOfficeBranchId(c));
      const fiscalYear = voucherFiscalYear(transferDate);
      const correlationId = `corr_trf_${refNo}_${Date.now()}`;

      await c.query(
        `
        INSERT INTO public.accounting_voucher (
          id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
          status, total_amount, currency, reference_type, reference_id, reference_event,
          narration, created_by, posted_by, posted_at, created_at, updated_at
        ) VALUES (
          $1, $2, 'CONTRA', $3, $4, $5,
          'POSTED', $6, 'INR', 'BANK_TRANSFER', $7, 'INTERNAL_BANK_TRANSFER',
          $8, $9, $9, NOW(), NOW(), NOW()
        );
      `,
        [voucherId, voucherNo, transferDate, branchId, fiscalYear, amount, refNo, desc, actorId]
      );

      const entryId = `je_trf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await c.query(
        `
        INSERT INTO public.accounting_journal_entry (
          id, entry_no, voucher_id, entry_date, branch_id, fiscal_year,
          total_debit, total_credit, is_reversed, narration, created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $7, false, $8, $9, NOW()
        );
      `,
        [
          entryId,
          `JE-TRF-${Date.now().toString().slice(-6)}`,
          voucherId,
          transferDate,
          branchId,
          fiscalYear,
          amount,
          desc,
          actorId,
        ]
      );

      // Debit Destination Bank GL
      await c.query(
        `
        INSERT INTO public.accounting_journal_line (
          id, journal_entry_id, line_no, account_id, debit_amount, credit_amount,
          branch_id, narration
        ) VALUES ($1, $2, 1, $3, $4, 0.00, $5, $6);
      `,
        [
          `jl_${Date.now()}_1`,
          entryId,
          dest.gl_account_id,
          amount,
          branchId,
          `Debit Destination Bank ${dest.account_name}`,
        ]
      );

      // Credit Source Bank GL
      await c.query(
        `
        INSERT INTO public.accounting_journal_line (
          id, journal_entry_id, line_no, account_id, debit_amount, credit_amount,
          branch_id, narration
        ) VALUES ($1, $2, 2, $3, 0.00, $4, $5, $6);
      `,
        [
          `jl_${Date.now()}_2`,
          entryId,
          source.gl_account_id,
          amount,
          branchId,
          `Credit Source Bank ${source.account_name}`,
        ]
      );

      const sourceTx = await BankAccountRepository.recordTransaction(
        {
          bank_account_id: source.id,
          transaction_date: transferDate,
          transaction_type: "TRANSFER_OUT",
          reference_no: refNo,
          description: `Transfer to ${dest.bank_name} (${dest.account_number_masked})`,
          debit_amount: amount,
          credit_amount: 0.0,
          voucher_id: voucherId,
          journal_entry_id: entryId,
          created_by: actorId,
        },
        c
      );

      const destTx = await BankAccountRepository.recordTransaction(
        {
          bank_account_id: dest.id,
          transaction_date: transferDate,
          transaction_type: "TRANSFER_IN",
          reference_no: refNo,
          description: `Transfer from ${source.bank_name} (${source.account_number_masked})`,
          debit_amount: 0.0,
          credit_amount: amount,
          voucher_id: voucherId,
          journal_entry_id: entryId,
          created_by: actorId,
        },
        c
      );

      const transferId = `trf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const trfRes = await c.query(
        `
        INSERT INTO public.bank_transfer (
          id, source_bank_account_id, dest_bank_account_id, transfer_amount,
          transfer_date, reference_no, description, status, voucher_id, journal_entry_id,
          created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'POSTED', $8, $9, $10, NOW())
        RETURNING *;
      `,
        [transferId, source.id, dest.id, amount, transferDate, refNo, desc, voucherId, entryId, actorId]
      );

      await CrossAppEventService.publishInTransaction(c, {
        event_type: "accounting_voucher.posted",
        aggregate_type: "ACCOUNTING_VOUCHER",
        aggregate_id: voucherId,
        correlation_id: correlationId,
        branch_id: branchId,
        payload: {
          voucher_id: voucherId,
          voucher_no: voucherNo,
          voucher_type: "CONTRA",
          total_amount: amount,
          reference_no: refNo,
        },
      });

      await CrossAppEventService.publishInTransaction(c, {
        event_type: "journal_entry.posted",
        aggregate_type: "ACCOUNTING_JOURNAL",
        aggregate_id: entryId,
        correlation_id: correlationId,
        branch_id: branchId,
        payload: {
          journal_entry_id: entryId,
          voucher_id: voucherId,
          total_debit: amount,
          total_credit: amount,
          source_gl_account_id: source.gl_account_id,
          dest_gl_account_id: dest.gl_account_id,
        },
      });

      await CrossAppEventService.publishInTransaction(c, {
        event_type: "bank_transaction.posted",
        aggregate_type: "BANK_TRANSACTION",
        aggregate_id: sourceTx.id,
        correlation_id: correlationId,
        branch_id: branchId,
        payload: {
          transaction_id: sourceTx.id,
          bank_account_id: source.id,
          transaction_type: "TRANSFER_OUT",
          debit_amount: amount,
          running_balance: Number(sourceTx.running_balance),
        },
      });

      await CrossAppEventService.publishInTransaction(c, {
        event_type: "bank_transaction.posted",
        aggregate_type: "BANK_TRANSACTION",
        aggregate_id: destTx.id,
        correlation_id: correlationId,
        branch_id: branchId,
        payload: {
          transaction_id: destTx.id,
          bank_account_id: dest.id,
          transaction_type: "TRANSFER_IN",
          credit_amount: amount,
          running_balance: Number(destTx.running_balance),
        },
      });

      await CrossAppEventService.publishInTransaction(c, {
        event_type: "bank_transfer.completed",
        aggregate_type: "BANK_TRANSFER",
        aggregate_id: transferId,
        correlation_id: correlationId,
        branch_id: branchId,
        payload: {
          transfer_id: transferId,
          source_bank_account_id: source.id,
          dest_bank_account_id: dest.id,
          transfer_amount: amount,
          reference_no: refNo,
          voucher_id: voucherId,
          journal_entry_id: entryId,
          source_new_balance: Number(sourceTx.running_balance),
          dest_new_balance: Number(destTx.running_balance),
        },
      });

      return trfRes.rows[0];
    };

    const result = client ? await execute(client) : await dbTransaction(execute);
    CrossAppEventService.processPendingOutboxEvents().catch(() => {});
    return result;
  }

  /**
   * Retrieves dashboard summary metrics.
   */
  static async getDashboardSummary(client?: PoolClient) {
    return await BankAccountRepository.getDashboardSummary(client);
  }

  /**
   * Lists cash accounts.
   */
  static async listCashAccounts(filter?: any, client?: PoolClient) {
    return await BankAccountRepository.listCashAccounts(filter, client);
  }

  /**
   * Creates a cash account.
   */
  static async createCashAccount(params: any, client?: PoolClient) {
    return await BankAccountRepository.createCashAccount(params, client);
  }
}
