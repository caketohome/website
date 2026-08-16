/**
 * CakeToHome Popup & Engagement Manager - Deterministic AST Rule Engine
 * Evaluates configured rule ASTs against dynamic context safely with zero eval() or arbitrary execution.
 */

import { RuleCondition, RuleGroup, EngagementContext } from "./types";

/**
 * Resolves dot-notation field safely from context, e.g. "cart.itemCount" -> context.cart?.itemCount
 */
export function getContextFieldValue(context: EngagementContext, fieldPath: string): any {
  if (!fieldPath || typeof fieldPath !== "string") return undefined;

  const parts = fieldPath.split(".");
  let curr: any = context;

  for (const part of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[part];
  }

  return curr;
}

/**
 * Evaluates a single RuleCondition against the active context.
 */
export function evaluateCondition(condition: RuleCondition, context: EngagementContext): boolean {
  const actualValue = getContextFieldValue(context, condition.field);
  const expectedValue = condition.value;

  switch (condition.operator) {
    case "equals":
      return actualValue === expectedValue || String(actualValue).toLowerCase() === String(expectedValue).toLowerCase();

    case "not_equals":
      return actualValue !== expectedValue && String(actualValue).toLowerCase() !== String(expectedValue).toLowerCase();

    case "contains":
      if (Array.isArray(actualValue)) {
        return actualValue.includes(expectedValue) || actualValue.some((v) => String(v).toLowerCase() === String(expectedValue).toLowerCase());
      }
      if (typeof actualValue === "string") {
        return actualValue.toLowerCase().includes(String(expectedValue).toLowerCase());
      }
      return false;

    case "not_contains":
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(expectedValue);
      }
      if (typeof actualValue === "string") {
        return !actualValue.toLowerCase().includes(String(expectedValue).toLowerCase());
      }
      return true;

    case "greater_than":
      return Number(actualValue) > Number(expectedValue);

    case "less_than":
      return Number(actualValue) < Number(expectedValue);

    case "greater_than_or_equal":
      return Number(actualValue) >= Number(expectedValue);

    case "less_than_or_equal":
      return Number(actualValue) <= Number(expectedValue);

    case "in":
      if (Array.isArray(expectedValue)) {
        return expectedValue.some((exp) => String(exp).toLowerCase() === String(actualValue).toLowerCase());
      }
      return false;

    case "not_in":
      if (Array.isArray(expectedValue)) {
        return !expectedValue.some((exp) => String(exp).toLowerCase() === String(actualValue).toLowerCase());
      }
      return true;

    case "exists":
      return actualValue !== null && actualValue !== undefined && actualValue !== "";

    case "not_exists":
      return actualValue === null || actualValue === undefined || actualValue === "";

    case "between":
      if (Array.isArray(expectedValue) && expectedValue.length === 2) {
        const num = Number(actualValue);
        return num >= Number(expectedValue[0]) && num <= Number(expectedValue[1]);
      }
      return false;

    case "within_time":
      // Value in seconds
      return Number(actualValue) <= Number(expectedValue);

    case "changed":
      return Boolean(actualValue);

    default:
      return false;
  }
}

/**
 * Recursively evaluates a RuleGroup (with AND / OR / NOT branches).
 */
export function evaluateRuleGroup(group: RuleGroup, context: EngagementContext): boolean {
  if (!group || !Array.isArray(group.conditions) || group.conditions.length === 0) {
    return true; // Empty rule group matches by default
  }

  const results = group.conditions.map((item) => {
    if ("logic" in item) {
      return evaluateRuleGroup(item as RuleGroup, context);
    }
    return evaluateCondition(item as RuleCondition, context);
  });

  if (group.logic === "OR") {
    return results.some((r) => r === true);
  }

  if (group.logic === "NOT") {
    return !results.every((r) => r === true);
  }

  // Default "AND"
  return results.every((r) => r === true);
}

/**
 * Validates whether all configured rule groups for a popup version match the active context.
 */
export function evaluateAllRules(ruleGroups: RuleGroup[] | undefined, context: EngagementContext): boolean {
  if (!ruleGroups || !Array.isArray(ruleGroups) || ruleGroups.length === 0) {
    return true;
  }
  return ruleGroups.every((group) => evaluateRuleGroup(group, context));
}
