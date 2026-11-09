/**
 * Marketplace Partner Invoice Repository
 * PostgreSQL persistence for partner-issued invoices and order reconciliation records.
 */

import { dbQuery } from "../db";

export interface MarketplacePartnerInvoiceRow {
  id: string;
  partner_id: string;
  partner_invoice_number: string;
  partner_invoice_date: string;
  period_start: string;
  period_end: string;
  claimed_amount: number;
  calculated_amount: number;
  discrepancy_amount: number;
  document_reference: string | null;
  status: "RECEIVED" | "UNDER_REVIEW" | "DISCREPANCY_DETECTED" | "RECONCILED" | "APPROVED" | "REJECTED" | "POSTED_TO_BILLS_PAYABLE" | "SETTLED";
  accounting_voucher_id: string | null;
  reconciliation_statement_json: any;
  reconciled_by: string | null;
  reconciled_at: string | null;
  created_at: string;
  updated_at: string;
}

export class MarketplaceInvoiceRepository {
  /**
   * List partner invoices
   */
  static async listInvoices(filters: { partnerId?: string; status?: string } = {}): Promise<MarketplacePartnerInvoiceRow[]> {
    const params: any[] = [];
    let sql = `
      SELECT id, partner_id, partner_invoice_number, partner_invoice_date::text,
             period_start::text, period_end::text, claimed_amount, calculated_amount,
             discrepancy_amount, document_reference, status, accounting_voucher_id,
             reconciliation_statement_json, reconciled_by, reconciled_at, created_at, updated_at
      FROM "marketplace_partner_invoice"
      WHERE 1=1
    `;
    if (filters.partnerId) {
      params.push(filters.partnerId);
      sql += ` AND partner_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status.toUpperCase());
      sql += ` AND status = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC;`;

    const res = await dbQuery(sql, params);
    return (res.rows || []).map(r => ({
      ...r,
      claimed_amount: Number(r.claimed_amount),
      calculated_amount: Number(r.calculated_amount),
      discrepancy_amount: Number(r.discrepancy_amount),
    }));
  }

  /**
   * Find by ID
   */
  static async findById(id: string): Promise<MarketplacePartnerInvoiceRow | null> {
    const res = await dbQuery(`
      SELECT id, partner_id, partner_invoice_number, partner_invoice_date::text,
             period_start::text, period_end::text, claimed_amount, calculated_amount,
             discrepancy_amount, document_reference, status, accounting_voucher_id,
             reconciliation_statement_json, reconciled_by, reconciled_at, created_at, updated_at
      FROM "marketplace_partner_invoice"
      WHERE id = $1
      LIMIT 1;
    `, [id]);

    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      claimed_amount: Number(r.claimed_amount),
      calculated_amount: Number(r.calculated_amount),
      discrepancy_amount: Number(r.discrepancy_amount),
    };
  }

  /**
   * Find by partner invoice number to prevent duplicates
   */
  static async findByInvoiceNumber(partnerId: string, invoiceNumber: string): Promise<MarketplacePartnerInvoiceRow | null> {
    const res = await dbQuery(`
      SELECT id, partner_id, partner_invoice_number, partner_invoice_date::text,
             period_start::text, period_end::text, claimed_amount, calculated_amount,
             discrepancy_amount, document_reference, status, accounting_voucher_id,
             reconciliation_statement_json, reconciled_by, reconciled_at, created_at, updated_at
      FROM "marketplace_partner_invoice"
      WHERE partner_id = $1 AND UPPER(partner_invoice_number) = UPPER($2)
      LIMIT 1;
    `, [partnerId, invoiceNumber.trim()]);

    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      claimed_amount: Number(r.claimed_amount),
      calculated_amount: Number(r.calculated_amount),
      discrepancy_amount: Number(r.discrepancy_amount),
    };
  }

  /**
   * Save received partner invoice
   */
  static async saveInvoiceReceipt(invoice: {
    id: string;
    partner_id: string;
    partner_invoice_number: string;
    partner_invoice_date: string;
    period_start: string;
    period_end: string;
    claimed_amount: number;
    calculated_amount: number;
    discrepancy_amount: number;
    document_reference?: string | null;
    status: string;
    reconciliation_statement_json?: any;
    reconciled_by?: string | null;
  }): Promise<MarketplacePartnerInvoiceRow> {
    const res = await dbQuery(`
      INSERT INTO "marketplace_partner_invoice" (
        id, partner_id, partner_invoice_number, partner_invoice_date,
        period_start, period_end, claimed_amount, calculated_amount,
        discrepancy_amount, document_reference, status, reconciliation_statement_json,
        reconciled_by, reconciled_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4::date, $5::date, $6::date, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), NOW())
      RETURNING id, partner_id, partner_invoice_number, partner_invoice_date::text,
                period_start::text, period_end::text, claimed_amount, calculated_amount,
                discrepancy_amount, document_reference, status, accounting_voucher_id,
                reconciliation_statement_json, reconciled_by, reconciled_at, created_at, updated_at;
    `, [
      invoice.id,
      invoice.partner_id,
      invoice.partner_invoice_number.trim(),
      invoice.partner_invoice_date,
      invoice.period_start,
      invoice.period_end,
      invoice.claimed_amount,
      invoice.calculated_amount,
      invoice.discrepancy_amount,
      invoice.document_reference || null,
      invoice.status,
      invoice.reconciliation_statement_json ? JSON.stringify(invoice.reconciliation_statement_json) : null,
      invoice.reconciled_by || null,
    ]);

    const r = res.rows[0];
    return {
      ...r,
      claimed_amount: Number(r.claimed_amount),
      calculated_amount: Number(r.calculated_amount),
      discrepancy_amount: Number(r.discrepancy_amount),
    };
  }

  /**
   * Update invoice status and optional voucher linkage
   */
  static async updateStatus(
    id: string,
    status: string,
    voucherId?: string,
    reconciledBy?: string
  ): Promise<void> {
    await dbQuery(`
      UPDATE "marketplace_partner_invoice"
      SET status = $1,
          accounting_voucher_id = COALESCE($2, accounting_voucher_id),
          reconciled_by = COALESCE($3, reconciled_by),
          reconciled_at = NOW(),
          updated_at = NOW()
      WHERE id = $4;
    `, [status, voucherId || null, reconciledBy || null, id]);
  }
}
