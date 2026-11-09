/**
 * CakeToHome ERP — Invoice Queue Service
 *
 * Implements a durable, PostgreSQL-backed asynchronous retry queue for statutory
 * invoice generation adhering to the background-jobs-and-queues runbook.
 *
 * Core Architectural Invariants:
 * 1. Transactional Atomic Lock: Uses `FOR UPDATE SKIP LOCKED` to prevent concurrent worker collisions.
 * 2. Lease-Expiry Crash Recovery: Unfinished jobs locked > 5 minutes automatically reclaimed.
 * 3. Exponential Backoff with Jitter: Failed attempts retry at 5s, 30s, 2m, 10m, 30m.
 * 4. Dead-Letter Queue (DLQ): Jobs exceeding max_attempts (default 5) transition to DEAD_LETTER.
 * 5. Idempotent Enqueue: Re-enqueuing an existing pending or failed order updates without duplicate rows.
 * 6. Audit Lifecycle Bridge: On completion, transitions invoice_allocation_log to COMMITTED.
 */

import { dbQuery } from "../db";

export type InvoiceQueueStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "DEAD_LETTER";

export interface InvoiceQueueJob {
  id: string;
  order_id: string;
  entity_id: string;
  prefix: string;
  status: InvoiceQueueStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_run_at: string;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueInvoiceJobOptions {
  orderId: string;
  entityId?: string;
  prefix?: string;
  maxAttempts?: number;
}

export class InvoiceQueueService {
  /**
   * Enqueue an order for statutory invoice generation.
   * Idempotent: If already pending or failed, resets next_run_at to NOW().
   */
  public static async enqueue(options: EnqueueInvoiceJobOptions): Promise<InvoiceQueueJob> {
    const { orderId, entityId = "CAKETOHOME_PARENT", prefix = "CTH", maxAttempts = 5 } = options;

    // Pre-enqueue validation guard: Reject test fixtures and exempt orders
    const orderCheck = await dbQuery(
      `SELECT id, status::text as status, metadata FROM public."order" WHERE id = $1 AND deleted_at IS NULL`,
      [orderId]
    );
    if (orderCheck.rows.length === 0) {
      throw new Error(`Cannot enqueue invoice job: Order ${orderId} does not exist in database.`);
    }
    const orderData = orderCheck.rows[0];
    const meta = orderData.metadata || {};
    const isExempt = meta.invoicing_exempt === true ||
      meta.classification === "TEST" ||
      String(orderId).toLowerCase().includes("test_cod_");
    if (isExempt) {
      throw new Error(`Cannot enqueue invoice job: Order ${orderId} is classified as an exempt test fixture.`);
    }

    const sql = `
      INSERT INTO public.invoice_generation_queue (
        order_id, entity_id, prefix, status, attempts, max_attempts, next_run_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'PENDING', 0, $4, NOW(), NOW(), NOW()
      )
      ON CONFLICT (order_id) DO UPDATE SET
        status = CASE 
          WHEN public.invoice_generation_queue.status IN ('COMPLETED') THEN public.invoice_generation_queue.status
          ELSE 'PENDING'
        END,
        next_run_at = CASE
          WHEN public.invoice_generation_queue.status IN ('COMPLETED') THEN public.invoice_generation_queue.next_run_at
          ELSE NOW()
        END,
        entity_id = EXCLUDED.entity_id,
        prefix = EXCLUDED.prefix,
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await dbQuery(sql, [orderId, entityId, prefix, maxAttempts]);
    return result.rows[0];
  }

  /**
   * Acquire a batch of jobs for processing.
   * Utilizes FOR UPDATE SKIP LOCKED and reclaims expired leases (locked > leaseMinutes).
   */
  public static async acquireBatch(
    workerId: string,
    batchSize: number = 10,
    leaseMinutes: number = 5
  ): Promise<InvoiceQueueJob[]> {
    const sql = `
      WITH eligible_jobs AS (
        SELECT id
        FROM public.invoice_generation_queue
        WHERE (
          (status = 'PENDING' AND next_run_at <= NOW())
          OR (status = 'PROCESSING' AND locked_at < NOW() - ($3 || ' minutes')::interval)
        )
        ORDER BY next_run_at ASC, created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.invoice_generation_queue q
      SET status = 'PROCESSING',
          locked_at = NOW(),
          locked_by = $2,
          attempts = attempts + 1,
          updated_at = NOW()
      FROM eligible_jobs ej
      WHERE q.id = ej.id
      RETURNING q.*;
    `;

    const result = await dbQuery(sql, [batchSize, workerId, leaseMinutes]);
    return result.rows;
  }

  /**
   * Transition job to COMPLETED and commit invoice allocation log.
   */
  public static async completeJob(
    jobId: string,
    orderId: string,
    invoiceId?: string
  ): Promise<void> {
    const sql = `
      UPDATE public.invoice_generation_queue
      SET status = 'COMPLETED',
          locked_at = NULL,
          locked_by = NULL,
          last_error = NULL,
          updated_at = NOW()
      WHERE id = $1;
    `;
    await dbQuery(sql, [jobId]);

    // Complete audit lifecycle transition ALLOCATED -> COMMITTED
    if (orderId) {
      try {
        await dbQuery(
          `SELECT public.commit_invoice_allocation($1, $2)`,
          [orderId, invoiceId || null]
        );
      } catch (err: any) {
        console.warn(`[InvoiceQueueService] commit_invoice_allocation warning for order ${orderId}:`, err?.message);
      }
    }
  }

  /**
   * Record a job failure with exponential backoff or dead-letter transition.
   */
  public static async failJob(
    jobId: string,
    error: Error | string,
    currentAttempts: number,
    maxAttempts: number = 5
  ): Promise<void> {
    const errorMessage = typeof error === "string" ? error : error.message || String(error);
    const isDeadLetter = currentAttempts >= maxAttempts;

    // Exponential backoff intervals: attempt 1: 5s, attempt 2: 30s, attempt 3: 120s, attempt 4: 600s, attempt 5: 1800s
    const backoffSeconds = [5, 30, 120, 600, 1800];
    const delaySec = backoffSeconds[Math.min(currentAttempts - 1, backoffSeconds.length - 1)] || 30;

    const sql = `
      UPDATE public.invoice_generation_queue
      SET status = CASE WHEN $2::boolean THEN 'DEAD_LETTER' ELSE 'PENDING' END,
          last_error = $3,
          next_run_at = CASE 
            WHEN $2::boolean THEN NOW() 
            ELSE NOW() + ($4 || ' seconds')::interval 
          END,
          locked_at = NULL,
          locked_by = NULL,
          updated_at = NOW()
      WHERE id = $1;
    `;

    await dbQuery(sql, [jobId, isDeadLetter, errorMessage, delaySec]);
  }

  /**
   * Requeue jobs from DEAD_LETTER status back to PENDING.
   */
  public static async requeueDeadLetter(jobId?: string): Promise<number> {
    let sql: string;
    let params: any[];

    if (jobId) {
      sql = `
        UPDATE public.invoice_generation_queue
        SET status = 'PENDING',
            attempts = 0,
            last_error = NULL,
            next_run_at = NOW(),
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
        WHERE id = $1 AND status = 'DEAD_LETTER';
      `;
      params = [jobId];
    } else {
      sql = `
        UPDATE public.invoice_generation_queue
        SET status = 'PENDING',
            attempts = 0,
            last_error = NULL,
            next_run_at = NOW(),
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
        WHERE status = 'DEAD_LETTER';
      `;
      params = [];
    }

    const res = await dbQuery(sql, params);
    return res.rowCount || 0;
  }

  /**
   * Get queue depth metrics by status.
   */
  public static async getQueueStatus(): Promise<Record<InvoiceQueueStatus, number>> {
    const sql = `
      SELECT status, COUNT(*)::int as count
      FROM public.invoice_generation_queue
      GROUP BY status;
    `;
    const res = await dbQuery(sql);
    const counts: Record<InvoiceQueueStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      DEAD_LETTER: 0,
    };
    for (const r of res.rows) {
      if (r.status in counts) {
        counts[r.status as InvoiceQueueStatus] = r.count;
      }
    }
    return counts;
  }

  /**
   * Process a single batch of queued jobs end-to-end.
   */
  public static async processBatch(
    workerId: string = `worker-${Date.now()}`,
    engine?: any
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    const jobs = await this.acquireBatch(workerId, 10, 5);
    let succeeded = 0;
    let failed = 0;

    for (const job of jobs) {
      try {
        // Fetch order from database
        const orderRes = await dbQuery(
          `SELECT id, status::text as status, metadata, created_at, customer_id
           FROM public."order"
           WHERE id = $1 AND deleted_at IS NULL`,
          [job.order_id]
        );

        if (orderRes.rows.length === 0) {
          throw new Error(`Order ${job.order_id} not found in database.`);
        }

        const rawOrder = orderRes.rows[0];
        const meta = rawOrder.metadata || {};
        const orderObj = {
          id: rawOrder.id,
          status: rawOrder.status,
          metadata: meta,
          order_number: meta.order_number || rawOrder.id,
          subtotal: meta.subtotal || 0,
          total: meta.grand_total || meta.total_amount || 0,
          delivered_at: meta.delivered_at || rawOrder.created_at,
          ...meta,
        };

        const { DeliveryInvoicingService } = await import("./delivery-invoicing.service");
        const invRes = await DeliveryInvoicingService.generateInvoiceOnDelivery(engine, orderObj);

        if (invRes.success) {
          await this.completeJob(job.id, job.order_id, invRes.invoice_id);
          succeeded++;
        } else {
          await this.failJob(job.id, invRes.error || "Invoicing returned success: false", job.attempts, job.max_attempts);
          failed++;
        }
      } catch (err: any) {
        await this.failJob(job.id, err, job.attempts, job.max_attempts);
        failed++;
      }
    }

    return { processed: jobs.length, succeeded, failed };
  }
}
