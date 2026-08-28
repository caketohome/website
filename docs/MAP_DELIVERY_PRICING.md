# Map Delivery Pricing & Distance Brackets Specification

## Overview

CakeToHome provides dynamic, geographically accurate delivery pricing computed directly from customer GPS coordinates to the serving bakery's dispatch center.

---

## 1. Supported Pricing Modes

Each Delivery Area in the Store Area Matrix can be configured in one of two pricing modes:

### A. Flat Rate Delivery Fee
A uniform fee is charged for all deliveries within the boundary:
- Standard Delivery: e.g. `₹49`
- Express Delivery Surcharge: e.g. `+₹50`
- Midnight Delivery Surcharge: e.g. `+₹150`
- Free Delivery Threshold: e.g. Orders $\ge$ `₹999` qualify for `₹0` standard delivery fee.

### B. Distance-Based Pricing Brackets
For sprawling suburban or tiered regional areas, delivery fees scale progressively with driving distance:

| Distance Bracket | Base Delivery Fee | Free Delivery Threshold | Max Allowed Distance |
| :--- | :--- | :--- | :--- |
| **0.00 – 3.00 km** | `₹39` | `₹799` | 3.00 km |
| **3.01 – 5.00 km** | `₹49` | `₹999` | 5.00 km |
| **5.01 – 8.00 km** | `₹69` | `₹1,299` | 8.00 km |
| **8.01 – 10.00 km** | `₹99` | `₹1,499` | 10.00 km |
| **> 10.00 km** | **UNSERVICEABLE** | N/A | Exceeds Max Bracket |

---

## 2. Hard Boundary & Serviceability Clamping

A critical operational safeguard enforced by the delivery engine:

> **Boundary Invariant**: If a customer coordinate is within a zone's geographic fence but exceeds the maximum distance bracket defined in the pricing matrix (e.g. customer is 10.5 km away, but max bracket stops at 10.0 km), the location is **automatically flagged as unserviceable**:
>
> `pricing_mode: "unserviceable"`
> `reasonCode: "EXCEEDS_DISTANCE_BRACKETS"`
> `blockedReason: "Delivery distance (10.5 km) exceeds maximum serviceable delivery brackets."`

The engine **never** invents an arbitrary fee or allows an unbounded order to slip through.

---

## 3. Boundary Precision & Resolving Logic

Distance evaluation uses high-precision floating point comparison implemented in `ApiEngine.resolveDistanceBracketFee`:

```typescript
static resolveDistanceBracketFee(
  brackets: Array<{ min_km: number; max_km: number; charge: number }>,
  distanceKm: number
): { fee: number; bracket: any } | null {
  for (const b of brackets) {
    // Inclusive upper boundary: distance <= b.max_km
    if (distanceKm >= b.min_km && distanceKm <= b.max_km) {
      return { fee: b.charge, bracket: b };
    }
  }
  return null; // Exceeds all configured distance brackets -> Unserviceable
}
```

### Boundary Test Points
- `2.99 km` $\rightarrow$ Bracket 0–3 km $\rightarrow$ `₹39`
- `3.00 km` $\rightarrow$ Bracket 3–5 km $\rightarrow$ `₹49` (Upper bound transition)
- `5.00 km` $\rightarrow$ Bracket 5–8 km $\rightarrow$ `₹69`
- `8.00 km` $\rightarrow$ Bracket 8–10 km $\rightarrow$ `₹99`
- `10.00 km` $\rightarrow$ Bracket 8–10 km $\rightarrow$ `₹99`
- `10.01 km` $\rightarrow$ `null` $\rightarrow$ `Unserviceable`

---

## 4. Tamper Resistance

Delivery fees are computed strictly on the backend server. If a client attempts to forge `delivery_fee: 0` or inject a spoofed distance in checkout submissions, the server revalidates coordinates against the store geometry and overrides the payload with the true calculated fee.
