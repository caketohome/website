import { model } from "@medusajs/utils";

export const Currency = model.define("loc_currency", {
    id: model
        .id({
            prefix: "cur",
        })
        .primaryKey(),
    code: model.text(),
    symbol: model.text(),
    name: model.text(),
    rate: model.number().default(1),
    is_default: model.boolean().default(false),
    is_enabled: model.boolean().default(true),
});
