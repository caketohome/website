import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin, Clock, ShieldCheck, Award, Cake, ArrowRight,
  Truck, Building2, CheckCircle2, Sparkles, Phone, Star,
  HelpCircle, ChevronDown, ChevronRight
} from "lucide-react";
import { LocalSeoRepository } from "@frontend/lib/repositories/local-seo.repository";

export const dynamic = "force-dynamic";

interface CityPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CityPageProps) {
  const { slug } = await params;
  const localPage = await LocalSeoRepository.getCityLandingPage(slug);

  if (!localPage) {
    const { ApiEngine } = await import("@frontend/lib/api-engine");
    const city = ApiEngine.getCityBySlug(slug) || ApiEngine.getCityById(slug);

    if (!city) {
      return {
        title: "Online Cake Delivery | CakeToHome",
        description: "Order fresh chef-crafted cakes online with same-day and express delivery across India.",
      };
    }

    return {
      title: `Online Cake Delivery in ${city.name} | Express & Same Day Delivery | CakeToHome`,
      description: `Order delicious birthday cakes, anniversary confections, and gourmet treats online in ${city.name}, ${city.state}. Hand-delivered in 45-60 minutes from local fulfillment hubs.`,
      openGraph: {
        title: `Online Cake Delivery in ${city.name} — CakeToHome`,
        description: `Premium chef-baked cakes delivered fresh across ${city.name}. Same-day and scheduled slots available.`,
      },
    };
  }

  return {
    title: localPage.meta_title,
    description: localPage.meta_description,
    alternates: {
      canonical: localPage.canonical_url,
    },
    openGraph: {
      title: localPage.meta_title,
      description: localPage.meta_description,
      url: localPage.canonical_url,
      type: "website",
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(`Online Cake Delivery in ${localPage.city_name}`)}&desc=${encodeURIComponent(`Fresh handcrafted cakes delivered in 45 mins across ${localPage.city_name}`)}`,
          width: 1200,
          height: 630,
          alt: `Cake Delivery in ${localPage.city_name}`,
        },
      ],
    },
  };
}

export default async function CityLandingPage({ params }: CityPageProps) {
  const { slug } = await params;
  const localPage = await LocalSeoRepository.getCityLandingPage(slug);

  if (!localPage) {
    notFound();
  }

  let products: any[] = [];
  let occasions: any[] = [];
  try {
    const { listProducts, listOccasions } = await import("@frontend/lib/data/catalog");
    const [pList, oList] = await Promise.all([listProducts(), listOccasions()]);
    products = (pList || []).slice(0, 8);
    occasions = (oList || []).slice(0, 6);
  } catch (err) {
    products = [];
    occasions = [];
  }

  const branches = localPage.branches || [];
  const pincodesList = localPage.delivery_pincodes || [];

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* ─── Schema.org Structured Data (Bakery, FAQPage, BreadcrumbList) ─── */}
      {localPage.json_ld && (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(localPage.json_ld.bakery_schema) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(localPage.json_ld.faq_schema) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(localPage.json_ld.breadcrumb_schema) }}
          />
        </>
      )}

      {/* ─── Breadcrumbs ─── */}
      <nav aria-label="Breadcrumb" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-xs flex items-center gap-1.5 text-slate-500">
        <Link href="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <Link href="/products" className="hover:text-slate-900 dark:hover:text-white transition-colors">Cakes</Link>
        <ChevronRight className="w-3 h-3 text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-white">{localPage.city_name}</span>
      </nav>

      {/* ─── Hero City Banner ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-950 via-brand-navy to-slate-950 text-white py-16 px-4 sm:px-6 lg:px-8 border-b border-brand-navy/40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-brand-warm-white0/20 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-navy/20 border border-rose-400/30 text-rose-300 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
                <MapPin className="w-3.5 h-3.5" />
                <span>{localPage.state_name}, India</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Online Cake Delivery in{" "}
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-rose-300 via-brand-primary/30 to-brand-primary/30">
                  {localPage.city_name}
                </span>
              </h1>
              <p className="text-sm sm:text-base text-brand-light/80 leading-relaxed">
                {localPage.hero_subtitle || `Experience gourmet perfection. Cakes hand-crafted by master pâtissiers, delivered fresh in 45-60 minutes across ${localPage.city_name}.`}
              </p>

              {/* Quick stats pills */}
              <div className="flex flex-wrap gap-3 pt-2">
                <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-brand-gold" />
                  <span>{branches.length} Fulfillment Hub{branches.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-brand-primary" />
                  <span>Express & Scheduled Delivery</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16834A]" />
                  <span>{pincodesList.length > 0 ? `${pincodesList.length} Pincodes Covered` : "Citywide Coverage"}</span>
                </div>
              </div>
            </div>

            {/* Delivery Guarantees Card */}
            <div className="w-full lg:w-80 bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-5 space-y-4 shadow-2xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/10 pb-2">
                <Sparkles className="w-4 h-4 text-brand-gold" /> {localPage.city_name} Delivery Promise
              </h3>
              <div className="space-y-3 text-xs text-brand-light">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">45-Minute Express Delivery</span>
                    <span className="text-[11px] text-brand-primary/70">Baked fresh right after your order</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#16834A] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Recipe Guarantee</span>
                    <span className="text-[11px] text-brand-primary/70">Certified hygiene & food safety</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Award className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white block">Scheduled Delivery Slots</span>
                    <span className="text-[11px] text-brand-primary/70">Flexible 1-hour celebration windows</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Occasion Highlights in this City ────────────────────────── */}
      {occasions.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Shop by Occasion in {localPage.city_name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Find the perfect cake for your celebration</p>
            </div>
            <Link href="/occasions" className="text-xs font-semibold text-brand-navy dark:text-brand-gold hover:underline flex items-center gap-1">
              All Occasions <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {occasions.map((occ) => (
              <Link
                key={occ.id}
                href={`/occasions/${occ.slug}`}
                className="group p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 dark:hover:border-rose-600 transition-all text-center space-y-2 shadow-sm hover:shadow-md"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform">{occ.icon || "🎂"}</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-navy dark:group-hover:text-brand-gold truncate">
                  {occ.name}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─── Trending Gourmet Cakes in this City ─────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Cake className="w-5 h-5 text-brand-navy" /> Bestselling Cakes in {localPage.city_name}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Handcrafted with premium Belgian chocolate and fresh ingredients</p>
          </div>
          <Link href="/products" className="text-xs font-bold text-brand-navy hover:text-brand-deep dark:text-brand-gold flex items-center gap-1 hover:underline">
            View All Cakes <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((p: any) => (
            <Link
              key={p.product_id || p.id}
              href={`/products/${p.handle || p.slug || p.product_id || p.id}`}
              className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-brand-gold"
            >
              <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
                {p.thumbnail || p.images?.[0] ? (
                  <img
                    src={p.thumbnail || p.images?.[0]}
                    alt={p.title || p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">🎂</div>
                )}
                <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-brand-navy/90 text-brand-gold font-bold text-[10px] shadow border border-brand-gold/30 backdrop-blur-md">
                  ✨ Handcrafted
                </span>
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white font-semibold text-[10px] flex items-center gap-1">
                  <Star className="w-3 h-3 text-brand-gold fill-brand-gold" /> {p.rating ? Number(p.rating).toFixed(1) : "4.9"}
                </span>
              </div>

              <div className="p-4 space-y-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-serif font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-brand-navy dark:group-hover:text-brand-gold transition-colors">
                    {p.title || p.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                    {p.description || "Gourmet cake freshly baked on order with signature sponge and buttercream."}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Starting from</span>
                    <span className="text-sm font-black text-brand-navy dark:text-white">
                      ₹{p.price || p.base_price || p.selling_price || 0}
                    </span>
                  </div>
                  <span className="px-3 py-1.5 bg-brand-navy text-white text-xs font-bold rounded-lg group-hover:bg-brand-deep transition-colors inline-flex items-center gap-1 shadow-xs border border-brand-gold/30">
                    <span>Explore</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── Fulfillment Hubs in this City ───────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-navy dark:text-brand-gold" /> {localPage.city_name} Fulfillment Hubs & Bakeries
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Orders are dispatched from the closest hub to guarantee temperature control and 45-minute delivery.
              </p>
            </div>
          </div>

          {branches.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Expanding rapidly in {localPage.city_name}! Delivery hubs launching shortly.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b: any) => (
                <div
                  key={b.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{b.name}</span>
                    <span className="px-2 py-0.5 bg-brand-light dark:bg-brand-navy/60 text-brand-navy dark:text-brand-primary rounded text-[10px] font-mono font-bold">
                      {b.code || "HUB"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-start gap-1">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                    <span>{b.address || `${b.name}, ${localPage.city_name}`}</span>
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-1">
                    <span className="text-emerald-600 dark:text-[#16834A] font-semibold">● Operational Hub</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Customer Testimonials in this City ──────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="text-center space-y-1 mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Loved by 50,000+ Customers in {localPage.city_name}
          </h2>
          <p className="text-xs text-slate-500">Read what fellow cake lovers have to say</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "Priya S.",
              area: localPage.city_name,
              comment: "Ordered a birthday cake for my sister. It arrived right on schedule in pristine condition and tasted divine!",
              rating: 5,
            },
            {
              name: "Arun K.",
              area: localPage.city_name,
              comment: "Best Red Velvet cake in the city. Delivery was super fast (under 45 minutes) and the packaging was top notch.",
              rating: 5,
            },
            {
              name: "Sneha M.",
              area: localPage.city_name,
              comment: "The photo cake customization was so easy and the final result exceeded our expectations. Everyone loved the taste.",
              rating: 5,
            },
          ].map((t, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm"
            >
              <div className="flex items-center gap-1 text-brand-gold">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-brand-gold" />
                ))}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic">
                &ldquo;{t.comment}&rdquo;
              </p>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-900 dark:text-white">
                {t.name} <span className="font-normal text-slate-400">• {t.area}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Frequently Asked Questions (AEO & Answer Engine Optimization) ─── */}
      {localPage?.faqs && localPage.faqs.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <div className="text-center space-y-2 mb-10">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-xs font-semibold uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{localPage.city_name} Cake Delivery Guide & FAQs</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Frequently Asked Questions in {localPage.city_name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Clear answers for quick reference, voice search, and AI assistant inquiries.
            </p>
          </div>

          <div className="space-y-3">
            {localPage.faqs.map((faq, idx) => (
              <details
                key={idx}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all hover:border-brand-gold/40 open:ring-1 open:ring-brand-gold/30"
              >
                <summary className="font-bold text-sm sm:text-base text-slate-900 dark:text-white cursor-pointer list-none flex items-center justify-between">
                  <span>{faq.question}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform shrink-0 ml-2" />
                </summary>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* ─── Serviceable Pincodes in City ─── */}
      {pincodesList.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
          <div className="bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
              Serviceable Pincodes in {localPage.city_name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              We offer express 45-min delivery and scheduled celebration cake delivery to the following postal codes:
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(pincodesList)).map((pin) => (
                <span
                  key={pin}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-mono font-medium text-slate-700 dark:text-slate-300"
                >
                  {pin}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
