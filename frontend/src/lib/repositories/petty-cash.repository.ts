/**
 * CakeToHome ERP — Petty Cash Request Repository
 * Phase C7.5: Branch Cash Control & Vault Custody Expansion
 *
 * Implements persistence for the petty cash lifecycle (maker, checker, disburser).
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import {
  PettyCashRequestRow,
  PettyCashRequestStatus,
  PettyCashRequestType,
} from "../types/vault-custody.types";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export class PettyCashRepository {
  /**
   * Generates next canonical request number: PC-{branchCode}-{year}-{seq}
   */
  static async getNextRequestNumber(
    branchCode: string,
    client?: PoolClient
  ): Promise<string> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const year = new Date().getFullYear();
    const prefix = `PC-${branchCode.toUpperCase()}-${year}-`;
    const sql = `
      SELECT request_number
      FROM public.petty_cash_request
      WHERE request_number LIKE $1
      ORDER BY request_number DESC
      LIMIT 1;
    `;
    const res = await queryFn(sql, [`${prefix}%`]);
    let seq = 1;
    if (res.rows.length > 0) {
      const parts = res.rows[0].request_number.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `${prefix}${String(seq).padStart(4, "0")}`;
  }

  /**
   * Finds a request by ID.
   */
  static async findById(
    id: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<PettyCashRequestRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const lock = forUpdate ? "FOR UPDATE" : "";
    const sql = `
      SELECT 
        pcr.id, pcr.request_number, pcr.branch_id, pcr.request_type,
        pcr.amount::numeric::float8 AS amount,
        pcr.purpose, pcr.status, pcr.expense_category_id,
        pcr.tax_rate::numeric::float8 AS tax_rate,
        pcr.gst_amount::numeric::float8 AS gst_amount,
        pcr.net_expense_amount::numeric::float8 AS net_expense_amount,
        pcr.input_gst_account_code, pcr.expense_account_code,
        pcr.voucher_id, pcr.payment_voucher_id,
        pcr.maker_id, pcr.made_at,
        pcr.checker_id, pcr.checked_at, pcr.checker_notes,
        pcr.disburser_id, pcr.disbursed_at, pcr.disburser_notes,
        pcr.bank_account_id, pcr.receipt_reference, pcr.metadata,
        pcr.created_at, pcr.updated_at,
        b.name AS branch_name
      FROM public.petty_cash_request pcr
      JOIN public.branch b ON b.id = pcr.branch_id
      WHERE pcr.id = $1
      ${lock};
    `;
    const res = await queryFn(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Creates a new petty cash request.
   */
  static async create(
    params: {
      request_number: string;
      branch_id: string;
      request_type: PettyCashRequestType;
      amount: number;
      purpose: string;
      maker_id: string;
      expense_category_id?: string | null;
      tax_rate?: number;
      gst_amount?: number;
      net_expense_amount?: number;
      input_gst_account_code?: string | null;
      expense_account_code?: string | null;
      receipt_reference?: string | null;
      metadata?: Record<string, unknown> | null;
      status?: PettyCashRequestStatus;
    },
    client: PoolClient
  ): Promise<PettyCashRequestRow> {
    const amount = round2(params.amount);
    const gstAmount = round2(params.gst_amount || 0);
    const netAmount = round2(params.net_expense_amount || amount - gstAmount);
    const status = params.status || "SUBMITTED";

    const sql = `
      INSERT INTO public.petty_cash_request (
        request_number, branch_id, request_type, amount, purpose,
        status, expense_category_id, tax_rate, gst_amount, net_expense_amount,
        input_gst_account_code, expense_account_code, receipt_reference,
        maker_id, made_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15)
      RETURNING 
        id, request_number, branch_id, request_type,
        amount::numeric::float8 AS amount,
        purpose, status, expense_category_id,
        tax_rate::numeric::float8 AS tax_rate,
        gst_amount::numeric::float8 AS gst_amount,
        net_expense_amount::numeric::float8 AS net_expense_amount,
        input_gst_account_code, expense_account_code,
        voucher_id, payment_voucher_id,
        maker_id, made_at,
        checker_id, checked_at, checker_notes,
        disburser_id, disbursed_at, disburser_notes,
        bank_account_id, receipt_reference, metadata,
        created_at, updated_at;
    `;

    const res = await client.query(sql, [
      params.request_number,
      params.branch_id,
      params.request_type,
      amount,
      params.purpose,
      status,
      params.expense_category_id || null,
      params.tax_rate || 0.0,
      gstAmount,
      netAmount,
      params.input_gst_account_code || null,
      params.expense_account_code || null,
      params.receipt_reference || null,
      params.maker_id,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]);

    return res.rows[0];
  }

  /**
   * Approves a request (Checker step).
   */
  static async approve(
    id: string,
    params: {
      checker_id: string;
      checker_notes?: string;
      voucher_id?: string;
    },
    client: PoolClient
  ): Promise<PettyCashRequestRow> {
    const sql = `
      UPDATE public.petty_cash_request
      SET 
        status = 'APPROVED',
        checker_id = $2,
        checked_at = NOW(),
        checker_notes = $3,
        voucher_id = COALESCE($4, voucher_id),
        updated_at = NOW()
      WHERE id = $1
      RETURNING 
        id, request_number, branch_id, request_type,
        amount::numeric::float8 AS amount,
        purpose, status, expense_category_id,
        tax_rate::numeric::float8 AS tax_rate,
        gst_amount::numeric::float8 AS gst_amount,
        net_expense_amount::numeric::float8 AS net_expense_amount,
        input_gst_account_code, expense_account_code,
        voucher_id, payment_voucher_id,
        maker_id, made_at,
        checker_id, checked_at, checker_notes,
        disburser_id, disbursed_at, disburser_notes,
        bank_account_id, receipt_reference, metadata,
        created_at, updated_at;
    `;
    const res = await client.query(sql, [
      id,
      params.checker_id,
      params.checker_notes || null,
      params.voucher_id || null,
    ]);
    return res.rows[0];
  }

  /**
   * Disburses or reimburses a request (Disburser step).
   */
  static async disburse(
    id: string,
    params: {
      disburser_id: string;
      bank_account_id?: string;
      payment_voucher_id?: string;
      disburser_notes?: string;
    },
    client: PoolClient
  ): Promise<PettyCashRequestRow> {
    const sql = `
      UPDATE public.petty_cash_request
      SET 
        status = 'DISBURSED',
        disburser_id = $2,
        disbursed_at = NOW(),
        bank_account_id = $3,
        payment_voucher_id = $4,
        disburser_notes = $5,
        updated_at = NOW()
      WHERE id = $1
      RETURNING 
        id, request_number, branch_id, request_type,
        amount::numeric::float8 AS amount,
        purpose, status, expense_category_id,
        tax_rate::numeric::float8 AS tax_rate,
        gst_amount::numeric::float8 AS gst_amount,
        net_expense_amount::numeric::float8 AS net_expense_amount,
        input_gst_account_code, expense_account_code,
        voucher_id, payment_voucher_id,
        maker_id, made_at,
        checker_id, checked_at, checker_notes,
        disburser_id, disbursed_at, disburser_notes,
        bank_account_id, receipt_reference, metadata,
        created_at, updated_at;
    `;
    const res = await client.query(sql, [
      id,
      params.disburser_id,
      params.bank_account_id || null,
      params.payment_voucher_id || null,
      params.disburser_notes || null,
    ]);
    return res.rows[0];
  }

  /**
   * Rejects a request.
   */
  static async reject(
    id: string,
    checkerId: string,
    notes: string,
    client: PoolClient
  ): Promise<PettyCashRequestRow> {
    const sql = `
      UPDATE public.petty_cash_request
      SET 
        status = 'REJECTED',
        checker_id = $2,
        checked_at = NOW(),
        checker_notes = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = await client.query(sql, [id, checkerId, notes]);
    return res.rows[0];
  }

  /**
   * Lists petty cash requests with optional filtering.
   */
  static async list(
    filters: {
      branchId?: string;
      branch_id?: string;
      status?: PettyCashRequestStatus;
      requestType?: PettyCashRequestType;
      request_type?: PettyCashRequestType;
      limit?: number;
      offset?: number;
    } = {},
    client?: PoolClient
  ): Promise<PettyCashRequestRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const effectiveBranchId = filters.branchId || filters.branch_id;
    if (effectiveBranchId) {
      conditions.push(`pcr.branch_id = $${idx++}`);
      values.push(effectiveBranchId);
    }
    if (filters.status) {
      conditions.push(`pcr.status = $${idx++}`);
      values.push(filters.status);
    }
    const effectiveType = filters.requestType || filters.request_type;
    if (effectiveType) {
      conditions.push(`pcr.request_type = $${idx++}`);
      values.push(effectiveType);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const sql = `
      SELECT 
        pcr.id, pcr.request_number, pcr.branch_id, pcr.request_type,
        pcr.amount::numeric::float8 AS amount,
        pcr.purpose, pcr.status, pcr.expense_category_id,
        pcr.tax_rate::numeric::float8 AS tax_rate,
        pcr.gst_amount::numeric::float8 AS gst_amount,
        pcr.net_expense_amount::numeric::float8 AS net_expense_amount,
        pcr.input_gst_account_code, pcr.expense_account_code,
        pcr.voucher_id, pcr.payment_voucher_id,
        pcr.maker_id, pcr.made_at,
        pcr.checker_id, pcr.checked_at, pcr.checker_notes,
        pcr.disburser_id, pcr.disbursed_at, pcr.disburser_notes,
        pcr.bank_account_id, pcr.receipt_reference, pcr.metadata,
        pcr.created_at, pcr.updated_at,
        b.name AS branch_name,
        u_m.first_name || ' ' || COALESCE(u_m.last_name, '') AS maker_name,
        u_c.first_name || ' ' || COALESCE(u_c.last_name, '') AS checker_name,
        u_d.first_name || ' ' || COALESCE(u_d.last_name, '') AS disburser_name
      FROM public.petty_cash_request pcr
      JOIN public.branch b ON b.id = pcr.branch_id
      LEFT JOIN public."user" u_m ON u_m.id = pcr.maker_id
      LEFT JOIN public."user" u_c ON u_c.id = pcr.checker_id
      LEFT JOIN public."user" u_d ON u_d.id = pcr.disburser_id
      ${where}
      ORDER BY pcr.created_at DESC
      LIMIT ${limit} OFFSET ${offset};
    `;
    const res = await queryFn(sql, values);
    return res.rows;
  }
}
