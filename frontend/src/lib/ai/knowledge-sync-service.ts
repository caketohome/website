/**
 * CakeToHome Automatic Knowledge Sync Service
 * 
 * Synchronizes live database entities from ApiEngine into KnowledgeBase.
 * Triggers on:
 * - Application startup (lazy initialization)
 * - Single-entity CRUD events (product.updated, occasion.created, cms_page.updated, etc.)
 * - Admin manual reindex requests
 */

import { KnowledgeBase, KnowledgeDocument } from "./knowledge-base";
import { ApiEngine } from "../api-engine";

export class KnowledgeSyncService {
  private static lastSyncTime: string | null = null;
  private static syncErrors: Array<{ source: string; error: string; time: string }> = [];

  /**
   * Initialize and perform a full synchronization from ApiEngine
   */
  public static async syncAll(): Promise<{
    success: boolean;
    documentsIndexed: number;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // 1. Sync Products
      const products = ApiEngine.listProducts();
      for (const prod of products) {
        try {
          this.syncProduct(prod);
        } catch (e: any) {
          errors.push(`Product ${prod.id || prod.product_id}: ${e.message}`);
        }
      }

      // 2. Sync Occasions
      const occasions = ApiEngine.listOccasions();
      for (const occ of occasions) {
        try {
          this.syncOccasion(occ);
        } catch (e: any) {
          errors.push(`Occasion ${occ.id}: ${e.message}`);
        }
      }

      // 3. Sync Categories
      const categories = ApiEngine.listPimCategories ? ApiEngine.listPimCategories() : [];
      for (const cat of categories) {
        try {
          this.syncCategory(cat);
        } catch (e: any) {
          errors.push(`Category ${cat.id}: ${e.message}`);
        }
      }

      // 4. Sync Branches & Cities
      const branches = ApiEngine.listBranches();
      for (const branch of branches) {
        try {
          this.syncBranch(branch);
        } catch (e: any) {
          errors.push(`Branch ${branch.id}: ${e.message}`);
        }
      }

      const cities = ApiEngine.listCities ? ApiEngine.listCities() : [];
      for (const city of cities) {
        try {
          this.syncCity(city);
        } catch (e: any) {
          errors.push(`City ${city.id}: ${e.message}`);
        }
      }

      // 5. Sync Offers & Coupons
      const offers = ApiEngine.getAdminOffers ? ApiEngine.getAdminOffers({ status: "active" }) : [];
      for (const off of offers) {
        try {
          this.syncOffer(off);
        } catch (e: any) {
          errors.push(`Offer ${off.id}: ${e.message}`);
        }
      }

      // 6. Sync CMS Pages & Policies & FAQs
      const cmsPages = ApiEngine.listCmsPages ? ApiEngine.listCmsPages() : [];
      for (const page of cmsPages) {
        try {
          this.syncCmsPage(page);
        } catch (e: any) {
          errors.push(`CMS Page ${page.slug}: ${e.message}`);
        }
      }

      // 7. Sync Standard Bakery FAQs & Policies
      this.syncStandardBakeryKnowledge();

      this.lastSyncTime = new Date().toISOString();
      return {
        success: true,
        documentsIndexed: KnowledgeBase.getAllDocuments().length,
        errors,
      };
    } catch (err: any) {
      this.syncErrors.push({ source: "syncAll", error: err.message, time: new Date().toISOString() });
      return {
        success: false,
        documentsIndexed: KnowledgeBase.getAllDocuments().length,
        errors: [err.message, ...errors],
      };
    }
  }

  /**
   * Sync single product
   */
  public static syncProduct(prod: any): void {
    const prodId = prod.id || prod.product_id;
    if (!prodId) return;

    const dietary = [];
    if (prod.vegan) dietary.push("Vegan");
    if (prod.sugar_free) dietary.push("Sugar-Free");
    if (prod.gluten_free) dietary.push("Gluten-Free");

    const content = `
Product: ${prod.title || prod.name}
Price: ₹${prod.price} (MRP: ₹${prod.price})
Rating: ${prod.rating ? `${prod.rating} / 5 (${prod.review_count || 0} reviews)` : "not rated yet"}
Dietary Options: ${dietary.join(", ") || "Standard Recipe"}
Description: ${prod.description || ""}
Flavours: ${prod.title || "Artisanal Cake"}
Delivery: ${prod.is_deliverable !== false ? "Express same-day & 2-hour delivery available in serviceable zones." : "Pickup only."}
Min Prep Time: ${prod.min_prep_time_hours || 2} hours.
GST: Included in displayed price (5% confectionery GST).
    `.trim();

    const doc: KnowledgeDocument = {
      id: `doc_prod_${prodId}`,
      source_type: "product",
      source_id: prodId,
      title: prod.title || prod.name || "Artisanal Cake",
      content,
      metadata: {
        product_id: prodId,
        handle: prod.handle || prodId,
        price: prod.price,
        vegan: Boolean(prod.vegan),
        sugar_free: Boolean(prod.sugar_free),
        gluten_free: Boolean(prod.gluten_free),
        rating: prod.rating,
        thumbnail: prod.thumbnail,
      },
      language: "en",
      status: "active",
      version: 1,
      updated_at: new Date().toISOString(),
    };

    KnowledgeBase.upsertDocument(doc);
  }

  /**
   * Sync single occasion
   */
  public static syncOccasion(occ: any): void {
    const occId = occ.id || occ.slug;
    if (!occId) return;

    const content = `
Occasion: ${occ.name}
Theme: ${occ.description || `Special curated celebration cakes & accessories for ${occ.name}`}
Keywords: ${occ.name}, celebration, party, surprise, gift, cakes, flowers, greeting cards
Icon: ${occ.icon || "🎉"}
Status: ${occ.status || "active"}
    `.trim();

    const doc: KnowledgeDocument = {
      id: `doc_occ_${occId}`,
      source_type: "occasion",
      source_id: occId,
      title: `${occ.name} Celebration Cakes`,
      content,
      metadata: {
        occasion_id: occId,
        slug: occ.slug,
        name: occ.name,
      },
      language: "en",
      status: occ.status === "archived" ? "archived" : "active",
      version: 1,
      updated_at: new Date().toISOString(),
    };

    KnowledgeBase.upsertDocument(doc);
  }

  /**
   * Sync single category
   */
  public static syncCategory(cat: any): void {
    const catId = cat.id || cat.slug;
    if (!catId) return;

    const content = `
Category: ${cat.name || cat.title}
Description: ${cat.description || `Browse handcrafted ${cat.name || cat.title} baked fresh daily.`}
Parent Category: ${cat.parent_category_id || "Root Cakes"}
    `.trim();

    const doc: KnowledgeDocument = {
      id: `doc_cat_${catId}`,
      source_type: "category",
      source_id: catId,
      title: cat.name || cat.title,
      content,
      metadata: {
        category_id: catId,
        slug: cat.slug || catId,
      },
      language: "en",
      status: "active",
      version: 1,
      updated_at: new Date().toISOString(),
    };

    KnowledgeBase.upsertDocument(doc);
  }

  /**
   * Sync single branch
   */
  public static syncBranch(branch: any): void {
    const branchId = branch.id;
    if (!branchId) return;

    const pincodes = (branch.delivery_zones || []).flatMap((z: any) => z.pincodes || []);

    // Only real branch details (from Supabase) are given to the assistant; missing ones are left out.
    const hours = branch.operating_hours
      ? Object.entries(branch.operating_hours as Record<string, any>)
          .map(([day, h]) => (h?.is_open === false ? `${day}: closed` : h?.open && h?.close ? `${day}: ${h.open}–${h.close}` : ""))
          .filter(Boolean)
          .join("; ")
      : "";
    const content = [
      `Kitchen Hub: ${branch.name}`,
      branch.city ? `City: ${branch.city}` : "",
      branch.address ? `Address: ${branch.address}` : "",
      branch.phone ? `Phone: ${branch.phone}` : "",
      branch.fssai_number ? `FSSAI License: ${branch.fssai_number}` : "",
      hours ? `Operating Hours: ${hours}` : "",
      pincodes.length ? `Serviceable Pincodes: ${pincodes.slice(0, 20).join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const doc: KnowledgeDocument = {
      id: `doc_branch_${branchId}`,
      source_type: "branch",
      source_id: branchId,
      title: `CakeToHome Kitchen — ${branch.name}${branch.city ? ` (${branch.city})` : ""}`,
      content,
      metadata: {
        branch_id: branchId,
        city_id: branch.city_id,
        pincodes,
      },
      language: "en",
      status: branch.status === "archived" ? "archived" : "active",
      version: 1,
      updated_at: new Date().toISOString(),
    };

    KnowledgeBase.upsertDocument(doc);
  }

  /**
   * Sync single city
   */
  public static syncCity(city: any): void {
    const cityId = city.id;
    if (!cityId) return;

    const content = `
City: ${city.name}
State: ${city.state} (${city.stateCode || ""})
Service Status: ${city.status === "active" ? "Active delivery coverage across all central and suburban clusters." : "Coming soon."}
    `.trim();

    const doc: KnowledgeDocument = {
      id: `doc_city_${cityId}`,
      source_type: "city",
      source_id: cityId,
      title: `CakeToHome Delivery City — ${city.name}`,
      content,
      metadata: {
        city_id: cityId,
        slug: city.slug,
      },
      language: "en",
      status: city.status === "archived" ? "archived" : "active",
      version: 1,
      updated_at: new Date().toISOString(),
    };

    KnowledgeBase.upsertDocument(doc);
  }

  /**
   * Sync single offer / coupon
   */
  public static syncOffer(offer: any): void {
    const offerId = offer.id || offer.code;
    if (!offerId) return;

    const content = `
Coupon Code: ${offer.code}
Offer Title: ${offer.name}
Discount: ${offer.type === "percentage" ? `${offer.metadata?.discount_value || 10}% OFF` : `₹${offer.metadata?.discount_value || 50} FLAT OFF`}
Description: ${offer.description || `Use coupon code ${offer.code} at checkout.`}
Min Order Value: ₹${offer.min_order_value || 299}
Max Discount: ${offer.max_discount_value ? `Up to ₹${offer.max_discount_value}` : "No maximum limit"}
Applicable Cities: ${Array.isArray(offer.applicable_cities) ? offer.applicable_cities.join(", ") : "all"}
Status: ${offer.status}
    `.trim();

    const doc: KnowledgeDocument = {
      id: `doc_offer_${offerId}`,
      source_type: "offer",
      source_id: offerId,
      title: `Coupon Code: ${offer.code} (${offer.name})`,
      content,
      metadata: {
        coupon_code: offer.code,
        discount_value: offer.metadata?.discount_value,
        type: offer.type,
        min_order_value: offer.min_order_value,
      },
      language: "en",
      status: offer.status === "active" ? "active" : "archived",
      version: 1,
      updated_at: new Date().toISOString(),
    };

    KnowledgeBase.upsertDocument(doc);
  }

  /**
   * Sync CMS Page
   */
  public static syncCmsPage(page: any): void {
    const slug = page.slug || page.id;
    if (!slug) return;

    const sectionHeadlines = (page.sections || [])
      .map((s: any) => `${s.name}: ${s.config?.headline || s.config?.heading || ""}`)
      .join("\n");

    const content = `
CMS Page: ${page.title || slug}
Slug: /${slug === "home" ? "" : slug}
Meta Description: ${page.meta_description || ""}
Content Overview:
${sectionHeadlines}
    `.trim();

    const doc: KnowledgeDocument = {
      id: `doc_cms_${slug}`,
      source_type: "cms_page",
      source_id: slug,
      title: page.title || `CakeToHome Page: ${slug}`,
      content,
      metadata: {
        slug,
      },
      language: "en",
      status: page.status === "published" ? "active" : "archived",
      version: 1,
      updated_at: new Date().toISOString(),
    };

    KnowledgeBase.upsertDocument(doc);
  }

  /**
   * Index standard policies, delivery timelines, and FAQs
   */
  private static syncStandardBakeryKnowledge(): void {
    const policies = [
      {
        id: "pol_delivery",
        title: "CakeToHome Delivery & Time Slots Policy",
        content: `
Delivery Options:
1. Standard Delivery: Free on orders above ₹599 (₹49 for orders below ₹599). 2-hour delivery window.
2. Express 45-Min Hyperlocal Delivery: ₹99 surcharge. Delivered directly from closest kitchen hub via bike fleet.
3. Scheduled Celebration Delivery: Same-day & advance time slots available between 09:00 AM and 10:00 PM.
4. Early Morning Slot: 07:00 AM – 09:00 AM.
Packaging: Specially engineered climate-controlled shock-absorbent domes ensure cakes arrive in pristine, chilled condition without slipping or melting.
        `.trim(),
      },
      {
        id: "pol_cancellation",
        title: "CakeToHome Cancellation & Refund Policy",
        content: `
Cancellation Policy:
- Custom / Photo Cakes: Cancellation allowed up to 4 hours before requested delivery slot (before baking commences).
- Standard Catalog Cakes: Cancellation allowed up to 2 hours before delivery slot.
- Orders in "OUT_FOR_DELIVERY" or "BAKING" state cannot be cancelled once freshly prepared.
Refunds:
- Approved refunds are credited to original payment method within 2-4 business days.
Damaged / Quality Guarantee:
- 100% replacement or refund guaranteed if cake is damaged in transit. Photo proof requested via WhatsApp support (+91 80 4567 8900).
        `.trim(),
      },
      {
        id: "faq_dietary",
        title: "Dietary Options & Ingredients FAQ",
        content: `
Special Dietary Options:
- Vegan and Sugar-Free cakes use organic almond milk and natural stevia/erythritol sweeteners.
- Gluten-free options are baked with premium oat and almond flour.
- All cakes are baked fresh with premium dairy butter, authentic chocolate, and fresh fruit purees.
        `.trim(),
      },
      {
        id: "faq_customization",
        title: "Custom Photo Cakes, Cake Messages & Add-Ons FAQ",
        content: `
Custom Message: Free customized chocolate plaque with up to 35 characters included with every cake order.
Photo Cakes: Upload any high-res image during checkout. Printed using 100% edible food-grade ink on sugar sheets.
Add-ons & Accessories:
- Sparkling birthday candles, balloon bouquets, birthday caps, musical candles.
- Fresh rose bouquets, luxury Ferrero Rocher chocolates, teddy bears, handwritten greeting cards.
        `.trim(),
      },
    ];

    for (const p of policies) {
      KnowledgeBase.upsertDocument({
        id: `doc_std_${p.id}`,
        source_type: "policy",
        source_id: p.id,
        title: p.title,
        content: p.content,
        metadata: {},
        language: "en",
        status: "active",
        version: 1,
        updated_at: new Date().toISOString(),
      });
    }
  }

  public static getSyncStatus(): {
    lastSyncTime: string | null;
    totalDocuments: number;
    errors: Array<{ source: string; error: string; time: string }>;
  } {
    return {
      lastSyncTime: this.lastSyncTime,
      totalDocuments: KnowledgeBase.getAllDocuments().length,
      errors: this.syncErrors.slice(-10),
    };
  }
}
