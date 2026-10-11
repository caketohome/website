/**
 * CakeToHome ERP — Teller Repository
 * Phase C3: Teller & Session Domain Services + Repositories
 *
 * Direct parameterized SQL operations against public.teller.
 * Invariants:
 * 1. Database partial unique index uq_teller_active_user enforces at most one ACTIVE assignment per user globally.
 * 2. Uniqueness of (branch_id, code) enforced by uq_teller_branch_code.
 * 3. Supports SELECT ... FOR UPDATE for pessimistic concurrency control.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import {
  TellerRow,
  CreateTellerParams,
  UpdateTellerParams,
  TellerDomainError,
} from "../types/teller.types";

export class TellerRepository {
  /**
   * Finds a teller by primary key ID.
   */
  static async findById(
    id: string,
    client?: PoolClient,
    forUpdate = false
  ): Promise<TellerRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const lockClause = forUpdate ? " FOR UPDATE" : "";
    const sql = `
      SELECT 
        t.id, t.branch_id, t.user_id, t.name, t.code, t.status,
        t.created_by, t.updated_by, t.created_at, t.updated_at,
        b.name as branch_name, b.code as branch_code,
        u.email as user_email
      FROM public.teller t
      JOIN public.branch b ON b.id = t.branch_id
      JOIN public."user" u ON u.id = t.user_id
      WHERE t.id = $1
      ${lockClause};
    `;
    const res = await queryFn(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Finds the currently ACTIVE teller record for a user (at most 1 exists globally).
   */
  static async findActiveByUserId(
    userId: string,
    client?: PoolClient,
    forUpdate = false
  ): Promise<TellerRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const lockClause = forUpdate ? " FOR UPDATE" : "";
    const sql = `
      SELECT 
        t.id, t.branch_id, t.user_id, t.name, t.code, t.status,
        t.created_by, t.updated_by, t.created_at, t.updated_at,
        b.name as branch_name, b.code as branch_code,
        u.email as user_email
      FROM public.teller t
      JOIN public.branch b ON b.id = t.branch_id
      JOIN public."user" u ON u.id = t.user_id
      WHERE t.user_id = $1 AND t.status = 'ACTIVE'
      ${lockClause};
    `;
    const res = await queryFn(sql, [userId]);
    return res.rows[0] || null;
  }

  /**
   * Lists all historical and active teller records for a user.
   */
  static async findByUserId(
    userId: string,
    client?: PoolClient
  ): Promise<TellerRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        t.id, t.branch_id, t.user_id, t.name, t.code, t.status,
        t.created_by, t.updated_by, t.created_at, t.updated_at,
        b.name as branch_name, b.code as branch_code,
        u.email as user_email
      FROM public.teller t
      JOIN public.branch b ON b.id = t.branch_id
      JOIN public."user" u ON u.id = t.user_id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC;
    `;
    const res = await queryFn(sql, [userId]);
    return res.rows;
  }

  /**
   * Finds a teller by branch and teller code.
   */
  static async findByBranchAndCode(
    branchId: string,
    code: string,
    client?: PoolClient
  ): Promise<TellerRow | null> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        t.id, t.branch_id, t.user_id, t.name, t.code, t.status,
        t.created_by, t.updated_by, t.created_at, t.updated_at,
        b.name as branch_name, b.code as branch_code,
        u.email as user_email
      FROM public.teller t
      JOIN public.branch b ON b.id = t.branch_id
      JOIN public."user" u ON u.id = t.user_id
      WHERE t.branch_id = $1 AND t.code = $2;
    `;
    const res = await queryFn(sql, [branchId, code.trim().toUpperCase()]);
    return res.rows[0] || null;
  }

  /**
   * Lists all tellers assigned to a branch (ordered by active first, then code).
   */
  static async listByBranch(
    branchId: string,
    client?: PoolClient
  ): Promise<TellerRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const sql = `
      SELECT 
        t.id, t.branch_id, t.user_id, t.name, t.code, t.status,
        t.created_by, t.updated_by, t.created_at, t.updated_at,
        b.name as branch_name, b.code as branch_code,
        u.email as user_email
      FROM public.teller t
      JOIN public.branch b ON b.id = t.branch_id
      JOIN public."user" u ON u.id = t.user_id
      WHERE t.branch_id = $1
      ORDER BY CASE WHEN t.status = 'ACTIVE' THEN 0 ELSE 1 END, t.code ASC;
    `;
    const res = await queryFn(sql, [branchId]);
    return res.rows;
  }

  /**
   * Creates a new teller record.
   */
  static async create(
    params: CreateTellerParams,
    client?: PoolClient
  ): Promise<TellerRow> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const id = params.id || `tlr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const branchId = params.branch_id.trim();
    const userId = params.user_id.trim();
    const name = params.name.trim();
    const code = params.code.trim().toUpperCase();
    const status = params.status || "ACTIVE";
    const createdBy = params.created_by || "system";

    if (name.length < 2) {
      throw new TellerDomainError(
        "INVALID_AMOUNT",
        "Teller name must have at least 2 characters."
      );
    }
    if (code.length < 2) {
      throw new TellerDomainError(
        "INVALID_AMOUNT",
        "Teller code must have at least 2 characters."
      );
    }

    try {
      const sql = `
        INSERT INTO public.teller (
          id, branch_id, user_id, name, code, status,
          created_by, updated_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $7, NOW(), NOW()
        )
        RETURNING *;
      `;
      const res = await queryFn(sql, [
        id,
        branchId,
        userId,
        name,
        code,
        status,
        createdBy,
      ]);
      const created = res.rows[0];
      return (await this.findById(created.id, client)) || created;
    } catch (err: any) {
      if (err.constraint === "uq_teller_active_user") {
        throw new TellerDomainError(
          "TELLER_DUPLICATE_ACTIVE_USER",
          `User '${userId}' already has an active teller assignment across the company. A user may have at most one active teller.`
        );
      }
      if (err.constraint === "uq_teller_branch_code") {
        throw new TellerDomainError(
          "TELLER_CODE_COLLISION",
          `Teller code '${code}' already exists in branch '${branchId}'.`
        );
      }
      throw err;
    }
  }

  /**
   * Updates mutable fields (name, status) of an existing teller.
   */
  static async update(
    id: string,
    params: UpdateTellerParams,
    client?: PoolClient
  ): Promise<TellerRow> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const existing = await this.findById(id, client, true);
    if (!existing) {
      throw new TellerDomainError("TELLER_NOT_FOUND", `Teller '${id}' not found.`);
    }

    const name = params.name !== undefined ? params.name.trim() : existing.name;
    const status = params.status !== undefined ? params.status : existing.status;
    const updatedBy = params.updated_by || "system";

    try {
      const sql = `
        UPDATE public.teller
        SET name = $1, status = $2, updated_by = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING *;
      `;
      await queryFn(sql, [name, status, updatedBy, id]);
      return (await this.findById(id, client))!;
    } catch (err: any) {
      if (err.constraint === "uq_teller_active_user") {
        throw new TellerDomainError(
          "TELLER_DUPLICATE_ACTIVE_USER",
          `Cannot activate teller: user already has an active teller assignment elsewhere.`
        );
      }
      throw err;
    }
  }

  /**
   * Activates a historical teller record.
   */
  static async activate(
    id: string,
    updatedBy: string,
    client?: PoolClient
  ): Promise<TellerRow> {
    return this.update(id, { status: "ACTIVE", updated_by: updatedBy }, client);
  }

  /**
   * Deactivates an active teller record.
   */
  static async deactivate(
    id: string,
    updatedBy: string,
    client?: PoolClient
  ): Promise<TellerRow> {
    return this.update(id, { status: "INACTIVE", updated_by: updatedBy }, client);
  }

  /**
   * Lists tellers matching optional branch, status, and userId filters.
   */
  static async listTellers(
    filters: { branchId?: string; status?: string; userId?: string },
    client?: PoolClient
  ): Promise<TellerRow[]> {
    const queryFn = client ? client.query.bind(client) : dbQuery;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.branchId) {
      conditions.push(`t.branch_id = $${idx++}`);
      values.push(filters.branchId);
    }
    if (filters.status) {
      conditions.push(`t.status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.userId) {
      conditions.push(`t.user_id = $${idx++}`);
      values.push(filters.userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT 
        t.id, t.branch_id, t.user_id, t.name, t.code, t.status,
        t.created_by, t.updated_by, t.created_at, t.updated_at,
        b.name as branch_name, b.code as branch_code,
        u.email as user_email
      FROM public.teller t
      JOIN public.branch b ON b.id = t.branch_id
      JOIN public."user" u ON u.id = t.user_id
      ${whereClause}
      ORDER BY CASE WHEN t.status = 'ACTIVE' THEN 0 ELSE 1 END, t.created_at DESC;
    `;
    const res = await queryFn(sql, values);
    return res.rows;
  }
}
