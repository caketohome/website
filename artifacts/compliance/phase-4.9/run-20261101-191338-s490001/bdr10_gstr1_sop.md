# BDR-10 GSTR-1 Table 13 Document Summary SOP — Phase 4.9

---

## 1. Standard Operating Procedure
1. **Extraction**: On the 1st of each calendar month, run the automated GSTR-1 Table 13 extraction query for the preceding tax period.
2. **Reconciliation**:
   - Total number of invoices issued: $N_{	ext{issued}} = 	ext{End Serial} - 	ext{Start Serial} + 1$.
   - Cancelled invoices: $N_{	ext{cancelled}}$.
   - Net valid invoices: $N_{	ext{net}} = N_{	ext{issued}} - N_{	ext{cancelled}}$.
3. **Filing**: Upload document summary to the GSTN portal prior to the 11th of the month.
