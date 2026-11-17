/**
 * Marketplace Partner Repository
 * Database-backed persistence for commercial partners, stores, agreements, and complaints.
 */

import { dbQuery } from "../db";

export interface MarketplacePartnerRow {
  id: string;
  code: string;
  legal_name: string;
  trade_name: string;
  gstin: string | null;
  pan: string | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "TERMINATED";
  contact_name: string;
  email: string;
  phone: string;
  address: any;
  city_id: string | null;
  state_code: string;
  bank_details: any;
  agreement_id: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceStoreRow {
  id: string;
  partner_id: string;
  name: string;
  code: string;
  is_open: boolean;
  address: string;
  latitude: number;
  longitude: number;
  service_radius_km: number;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceAgreementRow {
  id: string;
  partner_id: string;
  agreement_type: "COMMISSION_PERCENTAGE" | "FIXED_PER_ORDER" | "WHOLESALE_TRANSFER" | "HYBRID";
  commission_rate: number;
  fixed_fee_per_order: number;
  delivery_subsidy_rate: number;
  effective_from: string;
  effective_to: string | null;
  status: "DRAFT" | "ACTIVE" | "EXPIRED" | "SUPERSEDED";
  terms_document_ref: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceOrderSnapshotRow {
  id: string;
  order_id: string;
  partner_id: string;
  store_id: string;
  agreement_id: string;
  agreement_type: string;
  commission_rate: number;
  fixed_fee: number;
  gross_order_amount: number;
  tax_amount: number;
  commission_amount: number;
  partner_net_receivable: number;
  snapshot_data: any;
  created_at: string;
}

export interface MarketplaceComplaintRow {
  id: string;
  order_id: string;
  partner_id: string;
  customer_id: string;
  category: string;
  description: string;
  status: "OPEN" | "INVESTIGATING" | "ESCALATED_TO_PARTNER" | "RESOLVED" | "CLOSED";
  resolution: string | null;
  partner_response: string | null;
  created_at: string;
  updated_at: string;
}

export class MarketplacePartnerRepository {
  /**
   * List commercial marketplace partners
   */
  static async listPartners(filters: { status?: string; search?: string; limit?: number; offset?: number } = {}): Promise<MarketplacePartnerRow[]> {
    const params: any[] = [];
    let sql = `
      SELECT id, code, legal_name, trade_name, gstin, pan, status, contact_name, email, phone,
             address, city_id, state_code, bank_details, agreement_id, metadata, created_at, updated_at
      FROM "marketplace_partner"
      WHERE deleted_at IS NULL
    `;

    if (filters.status) {
      params.push(filters.status.toUpperCase());
      sql += ` AND status = $${params.length}`;
    }
    if (filters.search) {
      params.push(`%${filters.search}%`);
      sql += ` AND (legal_name ILIKE $${params.length} OR trade_name ILIKE $${params.length} OR code ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    sql += ` ORDER BY trade_name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Math.min(filters.limit || 50, 100), Math.max(0, filters.offset || 0));

    const res = await dbQuery(sql, params);
    return res.rows || [];
  }

  /**
   * Find partner by ID or email
   */
  static async findPartnerById(idOrEmail: string): Promise<MarketplacePartnerRow | null> {
    const res = await dbQuery(`
      SELECT id, code, legal_name, trade_name, gstin, pan, status, contact_name, email, phone,
             address, city_id, state_code, bank_details, agreement_id, metadata, created_at, updated_at
      FROM "marketplace_partner"
      WHERE (id = $1 OR email = $1 OR code = $1) AND deleted_at IS NULL
      LIMIT 1;
    `, [idOrEmail]);

    return res.rows && res.rows.length > 0 ? res.rows[0] : null;
  }

  /**
   * Create or update partner
   */
  static async savePartner(partner: Partial<MarketplacePartnerRow> & { id: string; code: string; legal_name: string; trade_name: string; email: string; phone: string; address: any }): Promise<MarketplacePartnerRow> {
    const res = await dbQuery(`
      INSERT INTO "marketplace_partner" (
        id, code, legal_name, trade_name, gstin, pan, status, contact_name, email, phone, address, city_id, state_code, bank_details, agreement_id, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        legal_name = EXCLUDED.legal_name,
        trade_name = EXCLUDED.trade_name,
        gstin = EXCLUDED.gstin,
        pan = EXCLUDED.pan,
        status = EXCLUDED.status,
        contact_name = EXCLUDED.contact_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        city_id = EXCLUDED.city_id,
        state_code = EXCLUDED.state_code,
        bank_details = EXCLUDED.bank_details,
        agreement_id = EXCLUDED.agreement_id,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *;
    `, [
      partner.id,
      partner.code,
      partner.legal_name,
      partner.trade_name,
      partner.gstin || null,
      partner.pan || null,
      partner.status || "PENDING_APPROVAL",
      partner.contact_name || partner.legal_name,
      partner.email,
      partner.phone,
      JSON.stringify(partner.address),
      partner.city_id || null,
      partner.state_code || (partner.gstin ? partner.gstin.slice(0, 2) : ""),
      partner.bank_details ? JSON.stringify(partner.bank_details) : null,
      partner.agreement_id || null,
      partner.metadata ? JSON.stringify(partner.metadata) : null,
    ]);

    return res.rows[0];
  }

  /**
   * Create (once) the supplier record that represents this partner in Bills Payable / supplier ledger / TDS.
   * Returns the supplier id; idempotent via partner.metadata.supplier_id and supplier.metadata.marketplace_partner_id.
   */
  static async ensureLinkedSupplier(partner: MarketplacePartnerRow, createdBy: string): Promise<string> {
    if (partner.metadata?.supplier_id) return partner.metadata.supplier_id;
    const existing = await dbQuery(
      `SELECT id FROM "supplier" WHERE metadata->>'marketplace_partner_id' = $1 AND deleted_at IS NULL LIMIT 1`,
      [partner.id]
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
    const supplierId = `sup_mkt_${partner.code.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now().toString(36)}`;
    const addr = partner.address || {};
    await dbQuery(
      `INSERT INTO "supplier" (id, name, gstin, phone, email, address, city, state, is_active, created_by, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, NOW(), NOW())`,
      [
        supplierId,
        partner.legal_name,
        partner.gstin,
        partner.phone,
        partner.email,
        typeof addr === "string" ? addr : [addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(", "),
        typeof addr === "object" ? addr.city || null : null,
        partner.state_code || null,
        createdBy || "system",
        JSON.stringify({ marketplace_partner_id: partner.id, pan: partner.pan, kind: "MARKETPLACE_PARTNER" }),
      ]
    );
    return supplierId;
  }

  /**
   * List partner stores (Tenant isolated by partnerId)
   */
  static async listStores(partnerId?: string): Promise<MarketplaceStoreRow[]> {
    let sql = `
      SELECT id, partner_id, name, code, is_open, address, latitude, longitude, service_radius_km, metadata, created_at, updated_at
      FROM "marketplace_store"
      WHERE deleted_at IS NULL
    `;
    const params: any[] = [];
    if (partnerId) {
      params.push(partnerId);
      sql += ` AND partner_id = $1`;
    }
    sql += ` ORDER BY name ASC;`;

    const res = await dbQuery(sql, params);
    return (res.rows || []).map(r => ({
      ...r,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      service_radius_km: Number(r.service_radius_km),
    }));
  }

  /**
   * Save store
   */
  static async saveStore(store: {
    id: string;
    partner_id: string;
    name: string;
    code: string;
    is_open: boolean;
    address: string;
    latitude: number;
    longitude: number;
    service_radius_km?: number;
    metadata?: any;
  }): Promise<MarketplaceStoreRow> {
    const res = await dbQuery(`
      INSERT INTO "marketplace_store" (
        id, partner_id, name, code, is_open, address, latitude, longitude, service_radius_km, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        is_open = EXCLUDED.is_open,
        address = EXCLUDED.address,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        service_radius_km = EXCLUDED.service_radius_km,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *;
    `, [
      store.id,
      store.partner_id,
      store.name,
      store.code,
      store.is_open,
      store.address,
      store.latitude,
      store.longitude,
      store.service_radius_km || 10.0,
      store.metadata ? JSON.stringify(store.metadata) : null,
    ]);

    return res.rows[0];
  }

  /**
   * Get active agreement for partner
   */
  static async getActiveAgreement(partnerId: string): Promise<MarketplaceAgreementRow | null> {
    const res = await dbQuery(`
      SELECT id, partner_id, agreement_type, commission_rate, fixed_fee_per_order, delivery_subsidy_rate,
             effective_from::text, effective_to::text, status, terms_document_ref, created_at, updated_at
      FROM "marketplace_agreement"
      WHERE partner_id = $1 AND status = 'ACTIVE'
        AND effective_from <= CURRENT_DATE
        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      ORDER BY created_at DESC LIMIT 1;
    `, [partnerId]);

    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      commission_rate: Number(r.commission_rate),
      fixed_fee_per_order: Number(r.fixed_fee_per_order),
      delivery_subsidy_rate: Number(r.delivery_subsidy_rate),
    };
  }

  /**
   * Save agreement
   */
  static async saveAgreement(agreement: {
    id: string;
    partner_id: string;
    agreement_type: "COMMISSION_PERCENTAGE" | "FIXED_PER_ORDER" | "WHOLESALE_TRANSFER" | "HYBRID";
    commission_rate?: number;
    fixed_fee_per_order?: number;
    delivery_subsidy_rate?: number;
    effective_from: string;
    effective_to?: string | null;
    status: "DRAFT" | "ACTIVE" | "EXPIRED" | "SUPERSEDED";
    terms_document_ref?: string | null;
  }): Promise<MarketplaceAgreementRow> {
    const res = await dbQuery(`
      INSERT INTO "marketplace_agreement" (
        id, partner_id, agreement_type, commission_rate, fixed_fee_per_order, delivery_subsidy_rate,
        effective_from, effective_to, status, terms_document_ref, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        agreement_type = EXCLUDED.agreement_type,
        commission_rate = EXCLUDED.commission_rate,
        fixed_fee_per_order = EXCLUDED.fixed_fee_per_order,
        delivery_subsidy_rate = EXCLUDED.delivery_subsidy_rate,
        effective_from = EXCLUDED.effective_from,
        effective_to = EXCLUDED.effective_to,
        status = EXCLUDED.status,
        terms_document_ref = EXCLUDED.terms_document_ref,
        updated_at = NOW()
      RETURNING id, partner_id, agreement_type, commission_rate, fixed_fee_per_order, delivery_subsidy_rate,
                effective_from::text, effective_to::text, status, terms_document_ref, created_at, updated_at;
    `, [
      agreement.id,
      agreement.partner_id,
      agreement.agreement_type,
      agreement.commission_rate || 0,
      agreement.fixed_fee_per_order || 0,
      agreement.delivery_subsidy_rate || 0,
      agreement.effective_from,
      agreement.effective_to || null,
      agreement.status,
      agreement.terms_document_ref || null,
    ]);

    const r = res.rows[0];
    return {
      ...r,
      commission_rate: Number(r.commission_rate),
      fixed_fee_per_order: Number(r.fixed_fee_per_order),
      delivery_subsidy_rate: Number(r.delivery_subsidy_rate),
    };
  }

  /**
   * Save order agreement snapshot
   */
  static async saveOrderSnapshot(snapshot: MarketplaceOrderSnapshotRow): Promise<void> {
    await dbQuery(`
      INSERT INTO "marketplace_order_snapshot" (
        id, order_id, partner_id, store_id, agreement_id, agreement_type,
        commission_rate, fixed_fee, gross_order_amount, tax_amount,
        commission_amount, partner_net_receivable, snapshot_data, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      ON CONFLICT (order_id) DO NOTHING;
    `, [
      snapshot.id,
      snapshot.order_id,
      snapshot.partner_id,
      snapshot.store_id,
      snapshot.agreement_id,
      snapshot.agreement_type,
      snapshot.commission_rate,
      snapshot.fixed_fee,
      snapshot.gross_order_amount,
      snapshot.tax_amount,
      snapshot.commission_amount,
      snapshot.partner_net_receivable,
      JSON.stringify(snapshot.snapshot_data),
    ]);
  }

  /**
   * Find order snapshot
   */
  static async findOrderSnapshot(orderId: string): Promise<MarketplaceOrderSnapshotRow | null> {
    const res = await dbQuery(`
      SELECT id, order_id, partner_id, store_id, agreement_id, agreement_type,
             commission_rate, fixed_fee, gross_order_amount, tax_amount,
             commission_amount, partner_net_receivable, snapshot_data, created_at
      FROM "marketplace_order_snapshot"
      WHERE order_id = $1
      LIMIT 1;
    `, [orderId]);

    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      ...r,
      commission_rate: Number(r.commission_rate),
      fixed_fee: Number(r.fixed_fee),
      gross_order_amount: Number(r.gross_order_amount),
      tax_amount: Number(r.tax_amount),
      commission_amount: Number(r.commission_amount),
      partner_net_receivable: Number(r.partner_net_receivable),
    };
  }

  /**
   * Complaints (tenant isolated)
   */
  static async listComplaints(partnerId?: string): Promise<MarketplaceComplaintRow[]> {
    let sql = `
      SELECT id, order_id, partner_id, customer_id, category, description, status, resolution, partner_response, created_at, updated_at
      FROM "marketplace_complaint"
    `;
    const params: any[] = [];
    if (partnerId) {
      params.push(partnerId);
      sql += ` WHERE partner_id = $1`;
    }
    sql += ` ORDER BY created_at DESC;`;

    const res = await dbQuery(sql, params);
    return res.rows || [];
  }

  static async findComplaintById(id: string): Promise<MarketplaceComplaintRow | null> {
    const res = await dbQuery(
      `SELECT id, order_id, partner_id, customer_id, category, description, status, resolution, partner_response, created_at, updated_at
       FROM "marketplace_complaint"
       WHERE id = $1 LIMIT 1;`,
      [id]
    );
    return res.rows && res.rows.length > 0 ? res.rows[0] : null;
  }

  static async createComplaint(input: {
    order_id: string;
    partner_id: string;
    customer_id?: string;
    category: string;
    description: string;
  }): Promise<MarketplaceComplaintRow> {
    const id = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const res = await dbQuery(
      `INSERT INTO "marketplace_complaint" (
        id, order_id, partner_id, customer_id, category, description, status, resolution, partner_response, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', NULL, NULL, NOW(), NOW())
      RETURNING *;`,
      [id, input.order_id, input.partner_id, input.customer_id || null, input.category, input.description]
    );
    return res.rows[0];
  }

  static async updateComplaint(
    id: string,
    updates: {
      status?: string;
      resolution?: string;
      partner_response?: string;
    }
  ): Promise<MarketplaceComplaintRow> {
    const sets: string[] = ["updated_at = NOW()"];
    const params: any[] = [id];
    let idx = 2;

    if (updates.status !== undefined) {
      sets.push(`status = $${idx++}`);
      params.push(updates.status);
    }
    if (updates.resolution !== undefined) {
      sets.push(`resolution = $${idx++}`);
      params.push(updates.resolution);
    }
    if (updates.partner_response !== undefined) {
      sets.push(`partner_response = $${idx++}`);
      params.push(updates.partner_response);
    }

    const res = await dbQuery(
      `UPDATE "marketplace_complaint"
       SET ${sets.join(", ")}
       WHERE id = $1
       RETURNING *;`,
      params
    );
    return res.rows[0];
  }
}

