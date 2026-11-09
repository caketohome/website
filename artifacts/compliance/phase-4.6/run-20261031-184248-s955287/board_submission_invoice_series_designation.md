# CAKETOHOME INDIA PRIVATE LIMITED
## BOARD SUBMISSION
### Designation of Production Tax Invoice Series, Delegation of Approval Authority and Controlled Invoicing Activation

**To:** Board of Directors, CakeToHome India Private Limited  
**For review by:** Company Secretary, Chartered Accountant and Statutory Auditor, as appropriate  
**From:** Management / Project Owner  
**Meeting date:** [To be determined]  
**Agenda reference:** [To be assigned]  
**Document status:** Proposed for Board consideration

---

# 1. Purpose of Submission

This paper seeks formal corporate decisions concerning the production tax invoice numbering policy, authorization responsibilities and controlled activation of CakeToHome's statutory invoicing system.

The CakeToHome technical team reports completion of Phases 4.1 through 4.6, covering:

- Database-driven legal entity and GST registration configuration.
- Branch-level seller identification.
- Statutory invoice-series validation.
- Financial-year-based numbering.
- Transactional invoice allocation and idempotency.
- Database-level approval governance.
- Immutable approval audit records.
- API authorization and segregation-of-duties controls.
- Migration and deployment safeguards.
- Invoice, order and accounting reconciliation.
- Production deployment and first-invoice runbooks.

The Phase 4.6 report records 94 automated tests across six suites, with all reported tests passing, and confirms that production invoice generation remains fail-closed.

These are engineering-reported results and should be considered alongside the supporting audit evidence.

**The immediate objective is to obtain the company's decisions and authorization. This submission does not itself approve a production invoice series or authorize deployment.**

# 2. Current Production Status

| Item | Current reported position |
|---|---|
| Legal entity | CakeToHome India Private Limited |
| GST registration | `29AABCC1234F1Z5` — subject to final corporate verification |
| Production invoice prefix | Not designated |
| Production invoice series | Not approved |
| Authorized approver | Formal delegation pending |
| Application approval controls | Reported implemented and tested |
| Invoice generation | Fail-closed |
| Technical release baseline | `d231cee7e55f716526e62f5799cc7377c555fed3` |
| Migration chain | `c7_12 → c7_13 → c7_14` |
| Final production deployment | Not authorized |

No production invoice series should be activated until the required corporate decisions, professional review and separate deployment authorization have been completed.

# 3. Decisions Requested from the Board

The following 11 decisions are presented for formal consideration.

## Decision Register

| No. | Decision required | Proposed decision / record |
|---:|---|---|
| 1 | Official production invoice prefix | Prefix: __________________ |
| 2 | Invoice sequence padding width | Number of digits: __________________ |
| 3 | Delegated approval authority | Person and designation: __________________ |
| 4 | Approver identity verification | Approved verification requirements: __________________ |
| 5 | Segregation of duties | Proposal, approval and deployment separation: __________________ |
| 6 | Historical test-series treatment | Archive / decommission / other approved treatment: __________________ |
| 7 | Production cut-over date and time | Date, time and timezone: __________________ |
| 8 | Sequence-capacity monitoring | Warning threshold and escalation: __________________ |
| 9 | Treatment of 69 reported unbilled historical orders | Approved investigation and billing procedure: __________________ |
| 10 | Monthly GST return reconciliation | Responsible person and reconciliation procedure: __________________ |
| 11 | Annual financial-year rollover | Responsible person and annual verification procedure: __________________ |

### Supporting considerations

**1. Invoice prefix**

The technical reports discuss `CTH`, `CTHI`, and other possible formats. These are examples only. The company must select and formally record its chosen identifier after appropriate finance and professional review.

**2. Sequence width**

The configured prefix, financial-year representation, separators and sequence digits must produce a final invoice serial number within the applicable statutory requirements.

**3. Delegated authority**

The Board should identify the person who is permitted to approve the production series within the application and the scope of that delegation.

**4. Identity verification**

The company should establish how the approving individual's identity and authority will be verified. Possible evidence includes a corporate email identity, designation, employee or director reference and documented delegation.

**5. Segregation of duties**

The company should decide whether series proposal, statutory approval and software deployment must be performed by different individuals.

**6. Historical test series**

Historical and synthetic test series must remain distinguishable from production configuration. Their disposition must preserve necessary audit history.

**7. Cut-over**

The activation date must account for the applicable financial year, existing transactions and approved operational procedures.

**8. Sequence monitoring**

The company should establish an alerting threshold before the configured sequence approaches capacity. The previously proposed 80% threshold is a suggestion for consideration, not an approved setting.

**9. Historical unbilled orders**

The reported 69 unbilled orders require individual classification. No invoice should be automatically generated merely because an order appears in an unbilled report.

**10. GST reconciliation**

Assign responsibility for reconciling invoice records with the applicable GST reporting process, including GSTR-1 where relevant.

**11. Annual verification**

Establish a recurring financial-year rollover review covering numbering format, sequence eligibility, authorization and historical continuity.

# 4. Corporate and Professional Review

The Board is requested to obtain appropriate advice from the Company's Company Secretary, Chartered Accountant or legal adviser regarding:

1. Whether formal Board approval is required under the company's Articles, internal delegation framework or governance policy.
2. Whether the proposed approver has sufficient delegated authority.
3. Whether a separate authorization instrument is required.
4. The applicable invoice numbering and document requirements.
5. The treatment of existing invoices and historical unbilled transactions.
6. The applicable GST reporting and reconciliation procedures.

Section 31 of the CGST Act and Rule 46 of the CGST Rules address tax-invoice requirements. Section 134 of the Companies Act addresses matters including financial statements, the Board's report and internal financial controls.

This submission does not assert that Section 134 specifically mandates a Board Resolution for selecting an invoice prefix. The company's actual governance requirements should be confirmed professionally.

# 5. Proposed Corporate Resolution — For Review

The following is a proposed drafting framework. It must be reviewed and completed by the Company's Company Secretary or legal adviser before adoption.

**Proposed resolution:**

"RESOLVED THAT the Board, having considered the Company's tax invoicing requirements and the recommendations of the Finance and Technology teams, approves the following invoice-numbering policy for the Company's approved GST registration(s), subject to applicable law and the Company's internal authorization framework:

1. The designated invoice-series prefix shall be: **[APPROVED PREFIX]**.
2. The applicable document type shall be: **[DOCUMENT TYPE]**.
3. The applicable GST registration shall be: **[GST REGISTRATION DETAILS]**.
4. The applicable branch or operating scope shall be: **[APPROVED SCOPE]**.
5. The numbering and sequence-width policy shall be: **[APPROVED FORMAT]**.
6. The effective date and time shall be: **[CUT-OVER DATE AND TIME WITH TIMEZONE]**.
7. The individual authorized to approve the invoice-series configuration in the CakeToHome Compliance System shall be: **[NAME AND DESIGNATION]**.
8. The scope and limitations of that authority shall be: **[DELEGATION DETAILS]**.
9. The Finance function shall maintain appropriate invoice-sequence monitoring, statutory reconciliation and exception reporting.
10. Any material change to the approved numbering policy shall follow the Company's authorized governance and approval procedure.

RESOLVED FURTHER THAT production activation shall occur only after the required statutory, technical, financial and deployment checks have been completed and separately authorized."

**Important:** This is a draft for professional review. Do not insert an assumed prefix, approver, resolution number or adoption date.

# 6. First Production Invoice — Controlled Execution Plan

Production activation must occur as a separate controlled exercise after the required decisions have been recorded.

## Stage 1 — Corporate authorization

Confirm that the company's decisions are documented and that the designated officer's authority is verifiable.

Evidence required:

- Adopted resolution or other applicable authorization.
- Delegation reference.
- Authorized individual's identity.
- Approved invoice-series configuration.
- Professional review where required.

## Stage 2 — Finance configuration review

The authorized Finance Controller or delegated officer reviews:

- Correct company.
- Correct GST registration.
- Correct branch seller context.
- Approved prefix.
- Document type.
- Financial year.
- Sequence width.
- Existing sequence history.
- Uniqueness and character-length constraints.

## Stage 3 — Technical deployment approval

The technical deployment owner verifies:

- Frozen Git release commit.
- Migration checksums.
- Migration sequence.
- Database target identity.
- Database backup and recovery prerequisites.
- Migration-linter result.
- Trigger and approval-governance status.
- API authorization.
- Application and worker compatibility.
- Monitoring and incident-response readiness.

## Stage 4 — Separate production authorization

Obtain explicit approval from the designated deployment authority to perform the production migration and activation.

Corporate authorization to approve an invoice series must not automatically authorize a software deployment.

Likewise, deployment access must not automatically confer statutory approval authority.

## Stage 5 — Genuine first production transaction

Only after the preceding gates pass should the responsible business owner select a legitimate business transaction for the first production invoice.

Verify:

1. Source order or billing transaction.
2. Legal seller identity.
3. GST registration.
4. Customer details.
5. Approved invoice series.
6. Invoice date and financial year.
7. Final generated serial number.
8. Tax calculation.
9. Invoice persistence.
10. Invoice PDF.
11. Customer retrieval.
12. Accounting linkage.
13. Approval audit trail.
14. Idempotency and duplicate protection.

A dummy invoice must not be generated in production.

## Stage 6 — Finance sign-off

The Finance Controller or other authorized individual reviews the complete invoice and associated accounting records.

The first-invoice record must contain the transaction reference, invoice identifier, seller details, tax components, accounting references and relevant audit evidence.

## Stage 7 — Post-activation monitoring

Monitor:

- Invoice allocation failures.
- Duplicate attempts.
- Unauthorized-series errors.
- Sequence-capacity warnings.
- Fiscal-year consistency.
- Failed document generation.
- Failed accounting transactions.
- Invoice-to-order reconciliation.
- GST reporting reconciliation.

Any material mismatch must trigger investigation and the established containment process.

# 7. Historical Financial Records — Separate Approval Required

The Phase 4.6 report identifies 69 unbilled orders.

These orders should not automatically be invoiced when the production series is enabled.

The company should first classify them by actual business status, transaction date, delivery status, prior invoice history and applicable tax treatment.

A separate finance-approved procedure must determine which transactions require action.

Do not create backdated invoices, reuse serial numbers or modify existing invoice records without a professionally reviewed and authorized process.

# 8. Board Decision Record

Complete this section following the actual meeting and decision.

**Meeting reference:** __________________

**Meeting date:** __________________

**Resolution number:** __________________

**Approved prefix:** __________________

**Approved document type:** __________________

**Applicable GST registration:** __________________

**Authorized approver:** __________________

**Delegation reference:** __________________

**Approved effective date:** __________________

**Production activation authorization:** Pending separate approval

**Conditions or limitations:** __________________

**Company Secretary confirmation:** __________________

**Finance / CA review reference:** __________________

**Final decision:** Approved / Approved with conditions / Deferred / Rejected

# 9. Requested Board Action

The Board is requested to:

1. Review the 11-point Corporate Decision Register.
2. Confirm the company's invoice-series numbering policy.
3. Determine the appropriate internal approval and delegation process.
4. Designate the authorized person responsible for invoice-series approval, if appropriate.
5. Assign Finance responsibility for the 69 reported unbilled orders and ongoing GST reconciliation.
6. Authorize preparation of the controlled production deployment only after all relevant conditions are met.
7. Require a separate release and first-invoice sign-off before production invoicing is activated.

---

**Final position**

CakeToHome's Phase 4.6 engineering report records technical and evidence readiness, with corporate authorization still pending.

This submission requests the business decisions needed to move from technical readiness to controlled production activation.

**No production invoice series is approved by this document. No production database change or live invoice generation is authorized by this submission.**

