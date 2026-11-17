import { Text } from "@medusajs/ui";
import Link from "next/link";
import { CakeToHomeLogo } from "@frontend/components/common/logo";
import { GoogleAnalytics } from "@next/third-parties/google";
import { FooterNavigation } from "@frontend/components/store/cms/navigation";
import { Suspense } from "react";
import { Heart, ShieldCheck, Truck, Clock, Sparkles } from "lucide-react";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function Footer() {
  return (
    <footer className="w-full bg-brand-deep text-white/80 border-t border-white/10 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8 transition-colors duration-200">
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}

      {/* Trust & Assurance Banner */}
      <div className="border-b border-white/10 bg-white/[0.03]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm text-white/90">
            <Sparkles className="w-4 h-4 text-brand-gold shrink-0" />
            <span className="font-medium">100% Fresh Daily</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm text-white/90">
            <Truck className="w-4 h-4 text-brand-gold shrink-0" />
            <span className="font-medium">2-Hour Express Delivery</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm text-white/90">
            <ShieldCheck className="w-4 h-4 text-brand-gold shrink-0" />
            <span className="font-medium">Safe & Sealed Packaging</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs sm:text-sm text-white/90">
            <Clock className="w-4 h-4 text-brand-gold shrink-0" />
            <span className="font-medium">Scheduled & Express Delivery</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        {/* Main Footer Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          {/* Brand Info */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <CakeToHomeLogo
              variant="white"
              mode="full"
              height={44}
              href="/"
              className="py-1"
            />
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm">
              Artisanal bakery crafted with passion in Kerala. We bake happiness fresh to order, delivering gourmet cakes, desserts, and savory treats with unmatched quality and punctuality.
            </p>
            <div className="flex items-center gap-2 pt-2 text-xs text-white/85">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Kitchens active & dispatching across Kerala
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs uppercase tracking-wider font-bold text-white/70 font-sans">Artisanal Range</h4>
            <ul className="flex flex-col gap-1.5 text-xs text-slate-300">
              <li><Link href="/category/birthday-cakes" className="hover:text-white transition-colors">Birthday Cakes</Link></li>
              <li><Link href="/category/anniversary-cakes" className="hover:text-white transition-colors">Anniversary Cakes</Link></li>
              <li><Link href="/category/pastries" className="hover:text-white transition-colors">Pastries & Slices</Link></li>
              <li><Link href="/category/chocolates" className="hover:text-white transition-colors">Gourmet Chocolates</Link></li>
              <li><Link href="/search?is_bestseller=true" className="hover:text-white transition-colors">Bestsellers</Link></li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs uppercase tracking-wider font-bold text-white/70 font-sans">Customer Care</h4>
            <ul className="flex flex-col gap-1.5 text-xs text-slate-300">
              <li><Link href="/account/orders" className="hover:text-white transition-colors">Track Your Order</Link></li>
              <li><Link href="/search" className="hover:text-white transition-colors">Search Catalog</Link></li>
              <li><Link href="/account" className="hover:text-white transition-colors">My Account</Link></li>
              <li><Link href="/cart" className="hover:text-white transition-colors">View Cart</Link></li>
            </ul>
          </div>

          {/* Contact & Support */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs uppercase tracking-wider font-bold text-white/70 font-sans">Help & Support</h4>
            <div className="text-xs text-slate-300 flex flex-col gap-1.5">
              <p>Email: <a href="mailto:support@caketohome.com" className="text-white/70 hover:underline">support@caketohome.com</a></p>
              <p>WhatsApp: <a href="https://wa.me/919567789888" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 font-mono font-semibold">+91 95677 89888</a></p>
              <p>Hours: 9:00 AM – 11:00 PM IST</p>
              <p className="text-[11px] text-slate-400 mt-1">Razorpay 256-bit SSL Encrypted Standard Checkout</p>
            </div>
          </div>
        </div>

        {/* CMS-driven footer navigation */}
        <Suspense fallback={null}>
          <FooterNavigation />
        </Suspense>

        {/* Statutory Legal Policies Grid (12 Mandatory Policies) */}
        <div className="py-6 border-t border-white/10">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-white/60 mb-3 text-center sm:text-left">
            Statutory Legal Policies & Disclosures
          </h5>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-[11px] text-slate-300">
            <Link href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms-and-conditions" className="hover:text-white transition-colors">Terms & Conditions</Link>
            <Link href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
            <Link href="/cancellation-policy" className="hover:text-white transition-colors">Cancellation Policy</Link>
            <Link href="/shipping-and-delivery-policy" className="hover:text-white transition-colors">Shipping & Delivery</Link>
            <Link href="/return-replacement-policy" className="hover:text-white transition-colors">Return / Replacement</Link>
            <Link href="/cookie-policy" className="hover:text-white transition-colors">Cookie Policy</Link>
            <Link href="/allergen-food-safety-disclaimer" className="hover:text-white transition-colors">Allergen & Food Safety</Link>
            <Link href="/grievance-redressal" className="hover:text-white transition-colors">Grievance Redressal</Link>
            <Link href="/intellectual-property" className="hover:text-white transition-colors">Intellectual Property</Link>
            <Link href="/general-disclaimers" className="hover:text-white transition-colors">General Disclaimers</Link>
            <Link href="/contact-information" className="hover:text-white transition-colors">Contact Information</Link>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} CakeToHome India Private Limited. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <span className="flex items-center gap-1">Made with <Heart className="w-3 h-3 text-rose-400 fill-rose-400" /> in Kerala</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
