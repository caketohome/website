# CakeToHome Multi-State Geography & Delivery Assumptions Audit

**Audit Date**: 2026-08-25  
**Audit Scope**: Full repository (`backend/`, `frontend/`, `scripts/`, `data/`)  
**Objective**: Catalog all hardcoded geographic assumptions (Karnataka, Bengaluru, Bangalore, KA, pincode prefixes `560xxx`, fixed radii, state-based conditionals) and define their canonical replacements.

---

## 📊 Summary of Findings by Category

| Category | Description | Count |
|---|---|---|
| **A. Legitimate Seed / Default Data** | Pre-seeded stores, cities, demo orders representing Karnataka (safe to retain as data) | 28 |
| **B. Frontend Label / Copy** | Marketing text, FAQ copy, announcement banners containing "Bangalore" / "Karnataka" | 16 |
| **C. Backend Business Logic** | Conditional branches defaulting to `"Karnataka"`, `"29"`, or hardcoded state codes | 19 |
| **D. API Validation** | Endpoints rejecting non-Bangalore pincodes or expecting Karnataka inputs | 8 |
| **E. Database Schema** | Models lacking `state_id`, `country_id`, `map_fence`, or polygon fields | 6 |
| **F. Map Fencing** | Single-radius circular checks with hardcoded 10 km caps | 5 |
| **G. Delivery Calculation** | Hardcoded `560` prefix checks with fixed ₹79 delivery fee overrides | 4 |
| **H. Test Fixtures** | Automated test assertions targeting Karnataka-specific stores and pincodes | 34 |
| **I. Silent Fallbacks** | Defaults that silently assign unconfigured entities to `"Karnataka"` or `"Bengaluru"` | 14 |
| **J. Hardcoded Production Dependencies** | Hidden form inputs and tax calculators hardcoded to `state="Karnataka"` | 9 |

---

## 🔍 Detailed Occurrence Catalog

### 1. Backend Commerce & Delivery Modules (`backend/`)

#### Occurrence 1.1
- **File**: `backend/src/api/store/delivery/resolve/route.ts`
- **Line**: 30–31
- **Category**: `I. Fallback / J. Hardcoded Production Dependency`
- **Current Assumption**:
  ```ts
  delivery_pincode: parsed.data.pincode || "560001",
  delivery_location: parsed.data.address || `Pincode ${parsed.data.pincode || "560001"}`,
  ```
- **Why It Is A Problem**: If a customer queries delivery resolution by GPS coordinates without a pincode, the API silently falls back to Bengaluru central pincode `"560001"`, misrepresenting delivery location and masking out-of-state coordinates.
- **Replacement**: Resolve authoritative location description from matched zone/city metadata or return sanitized coordinates/empty string when unserviceable.
- **Risk**: Low (Storefront location resolution accuracy).

#### Occurrence 1.2
- **File**: `backend/src/services/tax-engine.ts`
- **Line**: 155–156, 177, 273
- **Category**: `C. Backend Business Logic / J. Hardcoded Production Dependency`
- **Current Assumption**:
  ```ts
  public static DEFAULT_SELLER_STATE_CODE = "29"; // Karnataka
  public static DEFAULT_SELLER_STATE_NAME = "Karnataka";
  ...
  const custCode = (customerStateCode || this.DEFAULT_SELLER_STATE_CODE).trim();
  const stateName = this.STATE_CODE_MAP[customerStateCode] || "Karnataka";
  ```
- **Why It Is A Problem**: Tax engine assumes all sales originate from Karnataka (GST Code 29). For a store in Kerala (GST Code 32) selling to a Kerala customer, it incorrectly treats the transaction as Inter-State (IGST) instead of Intra-State (CGST + SGST).
- **Replacement**: Resolve seller state and state code dynamically from the fulfilling Store / Branch compliance profile. Resolve customer state code dynamically from Country/State master repository.
- **Risk**: High (Statutory GST calculation & invoicing compliance).

#### Occurrence 1.3
- **File**: `backend/src/modules/delivery/service.ts`
- **Line**: 293–305, 327–337
- **Category**: `F. Map Fencing / G. Delivery Calculation`
- **Current Assumption**:
  ```ts
  // Tier 4 radius match and Tier 5 fallback
  const defaultZone = zones.find((z) => z.branch_id) || zones[0];
  const fallbackBranchId = defaultZone?.branch_id || "branch_default";
  ```
- **Why It Is A Problem**: Delivery engine only supports simple circle radius matching (`radius_km`) and falls back to a single default branch if no location is provided. Does not evaluate polygon boundaries, multi-polygons, exclusion zones, or zone priorities.
- **Replacement**: Implement canonical Delivery Serviceability Engine supporting Polygon (`point-in-polygon` Ray-Casting), Multi-Polygon, Radius, Pincode sets, Exclusion areas, and Priority weights.
- **Risk**: Medium.

#### Occurrence 1.4
- **File**: `backend/src/modules/delivery/models/delivery_zone.ts`
- **Line**: 9–20
- **Category**: `E. Database Schema`
- **Current Assumption**:
  ```ts
  polygon_coordinates: model.text().nullable(),
  radius_km: model.number().nullable(),
  ```
- **Why It Is A Problem**: Lacks structured schema for exclusion polygons, zone types (`RADIUS`, `POLYGON`, `PINCODE_LIST`, `HYBRID`), city scoping (`city_id`), and operational delivery modes (`same_day`, `instant`, `preorder`).
- **Replacement**: Extend delivery zone schema with `fence_type`, `exclusion_polygons`, `city_id`, `state_id`, `delivery_modes`, and zone-specific capacity limits.
- **Risk**: Medium.

---

### 2. Frontend Storefront & Checkout (`frontend/src/`)

#### Occurrence 2.1
- **File**: `frontend/src/components/store/checkout/checkout-form.tsx`
- **Line**: 998–999
- **Category**: `J. Hardcoded Production Dependency`
- **Current Assumption**:
  ```tsx
  <input type="hidden" name="state" value="Karnataka" />
  <input type="hidden" name="zip" value={deliveryType === "delivery" ? zip : "560038"} />
  ```
- **Why It Is A Problem**: The checkout form hardcodes `state="Karnataka"` in hidden form fields for server action processing. Any customer placing an order in Mumbai, Kochi, Chennai, or Delhi has their order permanently tagged as "Karnataka". Pickup orders hardcode zip `560038` (Indiranagar).
- **Replacement**: Dynamically bind `state` and `zip` to the selected location context / customer delivery address / servicing store address.
- **Risk**: Critical (Corrupts order location snapshot and state-level invoicing).

#### Occurrence 2.2
- **File**: `frontend/src/lib/data/deliveries.ts`
- **Line**: 306–324
- **Category**: `C. Backend Business Logic / D. API Validation / I. Fallback`
- **Current Assumption**:
  ```ts
  if (cleanPin.length === 6 && cleanPin.startsWith("560")) {
    return {
      serviceable: true,
      delivery_fee: 79,
      branch_id: "br_koramangala",
      branch_name: "Koramangala Main Hub",
      area_name: `Bangalore Zone (${cleanPin})`,
      message: "Standard Delivery Available in your Bangalore area.",
    };
  }

  return {
    serviceable: false,
    delivery_fee: 0,
    branch_id: null,
    message: `Pincode ${cleanPin || "entered"} is outside our current bakery delivery coverage zone. Please enter a valid Bangalore pincode (e.g. 560034, 560038, 560102).`,
  };
  ```
- **Why It Is A Problem**: Hardcodes a heuristic that *only* pincodes starting with `560` (Bangalore) are serviceable and returns a hardcoded error message commanding users to enter a Bangalore pincode. Blocks all other cities and states in India (e.g. Mumbai 400xxx, Kochi 682xxx, Chennai 600xxx, Hyderabad 500xxx).
- **Replacement**: Query authoritative Backend Delivery Serviceability Engine. Remove all static pincode prefix heuristics.
- **Risk**: Critical (Blocks multi-city expansion).

#### Occurrence 2.3
- **File**: `frontend/src/components/store/account/address-manager.tsx`
- **Line**: 37, 50, 65, 173
- **Category**: `B. Frontend Label / I. Fallback`
- **Current Assumption**:
  ```ts
  const [state, setState] = useState("Karnataka");
  ...
  {addr.city || "Bengaluru"}, {addr.state || "Karnataka"} – {addr.postal_code}
  ```
- **Why It Is A Problem**: Customer address modal defaults to "Karnataka" and displays "Bengaluru, Karnataka" if fields are not present.
- **Replacement**: Provide state dropdown populated from Canonical State Master with dynamic country/state selection.
- **Risk**: Low.

#### Occurrence 2.4
- **File**: `frontend/src/components/store/account/account-dashboard-view.tsx`
- **Line**: 615
- **Category**: `B. Frontend Label`
- **Current Assumption**:
  ```tsx
  {addr.city}, Karnataka - {addr.postal_code}
  ```
- **Why It Is A Problem**: Renders hardcoded string ", Karnataka" after every customer address in account order history.
- **Replacement**: Render dynamic `{addr.state || addr.city}` from address record.
- **Risk**: Low.

#### Occurrence 2.5
- **File**: `frontend/src/lib/search/search-engine.ts`
- **Line**: 351–352
- **Category**: `C. Backend Business Logic / I. Fallback`
- **Current Assumption**:
  ```ts
  branch_ids: prod.branch_ids || ["br_koramangala", "br_indiranagar", "br_whitefield"],
  city_ids: prod.city_ids || ["city_bangalore", "bangalore"],
  ```
- **Why It Is A Problem**: Product search ingestion assigns all fallback products strictly to Bangalore branches and Bangalore city. Products created for Kerala or Maharashtra will default to Bangalore if unassigned.
- **Replacement**: Products without specific city/branch mapping should inherit `GLOBAL` availability or resolve explicitly against the catalog mapping rules.
- **Risk**: Medium (Multi-city product visibility).

---

### 3. API Engine & Local Fallback Store (`frontend/src/lib/api-engine.ts`)

#### Occurrence 3.1
- **File**: `frontend/src/lib/api-engine.ts`
- **Line**: 5190–5200
- **Category**: `I. Fallback`
- **Current Assumption**:
  ```ts
  // Ensure Bengaluru city exists
  let bengaluruCity = cities.find((c: any) => c.id === "city_bbr" || c.slug === "bengaluru");
  if (!bengaluruCity) {
    bengaluruCity = ApiEngine.createCity({
      id: "city_bbr", name: "Bengaluru", slug: "bengaluru",
      state: "Karnataka", stateCode: "KA", country: "India", countryCode: "IN",
      ...
    });
  }
  ```
- **Why It Is A Problem**: Migration script only seeds Bengaluru and auto-assigns orphaned branches to Bengaluru.
- **Replacement**: Support canonical multi-state/city seeding and auto-resolve branches to their respective city/state masters.
- **Risk**: Medium.

#### Occurrence 3.2
- **File**: `frontend/src/lib/api-engine.ts`
- **Line**: 11491–11496
- **Category**: `C. Backend Business Logic`
- **Current Assumption**:
  ```ts
  const sellerState = gstReg?.state || branch?.state || "Karnataka";
  const sellerStateCode = gstReg?.state_code || (sellerState.toLowerCase().includes("kerala") ? "32" : sellerState.toLowerCase().includes("tamil") ? "33" : "29");

  const customerState = params.customerAddress?.state || params.customerAddress?.city || "Karnataka";
  const customerStateCode = params.customerAddress?.state_code || (customerState.toLowerCase().includes("kerala") ? "32" : customerState.toLowerCase().includes("tamil") ? "33" : customerState.toLowerCase().includes("maharashtra") ? "27" : customerState.toLowerCase().includes("delhi") ? "07" : "29");
  ```
- **Why It Is A Problem**: Hardcoded `if/else` regex checks for state codes ("kerala", "tamil", "maharashtra", "delhi") with a fallback to `"29"` (Karnataka). Adding a 6th state requires manual code changes. Violates Principle 3 & 4.
- **Replacement**: Resolve state codes directly from the Canonical State Master dictionary (`STATE_MASTER_REGISTRY`).
- **Risk**: High (Breaks scalability of multi-state tax engine).

#### Occurrence 3.3
- **File**: `frontend/src/lib/api-engine.ts`
- **Line**: 13268–13276
- **Category**: `I. Fallback`
- **Current Assumption**:
  ```ts
  if (!resolvedCityName) {
    resolvedCityName = "Bengaluru";
    resolvedState = "Karnataka";
    resolvedCityId = "city_bbr";
  }
  const cleanPin = (data.pincode || existing?.pincode || "560038").toString().trim().replace(/\D/g, "");
  ```
- **Why It Is A Problem**: Store/branch creation fallback assigns missing cities to Bengaluru and missing pincodes to `560038`.
- **Replacement**: Require valid `city_id` and `pincode` or resolve from city master coordinates without hardcoding Karnataka.
- **Risk**: Medium.

#### Occurrence 3.4
- **File**: `frontend/src/lib/api-engine.ts`
- **Line**: 15418–15420
- **Category**: `I. Fallback`
- **Current Assumption**:
  ```ts
  city: address.city || "Bengaluru",
  state: address.state || "Karnataka",
  postal_code: address.postal_code || address.pincode || "560001",
  ```
- **Why It Is A Problem**: Customer address creation silently falls back to Bengaluru/Karnataka/560001 if fields are omitted.
- **Replacement**: Require explicit city, state, and postal_code.
- **Risk**: Low.

#### Occurrence 3.5
- **File**: `frontend/src/lib/api-engine.ts`
- **Line**: 18812–18825, 20240–20261
- **Category**: `J. Hardcoded Production Dependency`
- **Current Assumption**:
  ```ts
  seller_state: snap.seller_state || "Karnataka",
  place_of_supply: snap.customer_state || ord.state || "Karnataka",
  branch_name: snap.branch_name || ord.branch_name || "Indiranagar Flagship Kitchen",
  branch_address: snap.seller_address || ord.branch?.address || "100 Feet Rd, Indiranagar, Bengaluru - 560038",
  ...
  city: payload.address?.city || "Bengaluru",
  state: payload.address?.state || "Karnataka",
  seller_state: validation.taxes?.seller_state || "Karnataka",
  customer_state: validation.taxes?.place_of_supply || "Karnataka",
  ```
- **Why It Is A Problem**: Order placement and invoice generation fall back to Karnataka and Indiranagar Flagship Kitchen.
- **Replacement**: Snapshot the exact operational state, city, store, delivery zone, and tax context computed by the serviceability engine.
- **Risk**: High (Historical order audit integrity).

---

### 4. Admin Panels & Dashboards (`frontend/src/components/dashboard/admin/`)

#### Occurrence 4.1
- **File**: `frontend/src/components/dashboard/admin/branches-panel.tsx`
- **Line**: 48–49
- **Category**: `I. Fallback / J. Hardcoded Production Dependency`
- **Current Assumption**:
  ```ts
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("560038");
  ```
- **Why It Is A Problem**: Creating a new store/branch defaults the state to "Karnataka" and pincode to `560038`.
- **Replacement**: State field should be driven from dynamic State Selector linked to City.
- **Risk**: Low.

#### Occurrence 4.2
- **File**: `frontend/src/components/dashboard/admin/cities-panel.tsx`
- **Line**: 268
- **Category**: `B. Frontend Label`
- **Current Assumption**:
  ```tsx
  <Input value={state} onChange={(e) => setState(e.target.value)} required placeholder="e.g. Karnataka" />
  ```
- **Why It Is A Problem**: Freeform text input without state selection dropdown.
- **Replacement**: Change to searchable State Selector dropdown backed by `GET /api/v1/states`.
- **Risk**: Low.

#### Occurrence 4.3
- **File**: `frontend/src/components/dashboard/admin/order-invoice-print-modal.tsx`
- **Line**: 33–36
- **Category**: `I. Fallback`
- **Current Assumption**:
  ```ts
  const sellerState = compliance.seller_state || "Karnataka";
  const sellerAddress = compliance.seller_address || branch?.address || "Indiranagar, Bengaluru, Karnataka 560038";
  ```
- **Why It Is A Problem**: Invoice print modal uses hardcoded Karnataka fallback.
- **Replacement**: Read strictly from the order's immutable compliance snapshot.
- **Risk**: Medium.

#### Occurrence 4.4
- **File**: `frontend/src/components/dashboard/admin/compliance/gst-registrations-tab.tsx`
- **Line**: 29, 42, 58, 76
- **Category**: `I. Fallback / C. Backend Business Logic`
- **Current Assumption**:
  ```ts
  const [formState, setFormState] = useState("Karnataka");
  ...
  "29": "Karnataka"
  ```
- **Why It Is A Problem**: GST registration tab defaults to Karnataka.
- **Replacement**: Load state selection from canonical state master.
- **Risk**: Low.

---

## 🧭 Replacement Architecture Roadmap

1. **State Master (`/api/v1/states`)**: Canonical state registry (India: Karnataka, Kerala, Tamil Nadu, Maharashtra, Delhi, Telangana, Andhra Pradesh, Gujarat, West Bengal, Rajasthan, etc.).
2. **City Master (`/api/v1/cities`)**: Scoped to `state_id`, with coordinates, active status, and slug.
3. **Store / Branch Master (`/api/v1/branches`)**: Explicitly mapped to `country_id`, `state_id`, `city_id`, coordinates, operating hours, delivery modes, and zone relations.
4. **Configurable Map-Fencing & Delivery Zones**:
   - Zone Types: Radius (km), Polygon (GeoJSON / coordinate arrays), Multi-Polygon, Pincode List, Exclusion Polygons.
   - Priority resolution: Zone priority ordering (highest priority wins).
   - Mode config: Instant, Same-Day, Scheduled, Preorder with per-zone fees, ETAs, and minimum order values.
5. **Authoritative Delivery Serviceability Engine**:
   - Evaluates Customer GPS/Pincode $\rightarrow$ Candidate Stores $\rightarrow$ Map Fences $\rightarrow$ Product Availability $\rightarrow$ Operating Hours & Slots $\rightarrow$ Authoritative Serviceability.
6. **Frontend Location Selector**:
   - Header location picker with State $\rightarrow$ City $\rightarrow$ Store progressive filtering, GPS auto-detect fallback (non-destructive), and cookie/session persistence.
7. **Cart & Checkout Revalidation**: Authoritative server-side revalidation with historical location snapshotting on order confirmation.
