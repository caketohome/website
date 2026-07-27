import { MedusaService } from "@medusajs/utils";
import { Wallet, WalletTransaction, GiftCard, GiftCardTransaction, LoyaltyLedger, LoyaltyTransaction, LoyaltyRule, ReferralProgram, ReferralCode, ReferralEvent, ReferralQualification, FraudReview } from "./models";

class RewardsModuleService extends MedusaService({
  Wallet,
  WalletTransaction,
  GiftCard,
  GiftCardTransaction,
  LoyaltyLedger,
  LoyaltyTransaction,
  LoyaltyRule,
  ReferralProgram,
  ReferralCode,
  ReferralEvent,
  ReferralQualification,
  FraudReview,
}) {
  private locks = new Map<string, Promise<void>>();
  protected container: any;

  constructor(dependencies: any, ...args: any[]) {
    super(dependencies, ...args);
    this.container = dependencies;
  }

  private async acquireLock(key: string): Promise<() => void> {
    let resolveLock: () => void = () => {};
    const newLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    const existingLock = this.locks.get(key) || Promise.resolve();
    this.locks.set(key, newLock);

    await existingLock;
    return () => {
      resolveLock();
      if (this.locks.get(key) === newLock) {
        this.locks.delete(key);
      }
    };
  }

  /**
   * Best-effort tracking of analytics events.
   */
  private async trackAnalytics(eventName: string, customerId: string | null, metadata: any) {
    try {
      const analyticsModule = this.container.analyticsModuleService;
      if (analyticsModule) {
        await analyticsModule.track({
          event_name: eventName,
          customer_id: customerId,
          metadata,
        });
      }
    } catch {
      // Ignore analytics failures
    }
  }

  /**
   * Best-effort notification dispatch (SMS/WhatsApp/Email).
   */
  private async sendNotification(
    event: string,
    customerId: string,
    variables: Record<string, unknown>
  ) {
    try {
      const customerService = this.container.customerModuleService;
      const notificationService = this.container.notificationModuleService;
      if (!customerService || !notificationService) return;

      const customer = await customerService.retrieveCustomer(customerId).catch(() => null);
      if (!customer) return;

      const recipient = customer.phone || customer.email;
      if (!recipient) return;

      const channel = customer.phone ? "sms" : "email";

      // Send to primary channel (SMS or Email)
      await notificationService.sendByEvent(event, channel, recipient, variables).catch(() => {});
      
      // If phone exists, also send WhatsApp message
      if (customer.phone) {
        await notificationService.sendByEvent(event, "whatsapp", recipient, variables).catch(() => {});
      }
    } catch {
      // Ignore notification failures
    }
  }

  /**
   * Helper to retrieve or atomically initialize a customer's wallet.
   */
  async getOrCreateWallet(customerId: string, currencyCode: string = "INR"): Promise<any> {
    const [wallet] = await this.listWallets({ customer_id: customerId });
    if (wallet) {
      return wallet;
    }
    const [newWallet] = await this.createWallets([
      {
        customer_id: customerId,
        balance: 0,
        currency_code: currencyCode,
      },
    ]);
    return newWallet;
  }

  /**
   * Credit wallet balance with ledger logging.
   */
  async creditWallet(
    customerId: string,
    amount: number,
    refType: string | null = null,
    refId: string | null = null,
    description: string | null = null
  ): Promise<any> {
    if (amount <= 0) {
      throw new Error("CREDIT_AMOUNT_MUST_BE_POSITIVE");
    }
    const lockKey = `wallet:${customerId}`;
    const release = await this.acquireLock(lockKey);
    try {
      const wallet = await this.getOrCreateWallet(customerId);
      const newBalance = (wallet.balance as number) + amount;

      await this.updateWallets({
        selector: { id: wallet.id },
        data: { balance: newBalance },
      });

      const [transaction] = await this.createWalletTransactions([
        {
          wallet_id: wallet.id,
          amount,
          type: "credit",
          status: "completed",
          reference_type: refType,
          reference_id: refId,
          description,
        },
      ]);

      // Track Analytics
      await this.trackAnalytics("wallet_credit", customerId, {
        amount: amount / 100,
        reference_type: refType,
        reference_id: refId,
        description,
      });

      // Dispatch Notification
      await this.sendNotification("wallet_credit", customerId, {
        amount: (amount / 100).toFixed(2),
        balance: (newBalance / 100).toFixed(2),
        description: description || "Wallet credited",
      });

      return { wallet: { ...wallet, balance: newBalance }, transaction };
    } finally {
      release();
    }
  }

  /**
   * Debit wallet balance with ledger logging.
   */
  async debitWallet(
    customerId: string,
    amount: number,
    refType: string | null = null,
    refId: string | null = null,
    description: string | null = null
  ): Promise<any> {
    if (amount <= 0) {
      throw new Error("DEBIT_AMOUNT_MUST_BE_POSITIVE");
    }
    const lockKey = `wallet:${customerId}`;
    const release = await this.acquireLock(lockKey);
    try {
      const wallet = await this.getOrCreateWallet(customerId);
      if ((wallet.balance as number) < amount) {
        throw new Error("INSUFFICIENT_WALLET_BALANCE");
      }
      const newBalance = (wallet.balance as number) - amount;

      await this.updateWallets({
        selector: { id: wallet.id },
        data: { balance: newBalance },
      });

      const [transaction] = await this.createWalletTransactions([
        {
          wallet_id: wallet.id,
          amount: -amount,
          type: "debit",
          status: "completed",
          reference_type: refType,
          reference_id: refId,
          description,
        },
      ]);

      // Track Analytics
      await this.trackAnalytics("wallet_debit", customerId, {
        amount: amount / 100,
        reference_type: refType,
        reference_id: refId,
        description,
      });

      // Dispatch Notification
      await this.sendNotification("wallet_debit", customerId, {
        amount: (amount / 100).toFixed(2),
        balance: (newBalance / 100).toFixed(2),
        description: description || "Wallet debited",
      });

      return { wallet: { ...wallet, balance: newBalance }, transaction };
    } finally {
      release();
    }
  }

  /**
   * Validate a gift card by its code.
   */
  async validateGiftCard(code: string, currencyCode: string = "INR"): Promise<any> {
    const [giftCard] = await this.listGiftCards({ code });
    if (!giftCard) {
      throw new Error("GIFT_CARD_NOT_FOUND");
    }

    if (!giftCard.is_active || giftCard.status !== "active") {
      throw new Error("GIFT_CARD_INACTIVE_OR_DISABLED");
    }

    if (giftCard.currency_code !== currencyCode) {
      throw new Error("GIFT_CARD_CURRENCY_MISMATCH");
    }

    if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
      // Auto-update status to expired
      await this.updateGiftCards({
        selector: { id: giftCard.id },
        data: { status: "expired", is_active: false },
      });
      throw new Error("GIFT_CARD_EXPIRED");
    }

    if (giftCard.current_balance <= 0) {
      throw new Error("GIFT_CARD_EMPTY_BALANCE");
    }

    return giftCard;
  }

  /**
   * Atomically redeem a gift card by its code.
   */
  async redeemGiftCard(
    code: string,
    amount: number,
    refType: string | null = null,
    refId: string | null = null,
    idempotencyKey: string | null = null,
    createdBy: string | null = null
  ): Promise<any> {
    if (amount <= 0) {
      throw new Error("REDEEM_AMOUNT_MUST_BE_POSITIVE");
    }

    const lockKey = `giftcard:${code}`;
    const release = await this.acquireLock(lockKey);
    try {
      // Check idempotency key first
      if (idempotencyKey) {
        const [existingTx] = await this.listGiftCardTransactions({ idempotency_key: idempotencyKey });
        if (existingTx) {
          const giftCard = await this.retrieveGiftCard(existingTx.gift_card_id);
          return { giftCard, transaction: existingTx, duplicated: true };
        }
      }

      const giftCard = await this.validateGiftCard(code);
      if (giftCard.current_balance < amount) {
        throw new Error("INSUFFICIENT_GIFT_CARD_BALANCE");
      }

      const newBalance = giftCard.current_balance - amount;
      await this.updateGiftCards({
        selector: { id: giftCard.id },
        data: { current_balance: newBalance },
      });

      const [transaction] = await this.createGiftCardTransactions([
        {
          gift_card_id: giftCard.id,
          amount: -amount,
          transaction_type: "redeem",
          reference_type: refType,
          reference_id: refId,
          idempotency_key: idempotencyKey,
          created_by: createdBy,
        },
      ]);

      // Track Analytics
      await this.trackAnalytics("gift_card_redeemed", createdBy, {
        code,
        amount: amount / 100,
        reference_type: refType,
        reference_id: refId,
      });

      // Dispatch Notification
      if (createdBy) {
        await this.sendNotification("gift_card_redeemed", createdBy, {
          code,
          amount: (amount / 100).toFixed(2),
          balance: (newBalance / 100).toFixed(2),
        });
      }

      return { giftCard: { ...giftCard, current_balance: newBalance }, transaction };
    } finally {
      release();
    }
  }

  /**
   * Atomically refund a gift card by its code.
   */
  async refundGiftCard(
    code: string,
    amount: number,
    refType: string | null = null,
    refId: string | null = null,
    idempotencyKey: string | null = null,
    createdBy: string | null = null
  ): Promise<any> {
    if (amount <= 0) {
      throw new Error("REFUND_AMOUNT_MUST_BE_POSITIVE");
    }

    const lockKey = `giftcard:${code}`;
    const release = await this.acquireLock(lockKey);
    try {
      if (idempotencyKey) {
        const [existingTx] = await this.listGiftCardTransactions({ idempotency_key: idempotencyKey });
        if (existingTx) {
          const giftCard = await this.retrieveGiftCard(existingTx.gift_card_id);
          return { giftCard, transaction: existingTx, duplicated: true };
        }
      }

      const [giftCard] = await this.listGiftCards({ code });
      if (!giftCard) {
        throw new Error("GIFT_CARD_NOT_FOUND");
      }

      const newBalance = giftCard.current_balance + amount;
      await this.updateGiftCards({
        selector: { id: giftCard.id },
        data: { current_balance: newBalance },
      });

      const [transaction] = await this.createGiftCardTransactions([
        {
          gift_card_id: giftCard.id,
          amount,
          transaction_type: "refund",
          reference_type: refType,
          reference_id: refId,
          idempotency_key: idempotencyKey,
          created_by: createdBy,
        },
      ]);

      return { giftCard: { ...giftCard, current_balance: newBalance }, transaction };
    } finally {
      release();
    }
  }

  /**
   * Disable a gift card by ID.
   */
  async disableGiftCard(id: string): Promise<any> {
    const [giftCard] = await this.updateGiftCards({
      selector: { id },
      data: { is_active: false, status: "disabled" },
    });
    return giftCard;
  }

  /**
   * Activate a gift card by ID.
   */
  async activateGiftCard(id: string): Promise<any> {
    const [giftCard] = await this.updateGiftCards({
      selector: { id },
      data: { is_active: true, status: "active" },
    });
    return giftCard;
  }

  /**
   * Helper to retrieve or initialize a loyalty ledger for a customer.
   */
  async getOrCreateLoyaltyLedger(customerId: string): Promise<any> {
    const [ledger] = await this.listLoyaltyLedgers({ customer_id: customerId });
    if (ledger) {
      return ledger;
    }

    const [created] = await this.createLoyaltyLedgers([
      {
        customer_id: customerId,
        points: 0,
        lifetime_points: 0,
        tier: "bronze",
      },
    ]);
    return created;
  }

  /**
   * Calculate dynamically dynamic points to award based on order amount spent.
   */
  async calculatePointsToEarn(amountSpent: number): Promise<{ points: number; rule: any | null }> {
    const rules = await this.listLoyaltyRules({ is_active: true });
    let maxPoints = 0;
    let selectedRule: any | null = null;

    for (const rule of rules) {
      if (amountSpent < rule.min_spend) {
        continue;
      }

      let points = 0;
      if (rule.rule_type === "fixed") {
        points = rule.value;
      } else if (rule.rule_type === "ratio") {
        points = Math.floor(amountSpent * rule.value);
      }

      if (points > maxPoints) {
        maxPoints = points;
        selectedRule = rule;
      }
    }

    return { points: maxPoints, rule: selectedRule };
  }

  /**
   * Recalculates and updates the tier classification based on lifetime points.
   */
  private determineTier(lifetimePoints: number): string {
    if (lifetimePoints < 1000) return "bronze";
    if (lifetimePoints < 5000) return "silver";
    if (lifetimePoints < 10000) return "gold";
    return "platinum";
  }

  /**
   * Atomically award loyalty points to a customer ledger.
   */
  async earnLoyaltyPoints(
    customerId: string,
    amountSpent: number,
    orderId: string
  ): Promise<any> {
    const lockKey = `loyalty:${customerId}`;
    const release = await this.acquireLock(lockKey);
    try {
      const ledger = await this.getOrCreateLoyaltyLedger(customerId);
      const { points: pointsToEarn, rule } = await this.calculatePointsToEarn(amountSpent);

      if (pointsToEarn <= 0) {
        return { ledger, pointsEarned: 0 };
      }

      const newPoints = ledger.points + pointsToEarn;
      const newLifetime = ledger.lifetime_points + pointsToEarn;
      const newTier = this.determineTier(newLifetime);

      const [updatedLedger] = await this.updateLoyaltyLedgers({
        selector: { id: ledger.id },
        data: {
          points: newPoints,
          lifetime_points: newLifetime,
          tier: newTier,
        },
      });

      const [transaction] = await this.createLoyaltyTransactions([
        {
          loyalty_ledger_id: ledger.id,
          points: pointsToEarn,
          transaction_type: "earn",
          description: rule ? `Earned via rule: ${rule.name}` : "Points earned from order purchase",
          reference_type: "order",
          reference_id: orderId,
        },
      ]);

      return { ledger: updatedLedger, transaction, pointsEarned: pointsToEarn };
    } finally {
      release();
    }
  }

  /**
   * Atomically redeem loyalty points from a customer ledger.
   */
  async redeemLoyaltyPoints(
    customerId: string,
    points: number,
    refType: string | null = null,
    refId: string | null = null,
    idempotencyKey: string | null = null,
    createdBy: string | null = null
  ): Promise<any> {
    if (points <= 0) {
      throw new Error("REDEEM_POINTS_MUST_BE_POSITIVE");
    }

    const lockKey = `loyalty:${customerId}`;
    const release = await this.acquireLock(lockKey);
    try {
      // Check idempotency first
      if (idempotencyKey) {
        const [existingTx] = await this.listLoyaltyTransactions({ metadata: { idempotency_key: idempotencyKey } });
        if (existingTx) {
          const ledger = await this.retrieveLoyaltyLedger(existingTx.loyalty_ledger_id);
          return { ledger, transaction: existingTx, duplicated: true };
        }
      }

      const ledger = await this.getOrCreateLoyaltyLedger(customerId);
      if (ledger.points < points) {
        throw new Error("INSUFFICIENT_LOYALTY_POINTS");
      }

      const newPoints = ledger.points - points;
      const [updatedLedger] = await this.updateLoyaltyLedgers({
        selector: { id: ledger.id },
        data: { points: newPoints },
      });

      const [transaction] = await this.createLoyaltyTransactions([
        {
          loyalty_ledger_id: ledger.id,
          points: -points,
          transaction_type: "redeem",
          description: `Redeemed points discount`,
          reference_type: refType,
          reference_id: refId,
          created_by: createdBy,
          metadata: idempotencyKey ? { idempotency_key: idempotencyKey } : null,
        },
      ]);

      return { ledger: updatedLedger, transaction };
    } finally {
      release();
    }
  }

  /**
   * Atomically adjust loyalty points (admin action).
   */
  async adjustLoyaltyPoints(
    customerId: string,
    points: number,
    description: string | null = null,
    createdBy: string | null = null
  ): Promise<any> {
    const lockKey = `loyalty:${customerId}`;
    const release = await this.acquireLock(lockKey);
    try {
      const ledger = await this.getOrCreateLoyaltyLedger(customerId);
      
      const newPoints = Math.max(0, ledger.points + points);
      // Only increment lifetime points if the adjustment is positive
      const newLifetime = points > 0 ? ledger.lifetime_points + points : ledger.lifetime_points;
      const newTier = this.determineTier(newLifetime);

      const [updatedLedger] = await this.updateLoyaltyLedgers({
        selector: { id: ledger.id },
        data: {
          points: newPoints,
          lifetime_points: newLifetime,
          tier: newTier,
        },
      });

      const [transaction] = await this.createLoyaltyTransactions([
        {
          loyalty_ledger_id: ledger.id,
          points,
          transaction_type: "adjustment",
          description: description || "Administrative points adjustment",
          created_by: createdBy,
        },
      ]);

      return { ledger: updatedLedger, transaction };
    } finally {
      release();
    }
  }

  /**
   * Helper to resolve Event Bus and emit event.
   */
  async emitEvent(name: string, data: any) {
    try {
      const eventBus = this.container?.eventBusModuleService || this.container?.event_bus || this.container?.["eventBusModuleService"];
      if (eventBus && typeof eventBus.emit === "function") {
        await eventBus.emit({ name, data });
      } else {
        console.warn(`[Rewards Service] Event Bus not available to emit ${name}`);
      }
    } catch (err) {
      console.error(`[Rewards Service] Failed to emit event ${name}:`, err);
    }
  }

  /**
   * Helper to retrieve or initialize a referral code for a customer.
   */
  async getOrCreateReferralCode(customerId: string): Promise<any> {
    const [existing] = await this.listReferralCodes({ customer_id: customerId });
    if (existing) {
      return existing;
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const codeString = `REF-${customerId.substring(0, 6).toUpperCase()}-${randomSuffix}`;

    const [created] = await this.createReferralCodes([
      {
        customer_id: customerId,
        code: codeString,
        status: "active",
        usage_limit: null,
        usage_count: 0,
      },
    ]);

    await this.emitEvent("referral.created", { customer_id: customerId, code: codeString });

    return created;
  }

  /**
   * Record a referral click event.
   */
  async registerReferralClick(codeString: string, metadata?: any): Promise<any> {
    const [refCode] = await this.listReferralCodes({ code: codeString });
    if (!refCode) {
      throw new Error("REFERRAL_CODE_NOT_FOUND");
    }

    if (refCode.status !== "active") {
      throw new Error("REFERRAL_CODE_INACTIVE");
    }

    const [event] = await this.createReferralEvents([
      {
        referral_code_id: refCode.id,
        referrer_id: refCode.customer_id,
        referee_id: "guest",
        event_type: "click",
        status: "pending",
        metadata: metadata ?? null,
      },
    ]);

    await this.emitEvent("referral.clicked", { event_id: event.id, code: codeString });

    return event;
  }

  /**
   * Record a referral sign up / registration event.
   */
  async registerReferralSignUp(codeString: string, refereeId: string, metadata?: any): Promise<any> {
    const [refCode] = await this.listReferralCodes({ code: codeString });
    if (!refCode) {
      throw new Error("REFERRAL_CODE_NOT_FOUND");
    }

    if (refCode.status !== "active") {
      throw new Error("REFERRAL_CODE_INACTIVE");
    }

    if (refCode.customer_id === refereeId) {
      throw new Error("SELF_REFERRAL_FORBIDDEN");
    }

    // Check if referee has already registered via a referral
    const [alreadyReferred] = await this.listReferralEvents({
      referee_id: refereeId,
      event_type: "register",
    });
    if (alreadyReferred) {
      throw new Error("CUSTOMER_ALREADY_REFERRED");
    }

    const [event] = await this.createReferralEvents([
      {
        referral_code_id: refCode.id,
        referrer_id: refCode.customer_id,
        referee_id: refereeId,
        event_type: "register",
        status: "pending",
        metadata: metadata ?? null,
      },
    ]);

    await this.emitEvent("referral.registered", { event_id: event.id, referrer_id: refCode.customer_id, referee_id: refereeId });

    return event;
  }

  /**
   * Configurable Qualification Engine: Evaluates if event complies with active referral program rules.
   */
  async evaluateReferralQualification(eventId: string, details?: any): Promise<any> {
    const event = await this.retrieveReferralEvent(eventId);
    if (!event) {
      throw new Error("REFERRAL_EVENT_NOT_FOUND");
    }

    // Find the active program
    const programs = await this.listReferralPrograms({ status: "active" });
    const program = programs[0]; // Take the first active program
    if (!program) {
      // Qualify false as no campaign program is active
      const [qual] = await this.createReferralQualifications([
        {
          referral_event_id: eventId,
          qualified: false,
          qualification_reason: "No active referral campaign program found.",
          fraud_score: 0,
        },
      ]);
      await this.emitEvent("referral.disqualified", { event_id: eventId, reason: qual.qualification_reason });
      return qual;
    }

    let qualified = true;
    let reason = "Qualifications met successfully.";

    const rules = program.qualification_rules || {};

    // 1. Minimum spent check
    if (rules.min_spend && details?.orderAmount !== undefined) {
      if (details.orderAmount < rules.min_spend) {
        qualified = false;
        reason = `Order amount ${details.orderAmount} is below required minimum spend of ${rules.min_spend}.`;
      }
    }

    // 2. Minimum order count check
    if (rules.min_order_count && details?.refereeOrderCount !== undefined) {
      if (details.refereeOrderCount < rules.min_order_count) {
        qualified = false;
        reason = `Referee order count ${details.refereeOrderCount} is below required minimum count of ${rules.min_order_count}.`;
      }
    }

    // 3. Manual approval gate check
    if (rules.manual_approval) {
      qualified = false;
      reason = "Campaign requires manual admin review.";
    }

    // Run Fraud Engine evaluation
    const fraud = await this.evaluateFraudScore(eventId, details);

    const [qual] = await this.createReferralQualifications([
      {
        referral_event_id: eventId,
        qualified,
        qualification_reason: reason,
        fraud_score: fraud.fraud_score,
      },
    ]);

    if (qualified && fraud.fraud_score < 80) {
      await this.emitEvent("referral.qualified", { event_id: eventId, program_id: program.id });
    } else {
      await this.emitEvent("referral.disqualified", { event_id: eventId, reason: qualified ? "High fraud score detected." : reason });
    }

    return qual;
  }

  /**
   * Fraud Detection Engine: Computes a fraud score and logs suspicious triggers.
   */
  async evaluateFraudScore(eventId: string, details?: any): Promise<any> {
    const event = await this.retrieveReferralEvent(eventId);
    if (!event) {
      throw new Error("REFERRAL_EVENT_NOT_FOUND");
    }

    let score = 0;
    const triggers: string[] = [];

    // Rule 1: Self referral check
    if (event.referee_id === event.referrer_id) {
      score = 100;
      triggers.push("Self referral attempt");
    }

    // Rule 2: IP match
    if (details?.ip && details?.referrerIp && details.ip === details.referrerIp) {
      score = Math.max(score, 50);
      triggers.push("IP addresses match referrer");
    }

    // Rule 3: Device signature match
    if (details?.device && details?.referrerDevice && details.device === details.referrerDevice) {
      score = Math.max(score, 60);
      triggers.push("Device signatures match referrer");
    }

    // Rule 4: Duplicate Email/Phone checks
    if (details?.duplicateEmail) {
      score = Math.max(score, 90);
      triggers.push("Duplicate customer email match");
    }
    if (details?.duplicatePhone) {
      score = Math.max(score, 90);
      triggers.push("Duplicate customer phone match");
    }

    // Velocity limits check (e.g. signup count from same IP in short window)
    if (details?.velocityAlert) {
      score = Math.max(score, 80);
      triggers.push("IP velocity limit exceeded");
    }

    if (score >= 80) {
      // Flag for fraud review queue
      await this.createFraudReviews([
        {
          referral_event_id: eventId,
          status: "pending",
          reason: triggers.join(", "),
          reviewer: null,
        },
      ]);
      await this.emitEvent("referral.flagged", { event_id: eventId, score, reason: triggers.join(", ") });
      await this.emitEvent("fraud.review_requested", { event_id: eventId, score });
    }

    return { fraud_score: score, status: score >= 80 ? "flagged" : "clean" };
  }

  /**
   * Reward Decision Service: Decides if qualified and fraud-free conversion is ready to reward.
   */
  async executeRewardDecision(eventId: string): Promise<any> {
    const event = await this.retrieveReferralEvent(eventId);
    if (!event) {
      throw new Error("REFERRAL_EVENT_NOT_FOUND");
    }

    const [qual] = await this.listReferralQualifications({ referral_event_id: eventId });
    if (!qual || !qual.qualified || qual.fraud_score >= 80) {
      await this.updateReferralEvents({
        selector: { id: eventId },
        data: { status: "rejected" },
      });
      return { rewarded: false, reason: "Qualification failed or fraud score too high." };
    }

    // Program evaluation
    const programs = await this.listReferralPrograms({ status: "active" });
    const program = programs[0];
    if (!program) {
      return { rewarded: false, reason: "No active referral program found to decide reward." };
    }

    // Mark event as qualified and ready
    await this.updateReferralEvents({
      selector: { id: eventId },
      data: { status: "qualified" },
    });

    await this.emitEvent("referral.reward_pending", {
      event_id: eventId,
      reward_type: program.reward_type,
      reward_value: program.reward_value,
      referrer_id: event.referrer_id,
      referee_id: event.referee_id,
    });

    return { rewarded: true, pending: true, reward_type: program.reward_type, reward_value: program.reward_value };
  }

  /**
   * Reward Executor: Consumes reward event parameters and distributes the actual reward type.
   */
  async executeReward(eventId: string): Promise<any> {
    const event = await this.retrieveReferralEvent(eventId);
    if (!event) {
      throw new Error("REFERRAL_EVENT_NOT_FOUND");
    }

    if (event.status !== "qualified") {
      throw new Error("REFERRAL_EVENT_NOT_ELIGIBLE_FOR_REWARD");
    }

    const programs = await this.listReferralPrograms({ status: "active" });
    const program = programs[0];
    if (!program) {
      throw new Error("NO_ACTIVE_REFERRAL_PROGRAM");
    }

    let rewardDetail = "";

    // Distribute actual reward type atomically
    if (program.reward_type === "wallet") {
      await this.creditWallet(
        event.referrer_id,
        program.reward_value,
        "referral_reward",
        eventId,
        `Referral reward conversion from referee ${event.referee_id}`
      );
      rewardDetail = `Credited wallet by ${program.reward_value}`;
    } else if (program.reward_type === "loyalty") {
      await this.adjustLoyaltyPoints(
        event.referrer_id,
        program.reward_value,
        `Referral reward conversion from referee ${event.referee_id}`,
        "referral_executor"
      );
      rewardDetail = `Awarded loyalty points by ${program.reward_value}`;
    } else if (program.reward_type === "gift_card") {
      const codeString = `REF-GC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      await this.createGiftCards([
        {
          code: codeString,
          initial_balance: program.reward_value,
          current_balance: program.reward_value,
          currency_code: "INR",
          is_active: true,
          status: "active",
        },
      ]);
      rewardDetail = `Created gift card code ${codeString} value ${program.reward_value}`;
      
      // Emit gift card created notification!
      await this.sendNotification("gift_card_created", event.referrer_id, {
        code: codeString,
        balance: (program.reward_value / 100).toFixed(2),
        expiry: "Never",
      });
    }

    // Update event to terminal reviewed status
    await this.updateReferralEvents({
      selector: { id: eventId },
      data: { status: "reviewed", metadata: { ...event.metadata, reward_detail: rewardDetail } },
    });

    // Increment code usage
    const refCode = await this.retrieveReferralCode(event.referral_code_id);
    if (refCode) {
      await this.updateReferralCodes({
        selector: { id: refCode.id },
        data: { usage_count: refCode.usage_count + 1 },
      });
    }

    // Track Analytics
    await this.trackAnalytics("referral_reward_earned", event.referrer_id, {
      event_id: eventId,
      reward_type: program.reward_type,
      reward_value: program.reward_value,
      reward_detail: rewardDetail,
    });

    // Send Notification
    await this.sendNotification("referral_reward_earned", event.referrer_id, {
      reward_type: program.reward_type,
      reward_value: program.reward_value,
    });

    await this.emitEvent("referral.reward_issued", { event_id: eventId, reward_detail: rewardDetail });

    return { success: true, rewardDetail };
  }
}

export default RewardsModuleService;
