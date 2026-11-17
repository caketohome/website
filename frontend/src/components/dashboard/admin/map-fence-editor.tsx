"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button, Badge, Text, Label, Input } from "@medusajs/ui";
import {
  MapPin, Trash2, Plus, Save, RotateCw, Circle, Pentagon,
  Layers, Eye, EyeOff, AlertTriangle, CheckCircle, Search, Loader2,
  Navigation, Crosshair, X, Store, Check, Info,
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import { getGeocodingProvider } from "@frontend/lib/geo";

// ── Types ──────────────────────────────────────────────────────────────────
export interface MapFenceEditorProps {
  /** Store/branch latitude */
  storeLat: number;
  /** Store/branch longitude */
  storeLng: number;
  /** Store/branch name for marker label */
  storeName?: string;
  /** Store location source */
  locationSource?: string;
  /** Store location accuracy in meters */
  locationAccuracy?: number | null;
  /** Store formatted address */
  storeAddress?: string;
  /** Existing polygon coordinates (array of [lat, lng] tuples) */
  polygonCoordinates?: Array<[number, number] | { lat: number; lng: number }>;
  /** Existing exclusion polygons */
  exclusionPolygons?: Array<Array<[number, number] | { lat: number; lng: number }>>;
  /** Fence type */
  fenceType?: "polygon" | "radius" | "hybrid";
  /** Radius in km (for radius/hybrid mode) */
  radiusKm?: number;
  /** Maximum allowable delivery radius in km (effective limit from store/global/zone) */
  maxRadiusKm?: number;
  /** Zone name */
  zoneName?: string;
  /** Callback when polygon changes */
  onPolygonChange?: (coords: Array<[number, number]>) => void;
  /** Callback when exclusion polygons change */
  onExclusionChange?: (exclusions: Array<Array<[number, number]>>) => void;
  /** Callback when radius changes */
  onRadiusChange?: (radiusKm: number) => void;
  /** Callback when store location is saved */
  onStoreLocationChange?: (lat: number, lng: number, source?: string, accuracy?: number | null, address?: string) => Promise<void> | void;
  /** Callback for full fence save */
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
  locationSource = "MANUAL_MAP",
  locationAccuracy = null,
  storeAddress = "",
  polygonCoordinates = [],
  exclusionPolygons = [],
  fenceType = "hybrid",
  radiusKm = 5,
  maxRadiusKm = 25,
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
  const maxRadiusLayerRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [L, setL] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<"view" | "polygon" | "exclusion" | "radius" | "pick_store">("view");
  const [localPolygon, setLocalPolygon] = useState<Array<[number, number]>>(normalizeCoords(polygonCoordinates));
  const [localExclusions, setLocalExclusions] = useState<Array<Array<[number, number]>>>(
    (exclusionPolygons || []).map(normalizeCoords)
  );
  const [localRadius, setLocalRadius] = useState(Math.min(radiusKm || 5, maxRadiusKm));
  const [localFenceType, setLocalFenceType] = useState(fenceType);
  const [showExclusions, setShowExclusions] = useState(true);
  const [showRadius, setShowRadius] = useState(fenceType === "radius" || fenceType === "hybrid");
  const [isDirty, setIsDirty] = useState(false);

  // ── Store Location State (Decoupled Preview vs Saved) ───────────────────
  const savedLat = typeof storeLat === "number" && !isNaN(storeLat) ? storeLat : 12.9716;
  const savedLng = typeof storeLng === "number" && !isNaN(storeLng) ? storeLng : 77.5946;
  const [storePosition, setStorePosition] = useState<[number, number]>([savedLat, savedLng]);
  const [pendingStoreLocation, setPendingStoreLocation] = useState<{
    lat: number;
    lng: number;
    source: string;
    accuracy?: number | null;
    address?: string;
  } | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Sync with prop updates when not actively editing
  useEffect(() => {
    if (!pendingStoreLocation && typeof storeLat === "number" && typeof storeLng === "number" && !isNaN(storeLat) && !isNaN(storeLng)) {
      setStorePosition([storeLat, storeLng]);
    }
  }, [storeLat, storeLng, pendingStoreLocation]);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    if (localRadius > maxRadiusKm) {
      setLocalRadius(maxRadiusKm);
      onRadiusChange?.(maxRadiusKm);
    }
  }, [maxRadiusKm, localRadius, onRadiusChange]);

  // ── Map Search State ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    displayName: string;
    shortName?: string;
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
    pincode?: string;
  }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSearchResult, setSelectedSearchResult] = useState<{
    id: string;
    displayName: string;
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
    pincode?: string;
  } | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchQueryRef = useRef<string>("");

  const handleSearchInput = useCallback((q: string) => {
    setSearchQuery(q);
    setSearchError(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearchLoading(true);
    const trimmed = q.trim();
    lastSearchQueryRef.current = trimmed;

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const provider = getGeocodingProvider();
        const results = await provider.searchPlaces(trimmed);
        if (lastSearchQueryRef.current !== trimmed) return; // Stale request protection

        if (results && results.length > 0) {
          const normalized = results.slice(0, 8).map((r) => ({
            id: r.id,
            displayName: r.displayName || r.formattedAddress || trimmed,
            shortName: r.shortName,
            latitude: r.latitude,
            longitude: r.longitude,
            city: r.city,
            state: r.state,
            pincode: r.pincode,
          }));
          setSearchResults(normalized);
          setShowSearchResults(true);
          setSearchError(null);
        } else {
          // Fallback to apiClient search
          const fbRes: any = await apiClient.searchDeliveryLocation(trimmed);
          if (lastSearchQueryRef.current !== trimmed) return;
          const fbList = (fbRes?.results || []).slice(0, 8).map((r: any, idx: number) => ({
            id: r.id || `sr_${idx}`,
            displayName: r.label || r.formatted_address || r.name || trimmed,
            shortName: r.area,
            latitude: typeof r.latitude === "number" ? r.latitude : (typeof r.lat === "number" ? r.lat : 0),
            longitude: typeof r.longitude === "number" ? r.longitude : (typeof r.lng === "number" ? r.lng : 0),
            city: r.city || "",
            state: r.state || "",
            pincode: r.pincode || "",
          }));
          if (fbList.length > 0) {
            setSearchResults(fbList);
            setShowSearchResults(true);
            setSearchError(null);
          } else {
            setSearchResults([]);
            setShowSearchResults(false);
            setSearchError("Location search unavailable. Try another search or place the pin manually.");
          }
        }
      } catch (err) {
        if (lastSearchQueryRef.current === trimmed) {
          setSearchResults([]);
          setShowSearchResults(false);
          setSearchError("Location search unavailable. Try another search or place the pin manually.");
        }
      } finally {
        if (lastSearchQueryRef.current === trimmed) {
          setSearchLoading(false);
        }
      }
    }, 300);
  }, []);

  const handleSearchSelect = useCallback((result: {
    id: string;
    latitude: number;
    longitude: number;
    displayName: string;
    city?: string;
    state?: string;
    pincode?: string;
  }) => {
    if (mapRef.current && result.latitude && result.longitude) {
      mapRef.current.setView([result.latitude, result.longitude], 14, { animate: true });
      setSelectedSearchResult(result);
      showToastMsg(`📍 Centered map on ${result.displayName}. Store coordinates are unchanged until you click "Set as Store Location".`, "info");
    }
    setShowSearchResults(false);
  }, []);

  // ── Method 1: Set Store Location from Search Result ───────────────────
  const applySearchResultAsStoreLocation = useCallback((res: typeof selectedSearchResult) => {
    if (!res || !res.latitude || !res.longitude) return;
    const newPos: [number, number] = [res.latitude, res.longitude];
    setStorePosition(newPos);
    setPendingStoreLocation({
      lat: Number(res.latitude.toFixed(6)),
      lng: Number(res.longitude.toFixed(6)),
      source: "SEARCH",
      accuracy: null,
      address: res.displayName,
    });
    if (markerRef.current) {
      markerRef.current.setLatLng(newPos);
    }
    if (mapRef.current) {
      mapRef.current.setView(newPos, 14, { animate: true });
    }
    setSelectedSearchResult(null);
    setSearchQuery("");
    showToastMsg(`📍 Store pin moved to ${res.displayName}. Click "Save Location" to persist.`, "success");
  }, []);

  // ── Method 2: Use Current Location (GPS) ──────────────────────────────
  const handleUseCurrentLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      showToastMsg("Geolocation is not supported by your browser.", "error");
      return;
    }
    setGpsLoading(true);
    showToastMsg("Acquiring GPS location...", "info");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const accuracy = Math.round(pos.coords.accuracy || 10);
        const newPos: [number, number] = [lat, lng];

        setStorePosition(newPos);
        if (markerRef.current) markerRef.current.setLatLng(newPos);
        if (mapRef.current) mapRef.current.setView(newPos, 15, { animate: true });

        // Reverse geocode for address preview
        let resolvedAddress = `GPS (${lat}, ${lng})`;
        try {
          const revRes: any = await apiClient.reverseGeocode(lat, lng);
          if (revRes?.formatted_address) {
            resolvedAddress = revRes.formatted_address;
          }
        } catch {}

        setPendingStoreLocation({
          lat,
          lng,
          source: "GPS",
          accuracy,
          address: resolvedAddress,
        });
        setGpsLoading(false);
        showToastMsg(`📍 GPS Location acquired (Accuracy: ±${accuracy}m). Click "Save Location" to confirm.`, "success");
      },
      (err) => {
        setGpsLoading(false);
        showToastMsg(`Failed to acquire GPS location: ${err.message}`, "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Method 3: Pick on Map ─────────────────────────────────────────────
  const handleStartPickOnMap = useCallback(() => {
    if (activeMode === "pick_store") {
      setActiveMode("view");
      return;
    }
    setActiveMode("pick_store");
    showToastMsg("Click anywhere on the map to place the 🏪 Store Pin.", "info");
  }, [activeMode]);

  // ── Save / Cancel Pending Store Location ──────────────────────────────
  const handleSaveStoreLocation = useCallback(async () => {
    if (!pendingStoreLocation) return;
    setSavingLocation(true);
    try {
      if (onStoreLocationChange) {
        await onStoreLocationChange(
          pendingStoreLocation.lat,
          pendingStoreLocation.lng,
          pendingStoreLocation.source,
          pendingStoreLocation.accuracy,
          pendingStoreLocation.address
        );
      }
      setPendingStoreLocation(null);
      showToastMsg(`✅ Store location saved successfully (${pendingStoreLocation.lat.toFixed(4)}, ${pendingStoreLocation.lng.toFixed(4)}).`, "success");
    } catch (err: any) {
      showToastMsg(`Failed to save store location: ${err?.message || "Unknown error"}`, "error");
    } finally {
      setSavingLocation(false);
    }
  }, [pendingStoreLocation, onStoreLocationChange]);

  const handleCancelStoreLocation = useCallback(() => {
    const originalPos: [number, number] = [savedLat, savedLng];
    setStorePosition(originalPos);
    if (markerRef.current) markerRef.current.setLatLng(originalPos);
    if (mapRef.current) mapRef.current.setView(originalPos, 13, { animate: true });
    setPendingStoreLocation(null);
    setSelectedSearchResult(null);
    setActiveMode("view");
    showToastMsg("Store location changes discarded. Restored original coordinates.", "info");
  }, [savedLat, savedLng]);

  // ── Dynamic Leaflet Import (SSR-safe) ──────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    import("leaflet").then((leafletModule) => {
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

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Store marker (distinct 🏪 store pin, draggable)
    const storeIcon = L.divIcon({
      className: "custom-store-marker",
      html: `<div style="background: linear-gradient(135deg, #f59e0b, #d97706); width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; cursor: grab;">
        <span style="transform: rotate(45deg); font-size: 16px;">🏪</span>
      </div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
      popupAnchor: [0, -34],
    });

    const marker = L.marker(storePosition, {
      draggable: !readOnly,
      icon: storeIcon,
      zIndexOffset: 1000,
    }).addTo(map);
    marker.bindPopup(`<strong>🏪 ${storeName}</strong><br/><span style="font-size:11px;color:#6B7280;">Physical Bakery Hub Location<br/>Drag to reposition</span>`);

    if (!readOnly) {
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        const newLat = Number(pos.lat.toFixed(6));
        const newLng = Number(pos.lng.toFixed(6));
        const newPos: [number, number] = [newLat, newLng];
        setStorePosition(newPos);
        setPendingStoreLocation({
          lat: newLat,
          lng: newLng,
          source: "MANUAL_MAP",
          accuracy: null,
        });
        showToastMsg(`📍 Store marker moved to (${newLat.toFixed(4)}, ${newLng.toFixed(4)}). Click "Save Location" to confirm.`, "info");
      });
    }

    // Map click handler for "pick_store" mode
    map.on("click", (e: any) => {
      if (activeMode === "pick_store" && !readOnly) {
        const newLat = Number(e.latlng.lat.toFixed(6));
        const newLng = Number(e.latlng.lng.toFixed(6));
        const newPos: [number, number] = [newLat, newLng];
        setStorePosition(newPos);
        marker.setLatLng(newPos);
        setPendingStoreLocation({
          lat: newLat,
          lng: newLng,
          source: "MANUAL_MAP",
          accuracy: null,
        });
        setActiveMode("view");
        showToastMsg(`📍 Store placed at (${newLat.toFixed(4)}, ${newLng.toFixed(4)}). Click "Save Location" to confirm.`, "info");
      }
    });

    markerRef.current = marker;
    mapRef.current = map;
    setMapReady(true);

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [leafletLoaded, L]);

  // Sync marker position when storePosition state changes
  useEffect(() => {
    if (markerRef.current && storePosition) {
      markerRef.current.setLatLng(storePosition);
    }
  }, [storePosition]);

  // ── Render Polygon ──────────────────────────────────────────────────────
  const renderPolygon = useCallback(() => {
    if (!mapRef.current || !L || !mapReady) return;
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

  // ── Render Radius Circles (Always Centered on Store Position) ───────────
  const renderRadius = useCallback(() => {
    if (!mapRef.current || !L || !mapReady) return;

    if (radiusLayerRef.current) {
      mapRef.current.removeLayer(radiusLayerRef.current);
      radiusLayerRef.current = null;
    }
    if (maxRadiusLayerRef.current) {
      mapRef.current.removeLayer(maxRadiusLayerRef.current);
      maxRadiusLayerRef.current = null;
    }

    if (showRadius && maxRadiusKm > 0) {
      // 1. Allowed Maximum Delivery Boundary (Dashed Red Outline centered on Store)
      const maxCircle = L.circle(storePosition, {
        radius: maxRadiusKm * 1000,
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: 0.03,
        weight: 2,
        dashArray: "6 6",
      }).addTo(mapRef.current);
      maxCircle.bindPopup(`<b>Max Allowed Delivery Radius:</b> ${maxRadiusKm} km (Centered on Store)`);
      maxRadiusLayerRef.current = maxCircle;
    }

    if (showRadius && localRadius > 0) {
      // 2. Current Configured Radius (Centered on Store)
      const clampedRadius = Math.min(localRadius, maxRadiusKm);
      const circle = L.circle(storePosition, {
        radius: clampedRadius * 1000,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.09,
        weight: 2,
        dashArray: "8 4",
      }).addTo(mapRef.current);
      circle.bindPopup(`<b>Current Delivery Radius:</b> ${clampedRadius} km<br/><span style="font-size:10px; color:#6B7280;">Centered on 🏪 ${storeName}</span>`);
      radiusLayerRef.current = circle;
    }
  }, [localRadius, maxRadiusKm, L, mapReady, showRadius, storePosition, storeName]);

  useEffect(() => { renderRadius(); }, [renderRadius]);

  // ── Drawing Handlers ────────────────────────────────────────────────────
  function startDrawPolygon() {
    if (!mapRef.current || !L || readOnly) return;
    setActiveMode("polygon");
    showToastMsg("Click on the map to place polygon points. Double-click to finish.", "info");

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

    function onDblClick() {
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
    showToastMsg("Click to place exclusion zone points. Double-click to finish.", "info");

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

  function handleSaveFence() {
    const clampedRadius = Math.min(localRadius, maxRadiusKm);
    onSave?.({
      polygon_coordinates: localPolygon,
      exclusion_polygons: localExclusions,
      fence_type: localFenceType,
      radius_km: clampedRadius,
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
      bounds.extend(L.latLng(storePosition[0], storePosition[1] + radiusMeters / (111320 * Math.cos((storePosition[0] * Math.PI) / 180))));
      bounds.extend(L.latLng(storePosition[0], storePosition[1] - radiusMeters / (111320 * Math.cos((storePosition[0] * Math.PI) / 180))));
    }
    mapRef.current.fitBounds(bounds.pad(0.15));
  }

  function showToastMsg(msg: string, type: "success" | "error" | "info" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3800);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  if (!leafletLoaded) {
    return (
      <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-800/50">
        <MapPin className="w-8 h-8 mx-auto text-brand-gold animate-pulse mb-2" />
        <Text className="text-xs text-slate-500 font-semibold">Loading interactive map and spatial boundaries...</Text>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toast */}
      {toast && (
        <div className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all ${
          toast.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800" :
          toast.type === "error" ? "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-800" :
          "bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800"
        }`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" /> :
           toast.type === "error" ? <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" /> :
           <Info className="w-4 h-4 shrink-0 text-blue-600" />}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="p-0.5 hover:bg-black/5 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── STORE LOCATION CONTROLS & UNSAVED PREVIEW BANNER ── */}
      <div className="bg-gradient-to-r from-brand-gold/10 via-brand-gold/10 to-brand-gold/5 dark:from-slate-800 dark:to-slate-800/90 rounded-xl border border-brand-gold/40 dark:border-slate-700 p-3 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-brand-gold text-white rounded-lg shadow-sm">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  🏪 Store Physical Location:
                </span>
                <span className="font-mono text-xs font-bold text-brand-gold-dark dark:text-brand-gold/40 bg-brand-gold-light dark:bg-brand-gold-dark/80 px-2 py-0.5 rounded">
                  {storePosition[0].toFixed(6)}° N, {storePosition[1].toFixed(6)}° E
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Source: <strong className="uppercase">{pendingStoreLocation?.source || locationSource}</strong>
                {pendingStoreLocation?.accuracy ? ` · Accuracy: ±${pendingStoreLocation.accuracy}m` : locationAccuracy ? ` · Accuracy: ±${locationAccuracy}m` : ""}
                {" · "}Radius & distance calculations originate strictly from these coordinates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="small"
              variant="secondary"
              onClick={handleUseCurrentLocation}
              disabled={gpsLoading || readOnly}
              className="text-[11px] font-bold gap-1 bg-white dark:bg-slate-700 hover:bg-slate-50 border border-slate-200 dark:border-slate-600"
            >
              {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-blue-600" />}
              Use Current Location
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={handleStartPickOnMap}
              disabled={readOnly}
              className={`text-[11px] font-bold gap-1 ${
                activeMode === "pick_store"
                  ? "bg-brand-gold text-white hover:bg-brand-gold border-brand-gold"
                  : "bg-white dark:bg-slate-700 hover:bg-slate-50 border border-slate-200 dark:border-slate-600"
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-brand-gold" />
              {activeMode === "pick_store" ? "Click map to place..." : "Pick on Map"}
            </Button>
          </div>
        </div>

        {/* Unsaved Store Location Actions */}
        {pendingStoreLocation && (
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-brand-gold/40 dark:border-slate-700 bg-brand-gold-light/90 dark:bg-brand-gold-dark/40 -mx-3 -mb-3 p-3 rounded-b-xl">
            <div className="flex items-center gap-2 min-w-0">
              <Badge color="orange" className="text-[10px] font-bold animate-pulse">
                Unsaved Location Change
              </Badge>
              <span className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                Preview: {pendingStoreLocation.lat.toFixed(6)}, {pendingStoreLocation.lng.toFixed(6)}
                {pendingStoreLocation.address ? ` (${pendingStoreLocation.address})` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="small"
                onClick={handleCancelStoreLocation}
                variant="secondary"
                disabled={savingLocation}
                className="text-xs font-semibold h-7 px-2.5"
              >
                Cancel
              </Button>
              <Button
                size="small"
                onClick={handleSaveStoreLocation}
                disabled={savingLocation}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-7 px-3 gap-1 shadow-sm"
              >
                {savingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Store Location
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Map Search Bar */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
              placeholder="🔍 Search store location, area, street, landmark..."
              className="w-full pl-9 pr-8 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 focus:border-brand-gold shadow-sm"
            />
            {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold animate-spin" />}
          </div>
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-[1100] mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSearchSelect(r)}
                className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-brand-gold-light/80 dark:hover:bg-slate-700 transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{r.displayName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                      {r.shortName && <span className="font-semibold text-slate-600 dark:text-slate-300">{r.shortName}</span>}
                      {r.city && <span>• {r.city}</span>}
                      {r.state && <span>• {r.state}</span>}
                      {r.pincode && <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">PIN {r.pincode}</span>}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-brand-gold dark:text-brand-gold bg-brand-gold-light dark:bg-brand-gold-dark/60 px-2 py-0.5 rounded shrink-0">
                  Center View
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Search Error State */}
        {searchError && (
          <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* Selected Search Result Action Banner */}
      {selectedSearchResult && (
        <div className="flex items-center justify-between gap-3 p-3 bg-brand-gold-light/90 dark:bg-brand-gold-dark/40 rounded-xl border border-brand-gold/40 dark:border-brand-gold-dark/50 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <MapPin className="w-4 h-4 text-brand-gold shrink-0" />
            <div className="min-w-0">
              <span className="font-bold text-brand-gold-dark dark:text-brand-gold/40 truncate block">
                {selectedSearchResult.displayName}
              </span>
              <span className="text-[10px] text-brand-gold-dark/80 dark:text-brand-gold/80">
                Coords: {selectedSearchResult.latitude.toFixed(6)}, {selectedSearchResult.longitude.toFixed(6)} · Map centered (Store location unchanged)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="small"
              onClick={() => applySearchResultAsStoreLocation(selectedSearchResult)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-brand-gold hover:bg-brand-gold-dark text-white shadow-xs"
            >
              Set as Store Location
            </Button>
            <button
              type="button"
              onClick={() => setSelectedSearchResult(null)}
              className="text-slate-400 hover:text-slate-600 text-xs p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Map Fence Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={startDrawPolygon}
              disabled={activeMode !== "view"}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-colors ${
                activeMode === "polygon" ? "bg-brand-gold text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
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
              {showExclusions ? <Eye className="w-3 h-3 text-emerald-600" /> : <EyeOff className="w-3 h-3 text-slate-400" />}
              Exclusions
            </button>
            <button
              onClick={() => { setShowRadius(!showRadius); }}
              className="px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Circle className="w-3 h-3 text-blue-600" />
              Radius {showRadius ? "On" : "Off"}
            </button>
          </div>

          {showRadius && (
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-slate-500 font-semibold">Radius (km):</Label>
              <Input
                type="number"
                min={0.5}
                max={maxRadiusKm}
                step={0.5}
                value={localRadius}
                onChange={(e) => {
                  const raw = parseFloat(e.target.value);
                  if (isNaN(raw)) return;
                  if (raw > maxRadiusKm) {
                    setLocalRadius(maxRadiusKm);
                    onRadiusChange?.(maxRadiusKm);
                    showToastMsg(`Maximum radius reached (${maxRadiusKm} km). Clamped to allowed limit.`, "error");
                  } else {
                    const clamped = Math.max(0.5, raw);
                    setLocalRadius(clamped);
                    onRadiusChange?.(clamped);
                  }
                  setIsDirty(true);
                }}
                className={`w-16 text-xs ${localRadius >= maxRadiusKm ? "border-rose-400 text-rose-600 font-bold" : ""}`}
              />
              <span className="text-[10px] text-slate-400">/ max {maxRadiusKm} km</span>
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
              className="px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Layers className="w-3 h-3" /> Fit
            </button>
            {isDirty && (
              <button
                onClick={handleSaveFence}
                className="px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
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
          style={{ height: 420, width: "100%", minHeight: 420, zIndex: 1 }}
          className="bg-slate-100 dark:bg-slate-800"
        />

        {/* Drawing / Picking Mode Banner Overlay */}
        {activeMode !== "view" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-black/85 text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-sm shadow-xl">
            {activeMode === "polygon" ? (
              <><Pentagon className="w-3.5 h-3.5 text-brand-gold" /> Click to add polygon points — Double-click to complete</>
            ) : activeMode === "exclusion" ? (
              <><Plus className="w-3.5 h-3.5 text-rose-400" /> Click to add exclusion points — Double-click to complete</>
            ) : (
              <><Crosshair className="w-3.5 h-3.5 text-brand-gold" /> Click anywhere on map to set 🏪 Store Location</>
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
      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-500 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge color={localPolygon.length >= 3 ? "green" : "orange"} className="text-[9px]">
            Polygon: {localPolygon.length >= 3 ? `${localPolygon.length} pts` : "Not drawn"}
          </Badge>
          <Badge color={localExclusions.length > 0 ? "red" : "grey"} className="text-[9px]">
            Exclusions: {localExclusions.length}
          </Badge>
          {showRadius && (
            <Badge color={localRadius >= maxRadiusKm ? "red" : "blue"} className="text-[9px]">
              Radius: {localRadius} km (Centered on Store)
            </Badge>
          )}
        </div>
        <span className="font-mono text-slate-500 dark:text-slate-400">
          Store Pin: {storePosition[0].toFixed(6)}, {storePosition[1].toFixed(6)}
        </span>
      </div>

      {/* Exclusion Zones List */}
      {localExclusions.length > 0 && !readOnly && (
        <div className="space-y-1">
          <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Exclusion Zones</Text>
          {localExclusions.map((ex, idx) => (
            <div key={idx} className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-1.5">
              <span className="text-[10px] font-medium text-rose-700 dark:text-rose-300">
                Exclusion #{idx + 1} — {ex.length} boundary points (Delivery Blocked)
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
