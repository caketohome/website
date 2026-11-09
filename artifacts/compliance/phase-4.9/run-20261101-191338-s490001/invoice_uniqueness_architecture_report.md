# Invoice Uniqueness Architecture Report — Phase 4.9

---

## 1. Architectural Evaluation: Alternatives A, B, and C

### Alternative A: Distinct Production Prefix (Preserve Global Unique Constraint)
- **Mechanism:** Select `C2H` or `CTHI`. Retain `UNIQUE(invoice_number)`.
- **Pros:** Zero DDL migrations required; zero risk of corrupting historical joins; seamless interoperability with accounting vouchers and payment transaction reconciliation.
- **Cons:** Deviates slightly from historical internal 3-letter abbreviation.
- **Verdict: SELECTED ARCHITECTURAL SOLUTION.**

### Alternative B: Composite Unique Constraint `UNIQUE(supplier_gstin, invoice_number)`
- **Mechanism:** Drop `invoice_invoice_number_key`; add composite index.
- **Pros:** Allows reusing `CTH` under legal GSTIN `29AABCC1234F1Z5`.
- **Cons:** High blast radius across foreign keys, ORM models, customer lookup APIs, and accounting voucher linking.
- **Verdict: REJECTED.**

### Alternative C: Historical Data Remediation / Quarantining
- **Mechanism:** Update or delete `inv_1792901376459_xlxkf`.
- **Pros:** Clears the `CTH` sequence.
- **Cons:** Violates statutory immutable audit trail standards under Companies Act Section 128 and CGST Act Section 35.
- **Verdict: REJECTED.**
