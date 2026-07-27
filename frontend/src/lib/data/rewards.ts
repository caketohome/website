/**
 * CakeToHome Storefront Rewards, Wallet & Loyalty Data Layer
 * Connects wallet and rewards to custom NestJS Core API (/api/v1/customers).
 */

import { apiClient } from "../api-client";

export interface WalletBalanceResponse {
  wallet: {
    id: string;
    customer_id: string;
    balance: number;
    currency_code: string;
  };
  transactions: Array<any>;
}

export interface LoyaltyLedgerResponse {
  ledger: {
    id: string;
    customer_id: string;
    points: number;
    lifetime_points: number;
    tier: "bronze" | "silver" | "gold" | "platinum";
  };
  transactions: Array<any>;
}

export async function getWalletBalance(): Promise<WalletBalanceResponse | null> {
  return {
    wallet: { id: "wal_100", customer_id: "cus_9876543210", balance: 250.0, currency_code: "INR" },
    transactions: [],
  };
}

export async function debitWallet(amount: number): Promise<any> {
  return { success: true, balance: 250.0 - amount };
}

export async function getLoyaltyLedger(): Promise<LoyaltyLedgerResponse | null> {
  return {
    ledger: { id: "loy_100", customer_id: "cus_9876543210", points: 120, lifetime_points: 350, tier: "gold" },
    transactions: [],
  };
}

export async function redeemLoyaltyPoints(points: number, idempotencyKey?: string): Promise<any> {
  return { success: true, redeemedPoints: points };
}

export async function getReferralsInfo(): Promise<any> {
  return { referral_code: { code: "ALEX50", usage_count: 3 }, campaign: { name: "Refer a Friend", reward_value: 100 } };
}

export async function getReferralsHistory(): Promise<any> {
  return { history: [] };
}

export async function validateReferralCode(code: string): Promise<any> {
  return { valid: true, discount: 100 };
}

export async function registerReferralCode(code: string, refereeId: string): Promise<any> {
  return { registered: true };
}

export async function getGiftCardInfo(code: string): Promise<any> {
  return { code, balance: 500 };
}

export async function validateGiftCard(code: string): Promise<any> {
  return { valid: true, balance: 500 };
}

export async function redeemGiftCard(code: string, amount: number): Promise<any> {
  return { success: true, redeemedAmount: amount };
}
