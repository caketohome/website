"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Bot, Send, X, Sparkles, ShoppingBag, Check, Zap, Heart } from "lucide-react";
import { Badge, Button, Text } from "@medusajs/ui";
import { Link } from "next-view-transitions";

export interface ChatMessage {
  id: string;
  sender: "ai" | "user";
  text: string;
  options?: string[];
  product_recommendations?: Array<{
    name: string;
    price: number;
    image: string;
    slug: string;
    rating: string;
  }>;
}

export function AiChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_welcome",
      sender: "ai",
      text: "👋 Hi! I'm your CakeToHome AI Sommelier. What occasion are we celebrating today?",
      options: [
        "🎂 Birthday Celebration",
        "💖 Anniversary / Romantic",
        "🍫 Top Chocolate Cakes",
        "💰 Cakes Under ₹600",
        "🛵 Check Delivery Time",
      ],
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = (userText: string) => {
    if (!userText.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Simulate AI Concierge Natural Intelligence
    setTimeout(() => {
      let aiText = "I found some incredible fresh-baked artisanal cakes perfect for you!";
      let recs: any[] = [];
      let options: string[] = [];

      const query = userText.toLowerCase();

      if (query.includes("birthday") || query.includes("celebrating")) {
        aiText = "🎉 Happy Birthday! Here are our top-rated birthday cakes baked fresh today with midnight surprise delivery available:";
        recs = [
          { name: "Belgian Dark Chocolate Truffle", price: 699, rating: "4.9 ⭐", slug: "belgian-dark-chocolate-truffle", image: "🍫" },
          { name: "Red Velvet Cream Cheese Heart", price: 799, rating: "4.8 ⭐", slug: "red-velvet-cream-cheese", image: "❤️" },
        ];
        options = ["🍰 Make it 100% Eggless", "🌙 Add Midnight Surprise Delivery", "🏷️ Apply CAKE50 Coupon"];
      } else if (query.includes("anniversary") || query.includes("romantic")) {
        aiText = "💖 Celebrating love! Our Red Velvet Heart and Berry Royale are customer favorites for anniversaries:";
        recs = [
          { name: "Red Velvet Heart Cake", price: 849, rating: "5.0 ⭐", slug: "red-velvet-heart", image: "❤️" },
          { name: "Ferrero Rocher Rocher Luxe", price: 1199, rating: "4.9 ⭐", slug: "ferrero-rocher-luxe", image: "🌰" },
        ];
        options = ["🎁 Add Gift Wrapping", "💌 Add Custom Romantic Card Message"];
      } else if (query.includes("under") || query.includes("budget") || query.includes("600") || query.includes("500")) {
        aiText = "💰 Here are our top budget-friendly artisanal cakes under ₹600 with free same-day delivery:";
        recs = [
          { name: "Pineapple Fresh Cream Delight", price: 499, rating: "4.7 ⭐", slug: "pineapple-fresh-cream", image: "🍍" },
          { name: "Classic Butterscotch Crunch", price: 549, rating: "4.8 ⭐", slug: "classic-butterscotch-crunch", image: "✨" },
        ];
        options = ["🛵 Check 45-Min Express Delivery", "🏷️ View Active Coupons"];
      } else if (query.includes("track") || query.includes("order")) {
        aiText = "🚚 Your recent order CTH-2026-8812 is currently IN_TRANSIT with Rahul Kumar (🛵 DLP-01). Expected arrival in 18 minutes!";
        options = ["📞 Call Delivery Agent", "🏠 View Live Map Tracking"];
      } else if (query.includes("delivery") || query.includes("time") || query.includes("koramangala")) {
        aiText = "⚡ Great news! Hyperlocal 45-minute express delivery is active in your area (Koramangala 560034).";
        options = ["🎂 Browse Express Cakes", "🌙 Book Midnight Slot"];
      } else {
        aiText = "I recommend our top signature creations crafted with premium ingredients and 2-hour fresh delivery:";
        recs = [
          { name: "Belgian Dark Chocolate Truffle", price: 699, rating: "4.9 ⭐", slug: "belgian-dark-chocolate-truffle", image: "🍫" },
          { name: "Mango Passion Fruit Fresh Cream", price: 749, rating: "4.8 ⭐", slug: "mango-passion-fruit", image: "🥭" },
        ];
        options = ["🎂 Find Cake by Occasion", "💰 Find Cake by Budget"];
      }

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "ai",
        text: aiText,
        product_recommendations: recs.length > 0 ? recs : undefined,
        options: options.length > 0 ? options : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
    }, 600);
  };

  return (
    <>
      {/* Floating Trigger Widget */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-105"
      >
        <Bot className="w-5 h-5 animate-pulse" />
        <span className="text-xs font-bold tracking-wide">AI Cake Assistant</span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white"></span>
      </button>

      {/* Interactive Chat Dialog Modal */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[360px] md:w-[400px] h-[520px] bg-slate-900 border-2 border-amber-500/30 text-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <Text className="font-bold text-sm text-white flex items-center gap-1.5">
                  CakeToHome AI Concierge
                  <Badge color="green" className="text-[9px]">Online</Badge>
                </Text>
                <Text className="text-[10px] text-slate-400">Powered by CakeToHome AI Engine</Text>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Scroll View */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col gap-1.5 ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-amber-600 text-white rounded-br-none"
                      : "bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Product Recommendation Cards */}
                {msg.product_recommendations && (
                  <div className="flex flex-col gap-2 w-full mt-1">
                    {msg.product_recommendations.map((p, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-800/90 border border-slate-700 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{p.image}</span>
                          <div>
                            <Text className="font-semibold text-xs text-white">{p.name}</Text>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span className="text-emerald-400 font-bold">₹{p.price}</span>
                              <span>{p.rating}</span>
                            </div>
                          </div>
                        </div>
                        <Link
                          href={`/products`}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-lg transition-colors shrink-0"
                        >
                          Order Now
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Action Suggestion Chips */}
                {msg.options && (
                  <div className="flex flex-wrap gap-1.5 mt-1 max-w-[90%]">
                    {msg.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(opt)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500 text-amber-300 text-[11px] rounded-full transition-colors"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
              placeholder="Ask AI for cake recommendations, budget, or order..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-slate-900 text-xs text-white placeholder-slate-400 px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="p-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
