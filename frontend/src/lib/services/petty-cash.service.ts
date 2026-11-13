/**
 * CakeToHome ERP — Petty Cash Domain Service
 * Phase C7.5: Branch Cash Control & Vault Custody Expansion
 *
 * Implements TRUE IMPREST petty cash lifecycle with 3-tier Segregation of Duties:
 * 1. Initial Funding:
 *    Dr 1114 Petty Cash - Branches
 *        Cr 1112 Bank Operating A/c
 *
 * 2. Petty Expenditure (Claim approval/posting):
 *    Dr 5xxx Operating Expenses
 *    Dr 114x Input GST (if applicable)
 *        Cr 1114 Petty Cash - Branches
 *    (Asset 1114 is reduced; expense is recognized in P&L).
 *
 * 3. Imprest Reimbursement:
 *    Dr 1114 Petty Cash - Branches
 *        Cr 1112 Bank Operating A/c
 *    (Restores 1114 fund; zero duplicate expense recognition).
 *
 * Segregation of Duties:
 * - Maker: Branch Manager
 * - Checker: Central Finance
 * - Disburser: Central Accounts
 * - Maker != Checker != Disburser (Super Admin cannot bypass).
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { PettyCashRepository } from "../repositories/petty-cash.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { AccountingVoucherRepository } from "../repositories/accounting-voucher.repository";
import { AccountingFiscalPeriodRepository } from "../repositories/accounting-fiscal-period.repository";
import { BankAccountRepository } from "../repositories/bank-account.repository";
import { PostingService, PostingServiceError } from "./posting.service";
import {
  PettyCashRequestRow,
  PettyCashRequestStatus,
  PettyCashRequestType,
} from "../types/vault-custody.types";
import { round2 } from "./purchase-tax-engine";

export interface PettyCashActor {
  id?: string;
  userId?: string;
  role?: string;
  email?: string;
  branch_id?: string | null;
  branchId?: string | null;
  permissions?: string[];
  isSuperAdmin?: boolean;
}

async function executeInTransaction<T>(
  client: PoolClient | undefined,
  callback: (txClient: PoolClient) => Promise<T>
): Promise<T> {
  if (!client) {
    return dbTransaction(callback);
  }

  try {
    await client.query("SAVEPOINT sp_petty_cash");
    try {
      const res = await callback(client);
      await client.query("RELEASE SAVEPOINT sp_petty_cash");
      return res;
    } catch (err) {
      await client.query("ROLLBACK TO SAVEPOINT sp_petty_cash");
      throw err;
    }
  } catch (err: any) {
    if (err.code === "25P01" || (err.message && err.message.includes("transaction blocks"))) {
      await client.query("BEGIN");
      try {
        const res = await callback(client);
        await client.query("COMMIT");
        return res;
      } catch (innerErr) {
        await client.query("ROLLBACK");
        throw innerErr;
      }
    }
    throw err;
  }
}
import { JournalLineInput } from "../types/accounting.types";

export type PettyCashErrorCode =
  | "INVALID_AMOUNT"
  | "REQUEST_NOT_FOUND"
  | "INVALID_REQUEST_STATUS"
  | "PETTY_CASH_LIMIT_UNCONFIGURED"
  | "PETTY_CASH_INSUFFICIENT"
  | "IMPREST_LIMIT_EXCEEDED"
  | "SEGREGATION_OF_DUTIES_VIOLATION"
  | "ACCOUNT_NOT_FOUND"
  | "BANK_ACCOUNT_NOT_FOUND"
  | "BRANCH_ACCESS_DENIED"
  | "POSTING_FAILED";

export class PettyCashServiceError extends Error {
  readonly code: PettyCashErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: PettyCashErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "PettyCashServiceError";
    this.code = code;
    this.details = details;
  }
}



export class PettyCashService {
  /**
   * Resolves configured branch imprest limit. Fails closed if missing.
   */
  static async getBranchImprestLimit(branchId: string, client?: PoolClient): Promise<number> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const res = await queryFn(`SELECT id, code, name, metadata FROM public.branch WHERE id = $1`, [branchId]);
    if (res.rows.length === 0) {
      throw new PettyCashServiceError("BRANCH_ACCESS_DENIED", `Branch '${branchId}' not found.`);
    }
    const branch = res.rows[0];
    const limit = branch.metadata?.petty_cash_imprest_limit;
    if (limit === undefined || limit === null || isNaN(Number(limit)) || Number(limit) <= 0) {
      throw new PettyCashServiceError(
        "PETTY_CASH_LIMIT_UNCONFIGURED",
        `Branch '${branch.name}' has no petty cash imprest limit configured. Fails closed.`
      );
    }
    return Number(limit);
  }

  /**
   * Step 1: Maker requests initial imprest funding (Branch Manager).
   */
  static async requestInitialFunding(
    params: {
      branch_id: string;
      amount: number;
      purpose?: string;
    },
    maker: PettyCashActor,
    client?: PoolClient
  ): Promise<PettyCashRequestRow> {
    const amount = round2(params.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new PettyCashServiceError("INVALID_AMOUNT", `Initial funding amount must be positive. Got ${params.amount}.`);
    }

    const limit = await this.getBranchImprestLimit(params.branch_id, client);
    if (amount > limit) {
      throw new PettyCashServiceError(
        "IMPREST_LIMIT_EXCEEDED",
        `Requested float ₹${amount.toFixed(2)} exceeds branch imprest ceiling ₹${limit.toFixed(2)}.`
      );
    }

    const branchRes = await (client ? client.query.bind(client) : dbQuery)(
      `SELECT code FROM public.branch WHERE id = $1`,
      [params.branch_id]
    );
    const branchCode = branchRes.rows[0]?.code || "BR";
    const requestNumber = await PettyCashRepository.getNextRequestNumber(branchCode, client);

    const makerId = (maker as any).userId || maker.id;

    const execute = async (txClient: PoolClient) => {
      return PettyCashRepository.create(
        {
          request_number: requestNumber,
          branch_id: params.branch_id,
          request_type: "INITIAL_FUNDING",
          amount,
          purpose: params.purpose || "Initial petty cash float establishment",
          maker_id: makerId,
          net_expense_amount: amount,
          status: "SUBMITTED",
        },
        txClient
      );
    };

    return executeInTransaction(client, execute);
  }

  /**
   * Resolves canonical Input Tax account code (1141-1149) from PostgreSQL for a statutory GST rate.
   * Statutory GST rate splits into equal CGST (half) and SGST (half) for intra-state petty expenses.
   */
  static async resolveInputTaxAccountCode(
    taxRatePct: number,
    component: "CGST" | "SGST" = "CGST",
    client?: PoolClient
  ): Promise<string | null> {
    const halfRate = round2(taxRatePct / 2);
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const res = await queryFn(
      `SELECT code FROM public.accounting_account
       WHERE subtype = 'INPUT_TAX'
         AND name ILIKE $1
         AND tax_rate = $2
         AND is_group = false
         AND is_active = true
         AND deleted_at IS NULL
       ORDER BY code ASC
       LIMIT 1;`,
      [`%${component}%`, halfRate.toFixed(2)]
    );
    return res.rows[0]?.code || null;
  }

  /**
   * Step 2: Checker approves initial funding or expense claim (Central Finance).
   */
  static async approveRequest(
    params: {
      request_id: string;
      notes?: string;
    },
    checker: PettyCashActor,
    client?: PoolClient
  ): Promise<PettyCashRequestRow> {
    const execute = async (txClient: PoolClient) => {
      const request = await PettyCashRepository.findById(params.request_id, txClient, true);
      if (!request) {
        throw new PettyCashServiceError("REQUEST_NOT_FOUND", `Petty cash request '${params.request_id}' not found.`);
      }

      if (request.status !== "SUBMITTED") {
        throw new PettyCashServiceError(
          "INVALID_REQUEST_STATUS",
          `Only SUBMITTED requests can be approved. Current status is '${request.status}'.`
        );
      }

      const checkerId = (checker as any).userId || checker.id;

      // SoD: Checker != Maker
      if (request.maker_id === checkerId) {
        throw new PettyCashServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Checker cannot approve their own request. Segregation of duties violation."
        );
      }

      if (request.request_type === "EXPENSE_CLAIM") {
        // Petty cash must actually hold the money (GL 1114 balance for this branch).
        const balRes = await txClient.query(
          `SELECT COALESCE(SUM(l.debit_amount - l.credit_amount), 0)::numeric::float8 AS bal
           FROM public.accounting_journal_line l
           JOIN public.accounting_account a ON a.id = l.account_id
           WHERE a.code = '1114' AND l.branch_id = $1`,
          [request.branch_id]
        );
        const available = round2(Number(balRes.rows[0]?.bal || 0));
        if (request.amount > available) {
          throw new PettyCashServiceError(
            "PETTY_CASH_INSUFFICIENT",
            `Petty cash available ₹${available.toFixed(2)} is less than the claim ₹${Number(request.amount).toFixed(2)}.`
          );
        }
        // True imprest: posting the expense happens upon claim approval/posting!
        // Dr Expense, Dr Input Tax, Cr 1114
        const voucher = await this.postExpenseClaimVoucher(request, checkerId, txClient);
        return PettyCashRepository.approve(
          request.id,
          {
            checker_id: checkerId,
            checker_notes: params.notes,
            voucher_id: voucher.id,
          },
          txClient
        );
      } else {
        // For INITIAL_FUNDING or REIMBURSEMENT, approval enables disbursement
        return PettyCashRepository.approve(
          request.id,
          {
            checker_id: checkerId,
            checker_notes: params.notes,
          },
          txClient
        );
      }
    };

    return executeInTransaction(client, execute);
  }

  /**
   * Step 3: Disburser executes initial funding disbursement (Central Accounts).
   * Dr 1114 Petty Cash / Cr 1112 Bank Operating A/c
   */
  static async disburseInitialFunding(
    params: {
      request_id: string;
      bank_account_id?: string;
      notes?: string;
      voucher_date?: string;
    },
    disburser: PettyCashActor,
    client?: PoolClient
  ): Promise<PettyCashRequestRow> {
    const execute = async (txClient: PoolClient) => {
      const request = await PettyCashRepository.findById(params.request_id, txClient, true);
      if (!request) {
        throw new PettyCashServiceError("REQUEST_NOT_FOUND", `Request '${params.request_id}' not found.`);
      }

      if (request.status !== "APPROVED") {
        throw new PettyCashServiceError(
          "INVALID_REQUEST_STATUS",
          `Request must be APPROVED before disbursement. Current status is '${request.status}'.`
        );
      }

      if (request.request_type !== "INITIAL_FUNDING") {
        throw new PettyCashServiceError(
          "INVALID_REQUEST_STATUS",
          `Expected INITIAL_FUNDING request type, got '${request.request_type}'.`
        );
      }

      const disburserId = (disburser as any).userId || disburser.id;

      // 3-tier SoD: Disburser != Maker AND Disburser != Checker
      if (disburserId === request.maker_id || disburserId === request.checker_id) {
        throw new PettyCashServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Disburser must be distinct from both Maker and Checker. Segregation of duties violation."
        );
      }

      const acc1114 = await AccountingAccountRepository.findByCode("1114", txClient);
      if (!acc1114) {
        throw new PettyCashServiceError("ACCOUNT_NOT_FOUND", "Account 1114 (Petty Cash - Branches) not found.");
      }

      // Resolve bank credit account (default 1112)
      let bankGlId = "";
      if (params.bank_account_id) {
        const bankAcc = await BankAccountRepository.findById(params.bank_account_id, txClient);
        if (bankAcc?.gl_account_id) {
          bankGlId = bankAcc.gl_account_id;
        }
      }
      if (!bankGlId) {
        const acc1112 = await AccountingAccountRepository.findByCode("1112", txClient);
        if (!acc1112) {
          throw new PettyCashServiceError("ACCOUNT_NOT_FOUND", "Account 1112 (Bank Operating A/c) not found.");
        }
        bankGlId = acc1112.id;
      }

      const vDate = params.voucher_date || new Date().toISOString().split("T")[0];
      await PostingService.validateAccountingStartDate(vDate, txClient);
      await PostingService.validateFiscalPeriod(vDate, txClient);

      const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(vDate, txClient);
      const fiscalYear = periodStatus.status === "PERIOD_OPEN" ? periodStatus.period.fiscal_year : "FY2026-27";

      // Lines: Dr 1114 / Cr 1112
      const lines: JournalLineInput[] = [
        {
          account_id: acc1114.id,
          debit_amount: request.amount,
          credit_amount: 0,
          branch_id: request.branch_id,
          narration: `Initial petty cash imprest funding for branch (${request.request_number})`,
        },
        {
          account_id: bankGlId,
          debit_amount: 0,
          credit_amount: request.amount,
          branch_id: request.branch_id,
          narration: `Disbursement from bank for petty cash imprest float (${request.request_number})`,
        },
      ];

      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "PAYMENT",
          voucher_date: vDate,
          branch_id: request.branch_id,
          narration: `Petty cash initial imprest funding: ${request.request_number}`,
          reference_type: "PETTY_CASH",
          reference_id: request.id,
          reference_event: "INITIAL_FUNDING",
        },
        branchId: request.branch_id,
        fiscalYear,
        createdBy: request.maker_id,
        client: txClient,
      });

      if (!draftRes.success) {
        throw new PettyCashServiceError("POSTING_FAILED", draftRes.error);
      }
      const voucher = draftRes.data;

      // Lifecycle progression
      await PostingService.submitVoucher({
        voucherId: voucher.id,
        submittedBy: request.maker_id,
        branchId: request.branch_id,
        client: txClient,
      });

      // System approval for canonical voucher SoD (Checker approves Maker's voucher)
      await AccountingVoucherRepository.approve(voucher.id, request.checker_id || disburserId, request.branch_id, txClient);

      // Post
      const postRes = await PostingService.postVoucher({
        voucherId: voucher.id,
        postedBy: disburserId,
        lines,
        branchId: request.branch_id,
        client: txClient,
      });

      if (!postRes.success) {
        throw new PettyCashServiceError("POSTING_FAILED", postRes.error);
      }

      return PettyCashRepository.disburse(
        request.id,
        {
          disburser_id: disburserId,
          bank_account_id: params.bank_account_id,
          payment_voucher_id: voucher.id,
          disburser_notes: params.notes,
        },
        txClient
      );
    };

    return executeInTransaction(client, execute);
  }

  /**
   * Step 4: Maker records an Expense Claim for cash spent locally.
   * Calculates dynamic GST if eligible.
   */
  static async recordExpenseClaim(
    params: {
      branch_id: string;
      amount: number;
      purpose: string;
      expense_account_code?: string;
      tax_rate?: number;
      receipt_reference?: string;
    },
    maker: PettyCashActor,
    client?: PoolClient
  ): Promise<PettyCashRequestRow> {
    const amount = round2(params.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new PettyCashServiceError("INVALID_AMOUNT", `Expense claim amount must be positive. Got ${params.amount}.`);
    }

    const branchRes = await (client ? client.query.bind(client) : dbQuery)(
      `SELECT code FROM public.branch WHERE id = $1`,
      [params.branch_id]
    );
    const branchCode = branchRes.rows[0]?.code || "BR";
    const requestNumber = await PettyCashRepository.getNextRequestNumber(branchCode, client);

    const expenseCode = params.expense_account_code || "5299"; // default Miscellaneous Operating Expenses
    const taxRate = params.tax_rate ? Number(params.tax_rate) : 0;

    let gstAmount = 0;
    let netExpenseAmount = amount;
    let inputGstAccountCode: string | null = null;

    if (taxRate > 0) {
      // Calculate tax dynamically: inclusive or exclusive? In retail receipts, amount is total paid.
      // Net = amount / (1 + taxRate/100)
      netExpenseAmount = round2(amount / (1 + taxRate / 100));
      gstAmount = round2(amount - netExpenseAmount);

      // Dynamic Input Tax Account Resolution from PostgreSQL Chart of Accounts:
      inputGstAccountCode = await this.resolveInputTaxAccountCode(taxRate, "CGST", client);
      if (!inputGstAccountCode) {
        if (taxRate === 5) {
          inputGstAccountCode = "1141";
        } else if (taxRate === 18) {
          inputGstAccountCode = "1143";
        } else if (taxRate === 12) {
          inputGstAccountCode = "1147";
        }
      }
    }

    const makerId = (maker as any).userId || maker.id;

    const execute = async (txClient: PoolClient) => {
      return PettyCashRepository.create(
        {
          request_number: requestNumber,
          branch_id: params.branch_id,
          request_type: "EXPENSE_CLAIM",
          amount,
          purpose: params.purpose,
          maker_id: makerId,
          expense_category_id: expenseCode,
          expense_account_code: expenseCode,
          tax_rate: taxRate,
          gst_amount: gstAmount,
          net_expense_amount: netExpenseAmount,
          input_gst_account_code: inputGstAccountCode,
          receipt_reference: params.receipt_reference,
          status: "SUBMITTED",
        },
        txClient
      );
    };

    return executeInTransaction(client, execute);
  }

  /**
   * Internal helper: Posts the expense voucher when an EXPENSE_CLAIM is approved.
   * Dr Expense (5xxx)
   * Dr Input GST (114x, if applicable)
   *     Cr 1114 Petty Cash - Branches
   */
  private static async postExpenseClaimVoucher(
    request: PettyCashRequestRow,
    approvedBy: string,
    client: PoolClient
  ) {
    const expenseCode = request.expense_account_code || "5299";
    const accExp = await AccountingAccountRepository.findByCode(expenseCode, client);
    if (!accExp) {
      throw new PettyCashServiceError("ACCOUNT_NOT_FOUND", `Expense account '${expenseCode}' not found.`);
    }

    const acc1114 = await AccountingAccountRepository.findByCode("1114", client);
    if (!acc1114) {
      throw new PettyCashServiceError("ACCOUNT_NOT_FOUND", "Account 1114 (Petty Cash - Branches) not found.");
    }

    const vDate = new Date().toISOString().split("T")[0];
    await PostingService.validateAccountingStartDate(vDate, client);
    await PostingService.validateFiscalPeriod(vDate, client);

    const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(vDate, client);
    const fiscalYear = periodStatus.status === "PERIOD_OPEN" ? periodStatus.period.fiscal_year : "FY2026-27";

    const lines: JournalLineInput[] = [];

    if (request.gst_amount && request.gst_amount > 0 && request.input_gst_account_code) {
      // Intra-state splits into CGST + SGST
      const halfGst = round2(request.gst_amount / 2);
      const otherHalf = round2(request.gst_amount - halfGst);

      // Dr Expense
      lines.push({
        account_id: accExp.id,
        debit_amount: request.net_expense_amount,
        credit_amount: 0,
        branch_id: request.branch_id,
        narration: `Petty cash expense: ${request.purpose}`,
      });

      // Dr CGST & SGST dynamically resolved from PostgreSQL
      const cgstCode = request.input_gst_account_code;
      let sgstCode: string | null = null;
      if (request.tax_rate) {
        sgstCode = await this.resolveInputTaxAccountCode(request.tax_rate, "SGST", client);
      }
      if (!sgstCode) {
        sgstCode = cgstCode === "1141" ? "1142" : cgstCode === "1143" ? "1144" : "1148";
      }
      const accCgst = await AccountingAccountRepository.findByCode(cgstCode, client);
      const accSgst = await AccountingAccountRepository.findByCode(sgstCode, client);

      if (accCgst && accSgst) {
        lines.push({
          account_id: accCgst.id,
          debit_amount: halfGst,
          credit_amount: 0,
          branch_id: request.branch_id,
          narration: `Input CGST on petty cash expense (${request.request_number})`,
        });
        lines.push({
          account_id: accSgst.id,
          debit_amount: otherHalf,
          credit_amount: 0,
          branch_id: request.branch_id,
          narration: `Input SGST on petty cash expense (${request.request_number})`,
        });
      } else {
        // Fallback: direct debit to expense
        lines[0].debit_amount = request.amount;
      }
    } else {
      // Dr Expense full amount
      lines.push({
        account_id: accExp.id,
        debit_amount: request.amount,
        credit_amount: 0,
        branch_id: request.branch_id,
        narration: `Petty cash expense: ${request.purpose}`,
      });
    }

    // Cr 1114 Petty Cash - Branches
    lines.push({
      account_id: acc1114.id,
      debit_amount: 0,
      credit_amount: request.amount,
      branch_id: request.branch_id,
      narration: `Petty cash disbursement credit (${request.request_number})`,
    });

    const draftRes = await PostingService.createVoucherDraft({
      input: {
        voucher_type: "EXPENSE",
        voucher_date: vDate,
        branch_id: request.branch_id,
        narration: `Petty cash expense: ${request.request_number} - ${request.purpose}`,
        reference_type: "PETTY_CASH",
        reference_id: request.id,
        reference_event: "EXPENSE_POSTING",
      },
      branchId: request.branch_id,
      fiscalYear,
      createdBy: request.maker_id,
      client,
    });

    if (!draftRes.success) {
      throw new PettyCashServiceError("POSTING_FAILED", draftRes.error);
    }
    const voucher = draftRes.data;

    await PostingService.submitVoucher({
      voucherId: voucher.id,
      submittedBy: request.maker_id,
      branchId: request.branch_id,
      client,
    });

    await AccountingVoucherRepository.approve(voucher.id, approvedBy, request.branch_id, client);

    const postRes = await PostingService.postVoucher({
      voucherId: voucher.id,
      postedBy: approvedBy,
      lines,
      branchId: request.branch_id,
      client,
    });

    if (!postRes.success) {
      throw new PettyCashServiceError("POSTING_FAILED", postRes.error);
    }

    return voucher;
  }

  /**
   * Step 5: Disburser executes Imprest Reimbursement (Central Accounts).
   * Restores Account 1114 Petty Cash from Bank 1112.
   *
   * Dr 1114 Petty Cash - Branches
   *     Cr 1112 Bank Operating A/c
   *
   * ZERO duplicate expense recognition!
   */
  static async reimbursePettyCash(
    params: {
      request_id: string;
      bank_account_id?: string;
      notes?: string;
      voucher_date?: string;
    },
    disburser: PettyCashActor,
    client?: PoolClient
  ): Promise<PettyCashRequestRow> {
    const execute = async (txClient: PoolClient) => {
      const request = await PettyCashRepository.findById(params.request_id, txClient, true);
      if (!request) {
        throw new PettyCashServiceError("REQUEST_NOT_FOUND", `Request '${params.request_id}' not found.`);
      }

      // Reimbursement can be applied to an APPROVED expense claim or a REIMBURSEMENT request
      if (request.status !== "APPROVED") {
        throw new PettyCashServiceError(
          "INVALID_REQUEST_STATUS",
          `Request must be APPROVED to reimburse. Current status is '${request.status}'.`
        );
      }

      const disburserId = (disburser as any).userId || disburser.id;

      // SoD: Disburser != Maker AND Disburser != Checker
      if (disburserId === request.maker_id || disburserId === request.checker_id) {
        throw new PettyCashServiceError(
          "SEGREGATION_OF_DUTIES_VIOLATION",
          "Disburser must be distinct from both Maker and Checker. Segregation of duties violation."
        );
      }

      const acc1114 = await AccountingAccountRepository.findByCode("1114", txClient);
      if (!acc1114) {
        throw new PettyCashServiceError("ACCOUNT_NOT_FOUND", "Account 1114 (Petty Cash - Branches) not found.");
      }

      let bankGlId = "";
      if (params.bank_account_id) {
        const bankAcc = await BankAccountRepository.findById(params.bank_account_id, txClient);
        if (bankAcc?.gl_account_id) {
          bankGlId = bankAcc.gl_account_id;
        }
      }
      if (!bankGlId) {
        const acc1112 = await AccountingAccountRepository.findByCode("1112", txClient);
        if (!acc1112) {
          throw new PettyCashServiceError("ACCOUNT_NOT_FOUND", "Account 1112 (Bank Operating A/c) not found.");
        }
        bankGlId = acc1112.id;
      }

      const vDate = params.voucher_date || new Date().toISOString().split("T")[0];
      await PostingService.validateAccountingStartDate(vDate, txClient);
      await PostingService.validateFiscalPeriod(vDate, txClient);

      const periodStatus = await AccountingFiscalPeriodRepository.getPeriodStatusForDate(vDate, txClient);
      const fiscalYear = periodStatus.status === "PERIOD_OPEN" ? periodStatus.period.fiscal_year : "FY2026-27";

      // Lines: Dr 1114 / Cr 1112
      const lines: JournalLineInput[] = [
        {
          account_id: acc1114.id,
          debit_amount: request.amount,
          credit_amount: 0,
          branch_id: request.branch_id,
          narration: `Imprest reimbursement for branch (${request.request_number})`,
        },
        {
          account_id: bankGlId,
          debit_amount: 0,
          credit_amount: request.amount,
          branch_id: request.branch_id,
          narration: `Bank reimbursement disbursement for petty cash imprest (${request.request_number})`,
        },
      ];

      const draftRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "PAYMENT",
          voucher_date: vDate,
          branch_id: request.branch_id,
          narration: `Petty cash imprest reimbursement: ${request.request_number}`,
          reference_type: "PETTY_CASH",
          reference_id: request.id,
          reference_event: "REIMBURSEMENT",
        },
        branchId: request.branch_id,
        fiscalYear,
        createdBy: request.maker_id,
        client: txClient,
      });

      if (!draftRes.success) {
        throw new PettyCashServiceError("POSTING_FAILED", draftRes.error);
      }
      const voucher = draftRes.data;

      await PostingService.submitVoucher({
        voucherId: voucher.id,
        submittedBy: request.maker_id,
        branchId: request.branch_id,
        client: txClient,
      });

      await AccountingVoucherRepository.approve(voucher.id, request.checker_id || disburserId, request.branch_id, txClient);

      const postRes = await PostingService.postVoucher({
        voucherId: voucher.id,
        postedBy: disburserId,
        lines,
        branchId: request.branch_id,
        client: txClient,
      });

      if (!postRes.success) {
        throw new PettyCashServiceError("POSTING_FAILED", postRes.error);
      }

      return PettyCashRepository.disburse(
        request.id,
        {
          disburser_id: disburserId,
          bank_account_id: params.bank_account_id,
          payment_voucher_id: voucher.id,
          disburser_notes: params.notes,
        },
        txClient
      );
    };

    return executeInTransaction(client, execute);
  }
}
