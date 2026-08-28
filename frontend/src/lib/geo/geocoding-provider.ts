/**
 * Geocoding Provider Interface
 * 
 * Abstraction layer for geocoding (forward and reverse) services.
 * Allows swapping between providers (internal locality DB, Google Places, Mapbox, Geoapify)
 * without modifying application code.
 * 
 * IMPORTANT: Do NOT use public Nominatim autocomplete.
 * The official Nominatim policy prohibits client-side autocomplete and imposes strict usage restrictions.
 */

/** Result from a forward geocoding / place search */
export interface PlaceResult {
  /** Unique ID (provider-specific) */
  id: string;
  /** Display name / formatted address */
  displayName: string;
  /** Short name (area/locality) */
  shortName?: string;
  /** Latitude */
  latitude: number;
  /** Longitude */
  longitude: number;
  /** City name */
  city?: string;
  /** State name */
  state?: string;
  /** Pincode */
  pincode?: string;
  /** Full formatted address */
  formattedAddress?: string;
  /** Confidence score 0-1 */
  confidence?: number;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/** Result from reverse geocoding */
export interface ReverseGeocodeResult {
  success: boolean;
  /** Formatted human-readable address */
  formattedAddress: string;
  /** Address components */
  addressLine1: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  /** Coordinates */
  latitude: number;
  longitude: number;
  /** Delivery serviceability (when provider supports it) */
  serviceable?: boolean;
  reasonCode?: string;
  branchId?: string | null;
  branchName?: string | null;
  zoneId?: string | null;
  zoneName?: string | null;
  deliveryFee?: number;
  etaMinutes?: number;
  message?: string;
}

/**
 * Geocoding Provider Contract.
 * All geocoding implementations MUST conform to this interface.
 */
export interface GeocodingProvider {
  /** Provider name for logging/debugging */
  readonly name: string;

  /**
   * Forward geocoding: search for places by text query.
   * Returns an array of matching locations with coordinates.
   * 
   * @param query - Search text (e.g., "Indiranagar, Bengaluru")
   * @param context - Optional context to bias results (nearby lat/lng, session ID for billing)
   * @returns Array of place results, ordered by relevance
   */
  searchPlaces(
    query: string,
    context?: {
      /** Bias results near this latitude */
      lat?: number;
      /** Bias results near this longitude */
      lng?: number;
      /** Session token for provider billing optimization (e.g., Google Places session) */
      sessionId?: string;
      /** Maximum number of results */
      limit?: number;
      /** Country code to restrict results (e.g., "IN") */
      countryCode?: string;
    }
  ): Promise<PlaceResult[]>;

  /**
   * Reverse geocoding: convert coordinates to human-readable address.
   * 
   * @param lat - Latitude
   * @param lng - Longitude
   * @returns Reverse geocode result with address components
   */
  reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult>;
}
