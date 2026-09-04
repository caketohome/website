/**
 * CakeToHome Popup & Engagement Manager - Comprehensive Trigger Evaluation Engine
 * Evaluates configured trigger conditions (Immediate, Time on Page, Exit Intent, Back Navigation,
 * Scroll Depth, Inactivity, Cart Conditions, Page Context, Login State, Visitor Type, Abandoned Cart)
 * with strict deterministic support for ANY (OR) and ALL (AND) combinator logic.
 */

import { PopupCampaign, EngagementContext, PopupTriggerConfig } from "./types";

export interface SingleTriggerStatus {
  satisfied: boolean;
  reason: string;
}

export interface DetailedTriggerEvaluationResult {
  isTriggered: boolean;
  combinator: "ANY" | "ALL";
  enabledTriggers: string[];
  matchedTriggers: string[];
  unfulfilledTriggers: string[];
  triggerSummaries: Record<string, SingleTriggerStatus>;
  reason: string;
}

/**
 * Evaluates a single named trigger against the active context and event.
 */
export function evaluateSingleTrigger(
  triggerName: string,
  triggerConfig: PopupTriggerConfig,
  context: EngagementContext,
  event?: { type: string; value?: any }
): SingleTriggerStatus {
  if (event?.type === "manual_test") {
    return { satisfied: true, reason: "Manual Test Override" };
  }

  switch (triggerName) {
    case "immediate": {
      // Immediate trigger is satisfied once page and engagement context are initialized
      return { satisfied: true, reason: "Immediate (Page Loaded)" };
    }

    case "time_on_page": {
      const requiredSecs = typeof triggerConfig.timeOnPageSeconds === "number" ? triggerConfig.timeOnPageSeconds : 3;
      const currentSecs = context.session?.timeOnSiteSeconds ?? 0;
      const satisfied = currentSecs >= requiredSecs;
      return {
        satisfied,
        reason: satisfied
          ? `Time on page satisfied (${currentSecs}s >= ${requiredSecs}s)`
          : `Time on page pending (${currentSecs}s < ${requiredSecs}s)`,
      };
    }

    case "exit_intent": {
      const satisfied = Boolean(context.navigation?.exitIntent || event?.type === "exit_intent");
      return {
        satisfied,
        reason: satisfied ? "Exit intent detected (cursor boundary)" : "Exit intent not detected",
      };
    }

    case "back_navigation": {
      const satisfied = Boolean(context.navigation?.backAttempt || event?.type === "back_navigation");
      return {
        satisfied,
        reason: satisfied ? "Browser back navigation attempt detected" : "Back navigation not triggered",
      };
    }

    case "scroll_depth": {
      const requiredDepth = typeof triggerConfig.scrollDepthPercent === "number" ? triggerConfig.scrollDepthPercent : 40;
      const currentDepth =
        typeof event?.value === "number" && event.type === "scroll_depth"
          ? event.value
          : context.navigation?.maxScrollDepth ?? 0;
      const satisfied = currentDepth >= requiredDepth;
      return {
        satisfied,
        reason: satisfied
          ? `Scroll depth satisfied (${Math.round(currentDepth)}% >= ${requiredDepth}%)`
          : `Scroll depth pending (${Math.round(currentDepth)}% < ${requiredDepth}%)`,
      };
    }

    case "inactivity": {
      const requiredInactivity = typeof triggerConfig.inactivitySeconds === "number" ? triggerConfig.inactivitySeconds : 30;
      const currentInactivity =
        typeof event?.value === "number" && event.type === "inactivity"
          ? event.value
          : context.session?.inactivitySeconds ?? 0;
      const satisfied = currentInactivity >= requiredInactivity;
      return {
        satisfied,
        reason: satisfied
          ? `User inactivity threshold reached (${currentInactivity}s >= ${requiredInactivity}s)`
          : `User actively interacting (${currentInactivity}s < ${requiredInactivity}s)`,
      };
    }

    case "cart_condition": {
      const minItems = triggerConfig.cartItemCountMin ?? 1;
      const minValue = triggerConfig.cartMinValue ?? 0;
      const maxValue = triggerConfig.cartMaxValue;
      const cartItems = context.cart?.itemCount ?? 0;
      const cartTotal = context.cart?.total ?? 0;

      const itemsOk = cartItems >= minItems;
      const minValOk = cartTotal >= minValue;
      const maxValOk = maxValue === undefined || cartTotal <= maxValue;
      const satisfied = itemsOk && minValOk && maxValOk;

      return {
        satisfied,
        reason: satisfied
          ? `Cart conditions met (${cartItems} items >= ${minItems}, ₹${cartTotal} in range)`
          : `Cart condition unmet (Items: ${cartItems}/${minItems}, Total: ₹${cartTotal})`,
      };
    }

    case "page_context": {
      const allowedPages = triggerConfig.pageContext || ["all"];
      if (allowedPages.includes("all")) {
        return { satisfied: true, reason: "Page context matches (All pages allowed)" };
      }
      const currentPath = (context.navigation?.pathname || "/").toLowerCase();
      const matchedPage = allowedPages.find((p) => {
        if (p === "home" && (currentPath === "/" || currentPath === "")) return true;
        if (p === "product" && (currentPath.includes("/products/") || currentPath.includes("/product/"))) return true;
        if (p === "category" && (currentPath.includes("/categories/") || currentPath.includes("/category/"))) return true;
        if (p === "cart" && currentPath.includes("/cart")) return true;
        if (p === "checkout" && currentPath.includes("/checkout")) return true;
        if (p === "search" && currentPath.includes("/search")) return true;
        return false;
      });

      const satisfied = Boolean(matchedPage);
      return {
        satisfied,
        reason: satisfied
          ? `Page context matches (${matchedPage})`
          : `Page context mismatch (Current: ${currentPath}, Allowed: ${allowedPages.join(", ")})`,
      };
    }

    case "login_state": {
      const allowedStates = triggerConfig.loginState || ["all"];
      if (allowedStates.includes("all")) {
        return { satisfied: true, reason: "Login state matches (All states allowed)" };
      }
      const userStatus = context.customer?.status || (context.customer?.isLoggedIn ? "logged_in" : "guest");
      const satisfied = allowedStates.includes(userStatus as any);
      return {
        satisfied,
        reason: satisfied
          ? `Login state matches (${userStatus})`
          : `Login state mismatch (Current: ${userStatus}, Allowed: ${allowedStates.join(", ")})`,
      };
    }

    case "visitor_type": {
      const allowedTypes = triggerConfig.visitorType || ["all"];
      if (allowedTypes.includes("all")) {
        return { satisfied: true, reason: "Visitor type matches (All visitors allowed)" };
      }
      const isFirst = (context.session?.visitCount ?? 1) <= 1;
      const satisfied =
        (allowedTypes.includes("first_visit") && isFirst) ||
        (allowedTypes.includes("returning") && !isFirst);
      return {
        satisfied,
        reason: satisfied
          ? `Visitor type matches (${isFirst ? "first_visit" : "returning"})`
          : `Visitor type mismatch (Current: ${isFirst ? "first_visit" : "returning"})`,
      };
    }

    case "abandoned_cart": {
      const hasAbandoned = Boolean(context.cart?.hasItems && !context.checkout?.active);
      return {
        satisfied: hasAbandoned,
        reason: hasAbandoned ? "Abandoned cart detected (items in cart, not in checkout)" : "No abandoned cart items",
      };
    }

    default:
      return { satisfied: false, reason: `Unknown trigger "${triggerName}"` };
  }
}

/**
 * Returns complete diagnostic trigger evaluation including individual trigger statuses.
 */
export function evaluateCampaignTriggersDetailed(
  campaign: PopupCampaign,
  context: EngagementContext,
  event?: { type: string; value?: any }
): DetailedTriggerEvaluationResult {
  if (!campaign) {
    return {
      isTriggered: false,
      combinator: "ANY",
      enabledTriggers: [],
      matchedTriggers: [],
      unfulfilledTriggers: [],
      triggerSummaries: {},
      reason: "Campaign is undefined",
    };
  }
  const version = campaign.current_version || campaign.draft_version;
  if (!version) {
    return {
      isTriggered: false,
      combinator: "ANY",
      enabledTriggers: [],
      matchedTriggers: [],
      unfulfilledTriggers: [],
      triggerSummaries: {},
      reason: "Campaign has no active or draft version configured",
    };
  }

  const trigger = version.trigger || {};
  let enabledTriggers: string[] =
    trigger.enabled_triggers && trigger.enabled_triggers.length > 0
      ? trigger.enabled_triggers
      : inferEnabledTriggers(trigger, campaign.popup_type);

  // DETERMINISTIC DEFAULT: If no trigger is configured, default to Immediate (Page Load)
  if (enabledTriggers.length === 0) {
    enabledTriggers = ["immediate"];
  }

  const combinator = trigger.combinator || "ANY";
  const summaries: Record<string, SingleTriggerStatus> = {};
  const matchedTriggers: string[] = [];
  const unfulfilledTriggers: string[] = [];

  for (const tName of enabledTriggers) {
    const res = evaluateSingleTrigger(tName, trigger, context, event);
    summaries[tName] = res;
    if (res.satisfied) {
      matchedTriggers.push(tName);
    } else {
      unfulfilledTriggers.push(tName);
    }
  }

  let isTriggered = false;
  let reason = "";

  if (combinator === "ALL") {
    isTriggered = unfulfilledTriggers.length === 0;
    reason = isTriggered
      ? `ALL mode: All ${enabledTriggers.length} triggers satisfied (${matchedTriggers.join(", ")})`
      : `ALL mode: Waiting for ${unfulfilledTriggers.join(", ")}`;
  } else {
    // ANY (OR)
    isTriggered = matchedTriggers.length > 0;
    reason = isTriggered
      ? `ANY mode: Matched ${matchedTriggers.join(", ")}`
      : `ANY mode: None of the ${enabledTriggers.length} triggers satisfied`;
  }

  return {
    isTriggered,
    combinator,
    enabledTriggers,
    matchedTriggers,
    unfulfilledTriggers,
    triggerSummaries: summaries,
    reason,
  };
}

/**
 * Checks whether a campaign's configured trigger conditions are satisfied given the current event and context.
 */
export function evaluateCampaignTriggers(
  campaign: PopupCampaign,
  context: EngagementContext,
  event?: { type: string; value?: any }
): boolean {
  const detailed = evaluateCampaignTriggersDetailed(campaign, context, event);
  return detailed.isTriggered;
}

/**
 * Infers enabled trigger list from legacy or partial trigger config objects.
 */
export function inferEnabledTriggers(trigger: any, popupType?: string): string[] {
  if (!trigger) return ["immediate"];

  // If enabled_triggers was explicitly set to an empty array, default to immediate
  if (Array.isArray(trigger.enabled_triggers) && trigger.enabled_triggers.length === 0) {
    return ["immediate"];
  }

  const list: string[] = [];

  if (trigger.immediate) {
    list.push("immediate");
  }

  if (typeof trigger.timeOnPageSeconds === "number") {
    list.push("time_on_page");
  }

  if (trigger.exitIntent || popupType === "CART_EXIT" || popupType === "PRODUCT_EXIT") {
    list.push("exit_intent");
  }

  if (trigger.backNavigation) {
    list.push("back_navigation");
  }

  if (typeof trigger.scrollDepthPercent === "number") {
    list.push("scroll_depth");
  }

  if (typeof trigger.inactivitySeconds === "number") {
    list.push("inactivity");
  }

  if (typeof trigger.cartItemCountMin === "number" || typeof trigger.cartMinValue === "number" || typeof trigger.cartMaxValue === "number") {
    list.push("cart_condition");
  }

  if (trigger.pageContext && trigger.pageContext.length > 0 && !trigger.pageContext.includes("all")) {
    list.push("page_context");
  }

  if (trigger.loginState && trigger.loginState.length > 0 && !trigger.loginState.includes("all")) {
    list.push("login_state");
  }

  if (trigger.visitorType && trigger.visitorType.length > 0 && !trigger.visitorType.includes("all")) {
    list.push("visitor_type");
  }

  if (trigger.abandonedCart || popupType === "ABANDONED_CART") {
    list.push("abandoned_cart");
  }

  if (list.length === 0) {
    return ["immediate"];
  }

  return list;
}
