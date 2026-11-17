"use client";

import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

interface PdpFaqSectionProps {
  customFaqs?: FaqItem[];
  showFaq?: boolean;
}

const DEFAULT_FAQS: FaqItem[] = [
  {
    question: "Are all CakeToHome cakes freshly baked on order?",
    answer:
      "Yes, absolutely. We do not store or pre-freeze baked cakes. Every single cake is freshly baked from scratch in small batches by our master pâtissiers within hours of your scheduled delivery time.",
  },
  {
    question: "Can I get this cake made 100% eggless?",
    answer:
      "Yes. Most of our cakes are prepared eggless by default or offer an eggless toggle. We use premium natural substitutes to achieve the exact same moist, airy, and velvety crumb.",
  },
  {
    question: "How does temperature-controlled delivery work?",
    answer:
      "Our cakes travel exclusively in air-conditioned, temperature-controlled delivery vans maintained between 2°C and 5°C. This ensures that intricate frosting, delicate mousse, and ganache arrive in pristine condition without melting.",
  },
  {
    question: "How far in advance should I place my order?",
    answer:
      "For standard sizes (0.5 kg to 1.5 kg), same-day delivery is available if ordered before the daily cutoff. For tiered, photo, or special celebration cakes, we recommend ordering 24 hours in advance.",
  },
  {
    question: "How should I store the cake after delivery?",
    answer:
      "Keep the cake refrigerated at 2°C to 5°C in its original box to preserve moisture. For the best flavor and silky texture, remove the cake from the refrigerator 15-20 minutes before cutting and serving.",
  },
];

export function PdpFaqSection({ customFaqs, showFaq = true }: PdpFaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!showFaq) return null;

  const faqs = customFaqs && customFaqs.length > 0 ? customFaqs : DEFAULT_FAQS;

  const toggleFaq = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <section className="w-full pt-12 mt-12 border-t border-slate-200/90" aria-label="Frequently Asked Questions">
      <div className="flex flex-col gap-2 mb-8 text-center sm:text-left">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-primary flex items-center justify-center sm:justify-start gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" /> Ordering Assistance
        </span>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-brand-text">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="flex flex-col gap-3 max-w-4xl">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs transition-all"
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                aria-expanded={isOpen}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-brand-text text-sm sm:text-base hover:bg-slate-50 transition-colors"
              >
                <span>{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-brand-text" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-slate-100 animate-in fade-in duration-200">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
