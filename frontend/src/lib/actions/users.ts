"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSession, destroySession } from "../../lib/data/sessions";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";

export async function logout() {
  destroySession();
  redirect("/login");
}

export async function setRoleCookie(role: string): Promise<void> {
  cookies().set("_cth_role", role, { path: "/", httpOnly: false });
  revalidateTag(getCacheTag("users"));
}

export async function signup(prevState: any, data: FormData): Promise<{ message?: string } | void> {
  const actorType = (data.get("actor_type") as string) || "customer";
  const token = `token_${Date.now()}`;
  createSession(token);
  cookies().set("_cth_role", actorType, { path: "/", httpOnly: false });
  revalidateTag(getCacheTag("users"));
  if (actorType === "delivery_partner" || actorType === "dlp") {
    redirect("/dashboard/delivery-partner");
  } else if (actorType === "shop" || actorType === "shpmgr") {
    redirect("/dashboard/shop");
  } else {
    redirect("/account");
  }
}

export async function login(prevState: any, data: FormData): Promise<{ message?: string } | void> {
  const actorType = (data.get("actor_type") as string) || "customer";
  const token = `token_${Date.now()}`;
  createSession(token);
  cookies().set("_cth_role", actorType, { path: "/", httpOnly: false });
  revalidateTag(getCacheTag("users"));
  if (actorType === "delivery_partner" || actorType === "dlp") {
    redirect("/dashboard/delivery-partner");
  } else if (actorType === "shop" || actorType === "shpmgr") {
    redirect("/dashboard/shop");
  } else {
    redirect("/account");
  }
}

export async function createAuthUser(input: any) {
  return `token_${Date.now()}`;
}

export async function createUser(input: any) {
  return { id: `usr_${Date.now()}` };
}

export async function getToken(input: any) {
  return `token_${Date.now()}`;
}

export async function loginCustomer(
  token: string,
  role?: string,
  userId?: string,
  phone?: string,
  branchId?: string,
  partnerId?: string,
  customerUid?: string
): Promise<void> {
  createSession(token);
  const existingRole = cookies().get("_cth_role")?.value;
  const targetRole = role || existingRole || "customer";
  cookies().set("_cth_role", targetRole, { path: "/", httpOnly: false });
  if (userId) cookies().set("_cth_user_id", userId, { path: "/", httpOnly: false });
  if (customerUid) cookies().set("_cth_customer_uid", customerUid, { path: "/", httpOnly: false });
  if (phone) cookies().set("_cth_phone", phone, { path: "/", httpOnly: false });
  if (branchId) cookies().set("_cth_branch_id", branchId, { path: "/", httpOnly: false });
  if (partnerId) cookies().set("_cth_partner_id", partnerId, { path: "/", httpOnly: false });
  revalidateTag(getCacheTag("users"));
}
