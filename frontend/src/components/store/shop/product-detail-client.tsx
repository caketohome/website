"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Heading, Text, Button, Input, Switch, Badge, Textarea, Label } from "@medusajs/ui";
import { useFavorites } from "@/providers/favorites-provider";
import type { ProductReview } from "@frontend/lib/data/catalog";
import { addToCart } from "@frontend/lib/actions/carts";
import { retrieveBranchInventory } from "@frontend/lib/data/branches";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductReviewsSection } from "./product-reviews-section";
import { ProductFulfillmentBadge } from "./product-fulfillment-badge";
import { apiClient } from "@frontend/lib/api-client";

// Custom SVG Icons
const HeartIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
);

const HeartSolidIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className={className}>
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
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
}: ProductDetailProps) {
    const router = useRouter();
    const { isFavorited, toggleFavorite } = useFavorites();
    const prodId = product.id || product.product_id;
    const isWishlisted = isFavorited(prodId);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const [cartLoading, setCartLoading] = useState(false);
    const isSubmittingRef = useRef(false);
    const messageInputRef = useRef<HTMLInputElement>(null);
    const [showMessageReminder, setShowMessageReminder] = useState(false);

    // Merge PIM visibility & requirement controls
    const activePimConfig = useMemo(() => {
        const defaults = {
            show_weight: true,
            required_weight: true,
            show_shape: true,
            required_shape: false,
            show_flavour: true,
            required_flavour: false,
            show_filling: true,
            required_filling: false,
            show_cream: true,
            required_cream: false,
            show_dietary: true,
            required_dietary: false,
            show_photo_cake: true,
            required_photo_cake: false,
            show_cake_message: true,
            required_cake_message: false,
            show_candles: true,
            show_greeting_card: true,
            show_balloons: true,
            show_knife: true,
            show_premium_packaging: true,
            show_customer_notes: true,
        };
        return { ...defaults, ...pimConfig, ...(product?.pim_config || {}) };
    }, [pimConfig, product]);

    // Gallery state
    const galleryImages = useMemo(() => {
        if (Array.isArray(product.images) && product.images.length > 0) {
            return product.images;
        }
        return [product.thumbnail || "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800"];
    }, [product]);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);

    // Helper: Option active status check
    const isOptionActive = (o: any) =>
        o &&
        o.is_enabled !== false &&
        o.enabled !== false &&
        o.status !== "disabled" &&
        o.status !== "archived";

    // ZERO Hardcoded Arrays: The ONLY source of truth is the product PIM data
    const weightsList = useMemo(() => {
        let raw: any[] = [];
        if (weightPrices && weightPrices.length > 0) {
            raw = weightPrices;
        } else if (masterVariantOptions && masterVariantOptions.length > 0) {
            raw = masterVariantOptions.filter((o: any) => o.type === "weight");
        }
        return raw
            .filter(isOptionActive)
            .map((wp: any) => ({
                id: wp.id || wp.weight_id,
                name: wp.weight_name || wp.name,
                price: Number(wp.selling_price) || (product.price + (Number(wp.price_modifier) || 0)),
                is_enabled: true,
            }));
    }, [weightPrices, masterVariantOptions, product.price]);

    const [storefrontOptions, setStorefrontOptions] = useState<any>({
        enable_flavor_selection: true,
        enable_shape_selection: true,
        flavors: [],
        shapes: [],
    });

    useEffect(() => {
        if (product?.id) {
            apiClient.getStorefrontProductOptions(product.id).then((res: any) => {
                if (res) setStorefrontOptions(res);
            }).catch(() => null);
        }
    }, [product?.id]);

    const shapesList = useMemo(() => {
        if (!storefrontOptions.enable_shape_selection) return [];
        return (storefrontOptions.shapes || []).filter((s: any) => s.is_enabled !== false && s.status !== "archived");
    }, [storefrontOptions]);

    const flavoursList = useMemo(() => {
        if (!storefrontOptions.enable_flavor_selection) return [];
        return (storefrontOptions.flavors || []).filter((f: any) => f.is_enabled !== false && f.status !== "archived");
    }, [storefrontOptions]);

    const fillingsList = useMemo(() => {
        if (!storefrontOptions.enable_filling_selection) return [];
        return (storefrontOptions.fillings || []).filter((f: any) => f.is_enabled !== false && f.status !== "archived");
    }, [storefrontOptions]);

    const creamsList = useMemo(() => {
        if (!storefrontOptions.enable_cream_selection) return [];
        return (storefrontOptions.creams || []).filter((c: any) => c.is_enabled !== false && c.status !== "archived");
    }, [storefrontOptions]);

    const [recommendedAccessories, setRecommendedAccessories] = useState<any[]>([]);

    useEffect(() => {
        if (product?.id) {
            apiClient.getAccessories(product.id).then((res: any) => {
                if (res?.accessories && Array.isArray(res.accessories)) {
                    setRecommendedAccessories(res.accessories);
                }
            }).catch(() => null);
        }
    }, [product?.id]);

    const addonsList = useMemo(() => {
        return recommendedAccessories.map((acc: any) => ({
            id: acc.id,
            name: acc.name,
            price_modifier: Number(acc.price) || 0,
            thumbnail: acc.thumbnail,
            stock: acc.stock,
        }));
    }, [recommendedAccessories]);

    // Product-Specific Dietary Flags Check
    const hasSugarFree = meta?.sugar_free === true || product?.sugar_free === true;
    const hasGlutenFree = meta?.gluten_free === true || product?.gluten_free === true;
    const hasVegan = meta?.vegan === true || product?.vegan === true;
    const hasAnyDietaryOption = hasSugarFree || hasGlutenFree || hasVegan;

    // Selected Option States
    const [selectedWeight, setSelectedWeight] = useState<any>(weightsList[0] || null);
    const [selectedShape, setSelectedShape] = useState<any>(shapesList[0] || null);
    const [selectedFlavour, setSelectedFlavour] = useState<any>(flavoursList[0] || null);
    const [selectedFilling, setSelectedFilling] = useState<any>(fillingsList[0] || null);
    const [selectedCream, setSelectedCream] = useState<any>(creamsList[0] || null);

    useEffect(() => {
        if (weightsList.length > 0) {
            if (!selectedWeight || !weightsList.some((w: any) => (w.id || w.name) === (selectedWeight.id || selectedWeight.name))) {
                setSelectedWeight(weightsList[0]);
            }
        } else {
            setSelectedWeight(null);
        }
    }, [weightsList]);

    useEffect(() => {
        if (shapesList.length > 0) {
            if (!selectedShape || !shapesList.some((s: any) => (s.id || s.name) === (selectedShape.id || selectedShape.name))) {
                setSelectedShape(shapesList[0]);
            }
        } else {
            setSelectedShape(null);
        }
    }, [shapesList]);

    useEffect(() => {
        if (flavoursList.length > 0) {
            if (!selectedFlavour || !flavoursList.some((f: any) => (f.id || f.name) === (selectedFlavour.id || selectedFlavour.name))) {
                setSelectedFlavour(flavoursList[0]);
            }
        } else {
            setSelectedFlavour(null);
        }
    }, [flavoursList]);

    useEffect(() => {
        if (fillingsList.length > 0) {
            if (!selectedFilling || !fillingsList.some((fil: any) => (fil.id || fil.name) === (selectedFilling.id || selectedFilling.name))) {
                setSelectedFilling(fillingsList[0]);
            }
        } else {
            setSelectedFilling(null);
        }
    }, [fillingsList]);

    useEffect(() => {
        if (creamsList.length > 0) {
            if (!selectedCream || !creamsList.some((c: any) => (c.id || c.name) === (selectedCream.id || selectedCream.name))) {
                setSelectedCream(creamsList[0]);
            }
        } else {
            setSelectedCream(null);
        }
    }, [creamsList]);

    // Dietary Options State
    const [isSugarFree, setIsSugarFree] = useState<boolean>(false);
    const [isGlutenFree, setIsGlutenFree] = useState<boolean>(false);
    const [isVegan, setIsVegan] = useState<boolean>(false);

    // Photo & Message Customization
    const [isPhotoCake, setIsPhotoCake] = useState<boolean>(false);
    const [photoUrl, setPhotoUrl] = useState<string>("");
    const [cakeMessage, setCakeMessage] = useState<string>("");

    // Selected Add-ons
    const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
    const [greetingCardText, setGreetingCardText] = useState<string>("");

    // Quantity Selector
    const [quantity, setQuantity] = useState<number>(1);

    // Branch Inventory State
    const [branchStock, setBranchStock] = useState<number | null>(null);
    const [allOccasions, setAllOccasions] = useState<any[]>([]);

    useEffect(() => {
        apiClient.getOccasions().then((r: any) => {
            if (r?.occasions) setAllOccasions(r.occasions);
        }).catch(() => null);
    }, []);

    const productOccasions = useMemo(() => {
        const pOccIds = Array.isArray(product?.occasion_ids) && product.occasion_ids.length > 0
            ? product.occasion_ids
            : (product?.occasion ? [product.occasion] : []);
        if (pOccIds.length === 0) return [{ name: "Birthday", slug: "birthday", icon: "🎂" }];
        return pOccIds.map((idOrName: string) => {
            const found = allOccasions.find((o) => o.id === idOrName || o.slug === idOrName || o.name.toLowerCase() === idOrName.toLowerCase());
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

    useEffect(() => {
        const loadBranchDetails = async () => {
            const branchId = getCookie("_cakes2home_branch_id");
            if (!branchId || !variantId) return;
            try {
                const stockData = await retrieveBranchInventory(branchId, variantId);
                setBranchStock(stockData.available ?? 15);
            } catch (err) {
                console.error("Failed to load branch stock", err);
            }
        };
        loadBranchDetails();
    }, [variantId]);

    // Live Dynamic Price Calculator
    const calculatedPrice = useMemo(() => {
        const base = activePimConfig.show_weight !== false && selectedWeight ? selectedWeight.price : (product.price || 649);
        const shapeMod = activePimConfig.show_shape && selectedShape ? Number(selectedShape.price_modifier || selectedShape.additional_price || 0) : 0;
        const flavourMod = activePimConfig.show_flavour && selectedFlavour ? Number(selectedFlavour.price_modifier || selectedFlavour.extra_price || 0) : 0;

        const dietaryMod = activePimConfig.show_dietary !== false && hasAnyDietaryOption
            ? ((hasSugarFree && isSugarFree) ? 100 : 0) +
              ((hasGlutenFree && isGlutenFree) ? 100 : 0) +
              ((hasVegan && isVegan) ? 120 : 0)
            : 0;

        const photoMod = activePimConfig.show_photo_cake && isPhotoCake ? 250 : 0;

        const addonsTotal = selectedAddonIds.reduce((sum, id) => {
            const item = addonsList.find((a) => a.id === id);
            return sum + (item ? Number(item.price_modifier || 0) : 0);
        }, 0);

        return (base + shapeMod + flavourMod + dietaryMod + photoMod + addonsTotal) * quantity;
    }, [
        activePimConfig,
        selectedWeight,
        selectedShape,
        selectedFlavour,
        hasAnyDietaryOption,
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

    const [addedCartSuccess, setAddedCartSuccess] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    const handleAddToCart = async () => {
        // Prevent duplicate API requests and rapid click submissions
        if (isSubmittingRef.current || cartLoading) {
            return;
        }

        // Enforce required PIM fields before allowing Add to Cart
        if (activePimConfig.show_weight !== false && activePimConfig.required_weight !== false && weightsList.length > 0 && !selectedWeight) {
            setValidationError("Please select a cake size before adding to cart.");
            return;
        }
        if (activePimConfig.show_shape && activePimConfig.required_shape && shapesList.length > 0 && !selectedShape) {
            setValidationError("Please select a cake shape before adding to cart.");
            return;
        }
        if (activePimConfig.show_flavour && activePimConfig.required_flavour && flavoursList.length > 0 && !selectedFlavour) {
            setValidationError("Please select a cake flavour before adding to cart.");
            return;
        }
        if (activePimConfig.show_filling && activePimConfig.required_filling && fillingsList.length > 0 && !selectedFilling) {
            setValidationError("Please select an inner filling before adding to cart.");
            return;
        }
        if (activePimConfig.show_photo_cake && activePimConfig.required_photo_cake && (!isPhotoCake || !photoUrl.trim())) {
            setValidationError("Please upload a photo for the photo cake before adding to cart.");
            return;
        }
        if (activePimConfig.show_cake_message && activePimConfig.required_cake_message && !cakeMessage.trim()) {
            setValidationError("Please enter a custom message for the cake.");
            return;
        }

        setValidationError(null);

        const targetShopId = shopId || "default_shop";
        isSubmittingRef.current = true;
        setCartLoading(true);

        try {
            const chosenAddons = addonsList
                .filter((a) => selectedAddonIds.includes(a.id))
                .map((a) => a.name);

            const metadata = {
                productId: product.id,
                variantId: variantId,
                weight: activePimConfig.show_weight !== false && selectedWeight ? selectedWeight.name : null,
                shape: activePimConfig.show_shape && selectedShape ? selectedShape.name : null,
                flavour: activePimConfig.show_flavour && selectedFlavour ? selectedFlavour.name : null,
                sugar_free: hasSugarFree ? isSugarFree : false,
                gluten_free: hasGlutenFree ? isGlutenFree : false,
                vegan: hasVegan ? isVegan : false,
                photo_cake: activePimConfig.show_photo_cake && isPhotoCake ? photoUrl || "Uploaded Photo" : null,
                cake_message: activePimConfig.show_cake_message !== false ? cakeMessage.trim() || null : null,
                greeting_card_text: greetingCardText,
                selected_addons: chosenAddons,
                price: calculatedPrice / quantity,
                quantity: quantity,
            };

            await addToCart(variantId, targetShopId, metadata);
            router.refresh();

            // Reminder & Focus Logic after successful addition
            if (activePimConfig.show_cake_message !== false && !cakeMessage.trim()) {
                setShowMessageReminder(true);
                if (messageInputRef.current) {
                    messageInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                    setTimeout(() => {
                        messageInputRef.current?.focus({ preventScroll: true });
                    }, 300);
                }
            } else {
                setShowMessageReminder(false);
            }

            setAddedCartSuccess(true);
            setTimeout(() => setAddedCartSuccess(false), 6000);
        } catch (e) {
            console.error("Failed to add to cart", e);
            setAddedCartSuccess(false);
        } finally {
            setCartLoading(false);
            isSubmittingRef.current = false;
        }
    };

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full px-4 py-8 bg-navy-surface min-h-screen">
            <div className={`flex flex-col md:flex-row gap-12 ${pdpConfig?.gallery_layout === "right" ? "md:flex-row-reverse" : pdpConfig?.gallery_layout === "stacked" ? "md:flex-col" : ""}`}>
                {/* Dynamic Image Gallery */}
                <div className={`${pdpConfig?.gallery_layout === "stacked" ? "w-full" : "md:w-1/2"} flex flex-col gap-4`}>
                    <div className="relative w-full h-[500px] bg-obsidian-base rounded-[32px] overflow-hidden shadow-ambient border border-navy-accent/60 group">
                        <Image
                            src={galleryImages[selectedImageIndex] || product.thumbnail}
                            alt={product.title}
                            fill
                            priority
                            className="object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                        />
                        {pdpConfig?.show_wishlist !== false && (
                            <Button
                                variant="transparent"
                                size="small"
                                onClick={handleWishlistToggle}
                                disabled={wishlistLoading}
                                className="absolute top-5 right-5 bg-gradient-to-b from-navy-surface to-obsidian-base border border-navy-accent/50 backdrop-blur-md p-3 rounded-full shadow-sm hover:bg-navy-surface hover:scale-105 transition-all z-10"
                            >
                                {isWishlisted ? <HeartSolidIcon className="text-blush w-6 h-6" /> : <HeartIcon className="w-6 h-6 text-pearl" />}
                            </Button>
                        )}
                    </div>

                    {/* Gallery Thumbnails */}
                    {galleryImages.length > 1 && (
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide mt-2">
                            {galleryImages.map((imgUrl: string, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedImageIndex(idx)}
                                    className={`relative w-24 h-24 rounded-2xl overflow-hidden transition-all duration-300 shrink-0 ${
                                        selectedImageIndex === idx ? "border-2 border-navy-accent/60 ring-4 ring-blush/20 opacity-100" : "border border-taupe/10 opacity-70 hover:opacity-100"
                                    }`}
                                >
                                    <Image src={imgUrl} alt={`Thumbnail ${idx}`} fill className="object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Dynamic PIM Configuration Panel */}
                <div className="md:w-1/2 flex flex-col gap-6 pt-2">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {product.category && (
                                <Link
                                    href={`/products?category=${product.category_slug || product.category.toLowerCase().replace(/\\s+/g, "-")}`}
                                    className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-semibold bg-obsidian-base text-pearl border border-taupe/5 transition-colors hover:bg-rosegold/30"
                                >
                                    {product.category}
                                </Link>
                            )}
                            {meta?.is_bestseller && <div className="bg-rosegold/30 text-pearl px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold">Bestseller</div>}
                            {meta?.is_featured && <div className="bg-rosegold/10 text-pearl px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold">Featured</div>}
                        </div>
                        <Heading level="h1" className="font-serif text-4xl md:text-[3.25rem] font-medium text-pearl leading-[1.1] tracking-tight">{product.title}</Heading>
                        {pdpConfig?.show_rating !== false && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[#D4AF37] font-semibold text-lg flex items-center gap-1">★ {averageRating}</span>
                                {pdpConfig?.show_reviews !== false && (
                                    <span className="text-ash font-sans text-sm">({reviewCount} reviews)</span>
                                )}
                            </div>
                        )}

                        {/* Structured Occasion Badges */}
                        <div className="flex items-center gap-2 flex-wrap pt-3">
                            <span className="font-sans text-[11px] uppercase tracking-[0.2em] font-semibold text-ash">Perfect for:</span>
                            {productOccasions.map((occ: any) => (
                                <Link
                                    key={occ.slug}
                                    href={`/occasions/${occ.slug}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-obsidian-base hover:bg-rosegold/30 border border-taupe/5 text-pearl text-[11px] font-medium transition-all"
                                >
                                    <span className="opacity-70">{occ.icon || "•"}</span>
                                    <span>{occ.name}</span>
                                </Link>
                            ))}
                        </div>

                        {/* Real-time Order Cutoff & Fulfillment Eligibility Badge */}
                        {pdpConfig?.show_delivery_checker !== false && (
                            <div className="mt-4 p-4 bg-obsidian-base border border-navy-accent/60 rounded-2xl">
                                <ProductFulfillmentBadge productId={prodId} branchId={shopId} showDetails={true} />
                            </div>
                        )}
                    </div>

                    <Text className="text-ash font-sans text-base leading-relaxed mt-2">{product.description}</Text>

                    {/* Weight / Size Selector - Rendered ONLY if enabled in PIM & has options */}
                    {activePimConfig.show_weight !== false && weightsList.length > 0 && (
                        <div className="flex flex-col gap-4 border-t border-navy-accent/60 pt-8 mt-4">
                            <div className="flex justify-between items-center">
                                <Label className="font-sans text-xs uppercase tracking-[0.15em] text-pearl font-semibold">
                                    Select Size {activePimConfig.required_weight !== false && "*"}
                                </Label>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {weightsList.map((w: any) => {
                                    const isSelected = selectedWeight?.name === w.name;
                                    return (
                                        <button
                                            key={w.id || w.name}
                                            type="button"
                                            onClick={() => {
                                                setSelectedWeight(w);
                                                setValidationError(null);
                                            }}
                                            className={`flex flex-col p-5 rounded-2xl border text-center transition-all duration-500 ${
                                                isSelected
                                                    ? "border-taupe bg-rosegold text-white shadow-ambient"
                                                    : "border-navy-accent/60 hover:border-taupe/30 bg-obsidian-base text-pearl"
                                            }`}
                                        >
                                            <span className="font-sans text-[15px] font-medium">{w.name}</span>
                                            <span className={`text-[13px] mt-1.5 font-light ${isSelected ? "text-white/80" : "text-ash"}`}>₹{w.price}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Shape Selector - Rendered ONLY if enabled in PIM & has options */}
                    {activePimConfig.show_shape && shapesList.length > 0 && (
                        <div className="flex flex-col gap-4 border-t border-navy-accent/60 pt-8">
                            <Label className="font-sans text-xs uppercase tracking-[0.15em] text-pearl font-semibold">
                                Select Shape {activePimConfig.required_shape && "*"}
                            </Label>
                            <div className="flex flex-wrap gap-3">
                                {shapesList.map((s: any) => {
                                    const isSelected = selectedShape?.name === s.name;
                                    return (
                                        <button
                                            key={s.id || s.name}
                                            type="button"
                                            onClick={() => setSelectedShape(s)}
                                            className={`px-6 py-3 text-sm font-medium rounded-full border transition-all duration-300 ${
                                                isSelected
                                                    ? "border-taupe bg-rosegold text-white"
                                                    : "border-navy-accent/60 text-pearl bg-obsidian-base hover:bg-rosegold/30"
                                            }`}
                                        >
                                            {s.name} {s.price_modifier > 0 && `(+₹${s.price_modifier})`}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Flavour & Filling Selectors - Rendered ONLY if enabled in PIM & has options */}
                    {((activePimConfig.show_flavour && flavoursList.length > 0) || (activePimConfig.show_filling && fillingsList.length > 0)) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-navy-accent/60 pt-8">
                            {activePimConfig.show_flavour && flavoursList.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <Label className="font-sans text-xs uppercase tracking-[0.15em] text-pearl font-semibold">
                                        Cake Flavour {activePimConfig.required_flavour && "*"}
                                    </Label>
                                    <select
                                        value={selectedFlavour?.name || ""}
                                        onChange={(e) => {
                                            const found = flavoursList.find((f: any) => f.name === e.target.value);
                                            if (found) setSelectedFlavour(found);
                                        }}
                                        className="w-full text-[15px] font-sans p-4 rounded-2xl border border-navy-accent/60 bg-obsidian-base text-pearl focus:border-taupe focus:ring-1 focus:border-navy-glow focus:ring-1 focus:ring-navy-glow outline-none transition-all shadow-sm"
                                    >
                                        {flavoursList.map((f: any) => (
                                            <option key={f.id || f.name} value={f.name}>
                                                {f.name} {f.price_modifier > 0 ? `(+₹${f.price_modifier})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {activePimConfig.show_filling && fillingsList.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    <Label className="font-sans text-xs uppercase tracking-[0.15em] text-pearl font-semibold">
                                        Inner Filling {activePimConfig.required_filling && "*"}
                                    </Label>
                                    <select
                                        value={selectedFilling?.name || ""}
                                        onChange={(e) => {
                                            const found = fillingsList.find((fil: any) => fil.name === e.target.value);
                                            if (found) setSelectedFilling(found);
                                        }}
                                        className="w-full text-[15px] font-sans p-4 rounded-2xl border border-navy-accent/60 bg-obsidian-base text-pearl focus:border-taupe focus:ring-1 focus:border-navy-glow focus:ring-1 focus:ring-navy-glow outline-none transition-all shadow-sm"
                                    >
                                        {fillingsList.map((fil: any) => (
                                            <option key={fil.id || fil.name} value={fil.name}>
                                                {fil.name} {fil.price_modifier > 0 ? `(+₹${fil.price_modifier})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cream Selector - Rendered ONLY if enabled in PIM & has options */}
                    {activePimConfig.show_cream && creamsList.length > 0 && (
                        <div className="flex flex-col gap-3 border-t border-navy-accent/60 pt-8">
                            <Label className="font-sans text-xs uppercase tracking-[0.15em] text-pearl font-semibold">
                                Cream & Frosting {activePimConfig.required_cream && "*"}
                            </Label>
                            <select
                                value={selectedCream?.name || ""}
                                onChange={(e) => {
                                    const found = creamsList.find((c: any) => c.name === e.target.value);
                                    if (found) setSelectedCream(found);
                                }}
                                className="w-full text-[15px] font-sans p-4 rounded-2xl border border-navy-accent/60 bg-obsidian-base text-pearl focus:border-taupe focus:ring-1 focus:border-navy-glow focus:ring-1 focus:ring-navy-glow outline-none transition-all shadow-sm"
                            >
                                {creamsList.map((c: any) => (
                                    <option key={c.id || c.name} value={c.name}>
                                        {c.name} {c.price_modifier > 0 ? `(+₹${c.price_modifier})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Dietary Preference Switches - Rendered ONLY if enabled in PIM & product has at least 1 enabled dietary flag */}
                    {activePimConfig.show_dietary !== false && hasAnyDietaryOption && (
                        <div className="flex flex-col gap-4 border-t border-navy-accent/60 pt-8 bg-obsidian-base/30 px-6 pb-6 rounded-[24px] border mt-4">
                            <Label className="font-sans text-xs uppercase tracking-[0.15em] text-pearl font-semibold mt-2">Dietary Enhancements</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {hasSugarFree && (
                                    <div className="flex items-center justify-between bg-navy-surface p-4 rounded-2xl border border-navy-accent/60 shadow-sm">
                                        <span className="font-sans text-[13px] font-medium text-pearl">Sugar-Free (+₹100)</span>
                                        <Switch checked={isSugarFree} onCheckedChange={setIsSugarFree} />
                                    </div>
                                )}
                                {hasGlutenFree && (
                                    <div className="flex items-center justify-between bg-navy-surface p-4 rounded-2xl border border-navy-accent/60 shadow-sm">
                                        <span className="font-sans text-[13px] font-medium text-pearl">Gluten-Free (+₹100)</span>
                                        <Switch checked={isGlutenFree} onCheckedChange={setIsGlutenFree} />
                                    </div>
                                )}
                                {hasVegan && (
                                    <div className="flex items-center justify-between bg-navy-surface p-4 rounded-2xl border border-navy-accent/60 shadow-sm">
                                        <span className="font-sans text-[13px] font-medium text-pearl">100% Vegan (+₹120)</span>
                                        <Switch checked={isVegan} onCheckedChange={setIsVegan} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Photo Cake Option - Rendered ONLY if enabled in PIM */}
                    {activePimConfig.show_photo_cake && (
                        <div className="flex flex-col gap-4 border-t border-navy-accent/60 pt-8 mt-2">
                            <div className="flex items-center justify-between bg-obsidian-base p-5 rounded-2xl border border-navy-accent/60 shadow-sm">
                                <div className="flex flex-col">
                                    <Label className="font-sans text-[13px] font-semibold text-pearl">
                                        Photo Print (+₹250) {activePimConfig.required_photo_cake && "*"}
                                    </Label>
                                    <span className="text-xs text-ash mt-0.5">Edible picture on cake top</span>
                                </div>
                                <Switch checked={isPhotoCake} onCheckedChange={setIsPhotoCake} />
                            </div>
                            {isPhotoCake && (
                                <Input
                                    value={photoUrl}
                                    onChange={(e) => setPhotoUrl(e.target.value)}
                                    placeholder="Paste photo URL link..."
                                    className="w-full text-sm p-4 rounded-xl border border-navy-accent/60 bg-navy-surface"
                                />
                            )}
                        </div>
                    )}

                    {/* Custom Cake Message - Rendered ONLY if enabled in PIM */}
                    {activePimConfig.show_cake_message !== false && (
                        <div
                            id="cake-message-section"
                            className={`flex flex-col gap-3 border-t border-navy-accent/60 pt-8 rounded-2xl transition-all duration-300 mt-2`}
                        >
                            <div className="flex items-center justify-between">
                                <Label htmlFor="cake-message-input" className="font-sans text-xs uppercase tracking-[0.15em] text-pearl font-semibold flex items-center gap-1.5">
                                    <span>Message on Cake</span>
                                    {activePimConfig.required_cake_message ? (
                                        <span className="text-pearl font-bold">*</span>
                                    ) : (
                                        <span className="text-[10px] text-ash font-normal tracking-normal">(Optional)</span>
                                    )}
                                </Label>
                                <span className={`text-[11px] font-medium ${cakeMessage.length === 30 ? "text-pearl font-bold" : "text-ash"}`}>
                                    {cakeMessage.length}/30 chars
                                </span>
                            </div>
                            <Input
                                id="cake-message-input"
                                ref={messageInputRef}
                                value={cakeMessage}
                                maxLength={30}
                                onChange={(e) => {
                                    setCakeMessage(e.target.value.slice(0, 30));
                                    if (showMessageReminder) setShowMessageReminder(false);
                                }}
                                placeholder="e.g., Happy Birthday Ananya!"
                                className={`w-full text-[15px] p-5 rounded-2xl border-navy-accent/60 bg-obsidian-base text-pearl focus:border-taupe focus:ring-1 focus:border-navy-glow focus:ring-1 focus:ring-navy-glow transition-all shadow-sm ${
                                    showMessageReminder ? "border-taupe ring-1 ring-navy-glow" : ""
                                }`}
                            />

                            {showMessageReminder && (
                                <div className="p-4 bg-rosegold/30 border border-navy-accent/60 rounded-2xl text-xs text-pearl animate-in fade-in flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg leading-none">🖋️</span>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-pearl text-[13px]">Add a personal touch</span>
                                            <span className="text-xs text-ash leading-relaxed mt-1">
                                                A message on the cake is <strong>optional</strong>. Leave blank if you prefer a minimal design.
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowMessageReminder(false)}
                                        className="text-ash hover:text-pearl text-lg"
                                        aria-label="Dismiss message reminder"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Frequently Bought Together & Celebration Accessories */}
                    {recommendedAccessories.length > 0 && (
                        <div className="flex flex-col gap-4 border-t border-navy-accent/60 pt-8 mt-2">
                            <div className="flex items-center justify-between">
                                <Label className="font-sans text-xs uppercase tracking-[0.15em] text-pearl font-semibold">
                                    Curated Add-ons
                                </Label>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {recommendedAccessories.map((acc: any) => {
                                    const isSelected = selectedAddonIds.includes(acc.id);
                                    return (
                                        <div
                                            key={acc.id}
                                            onClick={() => toggleAddon(acc.id)}
                                            className={`p-4 rounded-[20px] border transition-all duration-300 cursor-pointer flex items-center gap-4 ${
                                                isSelected
                                                    ? "border-taupe bg-obsidian-base shadow-ambient"
                                                    : "border-navy-accent/60 bg-navy-surface hover:border-taupe/30 shadow-sm"
                                            }`}
                                        >
                                            <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-obsidian-base shrink-0 border border-navy-accent/60">
                                                <Image src={acc.thumbnail || acc.images?.[0] || "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=400"} alt={acc.name} fill className="object-cover" />
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0 justify-center">
                                                <span className="font-sans text-[13px] font-medium text-pearl truncate">{acc.name}</span>
                                                <span className="text-[13px] font-semibold text-pearl mt-1">₹{acc.price}</span>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-all ${isSelected ? "bg-rosegold border-taupe text-white" : "bg-navy-surface border-navy-accent/60 text-transparent"}`}>
                                                ✓
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedAddonIds.some((id) => id.includes("03") || id.includes("card") || id.includes("crd")) && (
                                <Textarea
                                    value={greetingCardText}
                                    onChange={(e) => setGreetingCardText(e.target.value)}
                                    placeholder="Write custom handwritten message for your greeting card..."
                                    className="text-sm p-4 mt-2 rounded-2xl border-navy-accent/60 bg-obsidian-base shadow-sm focus:border-taupe"
                                />
                            )}
                        </div>
                    )}

                    {/* Validation Error Prompt */}
                    {validationError && (
                        <div className="p-4 bg-rosegold/30 border border-navy-accent/60 text-pearl text-sm font-medium rounded-2xl animate-in fade-in">
                            ⚠️ {validationError}
                        </div>
                    )}

                    {/* Price & Add to Cart Panel */}
                    <div className="flex flex-col gap-6 border-t-2 border-navy-accent/60 pt-8 mt-6 bg-obsidian-base/40 p-6 rounded-[32px] border shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-ash font-semibold mb-1">Total Due</span>
                                <span className="font-serif text-[2.5rem] font-medium text-pearl leading-none">₹{calculatedPrice}</span>
                                {branchStock !== null && (
                                    <span className={`text-[11px] uppercase tracking-wider font-semibold mt-2 ${branchStock > 0 ? "text-pearl" : "text-ash"}`}>
                                        {branchStock > 0 ? `In Stock (${branchStock} available)` : "Out of Stock"}
                                    </span>
                                )}
                            </div>

                            {/* Quantity Selector */}
                            <div className="flex items-center border border-navy-accent/60 rounded-full bg-navy-surface overflow-hidden shadow-sm h-12">
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="px-4 h-full text-lg font-medium text-pearl hover:bg-obsidian-base transition-colors"
                                >
                                    -
                                </button>
                                <span className="px-4 text-[15px] font-medium text-pearl w-12 text-center">{quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => q + 1)}
                                    className="px-4 h-full text-lg font-medium text-pearl hover:bg-obsidian-base transition-colors"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <Button
                            onClick={handleAddToCart}
                            isLoading={cartLoading}
                            size="large"
                            disabled={(branchStock !== null && branchStock <= 0) || product?.is_out_of_stock_at_branch === true || product?.branch_status === "OUT_OF_STOCK"}
                            className="w-full bg-rosegold hover:bg-[#3A3532] text-white font-sans font-medium py-5 text-[13px] uppercase tracking-[0.15em] rounded-full shadow-ambient-lg transition-all border-none"
                        >
                            {(branchStock !== null && branchStock <= 0) || product?.is_out_of_stock_at_branch === true || product?.branch_status === "OUT_OF_STOCK"
                                ? "Unavailable"
                                : `${pdpConfig?.add_to_cart_text || "Add to Cart"} • ₹${calculatedPrice}`}
                        </Button>

                        {addedCartSuccess && (
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-rosegold border border-taupe text-white text-[13px] font-medium shadow-ambient-lg animate-in fade-in">
                                <span>Successfully added to your bag.</span>
                                <Button size="small" variant="transparent" onClick={() => router.push("/checkout")} className="text-white hover:bg-gradient-to-b from-navy-surface to-obsidian-base border border-navy-accent/50 uppercase tracking-widest text-[10px] rounded-full">
                                    Checkout →
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Verified Customer Reviews Section */}
            <div className="border-t border-navy-accent/60 pt-16 mt-8">
                <ProductReviewsSection
                    productId={product?.id || product?.product_id}
                    productTitle={product?.title || product?.name || "Signature Creation"}
                    initialReviews={initialReviews as any}
                    initialAverage={averageRating}
                    initialCount={reviewCount}
                    initialDistribution={ratingDistribution as any}
                />
            </div>
        </div>
    );
}
