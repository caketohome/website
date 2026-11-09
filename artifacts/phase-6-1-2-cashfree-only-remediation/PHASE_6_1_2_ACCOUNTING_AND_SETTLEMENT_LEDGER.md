# CAKETOHOME — PHASE 6.1.2 ACCOUNTING & SETTLEMENT LEDGER
## CHART OF ACCOUNTS, CASHFREE CLEARING (GL 1030) & DOUBLE-ENTRY INTEGRITY

**Company:** CakeToHome India Private Limited  
**Module:** Financial Accounting & Settlement Clearing

---

### 1. DOUBLE-ENTRY JOURNAL ENTRY

Every confirmed Cashfree order records a balanced double-entry transaction:
```
Date: 2026-11-06
Reference: CF-PAY-CTH-2026-XXXX

Dr. Cashfree Settlement Clearing (Account 1030)         ₹525.00
    Cr. Cake Sales Revenue (Account 4010)                           ₹500.00
    Cr. Output CGST Payable (Account 2021)                          ₹ 12.50
    Cr. Output SGST Payable (Account 2022)                          ₹ 12.50

Total Debit: ₹525.00 | Total Credit: ₹525.00 | Net Variance: ₹0.00
```

### 2. SETTLEMENT TO BANK ACCOUNT RECONCILIATION

When Cashfree executes the daily T+1 bank settlement:
```
Dr. HDFC Current Account (Account 1010)                 ₹514.50
Dr. Payment Gateway Charges (Account 5050 - 2% fee)     ₹ 10.50
    Cr. Cashfree Settlement Clearing (Account 1030)                 ₹525.00

Balance of Cashfree Settlement Clearing returns to ₹0.00 upon payout reconciliation.
```
