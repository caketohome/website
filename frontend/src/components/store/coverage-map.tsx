"use client";

import { useEffect, useState, useRef } from "react";
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
    const [leafletReady, setLeafletReady] = useState(false);
    const [L, setL] = useState<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);

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

    // Dynamic Leaflet import
    useEffect(() => {
        if (typeof window === "undefined") return;
        import("leaflet").then((leafletModule) => {
            // Import CSS via link element to avoid TS module resolution issues
            if (!document.querySelector('link[href*="leaflet"]')) {
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
                document.head.appendChild(link);
            }
            const leaflet = leafletModule.default || leafletModule;
            delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
            leaflet.Icon.Default.mergeOptions({
                iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
                iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            });
            setL(leaflet);
            setLeafletReady(true);
        }).catch((err) => {
            console.error("[DeliveryCoverageMap] Failed to load Leaflet:", err);
        });
    }, []);

    // Initialize map when Leaflet + branches are ready
    useEffect(() => {
        if (!leafletReady || !L || !mapContainerRef.current || branches.length === 0) return;
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }

        // Determine center from first branch coordinates, fallback to India center
        const firstBranch = branches[0];
        const center: [number, number] = [
            firstBranch?.latitude || 20.5937,
            firstBranch?.longitude || 78.9629,
        ];
        const zoom = firstBranch?.latitude ? 12 : 5;

        const map = L.map(mapContainerRef.current, {
            center,
            zoom,
            scrollWheelZoom: true,
            zoomControl: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        const bounds = L.latLngBounds([]);

        // Render each branch with markers and delivery zones
        branches.forEach((b: any) => {
            if (!b.latitude || !b.longitude) return;

            const branchLatLng: [number, number] = [b.latitude, b.longitude];
            bounds.extend(branchLatLng);

            // Store marker
            const storeIcon = L.divIcon({
                className: "coverage-store-marker",
                html: `<div style="
                    background: ${b.is_open ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #ef4444, #dc2626)"};
                    width: 24px; height: 24px; border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg); border: 2px solid white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    display: flex; align-items: center; justify-content: center;
                "><span style="transform: rotate(45deg); font-size: 11px;">🏪</span></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 24],
                popupAnchor: [0, -24],
            });

            const marker = L.marker(branchLatLng, { icon: storeIcon }).addTo(map);
            const zoneCount = (b.delivery_zones || []).length;
            const pinCount = (b.delivery_zones || []).reduce(
                (acc: number, z: any) => acc + (Array.isArray(z.pincodes) ? z.pincodes.length : 0), 0
            );

            marker.bindPopup(`
                <div style="font-family: system-ui; font-size: 12px; min-width: 180px;">
                    <strong>${b.name}</strong><br/>
                    <span style="color: ${b.is_open ? "#10b981" : "#ef4444"}; font-weight: bold;">
                        ${b.is_open ? "● Open" : "● Closed"}
                    </span><br/>
                    <span style="color: #6b7280;">${b.city || ""}, ${b.state || ""}</span><br/>
                    <span style="color: #6b7280;">${zoneCount} zones · ${pinCount} pincodes</span>
                </div>
            `);

            // Render delivery zones
            (b.delivery_zones || []).forEach((zone: any) => {
                if (!zone.enabled) return;

                // Polygon fence
                if (zone.polygon_coordinates && Array.isArray(zone.polygon_coordinates) && zone.polygon_coordinates.length >= 3) {
                    try {
                        const coords = zone.polygon_coordinates.map((c: any) => {
                            if (Array.isArray(c)) return c;
                            return [c.lat || c.latitude, c.lng || c.longitude];
                        });
                        const poly = L.polygon(coords, {
                            color: b.is_open ? "#f59e0b" : "#94a3b8",
                            fillColor: b.is_open ? "#f59e0b" : "#94a3b8",
                            fillOpacity: 0.1,
                            weight: 2,
                        }).addTo(map);
                        poly.bindPopup(`<strong>${zone.name}</strong><br/>${(zone.pincodes || []).length} pincodes`);
                        bounds.extend(poly.getBounds());
                    } catch {}
                }

                // Radius circle fallback
                if (zone.max_km && zone.max_km > 0 && (!zone.polygon_coordinates || zone.polygon_coordinates.length < 3)) {
                    const circle = L.circle(branchLatLng, {
                        radius: zone.max_km * 1000,
                        color: zone.express_allowed ? "#10b981" : "#3b82f6",
                        fillColor: zone.express_allowed ? "#10b981" : "#3b82f6",
                        fillOpacity: 0.06,
                        weight: 1.5,
                        dashArray: "6 4",
                    }).addTo(map);
                    circle.bindPopup(`<strong>${zone.name}</strong><br/>${zone.max_km} km radius`);
                    bounds.extend(circle.getBounds());
                }

                // Exclusion polygons
                if (zone.exclusion_polygons && Array.isArray(zone.exclusion_polygons)) {
                    zone.exclusion_polygons.forEach((ex: any) => {
                        if (Array.isArray(ex) && ex.length >= 3) {
                            try {
                                const exCoords = ex.map((c: any) => Array.isArray(c) ? c : [c.lat, c.lng]);
                                L.polygon(exCoords, {
                                    color: "#ef4444",
                                    fillColor: "#ef4444",
                                    fillOpacity: 0.2,
                                    weight: 1.5,
                                    dashArray: "3 3",
                                }).addTo(map).bindPopup("Exclusion Zone (Not Serviceable)");
                            } catch {}
                        }
                    });
                }
            });
        });

        // Fit map to show all branches
        if (bounds.isValid()) {
            map.fitBounds(bounds.pad(0.1));
        }

        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 200);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, [leafletReady, L, branches]);

    const handleCheckPincode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pincode.trim()) return;
        setChecking(true);
        const res = await checkDeliveryAvailability(pincode);
        setResult(res);
        setChecking(false);
    };

    const activeBranchObj = branches.find((b) => b.id === selectedBranch) || branches[0];

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Heading level="h2" className="text-xl">🗺️ Bakery Delivery Coverage & Pincode Decision Engine</Heading>
                    <Text className="text-ui-fg-subtle text-sm">Interactive map showing active delivery hubs, geofenced zones, and real-time area serviceability status.</Text>
                </div>
                <Badge color="green" className="w-fit">
                    {branches.length} Active Hub{branches.length !== 1 ? "s" : ""}
                </Badge>
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
                                placeholder="Enter 6-digit Pincode (e.g. 560034, 560038)"
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
                    <div className={`mt-4 p-4 rounded-lg border ${result.serviceable ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300" : "bg-brand-gold-soft dark:bg-[#0c1326]/40 border-[#D4AF37]/40"}`}>
                        <div className="flex items-start gap-3">
                            {result.serviceable ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                                <XCircle className="w-5 h-5 text-[#1D2F5D] shrink-0 mt-0.5" />
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
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Container>

            {/* Interactive Leaflet Delivery Coverage Map */}
            <Container className="p-6 flex flex-col gap-4 overflow-hidden">
                <div className="flex items-center justify-between">
                    <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider">
                        Live Delivery Hub Network (Geofenced Coverage)
                    </Text>
                    <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500 inline-block"></span> Express Zone</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500 inline-block"></span> Standard Geofence</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500 inline-block"></span> Store Hub</span>
                    </div>
                </div>

                <div className="relative w-full rounded-xl overflow-hidden border shadow-inner">
                    {!leafletReady ? (
                        <div className="h-[400px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                            <div className="text-center">
                                <MapPin className="w-8 h-8 mx-auto text-slate-300 animate-pulse mb-2" />
                                <Text className="text-xs text-slate-400">Loading interactive map...</Text>
                            </div>
                        </div>
                    ) : (
                        <div
                            ref={mapContainerRef}
                            style={{ height: 400, width: "100%", minHeight: 400 }}
                            className="bg-slate-100 dark:bg-slate-800"
                        />
                    )}

                    {/* Branch selector overlay */}
                    {activeBranchObj && branches.length > 1 && (
                        <div className="absolute bottom-3 left-3 z-[400] bg-white/95 dark:bg-slate-800/95 backdrop-blur-md p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs flex flex-col gap-1 max-w-72 shadow-lg">
                            <select
                                className="text-[11px] font-semibold bg-transparent border-none outline-none cursor-pointer"
                                value={selectedBranch}
                                onChange={(e) => {
                                    setSelectedBranch(e.target.value);
                                    const b = branches.find((br: any) => br.id === e.target.value);
                                    if (b && b.latitude && b.longitude && mapRef.current) {
                                        mapRef.current.setView([b.latitude, b.longitude], 13);
                                    }
                                }}
                            >
                                {branches.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                            <Text className="text-[11px] text-slate-500">
                                {activeBranchObj.city || ""}{activeBranchObj.state ? `, ${activeBranchObj.state}` : ""}
                            </Text>
                            <div className="flex gap-2 mt-1">
                                <Badge color={activeBranchObj.is_open ? "green" : "red"} className="w-fit text-[10px]">
                                    {activeBranchObj.is_open ? "⚡ Hub Active" : "Paused"}
                                </Badge>
                                <Badge color="blue" className="w-fit text-[10px]">
                                    Zones: {(activeBranchObj.delivery_zones || []).length}
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
                        </tr>
                    </thead>
                    <tbody>
                        {cityAreas.map((area: any) => (
                            <tr key={area.id} className="border-b hover:bg-ui-bg-subtle-hover transition-colors">
                                <td className="p-3 font-semibold text-xs text-ui-fg-subtle">{area.zone_name || "Delivery Zone"}</td>
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
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Container>
        </div>
    );
}
