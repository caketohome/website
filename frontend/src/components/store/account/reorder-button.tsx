"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Loader2 } from "lucide-react";

interface ReorderButtonProps {
  orderId: string;
}

export function ReorderButton({ orderId }: ReorderButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReorder = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/customer/orders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to reorder items");
      }

      router.push("/cart");
    } catch (err: any) {
      console.error("[Reorder Error]:", err);
      setErrorMsg(err.message || "Could not reorder items");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleReorder}
        disabled={loading}
        title="1-Click Reorder items into fresh cart"
        className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Reordering...
          </>
        ) : (
          <>
            <RotateCcw className="w-3.5 h-3.5" />
            Reorder
          </>
        )}
      </button>
      {errorMsg && (
        <span className="text-[10px] text-rose-400 mt-1 max-w-[150px] text-right truncate">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
