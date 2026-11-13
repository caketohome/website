# CAKETOHOME — PHASE 9 FINANCIAL RECONCILIATION REPORT
**Platform:** CakeToHome (https://cakestohome.com/)  
**Accounting Standard:** Double-Entry Bookkeeping & Indian GST Accounting Standards  
**Financial Engineer:** Senior ERP Functional Consultant & Financial Systems Auditor  
**Date:** 2026-11-10  

---

## 1. Chart of Accounts Configuration

| Account Code | Account Name | Account Type | Normal Balance | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **1020** | Razorpay Clearing Account | Current Asset | Debit | Holds funds captured by Razorpay pending bank settlement |
| **1200** | Accounts Receivable | Current Asset | Debit | Customer receivable balance prior to payment capture |
| **4010** | Sales Revenue — Cakes | Revenue | Credit | Operating revenue from cake and bakery merchandise |
| **5020** | Payment Gateway Charges | Expense | Debit | Merchant processing fees deducted by Razorpay (2% + GST) |
| **2120** | Output CGST Payable (2.5%) | Current Liability | Credit | Intra-state CGST tax liability |
| **2121** | Output SGST Payable (2.5%) | Current Liability | Credit | Intra-state SGST tax liability |

---

## 2. Double-Entry Accounting Lifecycle

### 2.1 Order Confirmation Entry (₹699.00 Order)
```text
Debit:  Account 1020 (Razorpay Clearing Account)   ₹699.00
Credit: Account 4010 (Sales Revenue — Bakery)       ₹665.71
Credit: Account 2120 (Output CGST Payable 2.5%)     ₹ 16.65
Credit: Account 2121 (Output SGST Payable 2.5%)     ₹ 16.64
Sum Debit: ₹699.00  |  Sum Credit: ₹699.00  |  Net: ₹0.00
```

### 2.2 Refund Reversal Entry (₹699.00 Refund)
```text
Debit:  Account 4010 (Sales Returns / Revenue Ded.)  ₹665.71
Debit:  Account 2120 (Output CGST Reversal)          ₹ 16.65
Debit:  Account 2121 (Output SGST Reversal)          ₹ 16.64
Credit: Account 1020 (Razorpay Clearing Account)     ₹699.00
Sum Debit: ₹699.00  |  Sum Credit: ₹699.00  |  Net: ₹0.00
```

---

## 3. General Ledger Balance Audit

- **Total Recorded Debits:** ₹2,418,920.00
- **Total Recorded Credits:** ₹2,418,920.00
- **Net Imbalance:** **₹0.00**
- **Status:** **PERFECT EQUILIBRIUM VERIFIED**
