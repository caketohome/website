# Invoice Uniqueness Architecture Comparison
**Comparison of Alternatives:**
1. **Alternative A (Global Uniqueness + Distinct Prefix):** Selected. Requires 0 DDL changes, 0 risk to downstream queries.
2. **Alternative B (Composite Uniqueness Key):** High risk. Weakening to `UNIQUE (seller_gstin, fiscal_year, invoice_number)` breaks single-column joins and customer portal lookups.
3. **Alternative C (Dedicated Entity Tables):** Unnecessary operational complexity without addressing core invoice table collisions.
