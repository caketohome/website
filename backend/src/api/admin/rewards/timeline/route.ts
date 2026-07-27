import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../modules/rewards";

/**
 * GET /admin/rewards/timeline
 * Admin — Unified rewards timeline combining all ledger and program logs.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;

  try {
    const customerId = req.query.customer_id as string | undefined;
    const timeline: any[] = [];

    // 1. Wallet Transactions
    const walletFilters: any = {};
    if (customerId) {
      const [wallet] = await rewardsModuleService.listWallets({ customer_id: customerId });
      if (wallet) {
        walletFilters.wallet_id = wallet.id;
      } else {
        walletFilters.wallet_id = "non-existent";
      }
    }
    const walletTxs = await rewardsModuleService.listWalletTransactions(walletFilters, { order: { created_at: "DESC" }, take: 100 });
    for (const tx of walletTxs) {
      timeline.push({
        id: tx.id,
        type: "wallet",
        timestamp: tx.created_at,
        title: `Wallet ${tx.type.toUpperCase()}`,
        description: tx.description || `Wallet balance ${tx.type}`,
        amount: tx.amount,
        reference_type: tx.reference_type,
        reference_id: tx.reference_id,
        customer_id: customerId,
      });
    }

    // 2. Loyalty Transactions
    const loyaltyFilters: any = {};
    if (customerId) {
      const [ledger] = await rewardsModuleService.listLoyaltyLedgers({ customer_id: customerId });
      if (ledger) {
        loyaltyFilters.ledger_id = ledger.id;
      } else {
        loyaltyFilters.ledger_id = "non-existent";
      }
    }
    const loyaltyTxs = await rewardsModuleService.listLoyaltyTransactions(loyaltyFilters, { order: { created_at: "DESC" }, take: 100 });
    for (const tx of loyaltyTxs) {
      timeline.push({
        id: tx.id,
        type: "loyalty",
        timestamp: tx.created_at,
        title: `Loyalty Points ${tx.transaction_type.toUpperCase()}`,
        description: tx.description || `Points balance change: ${tx.points} pts`,
        points: tx.points,
        customer_id: customerId,
      });
    }

    // 3. Referral Events
    const referralFilters: any = {};
    if (customerId) {
      referralFilters.referrer_id = customerId;
    }
    const referralEvents = await rewardsModuleService.listReferralEvents(referralFilters, { order: { created_at: "DESC" }, take: 100 });
    for (const ev of referralEvents) {
      timeline.push({
        id: ev.id,
        type: "referral",
        timestamp: ev.created_at,
        title: `Referral Event: ${ev.event_type.toUpperCase()}`,
        description: `Referee registration signup or order qualification tracking.`,
        customer_id: ev.referrer_id,
        referee_id: ev.referee_id,
        status: ev.status,
      });
    }

    // 4. Fraud Reviews
    const fraudFilters: any = {};
    if (customerId) {
      // Find referral events first
      const evs = await rewardsModuleService.listReferralEvents({ referrer_id: customerId });
      if (evs.length > 0) {
        fraudFilters.referral_event_id = { $in: evs.map((e: any) => e.id) };
      } else {
        fraudFilters.referral_event_id = "non-existent";
      }
    }
    const fraudReviews = await rewardsModuleService.listFraudReviews(fraudFilters, { order: { created_at: "DESC" }, take: 100 });
    for (const fr of fraudReviews) {
      timeline.push({
        id: fr.id,
        type: "fraud",
        timestamp: fr.created_at,
        title: `Referral Fraud Review Gated`,
        description: `Fraud indicator: ${fr.fraud_indicator}. Resolution: ${fr.resolution_status}. Reason: ${fr.reason || "N/A"}`,
        customer_id: customerId,
        indicator: fr.fraud_indicator,
        status: fr.resolution_status,
      });
    }

    // Sort all chronologically descending
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({ timeline });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
