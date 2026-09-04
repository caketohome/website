/**
 * CakeToHome CMS — PIM Product Resolver
 * 
 * Resolves products from the PIM data based on section configuration.
 * Works entirely on the passed-in product array — NO additional database calls.
 * 
 * Used by both:
 * - CMS preview canvas (admin)
 * - Storefront renderer (public)
 * 
 * BUSINESS RULE: CMS controls PRESENTATION, PIM controls PRODUCT DATA.
 * This resolver bridges the two: section config says "what products to show",
 * PIM data says "what those products are".
 */

export interface PimProductFilter {
  /** Product source mode */
  mode?: "best_sellers" | "new_arrivals" | "featured" | "trending" | "all" | "manual" | "category" | "occasion" | "collection" | "tag" | "dynamic" | "recommended" | "recently_viewed" | "related";
  /** Manual product IDs */
  product_ids?: string[];
  /** PIM category filter */
  category_id?: string;
  category_ids?: string[];
  category_filter?: string;
  /** PIM subcategory */
  subcategory_id?: string;
  /** PIM occasion filter */
  occasion_id?: string;
  occasion_ids?: string[];
  occasion_filter?: string;
  /** PIM collection */
  collection_id?: string;
  /** PIM tag filter */
  tag_filter?: string;
  tags?: string[];
  /** Flavor filter */
  flavor_filter?: string;
  flavors?: string[];
  /** Weight filter */
  weight_filter?: string;
  weights?: string[];
  /** Egg type filter */
  egg_type?: "egg" | "eggless" | "both" | "";
  /** Vegetarian filter */
  vegetarian_only?: boolean;
  /** Price range */
  price_min?: number;
  price_max?: number;
  /** Branch availability */
  branch_id?: string;
  branch_ids?: string[];
  /** City availability */
  city_id?: string;
  city_ids?: string[];
  /** Featured status */
  featured_only?: boolean;
  /** Availability filter */
  available_only?: boolean;
  /** Sort mode */
  sort?: "pim_order" | "best_selling" | "popularity" | "newest" | "price_low_high" | "price_high_low" | "rating" | "name_asc" | "name_desc";
  /** Result limit */
  limit?: number;
}

/**
 * Resolve products from PIM data based on section configuration.
 * 
 * @param allProducts - Complete product array from PIM/database
 * @param config - Section configuration containing filter/sort/limit settings
 * @param allCategories - Available categories for category-based filtering
 * @param allOccasions - Available occasions for occasion-based filtering
 * @returns Filtered, sorted, and limited product array
 */
export function resolveProducts(
  allProducts: any[],
  config: Record<string, any>,
  allCategories: any[] = [],
  allOccasions: any[] = [],
): any[] {
  if (!allProducts || allProducts.length === 0) return [];

  const filter: PimProductFilter = {
    mode: config.mode || "best_sellers",
    product_ids: config.product_ids,
    category_id: config.category_id,
    category_ids: config.category_ids,
    category_filter: config.category_filter,
    subcategory_id: config.subcategory_id,
    occasion_id: config.occasion_id,
    occasion_ids: config.occasion_ids,
    occasion_filter: config.occasion_filter,
    collection_id: config.collection_id,
    tag_filter: config.tag_filter,
    tags: config.tags,
    flavor_filter: config.flavor_filter,
    flavors: config.flavors,
    weight_filter: config.weight_filter,
    weights: config.weights,
    egg_type: config.egg_type,
    vegetarian_only: config.vegetarian_only,
    price_min: config.price_min,
    price_max: config.price_max,
    branch_id: config.branch_id,
    branch_ids: config.branch_ids,
    city_id: config.city_id,
    city_ids: config.city_ids,
    featured_only: config.featured_only,
    available_only: config.available_only !== false, // default true
    sort: config.sort || "best_selling",
    limit: config.limit || 8,
  };

  let products = [...allProducts];

  // ── Step 1: Filter by availability (exclude archived/out-of-stock) ───
  if (filter.available_only) {
    products = products.filter(p =>
      p.is_archived !== true &&
      p.deleted_at == null &&
      p.status !== "archived" &&
      p.status !== "deleted"
    );
  }

  // ── Step 2: Apply source mode ────────────────────────────────────────
  if (filter.mode === "manual" && filter.product_ids && filter.product_ids.length > 0) {
    // Manual selection — preserve order
    const idSet = new Set(filter.product_ids);
    const productMap = new Map(products.map(p => [p.id || p.product_id, p]));
    products = filter.product_ids
      .map(id => productMap.get(id))
      .filter(Boolean) as any[];
  } else if (filter.mode === "best_sellers") {
    products = products.filter(p => p.is_bestseller || p.is_best_seller);
    if (products.length === 0) products = [...allProducts]; // fallback
  } else if (filter.mode === "new_arrivals") {
    products = products.filter(p => p.is_new_arrival || p.is_new);
    if (products.length === 0) products = [...allProducts]; // fallback
  } else if (filter.mode === "featured") {
    products = products.filter(p => p.is_featured || p.featured);
    if (products.length === 0) products = [...allProducts]; // fallback
  } else if (filter.mode === "trending") {
    products = products.filter(p => p.is_trending || p.trending);
    if (products.length === 0) products = [...allProducts]; // fallback
  }

  // ── Step 3: Apply PIM filters ────────────────────────────────────────

  // Category filter
  if (filter.category_id || (filter.category_ids && filter.category_ids.length > 0)) {
    const catIds = filter.category_ids || (filter.category_id ? [filter.category_id] : []);
    if (catIds.length > 0) {
      products = products.filter(p => {
        const pCatId = p.category_id || p.category;
        const pCatIds = p.category_ids || (pCatId ? [pCatId] : []);
        return catIds.some(cid => pCatIds.includes(cid) || pCatId === cid);
      });
    }
  }

  // Category name filter (for occasion-based sections)
  if (filter.category_filter) {
    const cf = filter.category_filter.toLowerCase();
    products = products.filter(p => {
      const catName = (p.category_name || p.category || "").toLowerCase();
      return catName.includes(cf);
    });
  }

  // Subcategory filter
  if (filter.subcategory_id) {
    products = products.filter(p =>
      p.subcategory_id === filter.subcategory_id ||
      p.subcategory === filter.subcategory_id
    );
  }

  // Occasion filter
  if (filter.occasion_id || (filter.occasion_ids && filter.occasion_ids.length > 0)) {
    const occIds = filter.occasion_ids || (filter.occasion_id ? [filter.occasion_id] : []);
    if (occIds.length > 0) {
      products = products.filter(p => {
        const pOccId = p.occasion_id || p.occasion;
        const pOccIds = p.occasion_ids || p.occasions || (pOccId ? [pOccId] : []);
        return occIds.some(oid => pOccIds.includes(oid) || pOccId === oid);
      });
    }
  }

  // Occasion name filter (for named occasion sections like "birthday", "wedding")
  if (filter.occasion_filter) {
    const of = filter.occasion_filter.toLowerCase();
    // Look up occasion ID from name
    const matchedOccasion = allOccasions.find(
      (o: any) => (o.name || o.title || "").toLowerCase().includes(of) || (o.slug || "").toLowerCase().includes(of)
    );
    if (matchedOccasion) {
      const occId = matchedOccasion.id;
      products = products.filter(p => {
        const pOccIds = p.occasion_ids || p.occasions || [];
        const pOccId = p.occasion_id || p.occasion;
        return pOccIds.includes(occId) || pOccId === occId;
      });
    } else {
      // Fallback: match on occasion name in product
      products = products.filter(p => {
        const pOccName = (p.occasion_name || p.occasion || "").toLowerCase();
        const pOccNames = (p.occasion_names || []).map((n: string) => n.toLowerCase());
        return pOccName.includes(of) || pOccNames.some((n: string) => n.includes(of));
      });
    }
  }

  // Collection filter
  if (filter.collection_id) {
    products = products.filter(p =>
      p.collection_id === filter.collection_id ||
      (p.collection_ids || []).includes(filter.collection_id)
    );
  }

  // Tag filter
  if (filter.tag_filter || (filter.tags && filter.tags.length > 0)) {
    const tags = filter.tags || (filter.tag_filter ? [filter.tag_filter] : []);
    if (tags.length > 0) {
      const tagSet = new Set(tags.map(t => t.toLowerCase()));
      products = products.filter(p => {
        const pTags = (p.tags || []).map((t: string) => t.toLowerCase());
        return pTags.some((t: string) => tagSet.has(t));
      });
    }
  }

  // Flavor filter
  if (filter.flavor_filter || (filter.flavors && filter.flavors.length > 0)) {
    const flavors = filter.flavors || (filter.flavor_filter ? [filter.flavor_filter] : []);
    if (flavors.length > 0) {
      const flavorSet = new Set(flavors.map(f => f.toLowerCase()));
      products = products.filter(p => {
        const pFlavor = (p.flavor || p.flavour || "").toLowerCase();
        const pFlavors = (p.flavors || p.flavours || []).map((f: string) => f.toLowerCase());
        return flavorSet.has(pFlavor) || pFlavors.some((f: string) => flavorSet.has(f));
      });
    }
  }

  // Weight filter
  if (filter.weight_filter || (filter.weights && filter.weights.length > 0)) {
    const weights = filter.weights || (filter.weight_filter ? [filter.weight_filter] : []);
    if (weights.length > 0) {
      const weightSet = new Set(weights.map(w => w.toLowerCase()));
      products = products.filter(p => {
        const pWeight = String(p.weight || p.base_weight || "").toLowerCase();
        return weightSet.has(pWeight);
      });
    }
  }

  // Egg type filter
  if (filter.egg_type && filter.egg_type !== "both") {
    products = products.filter(p => {
      if (filter.egg_type === "eggless") {
        return p.is_eggless === true || p.egg_type === "eggless" || p.eggless === true;
      }
      return p.is_eggless !== true && p.egg_type !== "eggless" && p.eggless !== true;
    });
  }

  // Vegetarian filter
  if (filter.vegetarian_only) {
    products = products.filter(p => p.is_vegetarian === true || p.vegetarian === true || p.veg === true);
  }

  // Price range filter
  if (filter.price_min != null || filter.price_max != null) {
    products = products.filter(p => {
      const price = Number(p.price || p.base_price || 0);
      if (filter.price_min != null && price < filter.price_min) return false;
      if (filter.price_max != null && price > filter.price_max) return false;
      return true;
    });
  }

  // Branch availability
  if (filter.branch_id || (filter.branch_ids && filter.branch_ids.length > 0)) {
    const branchIds = filter.branch_ids || (filter.branch_id ? [filter.branch_id] : []);
    if (branchIds.length > 0) {
      products = products.filter(p => {
        const pBranches = p.branch_ids || p.available_branches || [];
        const pBranch = p.branch_id;
        return branchIds.some(bid => pBranches.includes(bid) || pBranch === bid);
      });
    }
  }

  // City availability
  if (filter.city_id || (filter.city_ids && filter.city_ids.length > 0)) {
    const cityIds = filter.city_ids || (filter.city_id ? [filter.city_id] : []);
    if (cityIds.length > 0) {
      products = products.filter(p => {
        const pCities = p.city_ids || p.available_cities || [];
        const pCity = p.city_id;
        return cityIds.some(cid => pCities.includes(cid) || pCity === cid);
      });
    }
  }

  // Featured only
  if (filter.featured_only) {
    products = products.filter(p => p.is_featured || p.featured);
  }

  // ── Step 4: Sort ─────────────────────────────────────────────────────
  // If manual selection mode and no explicit sort provided, preserve manual order
  if (filter.mode !== "manual" || config.sort) {
    switch (filter.sort) {
      case "best_selling":
        products.sort((a, b) => (b.sales_count || b.order_count || 0) - (a.sales_count || a.order_count || 0));
        break;
    case "popularity":
      products.sort((a, b) => (b.view_count || b.popularity || 0) - (a.view_count || a.popularity || 0));
      break;
    case "newest":
      products.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      break;
    case "price_low_high":
      products.sort((a, b) => (Number(a.price || a.base_price || 0)) - (Number(b.price || b.base_price || 0)));
      break;
    case "price_high_low":
      products.sort((a, b) => (Number(b.price || b.base_price || 0)) - (Number(a.price || a.base_price || 0)));
      break;
    case "rating":
      products.sort((a, b) => (Number(b.rating || 0)) - (Number(a.rating || 0)));
      break;
    case "name_asc":
      products.sort((a, b) => (a.title || a.name || "").localeCompare(b.title || b.name || ""));
      break;
    case "name_desc":
      products.sort((a, b) => (b.title || b.name || "").localeCompare(a.title || a.name || ""));
      break;
    case "pim_order":
    default:
      // Keep PIM order (sort_order field if available)
      products.sort((a, b) => (a.sort_order || a.display_order || 0) - (b.sort_order || b.display_order || 0));
      break;
    }
  }

  // ── Step 5: Limit ────────────────────────────────────────────────────
  const limit = filter.limit || 8;
  if (limit > 0 && products.length > limit) {
    products = products.slice(0, limit);
  }

  return products;
}

/**
 * Extract unique filter values from the product catalog.
 * Used to populate filter dropdowns in the section config editor.
 */
export function extractFilterValues(allProducts: any[], allCategories: any[] = [], allOccasions: any[] = []) {
  const flavors = new Set<string>();
  const weights = new Set<string>();
  const cities = new Set<string>();
  const branches = new Set<string>();

  for (const p of allProducts) {
    if (p.flavor || p.flavour) flavors.add(p.flavor || p.flavour);
    if (p.flavors) p.flavors.forEach((f: string) => flavors.add(f));
    if (p.weight || p.base_weight) weights.add(String(p.weight || p.base_weight));
    if (p.city_id) cities.add(p.city_id);
    if (p.branch_id) branches.add(p.branch_id);
    if (p.available_cities) p.available_cities.forEach((c: string) => cities.add(c));
    if (p.branch_ids) p.branch_ids.forEach((b: string) => branches.add(b));
  }

  return {
    categories: allCategories.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })),
    occasions: allOccasions.map((o: any) => ({ id: o.id, name: o.name || o.title, slug: o.slug })),
    flavors: Array.from(flavors).sort(),
    weights: Array.from(weights).sort((a, b) => parseFloat(a) - parseFloat(b)),
    cities: Array.from(cities).sort(),
    branches: Array.from(branches).sort(),
    eggTypes: ["egg", "eggless", "both"],
    sortOptions: [
      { value: "pim_order", label: "PIM Order" },
      { value: "best_selling", label: "Best Selling" },
      { value: "popularity", label: "Popularity" },
      { value: "newest", label: "Newest First" },
      { value: "price_low_high", label: "Price: Low → High" },
      { value: "price_high_low", label: "Price: High → Low" },
      { value: "rating", label: "Highest Rated" },
      { value: "name_asc", label: "Name A → Z" },
      { value: "name_desc", label: "Name Z → A" },
    ],
    limitOptions: [4, 6, 8, 12, 16, 24, 32],
  };
}
