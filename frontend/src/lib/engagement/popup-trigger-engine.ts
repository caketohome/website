/**
 * CakeToHome Popup & Engagement Manager - Comprehensive Trigger Evaluation Engine
 * Evaluates configured trigger conditions (Immediate, Time on Page, Exit Intent, Scroll, Inactivity, Cart, Location, etc.)
 * with support for ANY (OR) and ALL (AND) combinator logic.
 */

import { PopupCampaign, EngagementContext } from "./types";

export interface TriggerEvaluationResult {
  isTriggered: boolean;
  matchedTriggers: string[];
  combinator: "ANY" | "ALL";
}

/**
 * Checks whether a campaign's configured trigger conditions are satisfied given the current event and context.
 */
export function evaluateCampaignTriggers(
  campaign: PopupCampaign,
  context: EngagementContext,
  event: { type: string; value?: any }
): boolean {
  const version = campaign.current_version || campaign.draft_version;
  if (!version) return false;

  const trigger = version.trigger || {};
  const enabledTriggers: string[] = trigger.enabled_triggers && trigger.enabled_triggers.length > 0
    ? trigger.enabled_triggers
    : inferEnabledTriggers(trigger, campaign.popup_type);

  const combinator = trigger.combinator || "ANY";

  // If no triggers configured at all, default to false unless manual test
  if (enabledTriggers.length === 0) {
    if (event.type === "manual_test") return true;
    return false;
  }

  const results = enabledTriggers.map((tName) => {
    switch (tName) {
      case "immediate":
        return event.type === "page_load" || event.type === "immediate" || event.type === "manual_test";

      case "time_on_page": {
        const requiredSecs = typeof trigger.timeOnPageSeconds === "number" ? trigger.timeOnPageSeconds : 3;
        const currentSecs = context.session?.timeOnSiteSeconds ?? 0;
        return (
          (event.type === "time_on_page" || event.type === "page_load" || event.type === "manual_test") &&
          currentSecs >= requiredSecs
        );
      }

      case "exit_intent":
        return event.type === "exit_intent" || event.type === "manual_test";

      case "back_navigation":
        return event.type === "back_navigation" || event.type === "manual_test";

      case "scroll_depth": {
        const requiredDepth = typeof trigger.scrollDepthPercent === "number" ? trigger.scrollDepthPercent : 40;
        const currentDepth = typeof event.value === "number" ? event.value : 0;
        return (event.type === "scroll_depth" && currentDepth >= requiredDepth) || event.type === "manual_test";
      }

      case "inactivity": {
        const requiredInactivity = typeof trigger.inactivitySeconds === "number" ? trigger.inactivitySeconds : 30;
        const currentInactivity = typeof event.value === "number" ? event.value : 0;
        return (event.type === "inactivity" && currentInactivity >= requiredInactivity) || event.type === "manual_test";
      }

      case "cart_condition": {
        const minItems = trigger.cartItemCountMin ?? 1;
        const minValue = trigger.cartMinValue ?? 0;
        const maxValue = trigger.cartMaxValue;
        const cartItems = context.cart?.itemCount ?? 0;
        const cartTotal = context.cart?.total ?? 0;

        const itemsOk = cartItems >= minItems;
        const minValOk = cartTotal >= minValue;
        const maxValOk = maxValue === undefined || cartTotal <= maxValue;
        return itemsOk && minValOk && maxValOk;
      }

      case "page_context": {
        const allowedPages = trigger.pageContext || ["all"];
        if (allowedPages.includes("all")) return true;
        const currentPath = context.navigation?.pathname || "/";
        return allowedPages.some((p) => {
          if (p === "home" && (currentPath === "/" || currentPath === "")) return true;
          if (p === "product" && currentPath.includes("/products/")) return true;
          if (p === "category" && currentPath.includes("/categories/")) return true;
          if (p === "cart" && currentPath.includes("/cart")) return true;
          if (p === "checkout" && currentPath.includes("/checkout")) return true;
          return false;
        });
      }

      case "login_state": {
        const allowedStates = trigger.loginState || ["all"];
        if (allowedStates.includes("all")) return true;
        const userStatus = context.customer?.status || (context.customer?.isLoggedIn ? "logged_in" : "guest");
        return allowedStates.includes(userStatus as any);
      }

      case "visitor_type": {
        const allowedTypes = trigger.visitorType || ["all"];
        if (allowedTypes.includes("all")) return true;
        const isFirst = (context.session?.visitCount ?? 1) <= 1;
        if (allowedTypes.includes("first_visit") && isFirst) return true;
        if (allowedTypes.includes("returning") && !isFirst) return true;
        return false;
      }

      case "abandoned_cart": {
        return Boolean(context.cart?.hasItems && !context.checkout?.active);
      }

      default:
        return false;
    }
  });

  if (combinator === "ALL") {
    return results.every(Boolean);
  } else {
    return results.some(Boolean);
  }
}

/**
 * Infers enabled trigger list from legacy or partial trigger config objects.
 */
function inferEnabledTriggers(trigger: any, popupType?: string): string[] {
  const list: string[] = [];

  if (trigger.immediate) {
    list.push("immediate");
  }

  if (typeof trigger.timeOnPageSeconds === "number" || (!trigger.exitIntent && !trigger.scrollDepthPercent && popupType === "WELCOME")) {
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

  if (trigger.pageContext && trigger.pageContext.length > 0) {
    list.push("page_context");
  }

  if (trigger.loginState && trigger.loginState.length > 0) {
    list.push("login_state");
  }

  if (trigger.visitorType && trigger.visitorType.length > 0) {
    list.push("visitor_type");
  }

  if (trigger.abandonedCart || popupType === "ABANDONED_CART") {
    list.push("abandoned_cart");
  }

  return list;
}
