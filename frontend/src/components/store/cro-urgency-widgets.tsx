"use client";

import { useState, useEffect } from "react";
import { Flame, Clock, ShoppingBag, X, Tag, ShieldCheck, Award } from "lucide-react";
import { Badge, Button } from "@medusajs/ui";

export function LiveVisitorsBadge() {
  const [count, setCount] = useState(18);

  useEffect(() => {
    const interval = setInterval(() => {
      setCount(Math.floor(Math.random() * 14) + 16);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 rounded-lg text-xs text-amber-800 dark:text-amber-200">
      <Flame className="w-4 h-4 text-amber-500 animate-bounce" />
      <span className="font-semibold">{count} people</span> are viewing this cake right now!
    </div>
  );
}

export function CountdownUrgencyTimer() {
  const [time, setTime] = useState({ minutes: 14, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { minutes: prev.minutes - 1, seconds: 59 };
        return { minutes: 15, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-rose-500/10 to-amber-500/10 border border-rose-300 dark:border-rose-800 rounded-xl text-xs">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-rose-600 animate-spin" />
        <span className="font-medium">Order within next:</span>
      </div>
      <div className="flex items-center gap-1 font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
        <span>{String(time.minutes).padStart(2, "0")}m</span>
        <span>:</span>
        <span>{String(time.seconds).padStart(2, "0")}s</span>
      </div>
      <span className="text-[11px] text-ui-fg-subtle">for Express Delivery</span>
    </div>
  );
}

const RECENT_ORDERS = [
  { name: "Priya S.", area: "Koramangala", item: "Belgian Dark Chocolate Truffle", time: "2 min ago" },
  { name: "Anish M.", area: "Indiranagar", item: "Red Velvet Cream Cheese Heart", time: "4 min ago" },
  { name: "Sneha R.", area: "HSR Layout", item: "Mango Passion Fruit Fresh Cream", time: "6 min ago" },
];

export function RecentOrderToast() {
  const [visible, setVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setCurrentOrder(RECENT_ORDERS[index % RECENT_ORDERS.length]);
      setVisible(true);
      setTimeout(() => setVisible(false), 5000);
      index++;
    }, 14000);

    return () => clearInterval(interval);
  }, []);

  if (!visible || !currentOrder) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 p-3 bg-slate-900 border border-slate-700 text-white rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-left duration-300 max-w-xs">
      <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-lg shrink-0">
        🎂
      </div>
      <div className="flex flex-col gap-0.5 text-xs">
        <span className="font-semibold text-amber-300">{currentOrder.name} ({currentOrder.area})</span>
        <span className="text-slate-300 text-[11px]">Just ordered {currentOrder.item}</span>
        <span className="text-[9px] text-slate-400">{currentOrder.time}</span>
      </div>
      <button onClick={() => setVisible(false)} className="text-slate-400 hover:text-white p-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ExitIntentModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !sessionStorage.getItem("exit_intent_shown")) {
        setShow(true);
        sessionStorage.setItem("exit_intent_shown", "true");
      }
    };
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-amber-500/50 text-white p-6 rounded-2xl max-w-md w-full shadow-2xl relative flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        <button onClick={() => setShow(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center text-2xl mx-auto">
          🎁
        </div>

        <div className="text-center flex flex-col gap-1">
          <h3 className="font-bold text-xl text-white">Wait! Don&apos;t Leave Empty Handed!</h3>
          <p className="text-xs text-slate-300">Here is an exclusive secret 15% discount for your order today:</p>
        </div>

        <div className="p-4 bg-slate-800 border border-dashed border-amber-500 rounded-xl text-center flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Secret Coupon Code</span>
          <span className="font-mono font-bold text-2xl text-amber-400">SECRET15</span>
          <span className="text-[10px] text-emerald-400 font-medium">Valid for next 10 minutes only</span>
        </div>

        <Button onClick={() => setShow(false)} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 rounded-xl">
          Apply 15% Discount & Shop Cakes
        </Button>
      </div>
    </div>
  );
}
