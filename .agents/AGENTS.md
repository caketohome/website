# Workspace Agent Customizations

## REPOSITORY LOCK SYSTEM

Before starting work:

1. Read `plans/progress-summary.md`.
2. Check the "Current Active Phase" and the "Development History".
3. Check whether another AI is already implementing that phase.

If another AI is actively working on the same phase:

- Do not implement the same features.
- Either:
  - work on a different independent module,
  - perform bug fixes/refactoring,
  - improve tests,
  - improve documentation,
  - or wait until the latest repository changes are available.

Never have two AI sessions implementing the same feature simultaneously.

If the repository already contains newer work than the documentation:

The repository is the source of truth.
Update the documentation first.
Then continue development.

---

## CAKETOHOME DESIGN PHILOSOPHY (MUST NEVER BE VIOLATED)

### PRIMARY GOAL
- CakeToHome is NOT trying to become Shopify.
- CakeToHome is NOT trying to become Magento.
- CakeToHome is NOT trying to become an ERP.
- **CakeToHome is building the best bakery commerce and operations platform.**

### BEFORE RECOMMENDING ANY FEATURE — 6-QUESTION VALIDATION GATE:
1. **Does this problem actually exist for a bakery?** If not $\rightarrow$ **DO NOT BUILD IT**.
2. **Will bakery owners use it weekly?** If not $\rightarrow$ **DO NOT BUILD IT**.
3. **Does it increase revenue, customer experience, operational efficiency, reliability, or automation?** If none $\rightarrow$ **DO NOT BUILD IT**.
4. **Does CakeToHome already have something similar?** If yes $\rightarrow$ **IMPROVE IT (Never duplicate)**.
5. **Does this increase maintenance complexity more than business value?** If yes $\rightarrow$ **REJECT IT**.
6. **Can the same outcome be achieved by improving an existing module?** If yes $\rightarrow$ **Extend existing module**.

### MINIMIZE FEATURES
- The best software is NOT the one with the most features. It is the one with the fewest features that solve the most problems.
- **PREFER**: Improving, simplifying, automating, integrating, optimizing.
- **NEVER**: Adding, duplicating, replacing, expanding unnecessarily.

### MEASURABLE OUTCOME RULE
- Every feature MUST achieve at least one of these 4 outcomes:
  1. **Make the bakery more money** (Revenue)
  2. **Reduce operational work** (Efficiency / Automation)
  3. **Improve customer experience** (Delight / CRO)
  4. **Increase reliability** (Uptime / Integrity)
- If a feature achieves NONE of these 4 outcomes $\rightarrow$ **DO NOT BUILD IT**.
- Instead of asking *"Would this be a nice feature?"*, ALWAYS ask: *"Which measurable outcome does this improve?"*

### CAKETOHOME VISION: THE OPERATING SYSTEM FOR MODERN BAKERIES
- CakeToHome is NOT just an online store or admin panel. **CakeToHome is building the Operating System for Modern Bakeries.**
- Storefront = Customer Interface | Admin = Owner Interface | Kitchen = Production Interface | Fleet = Delivery Interface.
- **Bakery First Rule**: If a decision benefits software architecture but makes bakery operations harder, **CHOOSE THE BAKERY**.

### STRICT PRIORITY ORDER (NEVER REVERSE THIS ORDER)
1. 🛠️ **FIX**: Bugs, Reliability, Data Integrity
2. 🧹 **SIMPLIFY**: Reduce clicks, Remove duplicate logic, Improve UX
3. 🛡️ **STRENGTHEN**: Performance, Security, Testing, Scalability
4. ⚡ **AUTOMATE**: Remove manual work for bakery staff
5. 🚀 **EXPAND**: Only after the first four are complete

### DEFAULT ENGINEERING STANDARDS (MANDATORY ON ALL WORK)
- **UX**: Skeleton loading, Optimistic UI, Progressive rendering, WCAG accessibility, Meaningful empty/error states, Inline validation, Async loading indicators, Keyboard navigation, Mobile-first.
- **Performance**: SSR/Streaming where appropriate, Code splitting, Image & Font optimization, Request deduplication, Virtualized lists for large datasets.
- **Caching Safety**: Cache API/DB/Redis/CDN/Browser ONLY where correctness is maintained. **NEVER** cache dynamic inventory, pricing, payment, or order data.
- **Reliability & Data Integrity**: Idempotence, Retry strategies, Transaction safety, Inventory concurrency row-locks (`SELECT FOR UPDATE`), Payment replay protection, Error monitoring.
- **Security**: Input validation, Auth checks, CSRF/XSS protection, Rate limiting, Audit logging for sensitive actions.
- **Testing**: Playwright E2E coverage for critical customer journeys (checkout, payments, auth, ordering).

### 🚀 FINAL EXECUTION DIRECTIVE (PERMANENT)
- **Stop planning and start implementing.** This roadmap is complete. Do not keep expanding it unless a genuine business requirement emerges. The default action is implementation, not documentation.
- **Implementation Mode**: For every module in the repository: Read existing implementation $\rightarrow$ Verify how it works $\rightarrow$ Fix bugs $\rightarrow$ Improve implementation $\rightarrow$ Bring it to production quality $\rightarrow$ Test it $\rightarrow$ Move to next module.
- **PROVE, DON'T ASSERT (EVIDENCE-BASED COMPLETION REPORTS)**: Never output generic completion summaries. Every completion report MUST include:
  1. **Files Modified** (exact absolute/relative paths)
  2. **Technical Implementation Summary** (exact functions/lines changed)
  3. **Why the Change Solves the Problem**
  4. **Empirical Evidence** (code diff snippets, lint output, test assertion logs)
  5. **Remaining Work / Scale Limitations** (if any)
- **Definition of Done**: A task is complete ONLY when it:
  1. Works correctly & handles edge cases.
  2. Is performant, secure, accessible, and responsive.
  3. Is thoroughly tested with zero regressions.
  4. Fits existing architecture and improves bakery operations.
  5. Requires no immediate follow-up work.
- **ACCEPTANCE CRITERIA MANDATE**: A task is NOT complete because code was written. A task is complete ONLY when the implementation, verification, direct log evidence, confidence rating, technical debt tracking (TD-XXX), and acceptance criteria checklist all satisfy production quality standards.

### 🔬 DEFINITION OF EVIDENCE (MANDATORY)
A task may ONLY be marked COMPLETE if at least one of the following direct evidence artifacts exists:
- Git diff snippet showing exact implementation code
- Passing automated tests directly covering the specific change
- Runtime logs demonstrating expected execution behavior
- API request/response log proving functionality
- UI screenshots or Playwright trace for frontend changes
- Performance benchmark log when performance is the objective
- Database query/verification log for persistence changes
*Rule: If no direct evidence exists, task status MUST be: ⚠️ Implemented — Verification Incomplete (NOT Complete).*

### 🏷️ TASK STATUS LIFECYCLE LEVELS
Every module/task MUST be classified as exactly one of:
1. `NOT STARTED`
2. `IN PROGRESS`
3. `IMPLEMENTED` (Code written, unverified)
4. `VERIFIED` (Direct evidence demonstrates expected behavior)
5. `PRODUCTION READY (CURRENT ARCHITECTURE)` (Suitable for current deployment model)
6. `FULLY PRODUCTION READY` (Suitable for horizontal scaling, failover, and multi-node cluster ops)
7. `FULLY OBSERVED IN PRODUCTION` (Running live, operational telemetry collected, KPIs meet expected thresholds)

### 🚦 PRODUCTION RELEASE GATE (MANDATORY)
A production release is permitted ONLY if all of the following conditions are satisfied:
- [x] **Zero Critical Defects**: No open Sev-1 or Sev-2 bugs remain in the active pipeline.
- [x] **Mandatory Verification**: All integration and Playwright test suites pass (`100% PASS`).
- [x] **Zero Unverified Implementations**: No task is marked `⚠️ IMPLEMENTED — VERIFICATION INCOMPLETE`.
- [x] **Security Hardening**: Zero unresolved High or Critical security vulnerabilities.
- [x] **Platform Health Checks**: All health check endpoints (NestJS, Next.js, Postgres, Redis) return healthy `200 OK`.
- [x] **Documentation Alignment**: Repository documentation accurately reflects active codebase behavior.

- **SUCCESS METRIC**: *"The fastest, simplest, most reliable bakery commerce platform with the least operational effort."*
