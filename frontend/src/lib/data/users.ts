import { cookies } from "next/headers";
import { retrieveSession } from "./sessions";

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

  try {
    const { ApiEngine } = await import("../api-engine");
    const resolvedUser = ApiEngine.resolveUserAccount({ userId, phone, role, customerUid });
    if (resolvedUser) {
      return resolvedUser;
    }
  } catch (err) {
    // Ignore import or resolution errors
  }

  // Fallback check if role cookie exists for legacy support but userId missing
  if (role === "delivery_partner" || role === "dlp") {
    const { ApiEngine } = await import("../api-engine");
    const partner = ApiEngine.resolveUserAccount({ role: "DELIVERY_PARTNER", phone });
    if (partner) return partner;
  }

  return null;
}
