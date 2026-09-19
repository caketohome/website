import { Text } from "@medusajs/ui";
import Link from "next/link";
import { GoogleAnalytics } from "@next/third-parties/google";
import { FooterNavigation } from "@frontend/components/store/cms/navigation";
import { Suspense } from "react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function Footer() {
  return (
    <footer className="w-full flex flex-col gap-3 justify-center items-center py-6 px-4 bg-[#07090E] border-t border-white/10 text-slate-400 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8 transition-colors duration-200">
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      {/* CMS-driven footer navigation (renders nothing if no nav configured) */}
      <Suspense fallback={null}>
        <FooterNavigation />
      </Suspense>
      <p className="flex flex-wrap gap-1 text-xs sm:text-sm text-center px-4 justify-center text-slate-400 font-sans tracking-tight">
        © {new Date().getFullYear()} CakeToHome — Premium Cake & Bakery Ordering Platform
      </p>
    </footer>
  );
}
