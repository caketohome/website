"use client";

import React from "react";
import { Button, Text } from "@medusajs/ui";

export interface ErrorComponentProps {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorComponent({
  title = "An error occurred",
  message,
  onRetry,
  onDismiss,
  className = "",
  compact = false,
}: ErrorComponentProps) {
  if (!message) return null;

  if (compact) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`flex items-center justify-between gap-3 p-3 bg-brand-gold-soft dark:bg-[#0c1326]/80 border border-[#D4AF37]/30 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-200 text-xs font-medium ${className}`}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-[#1D2F5D] dark:text-[#D4AF37] shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{message}</span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[#D4AF37] hover:text-[#152347] dark:hover:text-rose-300 font-bold ml-auto"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`p-4 bg-brand-gold-soft dark:bg-[#0c1326]/50 border border-[#D4AF37]/30 dark:border-rose-800 rounded-xl text-rose-900 dark:text-rose-100 flex flex-col gap-3 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-brand-gold-soft dark:bg-rose-900/80 rounded-full text-[#1D2F5D] dark:text-rose-300 shrink-0 mt-0.5">
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-rose-950 dark:text-rose-100 mb-0.5">
            {title}
          </h4>
          <Text className="text-xs text-rose-800 dark:text-rose-200">
            {message}
          </Text>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-[#D4AF37] hover:text-[#1D2F5D] dark:hover:text-rose-200 transition-colors p-1"
            aria-label="Close error notification"
          >
            ✕
          </button>
        )}
      </div>

      {onRetry && (
        <div className="flex justify-end pt-1">
          <Button
            type="button"
            variant="secondary"
            size="small"
            onClick={onRetry}
            className="text-xs font-semibold border-[#D4AF37]/40 hover:bg-brand-gold-soft"
          >
            🔄 Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
