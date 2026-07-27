import { model } from "@medusajs/utils";

export const GiftCard = model.define("rewards_gift_card", {
  id: model
    .id({
      prefix: "rw_gc",
    })
    .primaryKey(),
  code: model.text().unique().index(),
  initial_balance: model.number(),
  current_balance: model.number(),
  currency_code: model.text().default("INR"),
  is_active: model.boolean().default(true),
  status: model.text().default("active"), // "active" | "disabled" | "expired"
  expires_at: model.dateTime().nullable(),
  transactions: model.hasMany(() => GiftCardTransaction, {
    mappedBy: "gift_card",
  }),
  metadata: model.json().nullable(),
});

export const GiftCardTransaction = model.define("rewards_gift_card_transaction", {
  id: model
    .id({
      prefix: "rw_gctx",
    })
    .primaryKey(),
  gift_card: model.belongsTo(() => GiftCard, {
    mappedBy: "transactions",
  }),
  amount: model.number(), // Negative for debits, positive for refunds
  transaction_type: model.text(), // "redeem" | "refund" | "activate" | "disable"
  reference_type: model.text().nullable(), // e.g. "order"
  reference_id: model.text().nullable(),
  idempotency_key: model.text().index().nullable(),
  created_by: model.text().nullable(), // e.g. customer_id, admin_id
  metadata: model.json().nullable(),
});
