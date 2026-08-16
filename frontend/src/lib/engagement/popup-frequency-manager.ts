/**
 * CakeToHome Popup & Engagement Manager - Frequency & Cooldown Manager
 * Enforces session limits, visitor limits, customer cooldowns, and cart-change triggers.
 */

import { PopupCampaign, EngagementContext } from "./types";

const FREQUENCY_STORAGE_PREFIX = "_cth_popup_freq_";
const inMemoryFrequencyStore = new Map<string, any>();

export interface PopupFrequencyRecord {
  campaignId: string;
  totalShows: number;
  lastShownAt: number;
  lastDismissedAt?: number;
  sessionShows: number;
  shownOnProducts: string[];
  lastCartHash?: string;
}

/**
 * Computes a lightweight hash of cart items to detect meaningful cart alterations.
 */
export function computeCartHash(cart: EngagementContext["cart"]): string {
  if (!cart || !cart.items || cart.items.length === 0) return "empty_cart";
  return cart.items
    .map((item) => `${item.id}:${item.quantity}:${item.price}`)
    .sort()
    .join("|");
}

/**
 * Retrieves frequency record for a campaign from persistent browser storage or memory fallback.
 */
export function getFrequencyRecord(campaignId: string): PopupFrequencyRecord {
  const fallback: PopupFrequencyRecord = {
    campaignId,
    totalShows: 0,
    lastShownAt: 0,
    sessionShows: 0,
    shownOnProducts: [],
  };

  if (typeof window === "undefined") {
    return inMemoryFrequencyStore.get(campaignId) || fallback;
  }

  try {
    const localRaw = localStorage.getItem(`${FREQUENCY_STORAGE_PREFIX}${campaignId}`);
    const sessionRaw = sessionStorage.getItem(`${FREQUENCY_STORAGE_PREFIX}${campaignId}_session`);

    const localData = localRaw ? JSON.parse(localRaw) : {};
    const sessionShows = sessionRaw ? Number(sessionRaw) : (localData.sessionShows || 0);

    return {
      campaignId,
      totalShows: localData.totalShows || 0,
      lastShownAt: localData.lastShownAt || 0,
      lastDismissedAt: localData.lastDismissedAt,
      sessionShows,
      shownOnProducts: Array.isArray(localData.shownOnProducts) ? localData.shownOnProducts : [],
      lastCartHash: localData.lastCartHash,
    };
  } catch {
    return inMemoryFrequencyStore.get(campaignId) || fallback;
  }
}

/**
 * Persists an impression / display event into frequency storage.
 */
export function recordFrequencyDisplay(campaignId: string, context: EngagementContext): void {
  const existing = getFrequencyRecord(campaignId);
  const now = Date.now();

  const updated: PopupFrequencyRecord = {
    ...existing,
    totalShows: existing.totalShows + 1,
    lastShownAt: now,
    sessionShows: existing.sessionShows + 1,
    shownOnProducts: context.product?.id
      ? Array.from(new Set([...existing.shownOnProducts, context.product.id]))
      : existing.shownOnProducts,
    lastCartHash: computeCartHash(context.cart),
  };

  inMemoryFrequencyStore.set(campaignId, updated);

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${FREQUENCY_STORAGE_PREFIX}${campaignId}`, JSON.stringify({
        totalShows: updated.totalShows,
        lastShownAt: updated.lastShownAt,
        lastDismissedAt: updated.lastDismissedAt,
        sessionShows: updated.sessionShows,
        shownOnProducts: updated.shownOnProducts,
        lastCartHash: updated.lastCartHash,
      }));

      sessionStorage.setItem(`${FREQUENCY_STORAGE_PREFIX}${campaignId}_session`, String(updated.sessionShows));
    } catch {
      // Ignore storage quota limits in private browsing
    }
  }
}

/**
 * Checks whether a campaign is currently blocked by frequency, cooldown, or session limits.
 */
export function isFrequencyCapped(campaign: PopupCampaign, context: EngagementContext): boolean {
  const version = campaign.current_version || campaign.draft_version;
  const freq = version?.frequency;
  if (!freq) return false;

  const record = getFrequencyRecord(campaign.id);
  const now = Date.now();

  // 1. Cooldown seconds check
  const cooldownSecs = typeof freq.cooldownSeconds === "number"
    ? freq.cooldownSeconds
    : freq.scope === "visitor"
    ? 86400
    : 0;
  if (record.lastShownAt > 0 && cooldownSecs > 0) {
    const elapsedSeconds = (now - record.lastShownAt) / 1000;
    if (elapsedSeconds < cooldownSecs) {
      return true; // Still within cooldown period
    }
  }

  // 2. Session Limit check
  const sessionLimit = freq.sessionLimit ?? (freq.scope === "session" ? (freq.maxShows ?? 1) : null);
  if (sessionLimit !== null && record.sessionShows >= sessionLimit) {
    return true; // Exceeded allowed displays this session
  }

  // 3. Visitor / Total limit check
  const visitorLimit = freq.visitorLimit ?? (freq.scope === "visitor" ? (freq.maxShows ?? 1) : null);
  if (visitorLimit !== null && record.totalShows >= visitorLimit) {
    return true;
  }

  // 4. Product-specific limit
  if (freq.scope === "product" && context.product?.id) {
    if (record.shownOnProducts.includes(context.product.id)) {
      return true; // Already shown for this specific product
    }
  }

  // 5. Cart Change requirement check
  if (freq.cartChangeRequired && campaign.popup_type === "CART_EXIT") {
    const currentCartHash = computeCartHash(context.cart);
    if (record.lastCartHash && record.lastCartHash === currentCartHash && record.totalShows > 0) {
      return true; // Cart hasn't changed since last popup show
    }
  }

  return false;
}
