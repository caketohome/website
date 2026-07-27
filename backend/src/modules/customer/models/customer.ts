import { model } from "@medusajs/utils";

/**
 * Customer phone record — the primary identity for CakeToHome customers.
 * One row per phone number. Login is mobile + OTP only (email optional).
 *
 * The `customer_id` links to the Medusa core customer entity via a module
 * link (see backend/src/links/customer-phone.ts).
 */
export const CustomerPhone = model.define("customer_phone", {
    id: model
        .id({
            prefix: "cph",
        })
        .primaryKey(),
    phone: model.text().searchable(),
    phone_verified: model.boolean().default(false),
    // Hashed OTP + expiry used during the login/register flow.
    otp_hash: model.text().nullable(),
    otp_expires_at: model.dateTime().nullable(),
    // Number of failed OTP attempts within the current window.
    otp_attempts: model.number().default(0),
    // Soft link to the Medusa core customer (cus_...). Null until first login.
    customer_id: model.text().nullable(),
});

export const CustomerAddress = model.define("cust_address", {
    id: model
        .id({
            prefix: "caddr",
        })
        .primaryKey(),
    customer_id: model.text(),
    label: model.text().nullable(),
    first_name: model.text().nullable(),
    last_name: model.text().nullable(),
    phone: model.text().nullable(),
    line1: model.text(),
    line2: model.text().nullable(),
    city: model.text(),
    state: model.text().nullable(),
    pincode: model.text().nullable(),
    country: model.text().default("IN"),
    latitude: model.number().nullable(),
    longitude: model.number().nullable(),
    is_default_shipping: model.boolean().default(false),
    is_default_billing: model.boolean().default(false),
});

export const LoginEvent = model.define("login_event", {
    id: model
        .id({
            prefix: "lgev",
        })
        .primaryKey(),
    customer_id: model.text().nullable(),
    phone: model.text().nullable(),
    ip: model.text().nullable(),
    user_agent: model.text().nullable(),
    device: model.text().nullable(),
    success: model.boolean().default(true),
});
