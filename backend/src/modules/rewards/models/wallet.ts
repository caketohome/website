import { model } from "@medusajs/utils";

export const Wallet = model.define("rewards_wallet", {
  id: model
    .id({
      prefix: "rw_wall",
    })
    .primaryKey(),
  customer_id: model.text().unique().index(),
  balance: model.number().default(0), // Balance in cents/paise
  currency_code: model.text().default("INR"),
  transactions: model.hasMany(() => WalletTransaction, {
    mappedBy: "wallet",
  }),
  metadata: model.json().nullable(),
});

export const WalletTransaction = model.define("rewards_wallet_transaction", {
  id: model
    .id({
      prefix: "rw_txn",
    })
    .primaryKey(),
  wallet: model.belongsTo(() => Wallet, {
    mappedBy: "transactions",
  }),
  amount: model.number(), // Positive for credits, negative for debits
  type: model.text(), // "credit" | "debit" | "hold" | "release"
  status: model.text().default("completed"), // "pending" | "completed" | "cancelled"
  reference_type: model.text().nullable(), // "order" | "adjustment" | "topup" | "refund"
  reference_id: model.text().nullable(),
  description: model.text().nullable(),
});
