"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useFavorites } from "@/providers/favorites-provider";
import type { ProductReview } from "@frontend/lib/data/catalog";
import { addToCart } from "@frontend/lib/actions/carts";
import { retrieveBranchInventory } from "@frontend/lib/data/branches";
import { apiClient } from "@frontend/lib/api-client";
import { cartBus } from "@frontend/lib/cart/cart-event-bus";
import { resolveProductInventoryMode } from "@frontend/lib/types/domain";

// Modular PDP Components
import {
  PdpBreadcrumb,
  PdpGallery,
  PdpInfoPanel,
  PdpVariantSelector,
  PdpCustomizationForm,
  PdpPurchaseActions,
  PdpStickyBar,
  PdpDeliveryChecker,
  PdpRelatedProducts,
  PdpFaqSection,
  PdpEmptyMessageModal,
} from "../pdp";

// Dynamic Reviews Section for bundle optimization & SSR compatibility
const ProductReviewsSection = dynamic(
  () => import("./product-reviews-section").then((mod) => mod.ProductReviewsSection),
  {
    loading: () => (
      <div className="mt-16 pt-12 border-t border-slate-200 animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded-lg mb-6" />
        <div className="h-32 bg-slate-100 rounded-2xl" />
      </div>
    ),
    ssr: true,
  }
);

interface ProductDetailProps {
  product: any;
  meta: any;
  initialReviews: ProductReview[];
  reviewCount: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  isWishlistedInitial: boolean;
  shopId: string;
  variantId: string;
  weightPrices?: any[];
  masterVariantOptions?: any[];
  pimConfig?: Record<string, boolean>;
  pdpConfig?: Record<string, any>;
  relatedProducts?: any[];
}

export default function ProductDetailClient({
  product,
  meta,
  initialReviews,
  reviewCount,
  averageRating,
  ratingDistribution,
  isWishlistedInitial,
  shopId,
  variantId,
  weightPrices = [],
  masterVariantOptions = [],
  pimConfig = {},
  pdpConfig = {},
  relatedProducts = [],
}: ProductDetailProps) {
  const router = useRouter();
  const { isFavorited, toggleFavorite } = useFavorites();
  const prodId = product.id || product.product_id;
  const isWishlisted = isFavorited(prodId);

  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const [showEmptyMessageConfirm, setShowEmptyMessageConfirm] = useState(false);
  const [pendingRedirectToCheckout, setPendingRedirectToCheckout] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [addedCartSuccess, setAddedCartSuccess] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  // Active PIM requirement and visibility configuration
  const activePimConfig = useMemo(() => {
    const isNonCakeProduct =
      (product?.merchandise_type || "").toUpperCase() === "ACCESSORY" ||
      String(product?.id || "").startsWith("acc_") ||
      String(product?.id || "").includes("bouquet") ||
      String(product?.slug || "").includes("bouquet") ||
      String(product?.category_slug || "").toLowerCase().includes("accessor") ||
      String(product?.category_slug || "").toLowerCase().includes("bouquet") ||
      String(product?.category || "").toLowerCase().includes("accessor") ||
      String(product?.category || "").toLowerCase().includes("bouquet");

    const defaults = {
      show_weight: !isNonCakeProduct,
      required_weight: !isNonCakeProduct,
      show_shape: !isNonCakeProduct,
      required_shape: false,
      show_flavour: !isNonCakeProduct,
      required_flavour: false,
      show_filling: !isNonCakeProduct,
      required_filling: false,
      show_cream: !isNonCakeProduct,
      required_cream: false,
      show_dietary: !isNonCakeProduct,
      required_dietary: false,
      show_photo_cake: !isNonCakeProduct,
      required_photo_cake: false,
      show_cake_message: !isNonCakeProduct,
      required_cake_message: false,
      show_candles: !isNonCakeProduct,
      show_greeting_card: true,
      show_balloons: !isNonCakeProduct,
      show_knife: !isNonCakeProduct,
      show_premium_packaging: true,
      show_customer_notes: true,
    };
    return { ...defaults, ...pimConfig, ...(product?.pim_config || {}) };
  }, [pimConfig, product]);

  // Authoritative Gallery Images
  const galleryImages = useMemo(() => {
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images;
    }
    const isAccessory = (product?.merchandise_type || "").toUpperCase() === "ACCESSORY" || (product?.id && String(product?.id).startsWith("acc_"));
    const fallback = isAccessory
      ? "/images/gold-acrylic-topper.jpg"
      : "/images/default-cake.jpg";
    return [product.thumbnail || fallback];
  }, [product]);

  // Option helper: only include enabled options
  const isOptionActive = (o: any) =>
    o &&
    o.is_enabled !== false &&
    o.enabled !== false &&
    o.status !== "disabled" &&
    o.status !== "archived";

  // Dynamic Weight Variants from DB
  const weightsList = useMemo(() => {
    if (activePimConfig.show_weight === false) {
      return [];
    }
    let raw: any[] = [];
    if (weightPrices && weightPrices.length > 0) {
      raw = weightPrices;
    } else if (masterVariantOptions && masterVariantOptions.length > 0) {
      raw = masterVariantOptions.filter((o: any) => o.type === "weight");
    }
    return raw
      .filter(isOptionActive)
      .filter((wp: any) => {
        const name = String(wp.weight_name || wp.name || "").trim().toLowerCase();
        return name !== "1 pc" && name !== "1 piece" && name !== "1pc";
      })
      .map((wp: any) => ({
        id: wp.id || wp.weight_id,
        name: wp.weight_name || wp.name,
        price: Number(wp.selling_price) || product.price + (Number(wp.price_modifier) || 0),
        is_enabled: true,
      }));
  }, [weightPrices, masterVariantOptions, product.price, activePimConfig.show_weight]);

  // Dynamic Storefront Options from DB / API
  const [storefrontOptions, setStorefrontOptions] = useState<any>({
    enable_flavor_selection: true,
    enable_shape_selection: true,
    flavors: [],
    shapes: [],
  });

  useEffect(() => {
    if (product?.id) {
      apiClient
        .getStorefrontProductOptions(product.id)
        .then((res: any) => {
          if (res) setStorefrontOptions(res);
        })
        .catch(() => null);
    }
  }, [product?.id]);

  const shapesList = useMemo(() => {
    if (!storefrontOptions.enable_shape_selection) return [];
    return (storefrontOptions.shapes || []).filter(
      (s: any) => s.is_enabled !== false && s.status !== "archived"
    );
  }, [storefrontOptions]);

  const flavoursList = useMemo(() => {
    if (!storefrontOptions.enable_flavor_selection) return [];
    return (storefrontOptions.flavors || []).filter(
      (f: any) => f.is_enabled !== false && f.status !== "archived"
    );
  }, [storefrontOptions]);

  const fillingsList = useMemo(() => {
    if (!storefrontOptions.enable_filling_selection) return [];
    return (storefrontOptions.fillings || []).filter(
      (f: any) => f.is_enabled !== false && f.status !== "archived"
    );
  }, [storefrontOptions]);

  const creamsList = useMemo(() => {
    if (!storefrontOptions.enable_cream_selection) return [];
    return (storefrontOptions.creams || []).filter(
      (c: any) => c.is_enabled !== false && c.status !== "archived"
    );
  }, [storefrontOptions]);

  // Accessories & Addons from DB
  const [recommendedAccessories, setRecommendedAccessories] = useState<any[]>([]);

  useEffect(() => {
    if (product?.id) {
      apiClient
        .getAccessories(shopId ? { branchId: shopId, productId: product.id } : product.id)
        .then((res: any) => {
          if (res?.accessories && Array.isArray(res.accessories)) {
            setRecommendedAccessories(res.accessories);
          }
        })
        .catch(() => null);
    }
  }, [product?.id, shopId]);

  const addonsList = useMemo(() => {
    return recommendedAccessories.map((acc: any) => {
      const availStock = Number(acc.available_stock !== undefined ? acc.available_stock : (acc.stock ?? 0));
      return {
        id: acc.id,
        product_id: acc.id,
        variant_id: acc.variant_id || `var_${acc.id}`,
        name: acc.name || acc.title,
        title: acc.name || acc.title,
        price: Number(acc.price) || 0,
        thumbnail: acc.thumbnail,
        stock: availStock,
        available_stock: availStock,
        low_stock_threshold: Number(acc.low_stock_threshold || 5),
      };
    });
  }, [recommendedAccessories]);

  // Dietary Capabilities
  const hasSugarFree = meta?.sugar_free === true || product?.sugar_free === true;
  const hasGlutenFree = meta?.gluten_free === true || product?.gluten_free === true;
  const hasVegan = meta?.vegan === true || product?.vegan === true;

  // Selected Option States
  const [selectedWeight, setSelectedWeight] = useState<any>(weightsList[0] || null);
  const [selectedShape, setSelectedShape] = useState<any>(shapesList[0] || null);
  const [selectedFlavour, setSelectedFlavour] = useState<any>(flavoursList[0] || null);
  const [selectedFilling, setSelectedFilling] = useState<any>(fillingsList[0] || null);
  const [selectedCream, setSelectedCream] = useState<any>(creamsList[0] || null);

  useEffect(() => {
    if (weightsList.length > 0) {
      if (
        !selectedWeight ||
        !weightsList.some((w: any) => (w.id || w.name) === (selectedWeight.id || selectedWeight.name))
      ) {
        setSelectedWeight(weightsList[0]);
      }
    } else {
      setSelectedWeight(null);
    }
  }, [weightsList]);

  useEffect(() => {
    if (shapesList.length > 0) {
      if (
        !selectedShape ||
        !shapesList.some((s: any) => (s.id || s.name) === (selectedShape.id || selectedShape.name))
      ) {
        setSelectedShape(shapesList[0]);
      }
    } else {
      setSelectedShape(null);
    }
  }, [shapesList]);

  useEffect(() => {
    if (flavoursList.length > 0) {
      if (
        !selectedFlavour ||
        !flavoursList.some((f: any) => (f.id || f.name) === (selectedFlavour.id || selectedFlavour.name))
      ) {
        setSelectedFlavour(flavoursList[0]);
      }
    } else {
      setSelectedFlavour(null);
    }
  }, [flavoursList]);

  useEffect(() => {
    if (fillingsList.length > 0) {
      if (
        !selectedFilling ||
        !fillingsList.some((fil: any) => (fil.id || fil.name) === (selectedFilling.id || selectedFilling.name))
      ) {
        setSelectedFilling(fillingsList[0]);
      }
    } else {
      setSelectedFilling(null);
    }
  }, [fillingsList]);

  useEffect(() => {
    if (creamsList.length > 0) {
      if (
        !selectedCream ||
        !creamsList.some((c: any) => (c.id || c.name) === (selectedCream.id || selectedCream.name))
      ) {
        setSelectedCream(creamsList[0]);
      }
    } else {
      setSelectedCream(null);
    }
  }, [creamsList]);

  // Dietary Switches
  const [isSugarFree, setIsSugarFree] = useState<boolean>(false);
  const [isGlutenFree, setIsGlutenFree] = useState<boolean>(false);
  const [isVegan, setIsVegan] = useState<boolean>(false);

  // Photo Print & Inscription
  const [isPhotoCake, setIsPhotoCake] = useState<boolean>(false);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [cakeMessage, setCakeMessage] = useState<string>("");

  // Addons & Greeting Card Note
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [greetingCardText, setGreetingCardText] = useState<string>("");

  // Quantity Selector
  const [quantity, setQuantity] = useState<number>(1);

  // Branch Inventory & Occasions
  const [branchStock, setBranchStock] = useState<number | null>(null);
  const [allOccasions, setAllOccasions] = useState<any[]>([]);

  useEffect(() => {
    apiClient
      .getOccasions()
      .then((r: any) => {
        if (r?.occasions) setAllOccasions(r.occasions);
      })
      .catch(() => null);
  }, []);

  const productOccasions = useMemo(() => {
    const pOccIds =
      Array.isArray(product?.occasion_ids) && product.occasion_ids.length > 0
        ? product.occasion_ids
        : product?.occasion
        ? [product.occasion]
        : [];
    if (pOccIds.length === 0) return [{ name: "Birthday", slug: "birthday", icon: "🎂" }];
    return pOccIds.map((idOrName: string) => {
      const found = allOccasions.find(
        (o) =>
          o.id === idOrName ||
          o.slug === idOrName ||
          o.name.toLowerCase() === idOrName.toLowerCase()
      );
      if (found) return found;
      const cleanName = idOrName.replace(/^occ_/, "").replace(/_/g, " ");
      return {
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        slug: cleanName.toLowerCase().replace(/\s+/g, "-"),
        icon: "🎉",
      };
    });
  }, [product, allOccasions]);

  const getCookie = (name: string): string | null => {
    if (typeof document === "undefined") return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
    return null;
  };

  const inventoryMode = useMemo(() => {
    return resolveProductInventoryMode(product);
  }, [product]);

  const [branchKitchenUnavailable, setBranchKitchenUnavailable] = useState(false);

  useEffect(() => {
    const branchId = getCookie("_cakes2home_branch_id");

    if (inventoryMode === "MADE_TO_ORDER_AVAILABILITY") {
      // Fresh cakes are made-to-order: never assign synthetic integer stock
      setBranchStock(null);
      if (branchId) {
        apiClient
          .getBranches()
          .then((res: any) => {
            const b = (res?.branches || []).find((br: any) => br.id === branchId);
            if (b) {
              const override = b.product_availability?.[prodId];
              const status = (override?.status || "").toUpperCase();
              const isKitchenClosed = b.cake_fulfilment && b.cake_fulfilment.can_fulfil === false;
              if (
                status === "OUT_OF_STOCK" ||
                status === "UNAVAILABLE" ||
                status === "OUT_TODAY" ||
                status === "HIDDEN" ||
                isKitchenClosed
              ) {
                setBranchKitchenUnavailable(true);
              } else {
                setBranchKitchenUnavailable(false);
              }
            }
          })
          .catch(() => null);
      }
      return;
    }

    if (inventoryMode === "STOCK_CONTROLLED") {
      if (!branchId) return;
      const targetId = variantId || prodId;
      if (!targetId) return;
      retrieveBranchInventory(branchId, targetId, prodId)
        .then((stockData) => {
          setBranchStock(typeof stockData.availableStock === "number" ? stockData.availableStock : 0);
        })
        .catch((err) => {
          console.error("Failed to load branch stock", err);
          setBranchStock(0);
        });
    }
  }, [variantId, prodId, inventoryMode]);

  // Live Dynamic Price Calculator
  const calculatedPrice = useMemo(() => {
    const base =
      activePimConfig.show_weight !== false && selectedWeight
        ? selectedWeight.price
        : product.price || 599;

    const shapeMod =
      activePimConfig.show_shape && selectedShape
        ? Number(selectedShape.price_modifier || selectedShape.additional_price || 0)
        : 0;

    const flavourMod =
      activePimConfig.show_flavour && selectedFlavour
        ? Number(selectedFlavour.price_modifier || selectedFlavour.extra_price || 0)
        : 0;

    const dietaryMod =
      activePimConfig.show_dietary !== false
        ? (hasSugarFree && isSugarFree ? 100 : 0) +
          (hasGlutenFree && isGlutenFree ? 100 : 0) +
          (hasVegan && isVegan ? 120 : 0)
        : 0;

    const photoMod = activePimConfig.show_photo_cake && isPhotoCake ? 250 : 0;

    const addonsTotal = selectedAddonIds.reduce((sum, id) => {
      const item = addonsList.find((a) => a.id === id);
      return sum + (item ? Number(item.price || 0) : 0);
    }, 0);

    return (base + shapeMod + flavourMod + dietaryMod + photoMod + addonsTotal) * quantity;
  }, [
    activePimConfig,
    selectedWeight,
    selectedShape,
    selectedFlavour,
    hasSugarFree,
    isSugarFree,
    hasGlutenFree,
    isGlutenFree,
    hasVegan,
    isVegan,
    isPhotoCake,
    selectedAddonIds,
    addonsList,
    quantity,
    product.price,
  ]);

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleWishlistToggle = async () => {
    setWishlistLoading(true);
    try {
      await toggleFavorite(prodId, { title: product.title, handle: product.handle });
    } catch (e) {
      console.error("Failed to toggle wishlist", e);
    } finally {
      setWishlistLoading(false);
    }
  };

  const executeAddToCart = async (redirectToCheckout = false, overrideCakeMessage?: string) => {
    console.log("[PDP Client] executeAddToCart invoked, variantId:", variantId, "shopId:", shopId);
    if (isSubmittingRef.current || cartLoading) {
      console.log("[PDP Client] executeAddToCart skipped due to isSubmittingRef or cartLoading");
      return;
    }

    const targetShopId = shopId || "default_shop";
    isSubmittingRef.current = true;
    setCartLoading(true);
    setCartError(null);

    try {
      const chosenAddons = addonsList
        .filter((a) => selectedAddonIds.includes(a.id))
        .map((a) => a.name);

      const chosenAddonsDetail = addonsList
        .filter((a) => selectedAddonIds.includes(a.id))
        .map((a) => ({
          id: a.id,
          product_id: a.product_id || a.id,
          variant_id: a.variant_id || `var_${a.id}`,
          title: a.name,
          name: a.name,
          price: Number(a.price || 0),
          quantity: 1,
        }));

      const rawMsg = overrideCakeMessage !== undefined ? overrideCakeMessage : cakeMessage;
      const normalizedCakeMsg =
        activePimConfig.show_cake_message !== false && rawMsg
          ? rawMsg.trim().slice(0, 30) || null
          : null;

      const metadata = {
        productId: product.id,
        variantId: variantId,
        weight: activePimConfig.show_weight !== false && selectedWeight && selectedWeight.name !== "1 pc" && selectedWeight.name !== "1 piece" ? selectedWeight.name : null,
        shape: activePimConfig.show_shape && selectedShape ? selectedShape.name : null,
        flavour: activePimConfig.show_flavour && selectedFlavour ? selectedFlavour.name : null,
        sugar_free: hasSugarFree ? isSugarFree : false,
        gluten_free: hasGlutenFree ? isGlutenFree : false,
        vegan: hasVegan ? isVegan : false,
        photo_cake: activePimConfig.show_photo_cake && isPhotoCake ? photoUrl || "Uploaded Photo" : null,
        cake_message: normalizedCakeMsg,
        greeting_card_text: greetingCardText,
        selected_addons: chosenAddons,
        selected_addons_detail: chosenAddonsDetail,
        price: calculatedPrice / quantity,
        quantity: quantity,
      };

      const res = await addToCart(variantId, targetShopId, metadata);

      // Reset cake message input after adding so subsequent cakes get their own message or reminder
      setCakeMessage("");

      if (res?.cart) {
        cartBus.emitCartUpdated(res.cart);
      }

      if (redirectToCheckout) {
        router.push("/checkout");
        return;
      }

      cartBus.emitOpenCart();
      setAddedCartSuccess(true);
      setTimeout(() => setAddedCartSuccess(false), 5000);
    } catch (e: any) {
      console.error("Failed to add to cart:", e.message || e);
      setAddedCartSuccess(false);
      const errMsg = e.message || "Unable to add product to cart. Please try again.";
      setCartError(errMsg);
      cartBus.emitCartError(errMsg);
    } finally {
      setCartLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleAddToCart = (redirectToCheckout = false) => {
    console.log("[PDP Client] handleAddToCart clicked! cakeMessage:", cakeMessage, "selectedWeight:", selectedWeight);
    if (isSubmittingRef.current || cartLoading) {
      console.log("[PDP Client] handleAddToCart skipped: isSubmittingRef or cartLoading is true");
      return;
    }

    // Enforce required PIM fields
    if (
      activePimConfig.show_weight !== false &&
      activePimConfig.required_weight !== false &&
      weightsList.length > 0 &&
      !selectedWeight
    ) {
      setValidationError("Please select a cake size before proceeding.");
      return;
    }
    if (activePimConfig.show_shape && activePimConfig.required_shape && shapesList.length > 0 && !selectedShape) {
      setValidationError("Please select a cake shape before proceeding.");
      return;
    }
    if (activePimConfig.show_flavour && activePimConfig.required_flavour && flavoursList.length > 0 && !selectedFlavour) {
      setValidationError("Please select a cake flavour before proceeding.");
      return;
    }
    if (activePimConfig.show_filling && activePimConfig.required_filling && fillingsList.length > 0 && !selectedFilling) {
      setValidationError("Please select an inner filling before proceeding.");
      return;
    }
    if (activePimConfig.show_photo_cake && activePimConfig.required_photo_cake && (!isPhotoCake || !photoUrl.trim())) {
      setValidationError("Please provide a photo URL for the edible photo print.");
      return;
    }
    if (activePimConfig.show_cake_message && activePimConfig.required_cake_message && !cakeMessage.trim()) {
      setValidationError("Please enter a customized message for the cake.");
      return;
    }

    setValidationError(null);

    // Optional cake message decision confirmation (for both Add to Bag and Buy Now)
    const isMessageEmpty = !cakeMessage.trim();
    const isCakeMessageOptional =
      activePimConfig.show_cake_message !== false && !activePimConfig.required_cake_message;

    if (isCakeMessageOptional && isMessageEmpty) {
      setPendingRedirectToCheckout(redirectToCheckout);
      setShowEmptyMessageConfirm(true);
      return;
    }

    executeAddToCart(redirectToCheckout);
  };

  const scrollToReviews = () => {
    if (reviewsRef.current) {
      reviewsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const isOutOfStock = useMemo(() => {
    if (inventoryMode === "STOCK_CONTROLLED") {
      return branchStock !== null && branchStock <= 0;
    }
    return (
      product?.is_out_of_stock_at_branch === true ||
      product?.branch_status === "OUT_OF_STOCK" ||
      product?.branch_status === "UNAVAILABLE" ||
      product?.branch_status === "DISABLED" ||
      branchKitchenUnavailable === true
    );
  }, [inventoryMode, branchStock, product, branchKitchenUnavailable]);

  const galleryLayout = pdpConfig?.gallery_layout || "left";

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-brand-surface-muted text-slate-900 min-h-screen">
      {/* 1. Dynamic Breadcrumbs */}
      <PdpBreadcrumb
        category={product.category}
        categorySlug={product.category_slug}
        productTitle={product.title}
      />

      {/* 2. Main Product Showcase Grid (Gallery + Information Split) */}
      <div
        className={`flex flex-col gap-8 lg:gap-12 ${
          galleryLayout === "right"
            ? "lg:flex-row-reverse"
            : galleryLayout === "stacked"
            ? "lg:flex-col"
            : "lg:flex-row"
        }`}
      >
        {/* Left/Main Column: Product Media Gallery */}
        <div className={galleryLayout === "stacked" ? "w-full" : "w-full lg:w-1/2 shrink-0"}>
          <div className="sticky top-24">
            <PdpGallery
              images={galleryImages}
              productTitle={product.title}
              thumbnailPosition={pdpConfig?.thumbnail_position || "bottom"}
              enableZoom={pdpConfig?.enable_zoom !== false}
              enableLightbox={pdpConfig?.enable_lightbox !== false}
              isWishlisted={isWishlisted}
              onWishlistToggle={handleWishlistToggle}
              wishlistLoading={wishlistLoading}
              isBestseller={meta?.is_bestseller}
              isFeatured={meta?.is_featured}
            />
          </div>
        </div>

        {/* Right Column: Information, Variants & Purchase Controls */}
        <div className="w-full lg:w-1/2 flex flex-col gap-6">
          {/* A. Info & Pricing Header */}
          <PdpInfoPanel
            title={product.title}
            category={product.category}
            categorySlug={product.category_slug}
            sku={product.variants?.[0]?.sku}
            rating={averageRating}
            reviewCount={reviewCount}
            price={calculatedPrice}
            comparePrice={pdpConfig?.show_compare_price !== false && meta?.mrp ? Number(meta.mrp) : undefined}
            shortDescription={product.description}
            isBestseller={meta?.is_bestseller}
            isFeatured={meta?.is_featured}
            occasions={productOccasions}
            showSku={pdpConfig?.show_sku !== false}
            showRating={pdpConfig?.show_rating !== false}
            showReviews={pdpConfig?.show_reviews !== false}
            showPrice={pdpConfig?.show_price !== false}
            showComparePrice={pdpConfig?.show_compare_price !== false}
            onReviewsClick={scrollToReviews}
          />

          {/* B. Delivery & Pincode Slot Checker */}
          <PdpDeliveryChecker
            productId={prodId}
            shopId={shopId}
            showDeliveryChecker={pdpConfig?.show_delivery_checker !== false}
          />

          {/* C. Dynamic Variant Selectors (Weight, Shape, Flavour, Fillings, Creams) */}
          <PdpVariantSelector
            weights={weightsList}
            selectedWeight={selectedWeight}
            onSelectWeight={(w) => {
              setSelectedWeight(w);
              setValidationError(null);
            }}
            showWeight={activePimConfig.show_weight !== false}
            requiredWeight={activePimConfig.required_weight !== false}
            shapes={shapesList}
            selectedShape={selectedShape}
            onSelectShape={setSelectedShape}
            showShape={activePimConfig.show_shape}
            requiredShape={activePimConfig.required_shape}
            flavours={flavoursList}
            selectedFlavour={selectedFlavour}
            onSelectFlavour={setSelectedFlavour}
            showFlavour={activePimConfig.show_flavour}
            requiredFlavour={activePimConfig.required_flavour}
            fillings={fillingsList}
            selectedFilling={selectedFilling}
            onSelectFilling={setSelectedFilling}
            showFilling={activePimConfig.show_filling}
            requiredFilling={activePimConfig.required_filling}
            creams={creamsList}
            selectedCream={selectedCream}
            onSelectCream={setSelectedCream}
            showCream={activePimConfig.show_cream}
            requiredCream={activePimConfig.required_cream}
          />

          {/* D. Customization & Add-ons Form */}
          {pdpConfig?.show_customization !== false && (
            <PdpCustomizationForm
              showDietary={activePimConfig.show_dietary !== false}
              hasSugarFree={hasSugarFree}
              isSugarFree={isSugarFree}
              onSugarFreeChange={setIsSugarFree}
              hasGlutenFree={hasGlutenFree}
              isGlutenFree={isGlutenFree}
              onGlutenFreeChange={setIsGlutenFree}
              hasVegan={hasVegan}
              isVegan={isVegan}
              onVeganChange={setIsVegan}
              showPhotoCake={activePimConfig.show_photo_cake}
              requiredPhotoCake={activePimConfig.required_photo_cake}
              isPhotoCake={isPhotoCake}
              onPhotoCakeChange={setIsPhotoCake}
              photoUrl={photoUrl}
              onPhotoUrlChange={setPhotoUrl}
              showCakeMessage={activePimConfig.show_cake_message !== false}
              requiredCakeMessage={activePimConfig.required_cake_message}
              cakeMessage={cakeMessage}
              onCakeMessageChange={setCakeMessage}
              messageInputRef={messageInputRef}
              accessories={addonsList}
              selectedAddonIds={selectedAddonIds}
              onToggleAddon={toggleAddon}
              greetingCardText={greetingCardText}
              onGreetingCardTextChange={setGreetingCardText}
            />
          )}

          {/* Validation Error Prompt */}
          {validationError && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-semibold animate-in fade-in">
              ⚠️ {validationError}
            </div>
          )}

          {/* E. Purchase & Order Actions */}
          <PdpPurchaseActions
            totalPrice={calculatedPrice}
            quantity={quantity}
            onQuantityChange={setQuantity}
            onAddToCart={() => handleAddToCart(false)}
            onBuyNow={() => handleAddToCart(true)}
            cartLoading={cartLoading}
            isOutOfStock={isOutOfStock}
            branchStock={branchStock}
            addToCartText={pdpConfig?.add_to_cart_text || "Add to Bag"}
            buyNowText={pdpConfig?.buy_now_text || "Buy Now"}
            addedCartSuccess={addedCartSuccess}
            cartError={cartError}
            onDismissError={() => setCartError(null)}
            productTitle={product.title}
          />
        </div>
      </div>

      {/* 5. Related Products Recommendations */}
      <PdpRelatedProducts
        products={relatedProducts}
        currentProductId={prodId}
        heading="You May Also Adore"
        limit={pdpConfig?.related_limit || 4}
      />

      {/* 6. Customer Reviews Section */}
      <div ref={reviewsRef} id="reviews-section" className="pt-8">
        <ProductReviewsSection
          productId={prodId}
          productTitle={product?.title || product?.name || "Signature Creation"}
          initialReviews={initialReviews as any}
          initialAverage={averageRating}
          initialCount={reviewCount}
          initialDistribution={ratingDistribution as any}
        />
      </div>

      {/* 7. Bakery FAQ Section */}
      <PdpFaqSection
        showFaq={pdpConfig?.show_faq !== false}
        customFaqs={Array.isArray(meta?.faqs) && meta.faqs.length > 0 ? meta.faqs : (Array.isArray(pdpConfig?.faqs) ? pdpConfig.faqs : [])}
        eyebrow={pdpConfig?.faq_eyebrow}
        title={pdpConfig?.faq_title}
      />

      {/* 8. Floating Sticky Purchase Bar */}
      <PdpStickyBar
        title={product.title}
        thumbnail={product.thumbnail || galleryImages[0]}
        selectedWeightName={selectedWeight?.name}
        totalPrice={calculatedPrice}
        onAddToCart={() => handleAddToCart(false)}
        cartLoading={cartLoading}
        isOutOfStock={isOutOfStock}
        enabledMobile={pdpConfig?.sticky_add_to_cart_mobile !== false}
        enabledDesktop={pdpConfig?.sticky_add_to_cart_desktop === true}
        addToCartText={pdpConfig?.add_to_cart_text ? `${pdpConfig.add_to_cart_text}` : "Add"}
      />

      {/* 9. Optional Cake Inscription Confirmation Dialog */}
      <PdpEmptyMessageModal
        isOpen={showEmptyMessageConfirm}
        onClose={() => setShowEmptyMessageConfirm(false)}
        onConfirm={(customMsg) => {
          setShowEmptyMessageConfirm(false);
          executeAddToCart(pendingRedirectToCheckout, customMsg);
        }}
        onAddMessageClick={() => {
          setShowEmptyMessageConfirm(false);
          if (messageInputRef.current) {
            messageInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => {
              messageInputRef.current?.focus({ preventScroll: true });
            }, 250);
          }
        }}
        cartLoading={cartLoading}
        cakeMessage={cakeMessage}
        onCakeMessageChange={setCakeMessage}
      />
    </div>
  );
}
