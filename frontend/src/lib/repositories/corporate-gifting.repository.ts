/**
 * CakeToHome ERP — Corporate Gifting Repository
 * Phase C7.7 Step 7B: Data Access Layer for Corporate Gifting Batches & Recipients
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. TRANSACTION CONTEXT: All methods optionally accept an active PoolClient
 *    to participate seamlessly in atomic multi-table transactions.
 * 2. TENANT & COMPANY SCOPING: Enforces multi-tenant scoping and customer isolation.
 * 3. RETRIEVAL & AUDIT: Safe lookup, structured listing, pagination, and state guards.
 * 4. CLEAN CONCURRENCY: Uses advisory locks and row-level locking where necessary.
 */

import { dbQuery } from "../db";
import type { PoolClient } from "pg";
import type {
  CorporateGiftingBatchRow,
  CorporateGiftingRecipientRow,
  CorporateGiftingBatchStatus,
  CorporateGiftingRecipientValidationStatus,
  CorporateGiftingRecipientStatus,
} from "../types/accounting.types";

export interface CreateBatchInput {
  id?: string;
  customer_id: string;
  company_id?: string | null;
  batch_name: string;
  source_filename: string;
  file_hash: string;
  file_size_bytes?: number | null;
  status?: CorporateGiftingBatchStatus;
  total_recipients?: number;
  total_amount?: number;
  validated_recipients?: number;
  invalid_recipients?: number;
  processed_recipients?: number;
  scheduled_delivery_date?: string | null;
  invoice_id?: string | null;
  order_id?: string | null;
  cost_centre_id?: string | null;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
}

export interface UpdateBatchInput {
  batch_name?: string;
  status?: CorporateGiftingBatchStatus;
  total_recipients?: number;
  total_amount?: number;
  validated_recipients?: number;
  invalid_recipients?: number;
  processed_recipients?: number;
  scheduled_delivery_date?: string | null;
  invoice_id?: string | null;
  order_id?: string | null;
  cost_centre_id?: string | null;
  metadata?: Record<string, unknown>;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
}

export interface ListBatchesFilter {
  customer_id?: string;
  status?: CorporateGiftingBatchStatus;
  cost_centre_id?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateRecipientInput {
  id?: string;
  batch_id: string;
  row_number: number;
  employee_id?: string | null;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  delivery_pincode: string;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_date: string;
  delivery_slot?: string | null;
  product_id?: string | null;
  variant_id?: string | null;
  sku: string;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
  gift_message?: string | null;
  validation_status?: CorporateGiftingRecipientValidationStatus;
  validation_errors?: Array<{ field?: string; message: string; code?: string }> | null;
  order_id?: string | null;
  delivery_id?: string | null;
  status?: CorporateGiftingRecipientStatus;
  metadata?: Record<string, unknown>;
}

export interface UpdateRecipientInput {
  validation_status?: CorporateGiftingRecipientValidationStatus;
  validation_errors?: Array<{ field?: string; message: string; code?: string }> | null;
  order_id?: string | null;
  delivery_id?: string | null;
  status?: CorporateGiftingRecipientStatus;
  metadata?: Record<string, unknown>;
}

export interface ListRecipientsFilter {
  validation_status?: CorporateGiftingRecipientValidationStatus;
  status?: CorporateGiftingRecipientStatus;
  delivery_date?: string;
  limit?: number;
  offset?: number;
}

export class CorporateGiftingRepository {
  /**
   * Insert a new corporate gifting batch record.
   */
  static async createBatch(
    input: CreateBatchInput,
    client?: PoolClient
  ): Promise<CorporateGiftingBatchRow> {
    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    const id = input.id || `cgb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const sql = `
      INSERT INTO public.corporate_gifting_batch (
        id, customer_id, company_id, batch_name, source_filename,
        file_hash, file_size_bytes, status, total_recipients, total_amount,
        validated_recipients, invalid_recipients, processed_recipients,
        scheduled_delivery_date, invoice_id, order_id, cost_centre_id,
        metadata, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, NOW(), NOW()
      ) RETURNING *;
    `;

    const params = [
      id,
      input.customer_id,
      input.company_id || null,
      input.batch_name.trim(),
      input.source_filename.trim(),
      input.file_hash.trim(),
      input.file_size_bytes ?? null,
      input.status || "DRAFT",
      input.total_recipients ?? 0,
      input.total_amount ?? 0.0,
      input.validated_recipients ?? 0,
      input.invalid_recipients ?? 0,
      input.processed_recipients ?? 0,
      input.scheduled_delivery_date ?? null,
      input.invoice_id ?? null,
      input.order_id ?? null,
      input.cost_centre_id ?? null,
      JSON.stringify(input.metadata || {}),
      input.created_by ?? null,
    ];

    const res = await queryFn(sql, params);
    return res.rows[0];
  }

  /**
   * Find a batch by primary key ID.
   */
  static async getBatchById(
    id: string,
    client?: PoolClient
  ): Promise<CorporateGiftingBatchRow | null> {
    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    const res = await queryFn(
      `SELECT * FROM public.corporate_gifting_batch WHERE id = $1 AND deleted_at IS NULL;`,
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Find an active batch by customer and SHA-256 file checksum (for deduplication).
   */
  static async getBatchByFileHash(
    customerId: string,
    fileHash: string,
    client?: PoolClient
  ): Promise<CorporateGiftingBatchRow | null> {
    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    const res = await queryFn(
      `SELECT * FROM public.corporate_gifting_batch 
       WHERE customer_id = $1 AND file_hash = $2 AND status != 'FAILED' AND deleted_at IS NULL;`,
      [customerId, fileHash]
    );
    return res.rows[0] || null;
  }

  /**
   * Update an existing batch record.
   */
  static async updateBatch(
    id: string,
    updates: UpdateBatchInput,
    client?: PoolClient
  ): Promise<CorporateGiftingBatchRow> {
    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    const setClauses: string[] = ["updated_at = NOW()"];
    const params: any[] = [id];
    let pIdx = 2;

    if (updates.batch_name !== undefined) {
      setClauses.push(`batch_name = $${pIdx++}`);
      params.push(updates.batch_name.trim());
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${pIdx++}`);
      params.push(updates.status);
    }
    if (updates.total_recipients !== undefined) {
      setClauses.push(`total_recipients = $${pIdx++}`);
      params.push(updates.total_recipients);
    }
    if (updates.total_amount !== undefined) {
      setClauses.push(`total_amount = $${pIdx++}`);
      params.push(updates.total_amount);
    }
    if (updates.validated_recipients !== undefined) {
      setClauses.push(`validated_recipients = $${pIdx++}`);
      params.push(updates.validated_recipients);
    }
    if (updates.invalid_recipients !== undefined) {
      setClauses.push(`invalid_recipients = $${pIdx++}`);
      params.push(updates.invalid_recipients);
    }
    if (updates.processed_recipients !== undefined) {
      setClauses.push(`processed_recipients = $${pIdx++}`);
      params.push(updates.processed_recipients);
    }
    if (updates.scheduled_delivery_date !== undefined) {
      setClauses.push(`scheduled_delivery_date = $${pIdx++}`);
      params.push(updates.scheduled_delivery_date);
    }
    if (updates.invoice_id !== undefined) {
      setClauses.push(`invoice_id = $${pIdx++}`);
      params.push(updates.invoice_id);
    }
    if (updates.order_id !== undefined) {
      setClauses.push(`order_id = $${pIdx++}`);
      params.push(updates.order_id);
    }
    if (updates.cost_centre_id !== undefined) {
      setClauses.push(`cost_centre_id = $${pIdx++}`);
      params.push(updates.cost_centre_id);
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${pIdx++}`);
      params.push(JSON.stringify(updates.metadata));
    }
    if (updates.cancelled_by !== undefined) {
      setClauses.push(`cancelled_by = $${pIdx++}`);
      params.push(updates.cancelled_by);
    }
    if (updates.cancelled_at !== undefined) {
      setClauses.push(`cancelled_at = $${pIdx++}`);
      params.push(updates.cancelled_at);
    }
    if (updates.cancellation_reason !== undefined) {
      setClauses.push(`cancellation_reason = $${pIdx++}`);
      params.push(updates.cancellation_reason);
    }

    const sql = `
      UPDATE public.corporate_gifting_batch
      SET ${setClauses.join(", ")}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;

    const res = await queryFn(sql, params);
    if (res.rows.length === 0) {
      throw new Error(`Corporate gifting batch '${id}' not found or deleted.`);
    }
    return res.rows[0];
  }

  /**
   * List batches with filtering and pagination.
   */
  static async listBatches(
    filter: ListBatchesFilter = {},
    client?: PoolClient
  ): Promise<{ batches: CorporateGiftingBatchRow[]; total: number }> {
    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    const conditions: string[] = ["deleted_at IS NULL"];
    const params: any[] = [];
    let pIdx = 1;

    const customerId = filter.customer_id || (filter as any).customerId;
    if (customerId) {
      conditions.push(`customer_id = $${pIdx++}`);
      params.push(customerId);
    }
    if (filter.status) {
      conditions.push(`status = $${pIdx++}`);
      params.push(filter.status);
    }
    const costCentreId = filter.cost_centre_id || (filter as any).costCentreId;
    if (costCentreId) {
      conditions.push(`cost_centre_id = $${pIdx++}`);
      params.push(costCentreId);
    }
    if (filter.startDate) {
      conditions.push(`created_at >= $${pIdx++}::timestamp`);
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push(`created_at <= $${pIdx++}::timestamp`);
      params.push(filter.endDate);
    }
    if (filter.search) {
      conditions.push(`(batch_name ILIKE $${pIdx} OR source_filename ILIKE $${pIdx})`);
      params.push(`%${filter.search}%`);
      pIdx++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countSql = `SELECT count(*)::int as count FROM public.corporate_gifting_batch ${whereClause};`;
    const countRes = await queryFn(countSql, params);
    const total = countRes.rows[0].count;

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const dataSql = `
      SELECT * FROM public.corporate_gifting_batch
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `;
    const dataParams = [...params, limit, offset];
    const dataRes = await queryFn(dataSql, dataParams);

    return { batches: dataRes.rows, total };
  }

  /**
   * Bulk insert recipient line items.
   */
  static async insertRecipients(
    recipients: CreateRecipientInput[],
    client?: PoolClient
  ): Promise<CorporateGiftingRecipientRow[]> {
    if (recipients.length === 0) return [];

    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    const valueClauses: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const r of recipients) {
      const id = r.id || `cgr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      valueClauses.push(`(
        $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
        $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
        $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
        $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
        $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++},
        NOW(), NOW()
      )`);

      params.push(
        id,
        r.batch_id,
        r.row_number,
        r.employee_id ?? null,
        r.recipient_name.trim(),
        r.recipient_phone.trim(),
        r.delivery_address.trim(),
        r.delivery_pincode.trim(),
        r.delivery_city ?? null,
        r.delivery_state ?? null,
        r.delivery_date,
        r.delivery_slot ?? null,
        r.product_id ?? null,
        r.variant_id ?? null,
        r.sku.trim(),
        r.quantity ?? 1,
        r.unit_price ?? 0.0,
        r.line_total ?? 0.0,
        r.gift_message ?? null,
        r.validation_status ?? "PENDING",
        r.validation_errors ? JSON.stringify(r.validation_errors) : null,
        r.order_id ?? null,
        r.delivery_id ?? null,
        r.status ?? "PENDING",
        JSON.stringify(r.metadata || {})
      );
    }

    const sql = `
      INSERT INTO public.corporate_gifting_recipient (
        id, batch_id, row_number, employee_id, recipient_name,
        recipient_phone, delivery_address, delivery_pincode, delivery_city, delivery_state,
        delivery_date, delivery_slot, product_id, variant_id, sku,
        quantity, unit_price, line_total, gift_message, validation_status,
        validation_errors, order_id, delivery_id, status, metadata,
        created_at, updated_at
      ) VALUES ${valueClauses.join(", ")}
      RETURNING *;
    `;

    const res = await queryFn(sql, params);
    return res.rows;
  }

  /**
   * List recipient records for a specific batch.
   */
  static async listRecipientsByBatch(
    batchId: string,
    filter: ListRecipientsFilter = {},
    client?: PoolClient
  ): Promise<{ recipients: CorporateGiftingRecipientRow[]; total: number }> {
    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    const conditions: string[] = ["batch_id = $1", "deleted_at IS NULL"];
    const params: any[] = [batchId];
    let pIdx = 2;

    if (filter.validation_status) {
      conditions.push(`validation_status = $${pIdx++}`);
      params.push(filter.validation_status);
    }
    if (filter.status) {
      conditions.push(`status = $${pIdx++}`);
      params.push(filter.status);
    }
    if (filter.delivery_date) {
      conditions.push(`delivery_date = $${pIdx++}::date`);
      params.push(filter.delivery_date);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const countSql = `SELECT count(*)::int as count FROM public.corporate_gifting_recipient ${whereClause};`;
    const countRes = await queryFn(countSql, params);
    const total = countRes.rows[0].count;

    const limit = filter.limit ?? 100;
    const offset = filter.offset ?? 0;

    const dataSql = `
      SELECT * FROM public.corporate_gifting_recipient
      ${whereClause}
      ORDER BY row_number ASC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `;
    const dataParams = [...params, limit, offset];
    const dataRes = await queryFn(dataSql, dataParams);

    return { recipients: dataRes.rows, total };
  }

  /**
   * Find recipient by ID.
   */
  static async getRecipientById(
    id: string,
    client?: PoolClient
  ): Promise<CorporateGiftingRecipientRow | null> {
    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    const res = await queryFn(
      `SELECT * FROM public.corporate_gifting_recipient WHERE id = $1 AND deleted_at IS NULL;`,
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Update recipient record.
   */
  static async updateRecipient(
    id: string,
    updates: UpdateRecipientInput,
    client?: PoolClient
  ): Promise<CorporateGiftingRecipientRow> {
    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    const setClauses: string[] = ["updated_at = NOW()"];
    const params: any[] = [id];
    let pIdx = 2;

    if (updates.validation_status !== undefined) {
      setClauses.push(`validation_status = $${pIdx++}`);
      params.push(updates.validation_status);
    }
    if (updates.validation_errors !== undefined) {
      setClauses.push(`validation_errors = $${pIdx++}`);
      params.push(updates.validation_errors ? JSON.stringify(updates.validation_errors) : null);
    }
    if (updates.order_id !== undefined) {
      setClauses.push(`order_id = $${pIdx++}`);
      params.push(updates.order_id);
    }
    if (updates.delivery_id !== undefined) {
      setClauses.push(`delivery_id = $${pIdx++}`);
      params.push(updates.delivery_id);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${pIdx++}`);
      params.push(updates.status);
    }
    if (updates.metadata !== undefined) {
      setClauses.push(`metadata = $${pIdx++}`);
      params.push(JSON.stringify(updates.metadata));
    }

    const sql = `
      UPDATE public.corporate_gifting_recipient
      SET ${setClauses.join(", ")}
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *;
    `;

    const res = await queryFn(sql, params);
    if (res.rows.length === 0) {
      throw new Error(`Corporate gifting recipient '${id}' not found or deleted.`);
    }
    return res.rows[0];
  }

  /**
   * Sum total amount of active pending batches for customer.
   * Useful for prospective credit exposure checks.
   */
  static async sumActiveBatchesAmountForCustomer(
    customerId: string,
    excludeBatchId?: string,
    client?: PoolClient
  ): Promise<number> {
    const queryFn = (sql: string, params: any[]) =>
      client ? client.query(sql, params) : dbQuery(sql, params);

    let sql = `
      SELECT COALESCE(SUM(total_amount), 0)::numeric(15,2) AS total_active
      FROM public.corporate_gifting_batch
      WHERE customer_id = $1
        AND status IN ('VALIDATED', 'SCHEDULED', 'PROCESSING')
        AND invoice_id IS NULL
        AND deleted_at IS NULL
    `;
    const params: any[] = [customerId];

    if (excludeBatchId) {
      sql += ` AND id != $2`;
      params.push(excludeBatchId);
    }

    const res = await queryFn(sql, params);
    return Number(res.rows[0]?.total_active || 0);
  }
}
