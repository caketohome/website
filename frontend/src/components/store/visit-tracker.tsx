"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@frontend/lib/data/analytics";

/** Records a storefront page view on each navigation (visits for browse-abandonment). */
export function VisitTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) trackPageView(pathname);
  }, [pathname]);
  return null;
}
