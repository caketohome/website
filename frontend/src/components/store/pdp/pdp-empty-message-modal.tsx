"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MessageSquare, ArrowRight, Loader2 } from "lucide-react";

interface PdpEmptyMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customMessage?: string) => void;
  onAddMessageClick: () => void;
  cartLoading?: boolean;
  cakeMessage?: string;
  onCakeMessageChange?: (msg: string) => void;
}

export function PdpEmptyMessageModal({
  isOpen,
  onClose,
  onConfirm,
  onAddMessageClick,
  cartLoading = false,
  cakeMessage = "",
  onCakeMessageChange,
}: PdpEmptyMessageModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const trimmedMsg = (cakeMessage || "").trim();
  const hasTypedMessage = trimmedMsg.length > 0;

  const modalContent = (
    <div
      id="empty-message-confirmation-modal"
      data-testid="cake-message-reminder-modal"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="empty-msg-dialog-title"
      aria-describedby="empty-msg-dialog-desc"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="empty-message-confirmation-card"
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close confirmation dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl shrink-0 shadow-inner">
            🎂
          </div>
          <div className="flex flex-col">
            <h3 id="empty-msg-dialog-title" className="text-lg font-black text-slate-900 leading-snug">
              Add cake without a message?
            </h3>
            <span className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
              Optional Personalization
            </span>
          </div>
        </div>

        <p id="empty-msg-dialog-desc" className="text-sm text-slate-600 leading-relaxed">
          A customized message piped on top of the cake is complimentary (up to 30 characters). Would you like to write a message now, or continue without one?
        </p>

        {onCakeMessageChange && (
          <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label
                htmlFor="modal-cake-message-input"
                className="text-xs font-bold text-slate-700 flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Message on Cake (Optional)</span>
              </label>
              <span
                data-testid="modal-cake-message-counter"
                className={`text-[11px] font-bold ${
                  (cakeMessage || "").length >= 30 ? "text-amber-600" : "text-slate-500"
                }`}
              >
                {(cakeMessage || "").length}/30
              </span>
            </div>
            <input
              id="modal-cake-message-input"
              data-testid="modal-cake-message-input"
              type="text"
              maxLength={30}
              value={cakeMessage}
              onChange={(e) => onCakeMessageChange(e.target.value.slice(0, 30))}
              placeholder="e.g. Happy Birthday Maya! 🎂"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            id="btn-add-message-focus"
            data-testid="cake-message-reminder-write-btn"
            type="button"
            disabled={cartLoading}
            onClick={onAddMessageClick}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-800 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Add Message</span>
          </button>

          <button
            id="btn-confirm-add-to-cart"
            data-testid="cake-message-reminder-skip-btn"
            type="button"
            disabled={cartLoading}
            onClick={() => onConfirm(hasTypedMessage ? trimmedMsg : undefined)}
            className="flex-1 py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            {cartLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>{hasTypedMessage ? "Add with Message" : "Continue"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
