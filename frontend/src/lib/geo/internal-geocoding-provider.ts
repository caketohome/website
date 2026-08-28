/**
 * Internal Geocoding Provider
 * 
 * Implements GeocodingProvider using the existing ApiEngine internal locality database
 * and delivery resolver. This provider works offline/locally without external API calls.
 * 
 * To upgrade to a commercial provider (Google Places, Mapbox, etc.),
 * create a new provider class implementing GeocodingProvider and swap in index.ts.
 */

import type { GeocodingProvider, PlaceResult, ReverseGeocodeResult } from "./geocoding-provider";

export class InternalGeocodingProvider implements GeocodingProvider {
  readonly name = "internal";

  async searchPlaces(
    query: string,
    context?: {
      lat?: number;
      lng?: number;
      sessionId?: string;
      limit?: number;
      countryCode?: string;
    }
  ): Promise<PlaceResult[]> {
    if (!query || query.trim().length < 2) return [];

    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (context?.limit) params.set("limit", String(context.limit));
      
      const res = await fetch(`/api/v1/delivery/search-location?${params.toString()}`);
      if (!res.ok) return [];

      const data = await res.json();
      const results: PlaceResult[] = (data.results || []).map((r: any, idx: number) => ({
        id: r.id || `internal_${idx}_${Date.now()}`,
        displayName: r.display_name || r.formatted_address || r.name || r.area_name || query,
        shortName: r.area_name || r.locality || r.name,
        latitude: typeof r.latitude === "number" ? r.latitude : (typeof r.lat === "number" ? r.lat : 0),
        longitude: typeof r.longitude === "number" ? r.longitude : (typeof r.lng === "number" ? r.lng : 0),
        city: r.city || r.city_name || "",
        state: r.state || r.state_name || "",
        pincode: r.pincode || "",
        formattedAddress: r.formatted_address || r.display_name || "",
        confidence: r.confidence || 0.8,
        metadata: { provider: "internal", source: r },
      }));

      return results;
    } catch {
      return [];
    }
  }

  async reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
    // Validate coordinates
    if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        success: false,
        formattedAddress: "",
        addressLine1: "",
        area: "",
        city: "",
        state: "",
        pincode: "",
        latitude: lat,
        longitude: lng,
        message: "Invalid coordinates",
      };
    }

    try {
      const res = await fetch(`/api/v1/delivery/reverse-geocode?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
      if (!res.ok) {
        return {
          success: false,
          formattedAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          addressLine1: "",
          area: "",
          city: "",
          state: "",
          pincode: "",
          latitude: lat,
          longitude: lng,
          message: "Reverse geocoding failed",
        };
      }

      const data = await res.json();
      return {
        success: data.success !== false,
        formattedAddress: data.formatted_address || "",
        addressLine1: data.address_line_1 || "",
        area: data.area || "",
        city: data.city || "",
        state: data.state || "",
        pincode: data.pincode || "",
        latitude: data.latitude ?? lat,
        longitude: data.longitude ?? lng,
        serviceable: data.serviceable,
        reasonCode: data.reason_code,
        branchId: data.branch_id,
        branchName: data.branch_name,
        zoneId: data.zone_id,
        zoneName: data.zone_name,
        deliveryFee: data.delivery_fee,
        etaMinutes: data.eta_minutes,
        message: data.message,
      };
    } catch {
      return {
        success: false,
        formattedAddress: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        addressLine1: "",
        area: "",
        city: "",
        state: "",
        pincode: "",
        latitude: lat,
        longitude: lng,
        message: "Network error during reverse geocoding",
      };
    }
  }
}
