/**
 * CakeToHome Storefront Marketing Client-Safe Data Layer
 */

import { apiClient } from "../api-client";

export async function clientListPublicCampaigns(): Promise<any> {
  return { campaigns: [], count: 0 };
}

export async function clientGetPublicCampaign(id: string): Promise<any> {
  return { campaign: { id, name: "Special Offer" } };
}
