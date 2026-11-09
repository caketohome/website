/**
 * Marketplace Partner Domain Service
 * Partner onboarding, store management, commercial agreement governance, and catalog visibility.
 */

import { MarketplacePartnerRepository, MarketplacePartnerRow, MarketplaceStoreRow, MarketplaceAgreementRow } from "../repositories/marketplace-partner.repository";
import type { AuthenticatedActor } from "./feature-flag.service";

export interface OnboardPartnerInput {
  code: string;
  legal_name: string;
  trade_name: string;
  gstin?: string;
  pan?: string;
  contact_name: string;
  email: string;
  phone: string;
  address: any;
  city_id?: string;
  state_code?: string;
  bank_details?: any;
}

export class MarketplacePartnerService {
  /**
   * Onboard new commercial marketplace partner
   */
  static async onboardPartner(
    input: OnboardPartnerInput,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; partner?: MarketplacePartnerRow; error?: string }> {
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
      return { success: false, error: "UNAUTHORIZED: Only administrators can onboard marketplace partners." };
    }

    const existingEmail = await MarketplacePartnerRepository.findPartnerById(input.email);
    if (existingEmail) {
      return { success: false, error: `Email '${input.email}' is already registered.` };
    }

    const existingCode = await MarketplacePartnerRepository.findPartnerById(input.code);
    if (existingCode) {
      return { success: false, error: `Partner code '${input.code}' is already registered.` };
    }

    const partnerId = `mkt_part_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const saved = await MarketplacePartnerRepository.savePartner({
      id: partnerId,
      code: input.code.toUpperCase().trim(),
      legal_name: input.legal_name.trim(),
      trade_name: input.trade_name.trim(),
      gstin: input.gstin?.toUpperCase().trim() || null,
      pan: input.pan?.toUpperCase().trim() || null,
      status: "APPROVED",
      contact_name: input.contact_name.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone.trim(),
      address: input.address,
      city_id: input.city_id || null,
      state_code: input.state_code || "29",
      bank_details: input.bank_details || null,
    });

    return { success: true, partner: saved };
  }

  /**
   * List partners with tenant isolation: Partners can only view themselves
   */
  static async listPartners(actor: AuthenticatedActor, filters: any = {}): Promise<MarketplacePartnerRow[]> {
    if (actor.role === "PARTNER_ADMIN" || actor.role === "PARTNER_OWNER") {
      if (!actor.partnerId) return [];
      const single = await MarketplacePartnerRepository.findPartnerById(actor.partnerId);
      return single ? [single] : [];
    }

    return MarketplacePartnerRepository.listPartners(filters);
  }

  /**
   * Get partner details with tenant guard
   */
  static async getPartner(partnerId: string, actor: AuthenticatedActor): Promise<MarketplacePartnerRow | null> {
    if (actor.role === "PARTNER_ADMIN" || actor.role === "PARTNER_OWNER") {
      if (actor.partnerId !== partnerId) {
        throw new Error("UNAUTHORIZED_ACCESS: Cannot access another partner's records.");
      }
    }
    return MarketplacePartnerRepository.findPartnerById(partnerId);
  }

  /**
   * Create or update partner store outlet
   */
  static async saveStore(
    input: {
      id?: string;
      partner_id: string;
      name: string;
      code: string;
      is_open?: boolean;
      address: string;
      latitude: number;
      longitude: number;
      service_radius_km?: number;
    },
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; store?: MarketplaceStoreRow; error?: string }> {
    if (actor.role === "PARTNER_ADMIN" || actor.role === "PARTNER_OWNER") {
      if (actor.partnerId !== input.partner_id) {
        return { success: false, error: "UNAUTHORIZED: Cannot manage stores for another partner." };
      }
    }

    const storeId = input.id || `mkt_store_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const saved = await MarketplacePartnerRepository.saveStore({
      id: storeId,
      partner_id: input.partner_id,
      name: input.name,
      code: input.code.toUpperCase().trim(),
      is_open: input.is_open !== false,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      service_radius_km: input.service_radius_km || 10.0,
    });

    return { success: true, store: saved };
  }

  /**
   * Configure commercial agreement
   */
  static async saveAgreement(
    input: {
      id?: string;
      partner_id: string;
      agreement_type: "COMMISSION_PERCENTAGE" | "FIXED_PER_ORDER" | "WHOLESALE_TRANSFER" | "HYBRID";
      commission_rate?: number;
      fixed_fee_per_order?: number;
      delivery_subsidy_rate?: number;
      effective_from: string;
      effective_to?: string | null;
      status?: "DRAFT" | "ACTIVE" | "EXPIRED" | "SUPERSEDED";
      terms_document_ref?: string | null;
    },
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; agreement?: MarketplaceAgreementRow; error?: string }> {
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
      return { success: false, error: "UNAUTHORIZED: Only platform administrators can configure partner commercial agreements." };
    }

    const agreementId = input.id || `agr_${input.partner_id}_${Date.now()}`;
    const saved = await MarketplacePartnerRepository.saveAgreement({
      id: agreementId,
      partner_id: input.partner_id,
      agreement_type: input.agreement_type,
      commission_rate: input.commission_rate || 0,
      fixed_fee_per_order: input.fixed_fee_per_order || 0,
      delivery_subsidy_rate: input.delivery_subsidy_rate || 0,
      effective_from: input.effective_from,
      effective_to: input.effective_to || null,
      status: input.status || "ACTIVE",
      terms_document_ref: input.terms_document_ref || null,
    });

    return { success: true, agreement: saved };
  }
}
