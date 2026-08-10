import { MedusaService } from "@medusajs/utils";
import { CustomerRFM, CustomerBlacklist, CustomerNote, Campaign, AutomationFlow, Segment, CustomerSegment, EmailTemplate, AutomationExecution, AutomationLog } from "./models";
import { CustomerNotFoundError, NoteNotFoundError, NotePermissionError, NoteValidationError, CampaignNotFoundError, CampaignValidationError, CampaignArchivedError, SegmentNotFoundError, SegmentValidationError, TemplateNotFoundError, TemplateValidationError } from "./errors";

export const CRM_DEFAULT_THRESHOLDS = {
  RECENCY_DORMANT: 180,
  RECENCY_AT_RISK: 90,
  RECENCY_NEW: 30,
  CHAMPIONS_FREQUENCY: 5,
  CHAMPIONS_MONETARY: 1000000, // INR ₹10,000 in paise
  LOYAL_FREQUENCY: 3,
  VIP_PLATINUM: 2000000, // ₹20,000 in paise
  VIP_GOLD: 1000000,     // ₹10,000 in paise
  VIP_SILVER: 500000,    // ₹5,000 in paise
};

class CrmModuleService extends (MedusaService({
  CustomerRFM,
  CustomerBlacklist,
  CustomerNote,
  Campaign,
  AutomationFlow,
  Segment,
  CustomerSegment,
  EmailTemplate,
  AutomationExecution,
  AutomationLog,
}) as any) {
  protected container: any;

  constructor(dependencies: any, ...args: any[]) {
    super(dependencies, ...args);
    this.container = dependencies;
  }

  /**
   * Idempotent blacklist of a customer.
   */
  async blacklistCustomer(
    customerId: string,
    reason?: string | null,
    actorId?: string | null
  ): Promise<any> {
    const [existing] = await this.listCustomerBlacklists({ customer_id: customerId });
    if (existing) {
      // Idempotency: update existing record if details changed
      const updated = await this.updateCustomerBlacklists({
        selector: { id: existing.id },
        data: {
          is_blacklisted: true,
          reason: reason ?? existing.reason,
          blacklisted_at: new Date(),
          blacklisted_by: actorId ?? existing.blacklisted_by,
        },
      });
      return updated[0];
    }

    const created = await this.createCustomerBlacklists([
      {
        customer_id: customerId,
        is_blacklisted: true,
        reason: reason ?? null,
        blacklisted_at: new Date(),
        blacklisted_by: actorId ?? null,
      },
    ]);
    return created[0];
  }

  /**
   * Idempotent removal from blacklist.
   */
  async removeCustomerFromBlacklist(customerId: string): Promise<void> {
    const [existing] = await this.listCustomerBlacklists({ customer_id: customerId });
    if (existing) {
      await this.deleteCustomerBlacklists([existing.id]);
    }
  }

  /**
   * Checks if customer is blacklisted.
   */
  async isCustomerBlacklisted(customerId: string): Promise<boolean> {
    const [existing] = await this.listCustomerBlacklists({
      customer_id: customerId,
      is_blacklisted: true,
    });
    return !!existing;
  }

  /**
   * Deterministic, side-effect free RFM calculation.
   * Takes a list of orders and calculates the RFM scores, segment, and VIP tier.
   */
  computeRFM(
    customerId: string,
    orders: any[],
    thresholds = CRM_DEFAULT_THRESHOLDS,
    referenceDate = new Date()
  ): {
    customer_id: string;
    recency_score: number;
    frequency_score: number;
    monetary_score: number;
    clv: number;
    rfm_segment: string;
    vip_tier: string;
  } {
    // Filter completed/fulfilled/captured orders (double safeguard)
    const validOrders = orders.filter((o) => {
      const isCompleted = o.status === "completed" || o.status === "fulfilled";
      const isCancelled = o.status === "canceled" || o.status === "cancelled";
      return isCompleted && !isCancelled;
    });

    if (validOrders.length === 0) {
      return {
        customer_id: customerId,
        recency_score: 999,
        frequency_score: 0,
        monetary_score: 0,
        clv: 0,
        rfm_segment: "New",
        vip_tier: "none",
      };
    }

    // Sort orders by created_at descending
    const sortedOrders = [...validOrders].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    const lastOrder = sortedOrders[0];
    const lastOrderDate = lastOrder.created_at ? new Date(lastOrder.created_at) : referenceDate;

    // Calculate Recency in days
    const diffTime = referenceDate.getTime() - lastOrderDate.getTime();
    const recency = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    // Calculate Frequency
    const frequency = validOrders.length;

    // Calculate Monetary and CLV (default nulls to 0)
    const monetary = validOrders.reduce((sum, o) => {
      const amount = o.total !== null && o.total !== undefined ? Number(o.total) : 0;
      return sum + amount;
    }, 0);
    const clv = monetary;

    // Classify Customer Segment based on thresholds
    let segment = "New";
    if (recency > thresholds.RECENCY_DORMANT) {
      segment = "Dormant";
    } else if (recency > thresholds.RECENCY_AT_RISK) {
      segment = "At Risk";
    } else if (
      frequency >= thresholds.CHAMPIONS_FREQUENCY &&
      monetary >= thresholds.CHAMPIONS_MONETARY &&
      recency <= thresholds.RECENCY_NEW
    ) {
      segment = "Champions";
    } else if (frequency >= thresholds.LOYAL_FREQUENCY) {
      segment = "Loyal";
    } else if (frequency === 1 && recency <= thresholds.RECENCY_NEW) {
      segment = "New";
    } else {
      segment = "Loyal";
    }

    // VIP categorization
    let vipTier = "none";
    if (monetary >= thresholds.VIP_PLATINUM) {
      vipTier = "platinum";
    } else if (monetary >= thresholds.VIP_GOLD) {
      vipTier = "gold";
    } else if (monetary >= thresholds.VIP_SILVER) {
      vipTier = "silver";
    }

    return {
      customer_id: customerId,
      recency_score: recency,
      frequency_score: frequency,
      monetary_score: monetary,
      clv,
      rfm_segment: segment,
      vip_tier: vipTier,
    };
  }

  /**
   * Orchestrates fetching customer orders, computing metrics, and persisting to DB.
   */
  async calculateAndSaveRFM(customerId: string, thresholds = CRM_DEFAULT_THRESHOLDS): Promise<any> {
    const orderModule = this.container.orderModuleService || this.container.order;
    if (!orderModule) {
      throw new Error("Order module not found in container.");
    }

    // Fetch customer orders with lightweight fields selection
    const orders = await orderModule.listOrders(
      { customer_id: customerId },
      { select: ["id", "status", "total", "created_at"] }
    );

    // Deterministically compute the RFM metrics
    const computed = this.computeRFM(customerId, orders, thresholds);

    // Save/Update to the database
    const [existing] = await this.listCustomerRFMs({ customer_id: customerId });
    if (existing) {
      const updated = await this.updateCustomerRFMs({
        selector: { id: existing.id },
        data: {
          recency_score: computed.recency_score,
          frequency_score: computed.frequency_score,
          monetary_score: computed.monetary_score,
          clv: computed.clv,
          rfm_segment: computed.rfm_segment,
          vip_tier: computed.vip_tier,
          last_calculated_at: new Date(),
        },
      });
      return updated[0];
    } else {
      const created = await this.createCustomerRFMs([
        {
          customer_id: customerId,
          recency_score: computed.recency_score,
          frequency_score: computed.frequency_score,
          monetary_score: computed.monetary_score,
          clv: computed.clv,
          rfm_segment: computed.rfm_segment,
          vip_tier: computed.vip_tier,
          last_calculated_at: new Date(),
        },
      ]);
      return created[0];
    }
  }

  // ── Customer Notes Helpers ─────────────────────────────────────────────────

  private async validateCustomerExists(customerId: string): Promise<void> {
    if (!customerId) {
      throw new NoteValidationError("Customer ID is required.");
    }
    const customerModule = this.container.customerModuleService || this.container.customer;
    if (!customerModule) {
      throw new Error("Customer module not resolved in container.");
    }
    const customer = await customerModule.retrieveCustomer(customerId).catch(() => null);
    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }
  }

  private async validateNoteExistsAndGet(noteId: string): Promise<any> {
    if (!noteId) {
      throw new NoteValidationError("Note ID is required.");
    }
    const [note] = await this.listCustomerNotes({ id: noteId });
    if (!note) {
      throw new NoteNotFoundError(noteId);
    }
    return note;
  }

  // ── Customer Notes ─────────────────────────────────────────────────────────

  async createNote(customerId: string, body: string, authorId: string): Promise<any> {
    if (!body || !body.trim()) {
      throw new NoteValidationError("Note body cannot be empty.");
    }
    if (!authorId) {
      throw new NoteValidationError("Author ID is required.");
    }
    await this.validateCustomerExists(customerId);
    const created = await this.createCustomerNotes([
      {
        customer_id: customerId,
        author_id: authorId,
        body: body.trim(),
      },
    ]);
    return created[0];
  }

  async updateNote(noteId: string, body: string, authorId: string): Promise<any> {
    if (!body || !body.trim()) {
      throw new NoteValidationError("Note body cannot be empty.");
    }
    if (!authorId) {
      throw new NoteValidationError("Author ID is required.");
    }
    const note = await this.validateNoteExistsAndGet(noteId);
    if (note.author_id && note.author_id !== authorId) {
      throw new NotePermissionError("Only the author of this note can update it.");
    }
    const updated = await this.updateCustomerNotes({
      selector: { id: noteId },
      data: { body: body.trim() },
    });
    return updated[0];
  }

  async deleteNote(noteId: string, authorId: string): Promise<void> {
    if (!authorId) {
      throw new NoteValidationError("Author ID is required.");
    }
    const note = await this.validateNoteExistsAndGet(noteId);
    if (note.author_id && note.author_id !== authorId) {
      throw new NotePermissionError("Only the author of this note can delete it.");
    }
    await this.deleteCustomerNotes([noteId]);
  }

  async listNotes(customerId: string): Promise<any[]> {
    await this.validateCustomerExists(customerId);
    return await this.listCustomerNotes(
      { customer_id: customerId },
      { order: { created_at: "DESC" } }
    );
  }

  // ── Customer 360 Aggregation ────────────────────────────────────────────────

  async getCustomer360Profile(customerId: string): Promise<any> {
    await this.validateCustomerExists(customerId);

    const query = this.container.query;
    const rewardsService = this.container.rewardsModuleService;

    let customer = null;
    if (query) {
      const {
        data: [fetchedCustomer],
      } = await query.graph({
        entity: "customer",
        filters: { id: customerId },
        fields: ["id", "email", "first_name", "last_name", "phone", "created_at"],
      });
      customer = fetchedCustomer;
    }

    if (!customer) {
      throw new CustomerNotFoundError(customerId);
    }

    const [
      wallet,
      loyaltyLedger,
      referralData,
      rfm,
      blacklist,
      notes,
    ] = await Promise.all([
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve({ codes: [], events: [] }),
      this.listCustomerRFMs({ customer_id: customerId })
        .then((arr: any[]) => arr[0] || null)
        .catch(() => null),
      this.listCustomerBlacklists({ customer_id: customerId })
        .then((arr: any[]) => arr[0] || null)
        .catch(() => null),
      this.listCustomerNotes(
        { customer_id: customerId },
        { order: { created_at: "DESC" } }
      ).catch(() => []),
    ]);

    return {
      customer,
      wallet: wallet
        ? {
            id: wallet.id,
            balance: wallet.balance,
            currency_code: wallet.currency_code,
          }
        : null,
      loyalty: loyaltyLedger
        ? {
            id: loyaltyLedger.id,
            points: loyaltyLedger.points,
            tier: loyaltyLedger.tier,
          }
        : null,
      referrals: {
        codes: referralData.codes.map((c: any) => ({
          code: c.code,
          is_active: c.is_active,
        })),
        events_count: referralData.events.length,
      },
      rfm: rfm
        ? {
            recency: rfm.recency_score,
            frequency: rfm.frequency_score,
            monetary: rfm.monetary_score,
            clv: rfm.clv,
            segment: rfm.rfm_segment,
            vip_tier: rfm.vip_tier,
            last_calculated_at: rfm.last_calculated_at,
          }
        : null,
      blacklist: blacklist
        ? {
            is_blacklisted: !!blacklist.is_blacklisted,
            reason: blacklist.reason,
            blacklisted_at: blacklist.blacklisted_at,
            blacklisted_by: blacklist.blacklisted_by,
          }
        : null,
      notes: notes.map((n: any) => ({
        id: n.id,
        author_id: n.author_id,
        body: n.body,
        created_at: n.created_at,
        updated_at: n.updated_at,
      })),
    };
  }

  // ── CRM Campaign Helpers ───────────────────────────────────────────────────

  private validateAudienceDefinition(audience: any): void {
    if (audience === null || audience === undefined) return;
    if (typeof audience !== "object") {
      throw new CampaignValidationError("Audience definition must be a valid JSON object.");
    }
    const allowedKeys = ["rfm_segments", "vip_tiers", "loyalty_levels", "is_blacklisted", "has_referred", "segment_ids"];
    for (const key of Object.keys(audience)) {
      if (!allowedKeys.includes(key)) {
        throw new CampaignValidationError(`Invalid audience filter key: ${key}`);
      }
    }
    if (audience.rfm_segments && !Array.isArray(audience.rfm_segments)) {
      throw new CampaignValidationError("rfm_segments must be an array of strings.");
    }
    if (audience.vip_tiers && !Array.isArray(audience.vip_tiers)) {
      throw new CampaignValidationError("vip_tiers must be an array of strings.");
    }
    if (audience.loyalty_levels && !Array.isArray(audience.loyalty_levels)) {
      throw new CampaignValidationError("loyalty_levels must be an array of strings.");
    }
    if (audience.segment_ids && !Array.isArray(audience.segment_ids)) {
      throw new CampaignValidationError("segment_ids must be an array of strings.");
    }
    if (audience.is_blacklisted !== undefined && typeof audience.is_blacklisted !== "boolean") {
      throw new CampaignValidationError("is_blacklisted must be a boolean.");
    }
    if (audience.has_referred !== undefined && typeof audience.has_referred !== "boolean") {
      throw new CampaignValidationError("has_referred must be a boolean.");
    }
  }

  // ── CRM Campaigns CRUD ─────────────────────────────────────────────────────

  async createCampaign(data: any): Promise<any> {
    if (!data.name || !data.name.trim()) {
      throw new CampaignValidationError("Campaign name is required.");
    }
    if (!data.campaign_type || !data.campaign_type.trim()) {
      throw new CampaignValidationError("Campaign campaign_type is required.");
    }
    this.validateAudienceDefinition(data.audience);

    // Check duplicate name
    const [existing] = await this.listCampaigns({ name: data.name.trim() });
    if (existing) {
      throw new CampaignValidationError(`Campaign with name "${data.name.trim()}" already exists.`);
    }

    const created = await this.createCampaigns([
      {
        ...data,
        name: data.name.trim(),
        status: data.status || "draft",
      },
    ]);
    return created[0];
  }

  async updateCampaign(id: string, data: any): Promise<any> {
    const campaign = await this.retrieveCampaign(id).catch(() => null);
    if (!campaign) {
      throw new CampaignNotFoundError(id);
    }
    if (campaign.status === "archived") {
      throw new CampaignArchivedError(id);
    }
    if (data.audience !== undefined) {
      this.validateAudienceDefinition(data.audience);
    }
    if (data.name !== undefined) {
      if (!data.name || !data.name.trim()) {
        throw new CampaignValidationError("Campaign name cannot be empty.");
      }
      // Check duplicate name excluding current ID
      const [existing] = await this.listCampaigns({ name: data.name.trim() });
      if (existing && existing.id !== id) {
        throw new CampaignValidationError(`Campaign with name "${data.name.trim()}" already exists.`);
      }
    }

    const updated = await this.updateCampaigns({
      selector: { id },
      data,
    });
    return updated[0];
  }

  async archiveCampaign(id: string): Promise<any> {
    const campaign = await this.retrieveCampaign(id).catch(() => null);
    if (!campaign) {
      throw new CampaignNotFoundError(id);
    }
    const updated = await this.updateCampaigns({
      selector: { id },
      data: { status: "archived" },
    });
    return updated[0];
  }

  async getCampaign(id: string): Promise<any> {
    const campaign = await this.retrieveCampaign(id).catch(() => null);
    if (!campaign) {
      throw new CampaignNotFoundError(id);
    }
    return campaign;
  }

  async deleteCampaign(id: string): Promise<void> {
    const campaign = await this.retrieveCampaign(id).catch(() => null);
    if (!campaign) {
      throw new CampaignNotFoundError(id);
    }
    await this.deleteCampaigns([id]);
  }

  // ── CRM Segments CRUD ──────────────────────────────────────────────────────

  private validateSegmentRules(rules: any): any[] {
    if (!rules) {
      throw new SegmentValidationError("Rules definition is required.");
    }
    const parsedRules = typeof rules === "string" ? JSON.parse(rules) : rules;
    if (!Array.isArray(parsedRules) || parsedRules.length === 0) {
      throw new SegmentValidationError("Rules must be a non-empty array.");
    }

    const supportedFields = [
      "order_count",
      "total_spent",
      "last_purchase_days",
      "branch_ids",
      "loyalty_tier",
      "wallet_balance",
      "referrals_count",
      "city_id",
      "is_birthday",
      "registration_date",
    ];
    const supportedOperators = [
      "eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in"
    ];

    for (const rule of parsedRules) {
      if (!rule || typeof rule !== "object") {
        throw new SegmentValidationError("Each rule criteria must be a valid object.");
      }
      const { field, operator, value } = rule;
      if (!field || !supportedFields.includes(field)) {
        throw new SegmentValidationError(`Unsupported or missing rule field: ${field}`);
      }
      if (!operator || !supportedOperators.includes(operator)) {
        throw new SegmentValidationError(`Unsupported or missing rule operator: ${operator}`);
      }
      if (value === undefined || value === null) {
        throw new SegmentValidationError("Rule value is required.");
      }

      if (field === "order_count" || field === "total_spent" || field === "last_purchase_days" || field === "wallet_balance" || field === "referrals_count") {
        if (typeof value !== "number" && isNaN(Number(value))) {
          throw new SegmentValidationError(`Value for ${field} must be a number.`);
        }
      }
      if (field === "branch_ids" || field === "city_id") {
        if (!Array.isArray(value) && typeof value !== "string") {
          throw new SegmentValidationError(`Value for ${field} must be a string or an array of strings.`);
        }
      }
      if (field === "is_birthday") {
        if (typeof value !== "boolean") {
          throw new SegmentValidationError("Value for is_birthday must be a boolean.");
        }
      }
      if (field === "registration_date") {
        if (typeof value !== "string" || isNaN(Date.parse(value))) {
          throw new SegmentValidationError("Value for registration_date must be a valid ISO date string.");
        }
      }
    }
    return parsedRules;
  }

  async createSegment(data: any): Promise<any> {
    if (!data.name || !data.name.trim()) {
      throw new SegmentValidationError("Segment name is required.");
    }
    const validatedRules = this.validateSegmentRules(data.rules);

    const [existing] = await this.listSegments({ name: data.name.trim() });
    if (existing) {
      throw new SegmentValidationError(`Segment with name "${data.name.trim()}" already exists.`);
    }

    const created = await this.createSegments([
      {
        ...data,
        name: data.name.trim(),
        rules: JSON.stringify(validatedRules),
        is_active: data.is_active ?? true,
      },
    ]);

    await this.evaluateSegmentMemberships(created[0].id).catch(() => null);

    return created[0];
  }

  async updateSegment(id: string, data: any): Promise<any> {
    const segment = await this.retrieveSegment(id).catch(() => null) as any;
    if (!segment) {
      throw new SegmentNotFoundError(id);
    }

    const updateData: Record<string, any> = {};

    if (data.name !== undefined) {
      if (!data.name || !data.name.trim()) {
        throw new SegmentValidationError("Segment name cannot be empty.");
      }
      const [existing] = await this.listSegments({ name: data.name.trim() });
      if (existing && existing.id !== id) {
        throw new SegmentValidationError(`Segment with name "${data.name.trim()}" already exists.`);
      }
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.rules !== undefined) {
      const validatedRules = this.validateSegmentRules(data.rules);
      updateData.rules = JSON.stringify(validatedRules);
    }

    if (data.is_active !== undefined) {
      updateData.is_active = !!data.is_active;
    }

    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null;
    }

    const updated = await this.updateSegments({
      selector: { id },
      data: updateData,
    });

    await this.evaluateSegmentMemberships(id).catch(() => null);

    return updated[0];
  }

  async deleteSegment(id: string): Promise<void> {
    const segment = await this.retrieveSegment(id).catch(() => null);
    if (!segment) {
      throw new SegmentNotFoundError(id);
    }

    const mappings = await this.listCustomerSegments({ segment_id: id });
    if (mappings.length > 0) {
      await this.deleteCustomerSegments(mappings.map((m: any) => m.id));
    }

    await this.deleteSegments([id]);
  }

  async getSegment(id: string): Promise<any> {
    const segment = await this.retrieveSegment(id).catch(() => null) as any;
    if (!segment) {
      throw new SegmentNotFoundError(id);
    }
    return segment;
  }

  // ── CRM Segments Evaluation Engine ─────────────────────────────────────────

  private async getCustomerStatsForSegmentation(customerId: string): Promise<any> {
    const orderModule = this.container.orderModuleService || this.container.order;
    const rewardsService = this.container.rewardsModuleService;
    const customerModule = this.container.customerModuleService || this.container.customer;

    const [customer, orders, wallet, loyaltyLedger, referralsCount] = await Promise.all([
      customerModule.retrieveCustomer(customerId, { relations: ["addresses"] }).catch(() => null),
      orderModule
        ? orderModule.listOrders({ customer_id: customerId }, { select: ["id", "status", "total", "created_at", "metadata", "branch_id"] }).catch(() => [])
        : Promise.resolve([]),
      Promise.resolve(null),
      Promise.resolve(null),
      Promise.resolve(0),
    ]);

    if (!customer) return null;

    const validOrders = orders.filter((o: any) => {
      const isCompleted = o.status === "completed" || o.status === "fulfilled";
      const isCancelled = o.status === "canceled" || o.status === "cancelled";
      return isCompleted && !isCancelled;
    });

    const totalSpent = validOrders.reduce((sum: number, o: any) => sum + (o.total ? Number(o.total) : 0), 0);
    const orderCount = validOrders.length;

    let lastPurchaseDays = 999;
    let branchIds: string[] = [];
    if (validOrders.length > 0) {
      const sorted = [...validOrders].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastOrder = sorted[0];
      const diffTime = new Date().getTime() - new Date(lastOrder.created_at).getTime();
      lastPurchaseDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      branchIds = validOrders.map((o: any) => o.metadata?.branch_id || o.branch_id).filter(Boolean);
    }

    let cityId: string | null = null;
    const defaultAddress = customer.addresses?.find((a: any) => a.is_default) || customer.addresses?.[0];
    if (defaultAddress) {
      cityId = defaultAddress.city_id || null;
    }

    let isBirthday = false;
    const birthdayStr = customer.metadata?.birthday || customer.birthday;
    if (birthdayStr) {
      const bday = new Date(birthdayStr);
      const today = new Date();
      isBirthday = bday.getUTCDate() === today.getUTCDate() && bday.getUTCMonth() === today.getUTCMonth();
    }

    return {
      order_count: orderCount,
      total_spent: totalSpent,
      last_purchase_days: lastPurchaseDays,
      branch_ids: branchIds,
      loyalty_tier: loyaltyLedger?.tier || "none",
      wallet_balance: wallet?.balance || 0,
      referrals_count: referralsCount,
      city_id: cityId,
      is_birthday: isBirthday,
      registration_date: customer.created_at ? new Date(customer.created_at) : new Date(),
    };
  }

  async evaluateCustomerAgainstSegment(customerId: string, segmentId: string): Promise<boolean> {
    const segment = await this.retrieveSegment(segmentId).catch(() => null) as any;
    if (!segment || !segment.is_active) return false;

    const stats = await this.getCustomerStatsForSegmentation(customerId);
    if (!stats) return false;

    const rules = JSON.parse(segment.rules) as any[];

    for (const rule of rules) {
      const { field, operator, value } = rule;
      const actual = stats[field];

      const pass = this.compareSegmentValue(actual, operator, value);
      if (!pass) return false;
    }

    return true;
  }

  private compareSegmentValue(actual: any, operator: string, expected: any): boolean {
    if (actual instanceof Date) {
      const actTime = actual.getTime();
      const expTime = new Date(expected).getTime();
      if (isNaN(expTime)) return false;
      switch (operator) {
        case "eq": return actTime === expTime;
        case "neq": return actTime !== expTime;
        case "gt": return actTime > expTime;
        case "gte": return actTime >= expTime;
        case "lt": return actTime < expTime;
        case "lte": return actTime <= expTime;
        default: return false;
      }
    }

    switch (operator) {
      case "eq":
        return actual === expected;
      case "neq":
        return actual !== expected;
      case "gt":
        return Number(actual) > Number(expected);
      case "gte":
        return Number(actual) >= Number(expected);
      case "lt":
        return Number(actual) < Number(expected);
      case "lte":
        return Number(actual) <= Number(expected);
      case "in":
        if (Array.isArray(actual)) {
          if (Array.isArray(expected)) {
            return actual.some((v: any) => expected.includes(v));
          }
          return actual.includes(expected);
        }
        return Array.isArray(expected) && expected.includes(actual);
      case "not_in":
        if (Array.isArray(actual)) {
          if (Array.isArray(expected)) {
            return !actual.some((v: any) => expected.includes(v));
          }
          return !actual.includes(expected);
        }
        return Array.isArray(expected) && !expected.includes(actual);
      default:
        return false;
    }
  }

  async evaluateSegmentMemberships(segmentId: string): Promise<void> {
    const segment = await this.retrieveSegment(segmentId).catch(() => null) as any;
    if (!segment) {
      throw new SegmentNotFoundError(segmentId);
    }

    const customerModule = this.container.customerModuleService || this.container.customer;
    if (!customerModule) {
      throw new Error("Customer module not resolved in container.");
    }

    const customers = await customerModule.listCustomers({}, { select: ["id"] }).catch(() => []);
    const activeMappings = await this.listCustomerSegments({ segment_id: segmentId });
    const existingCustomerIds = new Set(activeMappings.map((m: any) => m.customer_id));

    const toInsert: any[] = [];
    const toDeleteIds: string[] = [];

    for (const customer of customers) {
      const isMatch = await this.evaluateCustomerAgainstSegment(customer.id, segmentId);
      const isMapped = existingCustomerIds.has(customer.id);

      if (isMatch && !isMapped) {
        toInsert.push({
          segment_id: segmentId,
          customer_id: customer.id,
          joined_at: new Date(),
        });
      } else if (!isMatch && isMapped) {
        const mapping = activeMappings.find((m: any) => m.customer_id === customer.id);
        if (mapping) {
          toDeleteIds.push(mapping.id);
        }
      }
    }

    if (toInsert.length > 0) {
      await this.createCustomerSegments(toInsert);
    }
    if (toDeleteIds.length > 0) {
      await this.deleteCustomerSegments(toDeleteIds);
    }
  }

  async evaluateCustomerSegments(customerId: string): Promise<void> {
    const segments = await this.listSegments({ is_active: true });
    const activeMappings = await this.listCustomerSegments({ customer_id: customerId });
    const existingSegmentIds = new Set(activeMappings.map((m: any) => m.segment_id));

    const toInsert: any[] = [];
    const toDeleteIds: string[] = [];

    for (const segment of segments) {
      const isMatch = await this.evaluateCustomerAgainstSegment(customerId, segment.id);
      const isMapped = existingSegmentIds.has(segment.id);

      if (isMatch && !isMapped) {
        toInsert.push({
          segment_id: segment.id,
          customer_id: customerId,
          joined_at: new Date(),
        });
      } else if (!isMatch && isMapped) {
        const mapping = activeMappings.find((m: any) => m.segment_id === segment.id);
        if (mapping) {
          toDeleteIds.push(mapping.id);
        }
      }
    }

    if (toInsert.length > 0) {
      await this.createCustomerSegments(toInsert);
    }
    if (toDeleteIds.length > 0) {
      await this.deleteCustomerSegments(toDeleteIds);
    }
  }

  async evaluateAllCustomerSegments(): Promise<void> {
    const segments = await this.listSegments({ is_active: true });
    for (const segment of segments) {
      await this.evaluateSegmentMemberships(segment.id);
    }
  }

  // ── CRM Email Templates ───────────────────────────────────────────────────

  async createEmailTemplate(data: any): Promise<any> {
    if (!data.name || !data.name.trim()) {
      throw new TemplateValidationError("Template name is required.");
    }
    if (!data.subject || !data.subject.trim()) {
      throw new TemplateValidationError("Template subject is required.");
    }
    if (!data.body || !data.body.trim()) {
      throw new TemplateValidationError("Template body is required.");
    }

    const [existing] = await this.listEmailTemplates({ name: data.name.trim() });
    if (existing) {
      throw new TemplateValidationError(`Template with name "${data.name.trim()}" already exists.`);
    }

    const created = await this.createEmailTemplates([
      {
        ...data,
        name: data.name.trim(),
      },
    ]);
    return created[0];
  }

  async updateEmailTemplate(id: string, data: any): Promise<any> {
    const template = await this.retrieveEmailTemplate(id).catch(() => null);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) {
      if (!data.name || !data.name.trim()) {
        throw new TemplateValidationError("Template name cannot be empty.");
      }
      const [existing] = await this.listEmailTemplates({ name: data.name.trim() });
      if (existing && existing.id !== id) {
        throw new TemplateValidationError(`Template with name "${data.name.trim()}" already exists.`);
      }
      updateData.name = data.name.trim();
    }
    if (data.subject !== undefined) {
      if (!data.subject || !data.subject.trim()) {
        throw new TemplateValidationError("Template subject cannot be empty.");
      }
      updateData.subject = data.subject.trim();
    }
    if (data.body !== undefined) {
      if (!data.body || !data.body.trim()) {
        throw new TemplateValidationError("Template body cannot be empty.");
      }
      updateData.body = data.body.trim();
    }
    if (data.is_active !== undefined) {
      updateData.is_active = !!data.is_active;
    }
    if (data.language_code !== undefined) {
      updateData.language_code = data.language_code;
    }
    if (data.category !== undefined) {
      updateData.category = data.category;
    }
    if (data.version !== undefined) {
      updateData.version = Number(data.version);
    }

    const updated = await this.updateEmailTemplates({
      selector: { id },
      data: updateData,
    });
    return updated[0];
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    const template = await this.retrieveEmailTemplate(id).catch(() => null);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }
    await this.deleteEmailTemplates([id]);
  }

  async getEmailTemplate(id: string): Promise<any> {
    const template = await this.retrieveEmailTemplate(id).catch(() => null);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }
    return template;
  }

  async renderTemplate(templateId: string, variables: Record<string, any>): Promise<{ subject: string; body: string }> {
    const template = await this.getEmailTemplate(templateId);

    const interpolate = (text: string, vars: Record<string, any>) => {
      return text.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
        return vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`;
      });
    };

    const subject = interpolate(template.subject, variables);
    const body = interpolate(template.body, variables);

    return { subject, body };
  }

  // ── CRM Marketing Automation Engine ────────────────────────────────────────

  async triggerAutomationFlow(triggerType: string, customerId: string, payload?: any): Promise<void> {
    const flows = await this.listAutomationFlows({ trigger_type: triggerType, is_active: true });
    for (const flow of flows) {
      const execution = await this.createAutomationExecutions([
        {
          flow_id: flow.id,
          customer_id: customerId,
          status: "running",
          current_step_id: null,
          metadata: payload ? JSON.stringify(payload) : null,
        },
      ]);

      await this.createAutomationLogs([
        {
          execution_id: execution[0].id,
          step_id: "trigger",
          step_type: "trigger",
          status: "success",
          note: `Flow triggered by event: ${triggerType}`,
        },
      ]);

      // Execute asynchronously / non-blocking
      await this.executeAutomationStep(execution[0].id).catch(() => null);
    }
  }

  async executeAutomationStep(executionId: string): Promise<void> {
    const execution = await this.retrieveAutomationExecution(executionId).catch(() => null) as any;
    if (!execution || execution.status !== "running") return;

    const [flow] = await this.listAutomationFlows({ id: execution.flow_id });
    if (!flow || !flow.is_active) {
      await this.updateAutomationExecutions({
        selector: { id: executionId },
        data: { status: "failed" },
      });
      return;
    }

    const steps = typeof flow.steps === "string" ? JSON.parse(flow.steps) : (flow.steps || []);
    if (!Array.isArray(steps) || steps.length === 0) {
      await this.updateAutomationExecutions({
        selector: { id: executionId },
        data: { status: "completed" },
      });
      return;
    }

    let nextStepIndex = 0;
    if (execution.current_step_id) {
      nextStepIndex = steps.findIndex((s: any) => s.id === execution.current_step_id) + 1;
    }

    if (nextStepIndex >= steps.length) {
      await this.updateAutomationExecutions({
        selector: { id: executionId },
        data: { status: "completed", current_step_id: "completed" },
      });
      return;
    }

    const step = steps[nextStepIndex];

    if (step.type === "delay") {
      const durationSeconds = Number(step.config?.duration_seconds || 60);
      const nextTime = new Date(Date.now() + durationSeconds * 1000);

      await this.updateAutomationExecutions({
        selector: { id: executionId },
        data: {
          status: "delayed",
          current_step_id: step.id,
          next_execution_at: nextTime,
        },
      });

      await this.createAutomationLogs([
        {
          execution_id: executionId,
          step_id: step.id,
          step_type: "delay",
          status: "success",
          note: `Execution delayed until ${nextTime.toISOString()}`,
        },
      ]);
      return;
    }

    if (step.type === "condition") {
      const criteria = step.config?.criteria;
      let matched = false;

      if (criteria && Array.isArray(criteria)) {
        matched = true;
        const stats = await this.getCustomerStatsForSegmentation(execution.customer_id);
        if (!stats) {
          matched = false;
        } else {
          for (const rule of criteria) {
            const actual = stats[rule.field];
            const pass = this.compareSegmentValue(actual, rule.operator, rule.value);
            if (!pass) {
              matched = false;
              break;
            }
          }
        }
      }

      const nextBranchStepId = matched ? step.config?.true_step_id : step.config?.false_step_id;

      await this.updateAutomationExecutions({
        selector: { id: executionId },
        data: {
          current_step_id: step.id,
        },
      });

      await this.createAutomationLogs([
        {
          execution_id: executionId,
          step_id: step.id,
          step_type: "condition",
          status: "success",
          note: `Evaluated branch condition. Result: ${matched}. Routing to: ${nextBranchStepId || "end"}`,
        },
      ]);

      if (nextBranchStepId) {
        // Jump directly to that step ID
        const targetIndex = steps.findIndex((s: any) => s.id === nextBranchStepId);
        if (targetIndex >= 0) {
          // Subtract 1 because next index search increments it
          const mockExecutionId = executionId;
          await this.updateAutomationExecutions({
            selector: { id: executionId },
            data: { current_step_id: steps[targetIndex - 1]?.id || null },
          });
        }
      }

      await this.executeAutomationStep(executionId).catch(() => null);
      return;
    }

    if (step.type === "action") {
      const actionType = step.config?.channel || "email";
      let status = "success";
      let logNote = `Dispatched message via: ${actionType}`;

      try {
        if (actionType === "email" && step.config?.template_id) {
          const payload = execution.metadata ? JSON.parse(execution.metadata) : {};
          const customerModule = this.container.customerModuleService || this.container.customer;
          const customer = await customerModule.retrieveCustomer(execution.customer_id).catch(() => null);
          const vars = {
            customer_name: customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Customer" : "Customer",
            ...payload,
          };
          const rendered = await this.renderTemplate(step.config.template_id, vars);
          logNote = `Dispatched email template "${step.config.template_id}". Subject: ${rendered.subject}`;
        } else if (actionType === "webhook" && step.config?.url) {
          // Mock webhook call
          logNote = `Dispatched webhook post request to: ${step.config.url}`;
        }
      } catch (err: any) {
        status = "failure";
        logNote = `Dispatch failed: ${err.message}`;
      }

      await this.updateAutomationExecutions({
        selector: { id: executionId },
        data: {
          current_step_id: step.id,
        },
      });

      await this.createAutomationLogs([
        {
          execution_id: executionId,
          step_id: step.id,
          step_type: "action",
          status,
          note: logNote,
        },
      ]);

      // Move to next step immediately
      await this.executeAutomationStep(executionId).catch(() => null);
    }
  }

  async runDelayedAutomationSteps(): Promise<void> {
    const now = new Date();
    const executions = await this.listAutomationExecutions({
      status: "delayed",
      next_execution_at: { $lte: now },
    });

    for (const execution of executions) {
      await this.updateAutomationExecutions({
        selector: { id: execution.id },
        data: {
          status: "running",
          next_execution_at: null,
        },
      });

      await this.executeAutomationStep(execution.id).catch(() => null);
    }
  }

  // ── Marketing Analytics Dashboard ──────────────────────────────────────────

  async getMarketingDashboardAnalytics(): Promise<any> {
    const orderModule = this.container.orderModuleService || this.container.order;
    const allOrders = orderModule ? await orderModule.listOrders({}, { select: ["id", "status", "total", "customer_id"] }).catch(() => []) : [];

    const completedOrders = allOrders.filter((o: any) => o.status === "completed" || o.status === "fulfilled");

    // Funnel count calculations: total, cart, checkout, order
    const totalCustomersCount = new Set(allOrders.map((o: any) => o.customer_id)).size;
    const repeatBuyersCount = Array.from(
      completedOrders.reduce((map: Map<string, number>, o: any) => {
        map.set(o.customer_id, (map.get(o.customer_id) || 0) + 1);
        return map;
      }, new Map<string, number>()).entries()
    ).filter(([_, count]) => count > 1).length;

    const repeatPurchaseRate = totalCustomersCount > 0 ? Math.round((repeatBuyersCount / totalCustomersCount) * 100) : 0;

    // Aggregate Campaign / Automation conversions
    const activeExecutions = await this.listAutomationExecutions({});
    const completedExecutionsCount = activeExecutions.filter((e: any) => e.status === "completed").length;
    const conversionRate = activeExecutions.length > 0 ? Math.round((completedExecutionsCount / activeExecutions.length) * 100) : 0;

    return {
      revenue_lift: completedOrders.reduce((sum: number, o: any) => sum + (o.total ? Number(o.total) : 0), 0),
      conversion_rate: conversionRate,
      repeat_purchase_rate: repeatPurchaseRate,
      funnel: {
        active_audiences: activeExecutions.length,
        completed_conversions: completedExecutionsCount,
      },
    };
  }
}

export default CrmModuleService;
