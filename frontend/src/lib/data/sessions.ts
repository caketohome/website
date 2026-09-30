/**
 * CakeToHome Storefront Session Cookie Management
 */

import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";

export function createSession(token: string) {
  if (!token) return;

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  cookies().set("_cth_jwt", token, {
    httpOnly: true,
    secure: process.env.VERCEL_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export function retrieveSession() {
  return cookies().get("_cth_jwt")?.value || cookies().get("_medusa_jwt")?.value || null;
}

export function destroySession() {
  const cookieNames = [
    "_cth_jwt",
    "_medusa_jwt",
    "_cth_role",
    "_cth_user_id",
    "_cth_customer_uid",
    "_cth_phone",
    "_cth_branch_id",
    "_cth_shop_id",
    "_cth_partner_id",
    "_cth_cart_id",
    "_medusa_cart_id",
  ];

  const cookieStore = cookies();
  cookieNames.forEach((name) => {
    try {
      cookieStore.delete(name);
      cookieStore.set(name, "", { path: "/", maxAge: 0, expires: new Date(0) });
    } catch {
      // Ignore
    }
  });

  revalidateTag("user");
  revalidateTag("users");
}
