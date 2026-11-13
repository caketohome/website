/**
 * CakeToHome ERP — Delivery Cash Handover Domain Service
 * Manages delivery boy cash collections, handover declarations, and manager cash acknowledgement.
 *
 * ARCHITECTURAL CONTRACT:
 * 1. Delivery boy collects cash from customers during delivery (State: IDENTIFIED_RIDER_CUSTODY).
 * 2. Delivery boy or operations staff submits a Handover Declaration (State: SUBMITTED).
 * 3. Unacknowledged handovers DO NOT increase the Branch Manager's physical cash drawer balance.
 * 4. Branch Manager counts physical cash and acknowledges receipt (State: ACKNOWLEDGED).
 * 5. Acknowledging cash transactionally:
 *    - Updates delivery_cash_handover status to ACKNOWLEDGED.
 *    - Posts GL voucher: Dr 1111 (Cash in Hand) / Cr 1122 (Undeposited COD).
 *    - Projects canonical Teller Movement into active open session (direction: IN, type: COD_HANDOVER).
 *    - Marks orders settled in metadata and appends to order_status_history.
 * 6. Prevents duplicate handovers: orders in an active or acknowledged handover cannot be re-submitted.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import { TellerSessionRepository } from "../repositories/teller-session.repository";
import { TellerSessionService } from "./teller-session.service";
import { TellerMovementService } from "./teller-movement.service";
import { PostingService } from "./posting.service";
import { AccountingAccountRepository } from "../repositories/accounting-account.repository";
import { hasEffectivePermission } from "../staff-access-control";

export type HandoverStatus = "DRAFT" | "SUBMITTED" | "ACKNOWLEDGED" | "DISPUTED" | "CANCELLED";

export interface DeliveryCashHandoverRow {
  id: string;
  handover_number: string;
  branch_id: string;
  delivery_partner_id: string;
  teller_session_id: string | null;
  status: HandoverStatus;
  expected_amount: number;
  declared_amount: number;
  acknowledged_amount: number;
  shortage_amount: number;
  surplus_amount: number;
  digital_amount: number;
  order_ids: string[];
  discrepancy_reason: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  received_by: string | null;
  acknowledged_at: string | null;
  settlement_voucher_id: string | null;
  teller_movement_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  partner_name?: string;
  branch_name?: string;
}

export interface EligibleOrderCollection {
  orderId: string;
  displayId: number | string;
  collectedAmount: number;
  paymentMethod: string;
  collectedAt: string;
  recipientName?: string;
}

export class DeliveryHandoverError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DeliveryHandoverError";
    this.code = code;
  }
}

export class DeliveryHandoverService {
  /**
   * Retrieves all unremitted COD collections for a delivery boy in a branch.
   */
  static async getEligibleCollections(
    deliveryPartnerId: string,
    branchId: string,
    client?: PoolClient
  ): Promise<{
    deliveryPartnerId: string;
    partnerName: string;
    branchId: string;
    expectedCash: number;
    digitalCollections: number;
    orders: EligibleOrderCollection[];
  }> {
    const execute = async (c: PoolClient) => {
      // 1. Resolve partner name
      const pRes = await c.query(
        `SELECT id, first_name, last_name, phone FROM public.delivery_partner WHERE id = $1 AND deleted_at IS NULL`,
        [deliveryPartnerId]
      );
      const partner = pRes.rows[0];
      const partnerName = partner ? `${partner.first_name || ""} ${partner.last_name || ""}`.trim() : deliveryPartnerId;

      // 2. Query delivered orders with COD custody not yet settled
      const oSql = `
        SELECT id, display_id, metadata
        FROM public."order"
        WHERE (metadata->>'legacy_prototype' IS NULL OR metadata->>'legacy_prototype' != 'true')
          AND metadata->>'is_ledger_eligible' = 'true'
          AND metadata->'cod_custody_event'->>'delivery_partner_id' = $1
          AND metadata->>'branch_id' = $2
          AND (metadata->'cod_custody_event'->>'settlement_voucher_id') IS NULL
          AND deleted_at IS NULL
        ORDER BY created_at ASC;
      `;
      const oRes = await c.query(oSql, [deliveryPartnerId, branchId]);

      // Filter out any orders that are already part of an active (SUBMITTED/DRAFT) handover
      const pendingHndSql = `
        SELECT UNNEST(order_ids) AS active_order_id
        FROM public.delivery_cash_handover
        WHERE branch_id = $1 AND delivery_partner_id = $2 AND status IN ('DRAFT', 'SUBMITTED')
      `;
      const pendingRes = await c.query(pendingHndSql, [branchId, deliveryPartnerId]);
      const activePendingOrders = new Set(pendingRes.rows.map((r) => r.active_order_id));

      let expectedCash = 0;
      let digitalCollections = 0;
      const orders: EligibleOrderCollection[] = [];

      for (const row of oRes.rows) {
        if (activePendingOrders.has(row.id)) continue;

        const meta = (row.metadata || {}) as Record<string, any>;
        const ev = meta.cod_custody_event || {};
        const amt = Math.round(Number(ev.collected_amount || meta.total || 0) * 100) / 100;
        const method = String(meta.payment_method || "COD").toUpperCase();

        if (method === "COD" || method === "CASH") {
          expectedCash = Math.round((expectedCash + amt) * 100) / 100;
        } else {
          digitalCollections = Math.round((digitalCollections + amt) * 100) / 100;
        }

        orders.push({
          orderId: row.id,
          displayId: row.display_id || row.id,
          collectedAmount: amt,
          paymentMethod: method,
          collectedAt: ev.collected_at || meta.delivered_at || new Date().toISOString(),
          recipientName: meta.shipping_address?.name || meta.customer_name,
        });
      }

      return {
        deliveryPartnerId,
        partnerName,
        branchId,
        expectedCash,
        digitalCollections,
        orders,
      };
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  /**
   * Submits a handover declaration by the delivery boy or operations staff.
   * State: SUBMITTED (does NOT affect drawer cash balance yet).
   */
  static async submitHandover(
    params: {
      branchId: string;
      deliveryPartnerId: string;
      declaredAmount: number;
      digitalAmount?: number;
      orderIds: string[];
      discrepancyReason?: string;
      submittedBy: string;
      notes?: string;
    },
    client?: PoolClient
  ): Promise<DeliveryCashHandoverRow> {
    const execute = async (c: PoolClient) => {
      if (!params.branchId) throw new DeliveryHandoverError("MISSING_BRANCH", "Branch ID is required.");
      if (!params.deliveryPartnerId) throw new DeliveryHandoverError("MISSING_PARTNER", "Delivery partner ID is required.");
      if (!params.orderIds || params.orderIds.length === 0) {
        throw new DeliveryHandoverError("EMPTY_ORDERS", "At least one order must be included in handover.");
      }

      const declaredAmount = Math.round(Number(params.declaredAmount || 0) * 100) / 100;
      const digitalAmount = Math.round(Number(params.digitalAmount || 0) * 100) / 100;

      // 1. Lock and validate order rows
      const oSql = `
        SELECT id, display_id, metadata
        FROM public."order"
        WHERE id = ANY($1) AND deleted_at IS NULL
        FOR UPDATE;
      `;
      const oRes = await c.query(oSql, [params.orderIds]);
      if (oRes.rows.length !== params.orderIds.length) {
        throw new DeliveryHandoverError("ORDER_NOT_FOUND", "One or more orders in handover were not found.");
      }

      let expectedCash = 0;
      for (const row of oRes.rows) {
        const meta = (row.metadata || {}) as Record<string, any>;
        if (meta.branch_id && meta.branch_id !== params.branchId) {
          throw new DeliveryHandoverError("BRANCH_MISMATCH", `Order '${row.id}' belongs to branch '${meta.branch_id}', not '${params.branchId}'.`);
        }
        const ev = meta.cod_custody_event || {};
        if (ev.settlement_voucher_id) {
          throw new DeliveryHandoverError("ORDER_ALREADY_SETTLED", `Order '${row.id}' has already been settled.`);
        }
        const amt = Math.round(Number(ev.collected_amount || meta.total || 0) * 100) / 100;
        expectedCash = Math.round((expectedCash + amt) * 100) / 100;
      }

      // Check if any of these orders are in an existing active handover
      const dupCheckSql = `
        SELECT id, handover_number, status
        FROM public.delivery_cash_handover
        WHERE order_ids && $1 AND status IN ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED')
      `;
      const dupRes = await c.query(dupCheckSql, [params.orderIds]);
      if (dupRes.rows.length > 0) {
        throw new DeliveryHandoverError(
          "DUPLICATE_HANDOVER_ORDER",
          `One or more orders are already in handover '${dupRes.rows[0].handover_number}' (${dupRes.rows[0].status}).`
        );
      }

      // Business rule: the delivery partner hands over the ENTIRE collected cash — no partial handovers.
      if (declaredAmount !== expectedCash) {
        throw new DeliveryHandoverError(
          "PARTIAL_HANDOVER_FORBIDDEN",
          `Declared cash ₹${declaredAmount.toFixed(2)} must equal the full collected amount ₹${expectedCash.toFixed(2)}.`
        );
      }

      const shortageAmount = declaredAmount < expectedCash ? Math.round((expectedCash - declaredAmount) * 100) / 100 : 0;
      const surplusAmount = declaredAmount > expectedCash ? Math.round((declaredAmount - expectedCash) * 100) / 100 : 0;

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const handoverNumber = `HND-${dateStr}-${randStr}`;
      const handoverId = `hnd_${Date.now()}_${randStr.toLowerCase()}`;

      const insertSql = `
        INSERT INTO public.delivery_cash_handover (
          id, handover_number, branch_id, delivery_partner_id,
          status, expected_amount, declared_amount, acknowledged_amount,
          shortage_amount, surplus_amount, digital_amount,
          order_ids, discrepancy_reason, submitted_by, submitted_at,
          metadata, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4,
          'SUBMITTED', $5, $6, 0.00,
          $7, $8, $9,
          $10, $11, $12, NOW(),
          $13, NOW(), NOW()
        ) RETURNING *;
      `;

      const insertRes = await c.query<DeliveryCashHandoverRow>(insertSql, [
        handoverId,
        handoverNumber,
        params.branchId,
        params.deliveryPartnerId,
        expectedCash,
        declaredAmount,
        shortageAmount,
        surplusAmount,
        digitalAmount,
        params.orderIds,
        params.discrepancyReason || null,
        params.submittedBy,
        JSON.stringify({ notes: params.notes || null }),
      ]);

      return insertRes.rows[0];
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  /**
   * Acknowledges cash receipt by the Branch Manager.
   * State: ACKNOWLEDGED
   * Transactionally:
   * 1. Updates delivery_cash_handover status and acknowledged_amount.
   * 2. Resolves active OPEN teller session.
   * 3. Projects canonical Teller Movement (direction: IN, type: COD_HANDOVER).
   * 4. Posts GL voucher: Dr 1111 (Cash in Hand) / Cr 1122 (Undeposited COD).
   * 5. Marks orders settled with settlement_voucher_id.
   */
  static async acknowledgeHandover(
    params: {
      handoverId: string;
      branchId: string;
      acknowledgedAmount: number;
      managerUserId: string;
      tellerSessionId?: string;
      discrepancyExplanation?: string;
    },
    client?: PoolClient
  ): Promise<{
    handover: DeliveryCashHandoverRow;
    tellerMovementId: string;
    voucherId: string;
    expectedCash: number;
    acknowledgedAmount: number;
  }> {
    const execute = async (c: PoolClient) => {
      // 1. Lock handover
      const hSql = `
        SELECT * FROM public.delivery_cash_handover
        WHERE id = $1 FOR UPDATE;
      `;
      const hRes = await c.query<DeliveryCashHandoverRow>(hSql, [params.handoverId]);
      const handover = hRes.rows[0];
      if (!handover) {
        throw new DeliveryHandoverError("HANDOVER_NOT_FOUND", `Handover '${params.handoverId}' not found.`);
      }

      if (handover.branch_id !== params.branchId) {
        throw new DeliveryHandoverError("BRANCH_MISMATCH", `Handover belongs to branch '${handover.branch_id}', not '${params.branchId}'.`);
      }

      if (handover.status === "ACKNOWLEDGED") {
        throw new DeliveryHandoverError("ALREADY_ACKNOWLEDGED", `Handover '${handover.handover_number}' has already been acknowledged.`);
      }
      if (handover.status === "CANCELLED") {
        throw new DeliveryHandoverError("HANDOVER_CANCELLED", `Handover '${handover.handover_number}' was cancelled.`);
      }

      const acknowledgedAmount = Math.round(Number(params.acknowledgedAmount) * 100) / 100;
      if (acknowledgedAmount < 0) {
        throw new DeliveryHandoverError("INVALID_AMOUNT", "Acknowledged amount cannot be negative.");
      }

      const expectedAmount = Number(handover.expected_amount || 0);
      // Full handover only: a mismatch would mark orders settled while cash is still with the rider.
      if (acknowledgedAmount !== Math.round(expectedAmount * 100) / 100) {
        throw new DeliveryHandoverError(
          "PARTIAL_HANDOVER_FORBIDDEN",
          `Received cash ₹${acknowledgedAmount.toFixed(2)} must equal the full handover amount ₹${expectedAmount.toFixed(2)}.`
        );
      }
      const shortageAmount = acknowledgedAmount < expectedAmount ? Math.round((expectedAmount - acknowledgedAmount) * 100) / 100 : 0;
      const surplusAmount = acknowledgedAmount > expectedAmount ? Math.round((acknowledgedAmount - expectedAmount) * 100) / 100 : 0;

      // 2. Resolve active OPEN teller session or continuous branch custody anchor
      let targetSessionId = params.tellerSessionId || handover.teller_session_id;
      if (!targetSessionId) {
        const continuousSession = await TellerSessionService.ensureContinuousBranchSession(
          handover.branch_id,
          {
            userId: params.managerUserId || "system",
            role: "BRANCH_MANAGER",
            branchId: handover.branch_id,
          },
          c
        );
        targetSessionId = continuousSession.id;
      }

      // 3. Project cash into Teller Movement (direction: IN, type: COD_HANDOVER)
      const projResult = await TellerMovementService.projectSystemMovement(
        {
          branch_id: handover.branch_id,
          teller_session_id: targetSessionId,
          direction: "IN",
          movement_type: "COD_HANDOVER",
          amount: acknowledgedAmount,
          source_type: "RIDER_SHIFT_SETTLEMENT",
          source_id: handover.id,
          narration: `Cash handover ${handover.handover_number} from rider ${handover.delivery_partner_id}`,
          created_by: params.managerUserId,
        },
        c
      );

      // 4. Construct & Post GL Voucher: Dr 1111 Cash in Hand / Cr 1122 Undeposited COD
      const coaRes = await c.query(
        `SELECT id, code FROM public.accounting_account WHERE code IN ('1111', '1122') AND is_active = true AND deleted_at IS NULL`
      );
      const coaMap = new Map<string, string>();
      for (const row of coaRes.rows) coaMap.set(row.code, row.id);

      const acc1111 = coaMap.get("1111");
      const acc1122 = coaMap.get("1122");
      if (!acc1111 || !acc1122) {
        throw new DeliveryHandoverError("COA_MISSING", "Required GL accounts 1111 or 1122 not found in Chart of Accounts.");
      }

      const today = new Date().toISOString().slice(0, 10);
      const fiscalYear = `FY${today.slice(0, 4)}`;
      const voucherCreator = (handover.submitted_by && handover.submitted_by !== params.managerUserId)
        ? handover.submitted_by
        : (handover.delivery_partner_id || "system_rider_custody");

      const draftVoucherRes = await PostingService.createVoucherDraft({
        input: {
          voucher_type: "RECEIPT",
          voucher_date: today,
          branch_id: handover.branch_id,
          narration: `Rider cash collection handover ${handover.handover_number} - Partner ${handover.delivery_partner_id}`,
          reference_type: "RIDER_SHIFT_SETTLEMENT",
          reference_id: handover.id,
          reference_event: "CASH_HANDOVER",
          metadata: {
            handover_id: handover.id,
            handover_number: handover.handover_number,
            delivery_partner_id: handover.delivery_partner_id,
            acknowledged_amount: acknowledgedAmount,
            expected_amount: expectedAmount,
          },
        },
        branchId: handover.branch_id,
        fiscalYear,
        createdBy: voucherCreator,
        client: c,
      });

      if (!draftVoucherRes.success) {
        throw new DeliveryHandoverError("POSTING_FAILED", draftVoucherRes.error);
      }

      const voucherId = draftVoucherRes.data.id;

      // Submit voucher draft
      const submitRes = await PostingService.submitVoucher({
        voucherId,
        submittedBy: voucherCreator,
        branchId: handover.branch_id,
        client: c,
      });
      if (!submitRes.success) {
        throw new DeliveryHandoverError("POSTING_FAILED", submitRes.error);
      }

      // Approve voucher (by manager)
      const approveRes = await PostingService.approveVoucher({
        voucherId,
        approvedBy: params.managerUserId,
        branchId: handover.branch_id,
        client: c,
      });
      if (!approveRes.success) {
        throw new DeliveryHandoverError("POSTING_FAILED", approveRes.error);
      }

      // Post Voucher with balanced lines: Dr 1111 / Cr 1122
      const postRes = await PostingService.postVoucher({
        voucherId,
        postedBy: params.managerUserId,
        lines: [
          {
            account_id: acc1111,
            debit_amount: acknowledgedAmount,
            credit_amount: 0,
            branch_id: handover.branch_id,
            narration: `Physical cash received at drawer - Handover ${handover.handover_number}`,
            metadata: { handover_id: handover.id },
          },
          {
            account_id: acc1122,
            debit_amount: 0,
            credit_amount: acknowledgedAmount,
            branch_id: handover.branch_id,
            narration: `Undeposited COD cleared - Handover ${handover.handover_number}`,
            metadata: { handover_id: handover.id },
          },
        ],
        branchId: handover.branch_id,
        client: c,
      });

      if (!postRes.success) {
        throw new DeliveryHandoverError("POSTING_FAILED", postRes.error);
      }

      // 5. Update handover record
      const updateHandoverSql = `
        UPDATE public.delivery_cash_handover
        SET status = 'ACKNOWLEDGED',
            acknowledged_amount = $1,
            shortage_amount = $2,
            surplus_amount = $3,
            teller_session_id = $4,
            teller_movement_id = $5,
            settlement_voucher_id = $6,
            received_by = $7,
            acknowledged_at = NOW(),
            discrepancy_reason = COALESCE($8, discrepancy_reason),
            updated_at = NOW()
        WHERE id = $9
        RETURNING *;
      `;
      const upRes = await c.query<DeliveryCashHandoverRow>(updateHandoverSql, [
        acknowledgedAmount,
        shortageAmount,
        surplusAmount,
        targetSessionId,
        projResult.movement.id,
        voucherId,
        params.managerUserId,
        params.discrepancyExplanation || null,
        handover.id,
      ]);

      // 6. Update orders metadata to mark settled
      const nowIso = new Date().toISOString();
      for (const orderId of handover.order_ids) {
        await c.query(
          `UPDATE public."order"
           SET metadata = jsonb_set(
                 jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cod_custody_event,settlement_voucher_id}', to_jsonb($1::text)),
                 '{cod_custody_event,settled_at}', to_jsonb($2::text)
               ),
               updated_at = NOW()
           WHERE id = $3;`,
          [voucherId, nowIso, orderId]
        );
      }

      return {
        handover: upRes.rows[0],
        tellerMovementId: projResult.movement.id,
        voucherId,
        expectedCash: expectedAmount,
        acknowledgedAmount,
      };
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  /**
   * Lists handovers with optional branch, partner, and status filters.
   */
  static async listHandovers(
    filters: {
      branchId?: string;
      deliveryPartnerId?: string;
      status?: HandoverStatus;
      limit?: number;
      offset?: number;
    },
    client?: PoolClient
  ): Promise<{ handovers: DeliveryCashHandoverRow[]; total: number }> {
    const execute = async (c: PoolClient) => {
      let whereClauses: string[] = [];
      let params: any[] = [];

      if (filters.branchId && filters.branchId !== "all") {
        params.push(filters.branchId);
        whereClauses.push(`h.branch_id = $${params.length}`);
      }

      if (filters.deliveryPartnerId) {
        params.push(filters.deliveryPartnerId);
        whereClauses.push(`h.delivery_partner_id = $${params.length}`);
      }

      if (filters.status) {
        params.push(filters.status);
        whereClauses.push(`h.status = $${params.length}`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      const countSql = `SELECT COUNT(*) FROM public.delivery_cash_handover h ${whereSql}`;
      const countRes = await c.query(countSql, params);
      const total = parseInt(countRes.rows[0].count, 10);

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      params.push(limit, offset);

      const dataSql = `
        SELECT h.*,
               CONCAT(dp.first_name, ' ', dp.last_name) AS partner_name,
               b.name AS branch_name
        FROM public.delivery_cash_handover h
        LEFT JOIN public.delivery_partner dp ON dp.id = h.delivery_partner_id
        LEFT JOIN public.branch b ON b.id = h.branch_id
        ${whereSql}
        ORDER BY h.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length};
      `;

      const dataRes = await c.query<DeliveryCashHandoverRow>(dataSql, params);

      return {
        handovers: dataRes.rows,
        total,
      };
    };

    return client ? execute(client) : dbTransaction(execute);
  }
}
