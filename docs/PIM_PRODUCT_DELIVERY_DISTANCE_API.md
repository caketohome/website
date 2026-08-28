# API Contract: Product PIM Delivery Distance & Permissions

## 1. Overview
This contract governs the API surface for saving and validating product delivery permissions and distance limits in CakeToHome.

---

## 2. API Endpoints

### 2.1 Update Product PIM Configuration
- **Method**: `PUT` or `PATCH`
- **Endpoint**: `/api/v1/admin/products/:id` (or `/api/v1/admin/catalog/products/:id`)
- **Authentication**: Admin Session Token / Branch Manager

#### Request Payload
```json
{
  "delivery_profile_id": "prof_regular",
  "min_prep_hours": 2,
  "daily_capacity": 50,
  "pim_config": {
    "same_day_allowed": true,
    "express_allowed": true,
    "midnight_allowed": false,
    "scheduled_allowed": true,
    "min_prep_hours": 2,
    "max_delivery_distance_km": 5.0
  },
  "max_delivery_distance_km": 5.0
}
```

#### Field Specifications
| Field Name | Type | Allowed Values | Semantic Meaning |
| :--- | :--- | :--- | :--- |
| `max_delivery_distance_km` | `number \| null` | `null` or $> 0$ (e.g. `5.0`, `10.5`) | `null` = No product-specific limit (Store map physical boundary governs). Positive numeric = Maximum allowed radial distance from servicing bakery hub. |
| `same_day_allowed` | `boolean` | `true \| false` | Enables same-day delivery for this product. |
| `express_allowed` | `boolean` | `true \| false` | Enables express 60/90-minute delivery. |
| `midnight_allowed` | `boolean` | `true \| false` | Enables midnight delivery slot (11:00 PM – 12:00 AM). |
| `scheduled_allowed` | `boolean` | `true \| false` | Enables future scheduled dates. |

#### Forbidden Fields (Removed / Deprecated)
The following fields are strictly forbidden in product payload:
- `allowed_zones` (REJECTED / IGNORED)
- `zone_ids` (REJECTED / IGNORED)
- `selected_zones` (REJECTED / IGNORED)

---

## 3. Backend Validation Rules
1. **`null`**: Valid. Indicates no product-specific distance cap.
2. **Positive Float / Integer**: Valid if $> 0$ and $\le 100$ (reasonable operational limit).
3. **Negative Numbers** (`-1`, `-5`): **REJECTED** with `400 Bad Request` (`INVALID_DISTANCE_LIMIT`).
4. **Zero (`0`)**: **REJECTED** (a product cannot have 0 km distance).
5. **NaN / Non-numeric strings** (`"abc"`, `"5km"`): **REJECTED** with `400 Bad Request`.
6. **Excessive values** ($> 100$): **REJECTED** with `400 Bad Request`.

---

## 4. Response Example
```json
{
  "success": true,
  "product": {
    "id": "prod_2",
    "title": "Classic Red Velvet Cream Cheese Cake",
    "max_delivery_distance_km": 5.0,
    "pim_config": {
      "same_day_allowed": true,
      "express_allowed": true,
      "midnight_allowed": false,
      "scheduled_allowed": true,
      "max_delivery_distance_km": 5.0
    }
  },
  "storage": "postgres"
}
```
