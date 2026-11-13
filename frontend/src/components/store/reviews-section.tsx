"use client";

import { useState } from "react";
import { Container, Heading, Text, Badge, Button, Input, Textarea } from "@medusajs/ui";
import { Star, ThumbsUp, CheckCircle, Sparkles, Image as ImageIcon, MessageSquare, Plus } from "lucide-react";

export function ReviewsSection() {
  const [filter, setFilter] = useState<"all" | "media" | "verified">("all");
  const [showAddReview, setShowAddReview] = useState(false);

  // Form State
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const reviews = [
    {
      id: "rev_01",
      author: "Ananya Deshmukh",
      rating: 5,
      date: "2 days ago",
      verified: true,
      headline: "Absolute perfection for my daughter's 5th birthday!",
      comment: "Ordered the Belgian Dark Chocolate Truffle. The cake was delivered right on time with express dispatch. Super moist, rich chocolate ganache, and not overly sweet!",
      image: "🎂",
      helpful: 24,
    },
    {
      id: "rev_02",
      author: "Rohan Kapoor",
      rating: 5,
      date: "4 days ago",
      verified: true,
      headline: "Best Red Velvet Cake in Bangalore hands down!",
      comment: "The cream cheese frosting was heavenly. The sponge was wonderfully moist and airy. Will definitely order again!",
      image: "❤️",
      helpful: 19,
    },
    {
      id: "rev_03",
      author: "Kavita Reddy",
      rating: 5,
      date: "1 week ago",
      verified: true,
      headline: "Express 45-minute delivery actually works!",
      comment: "Needed a last-minute office celebration cake. Ordered Pineapple Fresh Cream and it arrived within 40 minutes in Koramangala. Highly recommended!",
      image: "🍍",
      helpful: 31,
    },
  ];

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !comment.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setShowAddReview(false);
      setSubmitted(false);
      setAuthor("");
      setComment("");
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* AI Sentiment Summary Box */}
      <Container className="p-6 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-center p-3 bg-amber-500 text-slate-950 rounded-xl font-bold">
              <span className="text-2xl block">4.9</span>
              <span className="text-[10px] uppercase font-mono">Out of 5</span>
            </div>
            <div>
              <div className="flex items-center gap-1 text-amber-500 mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-500" />
                ))}
                <span className="text-xs font-bold text-ui-fg-base ml-2">Based on 1,428 Customer Reviews</span>
              </div>
              <Text className="text-xs text-ui-fg-subtle">
                98% of customers recommend CakeToHome for fresh baking, delivery punctuality, and rich flavors.
              </Text>
            </div>
          </div>

          <Button size="small" onClick={() => setShowAddReview(true)} className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shrink-0">
            <Plus className="w-4 h-4" /> Write a Review
          </Button>
        </div>

        {/* AI Sentiment Highlights */}
        <div className="mt-4 pt-4 border-t border-amber-500/20 flex flex-wrap gap-2 text-xs">
          <span className="font-semibold text-ui-fg-subtle flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> AI Sentiment Highlights:
          </span>
          <Badge color="green"> Moist & Fresh Sponge (99%)</Badge>
          <Badge color="green"> Express On-Time Delivery (98%)</Badge>
          <Badge color="green"> Premium Belgian Chocolate (98%)</Badge>
          <Badge color="purple"> Master Pastry Chef Quality (96%)</Badge>
        </div>
      </Container>

      {/* Add Review Form Modal */}
      {showAddReview && (
        <Container className="p-6 border-2 border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/20">
          <div className="flex items-center justify-between mb-4">
            <Text className="font-semibold text-base">Write Your Verified Customer Review</Text>
            <button onClick={() => setShowAddReview(false)} className="text-xs text-ui-fg-subtle hover:underline">Close</button>
          </div>

          <form onSubmit={handleAddReview} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-ui-fg-subtle mb-1 block">Your Name</label>
                <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Priya Sharma" required />
              </div>
              <div>
                <label className="text-xs font-semibold text-ui-fg-subtle mb-1 block">Rating (Stars)</label>
                <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full text-xs p-2.5 rounded border bg-ui-bg-base">
                  <option value={5}>⭐⭐⭐⭐⭐ (5 Stars — Excellent)</option>
                  <option value={4}>⭐⭐⭐⭐ (4 Stars — Very Good)</option>
                  <option value={3}>⭐⭐⭐ (3 Stars — Average)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-ui-fg-subtle mb-1 block">Your Detailed Experience & Taste Review</label>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Describe the cake texture, taste, delivery speed, and celebration..." required />
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowAddReview(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">
                Submit Verified Review
              </Button>
            </div>
            {submitted && <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded">✓ Review submitted for instant publication!</div>}
          </form>
        </Container>
      )}

      {/* Review Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button size="small" variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>
          All Reviews (1,428)
        </Button>
        <Button size="small" variant={filter === "media" ? "primary" : "secondary"} onClick={() => setFilter("media")}>
          With Photos & Videos (482)
        </Button>
        <Button size="small" variant={filter === "verified" ? "primary" : "secondary"} onClick={() => setFilter("verified")}>
          Verified Buyers (1,390)
        </Button>
      </div>

      {/* Review List Cards */}
      <div className="flex flex-col gap-4">
        {reviews.map((r) => (
          <Container key={r.id} className="p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Text className="font-semibold text-sm">{r.author}</Text>
                {r.verified && (
                  <Badge color="green" className="flex items-center gap-1 text-[10px]">
                    <CheckCircle className="w-3 h-3" /> Verified Buyer
                  </Badge>
                )}
              </div>
              <Text className="text-xs text-ui-fg-subtle">{r.date}</Text>
            </div>

            <div className="flex items-center gap-1 text-amber-500">
              {[...Array(r.rating)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-500" />
              ))}
            </div>

            <Text className="font-semibold text-sm">{r.headline}</Text>
            <Text className="text-xs text-ui-fg-subtle leading-relaxed">{r.comment}</Text>

            <div className="flex items-center justify-between pt-2 border-t text-xs text-ui-fg-muted">
              <span className="text-2xl">{r.image}</span>
              <button className="flex items-center gap-1.5 hover:text-ui-fg-base text-xs">
                <ThumbsUp className="w-3.5 h-3.5" /> Helpful ({r.helpful})
              </button>
            </div>
          </Container>
        ))}
      </div>
    </div>
  );
}
