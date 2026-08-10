import { model } from "@medusajs/utils";

/**
 * Immutable audit logs for all administrative operations on coupons and offers.
 */
export const OfferAuditLog = model.define("offer_audit_log", {
    id: model
        .id({
            prefix: "ofr_aud",
        })
        .primaryKey(),
    offer_id: model.text(),
    offer_code: model.text().nullable(),
    actor_id: model.text().nullable(),
    actor_email: model.text().nullable(),
    action: model.text(), // created | updated | approved | activated | paused | expired | archived | deleted | cloned
    changes_json: model.text().nullable(),
    ip_address: model.text().nullable(),
    user_agent: model.text().nullable(),
});
