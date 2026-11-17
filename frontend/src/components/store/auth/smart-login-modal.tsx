"use client";

import React, { useState, useEffect } from "react";
import { OtpLoginForm } from "./otp-login-form";
import { CakeToHomeLogo } from "@frontend/components/common/logo";

export interface SmartLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  intentAction?: string;
  redirectUrl?: string;
  onSuccess?: (user: any) => void;
}

export function SmartLoginModal({
  isOpen,
  onClose,
  title = "Welcome to CakeToHome",
  subtitle = "Sign in with your mobile number to unlock fresh baked discounts, saved addresses, and express checkout.",
  intentAction,
  redirectUrl,
  onSuccess,
}: SmartLoginModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-login-modal-title"
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-brand-gold/20 overflow-hidden transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-white border-b border-brand-border px-6 py-4 text-brand-navy">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CakeToHomeLogo variant="white" mode="symbol" width={28} height={28} />
              <h2 id="smart-login-modal-title" className="text-lg font-serif font-semibold tracking-tight text-brand-navy">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1.5 text-brand-text-muted hover:text-brand-navy hover:bg-brand-surface-muted transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {intentAction && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-light text-brand-primary">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Resume: {intentAction.replace(/_/g, " ")}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {subtitle && (
            <p className="text-sm text-brand-text-muted mb-6 text-center leading-relaxed">
              {subtitle}
            </p>
          )}

          <OtpLoginForm
            intentAction={intentAction}
            redirectUrl={redirectUrl}
            isModal={true}
            onSuccess={(user) => {
              if (onSuccess) onSuccess(user);
              onClose();
            }}
            onClose={onClose}
          />

          <div className="mt-6 pt-4 border-t border-brand-border text-center text-xs text-brand-text-muted">
            🔒 Fast & Secure Login • No Password Required
          </div>
        </div>
      </div>
    </div>
  );
}
