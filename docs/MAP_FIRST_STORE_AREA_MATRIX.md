# Map-First Store Area Matrix & Delivery Engine Documentation

## Executive Overview

CakeToHome has rebuilt the Super Admin **Store Area Matrix** as the **central delivery-area configuration screen**, transforming the delivery management workflow from pincode-first to **map-first**.

In this architecture:
- Geographic delivery boundaries configured on the interactive map (**Polygon** with exclusion perimeters and **Radius** centered on the store) are **strictly authoritative**.
- Customer coordinates are resolved directly against store map fences.
- **Pincodes are strictly secondary supporting metadata** for address autocomplete, search, and legacy order resolution when GPS coordinates are omitted.
- **CRITICAL PINCODE BYPASS GUARANTEE**: If a customer provides a valid matching pincode but their GPS coordinates are outside the configured map fence, the serviceability resolver strictly returns **`NOT SERVICEABLE`**. Pincodes never bypass map boundaries.

---

## Architectural Principles

1. **No Duplicate Engines**: CakeToHome does NOT create a second map-fencing engine. All resolution leverages the unified `ApiEngine.resolveSmartBranch` and `ApiEngine.resolveDeliveryContext` pipelines.
2. **Preservation of Existing Data**: Legacy pincode mappings, branch pincodes, and city areas are preserved 100% for secondary address fallback.
3. **Multi-Tier Limit Hierarchy**:
   - **Global Platform Ceiling**: 25 km hard ceiling.
   - **Store Maximum Delivery Radius**: Configured per store (`branch.max_delivery_radius_km`).
   - **Zone Serviceable Radius**: Configured per delivery area (`zone.max_serviceable_km`, `zone.radius_km`).
   - **Effective Radius**: `min(25, store_max, zone_max)`.
4. **Distance Pricing inside Store Area Matrix**:
   - Distance brackets (e.g. 0–3 km ₹39, 3–5 km ₹49, 5–8 km ₹69, 8–10 km ₹99) are validated against the effective radius: no bracket upper limit may exceed the allowed service boundary.

---

## Screen Architecture

### 1. Store Area Matrix Header
- Store Selector: Switch between bakery branches.
- Store Identity Card:
  - Store Name, Code, State, City.
  - GPS Coordinates: Latitude & Longitude with 📍 pin.
  - Store Maximum Service Radius setting with Shield icon, validation, and dynamic slider/input.
- Action: `[ + Add Delivery Area ]`.

### 2. Delivery Areas Matrix Table
| Column | Description |
|---|---|
| **Zone / Area Name** | Delivery area identifier and priority badge |
| **Boundary Type** | `Polygon`, `Radius`, or `Hybrid` |
| **Radius / Geometry** | Radius in km or Polygon vertices count (+ exclusions) |
| **Delivery Pricing** | Distance Brackets count or Flat Rate |
| **Delivery Modes** | SameDay, Express, Midnight, Slot badges |
| **Priority** | Numerical priority (lower number = higher priority) |
| **Status** | Toggle `ON` / `OFF` |
| **Actions** | Edit Map & Rules, Duplicate Zone, Delete Zone |

### 3. Map-First Delivery Area Editor Modal
When adding or editing a delivery area:
1. **Interactive Map Front & Center**: Embedded `MapFenceEditor` with full Leaflet interactivity.
2. **Radius Mode**:
   - Store marker 🏪 + live radius circle.
   - Allowed maximum boundary circle (dashed red `#ef4444`).
   - Radius slider and input dynamically clamped to effective store limit.
   - Constraint status bar: `Current radius: X km | Max radius: Y km | Remaining: Z km`.
3. **Polygon Mode**:
   - Draw polygon boundaries with Leaflet drawing tools.
   - Sub-exclusion perimeters for unserviceable enclaves (lakes, military zones, restricted complexes).
4. **Distance Pricing Brackets Editor**:
   - Mode: `( ) Flat Rate` vs `( ) Distance Brackets`.
   - Editable rows: `min_km`, `max_km`, `charge`.
   - Validated: `bracket.max_km <= effective_radius`.
5. **Delivery Modes & Rules**:
   - Same-day, Express, Midnight, Instant, Scheduled toggles & surcharges.
   - Estimated delivery minutes, kitchen prep buffer, minimum order value, free delivery threshold.

### 4. Secondary Address & Pincode Fallback Tab
- Reframed from the old "Pincode Matrix".
- Clearly labeled with informational banner:
  > **Address & Pincode Fallback Data**: Pincodes are maintained for address autocomplete, search, and legacy order resolution where GPS coordinates are omitted. Primary delivery serviceability is strictly determined by map boundaries (Polygon & Radius) configured in the Store Area Matrix.

---

## Customer Checkout Experience

- **Customer selects location, not internal zones**: Customers never see internal zone names (e.g. "Zone A", "Zone 1", "Central Geofence").
- **Checkout Location Flow**:
  1. `DELIVER TO`
  2. `[ Use Current Location ]` (GPS auto-detection)
  3. `[ Search Area, Landmark, or Complex ]`
  4. `[ Saved Addresses ]`
  5. **Interactive Checkout Map**: Leaflet map with draggable customer pin 📍 and serving store pin 🏪.
  6. **Authoritative Feedback**:
     - `Checking bakery delivery coverage & map-fence serviceability...`
     - `✓ Delivery Available (Serving from Kollam Central Cake Studio)`
     - `❌ We currently don't deliver to this location`

---

## Canonical API Response Contract

### `POST /api/v1/delivery/resolve`

#### Request Payload
```json
{
  "latitude": 12.9780,
  "longitude": 77.6400,
  "pincode": "560038"
}
```

#### Serviceable Response (200 OK)
```json
{
  "serviceable": true,
  "reason_code": "SERVICEABLE",
  "store": {
    "id": "br_indiranagar",
    "name": "Indiranagar Flagship Kitchen"
  },
  "zone": {
    "id": "zone_1",
    "name": "Central Core Zone"
  },
  "distance_km": 1.48,
  "delivery_fee": 39,
  "pricing_mode": "distance_bracket",
  "bracket": "0–3 km",
  "available_delivery_modes": ["standard", "same_day", "express", "midnight"],
  "available_slots": [...],
  "success": true
}
```

#### Unserviceable Response (200 OK with `serviceable: false`)
```json
{
  "serviceable": false,
  "reason_code": "OUTSIDE_DELIVERY_ZONE",
  "blockedReason": "Your location is outside our current bakery delivery coverage zones.",
  "store": null,
  "zone": null,
  "distance_km": null,
  "delivery_fee": 0,
  "pricing_mode": null,
  "bracket": null,
  "available_delivery_modes": [],
  "available_slots": [],
  "success": false
}
```
