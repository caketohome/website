# CAKETOHOME — PHASE 6.1.2 STATUTORY INVOICING INTEGRATION
## GST COMPLIANCE, HSN 1905, TAX BREAKDOWN & SEQUENTIAL INVOICE GENERATION

**Company:** CakeToHome India Private Limited  
**CIN:** U15400KA2026PTC189211 | **GSTIN:** 29AABCC1234F1Z5  
**Tax Harmonized Code:** HSN 1905 (Cakes, Pastries, Baked Goods)

---

### 1. STATUTORY TAX CALCULATION

For the verified ₹525.00 Classic Chocolate Truffle Cake order:
- **Taxable Value:** ₹500.00
- **Intra-State GST (Karnataka to Karnataka):**
  - CGST @ 2.5%: ₹12.50
  - SGST @ 2.5%: ₹12.50
  - Total GST (5%): ₹25.00
- **Total Tax-Inclusive Amount:** ₹525.00

### 2. INVOICE RECORD SPECIFICATION

Invoices are generated sequentially (`INV-2026-XXXXX`) in `public.invoice`:
- Contains company legal name, registered address, GSTIN, CIN.
- Contains customer billing & shipping addresses.
- Contains Cashfree payment reference and transaction timestamp.
- Available for customer download on the `/your-order` page.
