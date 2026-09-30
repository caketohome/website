/**
 * CakeToHome ERP — Bank Statement Import Repository
 * Phase 4F Step 4.10 Substep 4.10.5-B: Bank Statement Import & Ingestion Service
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DB IS THE ONLY SOURCE OF TRUTH:
 *    - Direct parameterized SQL against public.bank_statement_import and public.bank_statement_line.
 * 2. IMMUTABLE SOURCE EVIDENCE:
 *    - Statement lines represent raw ingested bank evidence.
 *    - Ingestion does NOT create GL vouchers or journal entries.
 * 3. REPLAY & DEDUPLICATION DEFENSE:
 *    - Enforces file SHA-256 uniqueness per bank account.
 *    - Enforces composite line hash uniqueness per import.
 * 4. BATCH OPTIMIZATION & PESSIMISTIC LOCKS:
 *    - Efficient multi-row parameter construction for batch statement line insertions.
 *    - SELECT ... FOR UPDATE support for concurrency control.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  BankStatementImportRow,
  BankStatementLineRow,
  BankStatementImportStatus,
  BankStatementSourceFormat,
  BankStatementLineReconciliationStatus,
} from "../types/accounting.types";

export class BankStatementImportError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "BankStatementImportError";
    this.code = code;
  }
}

export interface CreateImportParams {
  id?: string;
  bank_account_id: string;
  company_id?: string;
  source_filename: string;
  source_format?: BankStatementSourceFormat;
  file_sha256: string;
  file_size_bytes?: number | null;
  statement_period_start: string;
  statement_period_end: string;
  total_lines_imported: number;
  total_debit_amount: number;
  total_credit_amount: number;
  status?: BankStatementImportStatus;
  imported_by: string;
  metadata?: Record<string, unknown>;
}

export interface CreateLineParams {
  id?: string;
  import_id: string;
  bank_account_id: string;
  line_number: number;
  transaction_date: string;
  value_date?: string | null;
  description: string;
  bank_reference?: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance?: number | null;
  line_hash: string;
  reconciliation_status?: BankStatementLineReconciliationStatus;
  metadata?: Record<string, unknown>;
}

export interface ListImportsFilter {
  bankAccountId?: string;
  companyId?: string;
  status?: BankStatementImportStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface ListLinesFilter {
  importId?: string;
  bankAccountId?: string;
  reconciliationStatus?: BankStatementLineReconciliationStatus;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  limit?: number;
  offset?: number;
}

export class BankStatementImportRepository {
  /**
   * Creates an immutable statement import container record.
   */
  static async createImport(
    params: CreateImportParams,
    client?: PoolClient
  ): Promise<BankStatementImportRow> {
    const id = params.id || `bsi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const companyId = params.company_id || "company_default";
    const sourceFormat = params.source_format || "CSV";
    const status = params.status || "IMPORTED";
    const metadata = params.metadata || {};

    const sql = `
      INSERT INTO public.bank_statement_import (
        id, bank_account_id, company_id, source_filename, source_format,
        file_sha256, file_size_bytes, statement_period_start, statement_period_end,
        total_lines_imported, total_debit_amount, total_credit_amount,
        status, imported_by, imported_at, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, NOW(), $15, NOW(), NOW()
      )
      RETURNING *;
    `;

    const values = [
      id,
      params.bank_account_id,
      companyId,
      params.source_filename.trim(),
      sourceFormat,
      params.file_sha256.trim(),
      params.file_size_bytes ?? null,
      params.statement_period_start,
      params.statement_period_end,
      params.total_lines_imported,
      params.total_debit_amount,
      params.total_credit_amount,
      status,
      params.imported_by.trim(),
      JSON.stringify(metadata),
    ];

    try {
      const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
      return res.rows[0];
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string; message?: string };
      if (pgErr.code === "23505" && pgErr.constraint === "uq_bsi_file_sha256") {
        throw new BankStatementImportError(
          "DUPLICATE_FILE_SHA256",
          `A statement file with identical checksum (SHA-256: ${params.file_sha256}) has already been imported for bank account ${params.bank_account_id}.`
        );
      }
      throw err;
    }
  }

  /**
   * Batch inserts parsed bank statement lines.
   */
  static async createLinesBatch(
    lines: CreateLineParams[],
    client?: PoolClient
  ): Promise<BankStatementLineRow[]> {
    if (!lines || lines.length === 0) {
      return [];
    }

    const valueClauses: string[] = [];
    const values: unknown[] = [];
    let pIdx = 1;

    for (const l of lines) {
      const id = l.id || `bsl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${l.line_number}`;
      const recStatus = l.reconciliation_status || "UNMATCHED";
      const metadata = l.metadata || {};

      valueClauses.push(
        `($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, NOW(), NOW())`
      );

      values.push(
        id,
        l.import_id,
        l.bank_account_id,
        l.line_number,
        l.transaction_date,
        l.value_date || null,
        l.description.trim(),
        l.bank_reference ? l.bank_reference.trim() : null,
        l.debit_amount,
        l.credit_amount,
        l.running_balance !== undefined && l.running_balance !== null ? l.running_balance : null,
        l.line_hash.trim(),
        recStatus,
        JSON.stringify(metadata)
      );
    }

    const sql = `
      INSERT INTO public.bank_statement_line (
        id, import_id, bank_account_id, line_number, transaction_date,
        value_date, description, bank_reference, debit_amount, credit_amount,
        running_balance, line_hash, reconciliation_status, metadata,
        created_at, updated_at
      ) VALUES ${valueClauses.join(",\n")}
      RETURNING *;
    `;

    try {
      const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
      return res.rows;
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string; message?: string };
      if (pgErr.code === "23505") {
        if (pgErr.constraint === "uq_bsl_import_line") {
          throw new BankStatementImportError(
            "DUPLICATE_IMPORT_LINE_NUMBER",
            "Duplicate line number detected within the same statement import."
          );
        }
        if (pgErr.constraint === "uq_bsl_line_hash") {
          throw new BankStatementImportError(
            "DUPLICATE_IMPORT_LINE_HASH",
            "Duplicate line transaction hash detected within the same statement import."
          );
        }
      }
      throw err;
    }
  }

  /**
   * Finds an import record by ID with optional row locking.
   */
  static async findById(
    id: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<BankStatementImportRow | null> {
    const sql = `
      SELECT * FROM public.bank_statement_import
      WHERE id = $1
      ${forUpdate ? "FOR UPDATE" : ""};
    `;
    const res = client ? await client.query(sql, [id]) : await dbQuery(sql, [id]);
    return res.rows[0] || null;
  }

  /**
   * Checks if an import exists by SHA256 checksum and bank account.
   */
  static async findBySha256(
    bankAccountId: string,
    fileSha256: string,
    client?: PoolClient
  ): Promise<BankStatementImportRow | null> {
    const sql = `
      SELECT * FROM public.bank_statement_import
      WHERE bank_account_id = $1 AND file_sha256 = $2;
    `;
    const res = client ? await client.query(sql, [bankAccountId, fileSha256]) : await dbQuery(sql, [bankAccountId, fileSha256]);
    return res.rows[0] || null;
  }

  /**
   * Lists statement imports with filtering and pagination.
   */
  static async listImports(
    filter: ListImportsFilter = {},
    client?: PoolClient
  ): Promise<{ imports: BankStatementImportRow[]; totalCount: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.bankAccountId) {
      conditions.push(`bank_account_id = $${idx++}`);
      values.push(filter.bankAccountId);
    }
    if (filter.companyId) {
      conditions.push(`company_id = $${idx++}`);
      values.push(filter.companyId);
    }
    if (filter.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter.startDate) {
      conditions.push(`statement_period_start >= $${idx++}`);
      values.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push(`statement_period_end <= $${idx++}`);
      values.push(filter.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*) FROM public.bank_statement_import ${whereClause};`;
    const countRes = client ? await client.query(countSql, values) : await dbQuery(countSql, values);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const limit = filter.limit && filter.limit > 0 ? filter.limit : 50;
    const offset = filter.offset && filter.offset >= 0 ? filter.offset : 0;

    const dataSql = `
      SELECT * FROM public.bank_statement_import
      ${whereClause}
      ORDER BY statement_period_start DESC, created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const dataValues = [...values, limit, offset];
    const dataRes = client ? await client.query(dataSql, dataValues) : await dbQuery(dataSql, dataValues);

    return {
      imports: dataRes.rows,
      totalCount,
    };
  }

  /**
   * Retrieves lines for a given import with optional filtering.
   */
  static async getLinesByImportId(
    importId: string,
    filter: {
      reconciliationStatus?: BankStatementLineReconciliationStatus;
      limit?: number;
      offset?: number;
    } = {},
    client?: PoolClient
  ): Promise<{ lines: BankStatementLineRow[]; totalCount: number }> {
    const conditions: string[] = [`import_id = $1`];
    const values: unknown[] = [importId];
    let idx = 2;

    if (filter.reconciliationStatus) {
      conditions.push(`reconciliation_status = $${idx++}`);
      values.push(filter.reconciliationStatus);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countSql = `SELECT COUNT(*) FROM public.bank_statement_line ${whereClause};`;
    const countRes = client ? await client.query(countSql, values) : await dbQuery(countSql, values);
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const limit = filter.limit && filter.limit > 0 ? filter.limit : 100;
    const offset = filter.offset && filter.offset >= 0 ? filter.offset : 0;

    const dataSql = `
      SELECT * FROM public.bank_statement_line
      ${whereClause}
      ORDER BY line_number ASC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const dataValues = [...values, limit, offset];
    const dataRes = client ? await client.query(dataSql, dataValues) : await dbQuery(dataSql, dataValues);

    return {
      lines: dataRes.rows,
      totalCount,
    };
  }

  /**
   * Retrieves a single statement line by ID.
   */
  static async getLineById(
    lineId: string,
    client?: PoolClient,
    forUpdate: boolean = false
  ): Promise<BankStatementLineRow | null> {
    const sql = `
      SELECT * FROM public.bank_statement_line
      WHERE id = $1
      ${forUpdate ? "FOR UPDATE" : ""};
    `;
    const res = client ? await client.query(sql, [lineId]) : await dbQuery(sql, [lineId]);
    return res.rows[0] || null;
  }

  /**
   * Updates an import record's status and metadata.
   */
  static async updateImportStatus(
    id: string,
    status: BankStatementImportStatus,
    metadata?: Record<string, unknown>,
    client?: PoolClient
  ): Promise<BankStatementImportRow> {
    let sql: string;
    let values: unknown[];

    if (metadata) {
      sql = `
        UPDATE public.bank_statement_import
        SET status = $2,
            metadata = public.bank_statement_import.metadata || $3::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      values = [id, status, JSON.stringify(metadata)];
    } else {
      sql = `
        UPDATE public.bank_statement_import
        SET status = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *;
      `;
      values = [id, status];
    }

    const res = client ? await client.query(sql, values) : await dbQuery(sql, values);
    if (res.rows.length === 0) {
      throw new BankStatementImportError("IMPORT_NOT_FOUND", `Bank statement import ${id} not found.`);
    }
    return res.rows[0];
  }

  /**
   * Updates a statement line's reconciliation status.
   */
  static async updateLineReconciliationStatus(
    lineId: string,
    status: BankStatementLineReconciliationStatus,
    client?: PoolClient
  ): Promise<BankStatementLineRow> {
    const sql = `
      UPDATE public.bank_statement_line
      SET reconciliation_status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const res = client ? await client.query(sql, [lineId, status]) : await dbQuery(sql, [lineId, status]);
    if (res.rows.length === 0) {
      throw new BankStatementImportError("LINE_NOT_FOUND", `Bank statement line ${lineId} not found.`);
    }
    return res.rows[0];
  }

  /**
   * Deletes lines by import ID (used during transactional rollback or test cleanup).
   */
  static async deleteLinesByImportId(importId: string, client?: PoolClient): Promise<number> {
    const sql = `DELETE FROM public.bank_statement_line WHERE import_id = $1;`;
    const res = client ? await client.query(sql, [importId]) : await dbQuery(sql, [importId]);
    return res.rowCount || 0;
  }

  /**
   * Deletes an import record by ID (used during transactional rollback or test cleanup).
   */
  static async deleteImport(id: string, client?: PoolClient): Promise<boolean> {
    const sql = `DELETE FROM public.bank_statement_import WHERE id = $1;`;
    const res = client ? await client.query(sql, [id]) : await dbQuery(sql, [id]);
    return (res.rowCount || 0) > 0;
  }
}
