/**
 * CakeToHome Storefront Marketing Toolkit Client-Safe Data Layer
 */

import { apiClient } from "../api-client";

export async function clientListEligiblePopups(ctx?: any): Promise<any> {
  return { popups: [] };
}

export async function clientSubscribeNewsletter(input: any): Promise<any> {
  return { success: true };
}

export async function clientUnsubscribeNewsletter(email: string): Promise<any> {
  return { success: true };
}

export async function clientPlayGamification(input: any): Promise<any> {
  return { prize: { name: "10% Off Cake" } };
}

export async function clientRedeemGamificationReward(reward_id: string): Promise<any> {
  return { success: true };
}

export async function clientResolveQRCode(code: string): Promise<any> {
  return { code, redirectUrl: "/store" };
}

export async function clientScheduleAbandonedCartRecovery(input: any): Promise<any> {
  return { scheduled: true };
}

export async function clientListPublicOffers(filters?: any): Promise<any> {
  return { offers: [] };
}

export async function clientEvaluateOffers(context: any): Promise<any> {
  return { applicableOffers: [] };
}
