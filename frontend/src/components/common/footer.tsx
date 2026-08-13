import { Text } from "@medusajs/ui";
import Link from "next/link";
import { GoogleAnalytics } from "@next/third-parties/google";
import { FooterNavigation } from "@frontend/components/store/cms/navigation";
import { Suspense } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function Footer() {
  return (
    <footer className="flex flex-col gap-4 justify-center items-center py-8 bg-ui-fg-base text-ui-fg-on-inverted">
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      {/* CMS-driven footer navigation (renders nothing if no nav configured) */}
      <Suspense fallback={null}>
        <FooterNavigation />
      </Suspense>
      <Text className="flex flex-wrap gap-1 text-xs sm:text-sm text-center px-4 justify-center text-ui-fg">
        © {new Date().getFullYear()} CakeToHome — Premium Cake & Bakery
        Ordering Platform
      </Text>
    </footer>
  );
}
