# Real-Time Map Delivery Serviceability & Customer Experience

## Customer Journey Overview

CakeToHome's customer storefront and checkout funnel deliver complete transparency regarding bakery availability, estimated delivery time, and dispatch logistics.

---

## 1. Location Selection Experience

In the storefront header and at checkout, customers have three authoritative methods to specify their delivery coordinates:

1. **`[ Use Current Location ]` (GPS)**:
   - Queries `navigator.geolocation.getCurrentPosition` with high accuracy.
   - Drops an exact pin on the interactive Leaflet map.
   - Automatically reverse-geocodes to street name, city, and postal metadata.

2. **Map Search Autocomplete**:
   - Searches local areas, streets, residential colonies, and landmarks (e.g. *Kadappakada*, *Indiranagar*).
   - Selects coordinate and animates the map to the target location.

3. **Saved Addresses**:
   - Registered customers select previously verified delivery pins.

---

## 2. Real-Time Serviceability Resolution

As soon as a pin coordinate is established, `ApiEngine.getCheckoutAvailability` evaluates coverage:

### Scenario A: Serviceable Location (Eligible Store Found)
- Visual Confirmation: Green status badge:
  `✓ Delivery Available from Kollam Central Cake Studio`
- Distance & ETA: `3.8 km away • Estimated 35–45 mins`
- Operational Slots: Delivery slots generated for selected date (Standard Morning, Afternoon, Evening, Express, Midnight).
- Pricing Breakdown: Base delivery fee, distance charge, or `FREE` badge if order qualifies.

### Scenario B: Unserviceable Location (No Store Coverage)
When a coordinate falls outside all active store fences or inside an exclusion zone:
- **No False Data**:
  - `delivery_fee: 0`
  - `available_dates: []`
  - `available_slots: []`
  - `branch_name: null`
- **Notice Card**:
  - `❌ We currently don't deliver to this location.`
  - Subtitle: `We're coming soon to your town.`
- **Interactive Actions**:
  - **`[ 🔔 Notify Me ]`**: Customer clicks to record notification intent. Feedback confirms: *"✓ You will receive an SMS and WhatsApp notification as soon as our bakery coverage launches in your area."*
  - **`[ Change Location ]`**: Focuses search input to select another delivery point.

---

## 3. Separation of Address Text from Map Coordinates

A key architectural rule is that typing or editing textual address lines (Flat number, Landmark, Tower name) **does not alter the map coordinates**.
- Coordinates represent the physical dispatch drop point for the rider.
- Address line text provides door-level guidance (e.g. *"Wing B, 4th floor, Flat 402"*).
- The map pin drop remains anchored until the customer explicitly clicks on the map or searches for a new area.

---

## 4. Rider Navigation Deep Links

Upon order confirmation, delivery riders access an immutable Google Maps deep link built directly from snapshotted order coordinates:

```text
https://www.google.com/maps/dir/?api=1&destination={delivery_latitude},{delivery_longitude}
```

This bypasses ambiguities with regional street names and sends the rider straight to the customer's front gate.
