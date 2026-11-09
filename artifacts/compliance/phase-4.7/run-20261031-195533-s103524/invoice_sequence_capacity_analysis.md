# Invoice Sequence Capacity Analysis

### 1. Mathematical Constraint under Rule 46(b)
$$\text{Length}(\text{PREFIX}) + 1 + 5 + 1 + \text{Length}(\text{SEQUENCE}) \le 16$$
$$\text{Length}(\text{PREFIX}) + \text{Length}(\text{SEQUENCE}) \le 9$$

### 2. Capacity by Padding Width
- **5 Digits (`00001` to `99999`):** Capacity = 99,999 invoices/year (~273 orders/day).
- **6 Digits (`000001` to `999999`):** Capacity = 999,999 invoices/year (~2,739 orders/day).

### 3. Monitoring & Alerts
- Threshold: 80% capacity emits warning event `EVENT_SEQUENCE_CAPACITY_WARNING`.
- 100% capacity triggers fail-closed block, preventing silent formatting overflow.
