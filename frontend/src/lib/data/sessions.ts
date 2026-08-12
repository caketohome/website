/**
 * CakeToHome Storefront Session Cookie Management
 */

import { jwtVerify } from "jose";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import "server-only";

const jwtSecret = process.env.JWT_SECRET || "supersecret";

export function createSession(token: string) {
  if (!token) return;

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  cookies().set("_cth_jwt", token, {
    httpOnly: true,
    secure: process.env.VERCEL_ENV === "production",
    expires: expiresAt,
    sameSite: "strict",
    path: "/",
  });
}

export function retrieveSession() {
  return cookies().get("_cth_jwt")?.value || cookies().get("_medusa_jwt")?.value || null;
}

export function destroySession() {
  cookies().delete("_cth_jwt");
  cookies().delete("_medusa_jwt");
  cookies().delete("_cth_role");
  cookies().delete("_cth_user_id");
  cookies().delete("_cth_phone");
  cookies().delete("_cth_branch_id");
  cookies().delete("_cth_shop_id");
  cookies().delete("_cth_partner_id");
  revalidateTag("user");
}

export async function decrypt(session: string | undefined = ""): Promise<object | { message: string }> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(jwtSecret);
    const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const { payload } = await jwtVerify(session, cryptoKey, { algorithms: ["HS256"] });
    return payload;
  } catch (error) {
    return { message: "Error decrypting session" };
  }
}
