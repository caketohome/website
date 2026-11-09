# PHASE 6.1.3 — ACCOUNTING & FINANCIAL LEDGER INTEGRATION
## Double-Entry Posting, Statutory Tax Registers & Gateway Clearing
**Entity:** CakeToHome India Private Limited  

---

### 1. Journal Voucher Postings
For each confirmed order (e.g., ₹525.00 total = ₹500.00 base + ₹25.00 GST):
- **Debit:** GL 1030 — Cashfree Gateway Clearing Account (₹525.00)
- **Credit:** GL 4010 — Cake & Gourmet Bakery Sales Revenue (₹500.00)
- **Credit:** GL 2020 — CGST Payable Account (2.5%) (₹12.50)
- **Credit:** GL 2021 — SGST Payable Account (2.5%) (₹12.50)

---

### 2. Settlement Reconciliation
- Cashfree settlements are mapped from `gateway_settlement` to company bank accounts.
- Transaction fees and GST on gateway charges are posted to GL 5050 (Gateway Charges Expense).
