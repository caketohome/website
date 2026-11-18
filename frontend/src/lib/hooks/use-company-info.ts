"use client";
/** Company details for client components (invoice modals, contact blocks). Source: public.company via /api/v1/store/company. */
import { useEffect, useState } from "react";
import type { PublicCompanyInfo } from "../company-profile";

let cache: PublicCompanyInfo | null = null;
let pending: Promise<PublicCompanyInfo | null> | null = null;

export function loadCompanyInfo(): Promise<PublicCompanyInfo | null> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetch("/api/v1/store/company", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (cache = j?.company || null))
    .catch(() => null)
    .finally(() => { pending = null; });
  return pending;
}

export function useCompanyInfo(): PublicCompanyInfo | null {
  const [info, setInfo] = useState<PublicCompanyInfo | null>(cache);
  useEffect(() => {
    let alive = true;
    loadCompanyInfo().then((c) => alive && setInfo(c));
    return () => { alive = false; };
  }, []);
  return info;
}
