import { model } from "@medusajs/utils";

export const Expense = model.define("analytics_expense", {
  id: model
    .id({
      prefix: "exp",
    })
    .primaryKey(),
  branch_id: model.text().nullable(),
  name: model.text(),
  category: model.text(), // rent | utilities | salaries | ingredients | marketing | miscellaneous
  amount: model.number(), // in minor units/paise
  recorded_by: model.text().nullable(),
  expense_date: model.dateTime(),
  description: model.text().nullable(),
  metadata: model.json().nullable(),
});
