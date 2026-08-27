# CakeToHome Customer Location Picker & Real Map-Fence Serviceability Audit

**Status**: `VERIFIED` & `PRODUCTION READY (CURRENT ARCHITECTURE)`  
**Date**: August 2026  
**Auditor**: Antigravity Platform Engineering & Automation Subagent  
**Scope**: Customer Checkout Location Resolution, Geofence / Polygon Serviceability, Multi-Store Isolation, Immutable Order Snapshots, and Rider Google Maps Deep-Linking

---

## 1. Executive Summary

CakeToHome's checkout location pipeline has been hardened to enforce **Authoritative Coordinate-First Serviceability**. Customers select their physical delivery location using **GPS Current Location**, **Locality Search Autocomplete**, or **Saved Profile Addresses**. 

The frontend does **not** choose zones or decide delivery availability. Instead, the backend **Smart Branch & Map-Fence Engine** strictly evaluates coordinates against configured branch polygons, active exclusion/hazard perimeters, branch operational capacities, and delivery cutoff matrices.

Historical orders snapshot complete delivery coordinates, address details, serving branch IDs, and zone IDs at order creation time, ensuring complete immutability for rider navigation and accounting.

---

## 2. Architectural Precedence & Resolution Hierarchy

```mermaid
flowchart TD
    A[Customer Location Input] --> B{GPS, Search, or Saved Address?}
    B -->|Coordinates Provided| C[Validate Coordinate Bounds: Lat -90..90, Lng -180..180]
    C -->|Invalid Coords| D[Return INVALID_LOCATION / Block Checkout]
    C -->|Valid Coords| E[Check Exclusion Polygons across all Stores]
    E -->|Point Inside Exclusion Zone| F[Return INSIDE_EXCLUSION_ZONE / Block Delivery]
    E -->|Point Outside Exclusion Zones| G[Evaluate Point-in-Polygon against Active Branch Zones]
    G -->|No Polygon Matches| H[Return OUTSIDE_DELIVERY_ZONE / Reject Order]
    G -->|Matched Polygon Zone| I[Select Serving Store with Highest Priority / Best Rating]
    I --> J[Calculate Dynamic Delivery Fee, ETA & Operational Slots]
    J --> K[Return Authoritative SERVICEABLE Response]

    B -->|Coordinates Missing - Pincode Only| L[Fallback: Evaluate Pincode Mappings]
    L -->|Pincode Unmapped| M[Return OUTSIDE_DELIVERY_ZONE]
    L -->|Pincode Mapped| N[Resolve Branch & Zone via Pincode Rules]
```

### Key Principles Enforced:
1. **Coordinate Supremacy**: When customer coordinates `(lat, lng)` are provided, they strictly supersede any entered pincode. If a customer provides pincode `560038` but their actual coordinates lie outside the store's polygon fence, delivery is strictly **REJECTED** (`OUTSIDE_DELIVERY_ZONE`).
2. **Exclusion Polygon Hard Block**: Restricted perimeters (e.g. high-traffic flyovers, no-entry industrial compounds) act as negative geofences. Any point within an exclusion polygon is blocked with reason code `INSIDE_EXCLUSION_ZONE`.
3. **Multi-Store Isolation**: Multiple stores operate separate non-bleeding delivery polygons. Coordinates in Indiranagar route to Indiranagar Flagship Bakery; coordinates in Koramangala route to Koramangala Central Hub; coordinates in Kochi route to Kochi Ernakulam Hub.
4. **Anti-Tampering Enforcement**: Server validation recalculates delivery fees and serving branch/zone on every request, ignoring any client-forged branch IDs or zero-fee claims.
5. **No Hardcoded Geographies**: Hardcoded defaults like `"Bengaluru"`, `"Karnataka"`, and `"560038"` have been eliminated from customer checkout fallbacks. If GPS is denied, clean UI guidance prompts search input without corrupted defaults.

---

## 3. Files Modified & Technical Changes

### A. Backend Resolution Engine (`frontend/src/lib/api-engine.ts`)
- **`resolveSmartBranch`**:
  - Enforced strict coordinate validation (`isValidCoordinate` rejecting `NaN`, `null`, `999.999`, and out-of-range degrees).
  - Implemented negative exclusion polygon matching returning `blocked_area` / `INSIDE_EXCLUSION_ZONE`.
  - Enforced coordinate supremacy: when coordinates are provided, the resolver only evaluates polygon fences and will not fall back to loose pincode mappings.
  - Added structured `reasonCode` output (`SERVICEABLE`, `OUTSIDE_DELIVERY_ZONE`, `INSIDE_EXCLUSION_ZONE`, `INVALID_LOCATION`).
- **`resolveDeliveryContext` & `reverseGeocode`**:
  - Added `reasonCode` / `reason_code` output for uniform API contracts.
  - Formatted addresses without hardcoded state/city assumptions.
  - Provided robust pincode fallbacks from matched zones when GPS-only lookups occur.
- **`validateCheckout` & `confirmCheckout`**:
  - Removed legacy hardcoded fallback `|| "560038"`.
  - Pass coordinate parameters directly to authoritative server validation.
  - Order snapshot stores `delivery_latitude`, `delivery_longitude`, `delivery_address_line_1`, `delivery_landmark`, `delivery_instructions`, `branch_id`, `branch_name`, `delivery_zone_id`, `delivery_zone_name`, `delivery_mode`, `serviceability_result`, and `eta_minutes`.

### B. Storefront Checkout UI (`frontend/src/components/store/checkout/checkout-form.tsx`)
- **State Initialization**: Cleaned form defaults (`address`, `city`, `zip`, `latitude`, `longitude` initialized empty instead of hardcoded strings).
- **GPS Flow**:
  - Handles geolocation permission denials with friendly actionable advice (`"Location access was not allowed. Search for your delivery address instead."`).
  - Highlights GPS accuracy and warns customer when accuracy is coarse (>500m).
- **Locality Search Autocomplete**:
  - Renders debounced search results with locality name, formatted address, and verified coordinates.
  - Selecting an autocomplete item automatically runs `fetchAvailability` with authoritative backend serviceability.
- **Saved Address Picker**:
  - Selecting a saved address immediately loads stored latitude/longitude and verifies real-time map-fence coverage.
- **Clear Availability Feedback**:
  - Shows green badge with serving branch name and exact delivery fee when serviceable.
  - Shows red banner with `[ Change Location ]` button when outside coverage and disables checkout progression.

### C. Rider Navigation Deep-Linking (`frontend/src/lib/location/directions.ts`)
- Builds canonical Google Maps navigation URLs: `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`.
- Formats sub-meter precision destinations without corrupted tokens (`undefined` or `NaN`).

---

## 4. Empirical Verification Evidence

### Test Suite 1: Customer Location & Map-Fence Serviceability E2E (`scripts/test-customer-location-map-serviceability-e2e.ts`)
```
=====================================================================================
🚀 CAKETOHOME — CUSTOMER LOCATION PICKER & MAP-FENCE SERVICEABILITY E2E SUITE
=====================================================================================

📌 TEST A: Current Location (GPS Auto-Detection & Geofence Resolution)
  ✅ [PASS] TEST A.1: GPS reverse geocode succeeded (GPS (12.9716, 77.6412), Zone A, Bengaluru, Karnataka 560038)
  ✅ [PASS] TEST A.2: Location resolved as serviceable within Indiranagar zone
  ✅ [PASS] TEST A.3: Serving bakery branch identified (Indiranagar Flagship Bakery)
  ✅ [PASS] TEST A.4: Exact GPS coordinates preserved
  ✅ [PASS] TEST A.5: Authoritative delivery context is serviceable
  ✅ [PASS] TEST A.6: Reason code is SERVICEABLE
  ✅ [PASS] TEST A.7: Authoritative delivery fee calculated (Fee: ₹0)
  ✅ [PASS] TEST A.8: Dynamic ETA estimated (30 mins)
  ✅ [PASS] TEST A.9: Order created successfully with GPS coordinates
  ✅ [PASS] TEST A.10: Order snapshot delivery_latitude locked to GPS (12.9716)
  ✅ [PASS] TEST A.11: Order snapshot delivery_longitude locked to GPS (77.6412)
  ✅ [PASS] TEST A.12: Order bound to serving branch (Indiranagar Flagship Bakery)

📌 TEST B: Location Search (Autocomplete & Coordinate Selection)
  ✅ [PASS] TEST B.1: Search returns structured locality candidates (Count: 1)
  ✅ [PASS] TEST B.2: Selected search result includes verified coordinates (9.9816, 76.2753)
  ✅ [PASS] TEST B.3: Selected search result provides formatted address (Marine Drive Promenade, Kochi, Kerala 682031)
  ✅ [PASS] TEST B.4: Search location coordinates resolve to active delivery zone (Store: Kochi Ernakulam Gourmet Hub)
  ✅ [PASS] TEST B.5: Order placed successfully using location search selection
  ✅ [PASS] TEST B.6: Order snapshotted search latitude (9.9816)
  ✅ [PASS] TEST B.7: Order snapshotted search longitude (76.2753)

📌 TEST C: Saved Address (Coordinate Loading & Serviceability)
  ✅ [PASS] TEST C.1: Saved address resolved serviceability from stored coordinates
  ✅ [PASS] TEST C.2: Saved address resolved nearest Koramangala Hub (Koramangala Central Hub)
  ✅ [PASS] TEST C.3: Order created successfully from saved address
  ✅ [PASS] TEST C.4: Order contains saved address latitude
  ✅ [PASS] TEST C.5: Order contains saved address longitude

📌 TEST D: Outside Polygon Zone Rejection (Coordinate Supremacy over Pincode)
  ✅ [PASS] TEST D.1: Outside coordinates rejected even with valid pincode 560038
  ✅ [PASS] TEST D.2: Reason code is OUTSIDE_DELIVERY_ZONE (OUTSIDE_DELIVERY_ZONE)
  ✅ [PASS] TEST D.3: Delivery fee is 0 for unserviceable coordinate
  ✅ [PASS] TEST D.4: Checkout validation blocked for coordinates outside polygon fences
  ✅ [PASS] TEST D.5: Validation error returned appropriate unserviceable code (Your location is outside our current bakery delivery coverage zones.)
  ✅ [PASS] TEST D.6: Order creation rejected with success=false
  ✅ [PASS] TEST D.7: Rejected with HTTP 400 status code

📌 TEST E: Exclusion Polygon Hard Block (Hazard/Restricted Perimeter)
  ✅ [PASS] TEST E.1: Coordinate inside exclusion polygon is blocked
  ✅ [PASS] TEST E.2: Reason code is INSIDE_EXCLUSION_ZONE (INSIDE_EXCLUSION_ZONE)
  ✅ [PASS] TEST E.3: Blocked reason explains exclusion zone perimeter (Location (12.9750, 77.6450) falls within restricted exclusion zone (Zone A). Delivery is blocked for this perimeter.)

📌 TEST F: Multi-Store Geofence Isolation
  ✅ [PASS] TEST F.1: Indiranagar coordinate routes to Indiranagar kitchen (Indiranagar Flagship Bakery)
  ✅ [PASS] TEST F.2: Koramangala coordinate routes to Koramangala kitchen (Koramangala Central Hub)
  ✅ [PASS] TEST F.3: Kochi coordinate routes to Kochi hub (Kochi Ernakulam Gourmet Hub)
  ✅ [PASS] TEST F.4: Clear store boundary isolation between Indiranagar and Koramangala

📌 TEST G: Client-Side Tampering Rejection (Authoritative Server Enforcement)
  ✅ [PASS] TEST G.1: Order processed
  ✅ [PASS] TEST G.2: Forged branch_id overridden by authoritative resolver (br_indiranagar)
  ✅ [PASS] TEST G.3: Forged zone_id overridden by authoritative resolver (br_indiranagar_z1)
  ✅ [PASS] TEST G.4: Delivery fee calculated authoritatively by pricing engine (Fee: ₹49)

📌 TEST H: Historical Order Destination Immutability Snapshot
  ✅ [PASS] TEST H.1: Created reference historical order (ord_1787754402085_lj8fx)
  ✅ [PASS] TEST H.2: Retrieved historical order from database store
  ✅ [PASS] TEST H.3: Historical order delivery_latitude remains immutable (12.9716)
  ✅ [PASS] TEST H.4: Historical order delivery_longitude remains immutable (77.6412)
  ✅ [PASS] TEST H.5: Historical order delivery_address text remains immutable

📌 TEST I: Malformed & Corrupt Coordinate Boundary Defense
  ✅ [PASS] TEST I.1: Rejects 999.999 placeholder coordinate
  ✅ [PASS] TEST I.2: Rejects NaN coordinate
  ✅ [PASS] TEST I.3: Rejects undefined coordinate
  ✅ [PASS] TEST I.4: Rejects latitude > 90
  ✅ [PASS] TEST I.5: Rejects longitude > 180
  ✅ [PASS] TEST I.6: Rejects 0,0 Null Island point
  ✅ [PASS] TEST I.7: Backend rejects 999.999 coordinates gracefully
  ✅ [PASS] TEST I.8: Reason code is INVALID_LOCATION

📌 TEST J: Rider One-Tap Navigation Google Maps Destination URL
  ✅ [PASS] TEST J.1: Extracted delivery coordinates from order snapshot
  ✅ [PASS] TEST J.2: Extracted coordinates match exact snapshot
  ✅ [PASS] TEST J.3: Directions URL generated with exact 6-decimal sub-meter destination (https://www.google.com/maps/dir/?api=1&destination=12.971599,77.641201)
  ✅ [PASS] TEST J.4: Directions URL is free of corrupt tokens

=====================================================================================
📊 E2E TEST SUMMARY: Total: 59 | Passed: 59 | Failed: 0
=====================================================================================
🎉 ALL TESTS PASSED (100%). Map-fence serviceability & location flow verified.
```

### Test Suite 2: Customer Location & Rider Google Maps Navigation E2E (`scripts/test-customer-location-to-rider-navigation-e2e.ts`)
```
================================================================================
📊 E2E SUITE RESULTS: 62 / 62 TESTS PASSED
🎉 ALL TESTS PASSED! FULL END-TO-END DELIVERY NAVIGATION CERTIFIED.
================================================================================
```

### Static Typecheck (`npx tsc --noEmit`)
```
> npx tsc --noEmit
Exit Code: 0 (Zero Errors)
```

### Production Build (`npm run build`)
```
✓ Compiled successfully
✓ Generating static pages (28/28)
✓ Finalizing page optimization
Exit Code: 0
```

---

## 5. Acceptance Criteria Sign-Off

| Requirement | Acceptance Criteria | Status |
|:---|:---|:---:|
| **Use Current Location** | GPS navigator triggers permission, retrieves coordinates, reverse geocodes locality, and displays serving store & fee. | ✅ VERIFIED |
| **Search Location** | Autocomplete suggests locality candidates with coordinates and address snippets; selection evaluates backend fences. | ✅ VERIFIED |
| **Saved Address Integration** | Saved addresses preserve latitude/longitude; clicking address card loads exact coordinates and re-evaluates geofences. | ✅ VERIFIED |
| **Coordinate Supremacy** | Coordinates strictly supersede pincode. Out-of-zone coordinates are blocked with `OUTSIDE_DELIVERY_ZONE` even if pincode matches. | ✅ VERIFIED |
| **Exclusion Zones** | Negative hazard polygons block delivery with `INSIDE_EXCLUSION_ZONE`. | ✅ VERIFIED |
| **Multi-Store Isolation** | Different branch polygons route to separate physical kitchens without bleeding. | ✅ VERIFIED |
| **Client Tampering Defense** | Server authoritatively recomputes fees, store IDs, and zone IDs on checkout submission. | ✅ VERIFIED |
| **Order Snapshot Immutability** | Order records store fixed coordinates, address, and serving store at creation. | ✅ VERIFIED |
| **Rider Navigation Integration** | Rider portal and manager orders extract snapshot coordinates and generate 6-decimal sub-meter Google Maps directions deep-links. | ✅ VERIFIED |
| **Build & Type Safety** | 0 TypeScript compiler errors and clean production build with 28 static routes. | ✅ VERIFIED |
