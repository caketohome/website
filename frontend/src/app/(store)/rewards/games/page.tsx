import { Heading, Text, Container } from "@medusajs/ui";
import { SpinWheel, ScratchCard, LuckyDraw } from "@frontend/components/store/marketing/gamification-widgets";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Games & Rewards — CakeToHome",
    description:
        "Spin the wheel, scratch cards, and lucky draws. Win coupons and free cakes at CakeToHome.",
};

/**
 * Gamification page — Phase 9.2 storefront route.
 *
 * Hosts the spin wheel, scratch card, and lucky draw widgets. The prize config
 * is hardcoded here as a sensible default; in production it would be fetched
 * from the active campaign config. Each play calls
 * /store/marketing/gamification/play, which records the outcome and enforces
 * the daily play limit.
 */
export default function GamesPage() {
    // Default prize config — in production this would come from the campaign.
    const spinPrizes = [
        { label: "10% off coupon", weight: 30, outcome: "win" as const, reward_value: 10 },
        { label: "Free delivery", weight: 20, outcome: "win" as const, reward_value: 0 },
        { label: "₹50 wallet credit", weight: 10, outcome: "win" as const, reward_value: 50 },
        { label: "Try again", weight: 40, outcome: "retry" as const },
    ];
    const scratchPrizes = [
        { label: "20% off coupon", weight: 25, outcome: "win" as const, reward_value: 20 },
        { label: "Free cupcake", weight: 15, outcome: "win" as const },
        { label: "Better luck next time", weight: 60, outcome: "lose" as const },
    ];
    const luckyPrizes = [
        { label: "Free cake worth ₹500", weight: 5, outcome: "win" as const, reward_value: 500 },
        { label: "₹100 wallet credit", weight: 15, outcome: "win" as const, reward_value: 100 },
        { label: "No luck this time", weight: 80, outcome: "lose" as const },
    ];

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto px-4 py-8">
            <div className="flex flex-col gap-2">
                <Heading level="h1">Games & Rewards</Heading>
                <Text className="text-ui-fg-subtle">
                    Play daily to win coupons, free cakes, and wallet credits. One play per widget per day.
                </Text>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SpinWheel name="Daily Spin" prizes={spinPrizes} dailyLimit={1} />
                <ScratchCard name="Scratch & Win" prizes={scratchPrizes} dailyLimit={1} />
                <LuckyDraw name="Lucky Draw" prizes={luckyPrizes} dailyLimit={1} />
            </div>

            <Container className="p-4 bg-ui-bg-subtle">
                <Text className="text-ui-fg-subtle text-sm">
                    🎁 Rewards are issued as coupon codes via the M2 Rules Engine. Apply them at checkout.
                    Daily limits prevent abuse. Full AI-powered prize personalization arrives in a later milestone.
                </Text>
            </Container>
        </div>
    );
}
