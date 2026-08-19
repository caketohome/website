"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const AiChatAssistant = dynamic(
  () => import("@frontend/components/store/ai-chat-assistant"),
  { ssr: false }
);

const ExitIntentPopup = dynamic(
  () => import("@frontend/components/store/marketing/exit-intent-popup"),
  { ssr: false }
);

const WhatsAppSupportButton = dynamic(
  () => import("@frontend/components/store/whatsapp-support-button"),
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
      <AiChatAssistant />
      <ExitIntentPopup />
    </>
  );
}

export default StorefrontFloatingWidgets;
