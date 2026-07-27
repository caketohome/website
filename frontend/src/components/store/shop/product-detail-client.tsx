"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Button, Input, Switch, Badge, Textarea, Label } from "@medusajs/ui";
import {
    addToWishlistAction,
    removeFromWishlistAction,
    submitReviewAction,
    createStockNotificationAction,
    createSubscriptionAction,
} from "@frontend/lib/actions";
import type {
    ProductReview,
} from "@frontend/lib/data/catalog";
import { addToCart } from "@frontend/lib/actions/carts";
import { retrieveBranchInventory, retrieveBranchPricing } from "@frontend/lib/data/branches";
import Image from "next/image";

// Custom SVG Icons to avoid import errors from library icon changes
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
    cakeOptions?: any[];
}

import { useRouter } from "next/navigation";

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
    cakeOptions = [],
}: ProductDetailProps) {
    const router = useRouter();
    const [isWishlisted, setIsWishlisted] = useState(isWishlistedInitial);
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const [cartLoading, setCartLoading] = useState(false);

    const getCookie = (name: string): string | null => {
        if (typeof document === "undefined") return null;
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(";").shift() || null;
        return null;
    };

    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
    const [branchStock, setBranchStock] = useState<number | null>(null);
    const [branchPriceOverride, setBranchPriceOverride] = useState<number | null>(null);
    const [loadingBranchDetails, setLoadingBranchDetails] = useState(false);

    useEffect(() => {
        const loadBranchDetails = async () => {
            const branchId = getCookie("_cakes2home_branch_id");
            if (!branchId || !variantId) return;
            setSelectedBranchId(branchId);
            setLoadingBranchDetails(true);
            try {
                const stockData = await retrieveBranchInventory(branchId, variantId);
                setBranchStock(stockData.available ?? 0);

                const priceData = await retrieveBranchPricing(branchId, variantId);
                if (priceData && priceData.price !== null) {
                    setBranchPriceOverride(priceData.price);
                }
            } catch (err) {
                console.error("Failed to load branch stock/pricing", err);
            } finally {
                setLoadingBranchDetails(false);
            }
        };
        loadBranchDetails();
    }, [variantId]);

    // Reviews states
    const [reviews, setReviews] = useState<ProductReview[]>(initialReviews);
    const [rating, setRating] = useState(5);
    const [reviewTitle, setReviewTitle] = useState("");
    const [reviewBody, setReviewBody] = useState("");
    const [submittingReview, setSubmittingReview] = useState(false);

    // Subscription states
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [frequency, setFrequency] = useState<"weekly" | "fortnightly" | "monthly">("monthly");
    const [subscribingLoading, setSubscribingLoading] = useState(false);

    // Restock states
    const [notifyEmail, setNotifyEmail] = useState("");
    const [notifyPhone, setNotifyPhone] = useState("");
    const [notifyingLoading, setNotifyingLoading] = useState(false);
    const [notifiedStatus, setNotifiedStatus] = useState<string | null>(null);

    // Customization states
    const [selectedShape, setSelectedShape] = useState("Round");
    const [cakeMessage, setCakeMessage] = useState("");
    const [isEggless, setIsEggless] = useState(meta?.eggless || false);
    const [packaging, setPackaging] = useState("Standard");

    // Add-on states
    const [isGreetingCard, setIsGreetingCard] = useState(false);
    const [greetingCardText, setGreetingCardText] = useState("");
    const [isCandles, setIsCandles] = useState(false);
    const [isBalloons, setIsBalloons] = useState(false);

    // Photo Cake states
    const [isPhotoCake, setIsPhotoCake] = useState(false);
    const [photoUrl, setPhotoUrl] = useState("");

    const handleWishlistToggle = async () => {
        setWishlistLoading(true);
        try {
            if (isWishlisted) {
                await removeFromWishlistAction(product.id);
                setIsWishlisted(false);
            } else {
                await addToWishlistAction(product.id);
                setIsWishlisted(true);
            }
        } catch (e) {
            console.error("Failed to toggle wishlist", e);
        } finally {
            setWishlistLoading(false);
        }
    };

    // @ts-ignore
    const basePrice = branchPriceOverride !== null
        ? branchPriceOverride
        : (product?.variants?.[0]?.calculated_price?.calculated_amount ?? 0);
    const addOnPrice = 
        (selectedShape === "Heart" ? 150 : 0) +
        (isEggless ? 50 : 0) +
        (packaging === "Premium" ? 100 : 0) +
        (isGreetingCard ? 40 : 0) +
        (isCandles ? 20 : 0) +
        (isBalloons ? 80 : 0) +
        (isPhotoCake ? 250 : 0);
    const totalPrice = basePrice + addOnPrice;

    const [addedCartSuccess, setAddedCartSuccess] = useState(false);
    const [bannerNotice, setBannerNotice] = useState<string | null>(null);

    const handleAddToCart = async () => {
        if (!variantId) return;
        const targetShopId = shopId || "default_shop";
        setCartLoading(true);
        setAddedCartSuccess(true); // Instant optimistic update on UI!
        try {
            const metadata = {
                shape: selectedShape,
                message: cakeMessage,
                eggless: isEggless,
                packaging: packaging,
                greeting_card: isGreetingCard ? greetingCardText || "Happy Birthday!" : null,
                candles: isCandles,
                balloons: isBalloons,
                photo_cake: isPhotoCake ? photoUrl || "Default Photo Cake Uploaded" : null,
                customization_upcharge: addOnPrice,
            };
            await addToCart(variantId, targetShopId, metadata);
            router.refresh();
            setTimeout(() => setAddedCartSuccess(false), 5000);
        } catch (e) {
            console.error("Failed to add to cart", e);
            setAddedCartSuccess(false);
        } finally {
            setCartLoading(false);
        }
    };

    const handleSubscribe = async () => {
        setSubscribingLoading(true);
        try {
            const nextDate = new Date();
            nextDate.setMonth(nextDate.getMonth() + 1); // first delivery in 1 month
            await createSubscriptionAction({
                product_id: product.id,
                variant_id: variantId,
                frequency,
                quantity: 1,
                next_date: nextDate.toISOString(),
            });
            setBannerNotice("Subscribed successfully! You can manage this from your account page.");
        } catch (e) {
            console.error("Failed to subscribe", e);
        } finally {
            setSubscribingLoading(false);
        }
    };

    const handleNotifyMe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!notifyEmail && !notifyPhone) return;
        setNotifyingLoading(true);
        try {
            await createStockNotificationAction({
                product_id: product.id,
                email: notifyEmail || undefined,
                phone: notifyPhone || undefined,
                variant_id: variantId || undefined,
            });
            setNotifiedStatus("Successfully registered for restock notifications!");
        } catch (e) {
            console.error(e);
            setNotifiedStatus("Failed to register. Please try again.");
        } finally {
            setNotifyingLoading(false);
        }
    };

    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingReview(true);
        try {
            await submitReviewAction(product.id, {
                rating,
                title: reviewTitle || undefined,
                body: reviewBody || undefined,
            });
            setBannerNotice("Review submitted successfully! It will appear once approved by the administrator.");
            setReviewTitle("");
            setReviewBody("");
        } catch (e) {
            console.error(e);
            setBannerNotice("Failed to submit review. Make sure you are logged in.");
        } finally {
            setSubmittingReview(false);
        }
    };

    const shapeOption = cakeOptions?.find((opt: any) => opt.option_type === "shape");
    const shapeChoices = shapeOption?.values && shapeOption.values.length > 0 ? shapeOption.values : ["Round", "Square", "Heart"];
    const packagingOption = cakeOptions?.find((opt: any) => opt.option_type === "packaging");
    const packagingChoices = packagingOption?.values && packagingOption.values.length > 0 ? packagingOption.values : ["Standard", "Premium"];

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full px-4 py-8">
            <div className="flex flex-col md:flex-row gap-8">
                {/* Image Section */}
                <div className="md:w-1/2 flex flex-col gap-4">
                    {product.thumbnail ? (
                        <Image
                            src={product.thumbnail}
                            alt={product.title}
                            className="w-full h-96 object-cover rounded-xl shadow-md border"
                            width={500}
                            height={384}
                        />
                    ) : (
                        <div className="w-full h-96 bg-ui-bg-subtle rounded-xl flex items-center justify-center text-5xl border border-dashed">🍰</div>
                    )}

                    {meta?.video_url && (
                        <div className="mt-4">
                            <Text className="font-semibold text-sm mb-2">Cake Video Preview</Text>
                            <video src={meta.video_url} controls className="w-full rounded-lg shadow-sm border h-48 object-cover" />
                        </div>
                    )}
                </div>

                {/* Details Section */}
                <div className="md:w-1/2 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <Heading level="h1" className="text-3xl font-extrabold">{product.title}</Heading>
                        <Button variant="transparent" size="small" onClick={handleWishlistToggle} disabled={wishlistLoading}>
                            {isWishlisted ? <HeartSolidIcon className="text-red-500 w-6 h-6" /> : <HeartIcon className="w-6 h-6" />}
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-yellow-500 font-bold text-lg">{averageRating > 0 ? `${averageRating} ★` : "New Cake"}</span>
                        <span className="text-ui-fg-subtle text-sm">({reviewCount} customer reviews)</span>
                    </div>

                    {/* Dietary Badges */}
                    <div className="flex gap-2 flex-wrap">
                        {meta?.eggless && <Badge color="green">100% Eggless</Badge>}
                        {meta?.sugar_free && <Badge color="blue">Sugar Free</Badge>}
                        {meta?.gluten_free && <Badge color="orange">Gluten Free</Badge>}
                        {meta?.vegan && <Badge color="purple">Vegan</Badge>}
                        {meta?.is_bestseller && <Badge color="red">Bestseller</Badge>}
                    </div>

                    <Text className="text-ui-fg-subtle leading-relaxed">{product.description}</Text>

                    {/* Cake Metadata Panel */}
                    {(meta?.ingredients || meta?.allergens || meta?.shelf_life || meta?.fssai_license) && (
                        <div className="border rounded-lg p-4 bg-ui-bg-subtle flex flex-col gap-2">
                            <Heading level="h3" className="text-sm font-bold mb-1">Product Description & Details</Heading>
                            {meta.ingredients && <Text className="text-xs"><strong>Ingredients:</strong> {meta.ingredients}</Text>}
                            {meta.allergens && <Text className="text-xs text-ui-fg-red"><strong>Allergens Warning:</strong> {meta.allergens}</Text>}
                            {meta.shelf_life && <Text className="text-xs"><strong>Shelf Life:</strong> {meta.shelf_life}</Text>}
                            {meta.storage_instructions && <Text className="text-xs"><strong>Storage:</strong> {meta.storage_instructions}</Text>}
                            {meta.fssai_license && <Text className="text-xs text-ui-fg-muted font-mono">FSSAI License: {meta.fssai_license}</Text>}
                        </div>
                    )}

                    {/* Cake Customization Section */}
                    {variantId && (
                        <div className="flex flex-col gap-4 border border-ui-border-base p-6 rounded-xl mt-4 bg-ui-bg-base">
                            <Heading level="h2" className="text-xl font-bold border-b pb-2">Customize Your Cake</Heading>
                            
                            {/* Shape Selector */}
                            <div className="flex flex-col gap-2">
                                <Label className="font-semibold text-sm">Select Shape</Label>
                                <div className="flex gap-2">
                                    {shapeChoices.map((s: string) => {
                                        const isSelected = selectedShape === s;
                                        return (
                                            <Button
                                                key={s}
                                                variant={isSelected ? "primary" : "secondary"}
                                                onClick={() => setSelectedShape(s)}
                                                className="flex-1"
                                            >
                                                {s} {s === "Heart" && "(+€1.50)"}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Eggless Switch */}
                            <div className="flex items-center justify-between border-t pt-3">
                                <div className="flex flex-col">
                                    <Label className="font-semibold text-sm">100% Eggless</Label>
                                    <Text className="text-xs text-ui-fg-subtle">Prepared in a dedicated egg-free environment (+€0.50)</Text>
                                </div>
                                <Switch checked={isEggless} onCheckedChange={setIsEggless} />
                            </div>

                            {/* Cake Message Input */}
                            <div className="flex flex-col gap-2 border-t pt-3">
                                <Label className="font-semibold text-sm">Message on Cake (Max 30 chars)</Label>
                                <Input
                                    value={cakeMessage}
                                    onChange={(e) => setCakeMessage(e.target.value.slice(0, 30))}
                                    placeholder="e.g., Happy Birthday Amit!"
                                    className="w-full"
                                />
                            </div>

                            {/* Premium Packaging Selector */}
                            <div className="flex flex-col gap-2 border-t pt-3">
                                <Label className="font-semibold text-sm">Packaging Upgrade</Label>
                                <div className="flex gap-2">
                                    {packagingChoices.map((p: string) => {
                                        const isSelected = packaging === p;
                                        return (
                                            <Button
                                                key={p}
                                                variant={isSelected ? "primary" : "secondary"}
                                                onClick={() => setPackaging(p)}
                                                className="flex-1"
                                            >
                                                {p} {p === "Premium" && "(+€1.00)"}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Photo Cake Upload Option */}
                            <div className="flex flex-col gap-2 border-t pt-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <Label className="font-semibold text-sm">Make it a Photo Cake</Label>
                                        <Text className="text-xs text-ui-fg-subtle">Print your favorite photo onto the cake (+€2.50)</Text>
                                    </div>
                                    <Switch checked={isPhotoCake} onCheckedChange={setIsPhotoCake} />
                                </div>
                                {isPhotoCake && (
                                    <div className="flex flex-col gap-1 mt-1">
                                        <Input
                                            value={photoUrl}
                                            onChange={(e) => setPhotoUrl(e.target.value)}
                                            placeholder="Paste Image URL / Path"
                                            className="w-full text-xs"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Celebrations Add-ons (Greeting Card, Candles, Balloons) */}
                            <div className="flex flex-col gap-3 border-t pt-3">
                                <Label className="font-semibold text-sm">Celebration Add-ons</Label>
                                
                                {/* Greeting Card */}
                                <div className="flex flex-col gap-2 bg-ui-bg-subtle p-3 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <Label className="text-sm font-medium">Greeting Card (+€0.40)</Label>
                                            <Text className="text-xs text-ui-fg-subtle">Include a printed greeting card</Text>
                                        </div>
                                        <Switch checked={isGreetingCard} onCheckedChange={setIsGreetingCard} />
                                    </div>
                                    {isGreetingCard && (
                                        <Textarea
                                            value={greetingCardText}
                                            onChange={(e) => setGreetingCardText(e.target.value)}
                                            placeholder="Write your custom message here..."
                                            className="mt-1 text-xs"
                                        />
                                    )}
                                </div>

                                {/* Candles Switch */}
                                <div className="flex items-center justify-between bg-ui-bg-subtle p-3 rounded-lg">
                                    <div className="flex flex-col">
                                        <Label className="text-sm font-medium">Decorative Candles (+€0.20)</Label>
                                        <Text className="text-xs text-ui-fg-subtle">Pack of 5 colorful sparkler candles</Text>
                                    </div>
                                    <Switch checked={isCandles} onCheckedChange={setIsCandles} />
                                </div>

                                {/* Balloons Switch */}
                                <div className="flex items-center justify-between bg-ui-bg-subtle p-3 rounded-lg">
                                    <div className="flex flex-col">
                                        <Label className="text-sm font-medium">Metallic Balloons (+€0.80)</Label>
                                        <Text className="text-xs text-ui-fg-subtle">Pack of 5 helium-grade metallic balloons</Text>
                                    </div>
                                    <Switch checked={isBalloons} onCheckedChange={setIsBalloons} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Order / Subscribe Widgets */}
                    {variantId ? (
                        <div className="flex flex-col gap-4 border border-ui-border-base p-4 rounded-xl mt-4 bg-ui-bg-base">
                            <div className="flex items-center justify-between border-b pb-2">
                                <div className="flex flex-col">
                                    <Text className="font-semibold text-lg">One-time purchase</Text>
                                    <Text className="text-xl font-extrabold text-ui-fg-base mt-1">
                                        €{totalPrice.toFixed(2)}
                                    </Text>
                                    {branchStock !== null && (
                                        <Text className={`text-xs font-semibold mt-1 ${branchStock > 0 ? "text-green-600" : "text-red-600"}`}>
                                            {branchStock > 0 ? `In Stock (${branchStock} available)` : "Out of Stock at Selected Branch"}
                                        </Text>
                                    )}
                                </div>
                                <Button 
                                    onClick={handleAddToCart} 
                                    isLoading={cartLoading} 
                                    size="large"
                                    disabled={branchStock !== null && branchStock <= 0}
                                >
                                    {branchStock !== null && branchStock <= 0 ? "Out of Stock" : "Add to Cart"}
                                </Button>
                            </div>

                            {addedCartSuccess && (
                                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-semibold shadow-sm animate-in fade-in">
                                    <div className="flex items-center gap-2">
                                        <span className="text-base">🎂</span>
                                        <span>Added to your cart with customizations!</span>
                                    </div>
                                    <a href="/checkout" className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg font-bold transition">
                                        View Cart & Checkout →
                                    </a>
                                </div>
                            )}

                            {bannerNotice && (
                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs font-semibold shadow-sm">
                                    ℹ️ {bannerNotice}
                                </div>
                            )}

                            <div className="flex flex-col gap-3 pt-2">
                                <div className="flex items-center justify-between">
                                    <Text className="font-semibold">Subscribe & Save (Recurring)</Text>
                                    <Switch checked={isSubscribing} onCheckedChange={setIsSubscribing} />
                                </div>
                                {isSubscribing && (
                                    <div className="flex gap-2 items-center">
                                        <div className="flex-1">
                                            <select 
                                                value={frequency} 
                                                onChange={(e) => setFrequency(e.target.value as any)}
                                                className="w-full border rounded p-2 text-sm bg-ui-bg-subtle"
                                            >
                                                <option value="weekly">Weekly Delivery</option>
                                                <option value="fortnightly">Fortnightly Delivery</option>
                                                <option value="monthly">Monthly Delivery</option>
                                            </select>
                                        </div>
                                        <Button onClick={handleSubscribe} isLoading={subscribingLoading} size="large">
                                            Confirm Subscription
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Out of Stock Stock Notification Form */
                        <div className="border border-red-200 bg-red-50 p-4 rounded-xl mt-4">
                            <Text className="text-red-700 font-bold mb-2">Out of Stock</Text>
                            <Text className="text-xs text-red-600 mb-3">{"Leave your details below and we will automatically notify you when it's back in stock!"}</Text>
                            <form onSubmit={handleNotifyMe} className="flex flex-col gap-2">
                                <Input type="email" placeholder="Email Address" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} />
                                <Input type="tel" placeholder="Phone Number" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} />
                                <Button type="submit" variant="secondary" isLoading={notifyingLoading}>Notify Me</Button>
                            </form>
                            {notifiedStatus && <Text className="text-xs font-semibold mt-2 text-red-800">{notifiedStatus}</Text>}
                        </div>
                    )}
                </div>
            </div>

            {/* Reviews Section */}
            <div className="border-t pt-8 flex flex-col gap-6">
                <Heading level="h2" className="text-2xl font-bold">Reviews & Ratings</Heading>

                <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Rating Breakdown */}
                    <div className="md:w-1/3 border p-4 rounded-xl bg-ui-bg-subtle flex flex-col gap-2">
                        <Heading level="h3" className="text-lg font-bold">Aggregate rating</Heading>
                        <Text className="text-3xl font-extrabold text-yellow-500">{averageRating > 0 ? averageRating : "N/A"}</Text>
                        <Text className="text-xs text-ui-fg-muted">{reviewCount} approved customer reviews</Text>

                        {/* Star Distribution */}
                        <div className="flex flex-col gap-1 mt-2">
                            {[5, 4, 3, 2, 1].map((star) => {
                                const count = ratingDistribution[star] || 0;
                                const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
                                return (
                                    <div key={star} className="flex items-center gap-2 text-xs">
                                        <span className="w-8">{star} ★</span>
                                        <div className="flex-1 bg-ui-bg-hover h-2 rounded overflow-hidden">
                                            <div className="bg-yellow-500 h-full" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="w-6 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Review Form */}
                    <form onSubmit={handleReviewSubmit} className="md:w-2/3 border p-4 rounded-xl bg-ui-bg-base flex flex-col gap-4 w-full">
                        <Heading level="h3" className="text-lg font-bold">Submit a Review</Heading>
                        <div className="flex gap-2 items-center">
                            <Label>Rating:</Label>
                            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="border rounded p-1">
                                {[5, 4, 3, 2, 1].map((val) => <option key={val} value={val}>{val} ★</option>)}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="rev-title">Review Title</Label>
                            <Input id="rev-title" value={reviewTitle} onChange={(e) => setReviewTitle(e.target.value)} placeholder="Delicious cake!" />
                        </div>
                        <div>
                            <Label htmlFor="rev-body">Review Body</Label>
                            <Textarea id="rev-body" value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} placeholder="Tell us what you liked or disliked..." rows={3} />
                        </div>
                        <Button type="submit" isLoading={submittingReview} className="w-fit">Submit Review</Button>
                    </form>
                </div>

                {/* Reviews List */}
                <div className="flex flex-col gap-4 mt-4">
                    {reviews.length === 0 ? (
                        <Text className="text-ui-fg-muted italic">No approved reviews yet. Be the first to leave a review!</Text>
                    ) : (
                        reviews.map((r) => (
                            <div key={r.id} className="border-b pb-4 flex flex-col gap-1">
                                <div className="flex justify-between text-xs text-ui-fg-subtle">
                                    <span className="font-semibold text-ui-fg-base">{r.customer_name || "Anonymous"}</span>
                                    <span>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-500 font-bold">{r.rating} ★</span>
                                    <Text className="font-bold text-sm">{r.title}</Text>
                                    {r.verified_purchase && <Badge color="green" size="small">Verified Purchaser</Badge>}
                                </div>
                                <Text className="text-sm text-ui-fg-subtle mt-1">{r.body}</Text>
                                {r.reply && (
                                    <div className="mt-2 pl-3 border-l-2 border-ui-border-strong text-xs italic bg-ui-bg-subtle p-2 rounded">
                                        <strong>Merchant reply:</strong> {r.reply}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
