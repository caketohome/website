import { model } from "@medusajs/utils";

/**
 * Daily aggregated metrics for coupons and promotions for fast reporting and charts.
 */
export const OfferDailyMetric = model.define("offer_daily_metric", {
    id: model
        .id({
            prefix: "ofr_met",
        })
        .primaryKey(),
    offer_id: model.text(),
    metric_date: model.text(), // YYYY-MM-DD
    redemptions_count: model.number().default(0),
    unique_customers_count: model.number().default(0),
    revenue_generated: model.number().default(0),
    discount_given: model.number().default(0),
    aov: model.number().default(0),
    branch_breakdown_json: model.text().nullable(),
    city_breakdown_json: model.text().nullable(),
});
