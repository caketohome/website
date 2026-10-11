/**
 * CakeToHome ERP — Cost Allocation Engine Service
 * Phase C7.6 Step 4C: Fixed-Percentage Calculation Engine & Rule Eligibility Validator.
 *
 * ARCHITECTURAL CONTRACT & DOMAIN RULES:
 * 1. FIXED-PERCENTAGE BASIS ONLY:
 *    - Only 'FIXED_PERCENTAGE' is authorized for calculation.
 *    - 'REVENUE_RATIO' and 'EQUAL_SPLIT' remain strictly inactive and rejected if attempted.
 * 2. EXACT 100.00% TARGET VALIDATION:
 *    - Sum of configured target percentages must equal exactly 100.0000%.
 *    - Every target percentage must be strictly > 0 and <= 100.
 * 3. ACCOUNT GOVERNANCE & ELIGIBILITY:
 *    - Only operational expense leaf accounts (5xxx, excluding 5295 & 5296) are eligible.
 *    - Balance Sheet (1xxx, 2xxx, 3xxx), Group accounts, and Revenue (4xxx) are strictly prohibited.
 *    - Accounts 5295 (Cash Rounding) and 5296 (Cash Over/Short) are explicitly blocked.
 * 4. SHARED COST CENTRES ONLY:
 *    - Source cost centres must be central/shared (not directly tied to an operating branch).
 *    - Directly attributable branch expenses must not be allocated again.
 *    - Target cost centre cannot be the source cost centre (no self-allocation).
 * 5. DETERMINISTIC LARGEST-REMAINDER METHOD (Hamilton-Hare Quota):
 *    - Decimal-safe monetary arithmetic in integer paisa (cents).
 *    - Zero JavaScript floating-point errors on final amounts.
 *    - Distributes rounding deficit cent-by-cent to the largest fractional remainders.
 *    - Deterministic tie-breaking by sort_order ASC, then target_cost_centre_id ASC.
 *    - Guarantees sum(destination_amounts) === source_amount down to ₹0.0000.
 */

import {
  CostAllocationDomainError,
  type CostAllocationRuleWithTargets,
  type CostAllocationRuleTargetRow,
  type CostAllocationCalculatedTarget,
} from "../types/accounting.types";

export class CostAllocationEngineService {
  /**
   * Validate that an allocation rule and its targets satisfy all domain and governance constraints.
   *
   * @param rule  The complete rule with target lines.
   * @param allocationDate Optional date to check against rule effective dates.
   * @throws {CostAllocationDomainError} if any constraint is violated.
   */
  static validateRuleEligibility(
    rule: CostAllocationRuleWithTargets,
    allocationDate?: string
  ): void {
    // 1. Rule Active and Non-Deleted Check
    if (!rule.is_active || rule.deleted_at) {
      throw new CostAllocationDomainError(
        "RULE_INACTIVE",
        `Allocation rule '${rule.rule_code}' is inactive or deleted.`
      );
    }

    // 2. Rule Type Check: Only FIXED_PERCENTAGE authorized
    if (rule.rule_type !== "FIXED_PERCENTAGE") {
      throw new CostAllocationDomainError(
        "RULE_TYPE_NOT_AUTHORIZED",
        `Rule type '${rule.rule_type}' is not currently authorized for execution. Only FIXED_PERCENTAGE is supported.`
      );
    }

    // 3. Effective Dates Check
    if (allocationDate) {
      const allocDateStr = allocationDate.slice(0, 10);
      const effFromStr = typeof rule.effective_from === "string" 
        ? rule.effective_from.slice(0, 10) 
        : new Date(rule.effective_from).toISOString().slice(0, 10);
      if (allocDateStr < effFromStr) {
        throw new CostAllocationDomainError(
          "RULE_INACTIVE",
          `Allocation date '${allocDateStr}' is prior to rule effective_from date '${effFromStr}'.`
        );
      }
      if (rule.effective_to) {
        const effToStr = typeof rule.effective_to === "string"
          ? rule.effective_to.slice(0, 10)
          : new Date(rule.effective_to).toISOString().slice(0, 10);
        if (allocDateStr > effToStr) {
          throw new CostAllocationDomainError(
            "RULE_INACTIVE",
            `Allocation date '${allocDateStr}' is after rule effective_to date '${effToStr}'.`
          );
        }
      }
    }

    // 4. Source Account Eligibility Check
    const acctCode = rule.source_account_code ? rule.source_account_code.trim() : "";
    if (acctCode === "5295" || acctCode === "5296") {
      throw new CostAllocationDomainError(
        "ACCOUNT_ROUNDING_PROHIBITED",
        `Account '${acctCode}' is a cash rounding/variance account and is strictly prohibited from cost allocation.`
      );
    }

    // Must be an eligible expense account (starts with '5')
    if (!acctCode.startsWith("5")) {
      throw new CostAllocationDomainError(
        "ACCOUNT_NOT_ELIGIBLE_FOR_ALLOCATION",
        `Account '${acctCode}' is not an eligible operational expense account for cost allocation. Only 5xxx expense leaf accounts may be allocated.`
      );
    }

    // Prohibit group accounts (5000, 5100, 5200, 5300)
    if (["5000", "5100", "5200", "5300"].includes(acctCode)) {
      throw new CostAllocationDomainError(
        "ACCOUNT_NOT_ELIGIBLE_FOR_ALLOCATION",
        `Account '${acctCode}' is a summary group account and cannot receive or supply journal allocations.`
      );
    }

    // 5. Targets Configuration Check
    if (!Array.isArray(rule.targets) || rule.targets.length === 0) {
      throw new CostAllocationDomainError(
        "NO_TARGETS_CONFIGURED",
        `Rule '${rule.rule_code}' has no configured target cost centres.`
      );
    }

    // 6. Validate Individual Targets & Percentage Sum
    let totalPercentage = 0;
    const seenTargetCostCentres = new Set<string>();

    for (const target of rule.targets) {
      const pct = Number(target.percentage);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        throw new CostAllocationDomainError(
          "INVALID_TARGET_PERCENTAGE",
          `Target percentage must be strictly between 0 and 100. Received: ${target.percentage}`
        );
      }

      // Prohibit self-allocation (target CC == source CC)
      if (target.target_cost_centre_id === rule.source_cost_centre_id) {
        throw new CostAllocationDomainError(
          "TARGET_CANNOT_BE_SOURCE",
          `Target cost centre cannot be identical to source cost centre '${rule.source_cost_centre_code || rule.source_cost_centre_id}'.`
        );
      }

      // Check unique target cost centres
      if (seenTargetCostCentres.has(target.target_cost_centre_id)) {
        throw new CostAllocationDomainError(
          "DUPLICATE_TARGET_COST_CENTRE",
          `Duplicate target cost centre '${target.target_cost_centre_code || target.target_cost_centre_id}' in rule '${rule.rule_code}'.`
        );
      }
      seenTargetCostCentres.add(target.target_cost_centre_id);

      // Validate target account if specified
      if (target.target_account_code) {
        const tgtCode = target.target_account_code.trim();
        if (tgtCode === "5295" || tgtCode === "5296") {
          throw new CostAllocationDomainError(
            "ACCOUNT_ROUNDING_PROHIBITED",
            `Target account '${tgtCode}' is a cash rounding/variance account and cannot be used in cost allocation.`
          );
        }
        if (!tgtCode.startsWith("5")) {
          throw new CostAllocationDomainError(
            "ACCOUNT_NOT_ELIGIBLE_FOR_ALLOCATION",
            `Target account '${tgtCode}' is not an eligible expense account.`
          );
        }
      }

      totalPercentage += pct;
    }

    // Check sum equals 100.00% (within 0.0001 precision)
    if (Math.abs(totalPercentage - 100.0) > 0.0001) {
      throw new CostAllocationDomainError(
        "PERCENTAGE_SUM_INVALID",
        `Target percentages must sum to exactly 100.00%. Current sum: ${totalPercentage.toFixed(4)}%`
      );
    }
  }

  /**
   * Deterministic Largest-Remainder Method (Hamilton-Hare quota).
   *
   * Splits sourceAmount across targets in exact integer paisa (cents).
   * Allocates integer portions first, then distributes the cent deficit to targets
   * with the largest fractional remainders.
   *
   * Tie-breaker: sort_order ASC, then target_cost_centre_id ASC.
   *
   * @param sourceAmount Positive monetary amount in INR.
   * @param targets Array of target rules with percentage and sort_order.
   */
  static calculateLargestRemainder(
    sourceAmount: number | string,
    targets: CostAllocationRuleTargetRow[]
  ): CostAllocationCalculatedTarget[] {
    const amountNum = typeof sourceAmount === "string" ? parseFloat(sourceAmount) : sourceAmount;
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new CostAllocationDomainError(
        "OPERATION_FAILED",
        `Source amount for cost allocation must be strictly positive. Received: ${sourceAmount}`
      );
    }

    // Convert total to integer paisa (cents)
    const sourceCents = Math.round(amountNum * 100);

    // 1. Calculate base cents and fractional remainder for each target
    interface TargetIntermediate {
      target: CostAllocationRuleTargetRow;
      exactCents: number;
      baseCents: number;
      fraction: number;
      allocatedCents: number;
      originalIndex: number;
    }

    const intermediates: TargetIntermediate[] = targets.map((t, idx) => {
      const pct = Number(t.percentage);
      const exactCents = (sourceCents * pct) / 100.0;
      const baseCents = Math.floor(exactCents);
      const fraction = exactCents - baseCents;
      return {
        target: t,
        exactCents,
        baseCents,
        fraction,
        allocatedCents: baseCents,
        originalIndex: idx,
      };
    });

    // 2. Compute the deficit in cents
    const sumBaseCents = intermediates.reduce((acc, item) => acc + item.baseCents, 0);
    const deficit = sourceCents - sumBaseCents;

    // 3. Sort for deficit distribution
    // Priority: Largest fraction DESC -> sort_order ASC -> target_cost_centre_id ASC
    const sorted = [...intermediates].sort((a, b) => {
      const diff = b.fraction - a.fraction;
      if (Math.abs(diff) > 1e-9) {
        return diff;
      }
      // Tie breaker 1: sort_order ASC
      if (a.target.sort_order !== b.target.sort_order) {
        return a.target.sort_order - b.target.sort_order;
      }
      // Tie breaker 2: target_cost_centre_id ASC
      return a.target.target_cost_centre_id.localeCompare(b.target.target_cost_centre_id);
    });

    // 4. Distribute 1 cent to top `deficit` items
    for (let i = 0; i < deficit; i++) {
      sorted[i].allocatedCents += 1;
    }

    // 5. Restore original order and map to final result
    const results: CostAllocationCalculatedTarget[] = intermediates.map((item) => {
      const allocatedAmount = Number((item.allocatedCents / 100).toFixed(2));
      return {
        target_cost_centre_id: item.target.target_cost_centre_id,
        target_cost_centre_code: item.target.target_cost_centre_code,
        target_cost_centre_name: item.target.target_cost_centre_name,
        target_account_id: item.target.target_account_id || "",
        target_account_code: item.target.target_account_code,
        target_account_name: item.target.target_account_name,
        target_percentage: Number(item.target.percentage),
        allocated_cents: item.allocatedCents,
        allocated_amount: allocatedAmount,
        sort_order: item.target.sort_order,
      };
    });

    // 6. Strict Double-Entry Invariance Assertion
    const totalAllocatedCents = results.reduce((acc, r) => acc + r.allocated_cents, 0);
    if (totalAllocatedCents !== sourceCents) {
      throw new CostAllocationDomainError(
        "OPERATION_FAILED",
        `Largest-remainder invariant violation: Total allocated cents (${totalAllocatedCents}) != Source cents (${sourceCents})`
      );
    }

    return results;
  }
}
