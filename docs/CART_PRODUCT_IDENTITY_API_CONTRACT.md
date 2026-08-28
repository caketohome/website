# CakeToHome — Cart Product Identity & Variant Pricing API Contract

## 1. Architectural Philosophy
CakeToHome enforces strict **canonical product identity** and **exact weight variant pricing** across all storefront, cart, checkout, kitchen, and delivery operations.
Under no circumstances may the system:
1. Default an unresolvable product title to `"Celebration Cake"`.
2. Default an item's unit price or total price to `₹0`.
3. Silently coerce a requested product into `prod_1` (*Belgian Chocolate Truffle Cake*) or any fallback placeholder.
4. Allow cross-product cart contamination or shared guest cart leakage.

---

## 2. Canonical Product & Variant Weight Ladder Resolution

### 2.1 Product Lookup Order
Every catalog interaction resolving a product ID or slug adheres to this exact sequence:
1. Direct ID match (`p.id === targetId || p.product_id === targetId`)
2. Handle/Slug match (`p.handle === targetSlug || p.slug === targetSlug`)
3. Variant ID prefix stripping (`cleanId.startsWith("var_")` $\rightarrow$ `p.id === cleanId.replace(/^var_/, "")`)
4. Active Accessory match (`ApiEngine.getAccessoryById(targetId)`)

If no match is found, the engine **strictly raises an error** (`Product "<id>" was not found in catalog`).

### 2.2 Dynamic Weight Ladder Matrix
When a product is added to cart without an explicit price or when calculating variant rates, prices are derived directly from the product's authoritative weight ladder:

$$\text{Weight Normalization}: \text{"500g"} \equiv \text{"0.5 kg"} \equiv 500\text{g}$$

For **Black Forest Gateau Special** (`prod_4`, base price ₹549 for 1 kg):
| Weight Variant | Normalized Grams | Formula / Standard Multiplier | Selling Price | MRP |
| :--- | :--- | :--- | :--- | :--- |
| **0.5 kg (500g)** | 500g | $\text{round}(549 \times 0.85)$ | **₹467** | ₹604 |
| **1 kg (1000g)** | 1000g | Base Price | **₹549** | ₹686 |
| **1.5 kg (1500g)** | 1500g | $\text{round}(549 \times 1.45)$ | **₹796** | ₹961 |
| **2 kg (2000g)** | 2000g | $\text{round}(549 \times 1.85)$ | **₹1016** | ₹1235 |

---

## 3. Cart Line Item Invariants

### 3.1 Line Item Uniqueness & Deduplication
A cart line item is uniquely identified by:
$$\text{Line Item Key} = (\text{canonical\_product\_id}, \text{variant\_id} \lor \text{normalized\_weight})$$

- Adding **Black Forest Gateau Special (0.5 kg)** twice increments the quantity to `2`, producing:
  - Unit Price: `₹467`
  - Total Price: `₹934`
- Adding **Black Forest Gateau Special (0.5 kg)** followed by **Black Forest Gateau Special (1 kg)** creates **two distinct line items**:
  - Item 1: `Black Forest Gateau Special (0.5 kg)` @ `₹467`
  - Item 2: `Black Forest Gateau Special (1 kg)` @ `₹549`
  - Subtotal: `₹1,016`

### 3.2 Strict Price Assertion Gate
$$\forall \text{ item} \in \text{cart.items}: \text{item.unit\_price} > 0 \land \text{item.total\_price} > 0$$

If any item fails this condition:
- `ApiEngine.addToCart` throws `Unable to add item to cart: Price for "<title>" must be greater than zero.`
- `ApiEngine.validateCheckout` returns error code `INVALID_PRODUCT_PRICE`.

---

## 4. API Endpoints Contract

### 4.1 POST `/api/v1/cart/items`
**Request Payload:**
```json
{
  "cartId": "cart_1787899999_abc",
  "productId": "prod_4",
  "variantId": "var_prod_4",
  "quantity": 1,
  "weight": "0.5 kg",
  "metadata": {
    "productId": "prod_4",
    "weight": "0.5 kg",
    "price": 467
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "cart": {
    "id": "cart_1787899999_abc",
    "items": [
      {
        "id": "item_1787900000_xyz",
        "product_id": "prod_4",
        "variant_id": "var_prod_4",
        "title": "Black Forest Gateau Special",
        "thumbnail": "https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62...",
        "unit_price": 467,
        "price": 467,
        "quantity": 1,
        "total_price": 467,
        "subtotal": 467,
        "weight": "0.5 kg",
        "flavour": "Black Forest"
      }
    ],
    "subtotal": 467,
    "total": 467,
    "status": "ACTIVE"
  }
}
```
