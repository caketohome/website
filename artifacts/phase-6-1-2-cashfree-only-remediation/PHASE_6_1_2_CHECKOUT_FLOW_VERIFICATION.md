# CAKETOHOME — PHASE 6.1.2 CHECKOUT FLOW VERIFICATION
## 5-STEP CUSTOMER CHECKOUT LIFECYCLE & LIVE VERIFICATION RESULTS

**Company:** CakeToHome India Private Limited  
**Lifecycle Audit:** End-to-End Storefront Checkout

---

### 1. FIVE-STEP CHECKOUT LIFECYCLE

1. **Step 1: Product Selection (`/products`):**
   - Customer discovers and selects gourmet cakes (e.g. Classic Chocolate Truffle Cake, ₹525.00).
   - Dynamic pricing, tax preview, and stock availability confirmed.
2. **Step 2: Cart Review (`/cart`):**
   - Cart calculates item subtotal (₹500.00), GST (₹25.00), delivery pincode verification (560038 - Indiranagar, Bengaluru). Total: ₹525.00.
3. **Step 3: Recipient Checkout Form (`/checkout`):**
   - Form collects recipient name, phone, email, delivery slot, and message on cake.
   - Payment provider is automatically set to Cashfree PG. Button displays "Proceed to Cashfree Payment 💳".
4. **Step 4: Cashfree Sandbox Checkout (`/checkout/cashfree`):**
   - Directs customer to authentic Cashfree payment page.
   - Cashfree branding header, 256-bit encryption badge, order ID, amount due ₹525.00.
   - Options rendered: UPI / QR Code, Credit/Debit Cards, Netbanking.
5. **Step 5: Customer Confirmation (`/your-order`):**
   - Displays real-time order status: "Order Confirmed & In Kitchen".
   - Shows assigned KOT number, branch name, estimated delivery time, and Cashfree Payment Reference.

### 2. VISUAL ARTIFACTS VERIFICATION

All 5 customer journey stages have been photographed via automated Playwright headless browser runs and verified at 1440x900 resolution with 1.5x device scale factor.
