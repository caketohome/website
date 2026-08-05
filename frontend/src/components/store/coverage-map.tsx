"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Button, Input } from "@medusajs/ui";
import { checkDeliveryAvailability } from "@frontend/lib/data/deliveries";
import { apiClient } from "@frontend/lib/api-client";
import { MapPin, Zap, Moon, CheckCircle2, XCircle, Search, ShieldCheck, AlertTriangle } from "lucide-react";

export function DeliveryCoverageMap() {
    const [pincode, setPincode] = useState("");
    const [result, setResult] = useState<any>(null);
    const [checking, setChecking] = useState(false);
    const [branches, setBranches] = useState<any[]>([]);
    const [cityAreas, setCityAreas] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>("");

    useEffect(() => {
        apiClient.getAdminBranches()
            .then((res: any) => {
                const bList = res?.branches || res?.data || [];
                const cAreas = res?.cityAreas || [];
                setBranches(bList);
                setCityAreas(cAreas);
                if (bList.length > 0) setSelectedBranch(bList[0].id);
            })
            .catch(() => null);
    }, []);

    const handleCheckPincode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pincode.trim()) return;
        setChecking(true);
        const res = await checkDeliveryAvailability(pincode);
        setResult(res);
        setChecking(false);
    };

    const mapBranchCoordinates = [
        { id: "br_koramangala", cx: 220, cy: 190, radius: 90 },
        { id: "br_indiranagar", cx: 340, cy: 130, radius: 75 },
        { id: "br_whitefield", cx: 480, cy: 220, radius: 110 },
    ];

    const activeBranchObj = branches.find((b) => b.id === selectedBranch) || branches[0];

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Heading level="h2" className="text-xl">🗺️ Bakery Delivery Coverage & Pincode Decision Engine</Heading>
                    <Text className="text-ui-fg-subtle text-sm">Interactive decision engine showing active delivery hubs, geofenced radius zones, and real-time area serviceability status.</Text>
                </div>
                <Badge color="green" className="w-fit">Max Serviceable Radius: 20 KM</Badge>
            </div>

            {/* Pincode Lookup Bar */}
            <Container className="p-6 border-2 border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-950/10">
                <form onSubmit={handleCheckPincode} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                        <label className="text-xs font-semibold text-ui-fg-subtle mb-1 block">
                            Check Delivery Pincode or Locality
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
                            <Input
                                placeholder="Enter 6-digit Pincode (e.g. 560034, 560038, 560102, 560066)"
                                value={pincode}
                                onChange={(e) => setPincode(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <Button type="submit" isLoading={checking} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        Evaluate Serviceability
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
                                    {result.serviceable ? `✓ Serviceable via ${result.branch_name || "Primary Hub"}` : "❌ Out of Current Delivery Coverage"}
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
                        Live Delivery Hub Network (Geofenced Metro Coverage)
                    </Text>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500 inline-block"></span> Express Zone</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500 inline-block"></span> Standard Geofence</span>
                    </div>
                </div>

                <div className="relative w-full h-[360px] bg-slate-900 rounded-xl overflow-hidden border shadow-inner flex items-center justify-center">
                    {/* SVG Map Canvas */}
                    <svg className="w-full h-full" viewBox="0 0 650 360">
                        <defs>
                            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />

                        <polygon points="120,60 410,40 590,140 560,320 280,330 110,240" fill="none" stroke="rgba(251, 191, 36, 0.2)" strokeWidth="2" strokeDasharray="6 4" />

                        {branches.map((b, idx) => {
                            const coord = mapBranchCoordinates.find((c) => c.id === b.id) || { cx: 200 + idx * 130, cy: 180 + (idx % 2) * 30, radius: 85 };
                            const isSelected = selectedBranch === b.id;
                            return (
                                <g key={b.id} onClick={() => setSelectedBranch(b.id)} className="cursor-pointer">
                                    <circle
                                        cx={coord.cx}
                                        cy={coord.cy}
                                        r={coord.radius}
                                        fill={b.is_open ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.12)"}
                                        stroke={isSelected ? "#10b981" : b.is_open ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.5)"}
                                        strokeWidth={isSelected ? "3" : "1.5"}
                                    />
                                    <circle cx={coord.cx} cy={coord.cy} r="10" fill={b.is_open ? "#f59e0b" : "#ef4444"} className="animate-pulse" />
                                    <circle cx={coord.cx} cy={coord.cy} r="5" fill="#ffffff" />
                                    <text x={coord.cx} y={coord.cy - 16} fill="#ffffff" fontSize="11" fontWeight="bold" textAnchor="middle" filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.8))">
                                        {b.name}
                                    </text>
                                </g>
                            );
                        })}

                        <path d="M 220 190 L 340 130 L 480 220" fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" strokeDasharray="4 4" />
                    </svg>

                    {/* Active Hub Overlay */}
                    {activeBranchObj && (
                        <div className="absolute bottom-3 left-3 bg-slate-800/90 backdrop-blur-md p-3 rounded-lg border border-slate-700 text-xs flex flex-col gap-1 max-w-72 shadow-lg">
                            <Text className="font-semibold text-white">
                                {activeBranchObj.name}
                            </Text>
                            <Text className="text-[11px] text-slate-300">
                                Deliverable Areas: {Array.isArray(activeBranchObj.deliverable_areas) ? activeBranchObj.deliverable_areas.join(", ") : "Bangalore Metro"}
                            </Text>
                            <div className="flex gap-2 mt-1">
                                <Badge color={activeBranchObj.is_open ? "green" : "red"} className="w-fit text-[10px]">
                                    {activeBranchObj.is_open ? "⚡ Hub Active" : "Paused"}
                                </Badge>
                                <Badge color="blue" className="w-fit text-[10px]">
                                    Coverage: {Math.max(...(activeBranchObj.delivery_zones || []).map((z: any) => z.max_km ?? 0), 0) || "—"} KM Max
                                </Badge>
                            </div>
                        </div>
                    )}
                </div>
            </Container>

            {/* Serviceable City Areas Directory Table */}
            <Container className="p-0 overflow-hidden">
                <div className="p-4 border-b bg-ui-bg-subtle flex items-center justify-between">
                    <Text className="font-semibold text-sm">City Areas & Locality Decision Matrix</Text>
                    <Badge color="purple">{cityAreas.length} Service Areas Configured</Badge>
                </div>
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-ui-bg-subtle">
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Zone</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Area Name</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Localities Covered</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Pincodes</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Status</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Express</th>
                            <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Midnight</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cityAreas.map((area: any) => (
                            <tr key={area.id} className="border-b hover:bg-ui-bg-subtle-hover transition-colors">
                                <td className="p-3 font-semibold text-xs text-ui-fg-subtle">{area.zone_name || "Metro Zone"}</td>
                                <td className="p-3 font-bold text-xs">{area.area_name}</td>
                                <td className="p-3 text-xs text-ui-fg-subtle">
                                    {Array.isArray(area.localities) ? area.localities.join(", ") : "All Localities"}
                                </td>
                                <td className="p-3 font-mono text-xs">{Array.isArray(area.pincodes) ? area.pincodes.join(", ") : area.pincode}</td>
                                <td className="p-3">
                                    <Badge color={area.status === "open" ? "green" : "red"} className="text-[10px] uppercase">
                                        {area.status || "open"}
                                    </Badge>
                                </td>
                                <td className="p-3">
                                    <Badge color={area.express_available !== false ? "green" : "grey"} className="text-[10px]">
                                        {area.express_available !== false ? "⚡ Ready" : "No"}
                                    </Badge>
                                </td>
                                <td className="p-3">
                                    <Badge color={area.midnight_available !== false ? "purple" : "grey"} className="text-[10px]">
                                        {area.midnight_available !== false ? "🌙 Eligible" : "No"}
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Container>
        </div>
    );
}
