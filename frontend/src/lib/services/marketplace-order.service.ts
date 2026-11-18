/**
 * Marketplace Order Domain Service
 * Handles marketplace order assignment, commercial agreement snapshots,
 * shared inventory reservations, and tenant-isolated partner order state transitions.
 */

import { dbQuery, dbTransaction } from "../db";
import { MarketplacePartnerRepository, MarketplaceOrderSnapshotRow, MarketplaceComplaintRow } from "../repositories/marketplace-partner.repository";
import { SharedInventoryService } from "./shared-inventory.service";
import { OrderRepository } from "../repositories/order.repository";
import type { AuthenticatedActor } from "./feature-flag.service";


/** Only the order's own partner or authenticated staff may act on a partner order. */
function actorMayActOnPartnerOrder(actor: AuthenticatedActor, partnerId: string | undefined): string | null {
  const role = String(actor?.role || "").toUpperCase();
  if (!actor?.userId || !role || role === "CUSTOMER" || role === "ANONYMOUS" || role === "GUEST") {
    return "UNAUTHORIZED: Sign in as the partner or as staff to manage partner orders.";
  }
  if (role.startsWith("PARTNER_")) {
    if (!partnerId || actor.partnerId !== partnerId) return "UNAUTHORIZED: This order belongs to another partner.";
  }
  if (!partnerId) return "This order is not assigned to a marketplace partner.";
  return null;
}

export class MarketplaceOrderService {
  /**
   * Take an order-level commercial agreement snapshot upon order placement or partner assignment
   */
  static async createOrderSnapshot(params: {
    orderId: string;
    partnerId: string;
    storeId: string;
    grossOrderAmount: number;
    taxAmount: number;
  }): Promise<MarketplaceOrderSnapshotRow> {
    const agreement = await MarketplacePartnerRepository.getActiveAgreement(params.partnerId);

    const agreementId = agreement?.id || `agr_default_${params.partnerId}`;
    const agreementType = agreement?.agreement_type || "COMMISSION_PERCENTAGE";
    const commissionRate = agreement?.commission_rate || 15.0;
    const fixedFee = agreement?.fixed_fee_per_order || 0.0;

    let commissionAmount = 0;
    let netReceivable = 0;

    if (agreementType === "COMMISSION_PERCENTAGE") {
      commissionAmount = Math.round(((params.grossOrderAmount * commissionRate) / 100) * 100) / 100;
      netReceivable = Math.max(0, params.grossOrderAmount - commissionAmount);
    } else if (agreementType === "FIXED_PER_ORDER") {
      commissionAmount = fixedFee;
      netReceivable = Math.max(0, params.grossOrderAmount - fixedFee);
    } else if (agreementType === "HYBRID") {
      commissionAmount = Math.round(((params.grossOrderAmount * commissionRate) / 100) * 100) / 100 + fixedFee;
      netReceivable = Math.max(0, params.grossOrderAmount - commissionAmount);
    } else {
      // Wholesale transfer
      commissionAmount = 0;
      netReceivable = params.grossOrderAmount;
    }

    const snapshotId = `mos_${params.orderId}`;
    const snapshot: MarketplaceOrderSnapshotRow = {
      id: snapshotId,
      order_id: params.orderId,
      partner_id: params.partnerId,
      store_id: params.storeId,
      agreement_id: agreementId,
      agreement_type: agreementType,
      commission_rate: commissionRate,
      fixed_fee: fixedFee,
      gross_order_amount: params.grossOrderAmount,
      tax_amount: params.taxAmount,
      commission_amount: commissionAmount,
      partner_net_receivable: netReceivable,
      snapshot_data: {
        captured_at: new Date().toISOString(),
        agreement_effective_from: agreement?.effective_from,
        agreement_terms_ref: agreement?.terms_document_ref,
      },
      created_at: new Date().toISOString(),
    };

    await MarketplacePartnerRepository.saveOrderSnapshot(snapshot);
    return snapshot;
  }

  /**
   * Partner action: Accept order
   */
  static async acceptOrder(orderId: string, actor: AuthenticatedActor): Promise<{ success: boolean; error?: string }> {
    return dbTransaction(async (client) => {
      const orderRes = await client.query(`
        SELECT id, metadata FROM "order" WHERE id = $1 FOR UPDATE;
      `, [orderId]);

      if (orderRes.rows.length === 0) return { success: false, error: "Order not found" };
      const order = orderRes.rows[0];
      const partnerId = order.metadata?.partner_id;

      const denied = actorMayActOnPartnerOrder(actor, partnerId);
      if (denied) return { success: false, error: denied };

      await client.query(`
        UPDATE "order"
        SET metadata = jsonb_set(
              jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{partner_order_status}',
                '"ACCEPTED"'::jsonb
              ),
              '{bakery_status}',
              '"preparing"'::jsonb
            ),
            updated_at = NOW()
        WHERE id = $1;
      `, [orderId]);

      return { success: true };
    });
  }

  /**
   * Partner action: Reject order
   */
  static async rejectOrder(
    orderId: string,
    reason: string,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; error?: string }> {
    return dbTransaction(async (client) => {
      const orderRes = await client.query(`
        SELECT id, metadata FROM "order" WHERE id = $1 FOR UPDATE;
      `, [orderId]);

      if (orderRes.rows.length === 0) return { success: false, error: "Order not found" };
      const order = orderRes.rows[0];
      const partnerId = order.metadata?.partner_id;

      const denied = actorMayActOnPartnerOrder(actor, partnerId);
      if (denied) return { success: false, error: denied };

      // Release inventory reservation
      await SharedInventoryService.releaseReservation(orderId, `Rejected by partner: ${reason}`, actor.userId, actor.role, client);

      await client.query(`
        UPDATE "order"
        SET metadata = jsonb_set(
              COALESCE(metadata, '{}'::jsonb),
              '{partner_order_status}',
              '"REJECTED"'::jsonb
            ),
            updated_at = NOW()
        WHERE id = $1;
      `, [orderId]);

      return { success: true };
    });
  }

  /**
   * Partner action: Assign delivery rider and dispatch order
   */
  static async dispatchOrder(
    orderId: string,
    riderId: string,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; error?: string }> {
    return dbTransaction(async (client) => {
      const orderRes = await client.query(`
        SELECT id, metadata FROM "order" WHERE id = $1 FOR UPDATE;
      `, [orderId]);

      if (orderRes.rows.length === 0) return { success: false, error: "Order not found" };
      const order = orderRes.rows[0];
      const partnerId = order.metadata?.partner_id;

      const denied = actorMayActOnPartnerOrder(actor, partnerId);
      if (denied) return { success: false, error: denied };

      // Validate rider in delivery_partner
      const riderRes = await client.query(`
        SELECT id, first_name, last_name, phone FROM delivery_partner
        WHERE id = $1 AND deleted_at IS NULL LIMIT 1;
      `, [riderId]);

      if (riderRes.rows.length === 0) {
        return { success: false, error: `Delivery partner rider '${riderId}' not found or inactive.` };
      }
      const rider = riderRes.rows[0];

      // Update metadata with assigned rider and dispatch timestamp
      await client.query(`
        UPDATE "order"
        SET metadata = jsonb_set(
              jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{partner_order_status}',
                '"DISPATCHED"'::jsonb
              ),
              '{assigned_rider}',
              $2::jsonb
            ),
            updated_at = NOW()
        WHERE id = $1;
      `, [orderId, JSON.stringify({ id: rider.id, name: `${rider.first_name || ""} ${rider.last_name || ""}`.trim(), phone: rider.phone, assigned_at: new Date().toISOString() })]);

      // Use authoritative OrderRepository to advance delivery status
      await OrderRepository.updateStatus(orderId, "out_for_delivery", `Dispatched by partner (${actor.userId}) with rider ${rider.id}`);

      return { success: true };
    });
  }

  /**
   * Partner action: Deliver & fulfill order
   */
  static async deliverOrder(
    orderId: string,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; error?: string }> {
    const orderRes = await dbQuery(`
      SELECT id, metadata FROM "order" WHERE id = $1;
    `, [orderId]);

    if (!orderRes.rows || orderRes.rows.length === 0) return { success: false, error: "Order not found" };
    const order = orderRes.rows[0];
    const partnerId = order.metadata?.partner_id;

    const denied = actorMayActOnPartnerOrder(actor, partnerId);
    if (denied) return { success: false, error: denied };

    // Authoritative status advance to 'delivered': decrements physical stock and marks reservation fulfilled
    await OrderRepository.updateStatus(orderId, "delivered", `Order delivered and fulfilled by partner (${actor.userId})`);

    await dbQuery(`
      UPDATE "order"
      SET metadata = jsonb_set(
            COALESCE(metadata, '{}'::jsonb),
            '{partner_order_status}',
            '"DELIVERED"'::jsonb
          ),
          updated_at = NOW()
      WHERE id = $1;
    `, [orderId]);

    return { success: true };
  }

  /**
   * Customer / Operations action: File complaint on partner order
   */
  static async createComplaint(
    input: {
      order_id: string;
      category: string;
      description: string;
      customer_id?: string;
    },
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; complaint?: MarketplaceComplaintRow; error?: string }> {
    const orderRes = await dbQuery(`
      SELECT id, metadata, customer_id FROM "order" WHERE id = $1;
    `, [input.order_id]);

    if (!orderRes.rows || orderRes.rows.length === 0) {
      return { success: false, error: "Order not found." };
    }
    const order = orderRes.rows[0];
    const partnerId = order.metadata?.partner_id;
    if (!partnerId) {
      return { success: false, error: "This order is not associated with a commercial marketplace partner." };
    }

    const complaint = await MarketplacePartnerRepository.createComplaint({
      order_id: input.order_id,
      partner_id: partnerId,
      customer_id: input.customer_id || order.customer_id || actor.userId,
      category: input.category,
      description: input.description,
    });

    return { success: true, complaint };
  }

  /**
   * Partner / Admin action: Respond to or resolve complaint (tenant isolated)
   */
  static async respondToComplaint(
    complaintId: string,
    updates: {
      response?: string;
      resolution?: string;
      status?: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
    },
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; complaint?: MarketplaceComplaintRow; error?: string }> {
    const complaint = await MarketplacePartnerRepository.findComplaintById(complaintId);
    if (!complaint) {
      return { success: false, error: "Complaint not found." };
    }

    if (actor.role === "PARTNER_ADMIN" || actor.role === "PARTNER_OWNER") {
      if (actor.partnerId !== complaint.partner_id) {
        return { success: false, error: "UNAUTHORIZED: Cannot access complaints belonging to another partner." };
      }
    }

    const updated = await MarketplacePartnerRepository.updateComplaint(complaintId, {
      partner_response: updates.response,
      resolution: updates.resolution,
      status: updates.status,
    });

    return { success: true, complaint: updated };
  }
}

