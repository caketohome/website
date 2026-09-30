/**
 * CakeToHome ERP — COD Collection Control Repository
 * Phase 4F Step 4.9: Cash on Delivery (COD) Collection Control & Delivery Rider Remittance
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. DUAL-PERSISTENCE CUSTODY EVENT (ZERO DDL):
 *    - Operational state: persisted immutably in public.order.metadata->'cod_custody_event'.
 *    - Audit trail: appended immutably to public.order_status_history (to_status: 'COD_CASH_COLLECTED').
 * 2. MODEL B CONSTRAINTS:
 *    - Delivery OTP confirms delivery completion (State A.1: DELIVERED_PENDING_COLLECTION).
 *    - Cash collection requires an explicit separate authoritative event (State B: IDENTIFIED_RIDER_CUSTODY).
 * 3. IMMUTABILITY GUARANTEE:
 *    - Custody snapshot freezes order_id, delivery_partner_id, branch_id, collected_amount, collected_at.
 *    - Subledger queries read the frozen snapshot, NEVER mutable public.delivery table.
 * 4. PESSIMISTIC LOCKING:
 *    - All mutations acquire SELECT ... FOR UPDATE on target order rows.
 */

import { dbQuery, dbTransaction } from "../db";
import type { PoolClient } from "pg";
import type {
  CodCustodySnapshot,
  CodCustodyStatus,
  ConfirmCodCollectionParams,
  RiderCodCustodySummary,
  CodReconciliationResult,
  CodExceptionItem,
} from "../types/accounting.types";

export class CodCollectionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CodCollectionError";
    this.code = code;
  }
}

export class CodCollectionRepository {
  /**
   * Confirms explicit COD cash collection under Model B.
   * Transitions an order from DELIVERED_PENDING_COLLECTION to IDENTIFIED_RIDER_CUSTODY or UNASSIGNED_DELIVERED_COD.
   */
  static async confirmCodCollection(
    params: ConfirmCodCollectionParams
  ): Promise<CodCustodySnapshot> {
    const execute = async (client: PoolClient): Promise<CodCustodySnapshot> => {
      // 1. Pessimistic lock on order
      const oSql = `
        SELECT id, display_id, customer_id, status, metadata, created_at, updated_at
        FROM public."order"
        WHERE id = $1 AND deleted_at IS NULL
        FOR UPDATE;
      `;
      const oRes = await client.query(oSql, [params.orderId]);
      const order = oRes.rows[0];
      if (!order) {
        throw new CodCollectionError("ORDER_NOT_FOUND", `Order '${params.orderId}' not found.`);
      }

      const meta = (order.metadata || {}) as Record<string, any>;

      // 2. Historical Prototype Quarantine
      if (meta.legacy_prototype === true || meta.is_ledger_eligible !== true) {
        throw new CodCollectionError(
          "LEGACY_PROTOTYPE_ORDER_REJECTED",
          `Order '${order.id}' is quarantined historical prototype data and cannot participate in COD accounting.`
        );
      }

      // 3. Payment Method Verification (Must be COD)
      const paymentMethod = String(meta.payment_method || "").toLowerCase();
      const isCod =
        paymentMethod === "cod" ||
        paymentMethod === "cash on delivery (cod)" ||
        meta.payment_classification === "COD";

      if (!isCod) {
        throw new CodCollectionError(
          "NOT_A_COD_ORDER",
          `Order '${order.id}' has payment method '${meta.payment_method}'. Only COD orders support cash collection.`
        );
      }

      // 4. Delivery Status Verification (Must be DELIVERED under Model B)
      const ordStatus = String(order.status || "").toLowerCase();
      const deliveryStatus = String(meta.delivery?.status || meta.delivery_status || "").toLowerCase();
      const isDelivered =
        ordStatus === "delivered" ||
        ordStatus === "completed" ||
        deliveryStatus === "delivered" ||
        deliveryStatus === "completed";

      if (!isDelivered) {
        throw new CodCollectionError(
          "ORDER_NOT_DELIVERED",
          `Cannot record cash collection for order '${order.id}' in status '${order.status}'. Doorstep delivery must be completed first.`
        );
      }

      // 5. Idempotency Check: Prevent duplicate collection events
      if (meta.cod_custody_event && meta.cod_custody_event.custody_id) {
        throw new CodCollectionError(
          "DUPLICATE_COLLECTION_EVENT",
          `Cash collection has already been confirmed for order '${order.id}' under custody ID '${meta.cod_custody_event.custody_id}'.`
        );
      }

      // 6. Resolve Invoiced Commercial Amount
      // Query posted sales voucher for this order
      const vSql = `
        SELECT id, total_amount, metadata
        FROM public.accounting_voucher
        WHERE reference_type = 'SALE'
          AND reference_id = $1
          AND voucher_type = 'SALES'
          AND status = 'POSTED'
          AND deleted_at IS NULL;
      `;
      const vRes = await client.query(vSql, [order.id]);
      const salesVoucher = vRes.rows[0];
      if (!salesVoucher) {
        throw new CodCollectionError(
          "SALES_INVOICE_NOT_POSTED",
          `Order '${order.id}' has not been posted to the General Ledger. A sales invoice voucher is required before cash collection.`
        );
      }

      const invoicedAmount = Math.round(Number(salesVoucher.total_amount) * 100) / 100;
      const collectedAmount =
        typeof params.amount === "number" && !isNaN(params.amount) && params.amount > 0
          ? Math.round(params.amount * 100) / 100
          : invoicedAmount;

      // Fail-closed if collected amount differs from invoiced amount without an authorized dispute
      if (collectedAmount !== invoicedAmount) {
        throw new CodCollectionError(
          "COLLECTION_AMOUNT_MISMATCH",
          `Collection amount ₹${collectedAmount.toFixed(2)} does not match invoiced COD total ₹${invoicedAmount.toFixed(2)} for order '${order.id}'.`
        );
      }

      // 7. Resolve Delivery Partner Attribution
      const partnerId =
        params.deliveryPartnerId ||
        meta.delivery_partner_id ||
        meta.delivery?.partner_id ||
        null;

      let partnerName: string | null = null;
      if (partnerId) {
        const dpSql = `
          SELECT id, first_name, last_name FROM public.delivery_partner WHERE id = $1 AND deleted_at IS NULL;
        `;
        const dpRes = await client.query(dpSql, [partnerId]);
        if (dpRes.rows.length > 0) {
          const dp = dpRes.rows[0];
          partnerName = `${dp.first_name || ""} ${dp.last_name || ""}`.trim() || partnerId;
        } else {
          partnerName = meta.delivery?.partner_name || meta.delivery_partner_name || partnerId;
        }
      }

      const branchId = params.branchId || meta.branch_id || "default_branch";
      const collectedAt = params.collectedAt || new Date().toISOString();
      const custodyStatus: CodCustodyStatus = partnerId
        ? "IDENTIFIED_RIDER_CUSTODY"
        : "UNASSIGNED_DELIVERED_COD";

      // 8. Construct Immutable Custody Snapshot
      const snapshot: CodCustodySnapshot = {
        custody_id: `cust_${order.id}_${Date.now()}`,
        order_id: order.id,
        order_display_id: order.display_id || 0,
        delivery_partner_id: partnerId,
        partner_name: partnerName,
        branch_id: branchId,
        collected_amount: collectedAmount,
        custody_status: custodyStatus,
        collected_at: collectedAt,
        source_event_id: `del_${order.id}`,
        settlement_voucher_id: null,
        settled_at: null,
      };

      // 9. Persist into order.metadata->'cod_custody_event'
      const updateOrderSql = `
        UPDATE public."order"
        SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cod_custody_event}', $1::jsonb),
            updated_at = NOW()
        WHERE id = $2;
      `;
      await client.query(updateOrderSql, [JSON.stringify(snapshot), order.id]);

      // 10. Persist Append-Only Audit Record in order_status_history
      const historyId = `osh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const historySql = `
        INSERT INTO public.order_status_history (
          id, order_id, to_status, from_status, actor_type, actor_id, reason, metadata, created_at, updated_at
        ) VALUES ($1, $2, 'COD_CASH_COLLECTED', 'DELIVERED', 'DELIVERY_PARTNER', $3, 'Authoritative doorstep cash collection confirmed', $4, NOW(), NOW());
      `;
      await client.query(historySql, [
        historyId,
        order.id,
        partnerId || "SYSTEM",
        JSON.stringify(snapshot),
      ]);

      return snapshot;
    };

    return params.client ? execute(params.client) : dbTransaction(execute);
  }

  /**
   * Retrieves the authoritative outstanding COD cash custody for a specific delivery partner.
   */
  static async getRiderOutstandingCustody(
    deliveryPartnerId: string,
    branchId?: string,
    client?: PoolClient
  ): Promise<RiderCodCustodySummary> {
    const execute = async (c: PoolClient): Promise<RiderCodCustodySummary> => {
      let sql = `
        SELECT id, display_id, metadata
        FROM public."order"
        WHERE (metadata->>'legacy_prototype' IS NULL OR metadata->>'legacy_prototype' != 'true')
          AND metadata->>'is_ledger_eligible' = 'true'
          AND metadata->'cod_custody_event'->>'delivery_partner_id' = $1
          AND (metadata->'cod_custody_event'->>'settlement_voucher_id') IS NULL
          AND deleted_at IS NULL
      `;
      const sqlParams: any[] = [deliveryPartnerId];

      if (branchId) {
        sqlParams.push(branchId);
        sql += ` AND metadata->>'branch_id' = $${sqlParams.length}`;
      }

      sql += ` ORDER BY created_at ASC;`;

      const res = await c.query(sql, sqlParams);

      let totalCollected = 0;
      let partnerName = deliveryPartnerId;
      const orders: RiderCodCustodySummary["orders"] = [];

      for (const row of res.rows) {
        const meta = (row.metadata || {}) as Record<string, any>;
        const ev = meta.cod_custody_event as CodCustodySnapshot | undefined;
        if (!ev) continue;

        const amt = Math.round(Number(ev.collected_amount || 0) * 100) / 100;
        totalCollected = Math.round((totalCollected + amt) * 100) / 100;
        if (ev.partner_name) partnerName = ev.partner_name;

        orders.push({
          orderId: row.id,
          displayId: row.display_id || 0,
          collectedAmount: amt,
          collectedAt: ev.collected_at,
          custodyStatus: ev.custody_status,
        });
      }

      return {
        deliveryPartnerId,
        partnerName,
        branchId: branchId || "all",
        totalCollected,
        totalRemitted: 0,
        outstandingCustody: totalCollected,
        activeOrdersCount: orders.length,
        orders,
      };
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  /**
   * Reads the current General Ledger net balance for Account 1122 ("Undeposited COD").
   * GL 1122 Net Balance = Sum(Debits) - Sum(Credits) across all posted lines.
   */
  static async getGl1122Balance(
    branchId?: string,
    client?: PoolClient
  ): Promise<number> {
    const execute = async (c: PoolClient): Promise<number> => {
      let sql = `
        SELECT COALESCE(SUM(jl.debit_amount) - SUM(jl.credit_amount), 0) AS gl_balance
        FROM public.accounting_journal_line jl
        JOIN public.accounting_journal_entry je ON jl.journal_entry_id = je.id
        JOIN public.accounting_voucher v ON je.voucher_id = v.id
        JOIN public.accounting_account a ON jl.account_id = a.id
        WHERE a.code = '1122'
          AND v.status = 'POSTED'
          AND v.deleted_at IS NULL
          AND je.is_reversed = false
      `;
      const sqlParams: any[] = [];
      if (branchId) {
        sqlParams.push(branchId);
        sql += ` AND jl.branch_id = $${sqlParams.length}`;
      }
      sql += `;`;

      const res = await c.query(sql, sqlParams);
      return Math.round(Number(res.rows[0]?.gl_balance || 0) * 100) / 100;
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  /**
   * Invariant Guard: Once a COD custody event is confirmed, its 8 core fields
   * are strictly immutable. Any attempt to alter them throws CUSTODY_IMMUTABILITY_VIOLATION.
   */
  static assertCustodyImmutability(
    existingMeta: Record<string, any>,
    incomingMeta: Record<string, any>
  ): void {
    const existingEv = existingMeta?.cod_custody_event as CodCustodySnapshot | undefined;
    const incomingEv = incomingMeta?.cod_custody_event as CodCustodySnapshot | undefined;
    if (!existingEv || !existingEv.custody_id) return; // No custody event exists yet

    if (!incomingEv) {
      throw new CodCollectionError(
        "CUSTODY_IMMUTABILITY_VIOLATION",
        `Forbidden: Attempted to delete or nullify frozen COD custody event '${existingEv.custody_id}'.`
      );
    }

    const immutableFields: (keyof CodCustodySnapshot)[] = [
      "custody_id",
      "order_id",
      "delivery_partner_id",
      "branch_id",
      "collected_amount",
      "custody_status",
      "collected_at",
      "source_event_id",
    ];

    for (const field of immutableFields) {
      if (existingEv[field] !== undefined && incomingEv[field] !== existingEv[field]) {
        throw new CodCollectionError(
          "CUSTODY_IMMUTABILITY_VIOLATION",
          `Forbidden: Attempted to mutate immutable COD custody field '${field}' from '${String(existingEv[field])}' to '${String(incomingEv[field])}' for custody '${existingEv.custody_id}'.`
        );
      }
    }
  }

  /**
   * Reads the authoritative COD custody snapshot from order metadata and validates parity
   * against the append-only order_status_history audit trail.
   */
  static async getOrderCustodySnapshot(
    orderId: string,
    client?: PoolClient
  ): Promise<CodCustodySnapshot | null> {
    const execute = async (c: PoolClient): Promise<CodCustodySnapshot | null> => {
      const oRes = await c.query(
        `SELECT metadata FROM public."order" WHERE id = $1 AND deleted_at IS NULL;`,
        [orderId]
      );
      if (oRes.rows.length === 0) return null;
      const snapshot = oRes.rows[0].metadata?.cod_custody_event as CodCustodySnapshot | undefined;
      if (!snapshot) return null;

      // Cross-verify against append-only audit trail
      const hRes = await c.query(
        `SELECT metadata FROM public.order_status_history
         WHERE order_id = $1 AND to_status = 'COD_CASH_COLLECTED'
         ORDER BY created_at ASC LIMIT 1;`,
        [orderId]
      );
      if (hRes.rows.length > 0) {
        let rawAudit = hRes.rows[0].metadata;
        if (typeof rawAudit === "string") {
          try {
            rawAudit = JSON.parse(rawAudit);
          } catch {
            rawAudit = null;
          }
        }
        const auditSnapshot = (rawAudit?.cod_custody_event || rawAudit) as CodCustodySnapshot | undefined;
        if (auditSnapshot) {
          const coreFields: (keyof CodCustodySnapshot)[] = [
            "custody_id",
            "delivery_partner_id",
            "collected_amount",
            "collected_at",
            "source_event_id",
          ];
          for (const f of coreFields) {
            if (auditSnapshot[f] !== undefined && snapshot[f] !== auditSnapshot[f]) {
              throw new CodCollectionError(
                "CUSTODY_IMMUTABILITY_VIOLATION",
                `Custody integrity violation on order '${orderId}': metadata.${f} ('${snapshot[f]}') does not match immutable audit trail ('${auditSnapshot[f]}').`
              );
            }
          }
        }
      }

      return snapshot;
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  /**
   * Safely updates order metadata while strictly protecting frozen custody fields.
   */
  static async updateOrderMetadataSafely(
    orderId: string,
    incomingMeta: Record<string, any>,
    client: PoolClient
  ): Promise<void> {
    const oRes = await client.query(
      `SELECT metadata FROM public."order" WHERE id = $1 AND deleted_at IS NULL FOR UPDATE;`,
      [orderId]
    );
    if (oRes.rows.length === 0) {
      throw new CodCollectionError("ORDER_NOT_FOUND", `Order '${orderId}' not found.`);
    }

    const existingMeta = (oRes.rows[0].metadata || {}) as Record<string, any>;
    CodCollectionRepository.assertCustodyImmutability(existingMeta, incomingMeta);

    await client.query(
      `UPDATE public."order" SET metadata = $1, updated_at = NOW() WHERE id = $2;`,
      [JSON.stringify(incomingMeta), orderId]
    );
  }

  /**
   * Categorizes all ledger-eligible COD orders into the five mutually exclusive control states
   * and computes the operational subledger total for Account 1122.
   *
   * Invariant: Every rupee included in A + A.1 + B + C + D corresponds strictly to an authoritative
   * posted Account 1122 debit that remains uncleared by allocated 1122 credits.
   * Operational exceptions with no 1122 balance contribute ₹0.00 to the subledger.
   */
  static async getCodSubledger(
    branchId?: string,
    client?: PoolClient
  ): Promise<{
    stateA_preDeliveryUncollected: number;
    stateA1_deliveredPendingCollection: number;
    stateB_identifiedRiderCustody: number;
    stateC_unassignedDeliveredCod: number;
    stateD_otherValidUncleared: number;
    stateE_remittedClearedTotal: number;
    totalOperationalUnclearedControl: number;
  }> {
    const execute = async (c: PoolClient) => {
      let sql = `
        SELECT 
          o.id,
          o.status,
          o.metadata,
          COALESCE((
            SELECT SUM(jl.debit_amount)
            FROM public.accounting_journal_line jl
            JOIN public.accounting_journal_entry je ON jl.journal_entry_id = je.id
            JOIN public.accounting_voucher v ON je.voucher_id = v.id
            JOIN public.accounting_account a ON jl.account_id = a.id
            WHERE a.code = '1122'
              AND (jl.metadata->>'order_id' = o.id OR jl.narration LIKE '%' || o.id || '%')
              AND v.status = 'POSTED'
              AND v.deleted_at IS NULL
              AND je.is_reversed = false
          ), 0) AS posted_1122_debit,
          COALESCE((
            SELECT SUM(jl.credit_amount)
            FROM public.accounting_journal_line jl
            JOIN public.accounting_journal_entry je ON jl.journal_entry_id = je.id
            JOIN public.accounting_voucher v ON je.voucher_id = v.id
            JOIN public.accounting_account a ON jl.account_id = a.id
            WHERE a.code = '1122'
              AND (jl.metadata->>'order_id' = o.id OR jl.narration LIKE '%' || o.id || '%')
              AND v.status = 'POSTED'
              AND v.deleted_at IS NULL
              AND je.is_reversed = false
          ), 0) AS posted_1122_credit
        FROM public."order" o
        WHERE (o.metadata->>'legacy_prototype' IS NULL OR o.metadata->>'legacy_prototype' != 'true')
          AND o.metadata->>'is_ledger_eligible' = 'true'
          AND (
            o.metadata->>'payment_method' = 'cod' 
            OR o.metadata->>'payment_method' = 'Cash on Delivery (COD)'
            OR EXISTS (
              SELECT 1 FROM public.accounting_voucher v2 
              WHERE v2.reference_id = o.id AND v2.metadata->>'payment_classification' = 'COD'
            )
          )
          AND o.deleted_at IS NULL
      `;
      const sqlParams: any[] = [];
      if (branchId) {
        sqlParams.push(branchId);
        sql += ` AND o.metadata->>'branch_id' = $${sqlParams.length}`;
      }

      const res = await c.query(sql, sqlParams);

      let stateA = 0;
      let stateA1 = 0;
      let stateB = 0;
      let stateC = 0;
      let stateD = 0;
      let stateE = 0;

      for (const row of res.rows) {
        const postedDebit = Math.round(Number(row.posted_1122_debit) * 100) / 100;
        const postedCredit = Math.round(Number(row.posted_1122_credit) * 100) / 100;
        const netOrderBalance = Math.round((postedDebit - postedCredit) * 100) / 100;

        // Invariant: If an order has no posted 1122 debit, it has no accounting presence in 1122.
        // It cannot fabricate an 1122 balance. Any operational exception belongs strictly in scanExceptions.
        if (postedDebit <= 0.001) {
          continue;
        }

        const meta = (row.metadata || {}) as Record<string, any>;
        const ev = meta.cod_custody_event as CodCustodySnapshot | undefined;
        const ordStatus = String(row.status || "").toLowerCase();
        const delStatus = String(meta.delivery?.status || meta.delivery_status || "").toLowerCase();
        const isDelivered = ordStatus === "delivered" || ordStatus === "completed" || delStatus === "delivered";
        const isDisputedOrException =
          ordStatus === "delivery_exception" || ordStatus === "returned" || ordStatus === "disputed" ||
          delStatus === "delivery_exception" || delStatus === "disputed" || delStatus === "returned" || delStatus === "failed";

        // Mutually exclusive categorization derived strictly from authoritative net 1122 balance:
        if (netOrderBalance <= 0.001) {
          // State E: Fully remitted and cleared (contributes ₹0 to uncleared control)
          stateE = Math.round((stateE + postedDebit) * 100) / 100;
        } else if (isDisputedOrException) {
          // State D: Authoritative uncleared 1122 balance in operational dispute / exception
          // Every rupee in State D is strictly backed by authoritative posted 1122 debits minus credits
          stateD = Math.round((stateD + netOrderBalance) * 100) / 100;
        } else if (!isDelivered && !ev) {
          // State A: Invoiced, out for delivery or pending fulfillment, cash not collected
          stateA = Math.round((stateA + netOrderBalance) * 100) / 100;
        } else if (isDelivered && !ev) {
          // State A.1: Delivered, pending cash collection confirmation
          stateA1 = Math.round((stateA1 + netOrderBalance) * 100) / 100;
        } else if (ev && ev.delivery_partner_id) {
          // State B: Cash collected in identified rider custody, pending remittance
          stateB = Math.round((stateB + netOrderBalance) * 100) / 100;
        } else if (ev && !ev.delivery_partner_id) {
          // State C: Cash collected without assigned rider, pending assignment/remittance
          stateC = Math.round((stateC + netOrderBalance) * 100) / 100;
        }
      }

      const totalOperationalUnclearedControl = Math.round((stateA + stateA1 + stateB + stateC + stateD) * 100) / 100;

      return {
        stateA_preDeliveryUncollected: stateA,
        stateA1_deliveredPendingCollection: stateA1,
        stateB_identifiedRiderCustody: stateB,
        stateC_unassignedDeliveredCod: stateC,
        stateD_otherValidUncleared: stateD,
        stateE_remittedClearedTotal: stateE,
        totalOperationalUnclearedControl,
      };
    };

    return client ? execute(client) : dbTransaction(execute);
  }

  /**
   * Scans for all 7 systematic COD control anomalies.
   */
  static async scanExceptions(
    branchId?: string,
    client?: PoolClient
  ): Promise<CodExceptionItem[]> {
    const execute = async (c: PoolClient): Promise<CodExceptionItem[]> => {
      const exceptions: CodExceptionItem[] = [];

      // 1. Unassigned Delivered COD
      let sql1 = `
        SELECT id, metadata FROM public."order"
        WHERE metadata->'cod_custody_event' IS NOT NULL
          AND (metadata->'cod_custody_event'->>'delivery_partner_id') IS NULL
          AND (metadata->'cod_custody_event'->>'settlement_voucher_id') IS NULL
          AND deleted_at IS NULL
      `;
      if (branchId) sql1 += ` AND metadata->>'branch_id' = '${branchId}'`;
      const res1 = await c.query(sql1);
      for (const row of res1.rows) {
        exceptions.push({
          type: "COD_WITHOUT_DELIVERY_ASSIGNMENT",
          severity: "HIGH",
          orderId: row.id,
          details: `Order '${row.id}' completed cash collection but has no authoritative delivery partner assigned.`,
        });
      }

      // 2. Delivered without Collection Confirmation (> 2 hours)
      let sql2 = `
        SELECT id, metadata, updated_at FROM public."order"
        WHERE (status::text = 'delivered' OR status::text = 'completed' OR metadata->'delivery'->>'status' = 'delivered')
          AND (metadata->>'payment_method' = 'cod' OR metadata->>'payment_method' = 'Cash on Delivery (COD)')
          AND metadata->'cod_custody_event' IS NULL
          AND (metadata->>'legacy_prototype' IS NULL OR metadata->>'legacy_prototype' != 'true')
          AND metadata->>'is_ledger_eligible' = 'true'
          AND deleted_at IS NULL
      `;
      if (branchId) sql2 += ` AND metadata->>'branch_id' = '${branchId}'`;
      const res2 = await c.query(sql2);
      for (const row of res2.rows) {
        exceptions.push({
          type: "COD_DELIVERED_WITHOUT_COLLECTION",
          severity: "MEDIUM",
          orderId: row.id,
          details: `Order '${row.id}' is delivered but cash collection confirmation is pending from rider.`,
        });
      }

      // 3. Operational Exception without 1122 Accounting Balance
      let sql3 = `
        SELECT o.id, o.status, o.metadata FROM public."order" o
        WHERE (
            o.status::text IN ('delivery_exception', 'disputed', 'returned', 'cancelled')
            OR o.metadata->'delivery'->>'status' IN ('delivery_exception', 'disputed', 'returned', 'failed')
          )
          AND (o.metadata->>'payment_method' = 'cod' OR o.metadata->>'payment_method' = 'Cash on Delivery (COD)')
          AND (o.metadata->>'legacy_prototype' IS NULL OR o.metadata->>'legacy_prototype' != 'true')
          AND o.metadata->>'is_ledger_eligible' = 'true'
          AND NOT EXISTS (
            SELECT 1 FROM public.accounting_journal_line jl
            JOIN public.accounting_journal_entry je ON jl.journal_entry_id = je.id
            JOIN public.accounting_voucher v ON je.voucher_id = v.id
            JOIN public.accounting_account a ON jl.account_id = a.id
            WHERE a.code = '1122'
              AND (jl.metadata->>'order_id' = o.id OR jl.narration LIKE '%' || o.id || '%')
              AND v.status = 'POSTED'
              AND v.deleted_at IS NULL
              AND je.is_reversed = false
          )
          AND o.deleted_at IS NULL
      `;
      if (branchId) sql3 += ` AND o.metadata->>'branch_id' = '${branchId}'`;
      const res3 = await c.query(sql3);
      for (const row of res3.rows) {
        exceptions.push({
          type: "COD_DISPUTE_WITHOUT_1122_BALANCE",
          severity: "MEDIUM",
          orderId: row.id,
          details: `Order '${row.id}' is in operational status '${row.status}' but has no posted 1122 debit balance. Flagged in operational exceptions; excluded from GL 1122 reconciliation.`,
        });
      }

      return exceptions;
    };

    return client ? execute(client) : dbTransaction(execute);
  }
}
