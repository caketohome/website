/**
 * Canonical Google Maps Directions and Delivery Navigation Utility for CakeToHome.
 * Ensures consistent, safe, and mobile-optimized Google Maps navigation URLs across:
 * - Delivery Partner / Rider Cards
 * - Store / Branch Kitchen Terminals
 * - Admin Order Command Center
 * - Customer Live Order Tracking
 */

export interface GoogleMapsDirectionsParams {
  latitude?: number | null | string;
  longitude?: number | null | string;
  address?: string | null;
  pincode?: string | null;
  label?: string | null;
}

/**
 * Validates whether latitude and longitude are valid, real geographic coordinates.
 * Rejects NaN, undefined, infinite values, 0/0 mock points, and 999.999 placeholders.
 */
export function isValidCoordinate(latitude?: any, longitude?: any): boolean {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    return false;
  }
  const lat = typeof latitude === "number" ? latitude : parseFloat(String(latitude));
  const lng = typeof longitude === "number" ? longitude : parseFloat(String(longitude));

  if (isNaN(lat) || isNaN(lng)) return false;
  if (!isFinite(lat) || !isFinite(lng)) return false;

  // Reject placeholder values
  if (lat === 999.999 || lng === 999.999) return false;
  if (lat === 0 && lng === 0) return false;

  // Valid geographic range
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;

  return true;
}

/**
 * Builds a Google Maps Directions URL where the customer's delivery location is the DESTINATION.
 * When a rider taps this on a mobile device:
 * - The device opens Google Maps with the rider's current GPS location as the starting point.
 * - The destination is locked to the customer's exact delivery coordinates (or verified address fallback).
 */
export function buildGoogleMapsDirectionsUrl(params: GoogleMapsDirectionsParams): string {
  const { latitude, longitude, address, pincode } = params;

  if (isValidCoordinate(latitude, longitude)) {
    const lat = typeof latitude === "number" ? latitude : parseFloat(String(latitude));
    const lng = typeof longitude === "number" ? longitude : parseFloat(String(longitude));
    // Precise numeric coordinates formatted to 6 decimal places (sub-meter accuracy)
    return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
  }

  // Address fallback for historical orders without GPS coordinates
  const addressQuery = [address, pincode]
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join(", ");

  if (addressQuery) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressQuery)}`;
  }

  return "https://www.google.com/maps";
}

/**
 * Builds a Google Maps Search / Pin View URL (for viewing a location pin on map).
 */
export function buildGoogleMapsViewUrl(params: GoogleMapsDirectionsParams): string {
  const { latitude, longitude, address, pincode } = params;

  if (isValidCoordinate(latitude, longitude)) {
    const lat = typeof latitude === "number" ? latitude : parseFloat(String(latitude));
    const lng = typeof longitude === "number" ? longitude : parseFloat(String(longitude));
    return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
  }

  const addressQuery = [address, pincode]
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join(", ");

  if (addressQuery) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressQuery)}`;
  }

  return "https://www.google.com/maps";
}

/**
 * Extracts delivery destination coordinates safely from any order, delivery job, or address record.
 */
export function extractDeliveryCoordinates(entity: any): { latitude?: number; longitude?: number; hasCoords: boolean } {
  if (!entity) return { hasCoords: false };

  const candidates = [
    { lat: entity.delivery_latitude, lng: entity.delivery_longitude },
    { lat: entity.latitude, lng: entity.longitude },
    { lat: entity.lat, lng: entity.lng },
    { lat: entity.order?.delivery_latitude, lng: entity.order?.delivery_longitude },
    { lat: entity.order?.shipping_address?.latitude, lng: entity.order?.shipping_address?.longitude },
    { lat: entity.shipping_address?.latitude, lng: entity.shipping_address?.longitude },
    { lat: entity.address?.latitude, lng: entity.address?.longitude },
  ];

  for (const c of candidates) {
    if (isValidCoordinate(c.lat, c.lng)) {
      const lat = typeof c.lat === "number" ? c.lat : parseFloat(String(c.lat));
      const lng = typeof c.lng === "number" ? c.lng : parseFloat(String(c.lng));
      return { latitude: lat, longitude: lng, hasCoords: true };
    }
  }

  // Address string GPS pattern parser fallback, e.g. "GPS (8.8855, 76.5804), Kollam, Kerala"
  const addressStrings = [
    entity.delivery_address,
    entity.delivery_address_line_1,
    entity.recipient_address,
    entity.address,
    entity.order?.delivery_address,
    entity.order?.shipping_address?.address_1,
  ].filter((s): s is string => typeof s === "string" && s.length > 0);

  for (const addr of addressStrings) {
    const gpsMatch = addr.match(/GPS\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
    if (gpsMatch) {
      const lat = parseFloat(gpsMatch[1]);
      const lng = parseFloat(gpsMatch[2]);
      if (isValidCoordinate(lat, lng)) {
        return { latitude: lat, longitude: lng, hasCoords: true };
      }
    }
  }

  return { hasCoords: false };
}
