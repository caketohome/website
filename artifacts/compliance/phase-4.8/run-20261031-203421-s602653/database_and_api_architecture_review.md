# Database and API Architecture Review

## 1. Architectural Model
CakeToHome implements a clean 3-tier statutory invoicing architecture:
1. **Relational Database Core:** PostgreSQL schema managing entities, GST registrations, invoice sequences, and immutable audit trails.
2. **Statutory Service Layer:** Server-side transactional functions (`allocate_invoice_number_atomic`) ensuring atomic incrementation and rollback resilience.
3. **API Compliance Gateway:** Next.js Route Handlers enforcing role-based access control, payload validation, and fail-closed security.

## 2. Fail-Closed Design Principle
If no active, approved invoice series exists for a given legal entity and financial year, the API strictly returns HTTP 422 / 500 and prevents invoice creation.
