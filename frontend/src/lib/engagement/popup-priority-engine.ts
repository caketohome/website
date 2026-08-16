/**
 * CakeToHome Popup & Engagement Manager - Priority & Conflict Arbitration Engine
 * Enforces strict hierarchy to ensure exactly one highest-priority popup is rendered at any time.
 */

import { PopupCampaign, PopupType, EngagementContext } from "./types";
import { evaluateAllRules } from "./popup-rule-engine";

/**
 * Standard Hierarchical Priority Base Ratings
 */
export const POPUP_TYPE_PRIORITY_BASE: Record<PopupType, number> = {
  LOGIN: 1000,
  SIGNUP: 950,
  WISHLIST_AUTH: 900,
  ACCOUNT: 850,
  CART_EXIT: 800,
  ABANDONED_CART: 750,
  PRODUCT_EXIT: 700,
  WELCOME: 600,
  MEMBER: 500,
  RETURNING: 400,
  PROMOTIONAL: 300,
};

/**
 * Evaluates audience constraints (devices, customer status, cities, branches, categories, products, cart values).
 */
export function matchesAudience(campaign: PopupCampaign, context: EngagementContext): boolean {
  const version = campaign.current_version || campaign.draft_version;
  if (!version || !version.audience) return true;

  const { audience } = version;

  // 1. Device match
  if (audience.devices && audience.devices.length > 0 && context.session?.deviceType) {
    if (!audience.devices.includes(context.session.deviceType)) {
      return false;
    }
  }

  // 2. Customer status match
  if (audience.customerStatus && audience.customerStatus.length > 0 && !audience.customerStatus.includes("all")) {
    const custStatus = context.customer?.status || (context.customer?.isLoggedIn ? "logged_in" : "guest");
    if (!audience.customerStatus.includes(custStatus)) {
      return false;
    }
  }

  // 3. City targeting
  if (audience.cityIds && audience.cityIds.length > 0) {
    const customerCity = context.customer?.cityId;
    if (!customerCity || !audience.cityIds.includes(customerCity)) {
      return false;
    }
  }

  // 4. Branch targeting
  if (audience.branchIds && audience.branchIds.length > 0) {
    const customerBranch = context.customer?.branchId;
    if (!customerBranch || !audience.branchIds.includes(customerBranch)) {
      return false;
    }
  }

  // 5. Category targeting
  if (audience.categoryIds && audience.categoryIds.length > 0) {
    const currentCategory = context.product?.categoryId;
    if (!currentCategory || !audience.categoryIds.includes(currentCategory)) {
      return false;
    }
  }

  // 6. Product targeting
  if (audience.productIds && audience.productIds.length > 0) {
    const currentProduct = context.product?.id;
    if (!currentProduct || !audience.productIds.includes(currentProduct)) {
      return false;
    }
  }

  // 7. Cart Value range
  if (typeof audience.minCartValue === "number") {
    if ((context.cart?.total || 0) < audience.minCartValue) return false;
  }
  if (typeof audience.maxCartValue === "number") {
    if ((context.cart?.total || 0) > audience.maxCartValue) return false;
  }

  return true;
}

/**
 * Checks schedule validity against server/client timestamp.
 */
export function isWithinSchedule(campaign: PopupCampaign, now: Date = new Date()): boolean {
  const version = campaign.current_version || campaign.draft_version;
  const schedule = version?.schedule || { startAt: campaign.start_at, endAt: campaign.end_at };

  if (schedule.startAt) {
    const start = new Date(schedule.startAt).getTime();
    if (now.getTime() < start) return false;
  }

  if (schedule.endAt) {
    const end = new Date(schedule.endAt).getTime();
    if (now.getTime() > end) return false;
  }

  return true;
}

/**
 * Calculates effective absolute priority score for candidate campaign.
 */
export function calculateEffectivePriority(campaign: PopupCampaign): number {
  const typeBase = POPUP_TYPE_PRIORITY_BASE[campaign.popup_type] || 100;
  const userPriority = Number(campaign.priority) || 100;
  return userPriority * 10 + typeBase;
}

/**
 * Arbitrates across all candidates and returns the single winner with highest priority.
 */
export function selectWinningPopup(
  campaigns: PopupCampaign[],
  context: EngagementContext,
  isSuppressed: (campaignId: string) => boolean
): PopupCampaign | null {
  // If checkout is actively processing, suppress exit/marketing popups
  if (context.checkout?.active) {
    return null;
  }

  const eligible = campaigns.filter((camp) => {
    const version = camp.current_version || camp.draft_version;
    if (!camp.enabled || !version) {
      return false;
    }

    if (isSuppressed(camp.id)) {
      return false;
    }

    if (!isWithinSchedule(camp)) {
      return false;
    }

    if (!matchesAudience(camp, context)) {
      return false;
    }

    if (!evaluateAllRules(version.rules, context)) {
      return false;
    }

    // Special trigger-specific validations:
    if (camp.popup_type === "CART_EXIT" && (!context.cart || !context.cart.hasItems || context.cart.itemCount === 0)) {
      return false;
    }

    if (camp.popup_type === "PRODUCT_EXIT" && !context.product?.id) {
      return false;
    }

    return true;
  });

  if (eligible.length === 0) return null;

  // Sort descending by effective priority score, breaking ties with most recently updated
  eligible.sort((a, b) => {
    const priDiff = calculateEffectivePriority(b) - calculateEffectivePriority(a);
    if (priDiff !== 0) return priDiff;
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  return eligible[0] || null;
}
