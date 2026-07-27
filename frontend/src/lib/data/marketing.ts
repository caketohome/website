/**
 * CakeToHome Storefront Marketing Campaigns Data Layer
 */

import { apiClient } from "../api-client";

export interface PublicCampaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  goal_type: string | null;
  offer_ids: string[] | null;
  branch_ids: string[] | null;
  is_featured: boolean;
  sort_order: number;
  metadata: any;
}

export async function listPublicCampaigns(opts?: { featured?: boolean; type?: string; limit?: number; offset?: number }): Promise<{ campaigns: PublicCampaign[]; count: number; limit: number; offset: number }> {
  return {
    campaigns: [
      {
        id: "camp_cake50",
        name: "50% Off First Cake Order",
        description: "Use coupon CAKE50 at checkout",
        type: "PROMO",
        status: "ACTIVE",
        starts_at: new Date().toISOString(),
        ends_at: null,
        goal_type: "ACQUISITION",
        offer_ids: ["CAKE50"],
        branch_ids: null,
        is_featured: true,
        sort_order: 1,
        metadata: {},
      },
    ],
    count: 1,
    limit: opts?.limit || 10,
    offset: opts?.offset || 0,
  };
}

export async function getPublicCampaign(id: string): Promise<{ campaign: PublicCampaign }> {
  const res = await listPublicCampaigns();
  return { campaign: res.campaigns[0] };
}
