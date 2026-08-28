# Customer Location Resolution & Store Pickup API Contract

## 1. Overview & Core Philosophy

CakeToHome operates as the operating system for modern bakeries. Delivery serviceability, pricing, routing, and ETA are strictly determined by **high-precision geographic coordinates (Latitude & Longitude)** evaluated against authoritative store delivery polygons and radius boundaries. Store Pickup fulfillment is globally governed by Bakery Super Administration and overridden per individual bakery hub.

---

## 2. Architectural Invariants

### 2.1 Store Pickup Fulfillment
1. **Administrative Authority**: Store Pickup availability is controlled via Super Admin (`/api/v1/admin/fulfillment/config` $\rightarrow$ PostgreSQL `public.setting` row `set_fulfillment_config`).
2. **Global Default + Store Override Precedence**:
   - If global `store_pickup_enabled === false`, pickup is completely disabled across the entire storefront regardless of branch status.
   - If global `store_pickup_enabled === true`, individual branch operational status (`is_open !== false`, `pickup_enabled !== false`, `operational_status !== "closed"`) determines whether that specific hub accepts customer collection.
3. **Backend Enforcement**: Rejection is performed server-side with strict error code `STORE_PICKUP_DISABLED` or `BRANCH_PICKUP_DISABLED`. The backend **never** silently converts a pickup request into a home delivery.
4. **Dynamic Fee Model**: Pickup surcharge defaults to ₹0 (FREE) or reflects the configured `store_pickup_convenience_fee` without hardcoding.

### 2.2 Map-First Location Resolution
1. **Coordinates are Authoritative**: Physical delivery point is defined by exact 6-decimal latitude and longitude (`12.971600, 77.641200`). Pincodes are descriptive metadata and reference fallback only.
2. **Decoupled Descriptive Address**: Typing flat number, street name, landmark, or customer notes **never** mutates physical coordinates.
3. **Panning Isolation**: Panning the Leaflet map **never** alters customer coordinates. Only dragging the marker (`dragend`), selecting a search autocomplete result, or clicking GPS ("Use Current Location") mutates coordinates.
4. **Order Snapshots**: All placed orders snapshot `delivery_latitude` and `delivery_longitude` for Rider Google Maps turn-by-turn navigation (`https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`).

---

## 3. API Specifications

### 3.1 Get Fulfillment Configuration
- **Endpoint**: `GET /api/v1/fulfillment/config`
- **Access**: Public / Storefront
- **Response (200 OK)**:
```json
{
  "config": {
    "store_pickup_enabled": true,
    "store_pickup_lead_time_minutes": 30,
    "store_pickup_convenience_fee": 0,
    "max_orders_per_slot": 15,
    "emergency_stop_active": false
  },
  "success": true
}
```

### 3.2 Update Fulfillment Configuration (Super Admin)
- **Endpoint**: `POST /api/v1/admin/fulfillment/config`
- **Access**: Super Admin
- **Payload**:
```json
{
  "store_pickup_enabled": false,
  "store_pickup_lead_time_minutes": 45,
  "store_pickup_convenience_fee": 25
}
```
- **Response (200 OK)**:
```json
{
  "config": {
    "store_pickup_enabled": false,
    "store_pickup_lead_time_minutes": 45,
    "store_pickup_convenience_fee": 25,
    "updated_at": "2026-08-28T14:00:00.000Z"
  },
  "success": true
}
```

### 3.3 Search Delivery Locations
- **Endpoint**: `GET /api/v1/delivery/search-location?q={query}`
- **Access**: Public / Storefront
- **Response (200 OK)**:
```json
{
  "results": [
    {
      "id": "loc_Indiranagar_560038",
      "label": "100 Feet Road, Indiranagar, Bengaluru (560038)",
      "formatted_address": "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
      "area": "Indiranagar",
      "city": "Bengaluru",
      "state": "Karnataka",
      "pincode": "560038",
      "latitude": 12.9716,
      "longitude": 77.6412,
      "branch_id": "br_indiranagar"
    }
  ],
  "success": true
}
```

### 3.4 Checkout Availability Check
- **Endpoint**: `GET /api/v1/store/checkout/availability?lat={lat}&lng={lng}&delivery_type={delivery|pickup}&branch_id={branchId}`
- **Access**: Public / Storefront
- **Response (200 OK - Serviceable Delivery)**:
```json
{
  "success": true,
  "serviceable": true,
  "branch_id": "br_indiranagar",
  "branch_name": "Indiranagar Flagship Kitchen",
  "store_lat": 12.9716,
  "store_lng": 77.6412,
  "distance_km": 3.4,
  "eta_minutes": 35,
  "delivery_type": "delivery",
  "zone_name": "Indiranagar Core Zone",
  "available_delivery_modes": [
    { "id": "standard", "name": "Standard Scheduled Delivery", "enabled": true, "surcharge": 0 },
    { "id": "express", "name": "Express 45-Min Delivery", "enabled": true, "surcharge": 99 },
    { "id": "midnight", "name": "Midnight Surprise Delivery", "enabled": true, "surcharge": 199 },
    { "id": "pickup", "name": "Store Pickup", "enabled": true, "surcharge": 0, "description": "Collect directly from bakery hub (FREE)" }
  ],
  "store_pickup_enabled": true,
  "store_pickup_convenience_fee": 0,
  "pricing": {
    "subtotal": 850,
    "discount": 0,
    "delivery_fee": 0,
    "slot_surcharge": 0,
    "tax": 40.48,
    "grand_total": 850
  }
}
```

### 3.5 Checkout Validation & Error Codes
- **Endpoint**: `POST /api/v1/store/validate-checkout`
- **Error Codes**:
  - `STORE_PICKUP_DISABLED`: Global administrative toggle disables store pickup.
  - `BRANCH_PICKUP_DISABLED`: Target branch does not accept direct customer collection.
  - `STORE_NOT_SERVICEABLE`: Requested coordinates fall outside active bakery delivery polygons.
  - `LOCATION_REQUIRED`: Neither valid coordinates nor 6-digit postal code provided.
