# CAKETOHOME — CUSTOMER LIFECYCLE ASSURANCE REPORT
## Workflow 1 & Workflow 3 End-to-End Customer Verification

### 1. Lifecycle Progression
1. **Phone Intake & Normalization:**
   - Raw formats normalized to standard E.164:
     - `9876543210` → `+919876543210`
     - `09876543210` → `+919876543210`
     - `919876543210` → `+919876543210`
     - `+919876543210` → `+919876543210`
2. **Identity & Profile Synchronization:**
   - User created in `auth.users` with UUID primary key.
   - Synchronized with `public.profiles` via automated trigger or profile provisioning.
   - Role assignment in `public.user_role_assignments` defaults to `CUSTOMER`.
3. **Cart & Address Selection:**
   - Customer adds items to cart. Addresses formatted with mandatory line1, city, state, and pincode.
4. **Checkout Submission:**
   - Submission includes `idempotency_key`. Duplicate requests return existing order without creating secondary order records.
5. **Order Delivery & Invoice Delivery:**
   - On delivery, order is updated with delivered timestamp, delivery OTP verified, and customer notification sent.
