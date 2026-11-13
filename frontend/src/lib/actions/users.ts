"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { destroySession } from "../../lib/data/sessions";
import { REFRESH_COOKIE, revokeSupabaseSession } from "../auth/phone-auth";

// Mock server actions (login/signup/loginCustomer/setRoleCookie) were removed: as exported
// "use server" functions they were public RPC endpoints that let any caller set session and
// role cookies. Sessions are now issued only by /api/v1/auth/verify-otp after Supabase verifies the OTP.

export async function logout() {
  await revokeSupabaseSession(cookies().get(REFRESH_COOKIE)?.value);
  destroySession();
  redirect("/login");
}
