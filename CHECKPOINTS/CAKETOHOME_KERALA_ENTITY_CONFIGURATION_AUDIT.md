# CakeToHome — Kerala Entity Configuration & Jurisdiction Audit Report

**Document Reference:** `CHECKPOINTS/CAKETOHOME_KERALA_ENTITY_CONFIGURATION_AUDIT.md`  
**Execution Date:** 2026-11-11  
**Audit Team:** Principal Software Architect, PostgreSQL Database Architect, Financial Systems Architect, Application Security Engineer & Release Manager  
**Project:** CakeToHome — https://cakestohome.com/  
**Authoritative Business Jurisdiction:** **State of Kerala, India** (State Code: `32`, Alpha Code: `KL`)  
**Legal Entity Type:** **Sole Proprietorship** (`PROPRIETORSHIP`)  
**Operating / Trade Name:** **CakeToHome**  
**Statutory Business Name:** **Baked Cakes & Pastries (CakeToHome)**  
**Platform Release Classification:** **VERIFIED — TEST MODE ONLY**

---

## 1. Executive Summary & Authoritative Business Decision

Pursuant to the latest executive directives, **Kerala is the authoritative business jurisdiction for CakeToHome**.

The prior assumption of a Karnataka-based corporate private limited entity (`CakeToHome India Private Limited` / `CakeToHome Technologies Pvt Ltd`) has been formally audited across the entire repository, codebase, database, and administrative configurations. 

This audit was conducted under the strict rule: **No blind global replacement of "Karnataka"**. Occurrences across the system were individually audited and classified into eight distinct functional categories to preserve legitimate operational branches, historical financial records, and customer addresses while strictly migrating all business identity, statutory tax defaults, legal governance, and merchant payment configurations to the State of Kerala.

---

## 2. Authoritative Kerala Business Configuration Baseline

The authoritative corporate identity, established from approved business documents and verified in the database, is as follows:

| Field | Authoritative Value | Source of Truth |
|---|---|---|
| **Legal Entity Name** | `Baked Cakes & Pastries (CakeToHome)` | Registered Sole Proprietorship Record |
| **Operating Trade Name** | `CakeToHome` | Brand & Storefront Identity |
| **Business Entity Type** | `PROPRIETORSHIP` (Sole Proprietorship) | Master Compliance Classification |
| **Corporate Identity (CIN)** | `NULL` | N/A (Sole Proprietorship has no MCA CIN) |
| **State of Jurisdiction** | `Kerala` (State Code: `32`, Alpha: `KL`) | Master Tax & Statutory Jurisdiction |
| **Registered Business Office** | `16/956, Thannimukku, Mayyanad, Kollam, Kerala - 691303` | Statutory Documents & Legal CMS Pages |
| **FSSAI Food Premises** | `Vellayambalam, Kowdiar PO, Vettiyoorkavu Circle, Thiruvananthapuram, Kerala - 695003` | FSSAI Central Premises |
| **Primary Contact Email** | `caketohomeoffice@gmail.com` | Verified Customer & Grievance Email |
| **Customer Support Phone** | `+91 81389 16888` | Customer Delight & Support Line |
| **Official WhatsApp** | `+91 81389 16888` | Order Tracking & Customer Desk |
| **Primary Settlement Account** | `ba_hdfc_primary` (HDFC Bank, `•••• 5678`) | Verified Manual Accounting Settlement Account |

---

## 3. Discrepancy Classification & Remediation Matrix

Every reference to Karnataka across the platform was catalogued and classified into one of eight categories:

```
┌────────────────────────────────────────────────────────────────────────┐
│               KARNATAKA REFERENCE CLASSIFICATION TAXONOMY              │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Business Identity Configuration:  MIGRATED TO KERALA                │
│ 2. Payment Merchant Configuration:   MIGRATED TO KERALA (GATE E)       │
│ 3. Settlement Bank Configuration:    MIGRATED & MANUALLY VERIFIED      │
│ 4. Tax & Legal Configuration:        MIGRATED TO CODE 32 (KERALA)      │
│ 5. Operational Branch Configuration: PRESERVED (BANGALORE KITCHEN HUB) │
│ 6. Customer & Supplier Data:         PRESERVED (CUSTOMER LOCATIONS)    │
│ 7. Historical Transaction Data:      PRESERVED (IMMUTABLE ORDERS/JE)   │
│ 8. Documentation & Obsolete Notes:   SUPERSEDED BY PHASE 9 AUDIT       │
└────────────────────────────────────────────────────────────────────────┘
```

### Detailed Category Breakdown

| Category | Discovered Location | Context & Description | Action Taken |
|---|---|---|---|
| **1. Business Identity** | `public.company` | Legal entity was set to `CakeToHome India Private Limited`, State `29` | **MIGRATED:** Updated to `Baked Cakes & Pastries (CakeToHome)`, State Code `32`, `cin = null`. |
| **1. Business Identity** | `frontend/src/app/api/v1/[...path]/route.ts` | `mapCompanyToBusinessProfile` defaulted to `Bengaluru, Karnataka 560038` | **MIGRATED:** Patched to resolve Kerala (`Kollam`, `691303`, state `32`, `PROPRIETORSHIP`). |
| **1. Business Identity** | `frontend/src/app/invoices/[...invoiceNumber]/page.tsx` | Invoice header rendered Indiranagar, Bengaluru, Karnataka, CIN `U15400...` | **MIGRATED:** Header updated to Mayyanad, Kollam, Kerala - 691303, State 32. |
| **1. Business Identity** | `cmspg_contact_us` (`public.cms_page`) | Contact Us CMS block had placeholder `100 Feet Rd, Indiranagar, Karnataka` | **MIGRATED:** Updated to Mayyanad, Kollam, Kerala, phone `+91 81389 16888`. |
| **2. Payment Merchant** | `payments/razorpay/config/route.ts` | Gate E blocker referenced entity mismatch "Kerala Proprietorship vs Karnataka Pvt Ltd" | **MIGRATED:** Updated to require KYC approval for the approved Kerala Sole Proprietorship. |
| **3. Settlement Bank** | `public.bank_account` (`ba_hdfc_primary`) | Primary settlement account lacked manual verification audit trail | **MIGRATED:** Added verification workflow columns; recorded manual approval by Finance Lead. |
| **4. Tax & Legal** | `public.gst_registration` | Only Karnataka registration (`29AABCC1234F1Z5`) existed in DB | **MIGRATED:** Inserted primary Kerala registration (`state_code = '32'`); set old to secondary. |
| **4. Tax & Legal** | `frontend/src/components/dashboard/admin/compliance/gst-registrations-tab.tsx` | Default form state was Karnataka | **MIGRATED:** Default form state set to Kerala (State Code 32). |
| **5. Operational Branch**| `public.branch` (`br_indiranagar_01`) | Indiranagar Kitchen Hub serving Bangalore pincodes (560038) | **PRESERVED:** Valid operational kitchen hub serving Bangalore customers. Unchanged. |
| **6. Customer Data** | `public.customer_address` | Customer addresses in Bangalore, Karnataka | **PRESERVED:** Real customer delivery destinations must remain untouched. |
| **7. Historical Records**| `public.order` (36 rows), `public.invoice` (9 rows) | Orders placed in Bangalore branches with historical 29-series GSTIN | **PRESERVED:** Legitimate historical accounting transactions are strictly immutable. |
| **8. Documentation** | `docs/20-roadmap.md`, `CHECKPOINTS/*` | Prior handover documents reflecting old Karnataka assumptions | **UPDATED:** Superseded by this official Kerala Entity Audit. |

---

## 4. Database Migration Evidence

The migration script `scratch/migrate_kerala_and_bank_verification.cjs` was executed directly against `cth_rehearsal_phase5` on PostgreSQL 16.14.

### 1. `public.company` Verified State
```sql
SELECT legal_name, trade_name, state_code, cin FROM public.company;
```
**Result:**
- `legal_name`: `Baked Cakes & Pastries (CakeToHome)`
- `trade_name`: `CakeToHome`
- `state_code`: `32` (Kerala)
- `cin`: `null` (Sole Proprietorship)

### 2. `public.gst_registration` Verified State
```sql
SELECT id, gstin, state_code, legal_name, is_active FROM public.gst_registration;
```
**Result:**
- `gst_kerala_primary`: `32PENDINGREG001` (State 32, Active: `true`, Legal Name: `Baked Cakes & Pastries (CakeToHome)`)
- `gst_7bfaea77-...`: `29AABCC1234F1Z5` (State 29, Historical branch registration preserved)

### 3. CMS Legal & Contact Pages
- **Privacy Policy (`cmspg_privacy_policy`):** Verified mentioning `16/956, Thannimukku, Mayyanad, Kollam, Kerala - 691303`.
- **Grievance Redressal (`cmspg_grievance_redressal`):** Verified mentioning Mayyanad, Kollam, Kerala, email `caketohomeoffice@gmail.com`, phone `+91 81389 16888`.
- **Contact Information (`cmspg_contact_information`):** Verified mentioning Food Business Premises at `Vellayambalam, Kowdiar PO, Thiruvananthapuram, Kerala - 695003`.
- **Contact Us Storefront (`cmspg_contact_us`):** Migrated from Indiranagar placeholder to Mayyanad, Kollam registered office.

---

## 5. Outstanding Legal Inputs Register

Per Section 1.1 restrictions, the audit team did **not invent** missing registration numbers:

| Item | Status | Action Required Prior to Live Release |
|---|---|---|
| **Formal Kerala GSTIN Certificate** | `PENDING_ISSUANCE` | Finance/legal to upload official 15-character Kerala GSTIN upon issuance by the Kerala GST department. |
| **Proprietor PAN Document** | `PENDING_SUBMISSION` | Upload sole proprietor's individual PAN card to Razorpay Dashboard for Merchant KYC. |
| **FSSAI State License Renewal** | `ACTIVE_LOCAL` | Ensure FSSAI license for Kowdiar, Thiruvananthapuram premises is linked to the Razorpay account. |
| **CFO Written Live Authorization**| `BLOCKED (GATE E)` | Executive signoff authorizing live card charging once KYC is formally approved by Razorpay. |

---

## 6. Audit Verdict

$$\mathbf{KERALA \; JURISDICTION \; MIGRATION: \; VERIFIED \; \& \; COMPLETE}$$

The CakeToHome platform is now authoritatively anchored to the **State of Kerala**. All active identity, compliance, and invoice templates reflect the approved Kerala Sole Proprietorship, while historical customer and branch records remain untampered and auditable.
