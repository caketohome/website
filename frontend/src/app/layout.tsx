import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { OrganizationJsonLd } from "@frontend/components/store/seo/json-ld";
import { AuthProvider } from "@/providers/auth-provider";
import { CustomerProvider } from "@frontend/providers/customer-provider";
import { FavoritesProvider } from "@/providers/favorites-provider";

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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563EB" />
        <OrganizationJsonLd />
      </head>
      <body className={`${sans.variable} ${serif.variable} font-sans min-h-screen bg-[#F8FAFC] text-[#0F172A] antialiased`}>
        <AuthProvider>
          <CustomerProvider>
            <FavoritesProvider>
              {children}
            </FavoritesProvider>
          </CustomerProvider>
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (let registration of registrations) {
                      registration.unregister();
                    }
                  });
                  if (window.caches) {
                    caches.keys().then(function(names) {
                      for (let name of names) caches.delete(name);
                    });
                  }
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
