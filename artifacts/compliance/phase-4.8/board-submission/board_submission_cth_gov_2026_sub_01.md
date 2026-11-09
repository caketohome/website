# BOARD SUBMISSION: CTH-GOV-2026-SUB-01
**Company:** CakeToHome India Private Limited  
**CIN:** U15400KA2026PTC189211  
**GSTIN:** 29AABCC1234F1Z5  
**Document Status:** PROPOSED FOR BOARD CONSIDERATION (DRAFT)  

## 1. Background & Statutory Mandate
CakeToHome India Private Limited has completed corporate structuring to operate its pan-India e-commerce cake and confectionery delivery platform. Under Rule 46(b) of the Central Goods and Services Tax Rules, 2017, the Company is required to issue consecutively numbered tax invoices not exceeding 16 characters containing only alphabets, numerals, hyphens, and slashes.

## 2. Technical Findings on Historical Series Collision
Audits of the existing database confirmed that serial number `CTH/26-27/000001` is occupied by historical record `inv_1792901376459_xlxkf` belonging to the predecessor entity (`29AAACC1234F1Z5`). Attempting to reuse `CTH` triggers a fatal database duplicate key violation.

## 3. Matters for Board Resolution
1. Approval of official entity tax prefix `CH` (selected business preference, replacing CTH, C2H, and CTHI).
2. Designation of sequence padding width: minimum 6 digits (`000001` to `999999`) expanding to 7 digits (`1000000` to `9999999`), capped strictly at 16 characters max under CGST Rule 46(b).
3. Delegation of signing and configuration authority to authorized officers.
4. Approval of dual-control Segregation of Duties (SoD) policy.
