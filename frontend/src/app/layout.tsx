import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { OrganizationJsonLd } from "@frontend/components/store/seo/json-ld";
import { AuthProvider } from "@/providers/auth-provider";
import { CustomerProvider } from "@frontend/providers/customer-provider";
import { FavoritesProvider } from "@/providers/favorites-provider";
import { MetaPixel } from "@/components/marketing/meta-pixel";
import { PwaNotifications } from "@/components/pwa/pwa-notifications";

export const dynamic = "force-dynamic";

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
  adjustFontFallback: false,
});

const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-serif",
  fallback: ["Georgia", "Cambria", "Times New Roman", "serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "CakeToHome",
  description: "Order premium cakes and bakery products online",
  // Section layouts (e.g. the rider app) override this with their own installable manifest.
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/assets/brand/caketo-home-symbol-navy.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#172033" />
        <OrganizationJsonLd />
      </head>
      <body className={`${sans.variable} ${serif.variable} font-sans min-h-screen bg-brand-warm-white text-brand-text antialiased`}>
        <Suspense fallback={null}>
          <MetaPixel />
        </Suspense>
        <AuthProvider>
          <CustomerProvider>
            <FavoritesProvider>
              {children}
            </FavoritesProvider>
          </CustomerProvider>
          <PwaNotifications />
        </AuthProvider>
      </body>
    </html>
  );
}
