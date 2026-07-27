import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { REWARDS_MODULE } from "../../../../../modules/rewards";

/**
 * GET /admin/rewards/customers/:id
 * Admin — retrieve unified customer rewards overview and history.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const rewardsModuleService = req.scope.resolve(REWARDS_MODULE) as any;
  const customerId = req.params.id;

  try {
    // 1. Get Wallet
    const wallet = await rewardsModuleService.getOrCreateWallet(customerId).catch(() => null);

    // 2. Get Loyalty Ledger
    let loyalty = null;
    const [ledger] = await rewardsModuleService.listLoyaltyLedgers({ customer_id: customerId }).catch(() => []);
    if (ledger) {
      loyalty = ledger;
    }

    // 3. Get Referral Code
    let referralCode = null;
    const [code] = await rewardsModuleService.listReferralCodes({ customer_id: customerId }).catch(() => []);
    if (code) {
      referralCode = code;
    }

    // 4. Get Referral Statistics
    const referralEvents = await rewardsModuleService.listReferralEvents({ referrer_id: customerId }).catch(() => []);
    const clicksCount = referralEvents.filter((e: any) => e.event_type === "click").length;
    const signupsCount = referralEvents.filter((e: any) => e.event_type === "register").length;
    const qualifiedCount = referralEvents.filter((e: any) => e.qualified).length;

    // 5. Query unified chronological customer timeline
    const timeline: any[] = [];

    if (wallet) {
      const walletTxs = await rewardsModuleService.listWalletTransactions({ wallet_id: wallet.id }, { order: { created_at: "DESC" }, take: 50 }).catch(() => []);
      for (const tx of walletTxs) {
        timeline.push({
          id: tx.id,
          type: "wallet",
          timestamp: tx.created_at,
          title: `Wallet ${tx.type.toUpperCase()}`,
          description: tx.description || `Wallet balance ${tx.type}`,
          amount: tx.amount,
        });
      }
    }

    if (loyalty) {
      const loyaltyTxs = await rewardsModuleService.listLoyaltyTransactions({ ledger_id: loyalty.id }, { order: { created_at: "DESC" }, take: 50 }).catch(() => []);
      for (const tx of loyaltyTxs) {
        timeline.push({
          id: tx.id,
          type: "loyalty",
          timestamp: tx.created_at,
          title: `Loyalty Points ${tx.transaction_type.toUpperCase()}`,
          description: tx.description || `Points balance change: ${tx.points} pts`,
          points: tx.points,
        });
      }
    }

    for (const ev of referralEvents) {
      timeline.push({
        id: ev.id,
        type: "referral",
        timestamp: ev.created_at,
        title: `Referral Event: ${ev.event_type.toUpperCase()}`,
        description: `Referee registration signup or conversion tracking.`,
        referee_id: ev.referee_id,
        status: ev.status,
      });
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({
      summary: {
        wallet,
        loyalty,
        referral: {
          code: referralCode,
          stats: {
            clicks: clicksCount,
            signups: signupsCount,
            qualified: qualifiedCount,
          }
        },
        timeline: timeline.slice(0, 100),
      }
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
