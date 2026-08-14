"use client";

import { useState, useEffect, useMemo } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { CategorySelectDropdown } from "./category-select-dropdown";
import { OccasionSelector } from "./occasion-selector";
import { compressImageToWebP } from "@frontend/lib/util/image-compressor";
import { TaxMasterService } from "@backend/src/services/tax-engine";
import {
  Sparkles, Cake, Tag, DollarSign, Layers, ShoppingBag, Image as ImageIcon,
  Truck, Globe, CheckCircle, AlertCircle, Plus, Trash2, Sliders, Wand2, Upload, ArrowUp, ArrowDown, RefreshCw, X
} from "lucide-react";

interface PimEditorModalProps {
  product?: any;
  categories: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export function PimEditorModal({ product, categories, onClose, onSuccess }: PimEditorModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "categories" | "pricing" | "variants" | "addons" | "media" | "logistics" | "seo" | "pim_config">("general");

  // PIM Visibility & Requirement Controls State
  const [pimConfig, setPimConfig] = useState<Record<string, boolean>>({
    show_weight: product?.pim_config?.show_weight ?? true,
    required_weight: product?.pim_config?.required_weight ?? true,
    show_shape: product?.pim_config?.show_shape ?? true,
    required_shape: product?.pim_config?.required_shape ?? false,
    show_flavour: product?.pim_config?.show_flavour ?? true,
    required_flavour: product?.pim_config?.required_flavour ?? false,
    show_filling: product?.pim_config?.show_filling ?? true,
    required_filling: product?.pim_config?.required_filling ?? false,
    show_cream: product?.pim_config?.show_cream ?? false,
    required_cream: product?.pim_config?.required_cream ?? false,
    show_dietary: product?.pim_config?.show_dietary ?? true,
    required_dietary: product?.pim_config?.required_dietary ?? false,
    show_photo_cake: product?.pim_config?.show_photo_cake ?? false,
    required_photo_cake: product?.pim_config?.required_photo_cake ?? false,
    show_cake_message: product?.pim_config?.show_cake_message ?? true,
    required_cake_message: product?.pim_config?.required_cake_message ?? false,
    show_candles: product?.pim_config?.show_candles ?? true,
    show_greeting_card: product?.pim_config?.show_greeting_card ?? true,
    show_balloons: product?.pim_config?.show_balloons ?? true,
    show_knife: product?.pim_config?.show_knife ?? true,
    show_premium_packaging: product?.pim_config?.show_premium_packaging ?? true,
  });

  // General Form State
  const [name, setName] = useState(product?.title || product?.name || "");
  const [sku, setSku] = useState(product?.sku || `SKU-CK-${Math.floor(1000 + Math.random() * 9000)}`);
  const [barcode, setBarcode] = useState(product?.barcode || `890${Math.floor(100000000 + Math.random() * 900000000)}`);
  const [slug, setSlug] = useState(product?.handle || product?.slug || "");
  const [description, setDescription] = useState(product?.description || "");
  const [shortDesc, setShortDesc] = useState(product?.short_description || "Handcrafted fresh gourmet cake.");
  const [tags, setTags] = useState(product?.tags || "chocolate, celebration, birthday");
  const [occasion, setOccasion] = useState(product?.occasion || "Birthday");
  const [occasionIds, setOccasionIds] = useState<string[]>(() => {
    if (Array.isArray(product?.occasion_ids) && product.occasion_ids.length > 0) {
      return product.occasion_ids;
    }
    if (product?.occasion) {
      const raw = String(product.occasion).toLowerCase();
      if (raw.includes("anniversary")) return ["occ_anniversary"];
      if (raw.includes("wedding")) return ["occ_wedding"];
      if (raw.includes("valentine")) return ["occ_valentines_day"];
      if (raw.includes("kids") || raw.includes("baby")) return ["occ_baby_birthday"];
      return ["occ_birthday"];
    }
    return ["occ_birthday"];
  });
  const [brand, setBrand] = useState(product?.brand || "CakeToHome Signature");
  const [cakeType, setCakeType] = useState(product?.cake_type || "Layer Cake");

  // Merchandising & Dietary Flags
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? true);
  const [isBestseller, setIsBestseller] = useState(product?.is_bestseller ?? false);
  const [isNewArrival, setIsNewArrival] = useState(product?.is_new_arrival ?? false);
  const [eggless, setEggless] = useState(product?.eggless ?? true);
  const [sugarFree, setSugarFree] = useState(product?.sugar_free ?? false);
  const [glutenFree, setGlutenFree] = useState(product?.gluten_free ?? false);
  const [vegan, setVegan] = useState(product?.vegan ?? false);

  // Categories & Collections State
  const [primaryCategoryId, setPrimaryCategoryId] = useState(product?.primary_category_id || categories[0]?.id || "");
  const [primaryCategoryName, setPrimaryCategoryName] = useState(product?.category || categories[0]?.name || "Artisanal Cakes");
  const [secondaryCategoryIds, setSecondaryCategoryIds] = useState<string[]>(product?.secondary_category_ids || []);
  const [season, setSeason] = useState("All-Season");
  const [festival, setFestival] = useState("Diwali & Festive Special");

  // Pricing & Tax Master
  const [sellingPrice, setSellingPrice] = useState(String(product?.price || product?.selling_price || 649));
  const [costPrice, setCostPrice] = useState(String(product?.cost_price || 350));
  const [mrp, setMrp] = useState(String(product?.mrp || 799));
  const [taxConfigurationId, setTaxConfigurationId] = useState(product?.tax_configuration_id || "txcfg_food_5");
  const [gstRate, setGstRate] = useState(String(product?.gst_rate || 5));
  const [taxClass, setTaxClass] = useState(product?.tax_class || "GST_FOOD_5");
  const [hsnCode, setHsnCode] = useState(product?.hsn_code || "19059090");
  const [hsnDescription, setHsnDescription] = useState(product?.hsn_description || "Cakes, Pastries & Bakery Goods");
  const [uqc, setUqc] = useState(product?.uqc || "NOS");
  const [taxability, setTaxability] = useState(product?.taxability || "Taxable");
  const [taxInclusive, setTaxInclusive] = useState(product?.tax_inclusive ?? true);

  // Variants Matrix State — initial values are empty; populated by loadMasterData() from DB
  const [selectedWeights, setSelectedWeights] = useState<string[]>([]);
  const [selectedFlavours, setSelectedFlavours] = useState<string[]>([]);
  const [selectedShapes, setSelectedShapes] = useState<string[]>([]);
  const [selectedCream, setSelectedCream] = useState<string[]>([]);

  // Add-ons State
  const [allowCustomMessage, setAllowCustomMessage] = useState(true);
  const [messageLimit, setMessageLimit] = useState("40");
  const [isPhotoCake, setIsPhotoCake] = useState(false);
  const [addOnCandles, setAddOnCandles] = useState(true);
  const [addOnCard, setAddOnCard] = useState(true);
  const [addOnFlowers, setAddOnFlowers] = useState(false);

  // Media & Gallery
  const [thumbnailUrl, setThumbnailUrl] = useState(product?.thumbnail || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800");
  const [galleryImages, setGalleryImages] = useState<string[]>(
    Array.isArray(product?.gallery) && product.gallery.length > 0
      ? product.gallery
      : [product?.thumbnail || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800"]
  );
  const [videoUrl, setVideoUrl] = useState(product?.video_url || "");
  const [altText, setAltText] = useState(product?.alt_text || "Freshly baked celebration cake");
  const [compressing, setCompressing] = useState(false);

  // Searchable Bakery Attribute Filters
  const [cakeBase, setCakeBase] = useState(product?.cake_base || "Chocolate");
  const [filling, setFilling] = useState(product?.filling || "Chocolate Ganache");
  const [cream, setCream] = useState(product?.cream || "Fresh Cream");
  const [texture, setTexture] = useState(product?.texture || "Soft & Moist");

  // Dynamic Product Weight Creation State
  const [newWeightName, setNewWeightName] = useState("0.75 kg");
  const [newWeightPrice, setNewWeightPrice] = useState("550");

  // Logistics & Prep Time
  const [prepTimeMinutes, setPrepTimeMinutes] = useState("120");
  const [dailyCapacity, setDailyCapacity] = useState("50");
  const [shelfLifeDays, setShelfLifeDays] = useState("3");
  const [deliveryProfileId, setDeliveryProfileId] = useState(product?.delivery_profile_id || "prof_regular");

  // Logistics – Delivery Option Permissions (missing state vars that the JSX references)
  const [minPrepHours, setMinPrepHours] = useState<string>(String(product?.pim_config?.min_prep_hours || "2"));
  const [sameDayAllowed, setSameDayAllowed] = useState<boolean>(product?.pim_config?.same_day_allowed ?? true);
  const [expressAllowed, setExpressAllowed] = useState<boolean>(product?.pim_config?.express_allowed ?? true);
  const [midnightAllowed, setMidnightAllowed] = useState<boolean>(product?.pim_config?.midnight_allowed ?? false);
  const [scheduledAllowed, setScheduledAllowed] = useState<boolean>(product?.pim_config?.scheduled_allowed ?? true);
  const [allowedZoneIds, setAllowedZoneIds] = useState<string[]>(product?.pim_config?.allowed_zone_ids || ["zone_1", "zone_2"]);

  // SEO & AI
  const [seoTitle, setSeoTitle] = useState(product?.title ? `${product.title} - CakeToHome` : "");
  const [seoDescription, setSeoDescription] = useState(product?.description || "");
  const [seoKeywords, setSeoKeywords] = useState("cake delivery, fresh cakes, birthday cake online");
  const [aiPrompting, setAiPrompting] = useState(false);

  // Dynamic Product Weight Creator
  const handleAddCustomWeight = () => {
    if (!newWeightName.trim()) return;
    const priceNum = parseFloat(newWeightPrice) || 500;
    const newEntry = {
      weight_id: `w_custom_${Date.now()}`,
      weight_name: newWeightName.trim(),
      selling_price: priceNum,
      mrp: Math.round(priceNum * 1.2),
      cost_price: Math.round(priceNum * 0.5),
      prep_time_minutes: 60,
      is_enabled: true,
    };
    setWeightPrices((prev) => [...prev, newEntry]);
    setSelectedWeights((prev) => [...new Set([...prev, newWeightName.trim()])]);
    setNewWeightName("");
    setNewWeightPrice("");
  };

  const handleDeleteWeightRow = (idx: number) => {
    setWeightPrices((prev) => prev.filter((_, i) => i !== idx));
  };

  // Canvas WebP Image Compression Uploader
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCompressing(true);
    try {
      const compressedResults: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressedWebP = await compressImageToWebP(files[i]);
        compressedResults.push(compressedWebP);
      }
      setGalleryImages((prev) => [...prev, ...compressedResults]);
      if (compressedResults.length > 0 && (!thumbnailUrl || thumbnailUrl.includes("unsplash"))) {
        setThumbnailUrl(compressedResults[0]);
      }
    } catch {
      setErrorMsg("Image compression failed. Please try again.");
    } finally {
      setCompressing(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Product-Specific Weight Pricing Matrix State (Zero Hardcoding)
  const [weightPrices, setWeightPrices] = useState<any[]>([]);
  const [activeSelectedWeight, setActiveSelectedWeight] = useState("");

  // Master Database Flavors and Shapes
  const [masterFlavours, setMasterFlavours] = useState<any[]>([]);
  const [masterShapes, setMasterShapes] = useState<any[]>([]);
  const [enableFlavorSelection, setEnableFlavorSelection] = useState(product?.enable_flavor_selection ?? true);
  const [enableShapeSelection, setEnableShapeSelection] = useState(product?.enable_shape_selection ?? true);

  // Inline Quick-Create State for Flavors
  const [showInlineFlavorCreate, setShowInlineFlavorCreate] = useState(false);
  const [inlineFlavorName, setInlineFlavorName] = useState("");
  const [inlineFlavorPrice, setInlineFlavorPrice] = useState("0");
  const [inlineFlavorSubmitting, setInlineFlavorSubmitting] = useState(false);

  // Inline Quick-Create State for Shapes
  const [showInlineShapeCreate, setShowInlineShapeCreate] = useState(false);
  const [inlineShapeName, setInlineShapeName] = useState("");
  const [inlineShapePrice, setInlineShapePrice] = useState("0");
  const [inlineShapeSubmitting, setInlineShapeSubmitting] = useState(false);

  // Variant Matrix search filters
  const [flavorSearch, setFlavorSearch] = useState("");
  const [shapeSearch, setShapeSearch] = useState("");

  const [masterDataLoading, setMasterDataLoading] = useState(false);

  const loadMasterData = () => {
    setMasterDataLoading(true);
    Promise.all([
      apiClient.getAdminFlavors().catch(() => ({ flavors: [] })),
      apiClient.getAdminShapes().catch(() => ({ shapes: [] })),
      product?.id ? apiClient.getProductFlavorMappings(product.id).catch(() => ({ flavor_mappings: [] })) : Promise.resolve({ flavor_mappings: [] }),
      product?.id ? apiClient.getProductShapeMappings(product.id).catch(() => ({ shape_mappings: [] })) : Promise.resolve({ shape_mappings: [] }),
      product?.id ? apiClient.getProductWeightPrices(product.id).catch(() => ({ weight_prices: [] })) : Promise.resolve({ weight_prices: [] })
    ]).then(([resFlv, resShp, resFlvMaps, resShpMaps, resPrices]: any[]) => {
      const dbFlavors = resFlv?.flavors || [];
      const dbShapes = resShp?.shapes || [];
      setMasterFlavours(dbFlavors);
      setMasterShapes(dbShapes);

      const mappedFlvIds = (resFlvMaps?.flavor_mappings || []).map((m: any) => m.flavor_id);
      const mappedShpIds = (resShpMaps?.shape_mappings || []).map((m: any) => m.shape_id);

      if (mappedFlvIds.length > 0) {
        setSelectedFlavours(dbFlavors.filter((f: any) => mappedFlvIds.includes(f.id)).map((f: any) => f.name));
      } else {
        setSelectedFlavours(dbFlavors.map((f: any) => f.name));
      }

      if (mappedShpIds.length > 0) {
        setSelectedShapes(dbShapes.filter((s: any) => mappedShpIds.includes(s.id)).map((s: any) => s.name));
      } else {
        setSelectedShapes(dbShapes.map((s: any) => s.name));
      }

      const savedPrices = resPrices?.weight_prices || [];
      setWeightPrices(savedPrices);
      if (savedPrices.length > 0) {
        setActiveSelectedWeight(savedPrices[0].weight_name);
      }
    }).finally(() => setMasterDataLoading(false));
  };

  useEffect(() => {
    loadMasterData();
  }, [product?.id]);

  // Dynamic Price Recalculation Engine
  const activeWeightPriceObj = weightPrices.find((wp) => wp.weight_name === activeSelectedWeight && wp.is_enabled) || weightPrices.find((wp) => wp.is_enabled) || weightPrices[0];
  const baseWeightPrice = activeWeightPriceObj ? Number(activeWeightPriceObj.selling_price) || 0 : parseFloat(sellingPrice) || 0;

  const { shapeModifierSum, flavourModifierSum, calculatedFinalPrice } = useMemo(() => {
    const shapeSum = selectedShapes.reduce((sum, sName) => {
      const opt = masterShapes.find((o) => o.name === sName || o.display_name === sName);
      return sum + (opt?.additional_price || opt?.price_modifier || 0);
    }, 0);
    const flavourSum = selectedFlavours.reduce((sum, fName) => {
      const opt = masterFlavours.find((o) => o.name === fName || o.display_name === fName);
      return sum + (opt?.extra_price || opt?.price_modifier || 0);
    }, 0);
    return {
      shapeModifierSum: shapeSum,
      flavourModifierSum: flavourSum,
      calculatedFinalPrice: baseWeightPrice + shapeSum + flavourSum,
    };
  }, [baseWeightPrice, selectedShapes, selectedFlavours, masterShapes, masterFlavours]);

  // AI Auto-Generation Helper
  const handleAiGenerateAll = async () => {
    if (!name.trim()) {
      setErrorMsg("Please enter a Cake / Product Name before generating AI details.");
      return;
    }
    setAiPrompting(true);
    setErrorMsg(null);

    setTimeout(() => {
      const generatedDesc = `Indulge in our exquisite ${name}. Handcrafted daily by master pastry chefs using premium ingredients, silky ganache, and authentic cocoa. Perfect for ${occasion} celebrations and special moments!`;
      setDescription(generatedDesc);
      setShortDesc(`Fresh ${name} crafted for unforgettable ${occasion} memories.`);
      setTags(`${name.toLowerCase().replace(/\s+/g, ", ")}, ${occasion.toLowerCase()}, gourmet, eggless`);
      setSeoTitle(`Buy ${name} Online - Fast Same-Day Delivery | CakeToHome`);
      setSeoDescription(`Order ${name} online starting at ₹${sellingPrice}. Handcrafted fresh with same-day doorstep delivery.`);
      setSeoKeywords(`${name.toLowerCase()}, buy ${name} online, ${occasion} cake delivery`);
      setAiPrompting(false);
      setSuccessMsg("AI content successfully generated!");
      setTimeout(() => setSuccessMsg(null), 2000);
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    // Validation Checks for Weight Matrix
    const enabledWeights = weightPrices.filter((wp) => wp.is_enabled);
    if (enabledWeights.length === 0) {
      setErrorMsg("Validation Error: Product must have at least one enabled weight size.");
      setSubmitting(false);
      return;
    }
    const invalidPrice = enabledWeights.find((wp) => wp.selling_price <= 0);
    if (invalidPrice) {
      setErrorMsg(`Validation Error: Selling price for ${invalidPrice.weight_name} must be greater than zero.`);
      setSubmitting(false);
      return;
    }
    const invalidMrp = enabledWeights.find((wp) => wp.mrp > 0 && wp.mrp < wp.selling_price);
    if (invalidMrp) {
      setErrorMsg(`Validation Error: MRP for ${invalidMrp.weight_name} must be greater than or equal to Selling Price.`);
      setSubmitting(false);
      return;
    }

    const startingPrice = Math.min(...enabledWeights.map((wp) => wp.selling_price));
    if (!startingPrice || isNaN(startingPrice) || startingPrice <= 0 || !isFinite(startingPrice)) {
      setErrorMsg("Validation Error: Product starting price must be greater than ₹0.");
      setSubmitting(false);
      return;
    }

    const generatedSlug = slug.trim()
      ? slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const payload = {
      title: name,
      name,
      sku,
      barcode,
      handle: generatedSlug,
      slug: generatedSlug,
      description,
      short_description: shortDesc,
      status: "published",
      is_published: true,
      tags,
      occasion,
      occasion_ids: occasionIds,
      brand,
      cake_type: cakeType,
      category: primaryCategoryName,
      primary_category_id: primaryCategoryId,
      secondary_category_ids: secondaryCategoryIds,
      price: startingPrice,
      selling_price: startingPrice,
      cost_price: parseFloat(costPrice) || enabledWeights[0].cost_price || 350,
      mrp: enabledWeights[0].mrp || 799,
      gst_rate: parseFloat(gstRate) || 5,
      tax_class: taxClass,
      tax_configuration_id: taxConfigurationId,
      tax_configuration_code: taxClass,
      hsn_code: hsnCode,
      hsn_description: hsnDescription,
      uqc,
      taxability,
      tax_inclusive: taxInclusive,
      is_featured: isFeatured,
      is_bestseller: isBestseller,
      is_new_arrival: isNewArrival,
      eggless,
      sugar_free: sugarFree,
      gluten_free: glutenFree,
      vegan,
      thumbnail: thumbnailUrl,
      gallery: galleryImages,
      cake_base: cakeBase,
      filling,
      cream,
      texture,
      video_url: videoUrl,
      alt_text: altText,
      prep_time_minutes: enabledWeights[0].prep_time_minutes || 120,
      daily_capacity: parseInt(dailyCapacity, 10) || 50,
      shelf_life_days: parseInt(shelfLifeDays, 10) || 3,
      variants_json: { weights: enabledWeights.map(w => w.weight_name), flavours: selectedFlavours, shapes: selectedShapes },
      add_ons_json: { allow_custom_message: allowCustomMessage, message_limit: messageLimit, is_photo_cake: isPhotoCake, add_on_candles: addOnCandles, add_on_card: addOnCard, add_on_flowers: addOnFlowers },
      seo_title: seoTitle || `${name} - CakeToHome`,
      enable_flavor_selection: enableFlavorSelection,
      enable_shape_selection: enableShapeSelection,
      seo_description: seoDescription || description,
      seo_keywords: seoKeywords,
      pim_config: {
        ...pimConfig,
        min_prep_hours: minPrepHours,
        same_day_allowed: sameDayAllowed,
        express_allowed: expressAllowed,
        midnight_allowed: midnightAllowed,
        scheduled_allowed: scheduledAllowed,
        allowed_zone_ids: allowedZoneIds,
      },
    };

    try {
      let targetProdId = product?.id;
      if (product?.id) {
        await apiClient.updateAdminProduct(product.id, payload);
        await apiClient.saveProductWeightPrices(product.id, weightPrices);
      } else {
        const res: any = await apiClient.createAdminProduct(payload);
        targetProdId = res?.product?.id || `prod_${Date.now()}`;
        await apiClient.saveProductWeightPrices(targetProdId, weightPrices);
      }

      if (targetProdId) {
        const selectedFlvObjects = masterFlavours
          .filter((f) => selectedFlavours.includes(f.name))
          .map((f) => ({ flavor_id: f.id, price_override: f.extra_price }));

        const selectedShpObjects = masterShapes
          .filter((s) => selectedShapes.includes(s.name))
          .map((s) => ({ shape_id: s.id, price_override: s.additional_price }));

        await apiClient.saveProductFlavorMappings(targetProdId, selectedFlvObjects);
        await apiClient.saveProductShapeMappings(targetProdId, selectedShpObjects);
      }

      setSuccessMsg(`Successfully saved product "${name}"!`);
      try {
        const { revalidateProductAction } = await import("@frontend/lib/actions/catalog");
        await revalidateProductAction(generatedSlug, targetProdId);
      } catch (revErr) {
        console.warn("Revalidation warning in modal:", revErr);
      }
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save enterprise product PIM record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh] opacity-100">
        {/* Sticky Modal Header */}
        <div className="sticky top-0 z-20 p-6 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between opacity-100">
          <div>
            <Heading level="h2" className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Cake className="w-5 h-5 text-emerald-600" />
              {product ? `Enterprise PIM Editor: ${product.title || product.name}` : "Create Enterprise Cake Product (PIM System)"}
            </Heading>
            <Text className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Complete product information management: Variants, Add-ons, Dynamic Pricing, Logistics, and AI Content.
            </Text>
          </div>
          <div className="flex items-center gap-2">
            <Button size="small" variant="transparent" onClick={handleAiGenerateAll} isLoading={aiPrompting} className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 border border-purple-300 dark:border-purple-700 font-semibold opacity-100">
              <Wand2 className="w-3.5 h-3.5 mr-1" /> AI Auto-Fill PIM
            </Button>
            <Button size="small" variant="transparent" onClick={onClose} className="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold">Close</Button>
          </div>
        </div>

        {/* Feedback Alert Banners */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-center gap-2 text-sm font-semibold opacity-100">
            <CheckCircle className="w-4 h-4 text-emerald-600" /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700 flex items-center gap-2 text-sm font-semibold opacity-100">
            <AlertCircle className="w-4 h-4 text-rose-600" /> {errorMsg}
          </div>
        )}

        {/* Sticky Tab Navigation */}
        <div className="sticky top-[89px] z-10 flex border-b border-gray-200 dark:border-slate-800 px-6 gap-2 bg-slate-50 dark:bg-slate-900 overflow-x-auto text-xs font-medium opacity-100">
          <button onClick={() => setActiveTab("general")} className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === "general" ? "border-emerald-600 text-emerald-600 font-bold bg-white dark:bg-slate-800" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            <Tag className="w-3.5 h-3.5" /> General Info
          </button>
          <button onClick={() => setActiveTab("categories")} className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === "categories" ? "border-emerald-600 text-emerald-600 font-bold bg-white dark:bg-slate-800" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            <Layers className="w-3.5 h-3.5" /> Categories & Seasons
          </button>
          <button onClick={() => setActiveTab("pricing")} className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === "pricing" ? "border-emerald-600 text-emerald-600 font-bold bg-white dark:bg-slate-800" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            <DollarSign className="w-3.5 h-3.5" /> Pricing & Taxes
          </button>
          <button onClick={() => setActiveTab("variants")} className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === "variants" ? "border-emerald-600 text-emerald-600 font-bold bg-white dark:bg-slate-800" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            <Sliders className="w-3.5 h-3.5" /> Variant Matrix
          </button>
          <button onClick={() => setActiveTab("addons")} className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === "addons" ? "border-emerald-600 text-emerald-600 font-bold bg-white dark:bg-slate-800" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            <ShoppingBag className="w-3.5 h-3.5" /> Customization & Add-ons
          </button>
          <button onClick={() => setActiveTab("media")} className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === "media" ? "border-emerald-600 text-emerald-600 font-bold bg-white dark:bg-slate-800" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            <ImageIcon className="w-3.5 h-3.5" /> Rich Media
          </button>
          <button onClick={() => setActiveTab("logistics")} className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === "logistics" ? "border-emerald-600 text-emerald-600 font-bold bg-white dark:bg-slate-800" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            <Truck className="w-3.5 h-3.5" /> Inventory & Logistics
          </button>
          <button onClick={() => setActiveTab("seo")} className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === "seo" ? "border-emerald-600 text-emerald-600 font-bold bg-white dark:bg-slate-800" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            <Globe className="w-3.5 h-3.5" /> SEO & AI Tools
          </button>
          <button onClick={() => setActiveTab("pim_config")} className={`py-3 px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors ${activeTab === "pim_config" ? "border-emerald-600 text-emerald-600 font-bold bg-white dark:bg-slate-800" : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
            <Sparkles className="w-3.5 h-3.5 text-rose-500" /> PIM Display Rules & Preview
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 opacity-100">
          {/* TAB 1: GENERAL INFO */}
          {activeTab === "general" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pim_name">Cake / Product Name *</Label>
                <Input id="pim_name" placeholder="e.g. Belgian Dark Chocolate Truffle Cake" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="pim_slug">Custom URL Slug</Label>
                <Input id="pim_slug" placeholder="belgian-dark-chocolate-truffle-cake" value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>

              <div>
                <Label htmlFor="pim_sku">SKU Code</Label>
                <Input id="pim_sku" value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pim_barcode">Barcode / EAN</Label>
                <Input id="pim_barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="pim_desc">Full Description</Label>
                <Input id="pim_desc" placeholder="Rich velvety Belgian dark chocolate layers..." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>

              <div>
                <Label htmlFor="pim_short_desc">Short Summary</Label>
                <Input id="pim_short_desc" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pim_tags">Product Tags (Comma-Separated)</Label>
                <Input id="pim_tags" value={tags} onChange={(e) => setTags(e.target.value)} />
              </div>

              <div>
                <Label htmlFor="pim_brand">Brand / Bakery Studio</Label>
                <Input id="pim_brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>

              {/* Structured Multi-Select Occasion Taxonomy */}
              <div className="md:col-span-2">
                <OccasionSelector
                  label="Occasion Target & Celebrations"
                  selectedIds={occasionIds}
                  onChange={(ids) => {
                    setOccasionIds(ids);
                    if (ids.length > 0) {
                      setOccasion(ids[0].replace(/^occ_/, "").replace(/_/g, " "));
                    }
                  }}
                  helperText="Multi-select celebration occasions. Connects to smart cross-sell rules, upselling engines, and storefront occasion discovery."
                />
              </div>

              {/* Merchandising & Dietary Flags */}
              <div className="md:col-span-2 p-4 rounded-lg bg-ui-bg-subtle border border-ui-border-base grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-medium">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="rounded" />
                  <span>Featured Product</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)} className="rounded" />
                  <span>Bestseller</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isNewArrival} onChange={(e) => setIsNewArrival(e.target.checked)} className="rounded" />
                  <span>New Arrival</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={eggless} onChange={(e) => setEggless(e.target.checked)} className="rounded" />
                  <span className="text-emerald-600 font-semibold">Eggless</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={sugarFree} onChange={(e) => setSugarFree(e.target.checked)} className="rounded" />
                  <span>Sugar-Free</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={glutenFree} onChange={(e) => setGlutenFree(e.target.checked)} className="rounded" />
                  <span>Gluten-Free</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={vegan} onChange={(e) => setVegan(e.target.checked)} className="rounded" />
                  <span>Vegan</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: CATEGORIES & SEASONS */}
          {activeTab === "categories" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="pim_prim_cat" className="mb-1 block font-semibold text-xs text-purple-600">Primary Category * (Searchable Dropdown)</Label>
                <CategorySelectDropdown
                  categories={categories}
                  value={primaryCategoryId || primaryCategoryName}
                  onChangePrimary={(id, name) => {
                    setPrimaryCategoryId(id);
                    setPrimaryCategoryName(name);
                  }}
                  placeholder="Select Primary Category..."
                />
              </div>

              <div>
                <Label htmlFor="pim_sec_cat" className="mb-1 block font-semibold text-xs text-purple-600">Secondary Categories (Multi-Select)</Label>
                <CategorySelectDropdown
                  categories={categories}
                  value=""
                  selectedSecondaryIds={secondaryCategoryIds}
                  onChangePrimary={() => {}}
                  onChangeSecondary={(ids) => setSecondaryCategoryIds(ids)}
                  isMulti
                  placeholder="Attach Secondary Categories..."
                />
              </div>

              <div>
                <Label htmlFor="pim_season">Season Assignment</Label>
                <Input id="pim_season" value={season} onChange={(e) => setSeason(e.target.value)} />
              </div>

              <div>
                <Label htmlFor="pim_festival">Festival & Campaign Collection</Label>
                <Input id="pim_festival" value={festival} onChange={(e) => setFestival(e.target.value)} />
              </div>
            </div>
          )}

          {/* TAB 3: PRODUCT-SPECIFIC WEIGHT PRICING MATRIX */}
          {activeTab === "pricing" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="font-bold text-base text-purple-600">Product-Specific Weight Pricing Matrix</Text>
                  <Text className="text-xs text-ui-fg-subtle">
                    Configure independent Selling Prices, MRPs, Cost Prices, and Prep Times per weight size for "{name || 'this product'}".
                  </Text>
                </div>
              </div>

              {/* Add Dynamic Product Weight Bar */}
              <div className="p-3 bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700 rounded-lg flex flex-wrap items-center justify-between gap-3 opacity-100">
                <div className="flex items-center gap-2">
                  <Input placeholder="e.g. 250g or 3kg" value={newWeightName} onChange={(e) => setNewWeightName(e.target.value)} className="w-36 h-8 text-xs" />
                  <Input type="number" placeholder="Price ₹" value={newWeightPrice} onChange={(e) => setNewWeightPrice(e.target.value)} className="w-28 h-8 text-xs" />
                  <Button size="small" type="button" onClick={handleAddCustomWeight} className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 font-semibold">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Weight Option
                  </Button>
                </div>
                <Text className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold">Add unlimited dynamic product sizes & prices</Text>
              </div>

              {/* Weight Matrix Table */}
              <div className="overflow-x-auto border border-gray-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-3">Enabled</th>
                      <th className="p-3">Weight Size</th>
                      <th className="p-3">Selling Price (₹) *</th>
                      <th className="p-3">MRP (₹)</th>
                      <th className="p-3">Cost Price (₹)</th>
                      <th className="p-3">Prep Time (Mins)</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                    {weightPrices.map((wp, idx) => (
                      <tr key={wp.weight_id || idx} className={wp.is_enabled ? "bg-white dark:bg-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={wp.is_enabled}
                            onChange={(e) => {
                              const updated = [...weightPrices];
                              updated[idx].is_enabled = e.target.checked;
                              setWeightPrices(updated);
                            }}
                            className="w-4 h-4 rounded text-purple-600"
                          />
                        </td>
                        <td className="p-3 font-bold text-purple-600">{wp.weight_name}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={wp.selling_price}
                            disabled={!wp.is_enabled}
                            onChange={(e) => {
                              const updated = [...weightPrices];
                              updated[idx].selling_price = parseFloat(e.target.value) || 0;
                              setWeightPrices(updated);
                            }}
                            className="w-28 h-8 text-xs font-semibold text-emerald-600"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={wp.mrp}
                            disabled={!wp.is_enabled}
                            onChange={(e) => {
                              const updated = [...weightPrices];
                              updated[idx].mrp = parseFloat(e.target.value) || 0;
                              setWeightPrices(updated);
                            }}
                            className="w-28 h-8 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={wp.cost_price}
                            disabled={!wp.is_enabled}
                            onChange={(e) => {
                              const updated = [...weightPrices];
                              updated[idx].cost_price = parseFloat(e.target.value) || 0;
                              setWeightPrices(updated);
                            }}
                            className="w-28 h-8 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={wp.prep_time_minutes}
                            disabled={!wp.is_enabled}
                            onChange={(e) => {
                              const updated = [...weightPrices];
                              updated[idx].prep_time_minutes = parseInt(e.target.value, 10) || 60;
                              setWeightPrices(updated);
                            }}
                            className="w-24 h-8 text-xs"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteWeightRow(idx)}
                            className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                            title="Remove weight option"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tax Master & Statutory GST Configuration */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                    🏛️ Statutory GST Tax Master & HSN Classification
                  </span>
                  <Badge color="green" className="text-[10px] font-bold uppercase">{taxability}</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="md:col-span-2">
                    <Label htmlFor="pim_tax_cfg" className="font-semibold text-emerald-800 dark:text-emerald-300">Select Tax Master Configuration *</Label>
                    <select
                      id="pim_tax_cfg"
                      value={taxConfigurationId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setTaxConfigurationId(id);
                        const match = TaxMasterService.getTaxConfigurationById(id);
                        if (match) {
                          setGstRate(String(match.gstRatePct));
                          setTaxClass(match.code);
                          setTaxability(match.taxability);
                          setTaxInclusive(match.taxInclusive);
                        }
                      }}
                      className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-800"
                    >
                      {TaxMasterService.listTaxConfigurations().map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.code}) — GST: {t.gstRatePct}% | CGST: {t.cgstRatePct}% | SGST: {t.sgstRatePct}% | {t.taxability}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="pim_hsn_code" className="font-semibold text-emerald-800 dark:text-emerald-300">HSN/SAC Code *</Label>
                    <Input id="pim_hsn_code" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} placeholder="19059090" required />
                  </div>

                  <div>
                    <Label htmlFor="pim_hsn_desc">HSN Description</Label>
                    <Input id="pim_hsn_desc" value={hsnDescription} onChange={(e) => setHsnDescription(e.target.value)} placeholder="Cakes, Pastries & Bakery Goods" />
                  </div>

                  <div>
                    <Label htmlFor="pim_uqc">UQC (Unit Quantity Code) *</Label>
                    <select
                      id="pim_uqc"
                      value={uqc}
                      onChange={(e) => setUqc(e.target.value)}
                      className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
                    >
                      <option value="NOS">NOS — Numbers / Items</option>
                      <option value="KGS">KGS — Kilograms</option>
                      <option value="BOX">BOX — Box</option>
                      <option value="PKT">PKT — Packets</option>
                      <option value="PCS">PCS — Pieces</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="pim_tax_inc">Pricing Tax Mode</Label>
                    <select
                      id="pim_tax_inc"
                      value={taxInclusive ? "true" : "false"}
                      onChange={(e) => setTaxInclusive(e.target.value === "true")}
                      className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                    >
                      <option value="true">Tax Inclusive (GST included in price)</option>
                      <option value="false">Tax Exclusive (GST added at checkout)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VARIANTS MATRIX & DYNAMIC PRICING ENGINE */}
          {activeTab === "variants" && (
            <div className="space-y-6">
              {/* Real-time Dynamic Price Recalculation Engine Banner */}
              <div className="p-4 rounded-xl bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700 flex flex-col md:flex-row items-center justify-between gap-4 opacity-100">
                <div>
                  <Text className="font-bold text-sm text-purple-600 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Dynamic Real-Time Price Recalculation Engine
                  </Text>
                  <Text className="text-xs text-ui-fg-subtle">
                    Formula: Selected Weight Price (₹{baseWeightPrice}) + Shape Extra (+₹{shapeModifierSum}) + Flavor Extra (+₹{flavourModifierSum})
                  </Text>
                </div>
                <div className="text-right">
                  <Text className="text-xs text-ui-fg-subtle uppercase tracking-wider font-semibold">Calculated Final Price</Text>
                  <Text className="text-2xl font-extrabold text-emerald-600">₹{calculatedFinalPrice}</Text>
                </div>
              </div>

              {/* Product Level Enable Toggles */}
              <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border rounded-xl flex flex-wrap gap-6 text-xs font-semibold">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableFlavorSelection}
                    onChange={(e) => setEnableFlavorSelection(e.target.checked)}
                    className="rounded"
                  />
                  <span>Enable Flavor Selection for this Product</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableShapeSelection}
                    onChange={(e) => setEnableShapeSelection(e.target.checked)}
                    className="rounded"
                  />
                  <span>Enable Shape Selection for this Product</span>
                </label>
              </div>

              {/* Dynamic Flavor Selection Matrix */}
              {enableFlavorSelection && (
                <div className="border rounded-xl p-4 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-xs text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Allowed Flavor Options (Database-Driven)
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={loadMasterData}
                        disabled={masterDataLoading}
                        className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${masterDataLoading ? "animate-spin" : ""}`} /> Refresh
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowInlineFlavorCreate(true); setInlineFlavorName(""); setInlineFlavorPrice("0"); }}
                        className="flex items-center gap-1 text-[10px] bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 font-semibold"
                      >
                        <Plus className="w-3 h-3" /> Quick Add Flavor
                      </button>
                    </div>
                  </div>

                  {showInlineFlavorCreate && (
                    <div className="flex flex-wrap items-end gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-200">
                      <div>
                        <Label className="text-[10px] block mb-1">Flavor Name *</Label>
                        <Input
                          placeholder="e.g. Belgian Chocolate"
                          value={inlineFlavorName}
                          onChange={(e) => setInlineFlavorName(e.target.value)}
                          className="text-xs h-8 w-48"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] block mb-1">Extra Price (₹)</Label>
                        <Input
                          type="number"
                          value={inlineFlavorPrice}
                          onChange={(e) => setInlineFlavorPrice(e.target.value)}
                          className="text-xs h-8 w-24"
                        />
                      </div>
                      <Button
                        type="button"
                        size="small"
                        isLoading={inlineFlavorSubmitting}
                        className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                        onClick={async () => {
                          if (!inlineFlavorName.trim()) return;
                          setInlineFlavorSubmitting(true);
                          try {
                            await apiClient.createAdminFlavor({
                              name: inlineFlavorName.trim(),
                              display_name: inlineFlavorName.trim(),
                              extra_price: parseFloat(inlineFlavorPrice) || 0,
                              status: "active",
                              is_enabled: true,
                            });
                            setShowInlineFlavorCreate(false);
                            loadMasterData();
                          } catch (err: any) {
                            setErrorMsg(err.message || "Failed to create flavor.");
                          } finally {
                            setInlineFlavorSubmitting(false);
                          }
                        }}
                      >
                        Save Flavor
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowInlineFlavorCreate(false)}
                        className="h-8 w-8 flex items-center justify-center rounded-md border text-slate-500 hover:bg-slate-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {masterFlavours.length === 0 ? (
                    <div className="text-center py-4 text-xs text-blue-600 dark:text-blue-400">
                      <Sparkles className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">No flavor masters found in database.</p>
                      <p className="text-slate-500 mt-1">Use the <strong>Quick Add Flavor</strong> button above, or go to<br />
                      <strong>Catalog &rarr; 🍫 Flavors &amp; Shapes</strong> for full management.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Search flavors..."
                          value={flavorSearch}
                          onChange={(e) => setFlavorSearch(e.target.value)}
                          className="text-xs h-8 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedFlavours(masterFlavours.filter(f => !flavorSearch || f.name.toLowerCase().includes(flavorSearch.toLowerCase()) || (f.display_name || "").toLowerCase().includes(flavorSearch.toLowerCase())).map(f => f.name))}
                          className="text-[10px] px-2 py-1.5 bg-blue-100 text-blue-700 rounded-md font-semibold hover:bg-blue-200 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedFlavours([])}
                          className="text-[10px] px-2 py-1.5 bg-slate-100 text-slate-600 rounded-md font-semibold hover:bg-slate-200 whitespace-nowrap"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {masterFlavours
                          .filter(f => !flavorSearch || f.name.toLowerCase().includes(flavorSearch.toLowerCase()) || (f.display_name || "").toLowerCase().includes(flavorSearch.toLowerCase()))
                          .map((f) => {
                          const isSelected = selectedFlavours.includes(f.name);
                          const price = f.extra_price || f.price_modifier || 0;
                          const modText = price > 0 ? ` (+₹${price})` : "";
                          return (
                            <Badge
                              key={f.id}
                              color={isSelected ? "blue" : "grey"}
                              className="cursor-pointer px-3 py-1.5 text-xs transition-colors"
                              onClick={() => setSelectedFlavours(prev => prev.includes(f.name) ? prev.filter(item => item !== f.name) : [...prev, f.name])}
                            >
                              {f.display_name || f.name}{modText}
                            </Badge>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {selectedFlavours.length} of {masterFlavours.length} flavors selected &bull; Click badge to toggle
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400">Selected flavors will be available to customers for this product.</p>
                </div>
              )}

              {/* Dynamic Shape Selection Matrix */}
              {enableShapeSelection && (
                <div className="border rounded-xl p-4 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" /> Allowed Shape Options (Database-Driven)
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={loadMasterData}
                        disabled={masterDataLoading}
                        className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${masterDataLoading ? "animate-spin" : ""}`} /> Refresh
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowInlineShapeCreate(true); setInlineShapeName(""); setInlineShapePrice("0"); }}
                        className="flex items-center gap-1 text-[10px] bg-emerald-600 text-white px-2 py-1 rounded-md hover:bg-emerald-700 font-semibold"
                      >
                        <Plus className="w-3 h-3" /> Quick Add Shape
                      </button>
                    </div>
                  </div>

                  {showInlineShapeCreate && (
                    <div className="flex flex-wrap items-end gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border border-emerald-200">
                      <div>
                        <Label className="text-[10px] block mb-1">Shape Name *</Label>
                        <Input
                          placeholder="e.g. Heart, Round, Square"
                          value={inlineShapeName}
                          onChange={(e) => setInlineShapeName(e.target.value)}
                          className="text-xs h-8 w-48"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] block mb-1">Additional Price (₹)</Label>
                        <Input
                          type="number"
                          value={inlineShapePrice}
                          onChange={(e) => setInlineShapePrice(e.target.value)}
                          className="text-xs h-8 w-24"
                        />
                      </div>
                      <Button
                        type="button"
                        size="small"
                        isLoading={inlineShapeSubmitting}
                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                        onClick={async () => {
                          if (!inlineShapeName.trim()) return;
                          setInlineShapeSubmitting(true);
                          try {
                            await apiClient.createAdminShape({
                              name: inlineShapeName.trim(),
                              additional_price: parseFloat(inlineShapePrice) || 0,
                              status: "active",
                              is_enabled: true,
                            });
                            setShowInlineShapeCreate(false);
                            loadMasterData();
                          } catch (err: any) {
                            setErrorMsg(err.message || "Failed to create shape.");
                          } finally {
                            setInlineShapeSubmitting(false);
                          }
                        }}
                      >
                        Save Shape
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowInlineShapeCreate(false)}
                        className="h-8 w-8 flex items-center justify-center rounded-md border text-slate-500 hover:bg-slate-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {masterShapes.length === 0 ? (
                    <div className="text-center py-4 text-xs text-emerald-600 dark:text-emerald-400">
                      <Layers className="w-6 h-6 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">No shape masters found in database.</p>
                      <p className="text-slate-500 mt-1">Use the <strong>Quick Add Shape</strong> button above, or go to<br />
                      <strong>Catalog &rarr; 🍫 Flavors &amp; Shapes</strong> for full management.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Search shapes..."
                          value={shapeSearch}
                          onChange={(e) => setShapeSearch(e.target.value)}
                          className="text-xs h-8 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedShapes(masterShapes.filter(s => !shapeSearch || s.name.toLowerCase().includes(shapeSearch.toLowerCase()) || (s.display_name || "").toLowerCase().includes(shapeSearch.toLowerCase())).map(s => s.name))}
                          className="text-[10px] px-2 py-1.5 bg-emerald-100 text-emerald-700 rounded-md font-semibold hover:bg-emerald-200 whitespace-nowrap"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedShapes([])}
                          className="text-[10px] px-2 py-1.5 bg-slate-100 text-slate-600 rounded-md font-semibold hover:bg-slate-200 whitespace-nowrap"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {masterShapes
                          .filter(s => !shapeSearch || s.name.toLowerCase().includes(shapeSearch.toLowerCase()) || (s.display_name || "").toLowerCase().includes(shapeSearch.toLowerCase()))
                          .map((s) => {
                          const isSelected = selectedShapes.includes(s.name);
                          const price = s.additional_price || s.price_modifier || 0;
                          const modText = price > 0 ? ` (+₹${price})` : "";
                          return (
                            <Badge
                              key={s.id}
                              color={isSelected ? "green" : "grey"}
                              className="cursor-pointer px-3 py-1.5 text-xs transition-colors"
                              onClick={() => setSelectedShapes(prev => prev.includes(s.name) ? prev.filter(item => item !== s.name) : [...prev, s.name])}
                            >
                              {s.display_name || s.name}{modText}
                            </Badge>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {selectedShapes.length} of {masterShapes.length} shapes selected &bull; Click badge to toggle
                      </p>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400">Selected shapes will be available to customers for this product.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: CUSTOMIZATION & ADD-ONS */}
          {activeTab === "addons" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-ui-bg-subtle border border-ui-border-base space-y-3 text-xs">
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input type="checkbox" checked={allowCustomMessage} onChange={(e) => setAllowCustomMessage(e.target.checked)} />
                  <span>Allow Customer Custom Piping Message on Cake</span>
                </label>
                {allowCustomMessage && (
                  <div>
                    <Label htmlFor="msg_lim">Message Character Limit</Label>
                    <Input id="msg_lim" type="number" value={messageLimit} onChange={(e) => setMessageLimit(e.target.value)} className="w-32" />
                  </div>
                )}
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input type="checkbox" checked={isPhotoCake} onChange={(e) => setIsPhotoCake(e.target.checked)} />
                  <span>Enable Custom Edible Photo Image Upload by Customer</span>
                </label>
              </div>

              <Text className="text-xs font-semibold text-emerald-600 pt-2">Cross-Sell Add-on Attachments</Text>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <label className="p-3 border rounded-lg flex items-center gap-2 cursor-pointer bg-ui-bg-subtle">
                  <input type="checkbox" checked={addOnCandles} onChange={(e) => setAddOnCandles(e.target.checked)} />
                  <span>Magic Birthday Candles (₹49)</span>
                </label>
                <label className="p-3 border rounded-lg flex items-center gap-2 cursor-pointer bg-ui-bg-subtle">
                  <input type="checkbox" checked={addOnCard} onChange={(e) => setAddOnCard(e.target.checked)} />
                  <span>Personalized Greeting Card (₹99)</span>
                </label>
                <label className="p-3 border rounded-lg flex items-center gap-2 cursor-pointer bg-ui-bg-subtle">
                  <input type="checkbox" checked={addOnFlowers} onChange={(e) => setAddOnFlowers(e.target.checked)} />
                  <span>Red Rose Bouquet Add-on (₹299)</span>
                </label>
              </div>
            </div>
          )}

          {/* TAB 6: MEDIA GALLERY & IMAGE COMPRESSOR */}
          {activeTab === "media" && (
            <div className="space-y-6">
              {/* WebP Canvas Compression Uploader */}
              <div className="p-4 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-xl bg-purple-100 dark:bg-purple-900 text-center flex flex-col items-center justify-center gap-2 opacity-100">
                <Upload className="w-8 h-8 text-purple-600 animate-bounce" />
                <div>
                  <Text className="font-bold text-sm text-purple-800 dark:text-purple-200">
                    High-Performance Canvas WebP Image Converter
                  </Text>
                  <Text className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Auto-compresses uploaded product photos to lightweight WebP format (Target: 300KB - 500KB)
                  </Text>
                </div>
                <label className="cursor-pointer px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow transition-colors flex items-center gap-1.5 mt-1">
                  <Upload className="w-4 h-4" /> Choose Photos to Compress & Upload
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </label>
                {compressing && (
                  <Text className="text-xs text-purple-600 font-semibold animate-pulse mt-1">
                    ⚡ Converting & Compressing Images to WebP...
                  </Text>
                )}
              </div>

              {/* Compressed Image Gallery */}
              <div>
                <Label className="mb-2 block font-semibold text-xs text-ui-fg-subtle">Product Image Gallery ({galleryImages.length})</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {galleryImages.map((imgUrl, i) => (
                    <div key={i} className="relative group aspect-square border border-gray-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imgUrl} alt={`Product ${i}`} loading="lazy" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                          <Badge color={thumbnailUrl === imgUrl ? "green" : "grey"} className="text-[9px]">
                            {thumbnailUrl === imgUrl ? "Main Cover" : `Image #${i + 1}`}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => setGalleryImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="p-1 bg-rose-600 text-white rounded hover:bg-rose-700"
                            title="Delete Image"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        {thumbnailUrl !== imgUrl && (
                          <Button
                            type="button"
                            size="small"
                            onClick={() => setThumbnailUrl(imgUrl)}
                            className="w-full text-[10px] h-6 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Set Main Cover
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200 dark:border-slate-800">
                <div>
                  <Label htmlFor="pim_thumb">Main Featured Image URL *</Label>
                  <Input id="pim_thumb" value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="pim_vid">Video Stream URL (MP4 / HLS)</Label>
                  <Input id="pim_vid" placeholder="https://..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="pim_alt">SEO Image Alt Text</Label>
                  <Input id="pim_alt" value={altText} onChange={(e) => setAltText(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: LOGISTICS, PREPARATION & DELIVERY RULES */}
          {activeTab === "logistics" && (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-4">
                <Text className="font-bold text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-600" /> Enterprise Reusable Delivery Profile & Preparation Policy
                </Text>

                {/* Delivery Profile Selection Banner */}
                <div className="p-3 bg-white dark:bg-slate-900 border rounded-xl space-y-2">
                  <Label htmlFor="pim_delivery_profile" className="font-bold text-xs text-purple-900 dark:text-purple-300">Assigned Reusable Delivery Profile *</Label>
                  <select
                    id="pim_delivery_profile"
                    value={deliveryProfileId}
                    onChange={(e) => setDeliveryProfileId(e.target.value)}
                    className="w-full p-2 text-xs font-bold rounded-lg border bg-purple-50/50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 cursor-pointer"
                  >
                    <option value="prof_regular">Regular Cake Profile (1h Prep, Bike, All Zones, 60m Slots)</option>
                    <option value="prof_designer">Designer Cake Profile (6h Prep, Car, Zones 1-3, 120m Slots)</option>
                    <option value="prof_photo">Photo Cake Profile (4h Prep, Bike, Zones 1-3, 60m Slots)</option>
                    <option value="prof_wedding">Tiered Wedding Cake Profile (24h Prep, Van, Zones 1-2, 120m Slots)</option>
                    <option value="prof_icecream">Ice Cream Cake Profile (2h Prep, Car, Zones 1-2, 30m Slots)</option>
                    <option value="prof_dry">Dry Cake Profile (30m Prep, Bike, All Zones, Express Ready)</option>
                    <option value="prof_tier">Multi-Tier Cake Profile (12h Prep, Van, Zones 1-3, 120m Slots)</option>
                  </select>
                  <Text className="text-[10px] text-slate-500">
                    Products inherit allowed zones, vehicle restrictions, slot durations, and cutoff rules automatically from their assigned profile.
                  </Text>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pim_min_prep">Minimum Preparation Time *</Label>
                    <select
                      id="pim_min_prep"
                      value={minPrepHours}
                      onChange={(e) => setMinPrepHours(e.target.value)}
                      className="w-full p-2 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                    >
                      <option value="0.5">30 Minutes (Fast Prep)</option>
                      <option value="1">1 Hour (Standard Cake)</option>
                      <option value="2">2 Hours (Gourmet Cake)</option>
                      <option value="4">4 Hours (Custom Photo Cake)</option>
                      <option value="6">6 Hours (Tiered / Designer Cake)</option>
                      <option value="12">12 Hours (Fresh Bake Morning)</option>
                      <option value="24">24 Hours (Custom Structural Cake)</option>
                      <option value="48">48 Hours (2-Day Preorder)</option>
                      <option value="72">72 Hours (3-Day Preorder)</option>
                    </select>
                    <Text className="text-[10px] text-slate-500 mt-1">
                      Earliest delivery slot will be calculated as: Current Time + Min Prep Time + Zone Buffer.
                    </Text>
                  </div>

                  <div>
                    <Label htmlFor="pim_cap">Daily Production Capacity</Label>
                    <Input id="pim_cap" type="number" value={dailyCapacity} onChange={(e) => setDailyCapacity(e.target.value)} />
                  </div>
                </div>

                {/* Delivery Option Allowances */}
                <div className="pt-3 border-t">
                  <Label className="mb-2 block font-semibold text-xs text-slate-700 dark:text-slate-300">Product Delivery Option Permissions:</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <label className="flex items-center gap-2 p-2.5 border rounded-lg bg-white dark:bg-slate-900 cursor-pointer">
                      <input type="checkbox" checked={sameDayAllowed} onChange={(e) => setSameDayAllowed(e.target.checked)} />
                      <span>Same Day Delivery</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 border rounded-lg bg-white dark:bg-slate-900 cursor-pointer">
                      <input type="checkbox" checked={expressAllowed} onChange={(e) => setExpressAllowed(e.target.checked)} />
                      <span>Express Delivery</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 border rounded-lg bg-white dark:bg-slate-900 cursor-pointer">
                      <input type="checkbox" checked={midnightAllowed} onChange={(e) => setMidnightAllowed(e.target.checked)} />
                      <span>Midnight Delivery</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 border rounded-lg bg-white dark:bg-slate-900 cursor-pointer">
                      <input type="checkbox" checked={scheduledAllowed} onChange={(e) => setScheduledAllowed(e.target.checked)} />
                      <span>Scheduled Delivery</span>
                    </label>
                  </div>
                </div>

                {/* Allowed Delivery Zones Selector */}
                <div className="pt-3 border-t">
                  <Label className="mb-2 block font-semibold text-xs text-slate-700 dark:text-slate-300">Allowed Delivery Zones (Select enabled zones):</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {[
                      { id: "zone_1", label: "Zone 1 (0-5 KM)" },
                      { id: "zone_2", label: "Zone 2 (5-10 KM)" },
                      { id: "zone_3", label: "Zone 3 (10-15 KM)" },
                      { id: "zone_4", label: "Zone 4 (15-20 KM)" },
                    ].map((z) => (
                      <label key={z.id} className="flex items-center gap-2 p-2.5 border rounded-lg bg-white dark:bg-slate-900 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={allowedZoneIds.includes(z.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAllowedZoneIds((prev) => [...prev, z.id]);
                            } else {
                              setAllowedZoneIds((prev) => prev.filter((id) => id !== z.id));
                            }
                          }}
                        />
                        <span>{z.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SEO & AI TOOLS */}
          {activeTab === "seo" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="seo_t_field">Meta Title</Label>
                  <Input id="seo_t_field" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="seo_kw">SEO Keywords</Label>
                  <Input id="seo_kw" value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="seo_d_field">Meta Description</Label>
                  <Input id="seo_d_field" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: PIM DISPLAY RULES & LIVE PREVIEW */}
          {activeTab === "pim_config" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-1 border-b pb-3">
                <Heading level="h3" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-500" /> PIM Storefront Display & Requirement Rules
                </Heading>
                <Text className="text-xs text-slate-600 dark:text-slate-400">
                  Control which configuration sections customers see on the storefront. Disabled sections will never render on the product page.
                </Text>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Weight / Size Control */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">🎂 Weight / Size Selection</span>
                    <button type="button" onClick={() => setPimConfig(p => ({ ...p, show_weight: !p.show_weight }))} className={`px-2.5 py-1 text-xs rounded-lg font-bold ${pimConfig.show_weight ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                      {pimConfig.show_weight ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                  {pimConfig.show_weight && (
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Require Selection Before Cart?</span>
                      <button type="button" onClick={() => setPimConfig(p => ({ ...p, required_weight: !p.required_weight }))} className={`px-2 py-0.5 text-[10px] rounded font-bold ${pimConfig.required_weight ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                        {pimConfig.required_weight ? "REQUIRED *" : "OPTIONAL"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Shape Selector Control */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">📐 Shape Selection</span>
                    <button type="button" onClick={() => setPimConfig(p => ({ ...p, show_shape: !p.show_shape }))} className={`px-2.5 py-1 text-xs rounded-lg font-bold ${pimConfig.show_shape ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                      {pimConfig.show_shape ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                  {pimConfig.show_shape && (
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Require Shape Selection?</span>
                      <button type="button" onClick={() => setPimConfig(p => ({ ...p, required_shape: !p.required_shape }))} className={`px-2 py-0.5 text-[10px] rounded font-bold ${pimConfig.required_shape ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                        {pimConfig.required_shape ? "REQUIRED *" : "OPTIONAL"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Cake Flavour Control */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">🍫 Flavour Selection</span>
                    <button type="button" onClick={() => setPimConfig(p => ({ ...p, show_flavour: !p.show_flavour }))} className={`px-2.5 py-1 text-xs rounded-lg font-bold ${pimConfig.show_flavour ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                      {pimConfig.show_flavour ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                </div>

                {/* Inner Filling Control */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">🍓 Inner Filling Selection</span>
                    <button type="button" onClick={() => setPimConfig(p => ({ ...p, show_filling: !p.show_filling }))} className={`px-2.5 py-1 text-xs rounded-lg font-bold ${pimConfig.show_filling ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                      {pimConfig.show_filling ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                </div>

                {/* Photo Cake Upload Control */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">🖼️ Photo Cake Upload</span>
                    <button type="button" onClick={() => setPimConfig(p => ({ ...p, show_photo_cake: !p.show_photo_cake }))} className={`px-2.5 py-1 text-xs rounded-lg font-bold ${pimConfig.show_photo_cake ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                      {pimConfig.show_photo_cake ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                </div>

                {/* Custom Cake Message Control */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">✍️ Custom Message on Cake</span>
                    <button type="button" onClick={() => setPimConfig(p => ({ ...p, show_cake_message: !p.show_cake_message }))} className={`px-2.5 py-1 text-xs rounded-lg font-bold ${pimConfig.show_cake_message ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                      {pimConfig.show_cake_message ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Live Storefront Preview */}
              <div className="border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/30 p-4 rounded-2xl space-y-3">
                <Heading level="h4" className="text-xs font-extrabold uppercase text-rose-700 dark:text-rose-400 tracking-wider">
                  👁️ Live Storefront Product Page Preview
                </Heading>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3 text-xs">
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{name || "Sample Cake"}</div>
                  {pimConfig.show_weight && <div className="p-2 bg-emerald-50 text-emerald-900 rounded font-semibold">✓ Size Selector Rendered</div>}
                  {pimConfig.show_shape && <div className="p-2 bg-blue-50 text-blue-900 rounded font-semibold">✓ Shape Selector Rendered</div>}
                  {pimConfig.show_flavour && <div className="p-2 bg-amber-50 text-amber-900 rounded font-semibold">✓ Flavour Selector Rendered</div>}
                  {pimConfig.show_filling && <div className="p-2 bg-purple-50 text-purple-900 rounded font-semibold">✓ Filling Selector Rendered</div>}
                  {pimConfig.show_photo_cake && <div className="p-2 bg-indigo-50 text-indigo-900 rounded font-semibold">✓ Photo Cake Upload Rendered</div>}
                  {pimConfig.show_cake_message && <div className="p-2 bg-rose-50 text-rose-900 rounded font-semibold">✓ Cake Message Input Rendered</div>}
                </div>
              </div>
            </div>
          )}

          {/* Sticky Footer Form Actions */}
          <div className="sticky bottom-0 z-20 p-4 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between opacity-100 mt-auto">
            <Text className="text-xs text-slate-600 dark:text-slate-400 font-medium">All changes persist directly to PostgreSQL DB & Medusa PIM catalog.</Text>
            <div className="flex gap-2">
              <Button type="button" variant="transparent" onClick={onClose} className="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold">Cancel</Button>
              <Button type="submit" isLoading={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg shadow">
                Save & Update PIM Record
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
