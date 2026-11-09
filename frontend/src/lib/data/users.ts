import { cookies } from "next/headers";
import { retrieveSession } from "./sessions";
import { verifyAuthToken } from "../security/auth-session";
import { CustomerRepository } from "../repositories/customer.repository";

export async function retrieveUser(): Promise<any> {
  const cookieStore = cookies();
  const token = retrieveSession();
  const customerUid = cookieStore.get("_cth_customer_uid")?.value;
  const userId = cookieStore.get("_cth_user_id")?.value;
  const phone = cookieStore.get("_cth_phone")?.value;
  const role = cookieStore.get("_cth_role")?.value;

  // If no session exists, return null (fail closed)
  if (!token && !userId && !phone && !customerUid) {
    return null;
  }

  // 1. Verify token if present
  let authPayload = null;
  if (token) {
    authPayload = verifyAuthToken(token);
  }

  const lookupKey =
    customerUid ||
    userId ||
    authPayload?.customerUid ||
    authPayload?.customerId ||
    authPayload?.userId ||
    phone ||
    authPayload?.phone;

  // 2. Query CustomerRepository from PostgreSQL
  if (lookupKey) {
    try {
      const customer = await CustomerRepository.findById(lookupKey);
      if (customer) {
        return customer;
      }
    } catch {
      // Ignore DB lookup error and continue to fallback
    }
  }

  // 3. Fallback to valid authenticated session payload
  if (authPayload) {
    return {
      id: authPayload.userId || lookupKey || "cus_session",
      customer_uid: authPayload.customerUid || authPayload.userId || lookupKey || "cth_cus_session",
      first_name: authPayload.name ? authPayload.name.split(" ")[0] : "Gourmet",
      last_name: authPayload.name ? authPayload.name.split(" ").slice(1).join(" ") : "Customer",
      full_name: authPayload.name || "Gourmet Customer",
      name: authPayload.name || "Gourmet Customer",
      email: authPayload.email || "",
      phone: authPayload.phone || phone || "",
      role: authPayload.role || role || "CUSTOMER",
      wallet_balance: 0,
      addresses: [],
      preferences: {},
      orders_count: 0,
      total_spend: 0,
    };
  }

  // 4. Fallback if user cookies exist
  if (userId || customerUid) {
    return {
      id: userId || customerUid,
      customer_uid: customerUid || userId,
      first_name: "Valued",
      last_name: "Customer",
      full_name: "Valued Customer",
      name: "Valued Customer",
      email: "",
      phone: phone || "",
      role: role || "CUSTOMER",
      wallet_balance: 0,
      addresses: [],
      preferences: {},
      orders_count: 0,
      total_spend: 0,
    };
  }

  return null;
}
