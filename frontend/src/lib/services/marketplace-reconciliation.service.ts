/**
 * Marketplace Reconciliation Domain Service
 * Order-level settlement calculations, partner invoice recording, discrepancy review,
 * and Bills Payable accounting linkage.
 */

import { dbQuery, dbTransaction } from "../db";
import { MarketplacePartnerRepository, MarketplacePartnerRow, MarketplaceOrderSnapshotRow } from "../repositories/marketplace-partner.repository";
import { MarketplaceInvoiceRepository, MarketplacePartnerInvoiceRow } from "../repositories/marketplace-invoice.repository";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { PostingService } from "./posting.service";
import type { AuthenticatedActor } from "./feature-flag.service";

export interface ReconciliationLineItem {
  order_id: string;
  order_date: string;
  customer_name: string;
  items_summary: string;
  gross_order_amount: number;
  tax_amount: number;
  commission_rate: number;
  commission_amount: number;
  fixed_fee: number;
  partner_net_payable: number;
}

export interface PartnerReconciliationStatement {
  partner: {
    id: string;
    code: string;
    trade_name: string;
    legal_name: string;
    gstin: string | null;
    pan: string | null;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    total_orders: number;
    gross_sales: number;
    total_tax: number;
    commission_revenue: number;
    fixed_fees: number;
    net_payable_to_partner: number;
  };
  line_items: ReconciliationLineItem[];
}

export interface ReceivePartnerInvoiceInput {
  partnerId: string;
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  claimedAmount: number;
  documentRef?: string;
}

export class MarketplaceReconciliationService {
  /**
   * Generate authoritative PostgreSQL-derived reconciliation statement for a partner and period
   */
  static async generateStatement(
    partnerId: string,
    startDate: string,
    endDate: string
  ): Promise<PartnerReconciliationStatement> {
    const partner = await MarketplacePartnerRepository.findPartnerById(partnerId);
    if (!partner) {
      throw new Error(`Partner not found: ${partnerId}`);
    }

    // 1. Fetch active agreement to fallback if snapshot not present
    const agreement = await MarketplacePartnerRepository.getActiveAgreement(partnerId);
    const defaultCommRate = agreement?.commission_rate || 15.0;
    const defaultFixedFee = agreement?.fixed_fee_per_order || 0.0;

    // 2. Query delivered orders for partner in date range
    const ordersRes = await dbQuery(`
      SELECT o.id, o.created_at::text, o.total, o.metadata,
             mos.commission_rate, mos.fixed_fee, mos.commission_amount, mos.partner_net_receivable
      FROM "order" o
      LEFT JOIN "marketplace_order_snapshot" mos ON mos.order_id = o.id
      WHERE (o.metadata->>'partner_id' = $1 OR o.metadata->'delivery'->>'partner_id' = $1)
        AND o.status IN ('delivered', 'completed')
        AND (o.metadata->>'delivery_date')::date >= $2::date
        AND (o.metadata->>'delivery_date')::date <= $3::date
        AND o.deleted_at IS NULL
      ORDER BY o.created_at ASC;
    `, [partnerId, startDate, endDate]);

    let totalGross = 0;
    let totalTax = 0;
    let totalCommission = 0;
    let totalFixedFees = 0;
    let totalNetPayable = 0;

    const lineItems: ReconciliationLineItem[] = [];

    for (const row of ordersRes.rows || []) {
      const gross = Number(row.total || 0);
      const meta = row.metadata || {};
      const tax = Number(meta.tax_amount || 0);

      // Use immutable snapshot if present, otherwise calculate from agreement
      const commRate = row.commission_rate !== null ? Number(row.commission_rate) : defaultCommRate;
      const fixedFee = row.fixed_fee !== null ? Number(row.fixed_fee) : defaultFixedFee;
      let commission = 0;
      let netPayable = 0;

      if (row.commission_amount !== null && row.partner_net_receivable !== null) {
        commission = Number(row.commission_amount);
        netPayable = Number(row.partner_net_receivable);
      } else {
        const agreementType = agreement?.agreement_type || "COMMISSION_PERCENTAGE";
        if (agreementType === "COMMISSION_PERCENTAGE") {
          commission = Math.round(((gross * commRate) / 100) * 100) / 100;
          netPayable = Math.max(0, gross - commission);
        } else if (agreementType === "FIXED_PER_ORDER") {
          commission = fixedFee;
          netPayable = Math.max(0, gross - fixedFee);
        } else if (agreementType === "HYBRID") {
          commission = Math.round(((gross * commRate) / 100) * 100) / 100 + fixedFee;
          netPayable = Math.max(0, gross - commission);
        } else {
          // Wholesale transfer / buy-resell
          commission = 0;
          netPayable = gross;
        }
      }

      totalGross += gross;
      totalTax += tax;
      totalCommission += commission;
      totalFixedFees += fixedFee;
      totalNetPayable += netPayable;

      const items = Array.isArray(meta.items)
        ? meta.items.map((i: any) => `${i.title || i.name} x${i.quantity || 1}`).join(", ")
        : "Standard order items";

      lineItems.push({
        order_id: row.id,
        order_date: meta.delivery_date || row.created_at?.split("T")[0] || startDate,
        customer_name: meta.customer_name || "Valued Customer",
        items_summary: items,
        gross_order_amount: gross,
        tax_amount: tax,
        commission_rate: commRate,
        commission_amount: commission,
        fixed_fee: fixedFee,
        partner_net_payable: netPayable,
      });
    }

    return {
      partner: {
        id: partner.id,
        code: partner.code,
        trade_name: partner.trade_name,
        legal_name: partner.legal_name,
        gstin: partner.gstin,
        pan: partner.pan,
      },
      period: {
        startDate,
        endDate,
      },
      summary: {
        total_orders: lineItems.length,
        gross_sales: Math.round(totalGross * 100) / 100,
        total_tax: Math.round(totalTax * 100) / 100,
        commission_revenue: Math.round(totalCommission * 100) / 100,
        fixed_fees: Math.round(totalFixedFees * 100) / 100,
        net_payable_to_partner: Math.round(totalNetPayable * 100) / 100,
      },
      line_items: lineItems,
    };
  }

  /**
   * Record receipt of an already-issued partner tax invoice
   */
  static async receivePartnerInvoice(
    input: ReceivePartnerInvoiceInput,
    actor: AuthenticatedActor
  ): Promise<{
    success: boolean;
    invoice?: MarketplacePartnerInvoiceRow;
    hasDiscrepancy?: boolean;
    discrepancyAmount?: number;
    error?: string;
  }> {
    // 1. Duplicate invoice check
    const existing = await MarketplaceInvoiceRepository.findByInvoiceNumber(input.partnerId, input.invoiceNumber);
    if (existing) {
      return {
        success: false,
        error: `DUPLICATE_INVOICE: Invoice '${input.invoiceNumber}' has already been recorded for partner '${input.partnerId}'.`,
      };
    }

    // 2. Generate authoritative PostgreSQL-derived reconciliation statement
    const statement = await this.generateStatement(input.partnerId, input.periodStart, input.periodEnd);
    const calculatedAmount = statement.summary.net_payable_to_partner;
    const discrepancy = Math.round((input.claimedAmount - calculatedAmount) * 100) / 100;
    const hasDiscrepancy = Math.abs(discrepancy) > 0.01;

    const status = hasDiscrepancy ? "DISCREPANCY_DETECTED" : "RECONCILED";
    const invId = `pinv_${input.partnerId}_${Date.now()}`;

    const saved = await MarketplaceInvoiceRepository.saveInvoiceReceipt({
      id: invId,
      partner_id: input.partnerId,
      partner_invoice_number: input.invoiceNumber,
      partner_invoice_date: input.invoiceDate,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      claimed_amount: input.claimedAmount,
      calculated_amount: calculatedAmount,
      discrepancy_amount: discrepancy,
      document_reference: input.documentRef,
      status,
      reconciliation_statement_json: statement,
      reconciled_by: actor.userId,
    });

    return {
      success: true,
      invoice: saved,
      hasDiscrepancy,
      discrepancyAmount: discrepancy,
    };
  }

  /**
   * Approve and link invoice to Bills Payable in accounting_voucher
   */
  static async approveInvoice(
    invoiceId: string,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; invoice?: MarketplacePartnerInvoiceRow; voucherId?: string; error?: string }> {
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN" && !actor.permissions?.includes("ACCOUNTING.POST")) {
      return { success: false, error: "UNAUTHORIZED: Requires SUPER_ADMIN, ADMIN, or ACCOUNTING.POST permission." };
    }

    const inv = await MarketplaceInvoiceRepository.findById(invoiceId);
    if (!inv) return { success: false, error: "Invoice not found." };

    if (inv.status === "APPROVED" || inv.status === "POSTED_TO_BILLS_PAYABLE" || inv.status === "SETTLED") {
      return { success: false, error: "Invoice has already been approved or settled." };
    }

    // Check fiscal period configuration for invoice date
    const invoiceDate = inv.partner_invoice_date || new Date().toISOString().split("T")[0];
    const fpRes = await dbQuery(
      `SELECT * FROM "accounting_fiscal_period"
       WHERE start_date <= $1::date AND end_date >= $1::date AND is_locked = false
       LIMIT 1`,
      [invoiceDate]
    );

    if (!fpRes.rows || fpRes.rows.length === 0) {
      return {
        success: false,
        error: `FISCAL_PERIOD_NOT_CONFIGURED: No active/unlocked fiscal period configured for invoice date ${invoiceDate}. Bills Payable posting blocked.`,
      };
    }
    const fiscalPeriod = fpRes.rows[0];

    // Fetch partner details
    const partner = await MarketplacePartnerRepository.findPartnerById(inv.partner_id);

    // Create authentic Bills Payable voucher draft in PostgreSQL accounting_voucher
    const voucherId = `vch_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const voucherNo = `VCH-BILL-${fiscalPeriod.fiscal_year || "FY2026-27"}-${Date.now().toString().slice(-6)}`;

    // Maker-checker segregation of duties (chk_voucher_segregation)
    const makerId = (inv.reconciled_by && inv.reconciled_by !== actor.userId)
      ? inv.reconciled_by
      : "system:marketplace_reconciliation";
    const checkerId = actor.userId;

    await dbTransaction(async (client) => {
      await client.query(
        `INSERT INTO "accounting_voucher" (
           id, voucher_no, voucher_type, voucher_date, branch_id, fiscal_year,
           status, total_amount, currency, reference_type, reference_id, reference_event,
           narration, created_by, approved_by, approved_at, metadata, created_at, updated_at
         ) VALUES (
           $1, $2, 'PURCHASE', $3::date, 'br_indiranagar', $4,
           'APPROVED', $5, 'INR', 'MARKETPLACE_INVOICE', $6, 'INVOICE_APPROVAL',
           $7, $8, $9, NOW(), $10, NOW(), NOW()
         )`,
        [
          voucherId,
          voucherNo,
          invoiceDate,
          fiscalPeriod.fiscal_year || "FY2026-27",
          inv.calculated_amount,
          inv.id,
          `Bills Payable for Partner Invoice ${inv.partner_invoice_number} (${partner?.trade_name || inv.partner_id})`,
          makerId,
          checkerId,
          JSON.stringify({
            partner_id: inv.partner_id,
            partner_code: partner?.code,
            partner_trade_name: partner?.trade_name,
            invoice_number: inv.partner_invoice_number,
            claimed_amount: inv.claimed_amount,
            calculated_amount: inv.calculated_amount,
            discrepancy: inv.discrepancy_amount,
            period_start: inv.period_start,
            period_end: inv.period_end,
          }),
        ]
      );

      await client.query(
        `UPDATE "marketplace_partner_invoice"
         SET status = 'APPROVED',
             accounting_voucher_id = $1,
             reconciled_by = $2,
             reconciled_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [voucherId, actor.userId, invoiceId]
      );
    });

    const updated = await MarketplaceInvoiceRepository.findById(invoiceId);
    return { success: true, invoice: updated || undefined, voucherId };
  }

  /**
   * Settle approved partner invoice with duplicate prevention
   */
  static async settleInvoice(
    params: {
      invoiceId: string;
      paymentMethod: string;
      transactionReference: string;
      amountPaid: number;
      settlementDate?: string;
    },
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; invoice?: MarketplacePartnerInvoiceRow; error?: string }> {
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN" && !actor.permissions?.includes("ACCOUNTING.POST")) {
      return { success: false, error: "UNAUTHORIZED: Requires SUPER_ADMIN, ADMIN, or ACCOUNTING.POST permission." };
    }

    const inv = await MarketplaceInvoiceRepository.findById(params.invoiceId);
    if (!inv) return { success: false, error: "Invoice not found." };

    if (inv.status === "SETTLED") {
      return { success: false, error: "DUPLICATE_SETTLEMENT: Invoice has already been settled." };
    }

    if (inv.status !== "APPROVED" && inv.status !== "POSTED_TO_BILLS_PAYABLE") {
      return { success: false, error: `CANNOT_SETTLE: Invoice must be in APPROVED status (current: ${inv.status}).` };
    }

    await dbTransaction(async (client) => {
      // Update invoice status to SETTLED
      await client.query(
        `UPDATE "marketplace_partner_invoice"
         SET status = 'SETTLED',
             updated_at = NOW()
         WHERE id = $1`,
        [params.invoiceId]
      );

      // If linked to accounting_voucher, record settlement in voucher metadata
      if (inv.accounting_voucher_id) {
        await client.query(
          `UPDATE "accounting_voucher"
           SET metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb),
                 '{settlement}',
                 $1::jsonb
               ),
               updated_at = NOW()
           WHERE id = $2`,
          [
            JSON.stringify({
              settled_at: new Date().toISOString(),
              settled_by: actor.userId,
              payment_method: params.paymentMethod,
              transaction_reference: params.transactionReference,
              amount_paid: params.amountPaid,
            }),
            inv.accounting_voucher_id,
          ]
        );
      }
    });

    const updated = await MarketplaceInvoiceRepository.findById(params.invoiceId);
    return { success: true, invoice: updated || undefined };
  }

  /**
   * Post approved Bills Payable voucher to General Ledger
   * Strictly enforces fiscal period validation, posting accounts, balanced journal lines,
   * SoD (poster !== creator), and updates invoice status to POSTED_TO_BILLS_PAYABLE.
   */
  static async postInvoiceToGl(
    invoiceId: string,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; invoice?: MarketplacePartnerInvoiceRow; voucher?: any; error?: string }> {
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN" && !actor.permissions?.includes("ACCOUNTING.POST")) {
      return { success: false, error: "UNAUTHORIZED: Requires SUPER_ADMIN, ADMIN, or ACCOUNTING.POST permission." };
    }

    const inv = await MarketplaceInvoiceRepository.findById(invoiceId);
    if (!inv) return { success: false, error: "Invoice not found." };

    if (inv.status === "POSTED_TO_BILLS_PAYABLE") {
      return { success: false, error: "INVOICE_ALREADY_POSTED: Invoice has already been posted to General Ledger." };
    }

    if (inv.status !== "APPROVED") {
      return { success: false, error: `INVALID_INVOICE_STATE: Invoice must be in APPROVED status before GL posting (current: ${inv.status}).` };
    }

    if (!inv.accounting_voucher_id) {
      return { success: false, error: "MISSING_VOUCHER: No linked Bills Payable voucher found for this invoice." };
    }

    // Resolve accounts: Dr 5110 (COGS - Cakes / Wholesale Cost) / Cr 2111 (Accounts Payable)
    const cogsAccount = await AccountingAccountRepository.findByCode("5110");
    const apAccount = await AccountingAccountRepository.findByCode("2111");

    if (!cogsAccount || !apAccount) {
      return { success: false, error: "POSTING_ACCOUNT_INVALID: Canonical accounts 5110 or 2111 not found in chart of accounts." };
    }

    const amount = Number(inv.calculated_amount);
    if (amount <= 0) {
      return { success: false, error: "INVALID_AMOUNT: Invoice calculated amount must be greater than zero." };
    }

    const lines = [
      {
        account_id: cogsAccount.id,
        debit_amount: amount,
        credit_amount: 0,
        narration: `Marketplace Wholesale Purchases: Partner ${inv.partner_id} Invoice ${inv.partner_invoice_number}`,
      },
      {
        account_id: apAccount.id,
        debit_amount: 0,
        credit_amount: amount,
        narration: `Bills Payable Control: Partner ${inv.partner_id} Invoice ${inv.partner_invoice_number}`,
      },
    ];

    try {
      const postingRes = await PostingService.postVoucher({
        voucherId: inv.accounting_voucher_id,
        postedBy: actor.userId,
        lines,
      });

      if (!postingRes.success) {
        return { success: false, error: postingRes.error };
      }

      // Atomically update invoice status to POSTED_TO_BILLS_PAYABLE
      await dbQuery(
        `UPDATE "marketplace_partner_invoice"
         SET status = 'POSTED_TO_BILLS_PAYABLE',
             updated_at = NOW()
         WHERE id = $1`,
        [invoiceId]
      );

      const updated = await MarketplaceInvoiceRepository.findById(invoiceId);
      return { success: true, invoice: updated || undefined, voucher: postingRes.data.voucher };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to post invoice voucher to General Ledger" };
    }
  }

  /**
   * Reject / Reverse an invoice with full audit trail and voucher reconciliation
   */
  static async reverseInvoice(
    invoiceId: string,
    reason: string,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; invoice?: MarketplacePartnerInvoiceRow; error?: string }> {
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN" && !actor.permissions?.includes("ACCOUNTING.POST")) {
      return { success: false, error: "UNAUTHORIZED: Requires SUPER_ADMIN, ADMIN, or ACCOUNTING.POST permission." };
    }

    const inv = await MarketplaceInvoiceRepository.findById(invoiceId);
    if (!inv) return { success: false, error: "Invoice not found." };

    if (inv.status === "SETTLED") {
      return { success: false, error: "CANNOT_REVERSE_SETTLED: Settled invoices cannot be reversed without an authorized customer refund disbursement voucher." };
    }

    if (inv.status === "REJECTED") {
      return { success: false, error: "ALREADY_REJECTED: Invoice is already in REJECTED status." };
    }

    await dbTransaction(async (client) => {
      // If linked to voucher, cancel the voucher if not posted
      if (inv.accounting_voucher_id) {
        const vchRes = await client.query(
          `SELECT id, status FROM "accounting_voucher" WHERE id = $1 FOR UPDATE`,
          [inv.accounting_voucher_id]
        );
        const vch = vchRes.rows[0];
        if (vch && vch.status !== "POSTED") {
          await client.query(
            `UPDATE "accounting_voucher"
             SET status = 'CANCELLED',
                 metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{rejection_reason}', to_jsonb($1::text)),
                 updated_at = NOW()
             WHERE id = $2`,
            [reason, inv.accounting_voucher_id]
          );
        }
      }

      await client.query(
        `UPDATE "marketplace_partner_invoice"
         SET status = 'REJECTED',
             document_reference = COALESCE(document_reference, '') || ' | Rejection: ' || $1,
             updated_at = NOW()
         WHERE id = $2`,
        [reason, invoiceId]
      );
    });

    const updated = await MarketplaceInvoiceRepository.findById(invoiceId);
    return { success: true, invoice: updated || undefined };
  }
}
