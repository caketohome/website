"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { WhatsAppSupportButton } from "./whatsapp-support-button";

const ExitIntentPopup = dynamic(
  () => import("@frontend/components/store/marketing/exit-intent-popup"),
  { ssr: false }
);

export function StorefrontFloatingWidgets() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <WhatsAppSupportButton />
      <ExitIntentPopup />
    </>
  );
}

export default StorefrontFloatingWidgets;
