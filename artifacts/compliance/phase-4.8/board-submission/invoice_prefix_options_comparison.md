# INVOICE PREFIX OPTIONS COMPARISON REPORT
**Prepared for:** Board of Directors, CakeToHome India Private Limited  
**Status:** DRAFT — PROPOSAL PENDING FORMAL BOARD ADOPTION & PROFESSIONAL CLEARANCE  

| Option | Prefix | FY Format | Padding / Expansion | Total Length | Annual Capacity | Collision Risk | Downstream Risk | Business Recommendation |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Option Primary (Selected)** | `CH` | `26-27` | 6 digits min -> 7 digits | **15 - 16 chars** | **9,999,999** | **0 Collisions** | Zero | **SELECTED BUSINESS PREFERENCE** (Highest capacity within 16-char GST limit) |
| **Option A (Superseded)** | `CTHI` | `26-27` | 5 digits fixed | **16 chars** | 99,999 | **0 Collisions** | Zero | Superseded by CH |
| **Option B (Superseded)** | `C2H` | `26-27` | 6 digits fixed | **16 chars** | 999,999 | **0 Collisions** | Zero | Superseded by CH |
| **Option C (Rejected)** | `CTH` | `26-27` | 6 digits | **16 chars** | 999,925 | **COLLISION** | High | Unusable (collides with inv_1792901376459_xlxkf) |

**Key Findings:**
1. Prefix `CH` (2 characters) paired with FY `/26-27/` (7 characters) consumes only 9 characters, allowing a 6-digit serial (`000001` to `999999`) at 15 characters, and seamless expansion to 7 digits (`1000000` to `9999999`) at exactly 16 characters.
2. Capacity is expanded by an order of magnitude to **9,999,999 invoices/year** while remaining 100% compliant with CGST Rule 46(b) (max 16 characters).
3. Serials >= 10,000,000 are rejected as exceeding the statutory 16-character ceiling.
4. Historical prefix `CTH` remains locked and quarantined.
