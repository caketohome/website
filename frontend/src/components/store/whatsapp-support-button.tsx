"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";

export function WhatsAppSupportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const defaultNumber = "+919876500000";
  const defaultMessage = encodeURIComponent("Hello CakeToHome, I would like to inquire about cake orders and delivery.");

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-40 flex flex-col items-end font-sans">
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-24px)] max-w-72 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-4 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 text-lg">💬</span>
              <div>
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">CakeToHome Support</h4>
                <p className="text-[10px] text-emerald-600 font-semibold">● Online • Replies in &lt; 5 mins</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
            Need urgent help with an active order, custom cake design, or midnight delivery? Chat directly with our kitchen support team on WhatsApp!
          </p>

          <a
            href={`https://wa.me/${defaultNumber.replace(/\D/g, "")}?text=${defaultMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02]"
          >
            <span>Start WhatsApp Chat 📲</span>
          </a>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Contact CakeToHome on WhatsApp"
        className="w-13 h-13 p-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  );
}

export default WhatsAppSupportButton;

