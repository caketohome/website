"use client";

import { useEffect, useState } from "react";
import { WhatsAppSupportButton } from "./whatsapp-support-button";

// The hardcoded exit-intent "extra 10% OFF" popup was removed: offers now come only from
// admin-configured engagement campaigns (Marketing → Popups).
export function StorefrontFloatingWidgets() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <WhatsAppSupportButton />;
}

export default StorefrontFloatingWidgets;
