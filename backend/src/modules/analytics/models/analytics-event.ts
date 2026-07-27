import { model } from "@medusajs/utils";

/**
 * Structured analytics event. Powers all platform metrics:
 * visitors, conversion rate, add_to_cart, checkout_started, purchase,
 * AOV, returning customers, CAC, LTV, ROAS, branch performance,
 * search analytics, coupon analytics, campaign ROI, staff performance.
 */
export const AnalyticsEvent = model.define("analytics_event", {
    id: model
        .id({
            prefix: "ane",
        })
        .primaryKey(),
    event_type: model.text(),
    entity_id: model.text().nullable(),
    customer_id: model.text().nullable(),
    session_id: model.text().nullable(),
    branch_id: model.text().nullable(),
    payload: model.text().nullable(),
});
