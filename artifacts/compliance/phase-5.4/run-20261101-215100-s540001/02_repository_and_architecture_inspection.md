# Phase 5.4 — Repository and Architecture Inspection
**Git HEAD:** `d231cee7e55f716526e62f5799cc7377c555fed3`  
**Branch:** `checkpoint/c-phases-baseline`  
**Working Tree:** Clean (verified 0 untracked files in git baseline).  

### Architecture Inspection Findings:
1. **Frontend Architecture:** SvelteKit + Vite application in `frontend/` with dedicated compliance, order, and administration modules.
2. **Backend Services:** Node.js / Express services interfacing with PostgreSQL database.
3. **Sequence Allocation Mechanism:** Sequence allocation enforces gapless numbering via transactional sequence tables protected by PostgreSQL row-level locks (`SELECT ... FOR UPDATE NOWAIT`). Native sequences cache increments across transaction aborts and are strictly prohibited from driving tax invoice serials.
4. **Safety Boundaries:** Production invoicing toggles remain disabled by environment variables and database flags.