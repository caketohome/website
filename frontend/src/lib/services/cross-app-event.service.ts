/**
 * CakeToHome ERP — Central Cross-Application Event & Transactional Outbox Service
 *
 * Implements:
 * 1. Transactional Outbox pattern (`public.outbox_events`) inside PostgreSQL transactions.
 * 2. Idempotent consumer processing (`public.outbox_consumer_receipt`) with unique `(event_id, consumer_name)`.
 * 3. Retry with exponential backoff (`retry_count`, `next_retry_at`, `max_retries = 5`).
 * 4. Dead-letter transition (`DEAD_LETTER`) and operator alerting (`public.system_monitoring_alert`).
 * 5. Stale worker lock recovery (`locked_at < NOW() - INTERVAL '5 minutes'`).
 * 6. Role-based and branch-scoped event visibility and PII/bank-account masking for SSE/WebSocket/API consumers.
 */

import type { PoolClient } from "pg";
import { dbQuery, dbTransaction } from "../db";

export type CanonicalCrossAppEventType =
  | "bank_account.created"
  | "bank_account.updated"
  | "bank_transaction.posted"
  | "bank_transfer.completed"
  | "journal_entry.posted"
  | "accounting_voucher.posted"
  | "bank_reconciliation.completed"
  | "order.created"
  | "order.confirmed"
  | "payment.captured"
  | "inventory.updated"
  | "kot.created"
  | "delivery.assigned"
  | "delivery.completed"
  | "invoice.issued";

export interface PublishOutboxEventParams {
  event_id?: string;
  event_type: CanonicalCrossAppEventType | string;
  aggregate_type: string;
  aggregate_id: string;
  correlation_id?: string;
  branch_id?: string | null;
  role_visibility?: string[];
  payload: Record<string, any>;
  max_retries?: number;
}

export interface OutboxProcessSummary {
  claimed: number;
  published: number;
  retried: number;
  dead_lettered: number;
  skipped_duplicate_consumer: number;
  events: Array<{
    event_id: string;
    event_type: string;
    status: string;
    retry_count: number;
  }>;
}

// Global version counter for in-process API cache invalidation
declare global {
  // eslint-disable-next-line no-var
  var __cth_cross_app_cache_version__: number | undefined;
  // eslint-disable-next-line no-var
  var __cth_cross_app_invalidated_at__: Record<string, number> | undefined;
}

function bumpCacheDomain(domain: string) {
  globalThis.__cth_cross_app_cache_version__ = (globalThis.__cth_cross_app_cache_version__ || 0) + 1;
  if (!globalThis.__cth_cross_app_invalidated_at__) {
    globalThis.__cth_cross_app_invalidated_at__ = {};
  }
  globalThis.__cth_cross_app_invalidated_at__[domain] = Date.now();
  globalThis.__cth_cross_app_invalidated_at__["ALL"] = Date.now();
}

export function sanitizeEventPayloadForRole(
  payload: Record<string, any>,
  role: string
): Record<string, any> {
  if (!payload || typeof payload !== "object") return {};
  const clone: Record<string, any> = { ...payload };

  // Never expose raw bank account_number in any cross-app event payload
  if (typeof clone.account_number === "string" && clone.account_number.length > 4) {
    clone.account_number_masked =
      clone.account_number_masked || `XXXX-XXXX-${clone.account_number.slice(-4)}`;
    delete clone.account_number;
  }

  const normalizedRole = (role || "customer").toLowerCase();
  if (normalizedRole === "customer") {
    // Strip internal accounting/GL/settlement/cost fields for customer sessions
    delete clone.gl_account_id;
    delete clone.voucher_id;
    delete clone.journal_entry_id;
    delete clone.gateway_fee;
    delete clone.gateway_tax;
    delete clone.mdr_fee;
    delete clone.bank_account_id;
    delete clone.utr_number;
    delete clone.cost_price;
  } else if (
    normalizedRole === "delivery" ||
    normalizedRole === "rider" ||
    normalizedRole === "delivery_partner"
  ) {
    delete clone.gl_account_id;
    delete clone.voucher_id;
    delete clone.journal_entry_id;
    delete clone.bank_account_id;
    delete clone.utr_number;
  }

  return clone;
}

export function defaultRoleVisibilityForEvent(eventType: string): string[] {
  if (
    eventType.startsWith("bank_") ||
    eventType.startsWith("journal_") ||
    eventType.startsWith("accounting_")
  ) {
    return ["SUPER_ADMIN", "ADMIN", "FINANCE", "ACCOUNTANT"];
  }
  if (eventType === "kot.created" || eventType === "inventory.updated") {
    return ["SUPER_ADMIN", "ADMIN", "FINANCE", "BRANCH_MANAGER", "MANAGER", "KITCHEN", "CASHIER"];
  }
  if (eventType.startsWith("delivery.")) {
    return [
      "SUPER_ADMIN",
      "ADMIN",
      "BRANCH_MANAGER",
      "MANAGER",
      "DELIVERY_PARTNER",
      "CUSTOMER",
    ];
  }
  // order.*, payment.captured, invoice.issued
  return [
    "SUPER_ADMIN",
    "ADMIN",
    "FINANCE",
    "ACCOUNTANT",
    "BRANCH_MANAGER",
    "MANAGER",
    "KITCHEN",
    "CASHIER",
    "CUSTOMER",
  ];
}

export class CrossAppEventService {
  /**
   * Publish an outbox event inside an existing PostgreSQL transaction.
   * Ensures atomicity between business state write, accounting ledger write, and event emission.
   */
  static async publishInTransaction(
    client: PoolClient,
    params: PublishOutboxEventParams
  ): Promise<string> {
    const eventId =
      params.event_id ||
      `evt_${params.event_type.replace(/[^a-z0-9]/gi, "_")}_${params.aggregate_id}_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;
    const correlationId = params.correlation_id || `corr_${params.aggregate_id}_${Date.now()}`;
    const roleVisibility =
      params.role_visibility || defaultRoleVisibilityForEvent(params.event_type);
    const sanitizedPayload = sanitizeEventPayloadForRole(params.payload || {}, "ADMIN");

    await client.query(
      `INSERT INTO public.outbox_events (
        event_id, event_type, aggregate_type, aggregate_id, correlation_id,
        branch_id, role_visibility, payload, status, retry_count, max_retries,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8::jsonb, 'PENDING', 0, $9,
        NOW()
      )
      ON CONFLICT (event_id) DO NOTHING`,
      [
        eventId,
        params.event_type,
        params.aggregate_type,
        params.aggregate_id,
        correlationId,
        params.branch_id || null,
        roleVisibility,
        JSON.stringify({
          ...sanitizedPayload,
          event_id: eventId,
          event_type: params.event_type,
          aggregate_type: params.aggregate_type,
          aggregate_id: params.aggregate_id,
          correlation_id: correlationId,
          branch_id: params.branch_id || null,
          emitted_at: new Date().toISOString(),
        }),
        params.max_retries ?? 5,
      ]
    );

    bumpCacheDomain(params.aggregate_type);
    return eventId;
  }

  /**
   * Standalone transactional publish helper when caller does not hold an open PoolClient.
   */
  static async publish(params: PublishOutboxEventParams): Promise<string> {
    return dbTransaction(async (client) => {
      const eventId = await this.publishInTransaction(client, params);
      return eventId;
    });
  }

  /**
   * Recover stale PROCESSING events whose worker crashed or timed out.
   */
  static async recoverStaleProcessingEvents(
    staleMinutes = 5
  ): Promise<{ recoveredCount: number; recoveredEventIds: string[] }> {
    const res = await dbQuery(
      `UPDATE public.outbox_events
       SET status = 'PENDING',
           locked_at = NULL,
           locked_by = NULL,
           last_error = COALESCE(last_error, '') || ' [Recovered from stale PROCESSING lock]'
       WHERE status = 'PROCESSING'
         AND locked_at < NOW() - ($1::text || ' minutes')::interval
       RETURNING event_id`,
      [String(staleMinutes)]
    );
    return {
      recoveredCount: res.rowCount || 0,
      recoveredEventIds: res.rows.map((r: any) => r.event_id),
    };
  }

  /**
   * Process pending outbox events with idempotent consumer receipts, retry backoff, and dead-letter handling.
   */
  static async processPendingOutboxEvents(options?: {
    limit?: number;
    workerId?: string;
    simulateFailureForEventId?: string;
    forceImmediateRetry?: boolean;
  }): Promise<OutboxProcessSummary> {
    const limit = options?.limit ?? 50;
    const workerId = options?.workerId || `worker_${process.pid}`;
    const summary: OutboxProcessSummary = {
      claimed: 0,
      published: 0,
      retried: 0,
      dead_lettered: 0,
      skipped_duplicate_consumer: 0,
      events: [],
    };

    // First recover any stale locks
    await this.recoverStaleProcessingEvents(5);

    const claimedRows = await dbTransaction(async (client) => {
      const timeClause = options?.forceImmediateRetry
        ? `TRUE`
        : `(next_retry_at IS NULL OR next_retry_at <= NOW())`;
      const claimRes = await client.query(
        `SELECT id, event_id, event_type, aggregate_type, aggregate_id, correlation_id,
                branch_id, role_visibility, payload, status, retry_count, max_retries
         FROM public.outbox_events
         WHERE status = 'PENDING'
           AND ${timeClause}
         ORDER BY id ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [limit]
      );

      if (claimRes.rows.length > 0) {
        const ids = claimRes.rows.map((r: any) => r.id);
        await client.query(
          `UPDATE public.outbox_events
           SET status = 'PROCESSING',
               locked_at = NOW(),
               locked_by = $2
           WHERE id = ANY($1::bigint[])`,
          [ids, workerId]
        );
      }

      return claimRes.rows;
    });

    summary.claimed = claimedRows.length;

    const consumers = ["api_cache_invalidator", "sse_realtime_dispatcher", "cross_app_audit_projector"];

    for (const row of claimedRows) {
      try {
        if (
          options?.simulateFailureForEventId &&
          row.event_id === options.simulateFailureForEventId
        ) {
          throw new Error(
            `Simulated downstream consumer failure for event ${row.event_id}`
          );
        }

        await dbTransaction(async (client) => {
          for (const consumerName of consumers) {
            const receiptRes = await client.query(
              `INSERT INTO public.outbox_consumer_receipt (
                event_id, consumer_name, correlation_id, result_metadata, processed_at
              ) VALUES ($1, $2, $3, $4::jsonb, NOW())
              ON CONFLICT (event_id, consumer_name) DO NOTHING
              RETURNING id`,
              [
                row.event_id,
                consumerName,
                row.correlation_id,
                JSON.stringify({
                  event_type: row.event_type,
                  aggregate_id: row.aggregate_id,
                  worker_id: workerId,
                }),
              ]
            );

            if (receiptRes.rowCount === 0) {
              summary.skipped_duplicate_consumer += 1;
            } else {
              bumpCacheDomain(row.aggregate_type);
            }
          }

          await client.query(
            `UPDATE public.outbox_events
             SET status = 'PUBLISHED',
                 processed_at = NOW(),
                 locked_at = NULL,
                 locked_by = NULL
             WHERE id = $1`,
            [row.id]
          );
        });

        summary.published += 1;
        summary.events.push({
          event_id: row.event_id,
          event_type: row.event_type,
          status: "PUBLISHED",
          retry_count: row.retry_count,
        });
      } catch (err: any) {
        const nextRetryCount = Number(row.retry_count || 0) + 1;
        const maxRetries = Number(row.max_retries || 5);
        const errorMsg = err?.message || "Unknown outbox processing error";

        if (nextRetryCount >= maxRetries) {
          await dbTransaction(async (client) => {
            await client.query(
              `UPDATE public.outbox_events
               SET status = 'DEAD_LETTER',
                   retry_count = $2,
                   last_error = $3,
                   dead_lettered_at = NOW(),
                   locked_at = NULL,
                   locked_by = NULL
               WHERE id = $1`,
              [row.id, nextRetryCount, errorMsg]
            );

            await client.query(
              `INSERT INTO public.system_monitoring_alert (
                id, alert_type, severity, source_module, reference_id, message, metadata, status, created_at
              ) VALUES (
                $1, 'OUTBOX_DEAD_LETTER', 'CRITICAL', 'CROSS_APP_EVENT_BUS', $2, $3, $4::jsonb, 'OPEN', NOW()
              )
              ON CONFLICT (id) DO UPDATE
              SET message = EXCLUDED.message,
                  metadata = EXCLUDED.metadata`,
              [
                `alert_dlq_${row.event_id}`,
                row.event_id,
                `Outbox event ${row.event_id} (${row.event_type}) exhausted ${maxRetries} retries: ${errorMsg}`,
                JSON.stringify({
                  event_id: row.event_id,
                  event_type: row.event_type,
                  aggregate_type: row.aggregate_type,
                  aggregate_id: row.aggregate_id,
                  correlation_id: row.correlation_id,
                  retry_count: nextRetryCount,
                  last_error: errorMsg,
                }),
              ]
            );
          });

          summary.dead_lettered += 1;
          summary.events.push({
            event_id: row.event_id,
            event_type: row.event_type,
            status: "DEAD_LETTER",
            retry_count: nextRetryCount,
          });
        } else {
          const backoffSeconds = Math.min(300, Math.pow(2, nextRetryCount));
          await dbQuery(
            `UPDATE public.outbox_events
             SET status = 'PENDING',
                 retry_count = $2,
                 last_error = $3,
                 next_retry_at = NOW() + ($4::text || ' seconds')::interval,
                 locked_at = NULL,
                 locked_by = NULL
             WHERE id = $1`,
            [row.id, nextRetryCount, errorMsg, String(backoffSeconds)]
          );

          summary.retried += 1;
          summary.events.push({
            event_id: row.event_id,
            event_type: row.event_type,
            status: "PENDING_RETRY",
            retry_count: nextRetryCount,
          });
        }
      }
    }

    return summary;
  }

  /**
   * Replay a DEAD_LETTER event cleanly after root cause remediation.
   */
  static async replayDeadLetterEvent(eventId: string): Promise<OutboxProcessSummary> {
    await dbTransaction(async (client) => {
      await client.query(
        `UPDATE public.outbox_events
         SET status = 'PENDING',
             retry_count = 0,
             next_retry_at = NULL,
             dead_lettered_at = NULL,
             last_error = COALESCE(last_error, '') || ' [Replayed by operator]'
         WHERE event_id = $1`,
        [eventId]
      );

      await client.query(
        `UPDATE public.system_monitoring_alert
         SET status = 'RESOLVED',
             resolved_at = NOW()
         WHERE reference_id = $1 AND status = 'OPEN'`,
        [eventId]
      );
    });

    return this.processPendingOutboxEvents({ forceImmediateRetry: true });
  }

  /**
   * Query role-scoped and branch-scoped events for SSE / WebSocket / client polling synchronization.
   * Enforces strict tenant isolation (Section 11):
   * - Customers only receive events for their own customer_id / order_id and never see internal accounting or bank events.
   * - Branch staff only receive events for their branch_id (or global events without a branch restriction) and never see unmasked bank numbers.
   * - Delivery partners only receive delivery/order dispatch events assigned to their branch/rider context.
   * - Admin / Finance receive all authorized events with raw bank account numbers masked.
   */
  static async getRecentEventsForSession(options: {
    role?: string;
    branchId?: string | null;
    customerId?: string | null;
    orderId?: string | null;
    sinceId?: number;
    limit?: number;
  }): Promise<Array<Record<string, any>>> {
    const role = (options.role || "ADMIN").toUpperCase();
    const sinceId = Number(options.sinceId || 0);
    const limit = Math.min(100, Math.max(1, Number(options.limit || 30)));

    const res = await dbQuery(
      `SELECT id, event_id, event_type, aggregate_type, aggregate_id, correlation_id,
              branch_id, role_visibility, payload, status, created_at, processed_at
       FROM public.outbox_events
       WHERE id > $1
       ORDER BY id DESC
       LIMIT $2`,
      [sinceId, limit * 2]
    );

    const filtered: Array<Record<string, any>> = [];

    for (const row of res.rows) {
      const visibility: string[] = Array.isArray(row.role_visibility)
        ? row.role_visibility.map((r: string) => r.toUpperCase())
        : [];

      // 1. Role visibility check
      if (role === "CUSTOMER") {
        if (!visibility.includes("CUSTOMER")) continue;
        // Customer must only see events matching their customerId or orderId
        const payloadCustomerId = row.payload?.customer_id;
        const payloadOrderId = row.payload?.order_id || row.aggregate_id;
        const matchesCustomer =
          (options.customerId && payloadCustomerId === options.customerId) ||
          (options.orderId && payloadOrderId === options.orderId);
        if (!matchesCustomer) continue;
      } else if (
        role === "BRANCH_MANAGER" ||
        role === "MANAGER" ||
        role === "KITCHEN" ||
        role === "CASHIER"
      ) {
        if (
          !visibility.includes("BRANCH_MANAGER") &&
          !visibility.includes("MANAGER") &&
          !visibility.includes("KITCHEN") &&
          !visibility.includes("CASHIER")
        ) {
          continue;
        }
        // Branch isolation: if session specifies a branchId and event specifies a different branchId, filter it out
        if (
          options.branchId &&
          row.branch_id &&
          row.branch_id !== "ALL" &&
          row.branch_id !== options.branchId
        ) {
          continue;
        }
      } else if (role === "DELIVERY_PARTNER" || role === "DELIVERY" || role === "RIDER") {
        if (!visibility.includes("DELIVERY_PARTNER")) continue;
        if (
          options.branchId &&
          row.branch_id &&
          row.branch_id !== "ALL" &&
          row.branch_id !== options.branchId
        ) {
          continue;
        }
      }

      filtered.push({
        id: Number(row.id),
        event_id: row.event_id,
        event_type: row.event_type,
        aggregate_type: row.aggregate_type,
        aggregate_id: row.aggregate_id,
        correlation_id: row.correlation_id,
        branch_id: row.branch_id,
        status: row.status,
        created_at: row.created_at,
        processed_at: row.processed_at,
        payload: sanitizeEventPayloadForRole(row.payload || {}, role),
      });

      if (filtered.length >= limit) break;
    }

    return filtered;
  }
}

