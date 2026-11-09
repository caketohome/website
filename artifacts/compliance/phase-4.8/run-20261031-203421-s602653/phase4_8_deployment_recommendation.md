# Phase 4.8 Deployment Recommendation

## 1. Recommendation
Maintain **HOLD / FAIL-CLOSED** status on production invoicing deployment until authenticated Board resolutions are received.

## 2. Immediate Post-Authorization Deployment Steps
Once the corporate resolution is authenticated:
1. Apply migrations `c7_12`, `c7_13`, and `c7_14` to the production database during a scheduled maintenance window.
2. Insert the chosen production invoice series (e.g., prefix `CTHI` or `C2H`) in `PROPOSED` state.
3. Execute authenticated approval transition via designated Director and CA credentials.
4. Verify end-to-end statutory invoice generation on first live production transaction.
