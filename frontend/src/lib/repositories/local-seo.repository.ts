/**
 * CakeToHome — Local SEO & AEO/GEO Repository
 * Powers local landing pages, neighborhood targeting, Schema.org JSON-LD generation,
 * and Answer Engine Optimization (AEO) for AI search engines (Perplexity, Gemini, ChatGPT).
 */

import { dbQuery } from "@frontend/lib/db";
import { CityRepository, CityDomain } from "./city.repository";
import { BranchRepository } from "./branch.repository";

export interface LocalLandingPage {
  id: string;
  slug: string;
  city_name: string;
  city_slug: string;
  area_name?: string;
  state_name: string;
  h1: string;
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  hero_title: string;
  hero_subtitle: string;
  faqs: Array<{ question: string; answer: string }>;
  delivery_pincodes: string[];
  branches: Array<{ id: string; name: string; phone: string; address: string }>;
  json_ld: {
    bakery_schema: any;
    faq_schema: any;
    breadcrumb_schema: any;
  };
  geo_score: number;
  aeo_score: number;
  updated_at: string;
}

export class LocalSeoRepository {
  /**
   * Generate or retrieve local landing page data for a specific city.
   */
  static async getCityLandingPage(citySlug: string): Promise<LocalLandingPage | null> {
    const cities = await CityRepository.findAll();
    const cleanSlug = citySlug.toLowerCase().replace(/^city_/, "").replace(/^\/+/, "").replace(/^(cakes|city)\//, "");

    const ALIASES: Record<string, string[]> = {
      bbr: ["bengaluru", "bangalore", "bangaluru", "bbr"],
      maa: ["chennai", "madras", "maa"],
      bom: ["mumbai", "bombay", "bom"],
      del: ["delhi", "delhi-ncr", "new-delhi", "del"],
      hyd: ["hyderabad", "hyd"],
      koc: ["kochi", "cochin", "ernakulam", "koc"],
      klm: ["kollam", "quilon", "klm"],
    };

    const city = cities.find((c) => {
      const cSlug = c.slug.toLowerCase();
      const cName = c.name.toLowerCase();
      const cNorm = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const cId = c.id.toLowerCase().replace(/^city_/, "");

      if (cSlug === cleanSlug || cName === cleanSlug || cNorm === cleanSlug || cId === cleanSlug) return true;

      for (const [key, aliases] of Object.entries(ALIASES)) {
        if ((cId === key || cSlug === key) && aliases.includes(cleanSlug)) return true;
      }
      return false;
    });

    if (!city) return null;

    // Fetch branches located in or servicing this city
    const branchesData = await BranchRepository.findActive();
    const cityBranches = branchesData.filter(
      (b) =>
        b.city.toLowerCase() === city.name.toLowerCase() ||
        b.city_id === city.id ||
        (b.state.toLowerCase() === city.state.toLowerCase() && b.is_open)
    );

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://cakes2home.com";
    const canonical = `${baseUrl}/city/${city.slug}`;

    const faqs = [
      {
        question: `How fast can I get cake delivery in ${city.name}?`,
        answer: `CakeToHome delivers freshly baked cakes across ${city.name} in as little as 2 hours with our express delivery service. Scheduled delivery slots are also available across all major neighborhoods.`,
      },
      {
        question: `Are all cakes in ${city.name} 100% fresh and customizable?`,
        answer: `Yes! Every cake is handcrafted fresh on-demand by our master bakers in ${city.name}. We never store pre-baked cakes. You can customize flavor, weight (0.5kg to 5kg+), custom photo prints, and celebration messages.`,
      },
      {
        question: `Does CakeToHome offer 100% eggless cakes in ${city.name}?`,
        answer: `Absolutely. We offer a dedicated 100% pure eggless preparation for every single cake on our menu in ${city.name}, baked in a sanitized eggless section.`,
      },
      {
        question: `What are the most popular cake flavors ordered in ${city.name}?`,
        answer: `The top favorites in ${city.name} are our Signature Belgian Chocolate Truffle, Red Velvet Cream Cheese, Fresh Butterscotch Crunch, Dutch Chocolate, and Mango Fruit Cake.`,
      },
    ];

    // Schema.org Bakery / LocalBusiness JSON-LD
    const bakerySchema = {
      "@context": "https://schema.org",
      "@type": "Bakery",
      "@id": `${canonical}#bakery`,
      name: `CakeToHome Bakery — ${city.name}`,
      url: canonical,
      telephone: cityBranches[0]?.phone || "+91 80 4900 9999",
      priceRange: "₹₹",
      image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
      address: {
        "@type": "PostalAddress",
        streetAddress: cityBranches[0]?.address || "Bakery Hub",
        addressLocality: city.name,
        addressRegion: city.state,
        postalCode: cityBranches[0]?.pincode || "560001",
        addressCountry: "IN",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: cityBranches[0]?.latitude || 12.9716,
        longitude: cityBranches[0]?.longitude || 77.5946,
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          opens: "08:00",
          closes: "23:59",
        },
      ],
      servesCuisine: "Bakery, Cakes, Desserts, Artisanal Confectionery",
      hasMenu: `${baseUrl}/products`,
      acceptsReservations: "False",
    };

    // Schema.org FAQPage JSON-LD
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.answer,
        },
      })),
    };

    // Schema.org BreadcrumbList JSON-LD
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: baseUrl,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Cakes",
          item: `${baseUrl}/products`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: city.name,
          item: canonical,
        },
      ],
    };

    return {
      id: `geo_city_${city.id}`,
      slug: `city/${city.slug}`,
      city_name: city.name,
      city_slug: city.slug,
      state_name: city.state,
      h1: `Handcrafted Fresh Cake Delivery in ${city.name}`,
      meta_title: `Best Cake Delivery in ${city.name} — Same Day 2-Hour Delivery | CakeToHome`,
      meta_description: `Order fresh handcrafted cakes online in ${city.name}. Same-day 2-hour delivery and scheduled celebration slots. 100% pure eggless options, photo cakes, and custom designs.`,
      canonical_url: canonical,
      hero_title: `Delicious Handcrafted Cakes in ${city.name}`,
      hero_subtitle: `Baked fresh with premium Belgian chocolate and 100% natural ingredients. Delivered to your doorstep across ${city.name} in 2 hours.`,
      faqs,
      delivery_pincodes: cityBranches.map((b) => b.pincode).filter((p): p is string => Boolean(p)),
      branches: cityBranches.map((b) => ({
        id: b.id,
        name: b.name,
        phone: b.phone,
        address: b.address,
      })),
      json_ld: {
        bakery_schema: bakerySchema,
        faq_schema: faqSchema,
        breadcrumb_schema: breadcrumbSchema,
      },
      geo_score: 95,
      aeo_score: 92,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * List all generated local pages across all active cities in PostgreSQL.
   */
  static async listAllLocalPages(): Promise<LocalLandingPage[]> {
    const cities = await CityRepository.findAll();
    const pages: LocalLandingPage[] = [];

    for (const city of cities) {
      const page = await this.getCityLandingPage(city.slug);
      if (page) pages.push(page);
    }

    return pages;
  }
}
