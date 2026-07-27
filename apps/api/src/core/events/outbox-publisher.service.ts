/**
 * CakeToHome Core API - Transactional Outbox Publisher Domain Service (Feature 7)
 * Manages Outbox Event Record Creation, Status Lifecycle, Poller Relay Batches,
 * Exponential Backoff Retries, Dead Letter Queue (DLQ), and Stalled Job Recovery.
 */

export type OutboxStatus =
  | "PENDING"
  | "PROCESSING"
  | "PUBLISHED"
  | "ACKNOWLEDGED"
  | "FAILED"
  | "RETRYING"
  | "DEAD_LETTER";

export interface OutboxRecord {
  id: string;
  eventType: string;
  aggregateId: string;
  payload: any;
  status: OutboxStatus;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  nextRetryAt?: string;
  workerId?: string;
  processingStartedAt?: string;
  createdAt: string;
  publishedAt?: string;
}

export class OutboxPublisherService {
  private static outboxStore: Map<string, OutboxRecord> = new Map();
  private static publishedEvents: OutboxRecord[] = [];

  static createOutboxRecord(eventData: { eventType: string; aggregateId: string; payload: any }): OutboxRecord {
    const recordId = `evt_outbox_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const record: OutboxRecord = {
      id: recordId,
      eventType: eventData.eventType,
      aggregateId: eventData.aggregateId,
      payload: eventData.payload,
      status: "PENDING",
      retryCount: 0,
      maxRetries: 5,
      createdAt: new Date().toISOString(),
    };

    OutboxPublisherService.outboxStore.set(recordId, record);
    return record;
  }

  static async pollAndProcessBatch(workerId: string = "worker_node_1", batchSize: number = 10): Promise<OutboxRecord[]> {
    const now = new Date().toISOString();
    const records = Array.from(OutboxPublisherService.outboxStore.values())
      .filter(
        (r) =>
          r.status === "PENDING" ||
          (r.status === "RETRYING" && r.nextRetryAt && r.nextRetryAt <= now)
      )
      .slice(0, batchSize);

    for (const record of records) {
      record.status = "PROCESSING";
      record.workerId = workerId;
      record.processingStartedAt = new Date().toISOString();

      try {
        record.status = "PUBLISHED";
        record.publishedAt = new Date().toISOString();
        OutboxPublisherService.publishedEvents.push({ ...record });
      } catch (err: any) {
        record.retryCount += 1;
        if (record.retryCount >= record.maxRetries) {
          record.status = "DEAD_LETTER";
          record.lastError = err.message || "Max retries exceeded";
        } else {
          record.status = "RETRYING";
          const delaySec = Math.pow(2, record.retryCount) * 5;
          record.nextRetryAt = new Date(Date.now() + delaySec * 1000).toISOString();
        }
      }
    }

    return records;
  }

  static recoverStalledJobs(staleThresholdMs: number = 300000): number {
    const now = Date.now();
    let recoveredCount = 0;

    for (const record of Array.from(OutboxPublisherService.outboxStore.values())) {
      if (record.status === "PROCESSING" && record.processingStartedAt) {
        const started = new Date(record.processingStartedAt).getTime();
        if (now - started > staleThresholdMs) {
          record.status = "PENDING";
          record.workerId = undefined;
          record.processingStartedAt = undefined;
          recoveredCount++;
        }
      }
    }

    return recoveredCount;
  }

  static replayDlqEvent(recordId: string): OutboxRecord {
    const record = OutboxPublisherService.outboxStore.get(recordId);
    if (!record || record.status !== "DEAD_LETTER") {
      throw new Error("Event record not found or not in DEAD_LETTER status");
    }

    record.status = "PENDING";
    record.retryCount = 0;
    record.lastError = undefined;
    record.nextRetryAt = undefined;
    return record;
  }

  static getMetrics() {
    const all = Array.from(OutboxPublisherService.outboxStore.values());
    return {
      pendingCount: all.filter((r) => r.status === "PENDING").length,
      processingCount: all.filter((r) => r.status === "PROCESSING").length,
      publishedCount: all.filter((r) => r.status === "PUBLISHED").length,
      dlqCount: all.filter((r) => r.status === "DEAD_LETTER").length,
      totalEvents: all.length,
    };
  }
}
