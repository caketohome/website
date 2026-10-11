/**
 * CakeToHome ERP — GST Registration Repository
 * Phase A: Database-backed GST registration master.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH — No fake GSTIN fallback.
 * 2. GSTIN format validated server-side: 2-digit state + 10-char PAN + 1 entity + 1 check + 1 default.
 * 3. State code in GSTIN must match the state_code column (DB constraint enforced).
 * 4. One company may have multiple GST registrations (multi-state).
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  GstRegistrationRow,
  GstRegistrationCreateInput,
  GstRegistrationUpdateInput,
} from "../types/company.types";

export class GstRegistrationRepository {
  /**
   * List all GST registrations for a company, optionally filtered by active status.
   */
  static async listByCompany(
    companyId: string,
    activeOnly: boolean = false,
    client?: PoolClient,
  ): Promise<GstRegistrationRow[]> {
    const sql = `
      SELECT * FROM public.gst_registration
      WHERE company_id = $1
      ${activeOnly ? "AND is_active = true" : ""}
      ORDER BY state_code, created_at;
    `;
    const res = client
      ? await client.query<GstRegistrationRow>(sql, [companyId])
      : await dbQuery<GstRegistrationRow>(sql, [companyId]);
    return res.rows;
  }

  /**
   * Find a specific GST registration by ID.
   */
  static async findById(id: string, client?: PoolClient): Promise<GstRegistrationRow | null> {
    const sql = `SELECT * FROM public.gst_registration WHERE id = $1;`;
    const res = client
      ? await client.query<GstRegistrationRow>(sql, [id])
      : await dbQuery<GstRegistrationRow>(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Find active GST registration by state code for a company.
   * Used to resolve the correct GSTIN for invoicing based on Place of Supply.
   */
  static async findByStateCode(
    companyId: string,
    stateCode: string,
    client?: PoolClient,
  ): Promise<GstRegistrationRow | null> {
    const sql = `
      SELECT * FROM public.gst_registration
      WHERE company_id = $1 AND state_code = $2 AND is_active = true
      LIMIT 1;
    `;
    const res = client
      ? await client.query<GstRegistrationRow>(sql, [companyId, stateCode])
      : await dbQuery<GstRegistrationRow>(sql, [companyId, stateCode]);
    return res.rows[0] || null;
  }

  /**
   * Find active GST registration by GSTIN.
   */
  static async findByGstin(gstin: string, client?: PoolClient): Promise<GstRegistrationRow | null> {
    const sql = `SELECT * FROM public.gst_registration WHERE gstin = $1 LIMIT 1;`;
    const res = client
      ? await client.query<GstRegistrationRow>(sql, [gstin.toUpperCase()])
      : await dbQuery<GstRegistrationRow>(sql, [gstin.toUpperCase()]);
    return res.rows[0] || null;
  }

  /**
   * Create a new GST registration.
   */
  static async create(
    input: GstRegistrationCreateInput,
    createdBy: string,
    client?: PoolClient,
  ): Promise<GstRegistrationRow> {
    const id = `gst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const sql = `
      INSERT INTO public.gst_registration (
        id, company_id, gstin, state_code, registration_type,
        legal_name, is_active, effective_from, metadata,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, true, $7, '{}',
        $8, NOW(), NOW()
      )
      RETURNING *;
    `;
    const values = [
      id,
      input.company_id,
      input.gstin.trim().toUpperCase(),
      input.state_code.trim(),
      input.registration_type || "REGULAR",
      input.legal_name?.trim() || null,
      input.effective_from || null,
      createdBy,
    ];

    const res = client
      ? await client.query<GstRegistrationRow>(sql, values)
      : await dbQuery<GstRegistrationRow>(sql, values);
    return res.rows[0];
  }

  /**
   * Update a GST registration.
   */
  static async update(
    id: string,
    input: GstRegistrationUpdateInput,
    client?: PoolClient,
  ): Promise<GstRegistrationRow | null> {
    const setClauses: string[] = ["updated_at = NOW()"];
    const values: unknown[] = [id];
    let idx = 2;

    if (input.registration_type !== undefined) {
      setClauses.push(`registration_type = $${idx++}`);
      values.push(input.registration_type);
    }
    if (input.legal_name !== undefined) {
      setClauses.push(`legal_name = $${idx++}`);
      values.push(input.legal_name?.trim() || null);
    }
    if (input.is_active !== undefined) {
      setClauses.push(`is_active = $${idx++}`);
      values.push(input.is_active);
    }
    if (input.effective_from !== undefined) {
      setClauses.push(`effective_from = $${idx++}`);
      values.push(input.effective_from || null);
    }
    if (input.effective_to !== undefined) {
      setClauses.push(`effective_to = $${idx++}`);
      values.push(input.effective_to || null);
    }

    const sql = `
      UPDATE public.gst_registration
      SET ${setClauses.join(", ")}
      WHERE id = $1
      RETURNING *;
    `;

    const res = client
      ? await client.query<GstRegistrationRow>(sql, values)
      : await dbQuery<GstRegistrationRow>(sql, values);
    return res.rows[0] || null;
  }
}
