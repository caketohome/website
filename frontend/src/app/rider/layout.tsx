import type { Metadata, Viewport } from "next";

// Rider screens outside the dashboard (login) belong to the installable rider app.
export const metadata: Metadata = {
  title: "CakeToHome Rider",
  description: "Sign in to the CakeToHome rider app",
  manifest: "/rider-manifest.json",
  appleWebApp: { capable: true, title: "Rider", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1D2F5D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RiderShellLayout({ children }: { children: React.ReactNode }) {
  return children;
}
