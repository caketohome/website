import React from "react";
import { Sparkles, ShieldCheck, ThermometerSnowflake, Award } from "lucide-react";

interface PdpHighlightsProps {
  fssaiLicense?: string;
  showTrustBadges?: boolean;
}

export function PdpHighlights({
  fssaiLicense,
  showTrustBadges = true,
}: PdpHighlightsProps) {
  if (!showTrustBadges) return null;

  const highlights = [
    {
      icon: Sparkles,
      title: "Freshly Baked on Order",
      desc: "Baked from scratch in small micro-batches",
    },
    {
      icon: Award,
      title: "Artisanal Ingredients",
      desc: "Belgian chocolate & pure European cream",
    },
    {
      icon: ThermometerSnowflake,
      title: "Cold-Chain Vans",
      desc: "Temperature-controlled 2°C - 5°C transit",
    },
    {
      icon: ShieldCheck,
      title: "FSSAI Certified",
      desc: fssaiLicense || "Lic. No. 11223999000142",
    },
  ];

  return (
    <div data-testid="pdp-highlights" className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full py-4 border-y border-slate-200/80 my-2">
      {highlights.map((item, idx) => {
        const IconComponent = item.icon;
        return (
          <div
            key={idx}
            className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/60 border border-slate-200/60 shadow-2xs"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-blue-200 flex items-center justify-center text-[#0F172A] shrink-0 mt-0.5">
              <IconComponent className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-[#0F172A] leading-snug truncate">
                {item.title}
              </span>
              <span className="text-[11px] text-slate-500 leading-tight line-clamp-2 mt-0.5">
                {item.desc}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
