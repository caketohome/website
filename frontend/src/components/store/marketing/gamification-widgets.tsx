"use client";

import { useState } from "react";
import {
    clientPlayGamification,
    clientRedeemGamificationReward,
} from "@frontend/lib/data/marketing-toolkit-client";

/**
 * Gamification Widgets — Phase 9.2 storefront components.
 *
 * Spin Wheel, Scratch Card, and Lucky Draw. Each widget calls
 * /store/marketing/gamification/play, which picks a prize via weighted random
 * selection and records the outcome. The actual reward issuance (coupon code,
 * wallet credit, etc.) flows through the M2 Rules Engine — these widgets only
 * surface the play + reveal UX.
 *
 * The `prizes` prop is the prize config (label, weight, offer_id, coupon_code,
 * reward_value, outcome). In production this would be fetched from a campaign
 * config; here it's passed in so the widget is reusable across campaigns.
 */

interface Prize {
    label: string;
    weight: number;
    offer_id?: string;
    coupon_code?: string;
    reward_value?: number;
    outcome?: "win" | "lose" | "retry";
}

// ── Spin Wheel ────────────────────────────────────────────────────────────────

export function SpinWheel({
    name = "Spin the Wheel",
    prizes,
    customerId,
    sessionId,
    dailyLimit,
}: {
    name?: string;
    prizes: Prize[];
    customerId?: string;
    sessionId?: string;
    dailyLimit?: number;
}) {
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSpin = async () => {
        setSpinning(true);
        setError(null);
        setResult(null);
        try {
            const res = await clientPlayGamification({
                widget_type: "spin_wheel",
                name,
                prizes,
                customer_id: customerId,
                session_id: sessionId,
                daily_limit: dailyLimit,
            });
            if (res.message) throw new Error(res.message);
            setResult(res.reward);
        } catch (e: any) {
            setError(e.message ?? "Spin failed.");
        } finally {
            setSpinning(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-purple-50 to-[#FDFBF7]">
            <h3 className="text-lg font-bold">🎡 {name}</h3>
            <button
                onClick={handleSpin}
                disabled={spinning}
                className="w-24 h-24 rounded-full bg-gradient-to-r from-purple-600 to-[#D4AF37] text-white text-sm font-bold flex items-center justify-center shadow-lg hover:scale-105 transition disabled:opacity-50"
            >
                {spinning ? "Spinning…" : "SPIN"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {result && (
                <div className="text-center">
                    <p className="text-sm font-semibold">
                        {result.outcome === "win"
                            ? "🎉 You won:"
                            : result.outcome === "retry"
                            ? "🔄 Try again!"
                            : "😢 Better luck next time!"}
                    </p>
                    {result.reward_label && (
                        <p className="text-lg font-bold text-purple-700">
                            {result.reward_label}
                        </p>
                    )}
                    {result.coupon_code && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-white border border-dashed border-purple-400 font-mono font-bold">
                            {result.coupon_code}
                        </div>
                    )}
                    {result.outcome === "win" && (
                        <button
                            onClick={async () => {
                                await clientRedeemGamificationReward(result.id);
                                setResult({ ...result, redeemed: true });
                            }}
                            disabled={result.redeemed}
                            className="mt-2 px-3 py-1 rounded-lg bg-purple-600 text-white text-xs font-semibold disabled:opacity-50"
                        >
                            {result.redeemed ? "Redeemed ✓" : "Claim Reward"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Scratch Card ──────────────────────────────────────────────────────────────

export function ScratchCard({
    name = "Scratch & Win",
    prizes,
    customerId,
    sessionId,
    dailyLimit,
}: {
    name?: string;
    prizes: Prize[];
    customerId?: string;
    sessionId?: string;
    dailyLimit?: number;
}) {
    const [scratching, setScratching] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleScratch = async () => {
        setScratching(true);
        setError(null);
        try {
            const res = await clientPlayGamification({
                widget_type: "scratch_card",
                name,
                prizes,
                customer_id: customerId,
                session_id: sessionId,
                daily_limit: dailyLimit,
            });
            if (res.message) throw new Error(res.message);
            setResult(res.reward);
            setRevealed(true);
        } catch (e: any) {
            setError(e.message ?? "Scratch failed.");
        } finally {
            setScratching(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50">
            <h3 className="text-lg font-bold">🎟️ {name}</h3>
            <div
                className="relative w-48 h-32 rounded-lg overflow-hidden cursor-pointer"
                onClick={handleScratch}
            >
                <div
                    className={`absolute inset-0 flex items-center justify-center bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-semibold transition-opacity ${
                        revealed ? "opacity-0" : "opacity-100"
                    }`}
                >
                    {scratching ? "Scratching…" : "Tap to scratch"}
                </div>
                {revealed && result && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
                        <p className="text-sm font-bold">
                            {result.outcome === "win"
                                ? "🎉 You won!"
                                : "😢 No luck"}
                        </p>
                        {result.reward_label && (
                            <p className="text-sm text-orange-600 font-semibold">
                                {result.reward_label}
                            </p>
                        )}
                        {result.coupon_code && (
                            <p className="font-mono text-xs font-bold mt-1">
                                {result.coupon_code}
                            </p>
                        )}
                    </div>
                )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
}

// ── Lucky Draw ────────────────────────────────────────────────────────────────

export function LuckyDraw({
    name = "Lucky Draw",
    prizes,
    customerId,
    sessionId,
    dailyLimit,
}: {
    name?: string;
    prizes: Prize[];
    customerId?: string;
    sessionId?: string;
    dailyLimit?: number;
}) {
    const [drawing, setDrawing] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDraw = async () => {
        setDrawing(true);
        setError(null);
        setResult(null);
        try {
            const res = await clientPlayGamification({
                widget_type: "lucky_draw",
                name,
                prizes,
                customer_id: customerId,
                session_id: sessionId,
                daily_limit: dailyLimit,
            });
            if (res.message) throw new Error(res.message);
            setResult(res.reward);
        } catch (e: any) {
            setError(e.message ?? "Draw failed.");
        } finally {
            setDrawing(false);
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50">
            <h3 className="text-lg font-bold">🎯 {name}</h3>
            <button
                onClick={handleDraw}
                disabled={drawing}
                className="px-6 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:scale-105 transition disabled:opacity-50"
            >
                {drawing ? "Drawing…" : "Draw a Ticket"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {result && (
                <div className="text-center">
                    <p className="text-sm font-semibold">
                        {result.outcome === "win"
                            ? "🎉 Lucky winner!"
                            : "😢 Not this time"}
                    </p>
                    {result.reward_label && (
                        <p className="text-lg font-bold text-blue-700">
                            {result.reward_label}
                        </p>
                    )}
                    {result.coupon_code && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-white border border-dashed border-blue-400 font-mono font-bold">
                            {result.coupon_code}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
