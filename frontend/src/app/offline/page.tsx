"use client";

import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-800 p-6 text-center">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 border border-rose-100 flex flex-col items-center">
        <div className="w-20 h-20 bg-brand-gold-soft rounded-full flex items-center justify-center text-[#D4AF37] mb-6 animate-pulse">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-12 h-12"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.284 16.284A3 3 0 0 0 12 18.25a3 3 0 0 0 3.716-1.966m-7.432 0a3 3 0 0 1 7.432 0m-7.432 0H5.25A2.25 2.25 0 0 1 3 14.062V6.25A2.25 2.25 0 0 1 5.25 4h13.5A2.25 2.25 0 0 1 21 6.25v7.812a2.25 2.25 0 0 1-2.25 2.188h-3.034"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-2">You are Offline</h1>
        <p className="text-slate-500 text-sm mb-6">
          Your internet connection is currently unavailable. You can still browse products you&apos;ve previously loaded.
        </p>

        <div className="w-full flex flex-col gap-3">
          <Link
            href="/"
            className="w-full py-3 bg-[#1D2F5D] hover:bg-[#152347] text-white rounded-xl font-medium transition-all shadow-md shadow-rose-100 flex items-center justify-center"
          >
            Return Home
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  );
}
