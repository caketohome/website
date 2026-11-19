import type { Metadata, Viewport } from "next";

// Rider app installs as its own PWA (opens straight into deliveries).
export const metadata: Metadata = {
  title: "CakeToHome Rider",
  description: "Deliveries and live location for CakeToHome riders",
  manifest: "/rider-manifest.json",
  appleWebApp: { capable: true, title: "Rider", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#1D2F5D" };

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
