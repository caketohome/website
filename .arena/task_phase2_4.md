# CakeToHome Phase 2.4 — Invoice Safeguard Hardening & Final Verification

## Objective
Harden the statutory invoice sequence safeguard in `frontend/src/lib/services/delivery-invoicing.service.ts` to ensure fail-closed security across all database and configuration failure modes, preserve valid customer orders and payments when statutory invoicing is blocked, and independently verify the Phase 2 Playwright customer journey suite.

## Core Constraints
1. **Existing Schema Only**: 0 new tables, 0 column alterations, 0 sequence mutations, 0 stored function alterations.
2. **Fail-Closed Statutory Invoicing**:
   - Conflicting GSTIN produces `INVOICE_SERIES_PREFIX_CONFLICT`.
   - Database failure/unavailability/timeout MUST fail closed with an explicit error (`INVOICE_SEQUENCE_VERIFICATION_FAILED`). Under NO circumstance may a database error be caught and silently bypassed to allow statutory invoice allocation.
   - Missing/invalid/whitespace prefix must fail closed (`INVOICE_PREFIX_INVALID`).
3. **Preserve Customer Business Data**:
   - Order creation, payment authorization, and delivery dispatch must succeed and persist.
   - If statutory tax invoicing is blocked, the customer order and payment MUST NOT be rolled back or lost.
   - Do not emit placeholder statutory invoice numbers or fake statutory success.
4. **Legal Identity & Authority**:
   - Historical GSTIN `29AAACC1234F1Z5` (bound to prefix `CTH` with `last_seq = 74` in FY 2026) vs active GSTIN `29AABCC1234F1Z5`.
   - Do not invent prefixes or assume CA approval. Fail closed until CA authorization.
5. **Playwright E2E Verification**:
   - Independently verify the 24-assertion test suite and report JSON.
