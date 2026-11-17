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
  fssai_number?: string;
  contact_name: string;
  email: string;
  phone: string;
  address: any;
  city_id?: string;
  state_code?: string;
  bank_details?: { account_name?: string; account_number?: string; ifsc?: string; bank_name?: string } | null;
}

import { GSTIN_RE, partnerKycIssues } from "../marketplace/partner-kyc";
export { partnerKycIssues };

export class MarketplacePartnerService {
  /**
   * Onboard a new marketplace partner. Partners start PENDING_APPROVAL and cannot receive orders
   * until approvePartner() verifies KYC and an active commercial agreement.
   */
  static async onboardPartner(
    input: OnboardPartnerInput,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; partner?: MarketplacePartnerRow; kyc_issues?: string[]; error?: string }> {
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
      return { success: false, error: "UNAUTHORIZED: Only administrators can onboard marketplace partners." };
    }
    if (!input.code?.trim() || !input.legal_name?.trim() || !input.trade_name?.trim() || !input.email?.trim() || !input.phone?.trim()) {
      return { success: false, error: "Code, legal name, trade name, email and phone are required." };
    }

    const existingEmail = await MarketplacePartnerRepository.findPartnerById(input.email);
    if (existingEmail) {
      return { success: false, error: `Email '${input.email}' is already registered.` };
    }

    const existingCode = await MarketplacePartnerRepository.findPartnerById(input.code);
    if (existingCode) {
      return { success: false, error: `Partner code '${input.code}' is already registered.` };
    }

    const gstin = input.gstin?.toUpperCase().trim() || null;
    if (gstin && !GSTIN_RE.test(gstin)) {
      return { success: false, error: `GSTIN '${gstin}' is not a valid 15-character GSTIN.` };
    }
    const bank = input.bank_details
      ? { ...input.bank_details, ifsc: input.bank_details.ifsc?.toUpperCase().trim() }
      : null;

    const partnerId = `mkt_part_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const saved = await MarketplacePartnerRepository.savePartner({
      id: partnerId,
      code: input.code.toUpperCase().trim(),
      legal_name: input.legal_name.trim(),
      trade_name: input.trade_name.trim(),
      gstin,
      pan: input.pan?.toUpperCase().trim() || null,
      status: "PENDING_APPROVAL",
      contact_name: (input.contact_name || input.legal_name).trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone.trim(),
      address: input.address,
      city_id: input.city_id || null,
      // State comes from the GSTIN (first 2 digits), never a hardcoded default.
      state_code: gstin ? gstin.slice(0, 2) : (input.state_code || ""),
      bank_details: bank,
      metadata: { fssai_number: input.fssai_number?.trim() || null },
    });

    return { success: true, partner: saved, kyc_issues: partnerKycIssues(saved) };
  }

  /**
   * Approve a partner after KYC and agreement checks. Creates (once) a linked supplier record so partner
   * payouts flow through Bills Payable, the supplier ledger and the TDS register.
   */
  static async approvePartner(
    partnerId: string,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; partner?: MarketplacePartnerRow; error?: string; kyc_issues?: string[] }> {
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
      return { success: false, error: "UNAUTHORIZED: Only administrators can approve marketplace partners." };
    }
    const partner = await MarketplacePartnerRepository.findPartnerById(partnerId);
    if (!partner) return { success: false, error: "Partner not found." };

    const issues = partnerKycIssues(partner);
    const agreement = await MarketplacePartnerRepository.getActiveAgreement(partner.id);
    if (!agreement) issues.push("An ACTIVE commercial agreement (commission terms) is required before approval.");
    if (issues.length > 0) {
      return { success: false, error: `Cannot approve: ${issues.join(" ")}`, kyc_issues: issues };
    }

    const supplierId = await MarketplacePartnerRepository.ensureLinkedSupplier(partner, actor.userId);
    const saved = await MarketplacePartnerRepository.savePartner({
      ...partner,
      status: "APPROVED",
      agreement_id: agreement!.id,
      metadata: {
        ...(partner.metadata || {}),
        supplier_id: supplierId,
        approved_by: actor.userId,
        approved_at: new Date().toISOString(),
      },
    });
    return { success: true, partner: saved };
  }

  /** Suspend or reactivate a partner. Suspended partners receive no new orders. */
  static async setPartnerStatus(
    partnerId: string,
    status: "SUSPENDED" | "APPROVED",
    reason: string | undefined,
    actor: AuthenticatedActor
  ): Promise<{ success: boolean; partner?: MarketplacePartnerRow; error?: string }> {
    if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") {
      return { success: false, error: "UNAUTHORIZED: Only administrators can change partner status." };
    }
    const partner = await MarketplacePartnerRepository.findPartnerById(partnerId);
    if (!partner) return { success: false, error: "Partner not found." };
    if (status === "APPROVED" && partner.status !== "SUSPENDED") {
      return { success: false, error: "Only a suspended partner can be reactivated; use approve for new partners." };
    }
    const saved = await MarketplacePartnerRepository.savePartner({
      ...partner,
      status,
      metadata: { ...(partner.metadata || {}), status_reason: reason || null, status_changed_by: actor.userId, status_changed_at: new Date().toISOString() },
    });
    return { success: true, partner: saved };
  }

  /** Orders may only be routed to approved partners. */
  static isPartnerOrderable(partner: MarketplacePartnerRow | null): boolean {
    return Boolean(partner && (partner.status === "APPROVED" || partner.status === "ACTIVE"));
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
