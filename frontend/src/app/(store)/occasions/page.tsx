import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, ArrowRight, Cake, Heart, Gift, PartyPopper, Calendar, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Occasion Cakes & Celebrations | Handcrafted Online Delivery | CakeToHome",
  description: "Browse curated designer cakes for birthdays, anniversaries, weddings, romantic celebrations, baby showers, and festive occasions. Fresh artisanal delivery across Kerala.",
  openGraph: {
    title: "Artisanal Occasion Cakes — CakeToHome",
    description: "Celebrate life's sweetest milestones with chef-crafted gourmet cakes.",
  },
};

export default async function OccasionsDirectoryPage() {
  const { ApiEngine } = await import("@frontend/lib/api-engine");
  const occasions = ApiEngine.listOccasions("active");

  return (
    <main className="min-h-screen pb-24 bg-slate-50 dark:bg-slate-950">
      {/* ── HERO HEADER BANNER ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-deep via-brand-navy to-brand-navy text-white py-16 px-4 sm:px-6 lg:px-8 border-b border-brand-gold/30 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-gold/15 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
              <span>Curated Collections</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-serif tracking-tight text-white leading-tight">
              Cakes for Every <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F3E5AB] via-brand-gold to-[#AA7C11]">Special Occasion</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              From intimate candlelit anniversaries to joyous birthday celebrations and grand milestone weddings, discover master pastry chef creations tailored to make your moments unforgettable.
            </p>
          </div>
        </div>
      </section>

      {/* ── BREADCRUMB ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
          <Link href="/" className="hover:text-neutral-800 dark:hover:text-neutral-200 transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-neutral-800 dark:text-neutral-200 font-bold">Occasions</span>
        </nav>
      </div>

      {/* ── OCCASIONS GRID ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {occasions.map((occasion: any) => {
            const cover =
              occasion.cover_image ||
              occasion.image_url ||
              "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800";

            return (
              <Link
                key={occasion.id || occasion.slug}
                href={`/occasions/${occasion.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm hover:shadow-xl hover:border-brand-gold/50 transition-all duration-300"
              >
                {/* Image Container */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                  <img
                    src={cover}
                    alt={occasion.alt_text || occasion.name}
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                  {/* Icon badge */}
                  {occasion.icon && (
                    <div className="absolute top-3 left-3 w-10 h-10 rounded-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md flex items-center justify-center text-lg shadow-md">
                      {occasion.icon}
                    </div>
                  )}

                  {/* Featured Tag */}
                  {(occasion.is_featured || occasion.featured) && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-brand-gold text-brand-text text-[10px] font-black uppercase tracking-wider shadow-sm">
                      Popular
                    </div>
                  )}

                  {/* Title overlay on image bottom */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h2 className="text-lg font-bold font-serif leading-snug drop-shadow-sm group-hover:text-brand-gold/40 transition-colors">
                      {occasion.name}
                    </h2>
                  </div>
                </div>

                {/* Card Content */}
                <div className="flex-1 p-4 flex flex-col justify-between space-y-3">
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                    {occasion.short_description || occasion.description || `Explore handcrafted cakes designed especially for ${occasion.name}.`}
                  </p>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs font-bold text-brand-gold dark:text-brand-gold group-hover:translate-x-0.5 transition-transform">
                    <span>View Collection</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── GUARANTEE BANNER ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="rounded-3xl bg-gradient-to-r from-brand-gold/10 via-brand-gold/5 to-transparent border border-brand-gold/20 p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 font-serif">
              Looking for a Bespoke Custom Celebration Cake?
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
              Our executive pastry team can personalize flavors, photo prints, multi-tier fondant sculptures, and allergen-friendly recipes.
            </p>
          </div>
          <Link
            href="/products"
            className="shrink-0 px-6 py-3 rounded-xl bg-brand-navy hover:bg-brand-primary text-white font-bold text-xs shadow-lg shadow-brand-gold/20 transition-all flex items-center gap-2"
          >
            <span>Explore All Cakes</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
