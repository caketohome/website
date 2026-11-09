# CAKETOHOME — CURRENT ARCHITECTURE AUDIT
## Analysis of Pre-Phase 5 Application Architecture, Coupling & Debt

- **Audit Target:** Pre-Phase 5 API Engine, Medusa Backend & Next.js Storefront
- **Status:** Evaluated and Documented

### 1. Key Audit Findings

1. **Payment Gateway Tight-Coupling:** The previous implementation had Razorpay hardcoded in checkout actions, form state, and webhook verification. In Phase 5, this coupling was completely severed in favor of Cashfree.
2. **Scattered Business Logic:** Order creation and stock deduction logic were partially duplicated across frontend actions and backend routes. NestJS consolidates domain services.
3. **Decoupled Identity:** Supabase Cloud authentication was previously configured alongside fallback mock users. Phase 5 enforces database-backed authorization with `auth.users` and `public.user_role_assignments`.
4. **Order ≠ Bill Discipline:** Verified that while order numbering occurs at checkout (`CTH-YYYY-XXXXXX`), statutory tax invoice numbering (`CH/26-27/0000XX`) occurs strictly at delivery.
