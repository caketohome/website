"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button, Badge, Text, Label, Input } from "@medusajs/ui";
import {
  MapPin, Trash2, Plus, Save, RotateCw, Circle, Pentagon,
  Layers, Eye, EyeOff, AlertTriangle, CheckCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
export interface MapFenceEditorProps {
  /** Store/branch latitude */
  storeLat: number;
  /** Store/branch longitude */
  storeLng: number;
  /** Store/branch name for marker label */
  storeName?: string;
  /** Existing polygon coordinates (array of [lat, lng] tuples) */
  polygonCoordinates?: Array<[number, number] | { lat: number; lng: number }>;
  /** Existing exclusion polygons */
  exclusionPolygons?: Array<Array<[number, number] | { lat: number; lng: number }>>;
  /** Fence type */
  fenceType?: "polygon" | "radius" | "hybrid";
  /** Radius in km (for radius/hybrid mode) */
  radiusKm?: number;
  /** Zone name */
  zoneName?: string;
  /** Callback when polygon changes */
  onPolygonChange?: (coords: Array<[number, number]>) => void;
  /** Callback when exclusion polygons change */
  onExclusionChange?: (exclusions: Array<Array<[number, number]>>) => void;
  /** Callback when radius changes */
  onRadiusChange?: (radiusKm: number) => void;
  /** Callback when store location changes (draggable marker) */
  onStoreLocationChange?: (lat: number, lng: number) => void;
  /** Callback for full save */
  onSave?: (data: {
    polygon_coordinates: Array<[number, number]>;
    exclusion_polygons: Array<Array<[number, number]>>;
    fence_type: string;
    radius_km?: number;
    center_latitude?: number;
    center_longitude?: number;
  }) => void;
  /** Read-only mode */
  readOnly?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function normalizeCoords(coords: Array<[number, number] | { lat: number; lng: number }>): Array<[number, number]> {
  return (coords || []).map((c) => {
    if (Array.isArray(c)) return c as [number, number];
    return [c.lat, c.lng] as [number, number];
  });
}

// ── Component ──────────────────────────────────────────────────────────────
export function MapFenceEditor({
  storeLat,
  storeLng,
  storeName = "Store",
  polygonCoordinates = [],
  exclusionPolygons = [],
  fenceType = "hybrid",
  radiusKm = 5,
  zoneName = "Delivery Zone",
  onPolygonChange,
  onExclusionChange,
  onRadiusChange,
  onStoreLocationChange,
  onSave,
  readOnly = false,
}: MapFenceEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const polygonLayerRef = useRef<any>(null);
  const exclusionLayersRef = useRef<any[]>([]);
  const radiusLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const drawControlRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<"view" | "polygon" | "exclusion" | "radius">("view");
  const [localPolygon, setLocalPolygon] = useState<Array<[number, number]>>(normalizeCoords(polygonCoordinates));
  const [localExclusions, setLocalExclusions] = useState<Array<Array<[number, number]>>>(
    (exclusionPolygons || []).map(normalizeCoords)
  );
  const [localRadius, setLocalRadius] = useState(radiusKm || 5);
  const [localFenceType, setLocalFenceType] = useState(fenceType);
  const [showExclusions, setShowExclusions] = useState(true);
  const [showRadius, setShowRadius] = useState(fenceType === "radius" || fenceType === "hybrid");
  const [isDirty, setIsDirty] = useState(false);
  const [storePosition, setStorePosition] = useState<[number, number]>([storeLat || 12.9716, storeLng || 77.5946]);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Dynamic Leaflet Import (SSR-safe) ──────────────────────────────────
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
      // Fix default marker icon paths for webpack/next.js
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setL(leaflet);
      setLeafletLoaded(true);
    }).catch((err) => {
      console.error("[MapFenceEditor] Failed to load Leaflet:", err);
    });
  }, []);

  // ── Initialize Map ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!leafletLoaded || !L || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: storePosition,
      zoom: 13,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    // OpenStreetMap tiles (free, no API key required)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Store marker (draggable)
    const storeIcon = L.divIcon({
      className: "custom-store-marker",
      html: `<div style="background: linear-gradient(135deg, #f59e0b, #d97706); width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <span style="transform: rotate(45deg); font-size: 12px;">🏪</span>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });

    const marker = L.marker(storePosition, {
      draggable: !readOnly,
      icon: storeIcon,
    }).addTo(map);
    marker.bindPopup(`<strong>${storeName}</strong><br/>Drag to reposition store`);

    if (!readOnly) {
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setStorePosition([pos.lat, pos.lng]);
        onStoreLocationChange?.(pos.lat, pos.lng);
        setIsDirty(true);
      });
    }

    markerRef.current = marker;
    mapRef.current = map;
    setMapReady(true);

    // Force map to recalculate size after render
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [leafletLoaded, L]);

  // ── Render Polygon ──────────────────────────────────────────────────────
  const renderPolygon = useCallback(() => {
    if (!mapRef.current || !L || !mapReady) return;
    // Remove existing
    if (polygonLayerRef.current) {
      mapRef.current.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }
    if (localPolygon.length >= 3) {
      const poly = L.polygon(localPolygon, {
        color: "#f59e0b",
        fillColor: "#f59e0b",
        fillOpacity: 0.15,
        weight: 3,
        dashArray: readOnly ? undefined : "5 5",
      }).addTo(mapRef.current);
      
      if (!readOnly) {
        poly.on("click", () => {
          // Enable editing mode
          if (poly.editing) {
            poly.editing.enable();
            poly.on("edit", () => {
              const latlngs = poly.getLatLngs()[0] as any[];
              const newCoords: [number, number][] = latlngs.map((ll: any) => [ll.lat, ll.lng]);
              setLocalPolygon(newCoords);
              onPolygonChange?.(newCoords);
              setIsDirty(true);
            });
          }
        });
      }
      polygonLayerRef.current = poly;
    }
  }, [localPolygon, L, mapReady, readOnly, onPolygonChange]);

  useEffect(() => { renderPolygon(); }, [renderPolygon]);

  // ── Render Exclusion Polygons ───────────────────────────────────────────
  const renderExclusions = useCallback(() => {
    if (!mapRef.current || !L || !mapReady) return;
    exclusionLayersRef.current.forEach((layer) => {
      mapRef.current.removeLayer(layer);
    });
    exclusionLayersRef.current = [];

    if (!showExclusions) return;

    localExclusions.forEach((exCoords) => {
      if (exCoords.length >= 3) {
        const exPoly = L.polygon(exCoords, {
          color: "#ef4444",
          fillColor: "#ef4444",
          fillOpacity: 0.25,
          weight: 2,
          dashArray: "3 3",
        }).addTo(mapRef.current);
        exPoly.bindPopup("Exclusion Zone (Not Serviceable)");
        exclusionLayersRef.current.push(exPoly);
      }
    });
  }, [localExclusions, L, mapReady, showExclusions]);

  useEffect(() => { renderExclusions(); }, [renderExclusions]);

  // ── Render Radius Circle ────────────────────────────────────────────────
  const renderRadius = useCallback(() => {
    if (!mapRef.current || !L || !mapReady) return;
    if (radiusLayerRef.current) {
      mapRef.current.removeLayer(radiusLayerRef.current);
      radiusLayerRef.current = null;
    }
    if (showRadius && localRadius > 0) {
      const circle = L.circle(storePosition, {
        radius: localRadius * 1000, // km to meters
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
        weight: 2,
        dashArray: "8 4",
      }).addTo(mapRef.current);
      circle.bindPopup(`Radius: ${localRadius} km`);
      radiusLayerRef.current = circle;
    }
  }, [localRadius, L, mapReady, showRadius, storePosition]);

  useEffect(() => { renderRadius(); }, [renderRadius]);

  // ── Drawing Handlers ────────────────────────────────────────────────────
  function startDrawPolygon() {
    if (!mapRef.current || !L || readOnly) return;
    setActiveMode("polygon");
    showToastMsg("Click on the map to place polygon points. Double-click to finish.", "success");

    const points: [number, number][] = [];
    const tempMarkers: any[] = [];
    let tempPolyline: any = null;

    function onClick(e: any) {
      points.push([e.latlng.lat, e.latlng.lng]);
      const tm = L.circleMarker(e.latlng, {
        radius: 5, color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 1, weight: 2,
      }).addTo(mapRef.current);
      tempMarkers.push(tm);
      if (tempPolyline) mapRef.current.removeLayer(tempPolyline);
      if (points.length >= 2) {
        tempPolyline = L.polyline(points, { color: "#f59e0b", weight: 2, dashArray: "4 4" }).addTo(mapRef.current);
      }
    }

    function onDblClick(e: any) {
      // Finish polygon
      mapRef.current.off("click", onClick);
      mapRef.current.off("dblclick", onDblClick);
      tempMarkers.forEach((m) => mapRef.current.removeLayer(m));
      if (tempPolyline) mapRef.current.removeLayer(tempPolyline);

      if (points.length >= 3) {
        setLocalPolygon(points);
        onPolygonChange?.(points);
        setIsDirty(true);
        showToastMsg(`Polygon created with ${points.length} points`, "success");
      } else {
        showToastMsg("Need at least 3 points for a polygon", "error");
      }
      setActiveMode("view");
    }

    mapRef.current.on("click", onClick);
    mapRef.current.on("dblclick", onDblClick);
  }

  function startDrawExclusion() {
    if (!mapRef.current || !L || readOnly) return;
    setActiveMode("exclusion");
    showToastMsg("Click to place exclusion zone points. Double-click to finish.", "success");

    const points: [number, number][] = [];
    const tempMarkers: any[] = [];
    let tempPolyline: any = null;

    function onClick(e: any) {
      points.push([e.latlng.lat, e.latlng.lng]);
      const tm = L.circleMarker(e.latlng, {
        radius: 5, color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1, weight: 2,
      }).addTo(mapRef.current);
      tempMarkers.push(tm);
      if (tempPolyline) mapRef.current.removeLayer(tempPolyline);
      if (points.length >= 2) {
        tempPolyline = L.polyline(points, { color: "#ef4444", weight: 2, dashArray: "4 4" }).addTo(mapRef.current);
      }
    }

    function onDblClick() {
      mapRef.current.off("click", onClick);
      mapRef.current.off("dblclick", onDblClick);
      tempMarkers.forEach((m) => mapRef.current.removeLayer(m));
      if (tempPolyline) mapRef.current.removeLayer(tempPolyline);

      if (points.length >= 3) {
        const newExclusions = [...localExclusions, points];
        setLocalExclusions(newExclusions);
        onExclusionChange?.(newExclusions);
        setIsDirty(true);
        showToastMsg(`Exclusion zone created with ${points.length} points`, "success");
      } else {
        showToastMsg("Need at least 3 points for an exclusion zone", "error");
      }
      setActiveMode("view");
    }

    mapRef.current.on("click", onClick);
    mapRef.current.on("dblclick", onDblClick);
  }

  function clearPolygon() {
    setLocalPolygon([]);
    onPolygonChange?.([]);
    setIsDirty(true);
  }

  function removeExclusion(idx: number) {
    const updated = localExclusions.filter((_, i) => i !== idx);
    setLocalExclusions(updated);
    onExclusionChange?.(updated);
    setIsDirty(true);
  }

  function handleSave() {
    onSave?.({
      polygon_coordinates: localPolygon,
      exclusion_polygons: localExclusions,
      fence_type: localFenceType,
      radius_km: localRadius,
      center_latitude: storePosition[0],
      center_longitude: storePosition[1],
    });
    setIsDirty(false);
    showToastMsg("Map fence saved", "success");
  }

  function fitMapToBounds() {
    if (!mapRef.current || !L) return;
    const bounds = L.latLngBounds([storePosition]);
    if (localPolygon.length > 0) {
      localPolygon.forEach((p) => bounds.extend(p));
    }
    if (localRadius > 0 && showRadius) {
      const radiusMeters = localRadius * 1000;
      bounds.extend(L.latLng(storePosition[0] + radiusMeters / 111320, storePosition[1]));
      bounds.extend(L.latLng(storePosition[0] - radiusMeters / 111320, storePosition[1]));
    }
    mapRef.current.fitBounds(bounds.pad(0.15));
  }

  function showToastMsg(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (!leafletLoaded) {
    return (
      <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center">
        <MapPin className="w-8 h-8 mx-auto text-slate-300 animate-pulse mb-2" />
        <Text className="text-xs text-slate-400">Loading interactive map...</Text>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toast */}
      {toast && (
        <div className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
          toast.type === "success" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-rose-100 text-rose-700 border border-rose-200"
        }`}>
          {toast.type === "success" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {toast.msg}
        </div>
      )}

      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={startDrawPolygon}
              disabled={activeMode !== "view"}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors ${
                activeMode === "polygon" ? "bg-amber-500 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              } disabled:opacity-50`}
            >
              <Pentagon className="w-3 h-3" /> Draw Zone
            </button>
            <button
              onClick={startDrawExclusion}
              disabled={activeMode !== "view"}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors ${
                activeMode === "exclusion" ? "bg-rose-500 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              } disabled:opacity-50`}
            >
              <Plus className="w-3 h-3" /> Exclusion
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowExclusions(!showExclusions)}
              className="px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {showExclusions ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Exclusions
            </button>
            <button
              onClick={() => { setShowRadius(!showRadius); }}
              className="px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Circle className="w-3 h-3" />
              Radius {showRadius ? "On" : "Off"}
            </button>
          </div>

          {showRadius && (
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-slate-500">Radius (km):</Label>
              <Input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={localRadius}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 5;
                  setLocalRadius(v);
                  onRadiusChange?.(v);
                  setIsDirty(true);
                }}
                className="w-16 text-xs"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {localPolygon.length > 0 && (
              <button
                onClick={clearPolygon}
                className="px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="w-3 h-3" /> Clear Zone
              </button>
            )}
            <button
              onClick={fitMapToBounds}
              className="px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Layers className="w-3 h-3" /> Fit
            </button>
            {isDirty && (
              <button
                onClick={handleSave}
                className="px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Save className="w-3 h-3" /> Save Fence
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
        <div
          ref={mapContainerRef}
          id="map-fence-container"
          style={{ height: 400, width: "100%", minHeight: 400, zIndex: 1 }}
          className="bg-slate-100 dark:bg-slate-800"
        />

        {/* Drawing Mode Overlay */}
        {activeMode !== "view" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-black/80 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-sm">
            {activeMode === "polygon" ? (
              <><Pentagon className="w-3.5 h-3.5 text-amber-400" /> Drawing Zone Polygon — Double-click to finish</>
            ) : (
              <><Plus className="w-3.5 h-3.5 text-rose-400" /> Drawing Exclusion Zone — Double-click to finish</>
            )}
            <button
              onClick={() => {
                setActiveMode("view");
                if (mapRef.current) {
                  mapRef.current.off("click");
                  mapRef.current.off("dblclick");
                }
              }}
              className="ml-2 px-2 py-0.5 bg-white/20 rounded text-[10px] hover:bg-white/30"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
        <Badge color={localPolygon.length >= 3 ? "green" : "orange"} className="text-[9px]">
          Polygon: {localPolygon.length >= 3 ? `${localPolygon.length} points` : "Not drawn"}
        </Badge>
        <Badge color={localExclusions.length > 0 ? "red" : "grey"} className="text-[9px]">
          Exclusions: {localExclusions.length}
        </Badge>
        {showRadius && (
          <Badge color="blue" className="text-[9px]">
            Radius: {localRadius} km
          </Badge>
        )}
        <span className="text-slate-400">
          Store: {storePosition[0].toFixed(4)}, {storePosition[1].toFixed(4)}
        </span>
        {isDirty && (
          <Badge color="orange" className="text-[9px] animate-pulse">
            Unsaved Changes
          </Badge>
        )}
      </div>

      {/* Exclusion Zones List */}
      {localExclusions.length > 0 && !readOnly && (
        <div className="space-y-1">
          <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Exclusion Zones</Text>
          {localExclusions.map((ex, idx) => (
            <div key={idx} className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-1.5">
              <span className="text-[10px] font-medium text-rose-700">
                Exclusion #{idx + 1} — {ex.length} points
              </span>
              <button onClick={() => removeExclusion(idx)} className="text-rose-500 hover:text-rose-700">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
