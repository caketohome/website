/**
 * CakeToHome Popup & Engagement Manager - Frequency & Cooldown Manager
 * Enforces non-permanent frequency rules (every page load, once per session, cooldown, once per day)
 * and guarantees that logged-out visitors are never permanently blocked.
 */

import { PopupCampaign, EngagementContext, PopupFrequencyConfig } from "./types";

const FREQUENCY_STORAGE_PREFIX = "_cth_popup_freq_v2_";
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
 * Clean up obsolete permanent suppression keys from earlier versions so existing devices are never stuck.
 */
function cleanLegacySuppressionStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const migrationFlag = "_cth_popup_freq_v2_migrated";
    if (!localStorage.getItem(migrationFlag)) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key) {
          if (key.startsWith("_cth_popup_freq_") && !key.startsWith(FREQUENCY_STORAGE_PREFIX)) {
            localStorage.removeItem(key);
          }
          if (key.startsWith("mkt_popup_shown_")) {
            localStorage.removeItem(key);
          }
        }
      }
      localStorage.setItem(migrationFlag, "true");
    }
  } catch {
    // Ignore storage access errors
  }
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
 * Resolves effective cooldown in seconds based on frequency mode, value, and unit.
 */
export function resolveCooldownSeconds(freq?: PopupFrequencyConfig): number {
  if (!freq) return 0;
  const mode = freq.mode || (freq.scope === "session" ? "once_per_session" : "every_page_load");
  if (mode === "every_page_load" || mode === "unlimited") return 0;
  if (mode === "once_per_day") return 86400;

  if (typeof freq.cooldownValue === "number" && freq.cooldownValue > 0) {
    const unit = freq.cooldownUnit || "hours";
    if (unit === "minutes") return freq.cooldownValue * 60;
    if (unit === "hours") return freq.cooldownValue * 3600;
    if (unit === "days") return freq.cooldownValue * 86400;
    return freq.cooldownValue;
  }

  if (typeof freq.cooldownSeconds === "number" && freq.cooldownSeconds > 0) {
    return freq.cooldownSeconds;
  }

  return 0;
}

/**
 * Retrieves frequency record for a campaign from browser storage or memory fallback.
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

  cleanLegacySuppressionStorage();

  try {
    const localRaw = localStorage.getItem(`${FREQUENCY_STORAGE_PREFIX}${campaignId}`);
    const sessionRaw = sessionStorage.getItem(`${FREQUENCY_STORAGE_PREFIX}${campaignId}_session`);

    const localData = localRaw ? JSON.parse(localRaw) : {};
    const sessionShows = sessionRaw !== null ? Number(sessionRaw) : 0;

    return {
      campaignId,
      totalShows: Number(localData.totalShows) || 0,
      lastShownAt: Number(localData.lastShownAt) || 0,
      lastDismissedAt: localData.lastDismissedAt ? Number(localData.lastDismissedAt) : undefined,
      sessionShows: isNaN(sessionShows) ? 0 : sessionShows,
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
      localStorage.setItem(
        `${FREQUENCY_STORAGE_PREFIX}${campaignId}`,
        JSON.stringify({
          totalShows: updated.totalShows,
          lastShownAt: updated.lastShownAt,
          lastDismissedAt: updated.lastDismissedAt,
          shownOnProducts: updated.shownOnProducts,
          lastCartHash: updated.lastCartHash,
        })
      );

      sessionStorage.setItem(`${FREQUENCY_STORAGE_PREFIX}${campaignId}_session`, String(updated.sessionShows));
    } catch {
      // Ignore storage quota limits in private browsing
    }
  }
}

/**
 * Explains frequency eligibility with detailed diagnostic reason for AST simulator.
 */
export function explainFrequencyEligibility(
  campaign: PopupCampaign,
  context: EngagementContext
): { eligible: boolean; reason: string } {
  const version = campaign.current_version || campaign.draft_version;
  const freq = version?.frequency;

  if (!freq) return { eligible: true, reason: "Frequency unconstrained (Every page load)" };

  const mode = freq.mode || (freq.scope === "session" ? "once_per_session" : "every_page_load");

  if (mode === "every_page_load" || mode === "unlimited") {
    return { eligible: true, reason: "Frequency mode: Every page load (Always eligible)" };
  }

  const record = getFrequencyRecord(campaign.id);
  const now = Date.now();

  // 1. Session limit check
  if (mode === "once_per_session") {
    const sessionLimit = freq.sessionLimit ?? freq.maxShows ?? 1;
    if (sessionLimit > 0 && record.sessionShows >= sessionLimit) {
      return {
        eligible: false,
        reason: `Blocked: Once per session limit reached (${record.sessionShows}/${sessionLimit}). Eligible on new session.`,
      };
    }
  }

  // 2. Cooldown check
  if (mode === "cooldown" || mode === "once_per_day" || mode === "custom") {
    const cooldownSecs = resolveCooldownSeconds(freq);
    if (record.lastShownAt > 0 && cooldownSecs > 0) {
      const elapsedSeconds = (now - record.lastShownAt) / 1000;
      if (elapsedSeconds < cooldownSecs) {
        const remaining = Math.ceil(cooldownSecs - elapsedSeconds);
        return {
          eligible: false,
          reason: `Blocked: Cooldown active (${remaining}s remaining)`,
        };
      }
    }
  }

  // 3. Product scope
  if (freq.scope === "product" && context.product?.id) {
    if (record.shownOnProducts.includes(context.product.id)) {
      return {
        eligible: false,
        reason: `Blocked: Already displayed for product ${context.product.id}`,
      };
    }
  }

  // 4. Cart change check
  if (freq.cartChangeRequired && campaign.popup_type === "CART_EXIT") {
    const currentCartHash = computeCartHash(context.cart);
    if (record.lastCartHash && record.lastCartHash === currentCartHash && record.sessionShows > 0) {
      return {
        eligible: false,
        reason: "Blocked: Cart items unchanged since last display in this session",
      };
    }
  }

  return { eligible: true, reason: `Frequency criteria satisfied (${mode})` };
}

/**
 * Checks whether a campaign is currently blocked by frequency, cooldown, or session limits.
 * Default behavior: Always eligible for logged-out visitors unless an explicit session/cooldown is active.
 * NEVER permanently suppresses a device based on previous impressions.
 */
export function isFrequencyCapped(campaign: PopupCampaign, context: EngagementContext): boolean {
  return !explainFrequencyEligibility(campaign, context).eligible;
}
