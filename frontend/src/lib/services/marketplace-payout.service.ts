/**
 * Marketplace partner payouts (commission model).
 *
 * 1. Statement: aggregates POSTED sales-voucher lines tagged with the partner (2112 net payable, 4150 commission,
 *    commission GST, 2131 TCS, 2130 TDS-194O) for orders not already in an open/paid payout.
 * 2. Create: saves a DRAFT payout and issues our commission tax invoice number (series CMN, our GSTIN).
 * 3. Pay: posts Dr 2112 Partner Payable (partner's supplier dimension) / Cr Bank, maker-checker enforced.
 */

import type { PoolClient } from "pg";
import { dbQuery, dbTransaction } from "../db";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { BankAccountRepository } from "../repositories/bank-account.repository";
import { PostingService } from "./posting.service";
import { MARKETPLACE_ACCOUNTS } from "../marketplace/marketplace-split";
import type { AuthenticatedActor } from "./feature-flag.service";
import type { JournalLineInput } from "../types/accounting.types";

export const COMMISSION_INVOICE_PREFIX = "CMN";

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface PayoutStatementLine {
  order_id: string;
  voucher_no: string;
  voucher_date: string;
  partner_sale_gross: number;
  commission: number;
  commission_gst: number;
  tcs: number;
  tds_194o: number;
  net_payable: number;
}

export interface PayoutStatement {
  partner_id: string;
  period_start: string;
  period_end: string;
  lines: PayoutStatementLine[];
  totals: Omit<PayoutStatementLine, "order_id" | "voucher_no" | "voucher_date"> & { order_count: number };
  branch_id: string | null;
}

function requireFinanceActor(actor: AuthenticatedActor): string | null {
  if (actor.role === "SUPER_ADMIN" || actor.role === "ADMIN" || actor.permissions?.includes("ACCOUNTING.POST")) return null;
  return "UNAUTHORIZED: Requires SUPER_ADMIN, ADMIN, or ACCOUNTING.POST permission.";
}

export class MarketplacePayoutService {
  /** Unpaid, posted partner orders in the period, with their posted split. Read-only. */
  static async buildStatement(partnerId: string, periodStart: string, periodEnd: string, client?: PoolClient): Promise<PayoutStatement> {
    const q = client ? client.query.bind(client) : dbQuery;
    const res = await q(
      `SELECT av.reference_id AS order_id, av.voucher_no, av.voucher_date::text AS voucher_date, av.branch_id,
              a.code, jl.credit_amount, jl.metadata
       FROM public.accounting_journal_line jl
       JOIN public.accounting_journal_entry je ON je.id = jl.journal_entry_id
       JOIN public.accounting_voucher av ON av.id = je.voucher_id
       JOIN public.accounting_account a ON a.id = jl.account_id
       WHERE av.status = 'POSTED' AND av.reference_type = 'SALE' AND av.deleted_at IS NULL
         AND jl.metadata->>'marketplace_partner_id' = $1
         AND av.voucher_date BETWEEN $2::date AND $3::date
         AND NOT EXISTS (
           SELECT 1 FROM public.marketplace_payout mp
           WHERE mp.partner_id = $1 AND mp.status IN ('DRAFT', 'PAID') AND mp.order_ids ? av.reference_id
         )
       ORDER BY av.voucher_date ASC, av.voucher_no ASC`,
      [partnerId, periodStart, periodEnd]
    );

    const byOrder = new Map<string, PayoutStatementLine>();
    let branchId: string | null = null;
    for (const row of res.rows as any[]) {
      branchId = branchId || row.branch_id;
      const line = byOrder.get(row.order_id) || {
        order_id: row.order_id, voucher_no: row.voucher_no, voucher_date: row.voucher_date,
        partner_sale_gross: 0, commission: 0, commission_gst: 0, tcs: 0, tds_194o: 0, net_payable: 0,
      };
      const amt = Number(row.credit_amount || 0);
      // A partner's own ledger (2112-NN) is its payable account.
      const code = String(row.code || "").startsWith(`${MARKETPLACE_ACCOUNTS.PARTNER_PAYABLE}-`) ? MARKETPLACE_ACCOUNTS.PARTNER_PAYABLE : row.code;
      switch (code) {
        case MARKETPLACE_ACCOUNTS.PARTNER_PAYABLE:
          line.net_payable = r2(line.net_payable + amt);
          line.partner_sale_gross = r2(Number(row.metadata?.partner_sale_gross || 0));
          break;
        case MARKETPLACE_ACCOUNTS.COMMISSION_INCOME: line.commission = r2(line.commission + amt); break;
        case MARKETPLACE_ACCOUNTS.GST_TCS_PAYABLE: line.tcs = r2(line.tcs + amt); break;
        case MARKETPLACE_ACCOUNTS.TDS_PAYABLE: line.tds_194o = r2(line.tds_194o + amt); break;
        default:
          if (row.metadata?.gst_on === "COMMISSION") line.commission_gst = r2(line.commission_gst + amt);
      }
      byOrder.set(row.order_id, line);
    }

    const lines = [...byOrder.values()];
    const sum = (k: keyof PayoutStatementLine) => r2(lines.reduce((s, l) => s + Number(l[k] || 0), 0));
    return {
      partner_id: partnerId, period_start: periodStart, period_end: periodEnd, lines, branch_id: branchId,
      totals: {
        order_count: lines.length,
        partner_sale_gross: sum("partner_sale_gross"), commission: sum("commission"), commission_gst: sum("commission_gst"),
        tcs: sum("tcs"), tds_194o: sum("tds_194o"), net_payable: sum("net_payable"),
      },
    };
  }

  /** Save a DRAFT payout for the period's unpaid orders and issue our commission tax invoice number. */
  static async createPayout(
    params: { partnerId: string; periodStart: string; periodEnd: string },
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; payout?: any; error?: string }> {
    const denied = requireFinanceActor(actor);
    if (denied) return { success: false, error: denied };

    try {
      const payout = await dbTransaction(async (client) => {
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('marketplace_payout::' || $1))`, [params.partnerId]);
        const st = await this.buildStatement(params.partnerId, params.periodStart, params.periodEnd, client);
        if (st.lines.length === 0) throw new Error("No unpaid posted partner orders in this period.");

        // Commission tax invoice (our supply of commission service to the partner) in our CMN series.
        const gstRes = await client.query(`SELECT gstin FROM public.gst_registration WHERE is_active = true ORDER BY created_at ASC LIMIT 1`);
        const ourGstin = gstRes.rows[0]?.gstin;
        if (!ourGstin) throw new Error("No active GST registration — cannot issue the commission invoice.");
        const fyRes = await client.query(
          `SELECT CASE WHEN EXTRACT(MONTH FROM d) >= 4 THEN EXTRACT(YEAR FROM d) ELSE EXTRACT(YEAR FROM d) - 1 END::int AS fy
           FROM (SELECT (NOW() AT TIME ZONE 'Asia/Kolkata')::date AS d) x`
        );
        await client.query(
          `INSERT INTO public.invoice_sequence (entity_id, gstin, fiscal_year, prefix, last_seq, document_type, is_active, approval_status, authorized_by, authorized_at)
           SELECT 'CAKETOHOME_PARENT', $1, $2, $3, 0, 'TAX_INVOICE', true, 'APPROVED', 'system:marketplace_commission', NOW()
           WHERE NOT EXISTS (SELECT 1 FROM public.invoice_sequence WHERE entity_id = 'CAKETOHOME_PARENT' AND gstin = $1 AND fiscal_year = $2 AND prefix = $3)`,
          [ourGstin, fyRes.rows[0].fy, COMMISSION_INVOICE_PREFIX]
        );
        const payoutId = `mpo_${params.partnerId.replace(/^mkt_part_/, "").slice(0, 20)}_${Date.now().toString(36)}`;
        const invRes = await client.query(
          `SELECT invoice_number FROM public.allocate_invoice_number($1, $2, 'CAKETOHOME_PARENT', $3, NOW())`,
          [COMMISSION_INVOICE_PREFIX, payoutId, ourGstin]
        );

        const t = st.totals;
        const ins = await client.query(
          `INSERT INTO public.marketplace_payout (id, partner_id, period_start, period_end, order_ids, order_count,
             partner_sales_gross, commission_amount, commission_gst, tcs_amount, tds_194o_amount, net_payable,
             commission_invoice_number, status, created_by, metadata)
           VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DRAFT', $14, $15)
           RETURNING *`,
          [payoutId, params.partnerId, params.periodStart, params.periodEnd, JSON.stringify(st.lines.map((l) => l.order_id)),
           t.order_count, t.partner_sale_gross, t.commission, t.commission_gst, t.tcs, t.tds_194o, t.net_payable,
           invRes.rows[0].invoice_number, actor.userId || "system", JSON.stringify({ lines: st.lines, branch_id: st.branch_id })]
        );
        return ins.rows[0];
      });
      return { success: true, payout };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Pay a DRAFT payout: Dr 2112 Partner Payable / Cr Bank (net). */
  static async payPayout(
    params: { payoutId: string; paymentDate: string; paymentMethod: string; reference: string; bankAccountId?: string | null },
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; payout?: any; voucherId?: string; error?: string }> {
    const denied = requireFinanceActor(actor);
    if (denied) return { success: false, error: denied };
    if (!params.reference?.trim()) return { success: false, error: "Payment reference / UTR is required." };
    if (!params.paymentDate) return { success: false, error: "Payment date is required." };

    try {
      const result = await dbTransaction(async (client) => {
        const pRes = await client.query(`SELECT * FROM public.marketplace_payout WHERE id = $1 FOR UPDATE`, [params.payoutId]);
        const payout = pRes.rows[0];
        if (!payout) throw new Error("Payout not found.");
        if (payout.status !== "DRAFT") throw new Error(`Payout is ${payout.status}; only DRAFT payouts can be paid.`);
        const amount = Number(payout.net_payable);
        if (!(amount > 0)) throw new Error("Payout amount must be greater than zero.");

        const partnerRes = await client.query(`SELECT trade_name, metadata FROM public.marketplace_partner WHERE id = $1`, [payout.partner_id]);
        const partner = partnerRes.rows[0];
        const supplierId = partner?.metadata?.supplier_id || null;

        // Debit the partner's own ledger (2112-NN) when it has one, else the 2112 control account.
        let payable: any = null;
        if (partner?.metadata?.ledger_account_id) {
          const own = await AccountingAccountRepository.findById(partner.metadata.ledger_account_id, client);
          if (own && own.is_active && !own.is_group) payable = own;
        }
        if (!payable) payable = await AccountingAccountRepository.findByCode(MARKETPLACE_ACCOUNTS.PARTNER_PAYABLE, client);
        if (!payable || !payable.is_active) throw new Error("Marketplace Partner Payable account 2112 is not configured.");
        let bankGl = null as any;
        if (params.bankAccountId) {
          const bank = await BankAccountRepository.findById(params.bankAccountId, client);
          if (!bank || bank.status !== "ACTIVE" || !bank.gl_account_id) throw new Error("Selected bank account is not active or has no ledger account.");
          bankGl = await AccountingAccountRepository.findById(bank.gl_account_id, client);
        } else {
          bankGl = await AccountingAccountRepository.findByCode("1112", client);
        }
        if (!bankGl || !bankGl.is_active || bankGl.is_group) throw new Error("Bank ledger account is not configured.");

        const period = await PostingService.validateFiscalPeriod(params.paymentDate, client);
        await PostingService.validateAccountingStartDate(params.paymentDate, client);
        const branchId = payout.metadata?.branch_id;
        if (!branchId) throw new Error("Payout has no branch context.");

        const narration = `Marketplace payout ${payout.id} to ${partner?.trade_name || payout.partner_id} (${payout.period_start}..${payout.period_end})`;
        const lines: JournalLineInput[] = [
          { account_id: payable.id, debit_amount: amount, credit_amount: 0, supplier_id: supplierId, branch_id: branchId,
            narration: `Partner payout: ${payout.id}`, metadata: { marketplace_partner_id: payout.partner_id, payout_id: payout.id } },
          { account_id: bankGl.id, debit_amount: 0, credit_amount: amount, branch_id: branchId,
            narration: `Payout via ${params.paymentMethod} Ref: ${params.reference}`, metadata: { payout_id: payout.id } },
        ];

        // Maker-checker: the payout's creator prepared it; the paying user approves and posts.
        const preparer = payout.created_by && payout.created_by !== actor.userId ? payout.created_by : "system:marketplace_payout";
        const draft = await PostingService.createVoucherDraft({
          input: { voucher_type: "PAYMENT", voucher_date: params.paymentDate, branch_id: branchId, narration,
            reference_type: "MARKETPLACE_PAYOUT", reference_id: payout.id, reference_event: "PARTNER_PAYOUT", lines },
          branchId, fiscalYear: period.fiscal_year, createdBy: preparer, client,
        });
        if (!draft.success) throw new Error(`Payout voucher draft failed: ${draft.error}`);
        const sub = await PostingService.submitVoucher({ voucherId: draft.data.id, submittedBy: preparer, branchId, client });
        if (!sub.success) throw new Error(`Payout voucher submit failed: ${sub.error}`);
        const appr = await PostingService.approveVoucher({ voucherId: draft.data.id, approvedBy: actor.userId, branchId, client });
        if (!appr.success) throw new Error(`Payout voucher approval failed: ${appr.error}`);
        const post = await PostingService.postVoucher({ voucherId: draft.data.id, postedBy: actor.userId, lines, branchId, client });
        if (!post.success) throw new Error(`Payout voucher posting failed: ${post.error}`);

        const upd = await client.query(
          `UPDATE public.marketplace_payout SET status = 'PAID', payment_voucher_id = $1, payment_method = $2, payment_reference = $3,
                  paid_at = NOW(), paid_by = $4, updated_at = NOW() WHERE id = $5 RETURNING *`,
          [draft.data.id, params.paymentMethod, params.reference.trim(), actor.userId, payout.id]
        );
        return { payout: upd.rows[0], voucherId: draft.data.id };
      });
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Cancel a DRAFT payout (its orders become available for a new payout). Paid payouts cannot be cancelled. */
  static async cancelPayout(payoutId: string, reason: string, actor: AuthenticatedActor): Promise<{ success: boolean; error?: string }> {
    const denied = requireFinanceActor(actor);
    if (denied) return { success: false, error: denied };
    const res = await dbQuery(
      `UPDATE public.marketplace_payout SET status = 'CANCELLED', metadata = metadata || jsonb_build_object('cancel_reason', $2::text, 'cancelled_by', $3::text), updated_at = NOW()
       WHERE id = $1 AND status = 'DRAFT' RETURNING id`,
      [payoutId, reason || "Cancelled", actor.userId]
    );
    return res.rows.length ? { success: true } : { success: false, error: "Only DRAFT payouts can be cancelled." };
  }

  static async listPayouts(partnerId?: string): Promise<any[]> {
    const res = await dbQuery(
      `SELECT mp.*, p.trade_name AS partner_trade_name FROM public.marketplace_payout mp
       JOIN public.marketplace_partner p ON p.id = mp.partner_id
       WHERE ($1::text IS NULL OR mp.partner_id = $1) ORDER BY mp.created_at DESC LIMIT 200`,
      [partnerId || null]
    );
    return res.rows;
  }
}
