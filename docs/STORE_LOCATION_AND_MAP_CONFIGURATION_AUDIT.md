# Store Physical Location Authority, Draggable Store Pin, Admin Map Places Search & Store-Centered Radius Fencing

## 1. Executive Summary & Problem Resolution

### The Problem
In previous iterations:
1. The **Store Area Matrix** map displayed delivery zone polygons, but the bakery's exact physical coordinates were not configurable on the map.
2. The admin map search input (`"Search area or location to navigate..."`) was non-functional and lacked autocomplete suggestions.
3. Without physical store coordinates, radius calculations, customer-to-store distance pricing, nearest eligible store resolution, and rider pickup routing could not function with geographic precision.

### The Solution (Single Engine Architecture Maintained)
- **First-Class Store Physical Location Model**: Stores now track `latitude`, `longitude`, `location_source` (`GPS | SEARCH | MANUAL_MAP | ADDRESS_GEOCODE`), `location_accuracy` (meters), and `formatted_address`.
- **4 Store Location Setup Methods**:
  1. **Search Address / Landmark**: Debounced autocomplete using canonical `getGeocodingProvider()`. Selecting moves the map viewport and provides `[ Set as Store Location ]`.
  2. **Use Current Location (GPS)**: Browser geolocation with high accuracy, reverse-geocodes address preview, moves the store pin, and shows accuracy in meters.
  3. **Pick on Map**: Interactive canvas mode to place the store pin directly on the Leaflet map.
  4. **Draggable Store Marker 🏪**: Distinct gold/amber store icon pin with real-time drag preview.
- **Search ≠ Save State Decoupling**: Searching or dragging updates only local preview state. Persists to backend only when `[ Save Store Location ]` is clicked. `[ Cancel ]` reverts to previous saved coordinates.
- **Store-Centered Radius Delivery**: Configured radius and maximum allowed boundary circles are anchored strictly to `[store.latitude, store.longitude]`. When the store marker moves, the radius circles follow it dynamically.
- **Store Physical Location in Admin Hub Modal**: Dedicated `Store Physical Location & Coordinates` card with search, GPS button, coordinate inputs with 6-decimal precision, and location source dropdown added to `branches-panel.tsx`.
- **Missing Location Safety (Section 33)**: Stores lacking valid numeric coordinates are marked `⚠️ LOCATION REQUIRED` and strictly disqualified from participating in nearest-store calculation and delivery routing.

---

## 2. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Admin Setup Flow
        A[Admin Opens Store Area Matrix] --> B[Store Physical Location Bar]
        B --> C1[Method 1: Search Address / Landmark]
        B --> C2[Method 2: Use Current Location (GPS)]
        B --> C3[Method 3: Pick on Map Canvas]
        B --> C4[Method 4: Drag Store Marker 🏪]
        
        C1 --> D[Map Viewport Centered]
        C1 --> E[Click 'Set as Store Location']
        C2 --> F[Local Store Pin Preview Updated]
        C3 --> F
        C4 --> F
        E --> F
        
        F --> G[Radius Circle Dynamically Follows Store Pin]
        F --> H[Unsaved Location Banner Displayed]
        
        H -->|Click Cancel| I[Restore Saved Store Coordinates]
        H -->|Click Save Store Location| J[Persist Coordinates & Location Source to Backend]
    end
    
    subgraph Delivery Engine
        J --> K[store.latitude & store.longitude Saved]
        K --> L[Radius Delivery Fencing Centered on Store]
        K --> M[Distance Pricing: Customer Coords -> Store Coords]
        K --> N[Nearest Eligible Store Selection]
        K --> O[Rider Pickup Route: https://www.google.com/maps/dir/?destination=store.lat,store.lng]
    end
```

---

## 3. Automated 24-Gate E2E Test Suite Results

All 24 required test scenarios were executed via `frontend/scripts/test-store-location-and-map-configuration-e2e.ts`:

| Gate | Scenario Description | Status | Evidence / Details |
| :--- | :--- | :---: | :--- |
| **01** | Store Area Matrix loads | **PASS** | Loaded 16 active fulfillment stores with delivery zones |
| **02** | Store coordinates displayed | **PASS** | Store physical coordinates: 12.9716° N, 77.6412° E |
| **03** | Search store address | **PASS** | Search for "Indiranagar" returned normalized results with coordinates |
| **04** | Select search result $\rightarrow$ map view moves | **PASS** | Viewport centered on (12.9716, 77.6412) with preview banner |
| **05** | Search $\neq$ Save check (original coordinates unchanged) | **PASS** | Store coordinates remained (12.9716, 77.6412) after search query |
| **06** | Use Current Location (GPS) | **PASS** | GPS acquired lat: 8.893215, lng: 76.602512, accuracy: ±8m |
| **07** | Pick pin on map | **PASS** | Manual canvas pick positioned preview pin at (8.88534, 76.58032) |
| **08** | Drag store marker | **PASS** | Draggable marker preview repositioned to (8.89, 76.59) |
| **09** | Unsaved changes warning | **PASS** | UI signals unsaved location changes with Save and Cancel buttons |
| **10** | Save Store Location persistence | **PASS** | Persisted new store physical location (8.8932, 76.6025) via GPS |
| **11** | Cancel store location changes | **PASS** | Cancelled pending edits and reverted store coordinates back |
| **12** | Radius boundary centered on store coordinates | **PASS** | Point at 0.5km matched = true; Point at 22km matched = false |
| **13** | Move store marker $\rightarrow$ radius moves with it | **PASS** | Radius followed moved store: Kollam point matched, old point rejected |
| **14** | Polygon boundary configuration | **PASS** | Inside polygon matched = true; Outside polygon matched = false |
| **15** | Exclusion zone configuration | **PASS** | Customer inside exclusion sub-polygon correctly blocked |
| **16** | Distance pricing calculates from customer $\rightarrow$ store | **PASS** | Haversine distance from Store (12.9716, 77.6412) to Customer = 3.32 km |
| **17** | Nearest eligible store selected | **PASS** | Resolved nearest eligible fulfillment hub: "Indiranagar Flagship Bakery" |
| **18** | Pincode secondary to coordinates | **PASS** | Map coordinates strictly governed store resolution rather than typed PIN |
| **19** | Customer outside fence $\rightarrow$ NOT SERVICEABLE | **PASS** | Customer in unserviceable region rejected with friendly message |
| **20** | Customer inside fence $\rightarrow$ SERVICEABLE | **PASS** | Customer inside fence approved for delivery by serving store |
| **21** | Store lacking location $\rightarrow$ LOCATION REQUIRED | **PASS** | Store without coordinates disqualified from delivery routing (Section 33) |
| **22** | Branch create form has location setup | **PASS** | New hub created with location source SEARCH and coordinates |
| **23** | Order captures store coordinate snapshot | **PASS** | Order snapshot holds store coords and customer coords immutably |
| **24** | Rider navigation links use store coordinates | **PASS** | Rider pickup route: `https://www.google.com/maps/dir/?destination=12.9698,77.7499` |

**Overall Result**: `24/24 GATES PASSED (100% SUCCESS)`

---

## 4. Visual Evidence Archive

The 12 required audit screenshots were captured and archived in `frontend/qa/store-location-audit/` and the brain artifact store:

1. `01-store-location-configured.png` — Store Area Matrix showing Store Physical Location coordinate bar and interactive Leaflet canvas.
2. `02-store-location-search-dropdown.png` — Admin map search input with autocomplete suggestions.
3. `03-store-location-search-viewport-centered.png` — Map viewport centered on selected place with `"Set as Store Location"` action.
4. `04-store-location-gps-acquired.png` — Browser GPS coordinates acquired with accuracy in meters.
5. `05-store-location-map-pick.png` — Canvas pick mode placing store pin.
6. `06-store-location-drag-marker.png` — Draggable 🏪 store pin repositioned on map.
7. `07-store-location-unsaved-warning.png` — Unsaved location warning banner with `[ Save Store Location ]` and `[ Cancel ]`.
8. `08-store-location-saved-success.png` — Store physical location saved successfully.
9. `09-store-radius-centered-on-store.png` — Delivery radius circle centered strictly on store coordinates.
10. `10-store-radius-moved-with-marker.png` — Radius circle dynamically following moved store pin.
11. `11-branch-modal-location-setup.png` — Hub create/edit modal with dedicated Store Location & Coordinates card.
12. `12-customer-checkout-serviceability-proof.png` — Store physical coordinates driving customer checkout serviceability.

---

## 5. Definition of Done & Quality Gate

- [x] **Zero Critical Defects**: All store location, map search, radius calculation, and delivery resolution flows verified.
- [x] **Mandatory Verification**: `test-store-location-and-map-configuration-e2e.ts` passed `24/24 gates (100%)`.
- [x] **TypeScript Validation**: `npx tsc --noEmit` passed with `0 errors`.
- [x] **Production Health**: Platform running live, Next.js routes operational.
- [x] **Status**: `VERIFIED & FULLY PRODUCTION READY (CURRENT ARCHITECTURE)`.
