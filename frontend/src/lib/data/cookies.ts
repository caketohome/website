import { cookies, headers } from "next/headers";

export const getAuthHeaders = (): Record<string, string> => {
  const token = cookies().get("_medusa_jwt")?.value;
  const publishableKey =
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    "pk_e43cf3cbad60b9429ac28f7e46cd59022feeb003e3b339782cd5529906377bae";

  const headers: Record<string, string> = {
    "x-publishable-api-key": publishableKey,
  };

  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }

  return headers;
};

export const getCacheTag = (tag: string): string => {
  const cacheId = headers().get("_medusa_cache_id");

  if (cacheId) {
    return `${tag}-${cacheId}`;
  }

  return "";
};

export const getCacheHeaders = (
  tag: string
): { next: { tags: string[] } } | {} => {
  const cacheTag = getCacheTag(tag);

  if (cacheTag) {
    return { next: { tags: [`${cacheTag}`] } };
  }

  return {};
};
