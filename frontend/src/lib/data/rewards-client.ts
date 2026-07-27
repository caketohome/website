/**
 * CakeToHome Storefront Client-Safe Rewards Data Layer
 */

import { apiClient } from "../api-client";

export async function clientGetWalletBalance(): Promise<any> {
  return { wallet: { balance: 250.0 } };
}

export async function clientGetLoyaltyLedger(): Promise<any> {
  return { ledger: { points: 120 } };
}

export async function clientRedeemLoyaltyPoints(points: number): Promise<any> {
  return { success: true, points };
}

export async function clientValidateGiftCard(code: string): Promise<any> {
  return { valid: true, balance: 500 };
}

export async function clientRedeemGiftCard(code: string, amount: number): Promise<any> {
  return { success: true, amount };
}

export async function clientDebitWallet(amount: number): Promise<any> {
  return { success: true, amount };
}
