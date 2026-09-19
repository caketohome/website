/**
 * CAKETOHOME — ENTERPRISE MULTI-SOURCE SEARCH, PRODUCT MAPPING & DYNAMIC RANKING ENGINE
 *
 * Core Capabilities:
 * 1. Canonical Product Abstraction & Multi-Source Mapping (Medusa, CMS, PostgreSQL, Inventory)
 * 2. Variant Deduplication (Same real-world cake across multiple sources/weights appears ONCE)
 * 3. Tag System with Configurable Category & Type Weights
 * 4. Synonym & Alias Normalization (e.g. "choc" -> "chocolate", "bday" -> "birthday")
 * 5. Query Normalization (lowercase, whitespace, punctuation, abbreviations)
 * 6. Dynamic Ranking Engine (text relevance, exact match, categories, tags, popularity, ratings, availability, location)
 * 7. Merchandising Rules (Pin, Boost, Bury, Scheduled Time-Based Campaigns)
 * 8. Search & Zero-Result Analytics
 */

import { resolveProductInventoryMode } from "../types/domain";

export interface CanonicalVariant {
  variant_id: string;
  source_variant_id?: string;
  weight: string; // e.g. "0.5 kg", "1 kg", "2 kg"
  price: number;
  compare_at_price?: number;
  sku?: string;
  in_stock: boolean;
  inventory_quantity?: number | null;
}

export interface SourceMapping {
  mapping_id: string;
  source_type: "medusa" | "cms" | "postgres" | "inventory" | "external";
  source_product_id: string;
  source_variant_id?: string;
  canonical_product_id: string;
  status: "approved" | "pending" | "rejected";
  match_confidence: number; // 0 - 100
  matched_by: "sku" | "slug" | "normalized_name" | "manual";
  last_synced_at: string;
}

export interface ProductTag {
  tag_id: string;
  name: string;
  slug: string;
  type: "occasion" | "flavour" | "dietary" | "style" | "marketing" | "delivery" | "seasonal" | "attribute";
  display_name: string;
  search_weight: number; // 1 - 100
  status: "active" | "archived";
}

export interface SearchSynonym {
  id: string;
  term: string;
  synonyms: string[]; // e.g. ["chocolate", "choco", "truffle"]
  is_bidirectional: boolean;
}

export interface MerchandisingRule {
  id: string;
  name: string;
  type: "pin" | "boost" | "bury";
  query_pattern: string; // e.g. "birthday", "chocolate", "*"
  target_type: "product" | "category" | "tag";
  target_id: string; // canonical_product_id or category slug or tag slug
  score_delta: number; // e.g. +30 for boost, -50 for bury, 1000 for pin
  pin_position?: number; // 1, 2, 3...
  start_date?: string; // ISO date string
  end_date?: string; // ISO date string
  city?: string;
  status: "active" | "inactive";
}

export interface SearchRankingWeights {
  exact_match_weight: number; // default 90
  phrase_match_weight: number; // default 70
  name_match_weight: number; // default 60
  category_match_weight: number; // default 50
  tag_match_weight: number; // default 40
  flavour_match_weight: number; // default 40
  synonym_match_weight: number; // default 40
  popularity_weight: number; // default 25
  rating_weight: number; // default 20
  sales_velocity_weight: number; // default 20
  availability_weight: number; // default 30
  top_results_count: number; // default 8
}

export interface CanonicalProduct {
  id?: string;
  product_id?: string;
  canonical_product_id: string;
  title?: string;
  name: string;
  slug: string;
  description: string;
  category_id?: string;
  category: string;
  category_slug?: string;
  categories?: Array<{ id: string; name: string; slug: string }>;
  flavour: string;
  tag_ids: string[];
  tags: string[];
  occasions: string[];
  keywords: string[];
  image: string;
  images: string[];
  base_price: number;
  selling_price: number;
  compare_at_price?: number;
  variants: CanonicalVariant[];
  in_stock: boolean;
  stock_level: number;
  branch_ids: string[];
  city_ids: string[];
  rating: number;
  review_count: number;
  popularity_score: number;
  sales_velocity: number;
  conversion_score: number;
  is_bestseller?: boolean;
  is_featured?: boolean;
  is_new_arrival?: boolean;
  status: "active" | "draft" | "archived";
  source_mappings: SourceMapping[];
  created_at: string;
  updated_at: string;
}

export interface SearchAnalyticsEntry {
  id: string;
  query: string;
  normalized_query: string;
  results_count: number;
  selected_product_id?: string;
  city?: string;
  branch_id?: string;
  device?: string;
  timestamp: string;
  is_zero_result: boolean;
}

// ── Default Ranking Weights ────────────────────────────────────────────────
export const DEFAULT_RANKING_WEIGHTS: SearchRankingWeights = {
  exact_match_weight: 90,
  phrase_match_weight: 70,
  name_match_weight: 60,
  category_match_weight: 50,
  tag_match_weight: 40,
  flavour_match_weight: 40,
  synonym_match_weight: 40,
  popularity_weight: 25,
  rating_weight: 20,
  sales_velocity_weight: 20,
  availability_weight: 30,
  top_results_count: 8,
};

// ── Default Curated Tags ───────────────────────────────────────────────────
export const DEFAULT_TAGS: ProductTag[] = [
  { tag_id: "tag_choco", name: "Chocolate", slug: "chocolate", type: "flavour", display_name: "Chocolate", search_weight: 50, status: "active" },
  { tag_id: "tag_bday", name: "Birthday", slug: "birthday", type: "occasion", display_name: "Birthday Specials", search_weight: 60, status: "active" },
  { tag_id: "tag_anniv", name: "Anniversary", slug: "anniversary", type: "occasion", display_name: "Anniversary", search_weight: 55, status: "active" },
  { tag_id: "tag_best", name: "Bestseller", slug: "bestseller", type: "marketing", display_name: "🏆 Bestseller", search_weight: 45, status: "active" },
  { tag_id: "tag_prem", name: "Premium", slug: "premium", type: "style", display_name: "✨ Premium Artisan", search_weight: 40, status: "active" },
  { tag_id: "tag_express", name: "Express Delivery", slug: "express-delivery", type: "delivery", display_name: "⚡ 2-Hour Express", search_weight: 35, status: "active" },
  { tag_id: "tag_mid", name: "Midnight Delivery", slug: "midnight-delivery", type: "delivery", display_name: "🌙 Midnight Delivery", search_weight: 40, status: "active" },
  { tag_id: "tag_eggless", name: "Eggless", slug: "eggless", type: "dietary", display_name: "🌱 100% Eggless", search_weight: 50, status: "archived" },
  { tag_id: "tag_fruit", name: "Fresh Fruit", slug: "fresh-fruit", type: "flavour", display_name: "🍓 Fresh Fruit", search_weight: 45, status: "active" },
  { tag_id: "tag_truffle", name: "Belgian Truffle", slug: "belgian-truffle", type: "flavour", display_name: "Belgian Truffle", search_weight: 50, status: "active" },
  { tag_id: "tag_redvelvet", name: "Red Velvet", slug: "red-velvet", type: "flavour", display_name: "Red Velvet", search_weight: 50, status: "active" },
  { tag_id: "tag_mango", name: "Alphonso Mango", slug: "alphonso-mango", type: "flavour", display_name: "Alphonso Mango", search_weight: 50, status: "active" },
];

// ── Default Synonyms ───────────────────────────────────────────────────────
export const DEFAULT_SYNONYMS: SearchSynonym[] = [
  { id: "syn_1", term: "choc", synonyms: ["chocolate", "choco", "truffle", "cocoa"], is_bidirectional: true },
  { id: "syn_2", term: "bday", synonyms: ["birthday", "celebration", "party"], is_bidirectional: true },
  { id: "syn_3", term: "redvelvet", synonyms: ["red velvet", "velvet", "cream cheese"], is_bidirectional: true },
  { id: "syn_4", term: "blackforest", synonyms: ["black forest", "cherry chocolate"], is_bidirectional: true },
  { id: "syn_5", term: "fruit", synonyms: ["fresh fruit", "fruits", "mixed fruit", "berry", "strawberry"], is_bidirectional: true },
  { id: "syn_6", term: "eggless", synonyms: ["pure veg", "vegetarian", "no egg"], is_bidirectional: true },
  { id: "syn_7", term: "rasmalai", synonyms: ["ras malai", "indian sweet", "kesar pistah"], is_bidirectional: true },
];

export class SearchEngine {
  private static rankingWeights: SearchRankingWeights = { ...DEFAULT_RANKING_WEIGHTS };
  private static tags: ProductTag[] = [...DEFAULT_TAGS];
  private static synonyms: SearchSynonym[] = [...DEFAULT_SYNONYMS];
  private static merchandisingRules: MerchandisingRule[] = [];
  private static analyticsLogs: SearchAnalyticsEntry[] = [];
  private static canonicalProducts: Map<string, CanonicalProduct> = new Map();
  private static isInitialized = false;

  // ── 1. Query Normalization Pipeline ───────────────────────────────────────
  public static normalizeQuery(rawQuery: string): {
    normalized: string;
    tokens: string[];
    expandedTokens: string[];
  } {
    if (!rawQuery) {
      return { normalized: "", tokens: [], expandedTokens: [] };
    }

    // Lowercase, trim, strip excessive punctuation while preserving alphanumeric words
    let clean = rawQuery
      .toLowerCase()
      .replace(/[\/\-_,.]+/g, " ")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const tokens = clean.split(" ").filter((t) => t.length > 0);
    const expandedSet = new Set<string>(tokens);

    // Expand with synonym dictionary
    for (const syn of this.synonyms) {
      const mainTerm = syn.term.toLowerCase();
      const synList = syn.synonyms.map((s) => s.toLowerCase());

      if (tokens.includes(mainTerm) || clean.includes(mainTerm)) {
        synList.forEach((s) => expandedSet.add(s));
      }

      if (syn.is_bidirectional) {
        for (const s of synList) {
          if (tokens.includes(s) || clean.includes(s)) {
            expandedSet.add(mainTerm);
            synList.forEach((sibling) => expandedSet.add(sibling));
          }
        }
      }
    }

    return {
      normalized: clean,
      tokens,
      expandedTokens: Array.from(expandedSet),
    };
  }

  // ── 2. Automatic Source Mapping Suggestion Algorithm ─────────────────────
  public static calculateMatchConfidence(
    source: { name?: string; title?: string; slug?: string; sku?: string; category?: string; flavour?: string },
    canonical: CanonicalProduct
  ): { confidence: number; matched_by: "sku" | "slug" | "normalized_name" | "manual" } {
    const sSku = (source.sku || "").trim().toLowerCase();
    const cSlug = (canonical.slug || "").trim().toLowerCase();

    // 1. Exact SKU match -> 100% confidence
    if (sSku && canonical.variants.some((v) => (v.sku || "").toLowerCase() === sSku)) {
      return { confidence: 100, matched_by: "sku" };
    }

    // 2. Exact slug match -> 98% confidence
    const sSlug = (source.slug || "").trim().toLowerCase();
    if (sSlug && sSlug === cSlug) {
      return { confidence: 98, matched_by: "slug" };
    }

    // 3. Normalized name comparison
    const sNameNorm = this.normalizeQuery(source.name || source.title || "").normalized;
    const cNameNorm = this.normalizeQuery(canonical.name).normalized;

    if (sNameNorm === cNameNorm) {
      return { confidence: 95, matched_by: "normalized_name" };
    }

    // Token overlap metric (Jaccard Index)
    const sTokens = new Set(sNameNorm.split(" ").filter((t) => t.length > 2));
    const cTokens = new Set(cNameNorm.split(" ").filter((t) => t.length > 2));

    let intersectionCount = 0;
    sTokens.forEach((t) => {
      if (cTokens.has(t)) intersectionCount++;
    });

    const unionCount = new Set([...sTokens, ...cTokens]).size;
    if (unionCount > 0) {
      const jaccard = (intersectionCount / unionCount) * 100;
      if (jaccard >= 75) {
        return { confidence: Math.round(jaccard), matched_by: "normalized_name" };
      }
    }

    return { confidence: 0, matched_by: "manual" };
  }

  // ── 3. Index Ingestion & Canonical Product Synchronization ────────────────
  public static ingestCanonicalProduct(prod: Partial<CanonicalProduct> & { id?: string; name?: string; title?: string }): CanonicalProduct {
    const canonicalId =
      prod.canonical_product_id ||
      prod.id ||
      `cth_prod_${(prod.slug || prod.name || prod.title || "cake").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

    const existing = this.canonicalProducts.get(canonicalId);

    const name = prod.name || prod.title || existing?.name || "Artisan Celebration Cake";
    const slug = prod.slug || (prod as any).handle || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const category = prod.category || (prod as any).category_slug || existing?.category || "Cakes";

    // Extract tags
    const rawTags = Array.isArray(prod.tags) ? prod.tags : [];
    const cleanTags = Array.from(new Set(rawTags.map((t) => (typeof t === "string" ? t : (t as any).name || (t as any).slug)).filter(Boolean)));

    // Variants handling
    const mode = resolveProductInventoryMode(prod);
    const isCake = mode === "MADE_TO_ORDER_AVAILABILITY";

    const rawVariants: any[] = Array.isArray(prod.variants) && prod.variants.length > 0
      ? prod.variants
      : [
          {
            variant_id: `${canonicalId}_v1`,
            weight: (prod as any).weight || "1 kg",
            price: Number(prod.base_price || prod.selling_price || (prod as any).price || 649),
            in_stock: prod.in_stock !== false,
            inventory_quantity: isCake ? null : ((prod as any).inventory_quantity ?? 0),
          },
        ];

    const variants: CanonicalVariant[] = rawVariants.map((v, i) => ({
      variant_id: v.variant_id || v.id || `${canonicalId}_v${i + 1}`,
      source_variant_id: v.source_variant_id || v.id,
      weight: v.weight || v.title || `${0.5 * (i + 1)} kg`,
      price: Number(v.price || v.calculated_price || prod.base_price || 649),
      compare_at_price: v.compare_at_price || (prod as any).compare_at_price,
      sku: v.sku || `${slug}-${i + 1}`,
      in_stock: isCake ? (v.in_stock !== false) : (v.in_stock !== false && (v.inventory_quantity ?? 0) > 0),
      inventory_quantity: isCake ? null : (v.inventory_quantity ?? 0),
    }));

    const canonical: CanonicalProduct = {
      id: canonicalId,
      product_id: canonicalId,
      canonical_product_id: canonicalId,
      title: name,
      name,
      slug,
      description: prod.description || existing?.description || "",
      category_id: prod.category_id || existing?.category_id,
      category,
      category_slug: prod.category_slug || (prod as any).category_slug || (category ? category.toLowerCase().replace(/[^a-z0-9]+/g, "-") : ""),
      categories: prod.categories || existing?.categories || (category ? [{ id: "cat_1", name: category, slug: category.toLowerCase().replace(/[^a-z0-9]+/g, "-") }] : []),
      flavour: prod.flavour || (prod as any).flavor || existing?.flavour || "",
      tag_ids: prod.tag_ids || existing?.tag_ids || [],
      tags: cleanTags.length > 0 ? cleanTags : (existing?.tags || []),
      occasions: prod.occasions || existing?.occasions || [],
      keywords: prod.keywords || existing?.keywords || [],
      image: prod.image || (prod as any).thumbnail || existing?.image || "",
      images: prod.images || (prod as any).images || (existing?.images || [prod.image || (prod as any).thumbnail || ""]).filter(Boolean),
      base_price: Number(prod.base_price || prod.selling_price || (prod as any).price || variants[0]?.price || 649),
      selling_price: Number(prod.selling_price || prod.base_price || (prod as any).price || variants[0]?.price || 649),
      compare_at_price: prod.compare_at_price || (prod as any).compare_at_price,
      variants,
      in_stock: prod.in_stock !== false && variants.some((v) => v.in_stock),
      stock_level: prod.stock_level ?? variants.reduce((acc, v) => acc + (v.inventory_quantity || 0), 0),
      branch_ids: prod.branch_ids || ["br_koramangala", "br_indiranagar", "br_whitefield"],
      city_ids: prod.city_ids || ["city_bangalore", "bangalore"],
      rating: Number(prod.rating || (prod as any).average_rating || existing?.rating || 4.8),
      review_count: Number(prod.review_count || (prod as any).reviews_count || existing?.review_count || 42),
      popularity_score: Number(prod.popularity_score ?? (prod.is_bestseller ? 95 : 70)),
      sales_velocity: Number(prod.sales_velocity ?? (prod.is_bestseller ? 88 : 50)),
      conversion_score: Number(prod.conversion_score ?? 80),
      is_bestseller: prod.is_bestseller ?? (prod as any).is_bestseller ?? false,
      is_featured: prod.is_featured ?? (prod as any).is_featured ?? false,
      is_new_arrival: prod.is_new_arrival ?? (prod as any).is_new_arrival ?? false,
      status: (prod.status === "archived" || (prod as any).deleted_at != null) ? "archived" : "active",
      source_mappings: prod.source_mappings || existing?.source_mappings || [
        {
          mapping_id: `map_${Date.now()}`,
          source_type: "medusa",
          source_product_id: prod.id || canonicalId,
          canonical_product_id: canonicalId,
          status: "approved",
          match_confidence: 100,
          matched_by: "manual",
          last_synced_at: new Date().toISOString(),
        },
      ],
      created_at: prod.created_at || existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.canonicalProducts.set(canonicalId, canonical);
    return canonical;
  }

  // ── 4. Core Search & Scoring Engine ───────────────────────────────────────
  public static search(options: {
    query?: string;
    category?: string;
    flavour?: string;
    weight?: string;
    tag?: string;
    occasion?: string;
    min_price?: number;
    max_price?: number;
    city?: string;
    branchId?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    include_out_of_stock?: boolean;
    customer_id?: string;
  }): {
    results: CanonicalProduct[];
    total: number;
    query: string;
    normalized_query: string;
    facets: {
      categories: Array<{ id: string; name: string; slug: string; count: number }>;
      flavours: Array<{ name: string; count: number }>;
      tags: Array<{ slug: string; name: string; count: number }>;
      price_range: { min: number; max: number };
    };
    suggestions: string[];
  } {
    const rawQuery = (options.query || "").trim();
    const { normalized, tokens, expandedTokens } = this.normalizeQuery(rawQuery);
    const limit = options.limit || this.rankingWeights.top_results_count || 8;
    const offset = options.offset || 0;

    const allProducts = Array.from(this.canonicalProducts.values()).filter(
      (p) => ((p.status as any) === "active" || (p.status as any) === "published") && (p as any).deleted_at == null
    );

    const scoredItems: Array<{ product: CanonicalProduct; score: number; isPinned: boolean; pinPos?: number }> = [];

    // Filter and score each canonical product
    for (const product of allProducts) {
      // Hard Filters
      if (options.category && options.category.toLowerCase() !== "all") {
        const catLower = options.category.toLowerCase();
        const pCat = (product.category || "").toLowerCase();
        const pCatSlug = (product.category_slug || "").toLowerCase();
        if (pCat !== catLower && pCatSlug !== catLower && !pCatSlug.includes(catLower)) {
          continue;
        }
      }

      if (options.flavour && options.flavour.toLowerCase() !== "all") {
        const fLower = options.flavour.toLowerCase();
        const pFlav = (product.flavour || "").toLowerCase();
        if (pFlav !== fLower && !pFlav.includes(fLower)) {
          continue;
        }
      }

      if (options.weight && options.weight.toLowerCase() !== "all") {
        const wLower = options.weight.toLowerCase().trim();
        const pWeight = String((product as any).weight || "").toLowerCase().trim();
        const hasVariantWeight = Array.isArray(product.variants) && product.variants.some((v) => String(v.weight || "").toLowerCase().trim() === wLower);
        if (pWeight !== wLower && !hasVariantWeight) {
          continue;
        }
      }

      if (options.tag && options.tag.toLowerCase() !== "all") {
        const tLower = options.tag.toLowerCase();
        const pTags = Array.isArray(product.tags) ? product.tags : [];
        if (!pTags.some((t) => (t || "").toLowerCase() === tLower || (t || "").toLowerCase().includes(tLower))) {
          continue;
        }
      }

      if (options.min_price !== undefined && product.selling_price < options.min_price) continue;
      if (options.max_price !== undefined && product.selling_price > options.max_price) continue;

      if (!options.include_out_of_stock && !product.in_stock) {
        // Demote or filter out of stock
      }

        // Relevance Scoring (Safe against null/undefined fields)
      let score = 0;
      const nameLower = (product.name || product.title || "").toLowerCase();
      const descLower = (product.description || "").toLowerCase();
      const catLower = (product.category || "").toLowerCase();
      const flavourLower = (product.flavour || "").toLowerCase();
      const tagsLower = (Array.isArray(product.tags) ? product.tags : []).map((t) => (t || "").toLowerCase());
      const occasionsLower = (Array.isArray(product.occasions) ? product.occasions : []).map((o) => (o || "").toLowerCase());

      if (normalized.length > 0) {
        // A. Exact Name Match
        if (nameLower === normalized) {
          score += this.rankingWeights.exact_match_weight * 10;
        } else if (nameLower.startsWith(normalized)) {
          score += this.rankingWeights.exact_match_weight * 5;
        } else if (nameLower.includes(normalized)) {
          score += this.rankingWeights.phrase_match_weight * 4;
        }

        // B. Category / Flavour Exact Match
        const allCatNames = [
          product.category,
          product.category_slug,
          ...(Array.isArray(product.categories) ? product.categories.map((c: any) => `${c.name || ""} ${c.slug || ""}`) : []),
        ].filter(Boolean).join(" ").toLowerCase();

        if (allCatNames.includes(normalized)) {
          score += this.rankingWeights.category_match_weight * 3;
        }

        if (flavourLower && (flavourLower === normalized || flavourLower.includes(normalized))) {
          score += this.rankingWeights.flavour_match_weight * 3;
        }

        // C. Word-level token matching
        const STOP_WORDS = new Set(["to", "in", "for", "with", "a", "an", "the", "and", "of", "product", "products", "item", "items", "caketohome"]);
        const meaningfulTokens = tokens.filter((t) => !STOP_WORDS.has(t));
        const effectiveTokens = meaningfulTokens.length > 0 ? meaningfulTokens : tokens;

        const productWords = new Set<string>(
          `${nameLower} ${allCatNames} ${flavourLower} ${tagsLower.join(" ")} ${occasionsLower.join(" ")}`
            .split(/[\s\-_\/,\.]+/)
            .filter((w) => w.length > 0)
        );

        const checkTokenMatch = (tok: string): boolean => {
          if (!tok || tok.length < 2) return false;
          if (productWords.has(tok)) return true;
          for (const w of productWords) {
            if (tok.length >= 3 && w.length >= 3 && (w.startsWith(tok) || (tok.length >= 4 && tok.startsWith(w)))) {
              return true;
            }
          }
          return false;
        };

        const getSynonymsForToken = (tok: string): string[] => {
          const syns: string[] = [];
          for (const s of this.synonyms) {
            const mainTerm = s.term.toLowerCase();
            const synList = s.synonyms.map((syn) => syn.toLowerCase());
            if (tok === mainTerm) {
              syns.push(...synList);
            } else if (s.is_bidirectional && synList.includes(tok)) {
              syns.push(mainTerm, ...synList.filter((x) => x !== tok));
            }
          }
          return syns;
        };

        const checkTokenWithSynonyms = (tok: string): boolean => {
          if (checkTokenMatch(tok)) return true;
          const tokenSyns = getSynonymsForToken(tok);
          return tokenSyns.some((st) => checkTokenMatch(st));
        };

        const matchedTokensCount = effectiveTokens.filter((tok) => checkTokenWithSynonyms(tok)).length;

        // Phrase match or multi-token threshold (>= 60% overlap)
        const isPhraseMatch = nameLower.includes(normalized) || allCatNames.includes(normalized) || (flavourLower.length > 0 && flavourLower.includes(normalized));
        const requiredCount = effectiveTokens.length === 1 ? 1 : Math.ceil(effectiveTokens.length * 0.6);
        const hasSufficientTokenMatch = matchedTokensCount >= requiredCount;

        if (isPhraseMatch || hasSufficientTokenMatch) {
          // Add weights for matched tokens
          effectiveTokens.forEach((tok) => {
            if (nameLower.includes(tok)) score += this.rankingWeights.name_match_weight;
            if (allCatNames.includes(tok)) score += this.rankingWeights.category_match_weight;
            if (flavourLower.includes(tok)) score += this.rankingWeights.flavour_match_weight;
            if (descLower.includes(tok)) score += 5;
          });

          // Tag Matches (Weighted by Tag Type)
          tagsLower.forEach((pTag) => {
            if (effectiveTokens.includes(pTag) || normalized.includes(pTag)) {
              const foundTagObj = this.tags.find((t) => t.status === "active" && (t.slug === pTag || t.name.toLowerCase() === pTag));
              const weight = foundTagObj?.search_weight || this.rankingWeights.tag_match_weight;
              score += weight * 2;
            }
          });

          // Occasion Matches
          occasionsLower.forEach((occ) => {
            if (effectiveTokens.includes(occ) || normalized.includes(occ)) {
              score += this.rankingWeights.tag_match_weight * 2.5;
            }
          });
        } else {
          // Insufficient match -> score remains 0
          score = 0;
        }
      } else {
        // Blank search -> Base quality score
        score = 100;
      }

      // If positive text match or browsing without query, add business ranking signals
      if (score > 0) {
        // Availability & Stock boost
        if (product.in_stock) {
          score += this.rankingWeights.availability_weight;
        } else {
          score -= this.rankingWeights.availability_weight * 2;
        }

        // Location / City awareness
        if (options.city) {
          const cLower = options.city.toLowerCase();
          if (product.city_ids.some((cid) => cid.toLowerCase().includes(cLower))) {
            score += 25;
          }
        }

        // Popularity, Velocity & Rating
        score += (product.popularity_score / 100) * this.rankingWeights.popularity_weight;
        score += (product.sales_velocity / 100) * this.rankingWeights.sales_velocity_weight;
        score += (product.rating / 5) * this.rankingWeights.rating_weight;

        if (product.is_bestseller) score += 20;
        if (product.is_featured) score += 10;

        // ── Merchandising Rules Application (Pin, Boost, Bury) ──
        let isPinned = false;
        let pinPos: number | undefined;

        const now = new Date();
        for (const rule of this.merchandisingRules) {
          if (rule.status !== "active") continue;

          // Check date schedule if specified
          if (rule.start_date && new Date(rule.start_date) > now) continue;
          if (rule.end_date && new Date(rule.end_date) < now) continue;

          // Check query condition
          const qMatch =
            rule.query_pattern === "*" ||
            rule.query_pattern.toLowerCase() === normalized ||
            normalized.includes(rule.query_pattern.toLowerCase());

          if (!qMatch) continue;

          // Check target match
          const targetMatch =
            (rule.target_type === "product" && rule.target_id === product.canonical_product_id) ||
            (rule.target_type === "category" && (product.category_slug === rule.target_id || product.category === rule.target_id)) ||
            (rule.target_type === "tag" && product.tags.includes(rule.target_id));

          if (targetMatch) {
            if (rule.type === "pin") {
              isPinned = true;
              pinPos = rule.pin_position || 1;
              score += 10000;
            } else if (rule.type === "boost") {
              score += rule.score_delta || 30;
            } else if (rule.type === "bury") {
              score += rule.score_delta || -50;
            }
          }
        }

        scoredItems.push({ product, score, isPinned, pinPos });
      }
    }

    // ── Sorting ─────────────────────────────────────────────────────────────
    if (!options.sort || options.sort === "relevance") {
      scoredItems.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        if (a.isPinned && b.isPinned) return (a.pinPos || 1) - (b.pinPos || 1);
        return b.score - a.score;
      });
    } else {
      if (options.sort === "price_asc") {
        scoredItems.sort((a, b) => a.product.selling_price - b.product.selling_price);
      } else if (options.sort === "price_desc") {
        scoredItems.sort((a, b) => b.product.selling_price - a.product.selling_price);
      } else if (options.sort === "rating") {
        scoredItems.sort((a, b) => b.product.rating - a.product.rating);
      } else if (options.sort === "bestseller") {
        scoredItems.sort((a, b) => (b.product.is_bestseller ? 1 : 0) - (a.product.is_bestseller ? 1 : 0));
      } else if (options.sort === "newest") {
        scoredItems.sort((a, b) => new Date(b.product.created_at || 0).getTime() - new Date(a.product.created_at || 0).getTime());
      }
    }

    const total = scoredItems.length;
    const paginated = scoredItems.slice(offset, offset + limit).map((item) => item.product);

    // ── Facets & Suggestions Calculation ────────────────────────────────────
    const catMap = new Map<string, { id: string; name: string; slug: string; count: number }>();
    const flavMap = new Map<string, number>();
    const tagMap = new Map<string, { slug: string; name: string; count: number }>();
    let minPrice = Infinity;
    let maxPrice = 0;

    scoredItems.forEach(({ product }) => {
      if (product.category) {
        const slug = product.category_slug || product.category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const existingCat = catMap.get(slug);
        if (existingCat) existingCat.count++;
        else catMap.set(slug, { id: product.category_id || slug, name: product.category, slug, count: 1 });
      }

      if (product.flavour) {
        flavMap.set(product.flavour, (flavMap.get(product.flavour) || 0) + 1);
      }

      product.tags.forEach((t) => {
        const existingTag = tagMap.get(t);
        if (existingTag) existingTag.count++;
        else tagMap.set(t, { slug: t, name: t.replace(/-/g, " "), count: 1 });
      });

      if (product.selling_price < minPrice) minPrice = product.selling_price;
      if (product.selling_price > maxPrice) maxPrice = product.selling_price;
    });

    const suggestions: string[] = [];
    if (normalized.length >= 2) {
      this.tags.forEach((t) => {
        if (t.status === "active" && (t.name.toLowerCase().startsWith(normalized) || t.name.toLowerCase().includes(normalized))) {
          suggestions.push(t.name);
        }
      });
      catMap.forEach((c) => {
        if (c.name.toLowerCase().startsWith(normalized) || c.name.toLowerCase().includes(normalized)) {
          suggestions.push(c.name);
        }
      });
    }

    // Record Search Analytics Log
    if (rawQuery.length >= 2) {
      this.recordAnalytics({
        query: rawQuery,
        normalized_query: normalized,
        results_count: total,
        city: options.city,
        branch_id: options.branchId,
        is_zero_result: total === 0,
      });
    }

    return {
      results: paginated,
      total,
      query: rawQuery,
      normalized_query: normalized,
      facets: {
        categories: Array.from(catMap.values()),
        flavours: Array.from(flavMap.entries()).map(([name, count]) => ({ name, count })),
        tags: Array.from(tagMap.values()),
        price_range: {
          min: minPrice === Infinity ? 0 : minPrice,
          max: maxPrice === 0 ? 1500 : maxPrice,
        },
      },
      suggestions: Array.from(new Set(suggestions)).slice(0, 6),
    };
  }

  // ── 5. Analytics & Zero-Results Tracker ───────────────────────────────────
  public static recordAnalytics(entry: {
    query: string;
    normalized_query: string;
    results_count: number;
    selected_product_id?: string;
    city?: string;
    branch_id?: string;
    device?: string;
    is_zero_result: boolean;
  }) {
    const log: SearchAnalyticsEntry = {
      id: `srch_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      query: entry.query,
      normalized_query: entry.normalized_query,
      results_count: entry.results_count,
      selected_product_id: entry.selected_product_id,
      city: entry.city,
      branch_id: entry.branch_id,
      device: entry.device,
      timestamp: new Date().toISOString(),
      is_zero_result: entry.is_zero_result,
    };
    this.analyticsLogs.unshift(log);
    if (this.analyticsLogs.length > 500) {
      this.analyticsLogs = this.analyticsLogs.slice(0, 500);
    }
  }

  public static getAnalyticsSummary() {
    const totalQueries = this.analyticsLogs.length;
    const zeroResults = this.analyticsLogs.filter((l) => l.is_zero_result);
    const zeroResultRate = totalQueries > 0 ? Math.round((zeroResults.length / totalQueries) * 100) : 0;

    // Aggregate query frequencies
    const queryCounts = new Map<string, number>();
    const zeroCounts = new Map<string, number>();

    this.analyticsLogs.forEach((l) => {
      const q = l.normalized_query;
      queryCounts.set(q, (queryCounts.get(q) || 0) + 1);
      if (l.is_zero_result) {
        zeroCounts.set(q, (zeroCounts.get(q) || 0) + 1);
      }
    });

    const topQueries = Array.from(queryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const topZeroResultQueries = Array.from(zeroCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      totalQueries,
      zeroResultCount: zeroResults.length,
      zeroResultRate,
      topQueries,
      topZeroResultQueries,
      recentLogs: this.analyticsLogs.slice(0, 25),
    };
  }

  // ── 6. Admin Configuration Getters & Setters ───────────────────────────────
  public static getRankingWeights(): SearchRankingWeights {
    return { ...this.rankingWeights };
  }

  public static updateRankingWeights(weights: Partial<SearchRankingWeights>) {
    this.rankingWeights = { ...this.rankingWeights, ...weights };
  }

  public static getTags(): ProductTag[] {
    return [...this.tags];
  }

  public static saveTag(tag: ProductTag): ProductTag {
    const idx = this.tags.findIndex((t) => t.tag_id === tag.tag_id);
    if (idx >= 0) {
      this.tags[idx] = tag;
    } else {
      this.tags.push(tag);
    }
    return tag;
  }

  public static deleteTag(tagId: string) {
    this.tags = this.tags.filter((t) => t.tag_id !== tagId);
  }

  public static getSynonyms(): SearchSynonym[] {
    return [...this.synonyms];
  }

  public static saveSynonym(synonym: SearchSynonym): SearchSynonym {
    const idx = this.synonyms.findIndex((s) => s.id === synonym.id);
    if (idx >= 0) {
      this.synonyms[idx] = synonym;
    } else {
      this.synonyms.push(synonym);
    }
    return synonym;
  }

  public static deleteSynonym(synId: string) {
    this.synonyms = this.synonyms.filter((s) => s.id !== synId);
  }

  public static getMerchandisingRules(): MerchandisingRule[] {
    return [...this.merchandisingRules];
  }

  public static saveMerchandisingRule(rule: MerchandisingRule): MerchandisingRule {
    const idx = this.merchandisingRules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.merchandisingRules[idx] = rule;
    } else {
      this.merchandisingRules.push(rule);
    }
    return rule;
  }

  public static deleteMerchandisingRule(ruleId: string) {
    this.merchandisingRules = this.merchandisingRules.filter((r) => r.id !== ruleId);
  }

  public static getAllCanonicalProducts(): CanonicalProduct[] {
    return Array.from(this.canonicalProducts.values());
  }

  public static getCanonicalProduct(id: string): CanonicalProduct | undefined {
    return this.canonicalProducts.get(id);
  }

  public static initializeFromStore(rawProducts: any[]) {
    this.canonicalProducts.clear();
    if (Array.isArray(rawProducts)) {
      rawProducts.forEach((p) => this.ingestCanonicalProduct(p));
    }
    this.isInitialized = true;
  }
}
