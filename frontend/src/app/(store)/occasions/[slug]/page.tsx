import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkles, ArrowRight, ShieldCheck, Clock, Award, Cake, Heart, Gift } from "lucide-react";

export const dynamic = "force-dynamic";

interface OccasionPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: OccasionPageProps) {
  const { slug } = await params;
  const { ApiEngine } = await import("@frontend/lib/api-engine");
  const occasion = ApiEngine.getOccasionBySlug(slug) || ApiEngine.getOccasionById(slug);

  if (!occasion) {
    return {
      title: "Occasion Cakes | CakeToHome",
      description: "Browse designer cakes and celebration confections for every special occasion.",
    };
  }

  return {
    title: `${occasion.name} Cakes Online | Fresh Delivery | CakeToHome`,
    description: occasion.description || `Order premium handcrafted cakes & accessories specially curated for ${occasion.name}. Same-day and express delivery available across Kerala.`,
    openGraph: {
      title: `${occasion.name} Cakes — CakeToHome`,
      description: occasion.description || `Celebrate ${occasion.name} with chef-crafted cakes.`,
    },
  };
}

export default async function OccasionStorefrontPage({ params }: OccasionPageProps) {
  const { slug } = await params;
  const { ApiEngine } = await import("@frontend/lib/api-engine");
  const occasion = ApiEngine.getOccasionBySlug(slug) || ApiEngine.getOccasionById(slug);

  if (!occasion) {
    notFound();
  }

  const products = ApiEngine.getOccasionProducts(occasion.slug);
  const accessories = ApiEngine.getRecommendedAccessories(undefined, "product");

  // Style evaluation: Scrapbook for birthday/anniversary, Coquette for romantic/anniversary
  const isScrapbook = slug.includes("birthday") || slug.includes("anniversary") || slug.includes("celebration");
  const isCoquette = slug.includes("anniversary") || slug.includes("valentine") || slug.includes("romantic") || slug.includes("wedding");

  return (
    <main className={`min-h-screen pb-24 ${isScrapbook ? "bg-brand-warm-white" : isCoquette ? "bg-[#FFF5F7]/60" : "bg-slate-50 dark:bg-slate-950"}`}>
      {/* ── HERO OCCASION BANNER (Royal Patisserie Navy #1D2F5D Anchor) ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-deep via-brand-navy to-brand-navy text-white py-16 px-4 sm:px-6 lg:px-8 border-b border-brand-gold/30 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-gold/15 via-transparent to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              {/* Badge & Mode Tag */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-brand-gold/40 text-brand-gold text-xs font-semibold uppercase tracking-wider backdrop-blur-md shadow-sm">
                <span>{occasion.icon || "🎉"}</span>
                <span>{isCoquette ? "Romantic Celebration Edition" : isScrapbook ? "Celebration Memory Album" : "Collection"}</span>
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
                {occasion.name}{" "}
                <span className="italic font-normal text-brand-gold">
                  &amp; Celebration Cakes
                </span>
              </h1>

              <p className="text-sm sm:text-base text-white/80 leading-relaxed font-sans max-w-xl">
                {occasion.description || `Make your ${occasion.name} unforgettable with freshly baked gourmet cakes, handcrafted with 100% pure ingredients and delivered in express time.`}
              </p>
            </div>

            {/* Guarantees with Glassmorphic elevation */}
            <div className="flex flex-wrap gap-3 text-xs font-medium text-white/90">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 shadow-sm">
                <Clock className="w-4 h-4 text-brand-gold" />
                <span>Express 2-Hr &amp; Scheduled Delivery</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 shadow-sm">
                <ShieldCheck className="w-4 h-4 text-[#16834A]" />
                <span>100% Freshness Guarantee</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 shadow-sm">
                <Award className="w-4 h-4 text-brand-gold" />
                <span>Master Patissier Quality</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MAIN CATALOG SECTION ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-navy-accent/10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-navy-accent flex items-center gap-2">
                <Cake className="w-6 h-6 text-brand-navy" /> Curated for {occasion.name}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy font-bold">
                {products.length} {products.length === 1 ? "Cake" : "Cakes"}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 font-sans">
              Handpicked celebration designs, rich flavours, and customizable messages for your {occasion.name}.
            </p>
          </div>

          <Link
            href="/products"
            className="text-xs sm:text-sm font-bold text-brand-navy hover:text-navy-glow flex items-center gap-1.5 transition-colors group"
          >
            <span>All Cakes</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-navy-accent/15 shadow-sm space-y-4 max-w-md mx-auto">
            <Cake className="w-12 h-12 mx-auto text-brand-navy/40" />
            <h3 className="font-serif text-lg font-bold text-navy-accent">Cakes are being freshly baked!</h3>
            <p className="text-xs text-slate-600">Browse our signature gourmet collection below or explore the full catalog.</p>
            <Link
              href="/products"
              className="inline-flex items-center px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-navy-glow text-white text-xs font-bold shadow-md shadow-navy-accent/20 transition-all"
            >
              Explore Full Catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {products.map((prod: any, idx: number) => {
              const prodId = prod.id || prod.product_id;
              const prodPrice = Number(prod.price) || Number(prod.selling_price) || 599;

              return (
                <Link
                  key={prodId}
                  href={`/products/${prod.handle || prodId}`}
                  className={`group relative transition-all duration-300 flex flex-col justify-between ${
                    isScrapbook
                      ? "scrapbook-polaroid p-4 bg-white rounded-xl shadow-md hover:shadow-xl hover:-translate-y-1.5 hover:rotate-1"
                      : isCoquette
                      ? "coquette-blush-card p-5 rounded-3xl shadow-sm hover:shadow-lg hover:-translate-y-1 border border-brand-primary/30"
                      : "bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1"
                  }`}
                >
                  {/* Scrapbook Tape / Pushpin Accents */}
                  {isScrapbook && (
                    <>
                      <div className="scrapbook-tape" />
                      {idx % 3 === 0 && <div className="scrapbook-pin" />}
                    </>
                  )}

                  {/* Coquette Ribbon Badge */}
                  {isCoquette && idx % 2 === 0 && (
                    <div className="coquette-ribbon-badge">
                      <span>🎀 Special Edition</span>
                    </div>
                  )}

                  {/* Image Container */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
                    <img
                      src={prod.thumbnail || "/images/placeholder-cake.webp"}
                      alt={prod.title || prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-md bg-brand-deep/85 text-white text-[10px] font-bold backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                      <span>{occasion.icon || "🎂"}</span>
                      <span>{occasion.name}</span>
                    </span>
                  </div>

                  {/* Content Area */}
                  <div className="pt-4 space-y-2 flex flex-col justify-between flex-1">
                    <div>
                      <h3 className="font-serif text-base sm:text-lg font-semibold text-navy-accent line-clamp-1 group-hover:text-navy-glow transition-colors">
                        {prod.title || prod.name}
                      </h3>
                      {prod.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                          {prod.description}
                        </p>
                      )}
                      {isScrapbook && (
                        <p className="text-[11px] text-[#997A1E] italic mt-1 font-serif">
                          &ldquo;Handcrafted fresh for {occasion.name} celebrations&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Price and Action Bar */}
                    <div className="pt-3 border-t border-navy-accent/10 flex items-center justify-between mt-auto">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">Starts from</span>
                        <span className="font-sans text-base sm:text-lg font-bold text-brand-navy">
                          ₹{prodPrice}
                        </span>
                      </div>
                      <span className="px-3.5 py-1.5 rounded-xl bg-brand-navy text-white font-bold text-xs group-hover:bg-navy-glow transition-all flex items-center gap-1 shadow-sm">
                        <span>Customize</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── CELEBRATION ADD-ONS & ACCESSORIES ── */}
        {accessories.length > 0 && (
          <div className="mt-20 pt-12 border-t border-navy-accent/10 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-navy-accent flex items-center gap-2">
                  <Gift className="w-5 h-5 text-brand-gold" /> Complete the {occasion.name} Celebration
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 font-sans">
                  Party candles, designer toppers, rose bouquets, and occasion greeting cards.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {accessories.slice(0, 6).map((acc: any) => (
                <div
                  key={acc.id}
                  className="bg-white p-3.5 rounded-2xl border border-navy-accent/15 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 mb-2.5">
                    <img
                      src={acc.thumbnail || "/images/placeholder-cake.webp"}
                      alt={acc.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-navy-accent line-clamp-1">{acc.name}</h4>
                    <span className="text-xs font-extrabold text-brand-navy mt-1 block">
                      ₹{acc.price}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
