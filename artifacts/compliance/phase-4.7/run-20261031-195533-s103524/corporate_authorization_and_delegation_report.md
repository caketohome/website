# Corporate Authorization and Delegation Report
**Project:** CakeToHome India Private Limited  

### 1. Corporate Authority Structure
- Under Section 179 of the Companies Act, 2013, general powers of the company are vested in the Board of Directors.
- Operational administration of invoicing may be delegated to officers (CFO, Finance Controller, Company Secretary) via formal Board Resolution.

### 2. Delegated Roles in CakeToHome System
- `FINANCE_CONTROLLER`: Designated role in application for submitting and approving statutory series.
- `SUPER_ADMIN`: System administrator role.
- **Segregation Rule:** Database trigger `trg_prevent_self_approval` prohibits the user who created/proposed a series from approving it. Technical deployment credentials cannot approve invoice series.
