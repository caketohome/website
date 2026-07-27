import { model } from "@medusajs/utils";

export const LoyaltyLedger = model.define("rewards_loyalty_ledger", {
  id: model
    .id({
      prefix: "rw_ll",
    })
    .primaryKey(),
  customer_id: model.text().unique().index(),
  points: model.number().default(0),
  lifetime_points: model.number().default(0),
  tier: model.text().default("bronze"), // "bronze" | "silver" | "gold" | "platinum"
  transactions: model.hasMany(() => LoyaltyTransaction, {
    mappedBy: "loyalty_ledger",
  }),
  metadata: model.json().nullable(),
});

export const LoyaltyTransaction = model.define("rewards_loyalty_transaction", {
  id: model
    .id({
      prefix: "rw_ltx",
    })
    .primaryKey(),
  loyalty_ledger: model.belongsTo(() => LoyaltyLedger, {
    mappedBy: "transactions",
  }),
  points: model.number(), // Positive for earn/credit, negative for redeem/debit
  transaction_type: model.text(), // "earn" | "redeem" | "adjustment" | "expiry"
  description: model.text().nullable(),
  reference_type: model.text().nullable(),
  reference_id: model.text().nullable(),
  created_by: model.text().nullable(),
  metadata: model.json().nullable(),
});

export const LoyaltyRule = model.define("rewards_loyalty_rule", {
  id: model
    .id({
      prefix: "rw_lr",
    })
    .primaryKey(),
  name: model.text(),
  rule_type: model.text().default("ratio"), // "ratio" | "fixed"
  value: model.number(), // points multiplier (e.g. 0.1 for 1 point per 10 spent, or flat 50)
  min_spend: model.number().default(0),
  is_active: model.boolean().default(true),
  conditions: model.json().nullable(),
  metadata: model.json().nullable(),
});
