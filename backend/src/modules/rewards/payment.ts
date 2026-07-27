import RewardsModuleService from "./service";

export class RewardsPaymentService {
  private rewardsService: RewardsModuleService;

  constructor({ rewardsModuleService }: { rewardsModuleService: RewardsModuleService }) {
    this.rewardsService = rewardsModuleService;
  }

  /**
   * Evaluates applying multiple gift cards to a payable cart/order amount.
   * Calculates the split balances, validates all cards, and returns a breakdown of applied amounts and remaining payable cash.
   */
  async processSplitPayment(
    codes: string[],
    payableAmount: number,
    currencyCode: string = "INR"
  ): Promise<{
    applied_gift_cards: Array<{ code: string; amount: number; remaining_balance: number }>;
    total_applied: number;
    remaining_payable: number;
  }> {
    let remaining = payableAmount;
    const applied: Array<{ code: string; amount: number; remaining_balance: number }> = [];

    for (const code of codes) {
      if (remaining <= 0) break;

      try {
        const giftCard = await this.rewardsService.validateGiftCard(code, currencyCode);
        const applyAmount = Math.min(giftCard.current_balance, remaining);

        applied.push({
          code,
          amount: applyAmount,
          remaining_balance: giftCard.current_balance - applyAmount,
        });

        remaining -= applyAmount;
      } catch (error: any) {
        throw new Error(`GIFT_CARD_VALIDATION_FAILED: Card ${code} - ${error.message}`);
      }
    }

    return {
      applied_gift_cards: applied,
      total_applied: payableAmount - remaining,
      remaining_payable: remaining,
    };
  }

  /**
   * Finalizes the redemptions of split applied cards during order placement.
   */
  async executeRedemptions(
    applied: Array<{ code: string; amount: number }>,
    orderId: string,
    customerId?: string
  ): Promise<void> {
    for (const item of applied) {
      await this.rewardsService.redeemGiftCard(
        item.code,
        item.amount,
        "order",
        orderId,
        `order_redeem_${orderId}_${item.code}`,
        customerId
      );
    }
  }
}

export default RewardsPaymentService;
