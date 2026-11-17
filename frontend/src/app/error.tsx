"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Error Boundary caught error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] bg-slate-50 text-slate-800 p-6 text-center">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-rose-100 flex flex-col items-center">
        <div className="w-16 h-16 bg-brand-gold-soft rounded-full flex items-center justify-center text-brand-gold mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-10 h-10"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong!</h2>
        <p className="text-slate-500 text-sm mb-6">
          {error?.message || "An unexpected error occurred while loading this page."}
        </p>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full py-3 bg-brand-navy hover:bg-brand-deep text-white rounded-xl font-medium transition-all shadow-md shadow-rose-100"
          >
            Try Again
          </button>
          <a
            href="/"
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all text-center"
          >
            Return to Homepage
          </a>
        </div>
      </div>
    </div>
  );
}
