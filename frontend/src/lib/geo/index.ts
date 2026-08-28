/**
 * Geocoding Module — Singleton Provider
 * 
 * Exports the active GeocodingProvider instance.
 * To switch providers (e.g., from internal to Google Places), replace the
 * provider implementation here. All consumers import from this index.
 */

export type { GeocodingProvider, PlaceResult, ReverseGeocodeResult } from "./geocoding-provider";
export { InternalGeocodingProvider } from "./internal-geocoding-provider";

import { InternalGeocodingProvider } from "./internal-geocoding-provider";
import type { GeocodingProvider } from "./geocoding-provider";

/** Active geocoding provider singleton */
let _provider: GeocodingProvider | null = null;

/**
 * Returns the active geocoding provider.
 * Default: InternalGeocodingProvider (uses existing ApiEngine locality DB).
 * 
 * To use Google Places or Mapbox:
 *   import { setGeocodingProvider } from "@frontend/lib/geo";
 *   setGeocodingProvider(new GooglePlacesProvider(apiKey));
 */
export function getGeocodingProvider(): GeocodingProvider {
  if (!_provider) {
    _provider = new InternalGeocodingProvider();
  }
  return _provider;
}

/**
 * Replace the active geocoding provider.
 * Call this during app initialization if using a commercial provider.
 */
export function setGeocodingProvider(provider: GeocodingProvider): void {
  _provider = provider;
}
