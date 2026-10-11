/**
 * CakeToHome ERP — Company Repository
 * Phase A: Database-backed legal entity master.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH — No JSON, no fallback, no "company_default".
 * 2. Single-company model for CakeToHome (enforced by DB unique index on is_active=true).
 * 3. All reads/writes go through parameterized SQL.
 * 4. PAN format validated server-side before DB constraint fires.
 * 5. State code is always 2-digit Indian state code.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  CompanyRow,
  CompanyCreateInput,
  CompanyUpdateInput,
} from "../types/company.types";

export class CompanyRepository {
  /**
   * Get the active company. CakeToHome operates as a single legal entity.
   * Returns null if no company has been configured yet.
   */
  static async getActiveCompany(client?: PoolClient): Promise<CompanyRow | null> {
    const sql = `
      SELECT * FROM public.company
      WHERE is_active = true
      LIMIT 1;
    `;
    const res = client ? await client.query<CompanyRow>(sql) : await dbQuery<CompanyRow>(sql);
    return res.rows[0] || null;
  }

  /**
   * Get company by ID.
   */
  static async findById(id: string, client?: PoolClient): Promise<CompanyRow | null> {
    const sql = `SELECT * FROM public.company WHERE id = $1;`;
    const res = client ? await client.query<CompanyRow>(sql, [id]) : await dbQuery<CompanyRow>(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Create a new company record.
   * Enforces single-company via DB unique index on is_active=true.
   */
  static async create(
    input: CompanyCreateInput,
    createdBy: string,
    client?: PoolClient,
  ): Promise<CompanyRow> {
    const id = `cth_company_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const sql = `
      INSERT INTO public.company (
        id, legal_name, trade_name, registered_address, city, state_code, pin_code,
        pan, cin, fssai, currency, fy_start_month, invoice_prefix,
        phone, email, website, is_active, metadata, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, 'INR', 4, $11,
        $12, $13, $14, true, '{}', $15, NOW(), NOW()
      )
      RETURNING *;
    `;
    const values = [
      id,
      input.legal_name.trim(),
      input.trade_name?.trim() || null,
      input.registered_address?.trim() || null,
      input.city?.trim() || null,
      input.state_code.trim(),
      input.pin_code?.trim() || null,
      input.pan?.trim().toUpperCase() || null,
      input.cin?.trim().toUpperCase() || null,
      input.fssai?.trim() || null,
      input.invoice_prefix?.trim() || "CTH",
      input.phone?.trim() || null,
      input.email?.trim().toLowerCase() || null,
      input.website?.trim() || null,
      createdBy,
    ];

    const res = client ? await client.query<CompanyRow>(sql, values) : await dbQuery<CompanyRow>(sql, values);
    return res.rows[0];
  }

  /**
   * Update company fields. Only non-undefined fields are patched.
   */
  static async update(
    id: string,
    input: CompanyUpdateInput,
    client?: PoolClient,
  ): Promise<CompanyRow | null> {
    const setClauses: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [id];
    let idx = 2;

    if (input.legal_name !== undefined) {
      setClauses.push(`legal_name = $${idx++}`);
      values.push(input.legal_name.trim());
    }
    if (input.trade_name !== undefined) {
      setClauses.push(`trade_name = $${idx++}`);
      values.push(input.trade_name?.trim() || null);
    }
    if (input.registered_address !== undefined) {
      setClauses.push(`registered_address = $${idx++}`);
      values.push(input.registered_address?.trim() || null);
    }
    if (input.city !== undefined) {
      setClauses.push(`city = $${idx++}`);
      values.push(input.city?.trim() || null);
    }
    if (input.state_code !== undefined) {
      setClauses.push(`state_code = $${idx++}`);
      values.push(input.state_code.trim());
    }
    if (input.pin_code !== undefined) {
      setClauses.push(`pin_code = $${idx++}`);
      values.push(input.pin_code?.trim() || null);
    }
    if (input.pan !== undefined) {
      setClauses.push(`pan = $${idx++}`);
      values.push(input.pan?.trim().toUpperCase() || null);
    }
    if (input.cin !== undefined) {
      setClauses.push(`cin = $${idx++}`);
      values.push(input.cin?.trim().toUpperCase() || null);
    }
    if (input.fssai !== undefined) {
      setClauses.push(`fssai = $${idx++}`);
      values.push(input.fssai?.trim() || null);
    }
    if (input.invoice_prefix !== undefined) {
      setClauses.push(`invoice_prefix = $${idx++}`);
      values.push(input.invoice_prefix.trim());
    }
    if (input.phone !== undefined) {
      setClauses.push(`phone = $${idx++}`);
      values.push(input.phone?.trim() || null);
    }
    if (input.email !== undefined) {
      setClauses.push(`email = $${idx++}`);
      values.push(input.email?.trim().toLowerCase() || null);
    }
    if (input.website !== undefined) {
      setClauses.push(`website = $${idx++}`);
      values.push(input.website?.trim() || null);
    }
    if (input.is_active !== undefined) {
      setClauses.push(`is_active = $${idx++}`);
      values.push(input.is_active);
    }

    const sql = `
      UPDATE public.company
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING *;
    `;

    const res = client ? await client.query<CompanyRow>(sql, values) : await dbQuery<CompanyRow>(sql, values);
    return res.rows[0] || null;
  }

  /**
   * Resolve company ID for use by other services.
   * Returns the active company's ID, or throws if none configured.
   */
  static async resolveCompanyId(client?: PoolClient): Promise<string> {
    const company = await CompanyRepository.getActiveCompany(client);
    if (!company) {
      throw new Error(
        "Company master is not configured. Create the company record in Admin → Company Settings before proceeding with financial operations."
      );
    }
    return company.id;
  }
}
