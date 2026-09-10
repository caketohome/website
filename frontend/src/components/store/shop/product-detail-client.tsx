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
import dynamic from "next/dynamic";

const ProductReviewsSection = dynamic(
    () => import("./product-reviews-section").then((mod) => mod.ProductReviewsSection),
    {
        loading: () => (
            <div className="mt-16 pt-12 border-t border-neutral-200 animate-pulse">
                <div className="h-8 w-48 bg-neutral-200 rounded-lg mb-6" />
                <div className="h-32 bg-neutral-100 rounded-xl" />
            </div>
        ),
        ssr: true,
    }
);

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
    const [showEmptyMessageConfirm, setShowEmptyMessageConfirm] = useState(false);

    // Keyboard accessibility for confirmation dialog
    useEffect(() => {
        if (!showEmptyMessageConfirm) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setShowEmptyMessageConfirm(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [showEmptyMessageConfirm]);

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

    const executeAddToCart = async () => {
        // Prevent duplicate API requests and rapid click submissions
        if (isSubmittingRef.current || cartLoading) {
            return;
        }

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

    const handleAddToCart = () => {
        // Prevent duplicate API requests and rapid click submissions
        if (isSubmittingRef.current || cartLoading) {
            return;
        }

        // 1. Enforce required PIM fields before allowing Add to Cart
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

        // 2. Check if optional cake message is empty or whitespace-only
        const isMessageEmpty = !cakeMessage.trim();
        const isCakeMessageOptional = activePimConfig.show_cake_message !== false && !activePimConfig.required_cake_message;

        if (isCakeMessageOptional && isMessageEmpty) {
            // Show confirmation dialog only now at Add to Cart decision point
            setShowEmptyMessageConfirm(true);
            return;
        }

        // Message present or not applicable: proceed to cart
        executeAddToCart();
    };

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full px-4 py-8">
            <div className={`flex flex-col md:flex-row gap-10 ${pdpConfig?.gallery_layout === "right" ? "md:flex-row-reverse" : pdpConfig?.gallery_layout === "stacked" ? "md:flex-col" : ""}`}>
                {/* Dynamic Image Gallery */}
                <div className={`${pdpConfig?.gallery_layout === "stacked" ? "w-full" : "md:w-1/2"} flex flex-col gap-4`}>
                    <div className="relative w-full h-[420px] bg-gray-50 rounded-2xl overflow-hidden shadow-lg border border-gray-200 group">
                        <Image
                            src={galleryImages[selectedImageIndex] || product.thumbnail}
                            alt={product.title}
                            fill
                            priority
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {pdpConfig?.show_wishlist !== false && (
                            <Button
                                variant="transparent"
                                size="small"
                                onClick={handleWishlistToggle}
                                disabled={wishlistLoading}
                                className="absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full shadow-md hover:bg-white transition z-10"
                            >
                                {isWishlisted ? <HeartSolidIcon className="text-rose-600 w-6 h-6" /> : <HeartIcon className="w-6 h-6 text-gray-700" />}
                            </Button>
                        )}
                    </div>

                    {/* Gallery Thumbnails */}
                    {galleryImages.length > 1 && (
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {galleryImages.map((imgUrl: string, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedImageIndex(idx)}
                                    className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                                        selectedImageIndex === idx ? "border-rose-600 ring-2 ring-rose-200" : "border-gray-200 hover:border-gray-400"
                                    }`}
                                >
                                    <Image src={imgUrl} alt={`Thumbnail ${idx}`} fill className="object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Dynamic PIM Configuration Panel */}
                <div className="md:w-1/2 flex flex-col gap-5">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {product.category && (
                                <Link
                                    href={`/products?category=${product.category_slug || product.category.toLowerCase().replace(/\s+/g, "-")}`}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition"
                                >
                                    🍰 {product.category}
                                </Link>
                            )}
                            {meta?.is_bestseller && <Badge color="orange">Bestseller</Badge>}
                            {meta?.is_featured && <Badge color="purple">Featured Cake</Badge>}
                            <span className="text-xs text-gray-500 font-semibold">Freshly Baked On Order</span>
                        </div>
                        <Heading level="h1" className="text-3xl font-extrabold text-gray-900">{product.title}</Heading>
                        {pdpConfig?.show_rating !== false && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-amber-500 font-bold text-base">★ {averageRating}</span>
                                {pdpConfig?.show_reviews !== false && (
                                    <span className="text-gray-500 text-sm">({reviewCount} customer reviews)</span>
                                )}
                            </div>
                        )}

                        {/* Structured Occasion Badges */}
                        <div className="flex items-center gap-2 flex-wrap pt-2">
                            <span className="text-xs font-semibold text-gray-500">Perfect for:</span>
                            {productOccasions.map((occ: any) => (
                                <Link
                                    key={occ.slug}
                                    href={`/occasions/${occ.slug}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all shadow-sm hover:scale-105"
                                >
                                    <span>{occ.icon || "🎉"}</span>
                                    <span>{occ.name}</span>
                                </Link>
                            ))}
                        </div>

                        {/* Real-time Order Cutoff & Fulfillment Eligibility Badge */}
                        {pdpConfig?.show_delivery_checker !== false && (
                            <ProductFulfillmentBadge productId={prodId} branchId={shopId} showDetails={true} className="mt-3" />
                        )}
                    </div>

                    <Text className="text-gray-600 text-sm leading-relaxed">{product.description}</Text>

                    {/* Weight / Size Selector - Rendered ONLY if enabled in PIM & has options */}
                    {activePimConfig.show_weight !== false && weightsList.length > 0 && (
                        <div className="flex flex-col gap-2.5 border-t border-gray-100 pt-4">
                            <div className="flex justify-between items-center">
                                <Label className="font-bold text-sm text-gray-900">
                                    Select Cake Size / Weight {activePimConfig.required_weight !== false && "*"}
                                </Label>
                                <span className="text-xs text-rose-600 font-semibold">Select size to calculate price</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
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
                                            className={`flex flex-col p-3 rounded-xl border text-left transition ${
                                                isSelected
                                                    ? "border-rose-600 bg-rose-50/50 ring-2 ring-rose-200"
                                                    : "border-gray-200 hover:border-gray-300 bg-white"
                                            }`}
                                        >
                                            <span className="font-bold text-sm text-gray-900">{w.name}</span>
                                            <span className="text-xs text-rose-600 font-extrabold mt-0.5">₹{w.price}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Shape Selector - Rendered ONLY if enabled in PIM & has options */}
                    {activePimConfig.show_shape && shapesList.length > 0 && (
                        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
                            <Label className="font-bold text-sm text-gray-900">
                                Select Shape {activePimConfig.required_shape && "*"}
                            </Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {shapesList.map((s: any) => {
                                    const isSelected = selectedShape?.name === s.name;
                                    return (
                                        <button
                                            key={s.id || s.name}
                                            type="button"
                                            onClick={() => setSelectedShape(s)}
                                            className={`p-2.5 text-xs font-bold rounded-xl border transition ${
                                                isSelected
                                                    ? "border-rose-600 bg-rose-600 text-white"
                                                    : "border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                            {activePimConfig.show_flavour && flavoursList.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    <Label className="font-bold text-xs text-gray-900">
                                        Cake Flavour {activePimConfig.required_flavour && "*"}
                                    </Label>
                                    <select
                                        value={selectedFlavour?.name || ""}
                                        onChange={(e) => {
                                            const found = flavoursList.find((f: any) => f.name === e.target.value);
                                            if (found) setSelectedFlavour(found);
                                        }}
                                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-gray-200 bg-white"
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
                                <div className="flex flex-col gap-1.5">
                                    <Label className="font-bold text-xs text-gray-900">
                                        Inner Filling {activePimConfig.required_filling && "*"}
                                    </Label>
                                    <select
                                        value={selectedFilling?.name || ""}
                                        onChange={(e) => {
                                            const found = fillingsList.find((fil: any) => fil.name === e.target.value);
                                            if (found) setSelectedFilling(found);
                                        }}
                                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-gray-200 bg-white"
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
                        <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-4">
                            <Label className="font-bold text-xs text-gray-900">
                                Cream & Frosting {activePimConfig.required_cream && "*"}
                            </Label>
                            <select
                                value={selectedCream?.name || ""}
                                onChange={(e) => {
                                    const found = creamsList.find((c: any) => c.name === e.target.value);
                                    if (found) setSelectedCream(found);
                                }}
                                className="w-full text-xs font-semibold p-2.5 rounded-xl border border-gray-200 bg-white"
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
                        <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 bg-gray-50/70 p-4 rounded-2xl border">
                            <Label className="font-bold text-xs text-gray-900">Dietary & Health Customizations</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {hasSugarFree && (
                                    <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-200">
                                        <span className="text-xs font-semibold text-gray-800">Sugar-Free (+₹100)</span>
                                        <Switch checked={isSugarFree} onCheckedChange={setIsSugarFree} />
                                    </div>
                                )}
                                {hasGlutenFree && (
                                    <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-200">
                                        <span className="text-xs font-semibold text-gray-800">Gluten-Free (+₹100)</span>
                                        <Switch checked={isGlutenFree} onCheckedChange={setIsGlutenFree} />
                                    </div>
                                )}
                                {hasVegan && (
                                    <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-200">
                                        <span className="text-xs font-semibold text-gray-800">100% Vegan (+₹120)</span>
                                        <Switch checked={isVegan} onCheckedChange={setIsVegan} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Photo Cake Option - Rendered ONLY if enabled in PIM */}
                    {activePimConfig.show_photo_cake && (
                        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <Label className="font-bold text-sm text-gray-900">
                                        Make it a Photo Cake (+₹250) {activePimConfig.required_photo_cake && "*"}
                                    </Label>
                                    <span className="text-xs text-gray-500">Print custom edible picture on cake top</span>
                                </div>
                                <Switch checked={isPhotoCake} onCheckedChange={setIsPhotoCake} />
                            </div>
                            {isPhotoCake && (
                                <Input
                                    value={photoUrl}
                                    onChange={(e) => setPhotoUrl(e.target.value)}
                                    placeholder="Paste photo URL or drive image link"
                                    className="w-full text-xs mt-1"
                                />
                            )}
                        </div>
                    )}

                    {/* Custom Cake Message - Rendered ONLY if enabled in PIM */}
                    {activePimConfig.show_cake_message !== false && (
                        <div
                            id="cake-message-section"
                            className="flex flex-col gap-2 border-t border-gray-100 pt-4 rounded-2xl transition-all duration-300"
                        >
                            <div className="flex items-center justify-between">
                                <Label htmlFor="cake-message-input" className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                                    <span>Message on Cake</span>
                                    {activePimConfig.required_cake_message ? (
                                        <span className="text-rose-600 font-bold">*</span>
                                    ) : (
                                        <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                                    )}
                                </Label>
                                <span className={`text-xs font-semibold ${cakeMessage.length === 30 ? "text-amber-600 font-bold" : "text-gray-400"}`}>
                                    {cakeMessage.length}/30 characters
                                </span>
                            </div>
                            <Input
                                id="cake-message-input"
                                ref={messageInputRef}
                                value={cakeMessage}
                                maxLength={30}
                                onChange={(e) => {
                                    setCakeMessage(e.target.value.slice(0, 30));
                                }}
                                placeholder="e.g., Happy Birthday Ananya!"
                                className="w-full text-xs transition"
                            />
                        </div>
                    )}

                    {/* Frequently Bought Together & Celebration Accessories */}
                    {recommendedAccessories.length > 0 && (
                        <div className="flex flex-col gap-3 border-t border-gray-100 pt-5">
                            <div className="flex items-center justify-between">
                                <Label className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
                                    🎁 Frequently Bought Together & Celebration Add-ons
                                </Label>
                                <span className="text-[11px] text-rose-600 font-bold uppercase tracking-wider">1-Click Add</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {recommendedAccessories.map((acc: any) => {
                                    const isSelected = selectedAddonIds.includes(acc.id);
                                    return (
                                        <div
                                            key={acc.id}
                                            onClick={() => toggleAddon(acc.id)}
                                            className={`p-3 rounded-2xl border transition cursor-pointer flex items-center gap-3 ${
                                                isSelected
                                                    ? "border-rose-600 bg-rose-50/60 ring-2 ring-rose-200"
                                                    : "border-gray-200 bg-white hover:border-gray-300 shadow-sm"
                                            }`}
                                        >
                                            <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 border">
                                                <Image src={acc.thumbnail || acc.images?.[0] || "https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=400"} alt={acc.name} fill className="object-cover" />
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="font-bold text-xs text-gray-900 truncate">{acc.name}</span>
                                                <span className="text-xs font-black text-rose-600 mt-0.5">₹{acc.price}</span>
                                                <span className="text-[10px] text-emerald-600 font-bold">In Stock ({acc.stock} left)</span>
                                            </div>
                                            <Button
                                                size="small"
                                                variant={isSelected ? "primary" : "secondary"}
                                                className={`text-xs font-bold shrink-0 ${isSelected ? "bg-rose-600 text-white" : "bg-gray-100 text-gray-800"}`}
                                            >
                                                {isSelected ? "✓ Added" : "+ Add"}
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedAddonIds.some((id) => id.includes("03") || id.includes("card") || id.includes("crd")) && (
                                <Textarea
                                    value={greetingCardText}
                                    onChange={(e) => setGreetingCardText(e.target.value)}
                                    placeholder="Write custom handwritten message for your greeting card..."
                                    className="text-xs mt-2"
                                />
                            )}
                        </div>
                    )}

                    {/* Validation Error Prompt */}
                    {validationError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl animate-in fade-in">
                            ⚠️ {validationError}
                        </div>
                    )}

                    {/* Price & Add to Cart Panel */}
                    <div className="flex flex-col gap-3 border-t-2 border-gray-200 pt-5 mt-2 bg-gray-50/80 p-5 rounded-2xl border">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Calculated Total</span>
                                <span className="text-3xl font-black text-rose-600">₹{calculatedPrice}</span>
                                {branchStock !== null && (
                                    <span className={`text-xs font-bold mt-1 ${branchStock > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                        {branchStock > 0 ? `In Stock (${branchStock} fresh cakes available)` : "Out of Stock"}
                                    </span>
                                )}
                            </div>

                            {/* Quantity Selector */}
                            <div className="flex items-center border border-gray-300 rounded-xl bg-white overflow-hidden shadow-sm">
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
                                >
                                    -
                                </button>
                                <span className="px-3 py-2 text-xs font-bold text-gray-900">{quantity}</span>
                                <button
                                    type="button"
                                    onClick={() => setQuantity((q) => q + 1)}
                                    className="px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 transition"
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
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3.5 text-base rounded-xl shadow-lg transition"
                        >
                            {(branchStock !== null && branchStock <= 0) || product?.is_out_of_stock_at_branch === true || product?.branch_status === "OUT_OF_STOCK"
                                ? "Out of Stock at Your Location"
                                : `${pdpConfig?.add_to_cart_text || "Add to Cart"} • ₹${calculatedPrice}`}
                        </Button>

                        {validationError && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold animate-in fade-in flex items-center gap-2">
                                <span>⚠️</span>
                                <span>{validationError}</span>
                            </div>
                        )}

                        {addedCartSuccess && (
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-semibold shadow-sm animate-in fade-in">
                                <span>✅ Cake successfully added to your cart!</span>
                                <Button size="small" variant="secondary" onClick={() => router.push("/checkout")}>
                                    View Cart & Checkout →
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Verified Customer Reviews Section */}
            <ProductReviewsSection
                productId={product?.id || product?.product_id}
                productTitle={product?.title || product?.name || "Gourmet Cake"}
                initialReviews={initialReviews as any}
                initialAverage={averageRating}
                initialCount={reviewCount}
                initialDistribution={ratingDistribution as any}
            />

            {/* Optional Cake Message Confirmation Modal */}
            {showEmptyMessageConfirm && (
                <div
                    id="empty-message-confirmation-modal"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="empty-msg-dialog-title"
                    aria-describedby="empty-msg-dialog-desc"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowEmptyMessageConfirm(false);
                        }
                    }}
                >
                    <div id="empty-message-confirmation-card" className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        {/* Close button */}
                        <button
                            type="button"
                            onClick={() => setShowEmptyMessageConfirm(false)}
                            className="absolute top-4 right-4 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            aria-label="Close confirmation dialog"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>

                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                                🎂
                            </div>
                            <div className="flex flex-col">
                                <h3 id="empty-msg-dialog-title" className="text-lg font-black text-zinc-900 dark:text-zinc-100 leading-snug">
                                    Add cake without a message?
                                </h3>
                                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                                    Optional Personalization
                                </span>
                            </div>
                        </div>

                        <p id="empty-msg-dialog-desc" className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
                            The cake message is optional. Do you want to continue without one?
                        </p>

                        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                            <Button
                                id="btn-add-message-focus"
                                type="button"
                                variant="secondary"
                                disabled={cartLoading}
                                onClick={() => {
                                    setShowEmptyMessageConfirm(false);
                                    if (messageInputRef.current) {
                                        messageInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
                                        setTimeout(() => {
                                            messageInputRef.current?.focus({ preventScroll: true });
                                        }, 200);
                                    }
                                }}
                                className="flex-1 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                            >
                                ✍️ Add Message
                            </Button>
                            <Button
                                id="btn-confirm-add-to-cart"
                                type="button"
                                variant="primary"
                                isLoading={cartLoading}
                                disabled={cartLoading}
                                onClick={() => {
                                    setShowEmptyMessageConfirm(false);
                                    executeAddToCart();
                                }}
                                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                            >
                                <span>Continue</span>
                                <span>→</span>
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
