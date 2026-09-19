"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Sparkles, MapPin, Tag, Truck } from "lucide-react";
import { Badge, Text } from "@medusajs/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

  const [quickChips, setQuickChips] = useState<string[]>([
    "🎂 Birthday Cakes",
    "💖 Anniversary Specials",
    "🍫 Belgian Chocolate Truffle",
    "💰 Cakes Under ₹600",
    "🍓 Fresh Strawberry Cake",
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
        "🍓 Fresh Fruit Cakes",
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
        setMessages((prev) => [
          ...prev,
          {
            id: `ai_err_${Date.now()}`,
            sender: "ai",
            text: "I had a moment connecting to the bakery kitchens. Would you like to try searching by flavour or budget?",
            options: quickChips.slice(0, 4),
          },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_net_err_${Date.now()}`,
          sender: "ai",
          text: "I encountered a network hiccup. Please try asking again!",
          options: quickChips.slice(0, 3),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Concierge Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 left-3 sm:left-6 z-50 flex items-center gap-2 px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs sm:text-sm rounded-full shadow-2xl hover:shadow-amber-500/30 transition-all hover:scale-105 active:scale-95 group"
          aria-label="Open AI Bakery Concierge"
        >
          <div className="w-5 h-5 rounded-full bg-slate-950/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
          </div>
          <span>AI Cake Sommelier</span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-950"></span>
          </span>
        </button>
      )}

      {/* Interactive Chat Dialog Modal */}
      {isOpen && (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-20 left-3 sm:left-6 z-[100] w-[calc(100vw-24px)] max-w-[390px] md:max-w-[420px] h-[520px] sm:h-[560px] bg-slate-900 border-2 border-amber-500/30 text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
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

                {/* View-Only Structured Product Recommendation Cards */}
                {msg.product_recommendations && msg.product_recommendations.length > 0 && (
                  <div className="flex flex-col gap-2 w-full mt-1">
                    {msg.product_recommendations.map((p) => {
                      const productHref = `/products/${p.slug || p.productId}`;

                      return (
                        <div
                          key={p.productId}
                          className="p-2.5 bg-slate-800/95 border border-slate-700/80 rounded-xl flex items-center justify-between gap-2.5 hover:border-amber-500/50 transition-colors shadow-lg"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {p.thumbnail ? (
                              <img
                                src={p.thumbnail}
                                alt={p.name}
                                className="w-12 h-12 rounded-lg object-cover bg-slate-700 shrink-0 border border-white/10"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-center justify-center text-lg shrink-0">
                                🎂
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <Link
                                href={productHref}
                                onClick={() => setIsOpen(false)}
                                className="font-bold text-xs text-white hover:text-amber-400 transition-colors truncate block"
                              >
                                {p.name}
                              </Link>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span className="text-emerald-400 font-bold">₹{p.price}</span>
                                {p.rating && <span>⭐ {p.rating}</span>}
                              </div>
                            </div>
                          </div>

                          {/* View Only Button navigating to product page */}
                          <div className="shrink-0">
                            <Link
                              href={productHref}
                              onClick={() => setIsOpen(false)}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-[11px] rounded-lg transition-all font-bold flex items-center gap-1 shadow-sm"
                            >
                              View →
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Server Actions (Coupon Links, Track Order) */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full mt-1">
                    {msg.actions.map((act, i) => {
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
                            onClick={() => setIsOpen(false)}
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
              placeholder="Ask for cakes, flavours, budget, or delivery..."
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

export default AiChatAssistant;
