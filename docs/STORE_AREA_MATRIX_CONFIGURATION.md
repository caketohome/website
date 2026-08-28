# Store Area Matrix Administration & Configuration Guide

## Overview

The **Store Area Matrix** (`BranchZoneManager`) is the primary operational interface for bakery store owners and delivery operations teams to define, visualize, and tune their delivery territories.

Access: **CakeToHome Admin Dashboard $\rightarrow$ Stores $\rightarrow$ Store Area Matrix** (`/dashboard?tab=branches`).

---

## 1. Store Selection & Anchor Coordinates

Each physical bakery branch possesses immutable anchor coordinates `(latitude, longitude)` representing the kitchen dispatch dock.

- **Store Selector**: Switch between branches (e.g., *Kollam Central Cake Studio*, *Indiranagar Flagship Bakery*).
- **Physical Position**: Displayed prominently in the Store Details header.
- **Delivery Scope**: All radial delivery areas are dynamically computed relative to these anchor coordinates unless a custom zone center is specified.

---

## 2. Managing Delivery Areas (`DeliveryZone`)

Click **`+ Add Delivery Area`** to create a new delivery tier.

### Configuration Fields
1. **Area Name**: Human-readable identifier (e.g. *Central City Express Core*, *Outer Ring Road Suburban*).
2. **Boundary Type**:
   - **Polygon**: Precise customized geometric fence drawn point-by-point.
   - **Radius**: Circular boundary extending $R$ kilometers around the store.
3. **Coverage / Radius**:
   - For radius mode, enter radius in kilometers (e.g. `5.0 km`).
   - The UI automatically enforces store-level and global ceilings (`max_delivery_radius_km`).
4. **Delivery Modes Allowed**: Standard, Express, Midnight, Scheduled.
5. **Priority**: Numeric weight (`1` to `100`). When multiple delivery areas overlap, higher priority areas resolve first.
6. **Operating Status**: Toggle between `Active` and `Disabled`.

---

## 3. Interactive Map Fence Editor (`MapFenceEditor`)

The interactive map is powered by Leaflet and supports rich drawing modes:

### Map Toolbar Modes
- **Draw Zone (`Pentagon`)**: Click sequential points on the map to trace the delivery perimeter. Double-click to close and complete the polygon.
- **Draw Exclusion (`Plus`)**: Click sequential points to define an unserviceable cut-out (e.g., lakes, parks, restricted areas) inside the active zone.
- **Radius Toggle (`Circle`)**: Turn radial overlay on or off, and adjust the slider/input. Clamped with real-time visual warning if the configured radius reaches the allowed store ceiling.

---

## 4. Store Admin Map Search (Viewport Navigation)

Bakery managers configuring zones in unfamiliar areas need to navigate directly to streets, landmarks, and intersections.

### Search Rules (Viewport Safety)
- Type an area name (e.g. *Kadappakada*, *Chinnakada*, *Koramangala 4th Block*).
- Click a search result from the dropdown list.
- **Strict Viewport Rule**:
  - The map smoothly navigates to the selected coordinate (`setView([lat, lng], 14)`).
  - **Store coordinates, radius center, and saved polygon points are NOT modified.**
- **Metadata Card**:
  - A metadata banner appears directly beneath the search bar displaying:
    - `Place Name`
    - `Latitude` & `Longitude`
    - A notice: *(Viewport centered — Store coordinates remain untouched)*
  - If the manager explicitly intends to relocate the store anchor to this point, they click **`[ Use this location ]`**. Otherwise, the search serves purely for visual panning.

---

## 5. Pincode Matrix Demotion & Reference Usage

Under the **Address / Pincode Reference** tab:
- Pincodes associated with the branch are displayed for postal reference, customer address autocomplete, and legacy reports.
- An explanatory alert states:
  > *"Address / Pincode Reference: Pincodes are stored for address/reference purposes. Delivery eligibility is determined by map location."*
- Pincodes **never override** the geometric fence. If a customer enters a known pincode but drops their map pin outside the polygon, the delivery engine rejects the order with `NO_ELIGIBLE_STORE`.
