# CakeToHome Delivery Location API Contract

## Table of Contents
1. [Delivery Resolve](#1-delivery-resolve)
2. [Reverse Geocode](#2-reverse-geocode)
3. [Search Location](#3-search-location)
4. [Reason Codes](#4-reason-codes)
5. [Pricing Model](#5-pricing-model)

---

## 1. Delivery Resolve

**Purpose**: Determine if a location is serviceable and return the assigned branch, zone, delivery fee, and ETA.

### `GET /api/v1/delivery/resolve`

| Parameter | Type | Required | Description |
|:---|:---|:---|:---|
| `lat` / `latitude` | `number` | Preferred | Customer latitude (-90 to 90) |
| `lng` / `longitude` | `number` | Preferred | Customer longitude (-180 to 180) |
| `pincode` | `string` | Fallback | 6-digit Indian pincode |

**Priority**: Coordinates take absolute priority. When `lat` + `lng` are provided, pincode is only used for address metadata — NOT for serviceability resolution.

#### Success Response (200)
```json
{
  "success": true,
  "serviceable": true,
  "reasonCode": "SERVICEABLE",
  "stateId": "state_ka",
  "stateName": "Karnataka",
  "stateCode": "KA",
  "cityId": "city_bbr",
  "cityName": "Bengaluru",
  "storeId": "br_indiranagar",
  "storeName": "CakeToHome Indiranagar Kitchen Hub",
  "zoneId": "br_indiranagar_z1",
  "zoneName": "Zone A",
  "pincode": "560038",
  "deliveryFee": 39,
  "etaMinutes": 30,
  "expressAvailable": true,
  "midnightAvailable": true,
  "resolutionTier": "geofence_POLYGON_Zone A"
}
```

#### Not Serviceable Response (200)
```json
{
  "success": false,
  "serviceable": false,
  "reasonCode": "OUTSIDE_DELIVERY_ZONE",
  "blockedReason": "Your location is outside our current bakery delivery coverage zones.",
  "deliveryFee": 0,
  "etaMinutes": 0,
  "expressAvailable": false,
  "midnightAvailable": false,
  "resolutionTier": "unserviceable_coords"
}
```

### `POST /api/v1/delivery/resolve`

Same parameters in request body JSON. Used for checkout confirmation and server-side revalidation.

---

## 2. Reverse Geocode

**Purpose**: Convert GPS coordinates to a human-readable address with delivery serviceability.

### `GET /api/v1/delivery/reverse-geocode`

| Parameter | Type | Required | Description |
|:---|:---|:---|:---|
| `lat` / `latitude` | `number` | Yes | Customer latitude |
| `lng` / `longitude` | `number` | Yes | Customer longitude |

#### Response (200)
```json
{
  "success": true,
  "serviceable": true,
  "reason_code": "SERVICEABLE",
  "formatted_address": "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
  "address_line_1": "100 Feet Road",
  "area": "Indiranagar",
  "city": "Bengaluru",
  "city_id": "city_bbr",
  "state": "Karnataka",
  "state_id": "state_ka",
  "pincode": "560038",
  "latitude": 12.971600,
  "longitude": 77.641200,
  "branch_id": "br_indiranagar",
  "branch_name": "CakeToHome Indiranagar Kitchen Hub",
  "zone_id": "br_indiranagar_z1",
  "zone_name": "Zone A",
  "delivery_fee": 39,
  "eta_minutes": 30,
  "message": "Serviceable from CakeToHome Indiranagar Kitchen Hub"
}
```

---

## 3. Search Location

**Purpose**: Forward search for areas/localities by text query. Returns locations with coordinates for map-first resolution.

### `GET /api/v1/delivery/search-location`

| Parameter | Type | Required | Description |
|:---|:---|:---|:---|
| `q` / `query` | `string` | Yes | Search text (min 2 chars) |

#### Response (200)
```json
{
  "success": true,
  "results": [
    {
      "id": "area_indiranagar",
      "display_name": "Indiranagar, Bengaluru",
      "area_name": "Indiranagar",
      "city_name": "Bengaluru",
      "state_name": "Karnataka",
      "pincode": "560038",
      "latitude": 12.9716,
      "longitude": 77.6412
    }
  ]
}
```

---

## 4. Reason Codes

| Code | Meaning |
|:---|:---|
| `SERVICEABLE` | Location is within an active delivery zone |
| `OUTSIDE_DELIVERY_ZONE` | Coordinates or pincode are outside all active zones |
| `INSIDE_EXCLUSION_ZONE` | Location falls within a restricted exclusion polygon |
| `INVALID_LOCATION` | Invalid coordinates (NaN, out of range, 999.999) or invalid pincode |

---

## 5. Pricing Model

### Flat Rate (Default)
Each zone has a fixed `delivery_charge` applied regardless of exact distance.

### Distance Bracket Pricing
When `pricing_type === "distance_bracket"` on the zone, the fee is resolved from `pricing_brackets`:

```json
{
  "pricing_type": "distance_bracket",
  "pricing_brackets": [
    { "min_km": 0,  "max_km": 3,  "charge": 39,  "label": "0–3 km" },
    { "min_km": 3,  "max_km": 5,  "charge": 49,  "label": "3–5 km" },
    { "min_km": 5,  "max_km": 8,  "charge": 69,  "label": "5–8 km" },
    { "min_km": 8,  "max_km": 12, "charge": 99,  "label": "8–12 km" },
    { "min_km": 12, "max_km": 15, "charge": 149, "label": "12–15 km" }
  ],
  "delivery_charge": 79
}
```

Resolution logic:
1. If `pricing_type === "distance_bracket"` AND `distance_km` is known → match bracket
2. If distance exceeds all brackets → fallback to flat `delivery_charge`
3. Express/midnight/holiday are **additive surcharges** on top of the base fee

### Surcharges (Additive)
| Surcharge | Field | When Applied |
|:---|:---|:---|
| Express | `express_charge` | Express delivery mode selected |
| Midnight | `midnight_charge` | Midnight delivery (23:00–00:05) |
| Holiday | `holiday_charge` | Public holidays or festivals |
| Peak Hour | `peak_hour_charge` | Demand-based dynamic pricing |
| Rain | `rain_charge` | Inclement weather conditions |

### Free Delivery
When `order_total >= free_delivery_threshold`, the entire delivery fee is waived.
