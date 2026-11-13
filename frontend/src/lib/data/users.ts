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

  // 1. Verify token (fail closed if missing or invalid)
  if (!token) {
    return null;
  }
  const authPayload = verifyAuthToken(token);
  if (!authPayload) {
    return null;
  }

  const lookupKey =
    authPayload.customerUid ||
    authPayload.customerId ||
    authPayload.userId ||
    authPayload.phone ||
    customerUid ||
    userId ||
    phone;

  // 2. Query CustomerRepository from PostgreSQL and preserve verified role/branch claims
  if (lookupKey) {
    try {
      const customer = await CustomerRepository.findById(lookupKey);
      if (customer) {
        return {
          ...customer,
          role: authPayload.role || (customer as any).role || "CUSTOMER",
          branch_id: authPayload.branchId || (customer as any).branch_id,
          shop_id: authPayload.branchId || (customer as any).shop_id,
        };
      }
    } catch {
      // Ignore DB lookup error and continue to verified token payload
    }
  }

  // 3. Fallback to valid authenticated session payload
  return {
    id: authPayload.userId || lookupKey || "cus_session",
    customer_uid: authPayload.customerUid || authPayload.userId || lookupKey || "cth_cus_session",
    first_name: authPayload.name ? authPayload.name.split(" ")[0] : "Gourmet",
    last_name: authPayload.name ? authPayload.name.split(" ").slice(1).join(" ") : "Customer",
    full_name: authPayload.name || "Gourmet Customer",
    name: authPayload.name || "Gourmet Customer",
    email: authPayload.email || "",
    phone: authPayload.phone || phone || "",
    role: authPayload.role || "CUSTOMER",
    branch_id: authPayload.branchId,
    shop_id: authPayload.branchId,
    wallet_balance: 0,
    addresses: [],
    preferences: {},
    orders_count: 0,
    total_spend: 0,
  };
}
