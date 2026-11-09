# CakeToHome ERP — C7.9 Design Lock & Acceptance Checklist
## Output of the read-only review of the C7.8 Forensic Discovery Report

**Status:** 🔒 **DESIGN LOCKED & STEP C7.9a MIGRATION COMPLETE & VERIFIED (2026-10-12)**
**Implementation authorization:** **STEP C7.9a EXECUTED & AUDITED — AWAITING C7.9b AUTHORIZATION**
**Review mode:** READ-ONLY. No source edits, no DB writes, no migrations, no commit/reset/stash/clean/push.
**Reviewed artefacts:** [C7.8 report](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase-c7-8-forensic-discovery-report.md),
[master plan](file:///e:/vig/cakes2home-main/cakes2home-main/CHECKPOINTS/phase-c7-8-to-c7-14-corporate-account-delivery-routing-master-plan.md),
cited sources, and three new read-only inspectors (all run inside `BEGIN READ ONLY … ROLLBACK`):
`scratch/forensic_c7_8_data_classification.js`, `scratch/forensic_c7_8_customer_rbac_conventions.js`,
`scratch/forensic_c7_8_masked_secret_scan.js` (+ JSON outputs).

---

## 1. Contradictions and errors found (and resolution)

| # | Finding | Evidence | Resolution |
|---|---|---|---|
| X1 | **R1 was understated.** Uncommitted work is not "C7.7 only". HEAD is `0ae2ee0` (phase5c). **44 tracked files are modified (+6 363 / −798)** and **~443 files are untracked**, covering Phases A/B/C (company-GST, bank accounts, teller), C5/C6 (expense, manual journals) and C7.1–C7.7, plus 100 acceptance-evidence files. | `git diff --shortstat`, `git ls-files -o` | R1 severity → **Critical**. Gate G1 (§2). |
| X2 | **Not every modification belongs to C7.x.** `api-engine.ts` diff is 4 lines (default delivery-partner seed; async OTP verify) and `admin/branches/route.ts` adds an admin-auth guard — neither is gifting/accounting work. `db-persistence.ts` (+53/−19) was **not inspected** and is unclassified. | `git diff -U1` | Owner must classify these; never bundled blindly into a C7.7 commit. |
| X3 | **`[...path]/route.ts` (+2 598/−180) is a shared monolith** touched by many phases; per-phase commits require hunk splitting. Same for `staff-access-control.ts`, `domain.ts`, `services/index.ts`, `repositories/index.ts`, `accounting.types.ts`. | `git diff --numstat` | Recommend one baseline commit for these shared files (§2.G1). |
| X4 | **Credential-like strings in untracked files that would be committed**: 6 scripts (incl. frozen suite `frontend/scratch/test_phase_c7_7_step7c_api.js:85`, `frontend/scratch/inspect_triggers.js`, `frontend/scratch/test_tx.js`, `scratch/capture_db_baseline{,_v2,_v3}.js`, `scratch/check_order_schema.js`) match "Postgres URL with password"; `prg01-step2-…runbook.md:557` matches a live-key prefix. `.env` itself is git-ignored. Values were **not printed**. | masked scan | Gate G1: sanitise (env var) or rotate credential **before** any commit. |
| X5 | **Frozen-suite paths are wrong** in master plan §11 and `LATEST_CHECKPOINT.md`: they cite `scratch/…`; all 8 suites actually live in **`frontend/scratch/`**. | file existence check | Amend paths (§9). |
| X6 | **Permission names differ.** Master plan: `CORPORATE_COMPANY.*`, `CORPORATE_EMPLOYEE.*`, `CORPORATE_CREDIT.MANAGE`. Report: `CORPORATE_ACCOUNTS.*`, `CORPORATE_EMPLOYEES.*`. | both docs | Lock the **report's module names**, with the action set in §5. |
| X7 | **Assignment-status vocabulary differs.** Master plan: `UNASSIGNED, ASSIGNED, PENDING_REVIEW, ACCEPTED, DELIVERED, REASSIGNED`. Report: `UNASSIGNED, ASSIGNED, NEEDS_REVIEW, REASSIGNED, FAILED`. | both docs | Lock the **master-plan vocabulary** (it is the stakeholder-approved one); finalise in C7.11. Not a C7.9 table. |
| X8 | **Master plan says C7.9 ∥ C7.10 may run in parallel**; report orders them sequentially. | plan §6 note | Lock **sequential C7.9 → C7.10** (both edit the route monolith and RBAC registry; C7.10 is gated on data decisions). |
| X9 | **Naming:** master plan §1 still says "Corporate Company"/"Store". | plan §1, §2 | `corporate_account` (table), "Corporate Account" (UI). "Store" = a `branch` row; **no new store table**. |
| X10 | **ID convention misreported.** Report said `prefix_ULID`. Actual recent convention is `<prefix>_<gen_random_uuid()::text>` (`cgb_`, `cgr_`, `gst_`, `cth_company_`); legacy branch ids are `br_<ULID>`; customers are `cus_`/`cth_`/`usr_`. | migration 7A, phase A/B/C SQL, prefix query | New tables use `<prefix>_<uuid>` (§4). |
| X11 | **Report missed the existing credit-activation path.** `BillsReceivableService.approveCorporateCredit` ([bills-receivable.service.ts:517](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/lib/services/bills-receivable.service.ts#L517)) is the only writer of `customer.credit_*`; it sets `is_corporate=true`, takes `pg_advisory_xact_lock('corp_credit_'+customerId)`, enforces a **four-eyes** rule (`customer.created_by ≠ approver`), but gates on `CUSTOMER.EDIT` **or** `ACCOUNTING.POST/APPROVE`. The route `POST admin/corporate-customers/:id/credit-approval` ([route.ts:7259](file:///e:/vig/cakes2home-main/cakes2home-main/frontend/src/app/api/v1/%5B...path%5D/route.ts#L7259)) accepts `ACCOUNTING.APPROVE` **or** `CUSTOMER.EDIT`. | code read | **Policy bypass risk**: any `CUSTOMER.EDIT` staff can grant credit, contradicting "Super Admin approves credit activation". See §6 and open decision Q1. Report's O4 ("Super Admin + Finance") is superseded. |
| X12 | **Report R9 overstated.** "Identical coordinates across 53 branches" is wrong: **25 of 53** share (12.9716, 77.6412) and 6 share (12.9716, 77.5946); the rest differ. | classification JSON | Corrected in §3. |
| X13 | **O5 ("clean test data — Yes") is overruled** by the owner; and the data shows why: posted accounting references "fixture-looking" branches (§3). | classification JSON | Replaced by the reversible plan in §3.5. |
| X14 | **Report treated `res_01KXYMAHGF…` as a possible orphan.** It is the **hard-coded legacy "Indiranagar" branch id used by ≥20 test scripts**; 7 `delivery_zone` rows and 5 `payment_transaction` rows point to it, but no `branch` row has that id (live Indiranagar is `br_indiranagar`). | classification JSON + test grep | Legacy alias, not garbage. Do not delete; resolve via alias/mapping (§3.5). |
| X15 | **Report schema omitted "authorized corporate staff".** There is no `customer.user_id`; CUSTOMER-role sessions act on `customerId \|\| userId`. `user_rbac_role` has **0 rows** (permissions come from the static registry/role presets, not DB rows). | conventions JSON, controller L158–215 | Add `corporate_account_member` (§4). New permissions go in the static registry + presets + tests. |
| X16 | **Report put `employee_ref_id` on `corporate_gifting_recipient` in C7.9.** It would touch a frozen C7.7 table with no consumer until C7.13. 7A suite uses `>=` column counts so it would pass, but there is no benefit. | 7A suite L73/L81 | **Defer to C7.13.** C7.9 alters no C7.7 table. |
| X17 | `customer` has **no CHECK on `credit_status` or `gstin`** (only `credit_limit>=0`, `payment_terms_days>=0`); `customer.company_name`/`gstin` duplicate what `corporate_account` will hold. | constraints query | Single source of truth rule in §6.3. |
| X18 | `LATEST_CHECKPOINT.md` still shows C7.8 `NOT STARTED`; `frontend/CHECKPOINTS/LATEST_CHECKPOINT.md` has **no** roadmap section (the two copies diverge). | file reads | Root copy updated; frontend copy intentionally left (owner decision). |

Also confirmed correct in the report: customer corporate columns; `company` is a singleton operator entity; 0 corporate customers; PostGIS available-not-installed; engine PATH B silent fallbacks; gifting single-branch default + hard-coded GST fallbacks; `delivery_partner` has person fields only.

---

## 2. Entry gates (all must be ✅ before the first C7.9 migration)

| Gate | Requirement | Applies to |
|---|---|---|
| **G1 Source-control integrity** | (a) Make an off-tree backup first: `git diff --binary` patch + archive of untracked non-scratch files. (b) Owner classifies the 3 non-C7 modified files (X2). (c) Sanitise/rotate credentials (X4). (d) Review the exact diff per group below; commit on a **new branch** (e.g. `checkpoint/c-phases-baseline`), never amend/reset/clean/stash. (e) `tsc --noEmit` = 0 and frozen suites green on the committed tree. | C7.9 |
| **G2 Data classification accepted** | Owner confirms §3 classification sheet. **No data mutation is required for C7.9** (it reads no branch/zone data). | **C7.10 onward** |
| **G3 Decisions Q1–Q5 resolved** | ✅ **RESOLVED & LOCKED (2026-10-12)**: See §10 for confirmed owner decisions. | C7.9 |
| **G4 Baseline re-run** | All suites in master-plan §11 (corrected paths) + `tsc` re-run green *immediately before* migration; record observed CoA/TB/voucher counts. | C7.9 |
| **G5 Docs reconciled** | This lock accepted; master plan banner + §11 path fix applied; report errata applied. | C7.9 |

### G1 proposed commit groups (proposal only — nothing committed)
| Group | Content (by evidence) | Notes |
|---|---|---|
| 1 | Phase A–C foundations: `company.*`, `gst-registration.*`, `bank-*`, `teller*`, `vault-custody*`, `backend/src/migrations/20261004_*`, bank/teller panels | |
| 2 | C5/C6: `expense-*`, `manual-journal*`, `migrate_c5_expense_accounting.js` | |
| 3 | C7.1–C7.5: schema foundations, bills payable/receivable, branch cash, petty cash | |
| 4 | C7.6: cost centre / allocation | |
| 5 | C7.7: `corporate-gifting.*`, panel, `backend/src/migrations/20261009_*`, `migrate_phase_c7_7_*` | |
| 6 | **Unclassified**: `api-engine.ts`, `admin/branches/route.ts`, `db-persistence.ts` | owner decision |
| 7 | Shared monoliths (route.ts, RBAC registry, types, indexes, admin tabs) | commit once with groups 1–5 (hunk-splitting is error-prone) |
| 8 | Tests/evidence/screenshots under `scratch/`, `frontend/scratch/`, `CHECKPOINTS/acceptance-test-evidence` | owner: commit vs ignore; **sanitise first** |
| 9 | Roadmap docs (master plan, C7.8 report, this lock, `LATEST_CHECKPOINT.md`) | |

---

## 3. Branch and zone data — classification (read-only; **no cleanup authorised**)

### 3.1 Branches (57 rows; 53 live, 4 soft-deleted)
| Class (name/metadata heuristic — **not authoritative**) | Count | Notes |
|---|---|---|
| Likely fixture ("Postgres Pipeline Branch …", "Playwright E2E Hub …", …) | 40 | created 2026-07-31 → 2026-08-28 |
| Not matched by heuristic | 13 | **Still includes test data**: "Direct Branch 1785517348386", "alex", 2× "Search Verification Bakery …" |
| Seeded set (created together 2026-08-28 04:07:08.740) | 8 | Indiranagar, Koramangala, HSR, Whitefield, Chennai T.Nagar, Kollam Central, Mumbai Bandra, Kochi Ernakulam — probably the real/demo network; **owner must confirm** |

**Real-looking data defects found:**
- `br_mumbai_bandra` is at **(9.9597, 76.2987) — Kochi**, not Mumbai.
- `br_1788949580698` is a **duplicate "Kollam Central Cake Studio"** with malformed code `HUB-KLM-01HUB-KLM-99`.
- Several fixture-class rows have `city_id = null`.
Consequence: branch lat/lng cannot be trusted for routing until reviewed; the name heuristic cannot decide deletion.

### 3.2 References (why deletion/normalisation is unsafe)
| Table | Rows referencing a branch | On "fixture-class" branches |
|---|---|---|
| `accounting_voucher` (posted) | 6 | **3** |
| `accounting_journal_entry` / `_line` | 4 / 10 | **2 / 4** |
| `invoice` | 4 of 5 | **3** |
| `payment_transaction` | 53 (**5 dangling**) | 37 |
| `branch_inventory` | 424 (all 53 branches) | 320 |
| `delivery_zone` | 44 | 22 |
| `expense` | 1 | 0 |
All other branch-bearing tables (teller, cost_centre, branch_staff, vehicles, …) are empty. **Posted accounting history sits on fixture-class branches**, so any delete/normalise would alter dimensional history (violates D7).

### 3.3 Zones (44 rows)
| Geometry class | Count |
|---|---|
| POLYGON + RADIUS (≥3 pts) | 12 |
| RADIUS-only (centre + radius, 4–15 km) | 25 |
| PIN-only (no geometry) | 7 — exactly the 7 orphans |
| POLYGON-only / manual override | 0 / 0 |
Orphans: **7 zones → `res_01KXYMAHGF…` (see X14)**. By owner branch class: 22 zones on 18 fixture-class branches, 15 on 9 others, 7 orphan. Duplicate PINs across branches: 7 PINs (e.g. `560001` ×5). No centre outside India. Polygon *validity* (closure, self-intersection, winding) is **not yet verified**; "≥3 points" is not validity.

### 3.4 Test dependencies
- ≥20 scripts hard-code `res_01KXYMAHGFPRY1G9TZKEVGAGAT` (e.g. `test-branch-manager.ts`, `test-master-fulfillment-ordering.ts`, `concurrency_checkout.js`).
- ~15 depend on coordinates 12.9716 / 77.6412 or 77.5946 (map-fencing / delivery-radius suites).
- **`scratch/verify_all_modules_postgres.js` creates a new "Postgres Pipeline Branch <ts>" row on every run** — pollution will recur unless that generator gets teardown.
→ Any correction can break these and re-pollute; they must be run before/after.

### 3.5 Proposed correction plan (**proposal — separately reviewed and approved; nothing executed**)
1. **Do not delete or normalise in C7.9.** C7.9 reads no branch/zone data.
2. **Make routing allow-list based (C7.10/C7.11):** a branch/partner participates in corporate routing only if explicitly flagged eligible (new additive flag/table). Fixtures become irrelevant to routing **without touching them**.
3. Owner-reviewed classification sheet (57 rows): id, name, code, class (REAL/SEED/TEST), reference counts from §3.2, decision.
4. Coordinate/duplicate defects (§3.1) corrected one record at a time, with before/after captured in an audit row; never in bulk.
5. `res_…` handled by an **alias mapping** to `br_indiranagar` (no rewrite of tests or history); add `delivery_zone.branch_id` FK only after orphans/alias are resolved (**amends report C7.10 line "FK after orphan check"**).
6. Optional later step: soft-delete (`deleted_at`) only branches that are verified TEST **and** have zero references in §3.2, in one transaction with a restore script and pre-image export. Branches with accounting or payment references are never touched.
7. Fix the test generator teardown; re-run affected suites before/after each step.

---

## 4. C7.9 final schema (additive only; alters **no** existing table)

Conventions: `TEXT` ids `<prefix>_<gen_random_uuid()::text>`; `TIMESTAMPTZ`; `metadata JSONB NOT NULL DEFAULT '{}'`; `IF NOT EXISTS`; one transaction; FKs `ON DELETE RESTRICT` unless noted; `pgcrypto` already installed.

| Table (prefix) | Purpose / key constraints |
|---|---|
| `corporate_account` (`ca_`) | `customer_id TEXT NOT NULL UNIQUE → customer(id) RESTRICT` (**full unique, not partial**: closing never frees the link). `legal_name`, `trade_name`, `legal_name_key` (normalised). `gstin varchar(15)` CHECK GSTIN regex; `pan varchar(10)` CHECK PAN regex; CHECK PAN = GSTIN chars 3–12 when both present. **Partial UNIQUE (`gstin`) WHERE gstin IS NOT NULL AND deleted_at IS NULL**. `billing_address`, `registered_address` jsonb. `status` CHECK (`PENDING`,`APPROVED`,`SUSPENDED`,`CLOSED`) default `PENDING`. `approved_by/at`, `suspended_by/at/reason`, `closed_by/at/reason`. **Credit request only**: `credit_requested_limit`, `credit_requested_terms_days`, `credit_requested_by/at` (CHECK ≥0). **No credit_limit/terms/enabled columns** (§6.3). `created_by/updated_by`, timestamps, `deleted_at`. |
| `corporate_account_contact` (`cac_`) | `contact_type` CHECK (`PRIMARY`,`SECONDARY`,`ACCOUNTS_PAYABLE`,`BILLING`); name/email/phone; partial UNIQUE one active `PRIMARY` per account. |
| `corporate_account_member` (`cam_`) | Corporate staff ↔ account: `user_id → "user"(id)`, `member_role` CHECK (`ROSTER_MANAGER`,`ROSTER_VIEWER`), `status` CHECK (`ACTIVE`,`REVOKED`), `granted_by/at`, `revoked_by/at`; partial UNIQUE (`account_id`,`user_id`) WHERE ACTIVE. |
| `corporate_employee` (`ce_`) | `account_id RESTRICT`; `employee_code varchar(100)`; `employee_code_key` (upper/trim/collapse-space) with **UNIQUE (`account_id`,`employee_code_key`) over ALL rows incl. INACTIVE** → re-joiners are *reactivated*, never duplicated. `full_name`, `phone`, `email`, `department`, `designation`, `default_address jsonb` (preserves original text), `city_key` (normalised for search only). Optional `default_latitude/longitude` with CHECK both-or-neither and India plausibility (lat 6–38, lng 68–98), `coordinate_source` CHECK (`USER_SUPPLIED`,`GEOCODED`,`ADMIN_VERIFIED`), `coordinate_verified boolean default false`, `coordinate_verified_by/at` — **unverified is never authoritative**. `status` CHECK (`ACTIVE`,`INACTIVE`); `deactivated_*`, `reactivated_*`; `version int` (optimistic lock). **No `deleted_at`; DELETE blocked by trigger.** |
| `corporate_employee_event` (`cee_`) | **Append-only** (trigger blocks UPDATE/DELETE). `event_type` CHECK (`CREATED`,`UPDATED`,`DEACTIVATED`,`REACTIVATED`,`IMPORTED`,`COORDINATES_VERIFIED`), actor id/role, reason, before/after jsonb. |
| `corporate_account_event` (`cax_`) | **Append-only.** `CREATED`,`UPDATED`,`SUBMITTED`,`APPROVED`,`SUSPENDED`,`REACTIVATED`,`CLOSED`,`CUSTOMER_LINKED`,`CREDIT_REQUESTED`,`CREDIT_ACTIVATED`,`MEMBER_GRANTED`,`MEMBER_REVOKED`. |
| `corporate_employee_import_batch` (`cei_`) | `account_id`, `file_hash`, filename, `status` (`DRY_RUN_OK`,`DRY_RUN_FAILED`,`COMMITTED`,`FAILED`), counters, row errors jsonb, `created_by`, `committed_by`; UNIQUE (`account_id`,`file_hash`) WHERE `COMMITTED`. |

**Explicitly NOT in C7.9:** any ALTER of `customer`, `company`, `corporate_gifting_*`, `invoice`, `accounting_*`, `branch`, `delivery*`; `employee_ref_id` (→ C7.13); coverage, routing, geocode, assignment, review tables (→ C7.10–C7.12).

### 4.1 Verified migration dependencies
- Hard FK targets exist: `customer(id)`, `"user"(id)`; `gen_random_uuid()` available (`pgcrypto`).
- Pre-flight must assert: none of the 7 new tables exist (or exist empty); `customer` present; **record** (not hard-code) CoA, trial balance, voucher/JE/JL counts and require pre = post. (Runner 7A hard-codes CoA = 100 — acceptable today, brittle later.)
- Runner convention: `frontend/migrate_phase_c7_9_corporate_account_roster_schema.js` (transaction, idempotent, rollback on error, post-verify) **plus** mirrored `backend/src/migrations/2026MMDD_phase_c7_9_….sql`; a test asserts both define identical objects.
- Reverse script exists, **refuses to run if any table has rows**.
- No trigger visibility on `customer`/`invoice`/`company` under the inspector role; existing immutability triggers are on accounting tables and are covered by `frontend/scratch/test_immutability_triggers.js` (must stay green).

---

## 5. Locked policies

### 5.1 Approval matrix
| Action | Who | Rule |
|---|---|---|
| Draft/submit corporate account (`PENDING`) | Staff with `CORPORATE_ACCOUNTS.CREATE` | Creates/links the single canonical `customer` (§6.2) |
| **Approve account** (`APPROVED`), suspend/reactivate/close | **SUPER_ADMIN only** | Not grantable via role presets; approver ≠ creator |
| Request credit (limit/terms) | Staff with `CORPORATE_ACCOUNTS.CREDIT_REQUEST` | Records request only |
| **Activate credit** | **SUPER_ADMIN only**, account must be `APPROVED` | Delegates to the existing four-eyes `approveCorporateCredit` (§6) |
| Grant/revoke corporate membership | **SUPER_ADMIN only** | Audited |
| Manage roster (add/update/deactivate/reactivate/import) | Staff with `CORPORATE_EMPLOYEES.MANAGE/IMPORT` **or** active `ROSTER_MANAGER` member of **that** account | Roster endpoints can never read or write credit/approval fields |
| View roster | `CORPORATE_EMPLOYEES.VIEW` or any active member of that account | PII masked for non-privileged views |

### 5.2 Routing precedence (implemented C7.11; locked now)
1. Explicitly **eligible** store whose verified geofence covers the verified destination **and** can fulfil → assign to store.
2. Else eligible partner covering the destination → assign to partner.
3. Overlap/ties, unclear eligibility, missing priority → `PENDING_REVIEW` (never guess).
4. Uses only geometry primitives (`isPointInPolygon`, `isPointInZone`, `calculateHaversineDistance`); **never** `resolveSmartBranch` PATH B / `resolveDeliveryContext` fallbacks (`operational[0]`, "indiranagar", `branches[0]`, `distance_km: 3.5`, `zone_core`). Store-vs-partner order is an **explicit configurable policy; no default** (unset ⇒ review).
5. Radius-only zones count as "map-fenced" only if explicitly marked verified (25 of 44 are radius-only today).

### 5.3 Coordinates and cities
- User-supplied coordinates: validate India bbox, both-or-neither, record source; **unverified ⇒ not authoritative**.
- Unresolvable/low-confidence ⇒ require correction or Super Admin review; PIN is metadata only.
- City: normalise case/whitespace into `city_key` for search/display; original text always retained; **city never routes**.
- Geocoding provider deferred; PostGIS deferred until measured need.
- Finance: single master invoice per campaign (D6); reassignment writes history only and never touches `invoice`/`accounting_*` (D7).

---

## 6. Customer and credit integration (C7.9)

1. **Reuse, don't duplicate:** credit activation = `CorporateAccountService.activateCredit` → *same transaction* → `BillsReceivableService.approveCorporateCredit({ client })` (it already accepts a caller client, advisory lock and four-eyes).
2. **Canonical customer:** account creation either creates one customer (via the existing `CustomerRepository` path — verify NOT-NULL columns/`has_account` semantics in step 9a) or links an existing customer **only by Super Admin** with a `CUSTOMER_LINKED` event; fails if the customer is already linked or the GSTIN already belongs to an active account.
3. **Single source of truth:** legal name/GSTIN authoritative on `corporate_account`; `customer.company_name/gstin` mirrored in the same transaction. Credit limit/terms/status authoritative **only** on `customer` (account stores the *request* only).
4. C7.9 **does not set `is_corporate`** (only existing credit activation does) — avoids unaudited consumers of that flag.
5. **Bypass closure (needs Q1):** add a guard in `approveCorporateCredit` (and the legacy route): if a `corporate_account` exists for the customer, require `status='APPROVED'` and Super Admin. Customers with no account keep today's behaviour.

---

## 7. Permissions (static registry; `user_rbac_role` is empty)

| Module.Action | Grant |
|---|---|
| `CORPORATE_ACCOUNTS.VIEW / CREATE / UPDATE / CREDIT_REQUEST` | presets/roles |
| `CORPORATE_ACCOUNTS.APPROVE / SUSPEND / CREDIT_ACTIVATE / MEMBERS` | **SUPER_ADMIN only, enforced in service (not just registry)** |
| `CORPORATE_EMPLOYEES.VIEW / MANAGE / IMPORT` | presets/roles; membership grants account-scoped equivalents |
Register in `staff-access-control.ts` (registry near L253, legacy map near L855), category "Corporate & Institutional". Master-plan names `CORPORATE_COMPANY.*`, `CORPORATE_EMPLOYEE.*`, `CORPORATE_CREDIT.MANAGE` are retired (X6).

---

## 8. Sequence (sequential; each step independently audited)

0. G1–G5 pass. **9a** migration + schema suite + independent PG audit. **9b** repositories/services (account, contact, member, employee, events) + domain suite. **9c** bulk import: template, dry-run, commit, duplicate detection (never silently updates/reactivates; existing code ⇒ row error). **9d** controllers + RBAC + route wiring + API/RBAC matrix suite. **9e** UI panels (account list/detail, roster, import, approvals). **9f** browser E2E + independent PG audit + frozen-suite regression + `tsc`.
Then C7.10 only after G2. Concurrency: advisory lock `corp_acct_<id>` on roster mutations/import commit; unique indexes as backstop.

---

## 9. Required document amendments (docs only; to apply on acceptance)
- Master plan: banner → this lock; §1.4 permission names (X6); §2.2 statuses note; §6 note "C7.9 → C7.10 sequential" (X8); §11 paths → `frontend/scratch/` (X5).
- C7.8 report: errata banner; fix R1, R9, R4, O4, O5, O6, ID convention, `employee_ref_id` placement, `res_` finding.
- `LATEST_CHECKPOINT.md`: C7.8 = *discovery complete, lock pending*.

---

## 10. Locked Decisions (Owner Accepted — 2026-10-12)

| # | Decision | Owner Resolution & Locked Policy |
|---|---|---|
| **Q1** | Tighten frozen C7.4 credit path (service guard + route) so only Super Admin on an `APPROVED` account can activate credit for account-linked customers? | **LOCKED: YES**. Tighten `BillsReceivableService.approveCorporateCredit` and route `POST admin/corporate-customers/:id/credit-approval`. If a customer is linked to a `corporate_account`, require `corporate_account.status = 'APPROVED'` and caller has `SUPER_ADMIN`. Retail customers without an account retain legacy path. Re-run C7.4 AR test suites to verify zero regression. Closes the `CUSTOMER.EDIT` policy bypass. |
| **Q2** | Four-eyes with a single Super Admin: existing rule blocks approver = customer creator. | **LOCKED: MAINTAIN STRICT FOUR-EYES**. Retain four-eyes SoD (`customer.created_by ≠ approver`). Account/customer is drafted by operations staff (`CORPORATE_ACCOUNTS.CREATE`), Super Admin approves. No bypass permitted. |
| **Q3** | Commit strategy for G1 baseline. | **LOCKED: BASELINE PRESERVED**. Preserved on branch `checkpoint/c-phases-baseline` at commit `d231cee7e55f716526e62f5799cc7377c555fed3` with clean index and frozen CoA = 100. |
| **Q4** | Confirm `corporate_account_member` model for "authorized corporate staff" (Super Admin grants). | **LOCKED: YES**. Implement `corporate_account_member` (`cam_`) table with roles `ROSTER_MANAGER` and `ROSTER_VIEWER`. Access gated to own corporate account; granted/revoked by Super Admin. |
| **Q5** | Allow linking an *existing* retail customer (56 live, 0 corporate) to an account? | **LOCKED: YES (SUPER_ADMIN ONLY)**. Linking existing customer is permitted only via Super Admin action, strictly audited with `CUSTOMER_LINKED` event; fails if customer or GSTIN is already linked. |

### Confirmed Core Business Decisions (BD-1 – BD-5):
- **BD-1**: Credit Activation Security: Super Admin only on `status = 'APPROVED'` corporate account.
- **BD-2**: Retail-to-Corporate Customer Linking: Super Admin only, audited event, 1:1 invariant.
- **BD-3**: Four-Eyes Enforcement: Mandatory segregation between creator and approver across accounts and credit.
- **BD-4**: Employee Phone Reuse: Permitted with audit warning (families/shared corporate devices) across distinct employee codes within same account.
- **BD-5**: Re-Joining Employee Lifecycle: Explicit reactivation required; duplicate codes blocked; bulk import never silently overwrites or reactivates existing codes.

---

## 11. C7.9 acceptance checklist

**A. Entry** — [ ] G1 backup + sanitised + reviewed commits on new branch · [x] G3 decisions Q1–Q5 recorded (Accepted 2026-10-12) · [ ] G4 frozen suites + `tsc` green and counts recorded · [ ] G5 docs reconciled.

**B. Migration (9a)** — [x] 7 tables exist, 0 rows · [x] every CHECK/UNIQUE/FK in §4 present (schema suite 37/37) · [x] `corporate_account.customer_id` UNIQUE (full) · [x] GSTIN unique among live accounts · [x] employee unique over all statuses · [x] event tables reject UPDATE/DELETE · [x] employee DELETE rejected · [x] re-run is a no-op (idempotent) · [x] SQL and JS runner define identical objects · [x] reverse script refuses non-empty tables · [x] **no existing table altered** (column-set diff of `customer`, `corporate_gifting_*`, `invoice`, `branch`, `delivery_*` = empty) · [x] CoA (100)/TB (balanced ₹3,380)/voucher (6)/JE (4)/JL (10) counts unchanged.

**C. Domain (9b/9c)** — [ ] second account for same customer/GSTIN rejected (DB + domain) · [ ] status transitions legal only (`PENDING→APPROVED→SUSPENDED↔APPROVED→CLOSED`) · [ ] approver ≠ creator · [ ] deactivate keeps row, events, history; reactivate restores same id · [ ] duplicate code (case/space variants) rejected · [ ] import dry-run persists nothing; commit atomic; duplicate file hash rejected · [ ] import never overwrites/reactivates · [ ] coordinates: bbox, both-or-neither, unverified flag default false · [ ] city normalised for search only, original preserved · [ ] concurrent create/import of same code → exactly one wins.

**D. API / RBAC (9d)** — [ ] unauthenticated 401 · [ ] role × action matrix per §5.1 · [ ] corporate member limited to own account (cross-account 403) · [ ] roster endpoints cannot change credit/approval fields (mass-assignment test) · [ ] `APPROVE/CREDIT_ACTIVATE/MEMBERS` denied to non-Super-Admin even with registry grant · [ ] credit activation reuses `approveCorporateCredit`; legacy route guard per Q1 · [ ] PII masked for non-privileged view.

**E. UI (9e)** — [ ] panels registered with permission gating · [ ] account approval and credit activation visible only to Super Admin · [ ] roster add/edit/deactivate/reactivate/import with row-level errors · [ ] no secrets/PII in console or screenshots.

**F. Independent audit (9f)** — [ ] separate PG script verifies counts, FK integrity, event completeness, zero leaked advisory locks, zero residual test rows · [ ] posted accounting unchanged · [ ] `customer` credit fields changed **only** through `approveCorporateCredit`.

**G. Regression** — [ ] C7.7 7A 56/56, 7B 13/13, 7C 13/13 + audit 19/19, 7D 68/68 + audit 19/19 · [ ] C7.6 4D 102/102 · [ ] `test_immutability_triggers.js` green · [ ] `tsc --noEmit` = 0 · [ ] affected branch/zone suites (§3.4) unchanged.

---
**Read-only compliance:** only `SELECT`/catalog queries inside `BEGIN READ ONLY … ROLLBACK`; no source, schema, data or permission changes; no git write operations. New files: three scratch inspectors + JSON outputs and this document.
