# Checkpoint 09: Complete Verification & Source-of-Truth Sign-Off

> **Phase**: Phase 9  
> **Status**: PENDING

---

## Scope & Objectives
1. **Draft vs. Published Verification**: Modify draft in CMS -> Storefront remains published -> Publish -> Storefront updates.
2. **Database Mutation without Restart**: Mutate product price in PostgreSQL -> Refresh homepage -> New price immediately visible.
3. **Rollback Verification**: Trigger rollback to previous version in CMS -> Snapshot restored in draft -> Re-publish verified.
4. **Controlled Failure Verification**: Simulate PostgreSQL disconnection -> Controlled error/degraded state returned -> Zero silent fallback to memoryStore.
5. **Responsive & Browser Testing**: Verify desktop, tablet, and mobile with zero console or hydration errors.
