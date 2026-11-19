import type { Metadata, Viewport } from "next";
import { ReceiveHandoff } from "./receive-handoff";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Receive your cake | CakeToHome", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function ReceivePage({ params }: { params: { token: string } }) {
  return <ReceiveHandoff token={params.token} />;
}
