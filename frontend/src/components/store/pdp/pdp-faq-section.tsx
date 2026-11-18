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
  eyebrow?: string;
  title?: string;
}


// FAQs come from the CMS (Page Configurator -> product page -> PDP Layout -> Product FAQ) or the product itself.
export function PdpFaqSection({ customFaqs, showFaq = true, eyebrow, title }: PdpFaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = (customFaqs || []).filter((f) => f && String(f.question || "").trim() && String(f.answer || "").trim());
  if (!showFaq || faqs.length === 0) return null;

  const toggleFaq = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <section className="w-full pt-12 mt-12 border-t border-slate-200/90" aria-label="Frequently Asked Questions">
      <div className="flex flex-col gap-2 mb-8 text-center sm:text-left">
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-brand-primary flex items-center justify-center sm:justify-start gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" /> {eyebrow || "Ordering Assistance"}
        </span>
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-brand-text">
          {title || "Frequently Asked Questions"}
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
