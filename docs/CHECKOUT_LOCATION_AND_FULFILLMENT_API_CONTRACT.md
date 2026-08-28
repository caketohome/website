# CakeToHome — Authoritative Checkout Location & Fulfillment API Contract

## Overview
This document defines the production API specification, request/response schemas, error definitions, caching strategies, and PostgreSQL database sources for the **Map-First Customer Location & Store Pickup Governance Architecture** in CakeToHome.

---

## 1. Fulfillment Configuration

### `GET /api/v1/fulfillment/config`
Retrieves the global store fulfillment settings, pickup enablement status, lead time, and convenience fees.

- **Authentication**: Optional / Public
- **HTTP Method**: `GET`
- **Cache Policy**: `Cache-Control: private, no-cache` (invalidated upon Admin update)
- **Database Source**: PostgreSQL `public.setting` (`group = 'fulfillment'`, `key = 'config'`)

#### Response (`200 OK`)
```json
{
  "config": {
    "store_pickup_enabled": true,
    "store_pickup_convenience_fee": 0,
    "store_pickup_lead_time_minutes": 30,
    "home_delivery_enabled": true,
    "same_day_cutoff_time": "20:00",
    "updated_at": "2026-08-28T17:40:00.000Z"
  },
  "operating_hours": [],
  "holidays": [],
  "success": true
}
```

---

### `POST /api/v1/admin/fulfillment/config`
Updates the global fulfillment rules and kitchen collection settings.

- **Authentication**: Required (`ADMIN` / `SUPER_ADMIN`)
- **HTTP Method**: `POST`
- **Database Target**: PostgreSQL `public.setting` (`group = 'fulfillment'`, `key = 'config'`)

#### Request Body
```json
{
  "store_pickup_enabled": false,
  "store_pickup_convenience_fee": 25,
  "store_pickup_lead_time_minutes": 45
}
```

#### Response (`200 OK`)
```json
{
  "config": {
    "store_pickup_enabled": false,
    "store_pickup_convenience_fee": 25,
    "store_pickup_lead_time_minutes": 45,
    "updated_at": "2026-08-28T17:45:00.000Z"
  },
  "success": true
}
```

---

## 2. Real Map-First Location Search

### `GET /api/v1/delivery/search-location`
Searches for delivery destinations (localities, areas, landmarks, buildings, malls, streets, cities, and pincodes) returning normalized geographic coordinates.

- **Authentication**: Optional / Public
- **HTTP Method**: `GET`
- **Query Parameters**:
  - `q` (string, required, min 2 chars): Search query string (e.g. `"Indiranagar"`, `"Kollam Junction"`, `"Marine Drive"`)
  - `limit` (number, optional, default: 15): Maximum results to return
  - `lat` / `lng` (number, optional): User coordinate bias
- **Cache Policy**: In-memory server LRU cache with 30-minute TTL per query

#### Response (`200 OK`)
```json
{
  "results": [
    {
      "id": "loc_Chinnakada_691001",
      "label": "Chinnakada Clock Tower, Kollam (691001)",
      "formatted_address": "Chinnakada Clock Tower, Kollam, Kerala 691001",
      "area": "Chinnakada",
      "city": "Kollam",
      "state": "Kerala",
      "pincode": "691001",
      "latitude": 8.8853,
      "longitude": 76.5803,
      "branch_id": "br_kollam_hub"
    }
  ],
  "success": true
}
```

---

## 3. Reverse Geocoding

### `GET /api/v1/delivery/reverse-geocode`
Converts GPS coordinates into human-readable address components and real-time delivery serviceability.

- **Authentication**: Optional / Public
- **HTTP Method**: `GET`
- **Query Parameters**:
  - `lat` (number, required): Latitude between -90 and 90
  - `lng` (number, required): Longitude between -180 and 180

#### Response (`200 OK`)
```json
{
  "success": true,
  "serviceable": true,
  "reason_code": "SERVICEABLE",
  "formatted_address": "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
  "address_line_1": "100 Feet Road",
  "area": "Indiranagar",
  "city": "Bengaluru",
  "state": "Karnataka",
  "pincode": "560038",
  "latitude": 12.9716,
  "longitude": 77.6412,
  "branch_id": "br_indiranagar",
  "branch_name": "Indiranagar Flagship Kitchen",
  "zone_id": "zone_ind_01",
  "zone_name": "Core Hub Zone",
  "delivery_fee": 0,
  "eta_minutes": 35,
  "message": "Serviceable from Indiranagar Flagship Kitchen"
}
```

---

## 4. Delivery Availability & Resolver

### `POST /api/v1/checkout/availability` or `GET /api/v1/delivery/resolve`
Evaluates map polygon and radius boundaries, exclusion areas, distance tiers, serving hub, and slot capacity.

- **Authentication**: Optional / Public
- **HTTP Method**: `POST` (or `GET` with query string)

#### Request Payload
```json
{
  "cart_id": "cart_12345",
  "delivery_type": "delivery",
  "latitude": 12.9716,
  "longitude": 77.6412,
  "pincode": "560038",
  "date": "2026-08-28"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "serviceable": true,
  "branch_id": "br_indiranagar",
  "branch_name": "Indiranagar Flagship Kitchen",
  "store_lat": 12.9716,
  "store_lng": 77.6412,
  "distance_km": 1.8,
  "eta_minutes": 35,
  "delivery_type": "delivery",
  "zone_name": "Indiranagar Core Zone",
  "status_message": "Delivering fresh from Indiranagar Flagship Kitchen",
  "available_slots": [
    { "id": "SLOT_MORNING", "label": "Morning (09:00 AM - 12:00 PM)", "available": true, "surcharge": 0 }
  ],
  "pricing": {
    "subtotal": 899,
    "delivery_fee": 0,
    "total": 899
  }
}
```

---

## 5. Checkout Validation

### `POST /api/v1/checkout/validate`
Authoritatively verifies cart items, stock, product max delivery distance restrictions, and fulfillment modes before payment.

- **Authentication**: Optional / Customer
- **HTTP Method**: `POST`

#### Validation Error Codes:
| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `STORE_PICKUP_DISABLED` | 400 | Global pickup disabled in Super Admin fulfillment config |
| `BRANCH_PICKUP_DISABLED` | 400 | Selected bakery hub does not support pickup collection |
| `STORE_NOT_SERVICEABLE` | 400 | Coordinates fall outside delivery fences or within exclusion zone |
| `PRODUCT_DISTANCE_EXCEEDED` | 400 | Customer distance exceeds product-level max delivery distance limit |
| `INVALID_COORDINATES` | 400 | Coordinates outside [-90, 90] lat or [-180, 180] lng range |

---

## 6. Order Placement Snapshot

### `POST /api/v1/checkout/confirm`
Finalizes the checkout transaction, snapshots coordinates, and stores immutable order records in PostgreSQL.

- **Database Target**: PostgreSQL `public.order`

#### Persisted Entity Snapshot:
```json
{
  "id": "ord_1787912345",
  "order_number": "CTH-20260828-101",
  "delivery_latitude": 12.971583,
  "delivery_longitude": 77.641208,
  "location_source": "SEARCH",
  "delivery_address": "Flat 402, Golden Palms, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
  "delivery_city": "Bengaluru",
  "delivery_state": "Karnataka",
  "delivery_pincode": "560038",
  "store_id": "br_indiranagar",
  "store_name": "Indiranagar Flagship Kitchen",
  "distance_km": 1.82,
  "delivery_fee": 0,
  "delivery_mode": "delivery"
}
```

#### Rider Turn-by-Turn Navigation URL:
```
https://www.google.com/maps/dir/?api=1&destination=12.971583,77.641208
```
Direct Google Maps deep-link using exact 6-decimal sub-meter coordinates. Zero re-geocoding.
