"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Sparkles, ShoppingBag, Check, Zap, MapPin, Tag, Truck, RefreshCw, AlertCircle } from "lucide-react";
import { Badge, Button, Text } from "@medusajs/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart } from "@frontend/lib/actions/carts";

export interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  options?: string[];
  product_recommendations?: Array<{
    productId: string;
    variantId?: string;
    name: string;
    price: number;
    mrp: number;
    rating: number;
    reviews?: number;
    thumbnail: string;
    slug: string;
    eggless?: boolean;
    requiresOptions?: boolean;
  }>;
  offers?: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    discountValue: number;
  }>;
  actions?: Array<{
    type: string;
    label: string;
    payload: Record<string, any>;
  }>;
}

export function AiChatAssistant() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [addingMap, setAddingMap] = useState<Record<string, boolean>>({});
  const [addedItemMap, setAddedItemMap] = useState<Record<string, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<string, string | null>>({});

  const [quickChips, setQuickChips] = useState<string[]>([
    "🎂 Birthday Cakes",
    "💖 Anniversary Specials",
    "🍫 Belgian Chocolate Truffle",
    "💰 Cakes Under ₹600",
    "🍰 100% Eggless Cakes",
    "🏷️ Active Coupons",
    "🛵 Check Delivery Time",
  ]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_welcome",
      sender: "ai",
      text: "👋 Hi! I'm your CakeToHome AI Concierge.\n\nTell me your occasion, budget (e.g. *under ₹800*), or delivery area — I'll find the best handcrafted artisanal cakes fresh from our local kitchen hubs!",
      options: [
        "🎂 Birthday Celebration",
        "💖 Anniversary / Romantic",
        "🍫 Top Chocolate Cakes",
        "💰 Cakes Under ₹600",
        "🍰 100% Eggless Cakes",
        "🛵 Check Delivery to 560034",
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>(`session_${Date.now()}`);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Load live dynamic context chips on mount
  useEffect(() => {
    fetch("/api/v1/ai/context")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.quickChips) && data.quickChips.length > 0) {
          setQuickChips(data.quickChips);
        }
      })
      .catch(() => {});
  }, []);

  const handleSend = async (userText: string) => {
    if (!userText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Retrieve stored location context
      let storedCity = "Bengaluru";
      let storedPincode = "";
      try {
        const loc = localStorage.getItem("caketohome_location");
        if (loc) {
          const parsed = JSON.parse(loc);
          if (parsed.city) storedCity = parsed.city;
          if (parsed.pincode) storedPincode = parsed.pincode;
        }
      } catch (e) {}

      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          sessionId: sessionIdRef.current,
          context: {
            cityName: storedCity,
            pincode: storedPincode,
          },
        }),
      });

      const data = await res.json();

      if (data.success) {
        const aiMsg: ChatMessage = {
          id: `ai_${Date.now()}`,
          sender: "ai",
          text: data.message || "Here are our top handcrafted artisanal recommendations:",
          product_recommendations: data.products && data.products.length > 0 ? data.products : undefined,
          offers: data.offers && data.offers.length > 0 ? data.offers : undefined,
          actions: data.actions && data.actions.length > 0 ? data.actions : undefined,
          options: data.followUpQuestions && data.followUpQuestions.length > 0 ? data.followUpQuestions : quickChips.slice(0, 4),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        throw new Error(data.error || "Failed to process message.");
      }
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        sender: "ai",
        text: "I can help you explore our freshest handcrafted cakes, check delivery, or find coupons. What occasion are we celebrating?",
        options: ["🎂 Birthday Cakes", "🍫 Chocolate Cakes", "💰 Cakes Under ₹600"],
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Authoritative End-to-End Add-to-Cart using CakeToHome Core Cart API
   */
  const handleAddToCartDirect = async (
    productId: string,
    name: string,
    price: number,
    variantId?: string
  ) => {
    // 1. Prevent double clicks & rapid duplicate triggers
    if (addingMap[productId]) return;

    setAddingMap((prev) => ({ ...prev, [productId]: true }));
    setErrorMap((prev) => ({ ...prev, [productId]: null }));

    try {
      // 2. Retrieve location context from localStorage
      let storedPincode = "";
      let storedBranchId = "";
      try {
        const loc = localStorage.getItem("caketohome_location");
        if (loc) {
          const parsed = JSON.parse(loc);
          if (parsed.pincode) storedPincode = parsed.pincode;
          if (parsed.branchId || parsed.branch_id) storedBranchId = parsed.branchId || parsed.branch_id;
        }
      } catch (e) {}

      // 3. Call authoritative /api/v1/cart/items REST endpoint directly from browser
      const res = await fetch("/api/v1/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          variantId: variantId || `var_${productId}`,
          quantity: 1,
          pincode: storedPincode,
          branchId: storedBranchId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to add cake to cart.");
      }

      // 4. Update local state & trigger router refresh for server components (NavCart badge)
      setAddedItemMap((prev) => ({ ...prev, [productId]: true }));
      router.refresh();

      // 5. Dispatch global cart updated event for client subscribers
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cth_cart_updated", { detail: { productId, cart: data.cart } }));
      }

      // 6. Reset added button state after 3 seconds
      setTimeout(() => {
        setAddedItemMap((prev) => ({ ...prev, [productId]: false }));
      }, 3000);
    } catch (err: any) {
      console.error("AI Concierge Add to Cart error:", err);
      setErrorMap((prev) => ({
        ...prev,
        [productId]: err.message || "Could not add cake to cart. Please try again.",
      }));
    } finally {
      setAddingMap((prev) => ({ ...prev, [productId]: false }));
    }
  };

  return (
    <>
      {/* Floating Trigger Widget (Bottom Left) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 sm:bottom-6 left-3 sm:left-6 z-[100] flex items-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-105"
        aria-label="Open AI Cake Concierge"
      >
        <Bot className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
        <span className="text-[11px] sm:text-xs font-bold tracking-wide">AI Cake Concierge</span>
        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-400 border border-white"></span>
      </button>

      {/* Interactive Chat Dialog Modal */}
      {isOpen && (
        <div className="fixed bottom-16 sm:bottom-20 left-3 sm:left-6 z-[100] w-[calc(100vw-24px)] max-w-[390px] md:max-w-[420px] h-[520px] sm:h-[560px] bg-slate-900 border-2 border-amber-500/30 text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="p-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <Text className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                  CakeToHome AI Concierge
                  <Badge color="green" className="text-[9px]">Online</Badge>
                </Text>
                <Text className="text-[10px] text-slate-400">Live Database Connected • Multi-City</Text>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
              aria-label="Close AI Chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Scroll View */}
          <div className="flex-1 p-3.5 overflow-y-auto flex flex-col gap-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col gap-1.5 ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`p-3 rounded-2xl text-xs max-w-[88%] leading-relaxed whitespace-pre-line ${
                    msg.sender === "user"
                      ? "bg-amber-600 text-white rounded-br-none font-medium"
                      : "bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-none shadow-md"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Live Structured Product Recommendation Cards */}
                {msg.product_recommendations && msg.product_recommendations.length > 0 && (
                  <div className="flex flex-col gap-2 w-full mt-1">
                    {msg.product_recommendations.map((p) => {
                      const isAdding = addingMap[p.productId];
                      const isAdded = addedItemMap[p.productId];
                      const errorMessage = errorMap[p.productId];
                      const productHref = `/products/${p.slug || p.productId}`;

                      return (
                        <div
                          key={p.productId}
                          className="p-2.5 bg-slate-800/95 border border-slate-700/80 rounded-xl flex flex-col gap-1.5 hover:border-amber-500/50 transition-colors shadow-lg"
                        >
                          <div className="flex items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {p.thumbnail ? (
                                <img
                                  src={p.thumbnail}
                                  alt={p.name}
                                  className="w-11 h-11 rounded-lg object-cover bg-slate-700 shrink-0 border border-white/10"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-lg shrink-0">
                                  🎂
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={productHref}
                                  className="font-bold text-xs text-white hover:text-amber-400 transition-colors truncate block"
                                >
                                  {p.name}
                                </Link>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                                  <span className="text-emerald-400 font-bold">₹{p.price}</span>
                                  <span>⭐ {p.rating}</span>
                                  {p.eggless && (
                                    <span className="text-amber-400 bg-amber-950/60 px-1 rounded text-[9px] font-semibold border border-amber-500/30">
                                      Eggless
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Link
                                href={productHref}
                                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] rounded-lg transition-colors font-semibold"
                              >
                                View
                              </Link>
                              <button
                                onClick={() => handleAddToCartDirect(p.productId, p.name, p.price, p.variantId)}
                                disabled={isAdding}
                                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-sm ${
                                  isAdded
                                    ? "bg-emerald-600 text-white"
                                    : isAdding
                                    ? "bg-amber-600 text-slate-900 opacity-80 cursor-wait"
                                    : "bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950"
                                }`}
                              >
                                {isAdded ? (
                                  <>
                                    <Check className="w-3 h-3" /> Added
                                  </>
                                ) : isAdding ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Adding...
                                  </>
                                ) : (
                                  <>
                                    <ShoppingBag className="w-3 h-3" /> Add
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {errorMessage && (
                            <div className="text-[10px] text-rose-400 flex items-center gap-1 bg-rose-950/40 p-1.5 rounded-lg border border-rose-800/40">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{errorMessage}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Server Actions (Addons, Accessories, Coupon Links) */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full mt-1">
                    {msg.actions.map((act, i) => {
                      if (act.type === "ADD_TO_CART") {
                        const actProdId = act.payload?.productId;
                        const isAdding = actProdId ? addingMap[actProdId] : false;
                        const isAdded = actProdId ? addedItemMap[actProdId] : false;

                        return (
                          <div
                            key={i}
                            className="p-2 bg-slate-800/90 border border-slate-700 rounded-xl flex items-center justify-between gap-2"
                          >
                            <span className="text-xs text-slate-200 font-medium">{act.label}</span>
                            <button
                              onClick={() =>
                                handleAddToCartDirect(
                                  act.payload?.productId,
                                  act.payload?.name || "Addon",
                                  act.payload?.price || 0,
                                  act.payload?.variantId
                                )
                              }
                              disabled={isAdding}
                              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0 ${
                                isAdded
                                  ? "bg-emerald-600 text-white"
                                  : isAdding
                                  ? "bg-amber-600 text-slate-900 opacity-80 cursor-wait"
                                  : "bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950"
                              }`}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="w-3 h-3" /> Added
                                </>
                              ) : isAdding ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Adding...
                                </>
                              ) : (
                                <>
                                  <ShoppingBag className="w-3 h-3" /> Add
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      if (act.type === "APPLY_COUPON") {
                        return (
                          <button
                            key={i}
                            onClick={() => handleSend(`Apply coupon ${act.payload?.code || ""}`)}
                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-between gap-2"
                          >
                            <span className="flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5" />
                              {act.label}
                            </span>
                            <span className="text-[10px] underline">Apply</span>
                          </button>
                        );
                      }

                      if (act.type === "TRACK_ORDER") {
                        return (
                          <Link
                            key={i}
                            href={`/track?order=${act.payload?.orderId || ""}`}
                            className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-between gap-2"
                          >
                            <span className="flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5" />
                              {act.label}
                            </span>
                            <span className="text-[10px] underline">Track →</span>
                          </Link>
                        );
                      }

                      return null;
                    })}
                  </div>
                )}

                {/* Live Offer / Coupon Cards */}
                {msg.offers && msg.offers.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full mt-1">
                    {msg.offers.map((off) => (
                      <div
                        key={off.id}
                        className="p-2 bg-gradient-to-r from-amber-950/40 to-slate-800 border border-amber-500/40 rounded-xl flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <div>
                            <span className="font-mono font-bold text-xs text-amber-300">
                              {off.code}
                            </span>
                            <p className="text-[10px] text-slate-300 line-clamp-1">{off.name}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSend(`Apply coupon ${off.code}`)}
                          className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-bold rounded-md transition-colors shrink-0"
                        >
                          Apply
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Suggestion Chips */}
                {msg.options && (
                  <div className="flex flex-wrap gap-1.5 mt-1 max-w-[95%]">
                    {msg.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(opt)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500 text-amber-300 text-[11px] rounded-full transition-colors text-left"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 p-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl rounded-bl-none text-xs text-amber-400 w-fit animate-pulse">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Checking live bakery inventory & delivery slots...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-3 bg-slate-800 border-t border-slate-700 flex items-center gap-2"
          >
            <input
              placeholder="Ask for cakes, eggless, budget, or delivery..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 bg-slate-900 text-xs text-white placeholder-slate-400 px-3 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-xl transition-colors shrink-0"
              aria-label="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
