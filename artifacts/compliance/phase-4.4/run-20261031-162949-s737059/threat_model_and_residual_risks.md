# Threat Model and Residual Risks Analysis

## 1. Threat Model Evaluation
- **Threat 1: SQL Injection / Direct DML Promotion**: Neutralized by engine-level triggers (`c7_14`) and check constraints.
- **Threat 2: Audit Trail Erasure**: Neutralized by row-level and statement-level triggers blocking UPDATE, DELETE, and TRUNCATE.
- **Threat 3: Session Spoofing / Anonymous Role Injection**: Neutralized by strict userId validation in `route.ts`.
- **Threat 4: CI Migration Bypass**: Neutralized by lexical comment-stripping linter.

## 2. Residual Risks
- **External Statutory Policy Risk**: Production invoicing cannot generate legal invoices until the Board of Directors formally passes a resolution designating the official prefix.