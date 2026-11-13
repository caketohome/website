"use client";

import { useState } from "react";
import { MessageCircle, X, PhoneCall } from "lucide-react";

export function WhatsAppSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const defaultNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "+919567789888";
  const formattedNumber = "+91 95677 89888";
  const defaultMessage = encodeURIComponent("Hello CakeToHome, I would like to inquire about cake orders and delivery.");
  const cleanNumber = defaultNumber.replace(/\D/g, "");

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 right-3 sm:right-6 z-40 flex flex-col items-end font-sans">
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-24px)] max-w-72 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 text-lg">💬</span>
              <div>
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">CakeToHome WhatsApp</h4>
                <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  {formattedNumber}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Close WhatsApp card"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
            Need urgent help with an active order, custom cake design, or scheduled delivery? Chat directly with our kitchen support team on WhatsApp!
          </p>

          <a
            href={`https://wa.me/${cleanNumber}?text=${defaultMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Chat on WhatsApp ({formattedNumber})</span>
          </a>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Contact CakeToHome on WhatsApp: 9567789888"
        className="w-13 h-13 p-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group relative"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="sr-only">WhatsApp: {formattedNumber}</span>
      </button>
    </div>
  );
}

export default WhatsAppSupportButton;

