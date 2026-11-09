# Voucher and General Ledger Reconciliation

## 1. Census of Accounting Vouchers
Querying `public.voucher` in `cth_test` reveals exactly **4 vouchers**:
1. `vch_1792901376459_1`: Status `DRAFT` (Unposted)
2. `vch_1792901376459_2`: Status `DRAFT` (Unposted)
3. `vch_1792901376459_3`: Status `DRAFT` (Unposted)
4. `vch_1792901376459_4`: Status `CANCELLED`

## 2. General Ledger Impact
- **Posted Vouchers:** 0
- **General Ledger Distortion:** **0.00**
- Because all historical vouchers are either draft or cancelled, no postings have corrupted the general ledger balance.
