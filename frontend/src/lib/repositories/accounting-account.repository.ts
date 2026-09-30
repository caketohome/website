/**
 * CakeToHome ERP — Accounting Account Repository
 * Phase 4F: Data access and validation layer for public.accounting_account.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  AccountingAccountRow,
  AccountType,
  AccountSubtype,
} from "../types/accounting.types";

export interface AccountListFilters {
  type?: AccountType;
  subtype?: AccountSubtype;
  is_group?: boolean;
  is_active?: boolean;
  search?: string;
}

export class AccountingAccountRepository {
  /**
   * Find an accounting account by its primary key ID.
   */
  static async findById(
    id: string,
    client?: PoolClient
  ): Promise<AccountingAccountRow | null> {
    const sql = `
      SELECT * FROM public.accounting_account
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;
    const res = client
      ? await client.query<AccountingAccountRow>(sql, [id])
      : await dbQuery<AccountingAccountRow>(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Find an accounting account by its unique natural code (e.g., '1111', '2111').
   */
  static async findByCode(
    code: string,
    client?: PoolClient
  ): Promise<AccountingAccountRow | null> {
    const sql = `
      SELECT * FROM public.accounting_account
      WHERE code = $1 AND deleted_at IS NULL
      LIMIT 1;
    `;
    const res = client
      ? await client.query<AccountingAccountRow>(sql, [code])
      : await dbQuery<AccountingAccountRow>(sql, [code]);
    return res.rows[0] || null;
  }

  /**
   * List accounting accounts with optional server-side filters.
   */
  static async listAccounts(
    filters: AccountListFilters = {},
    client?: PoolClient
  ): Promise<AccountingAccountRow[]> {
    const conditions: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.type) {
      conditions.push(`type = $${idx++}`);
      params.push(filters.type);
    }
    if (filters.subtype) {
      conditions.push(`subtype = $${idx++}`);
      params.push(filters.subtype);
    }
    if (typeof filters.is_group === "boolean") {
      conditions.push(`is_group = $${idx++}`);
      params.push(filters.is_group);
    }
    if (typeof filters.is_active === "boolean") {
      conditions.push(`is_active = $${idx++}`);
      params.push(filters.is_active);
    }
    if (filters.search) {
      conditions.push(`(code ILIKE $${idx} OR name ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const sql = `
      SELECT * FROM public.accounting_account
      WHERE ${conditions.join(" AND ")}
      ORDER BY code ASC;
    `;

    const res = client
      ? await client.query<AccountingAccountRow>(sql, params)
      : await dbQuery<AccountingAccountRow>(sql, params);
    return res.rows;
  }

  /**
   * Validate that all account IDs in a transaction:
   * 1. Exist in the database.
   * 2. Are active (is_active = true and deleted_at IS NULL).
   * 3. Are NOT group accounts (is_group = false) — protecting the 24 summary groups.
   */
  static async validatePostingAccounts(
    accountIds: string[],
    client?: PoolClient
  ): Promise<Map<string, AccountingAccountRow>> {
    if (!accountIds || accountIds.length === 0) {
      return new Map();
    }

    const uniqueIds = Array.from(new Set(accountIds));
    const sql = `
      SELECT * FROM public.accounting_account
      WHERE id = ANY($1::text[]) AND deleted_at IS NULL;
    `;
    const res = client
      ? await client.query<AccountingAccountRow>(sql, [uniqueIds])
      : await dbQuery<AccountingAccountRow>(sql, [uniqueIds]);

    const accountMap = new Map<string, AccountingAccountRow>();
    for (const row of res.rows) {
      accountMap.set(row.id, row);
    }

    // Check for non-existent IDs
    for (const id of uniqueIds) {
      const acc = accountMap.get(id);
      if (!acc) {
        throw new Error(`Account validation error: Account ID '${id}' does not exist.`);
      }
      if (!acc.is_active) {
        throw new Error(
          `Account validation error: Account ${acc.code} (${acc.name}) is inactive and locked against postings.`
        );
      }
      if (acc.is_group) {
        throw new Error(
          `Account validation error: Account ${acc.code} (${acc.name}) is a summary group (is_group = true) and cannot receive direct journal postings.`
        );
      }
    }

    return accountMap;
  }
}
