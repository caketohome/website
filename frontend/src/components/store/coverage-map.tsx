"use client";

import { useState } from "react";
import { Container, Heading, Text, Badge, Button, Input } from "@medusajs/ui";
import { SERVICEABLE_ZONES, checkDeliveryAvailability } from "@frontend/lib/data/deliveries";
import { MapPin, Zap, Moon, CheckCircle2, XCircle, Search, ShieldCheck, Navigation } from "lucide-react";

export function DeliveryCoverageMap() {
    const [pincode, setPincode] = useState("");
    const [result, setResult] = useState<any>(null);
    const [checking, setChecking] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<string>("koramangala");

    const handleCheckPincode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pincode.trim()) return;
        setChecking(true);
        const res = await checkDeliveryAvailability(pincode);
        setResult(res);
        setChecking(false);
    };

    const branches = [
        { id: "koramangala", name: "🎂 Koramangala Hub", cx: 220, cy: 190, radius: 90, express: true, pincodes: ["560034", "560095", "560102", "560076", "560103"] },
        { id: "indiranagar", name: "🍰 Indiranagar Studio", cx: 340, cy: 130, radius: 75, express: true, pincodes: ["560038", "560001"] },
        { id: "whitefield", name: "🧁 Whitefield Hub", cx: 480, cy: 220, radius: 110, express: false, pincodes: ["560066"] },
    ];

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Heading level="h2" className="text-xl">🗺️ Bakery Delivery Coverage & Pincode Checker</Heading>
                    <Text className="text-ui-fg-subtle text-sm">Interactive map showing active bakery hubs, delivery radius zones, and pincode limitations.</Text>
                </div>
                <Badge color="green" className="w-fit">Max Delivery Radius: 20 KM</Badge>
            </div>

            {/* Pincode Lookup Bar */}
            <Container className="p-6 border-2 border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10">
                <form onSubmit={handleCheckPincode} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-ui-fg-subtle mb-1 block">
                            Check Your Pincode / Delivery Area
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
                            <Input
                                placeholder="Enter 6-digit Pincode (e.g. 560034, 560038, 560102)"
                                value={pincode}
                                onChange={(e) => setPincode(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <Button type="submit" isLoading={checking} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        Check Availability
                    </Button>
                </form>

                {/* Serviceability Result Box */}
                {result && (
                    <div className={`mt-4 p-4 rounded-lg border ${result.serviceable ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300" : "bg-rose-50 dark:bg-rose-950/40 border-rose-300"}`}>
                        <div className="flex items-start gap-3">
                            {result.serviceable ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <div className="flex flex-col gap-1">
                                <Text className="font-semibold text-sm">
                                    {result.serviceable ? "✓ Serviceable Delivery Location" : "❌ Out of Current Delivery Coverage"}
                                </Text>
                                <Text className="text-xs">{result.message}</Text>

                                {result.serviceable && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <Badge color="blue">Delivery Fee: ₹{result.delivery_fee}</Badge>
                                        {result.express_available && (
                                            <Badge color="green" className="flex items-center gap-1">
                                                <Zap className="w-3 h-3" /> ⚡ 45-Min Express Ready
                                            </Badge>
                                        )}
                                        {result.midnight_available && (
                                            <Badge color="purple" className="flex items-center gap-1">
                                                <Moon className="w-3 h-3" /> 🌙 Midnight Surprise Eligible
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Container>

            {/* Interactive SVG Delivery Coverage Map */}
            <Container className="p-6 flex flex-col gap-4 overflow-hidden">
                <div className="flex items-center justify-between">
                    <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">
                        Live Delivery Coverage Map (Metro Bangalore Tiers)
                    </Text>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500 inline-block"></span> 5 km Express Circle</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500 inline-block"></span> 10 km Standard Circle</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500/10 border border-amber-500 inline-block"></span> Extended Zone</span>
                    </div>
                </div>

                <div className="relative w-full h-[360px] bg-slate-900 rounded-xl overflow-hidden border shadow-inner flex items-center justify-center">
                    {/* SVG Map Canvas */}
                    <svg className="w-full h-full" viewBox="0 0 650 360">
                        {/* Grid lines */}
                        <defs>
                            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />

                        {/* Outer Extended Metro Boundary Polyline */}
                        <polygon points="120,60 410,40 590,140 560,320 280,330 110,240" fill="none" stroke="rgba(251, 191, 36, 0.2)" strokeWidth="2" strokeDasharray="6 4" />

                        {/* Coverage Circles for each Hub */}
                        {branches.map((b) => {
                            const isSelected = selectedBranch === b.id;
                            return (
                                <g key={b.id} onClick={() => setSelectedBranch(b.id)} className="cursor-pointer">
                                    {/* Radial Zone Circle */}
                                    <circle
                                        cx={b.cx}
                                        cy={b.cy}
                                        r={b.radius}
                                        fill={b.express ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.12)"}
                                        stroke={isSelected ? "#10b981" : b.express ? "rgba(16, 185, 129, 0.6)" : "rgba(59, 130, 246, 0.5)"}
                                        strokeWidth={isSelected ? "3" : "1.5"}
                                    />
                                    {/* Branch Hub Center Marker */}
                                    <circle cx={b.cx} cy={b.cy} r="10" fill="#f59e0b" className="animate-pulse" />
                                    <circle cx={b.cx} cy={b.cy} r="5" fill="#ffffff" />
                                    {/* Label */}
                                    <text x={b.cx} y={b.cy - 16} fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.8))">
                                        {b.name}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Connecting Route Lines */}
                        <path d="M 220 190 L 340 130 L 480 220" fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" strokeDasharray="4 4" />
                    </svg>

                    {/* Active Hub Card Overlay */}
                    <div className="absolute bottom-3 left-3 bg-slate-800/90 backdrop-blur-md p-3 rounded-lg border border-slate-700 text-xs flex flex-col gap-1 max-w-72 shadow-lg">
                        <Text className="font-semibold text-white">
                            {branches.find(b => b.id === selectedBranch)?.name || "Koramangala Hub"}
                        </Text>
                        <Text className="text-[11px] text-slate-300">
                            Serviceable Pincodes: {branches.find(b => b.id === selectedBranch)?.pincodes.join(", ")}
                        </Text>
                        <Badge color="green" className="w-fit text-[10px] mt-1">⚡ 45-Min Hyperlocal Active</Badge>
                    </div>
                </div>
            </Container>

            {/* Serviceable Pincodes Directory Table */}
            <Container className="p-0 overflow-hidden">
                <div className="p-4 border-b bg-ui-bg-subtle flex items-center justify-between">
                    <Text className="font-semibold text-sm">Official Serviceable Pincodes & Delivery Tiers</Text>
                    <Badge color="purple">{Object.keys(SERVICEABLE_ZONES).length} Tiers Configured</Badge>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-ui-bg-subtle">
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Pincode</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Area Name</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Bakery Hub</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Distance</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Express 45-Min</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Midnight</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Fee</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.values(SERVICEABLE_ZONES).map((z) => (
                            <tr key={z.pincode} className="border-b hover:bg-ui-bg-subtle-hover transition-colors">
                                <td className="p-3 font-mono font-bold text-xs">{z.pincode}</td>
                                <td className="p-3 text-xs">{z.area_name}</td>
                                <td className="p-3 text-xs">{z.branch_name}</td>
                                <td className="p-3 text-xs">{z.distance_km} km</td>
                                <td className="p-3">
                                    <Badge color={z.express_available ? "green" : "grey"} className="text-[10px]">
                                        {z.express_available ? "⚡ Yes" : "No"}
                                    </Badge>
                                </td>
                                <td className="p-3">
                                    <Badge color={z.midnight_available ? "purple" : "grey"} className="text-[10px]">
                                        {z.midnight_available ? "🌙 Yes" : "No"}
                                    </Badge>
                                </td>
                                <td className="p-3 font-semibold text-xs text-emerald-600">₹{z.delivery_fee}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Container>
        </div>
    );
}
