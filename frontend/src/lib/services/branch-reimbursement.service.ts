/**
 * Branch reimbursements — company expenses a branch paid from its own funds (settlement BRANCH_PAID).
 * Each one is a liability on 2154 "Due to Branches" until the company pays it back.
 *
 *  Pay          → PAYMENT voucher: Dr 2154 Due to Branches / Cr bank or cash        OPEN → PAID
 *  Undo payment → reversing voucher: Dr bank / Cr 2154                               PAID → OPEN
 *  Reverse      → reverse the expense itself (ExpenseReversalService)                OPEN → REVERSED
 */

import type { PoolClient } from "pg";
import { dbQuery, dbTransaction } from "../db";
import { PostingService } from "./posting.service";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";

export class BranchReimbursementError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const r2 = (n: number) => Math.round(Number(n || 0) * 100) / 100;

export async function listBranchReimbursements(filter: { branchId?: string; status?: string } = {}) {
  const res = await dbQuery(
    `SELECT r.*, b.name AS branch_name
       FROM public.branch_reimbursement r
       LEFT JOIN public.branch b ON b.id = r.branch_id
      WHERE ($1::text IS NULL OR r.branch_id = $1)
        AND ($2::text IS NULL OR r.status = $2)
      ORDER BY (r.status = 'OPEN') DESC, r.created_at DESC
      LIMIT 500`,
    [filter.branchId || null, filter.status || null]
  );
  const rows = res.rows.map((r: any) => ({ ...r, amount: r2(r.amount) }));
  // Branch balance: what the company owes each branch (shown negative from the company's side)
  const byBranch = new Map<string, { branch_id: string; branch_name: string; owed: number; open_count: number }>();
  for (const r of rows) {
    if (r.status !== "OPEN") continue;
    const b = byBranch.get(r.branch_id) || { branch_id: r.branch_id, branch_name: r.branch_name || r.branch_id, owed: 0, open_count: 0 };
    b.owed = r2(b.owed + r.amount);
    b.open_count += 1;
    byBranch.set(r.branch_id, b);
  }
  const branches = [...byBranch.values()].map((b) => ({ ...b, balance: -b.owed }));
  return { rows, branches, total_owed: r2(branches.reduce((s, b) => s + b.owed, 0)) };
}

async function bankGlAccount(c: PoolClient, bankAccountId?: string | null) {
  if (bankAccountId) {
    const b = await c.query(`SELECT id, account_name, status, gl_account_id FROM public.bank_account WHERE id = $1 AND deleted_at IS NULL`, [bankAccountId]);
    const bank = b.rows[0];
    if (!bank) throw new BranchReimbursementError("BANK_ACCOUNT_NOT_FOUND", "Bank account not found.");
    if (bank.status !== "ACTIVE") throw new BranchReimbursementError("BANK_ACCOUNT_INACTIVE", `Bank account '${bank.account_name}' is not active.`);
    if (!bank.gl_account_id) throw new BranchReimbursementError("GL_ACCOUNT_NOT_FOUND", "Bank account has no ledger mapped.");
    return bank.gl_account_id as string;
  }
  const def = await AccountingAccountRepository.findByCode("1112", c);
  if (!def) throw new BranchReimbursementError("GL_ACCOUNT_NOT_FOUND", "Bank Operating account 1112 not found.");
  return def.id as string;
}

/** Cash account ledger: the chosen cash account's GL, else 1111 Cash in Hand. */
async function cashGlAccount(c: PoolClient, cashAccountId?: string | null) {
  if (cashAccountId) {
    const r = await c.query(`SELECT id, account_name, status, gl_account_id FROM public.cash_account WHERE id = $1 AND deleted_at IS NULL`, [cashAccountId]);
    const ca = r.rows[0];
    if (!ca) throw new BranchReimbursementError("CASH_ACCOUNT_NOT_FOUND", "Cash account not found.");
    if (ca.status !== "ACTIVE") throw new BranchReimbursementError("CASH_ACCOUNT_INACTIVE", `Cash account '${ca.account_name}' is not active.`);
    if (ca.gl_account_id) return ca.gl_account_id as string;
  }
  const def = await AccountingAccountRepository.findByCode("1111", c);
  if (!def) throw new BranchReimbursementError("GL_ACCOUNT_NOT_FOUND", "Cash in Hand account 1111 not found.");
  return def.id as string;
}

async function postTwoLineVoucher(
  c: PoolClient,
  p: { reimb: any; type: "PAYMENT" | "JOURNAL"; event: string; debitAccount: string; creditAccount: string; narration: string; makerId: string; checkerId: string; reversalOf?: string | null }
) {
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const fiscal = await PostingService.validateFiscalPeriod(today, c);
  const draft = await PostingService.createVoucherDraft({
    input: {
      voucher_type: p.type,
      voucher_date: today,
      branch_id: p.reimb.branch_id,
      narration: p.narration,
      reference_type: "BRANCH_REIMBURSEMENT",
      reference_id: p.reimb.id,
      reference_event: p.event,
      reversal_of_voucher_id: p.reversalOf || null,
      metadata: { branch_reimbursement_id: p.reimb.id, source_id: p.reimb.source_id },
    },
    branchId: p.reimb.branch_id,
    fiscalYear: fiscal.fiscal_year,
    createdBy: p.makerId,
    client: c,
  });
  if (!draft.success || !draft.data) {
    const d = draft as any;
    throw new BranchReimbursementError(d.code || "POSTING_FAILED", d.error || "Could not create voucher.");
  }
  const v = draft.data;
  const sub = await PostingService.submitVoucher({ voucherId: v.id, submittedBy: p.makerId, branchId: v.branch_id, client: c });
  if (!sub.success) throw new BranchReimbursementError(sub.code || "POSTING_FAILED", sub.error || "Submit failed.");
  const app = await PostingService.approveVoucher({ voucherId: v.id, approvedBy: p.checkerId, branchId: v.branch_id, client: c });
  if (!app.success) throw new BranchReimbursementError(app.code || "POSTING_FAILED", app.error || "Approval failed.");
  const amount = r2(p.reimb.amount);
  const post = await PostingService.postVoucher({
    voucherId: v.id,
    postedBy: p.checkerId,
    branchId: v.branch_id,
    client: c,
    lines: [
      { account_id: p.debitAccount, debit_amount: amount, credit_amount: 0, branch_id: p.reimb.branch_id, narration: p.narration },
      { account_id: p.creditAccount, debit_amount: 0, credit_amount: amount, branch_id: p.reimb.branch_id, narration: p.narration },
    ],
  });
  if (!post.success) throw new BranchReimbursementError(post.code || "POSTING_FAILED", post.error || "Posting failed.");
  return v;
}

async function lockReimbursement(c: PoolClient, id: string) {
  const r = await c.query(`SELECT * FROM public.branch_reimbursement WHERE id = $1 FOR UPDATE`, [id]);
  if (!r.rows[0]) throw new BranchReimbursementError("NOT_FOUND", "Reimbursement not found.");
  return r.rows[0];
}

/** Pay the branch back by bank transfer or cash. checkerId must differ from makerId (maker-checker). */
export async function payBranchReimbursement(params: {
  id: string;
  method?: "BANK" | "CASH";
  bankAccountId?: string | null;
  cashAccountId?: string | null;
  makerId: string;
  checkerId: string;
  client?: PoolClient;
}) {
  const method = params.method === "CASH" ? "CASH" : "BANK";
  const run = async (c: PoolClient) => {
    const reimb = await lockReimbursement(c, params.id);
    if (reimb.status !== "OPEN") throw new BranchReimbursementError("INVALID_STATE", `Only open reimbursements can be paid (this one is ${reimb.status}).`);
    const due = await AccountingAccountRepository.findByCode("2154", c);
    if (!due) throw new BranchReimbursementError("GL_ACCOUNT_NOT_FOUND", "Due to Branches account 2154 not found.");
    const payFromGl = method === "CASH" ? await cashGlAccount(c, params.cashAccountId) : await bankGlAccount(c, params.bankAccountId);
    const v = await postTwoLineVoucher(c, {
      reimb,
      type: "PAYMENT",
      event: `PAYMENT_${Date.now()}`,
      debitAccount: due.id,
      creditAccount: payFromGl,
      narration: `Reimbursement to branch (${method === "CASH" ? "cash" : "bank"}) for ${reimb.description || reimb.source_id}`,
      makerId: params.makerId,
      checkerId: params.checkerId,
    });
    const upd = await c.query(
      `UPDATE public.branch_reimbursement
          SET status = 'PAID', payment_voucher_id = $2, payment_method = $5,
              bank_account_id = $3, cash_account_id = $6, paid_at = NOW(), paid_by = $4, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [reimb.id, v.id, method === "BANK" ? params.bankAccountId || null : null, params.checkerId, method, method === "CASH" ? params.cashAccountId || null : null]
    );
    return upd.rows[0];
  };
  return params.client ? run(params.client) : dbTransaction(run);
}

/** Undo a reimbursement payment (posts the opposite entry) so it is owed to the branch again. */
export async function undoBranchReimbursementPayment(params: { id: string; reason: string; makerId: string; checkerId: string; client?: PoolClient }) {
  if (!String(params.reason || "").trim()) throw new BranchReimbursementError("REASON_REQUIRED", "A reason is required.");
  const run = async (c: PoolClient) => {
    const reimb = await lockReimbursement(c, params.id);
    if (reimb.status !== "PAID") throw new BranchReimbursementError("INVALID_STATE", "Only paid reimbursements can be undone.");
    const due = await AccountingAccountRepository.findByCode("2154", c);
    if (!due) throw new BranchReimbursementError("GL_ACCOUNT_NOT_FOUND", "Due to Branches account 2154 not found.");
    const paidFromGl = reimb.payment_method === "CASH" ? await cashGlAccount(c, reimb.cash_account_id) : await bankGlAccount(c, reimb.bank_account_id);
    const v = await postTwoLineVoucher(c, {
      reimb,
      type: "JOURNAL",
      event: `UNDO_PAYMENT_${Date.now()}`,
      debitAccount: paidFromGl,
      creditAccount: due.id,
      narration: `Undo reimbursement payment (${params.reason.trim()})`,
      makerId: params.makerId,
      checkerId: params.checkerId,
      reversalOf: reimb.payment_voucher_id,
    });
    if (reimb.payment_voucher_id) {
      await c.query(`UPDATE public.accounting_voucher SET reversed_by_voucher_id = $2, updated_at = NOW() WHERE id = $1`, [reimb.payment_voucher_id, v.id]);
    }
    const upd = await c.query(
      `UPDATE public.branch_reimbursement
          SET status = 'OPEN', payment_voucher_id = NULL, payment_method = NULL, bank_account_id = NULL, cash_account_id = NULL,
              paid_at = NULL, paid_by = NULL, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [reimb.id]
    );
    return upd.rows[0];
  };
  return params.client ? run(params.client) : dbTransaction(run);
}
