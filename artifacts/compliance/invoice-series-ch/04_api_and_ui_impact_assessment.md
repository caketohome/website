# API AND UI IMPACT ASSESSMENT
**Scope:** Frontend SvelteKit, Backend Services, Reports, Integrations  

---

## 1. System-Wide Consistency Inventory
| Subsystem / Reference | Affected Component | Impact of 'CH' Prefix & 15-16 Char Length | Action Taken / Architectural Readiness |
| :--- | :--- | :--- | :--- |
| **Delivery Invoicing** | `delivery-invoicing.service.ts` | Single point where `allocateInvoiceNumber` is invoked | Calls `allocate_invoice_number` with prefix `CH` |
| **Bills Receivable** | `bills-receivable.service.ts` | Corporate invoicing and payment tracking | Compatible with `CH/YY-YY/XXXXXX` format |
| **Invoice PDF Generation** | PDF template renderer | Header serial display box | Verified layout accommodates 16 characters |
| **Accounting Vouchers** | `accounting_voucher.reference_id` | General ledger double-entry linkage | Column is `varchar(255)`; zero truncation |
| **Admin Governance UI** | Governance and CDR dashboard | Series designation badge | Displays `CH` marked as `PENDING_BOARD_ADOPTION` |
| **WhatsApp / SMS** | Notification dispatcher | Message template tokens (`{{invoice_no}}`) | Formatted serial fits within SMS variable limit |
| **E-Commerce & POS** | Web checkout & POS receipt | Order tracking & invoice downloads | Single unified series across all sales channels |