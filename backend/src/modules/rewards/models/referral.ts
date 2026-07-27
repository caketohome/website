import { model } from "@medusajs/utils";

export const ReferralProgram = model.define("rewards_referral_program", {
  id: model
    .id({
      prefix: "rw_rp",
    })
    .primaryKey(),
  name: model.text(),
  description: model.text().nullable(),
  status: model.text().default("active"), // "active" | "disabled"
  reward_type: model.text(), // "wallet" | "loyalty" | "gift_card"
  reward_value: model.number(), // Amount to reward
  qualification_rules: model.json().nullable(), // e.g. { min_spend: 500, min_order_count: 1 }
  start_date: model.dateTime().nullable(),
  end_date: model.dateTime().nullable(),
  metadata: model.json().nullable(),
});

export const ReferralCode = model.define("rewards_referral_code", {
  id: model
    .id({
      prefix: "rw_rc",
    })
    .primaryKey(),
  customer_id: model.text().unique().index(),
  code: model.text().unique().index(),
  status: model.text().default("active"), // "active" | "disabled" | "expired"
  usage_limit: model.number().nullable(),
  usage_count: model.number().default(0),
  expires_at: model.dateTime().nullable(),
  events: model.hasMany(() => ReferralEvent, {
    mappedBy: "referral_code",
  }),
  metadata: model.json().nullable(),
});

export const ReferralEvent = model.define("rewards_referral_event", {
  id: model
    .id({
      prefix: "rw_re",
    })
    .primaryKey(),
  referral_code: model.belongsTo(() => ReferralCode, {
    mappedBy: "events",
  }),
  referrer_id: model.text().index(),
  referee_id: model.text().index(),
  event_type: model.text(), // "click" | "register" | "qualified" | "disqualified"
  status: model.text().default("pending"), // "pending" | "qualified" | "rejected" | "reviewed"
  order_id: model.text().index().nullable(),
  metadata: model.json().nullable(),
});

export const ReferralQualification = model.define("rewards_referral_qualification", {
  id: model
    .id({
      prefix: "rw_rq",
    })
    .primaryKey(),
  referral_event_id: model.text().unique().index(),
  qualified: model.boolean().default(false),
  qualification_reason: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
  reviewed_by: model.text().nullable(),
  fraud_score: model.number().default(0),
});

export const FraudReview = model.define("rewards_fraud_review", {
  id: model
    .id({
      prefix: "rw_fr",
    })
    .primaryKey(),
  referral_event_id: model.text().index(),
  status: model.text().default("pending"), // "pending" | "approved" | "rejected"
  reason: model.text().nullable(),
  reviewer: model.text().nullable(),
  metadata: model.json().nullable(),
});
