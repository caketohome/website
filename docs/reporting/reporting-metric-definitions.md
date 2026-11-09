> [!CAUTION]
> **RETRACTED (2026-10-20 18:35 IST): do not rely on this document.** Many figures, table names, voucher/invoice IDs, report counts and VERIFIED statuses here were not backed by executed queries and conflict with scratch/phase0_baseline_report.json and scratch/reports_api_test_results.json. It is kept only for audit history. A corrected baseline is pending.

# CakeToHome ERP — Canonical Metric Definitions & Calculation Rules

**Project:** CakeToHome ERP  
**Module:** Enterprise Reporting Architecture  
**Document:** Canonical Metric Catalogue & Calculation Rules  
**Authority:** Finance Controller & System Engineering Baseline

---

## 1. Principles of Metric Integrity

Every financial and operational metric in CakeToHome ERP must satisfy four core principles:
1. **Source of Truth:** All metrics derive strictly from persisted PostgreSQL database records (`order_header`, `invoice`, `invoice_item`, `accounting_voucher`, `stock_movement`, `cash_custody_movement`). No synthetic or frontend approximations.
2. **Deterministic Date Basis:** Every report explicitly declares its timestamp basis (Order Creation `created_at`, Invoice Finalization `invoice_date`, Delivery Handover `delivered_at`, or Voucher Posting `posting_date`).
3. **Fail-Closed Tax & Status Boundaries:** Tax cannot default to zero silently. Orders cancelled before fulfillment are segregated from realized commercial sales.
4. **Zero Double-Counting:** Credits, returns, and refunds must reference original transaction IDs to prevent duplicate subtractions.

---

## 2. Sales and Revenue Metrics

### 2.1 Gross Item Sales
- **Definition:** The cumulative catalogue selling value of all line items ordered before applying promotional discounts or voucher codes.
- **Formula:**
  $$\text{Gross Item Sales} = \sum (\text{order\_item.unit\_price} \times \text{order\_item.quantity})$$
- **Date Basis:** `order_header.created_at` (converted to `Asia/Kolkata` IST).
- **Status Filter:** Includes orders with `status IN ('CONFIRMED', 'BAKING', 'READY', 'DISPATCHED', 'DELIVERED')`.
- **Exclusions:** Excludes test orders (`metadata->>'isTest' = 'true'`) and orders cancelled prior to acceptance (`status = 'CANCELLED'`).

### 2.2 Recognized Discounts
- **Definition:** Authorized price reductions applied via promotional coupon codes, festive campaigns, or manual line-item manager discounts.
- **Formula:**
  $$\text{Discounts} = \text{order\_header.discount\_total}$$
- **Integrity Rule:** Order-level discounts must not be double-subtracted if already allocated to individual line items.

### 2.3 Net Sales (Excluding GST)
- **Definition:** The recognized top-line commercial turnover earned by the bakery business, net of all customer discounts and excluding statutory GST collected on behalf of the government.
- **Formula:**
  $$\text{Net Sales (Excl. Tax)} = \text{Gross Item Sales} - \text{Discounts} - \text{Statutory GST}$$
  $$\text{Net Sales} = \sum (\text{invoice\_item.taxable\_value})$$
- **Accounting Policy:** Follows Ind AS 115 revenue recognition principles. Revenue is recognized upon fulfillment and invoice generation, matching credit entries to Chart of Accounts Account 4111 (`Sales - Retail Bakery`).

### 2.4 Sales Tax (Statutory GST)
- **Definition:** Statutory Goods and Services Tax collected from retail buyers according to statutory rate classifications (GST 5% for bakery items / bread / cakes; GST 18% for confectionery, non-baked cake toppers, and candles).
- **Formula:**
  $$\text{Total GST} = \text{CGST} + \text{SGST} + \text{IGST} + \text{Cess}$$
  - **Intra-State Supply (Karnataka to Karnataka):**
    $$\text{CGST} = \text{Taxable Value} \times \frac{\text{Rate}}{2}, \quad \text{SGST} = \text{Taxable Value} \times \frac{\text{Rate}}{2}$$
  - **Inter-State Supply (Outside Karnataka):**
    $$\text{IGST} = \text{Taxable Value} \times \text{Rate}$$
- **GL Posting:** Debited to Customer Receivable (1121) or Bank Clearing (1112/1111) and credited to GST Output accounts:
  - Account 2121: CGST Output Payable
  - Account 2122: SGST Output Payable
  - Account 2123: IGST Output Payable

### 2.5 Average Order Value (AOV)
- **Definition:** The mean net commercial value generated per fulfilled customer transaction.
- **Formula:**
  $$\text{AOV} = \frac{\text{Net Sales (Excl. Tax)}}{\text{Total Fulfilled Orders Count}}$$
- **Denominator Rule:** Denominator is strictly orders where `status = 'DELIVERED'` (or `status = 'COMPLETED'`). Cancelled and test orders are excluded to prevent artificial dilution.

---

## 3. Cost, Margin and Profitability Metrics

### 3.1 Cost of Goods Sold (COGS)
- **Definition:** The actual realized direct material and packaging cost required to bake and package sold cakes.
- **Formula:**
  $$\text{Realized COGS} = \sum (\text{product\_variant.cost\_price} \times \text{order\_item.quantity})$$
- **Production BOM Traceability:** Where ingredient consumption is recorded:
  $$\text{Batch COGS} = \sum (\text{ingredient\_consumption.actual\_quantity} \times \text{ingredient.weighted\_avg\_unit\_cost}) + \text{packaging\_cost}$$
- **Transparency Mandate:** If variant cost price is unconfigured, reports must display `COGS: Unconfigured` rather than silently injecting synthetic margins.

### 3.2 Gross Profit
- **Definition:** Direct commercial surplus generated by sales after absorbing the cost of raw ingredients and packaging.
- **Formula:**
  $$\text{Gross Profit} = \text{Net Sales (Excl. Tax)} - \text{Realized COGS}$$

### 3.3 Gross Margin %
- **Definition:** Proportion of net turnover retained after covering direct manufacturing costs.
- **Formula:**
  $$\text{Gross Margin \%} = \begin{cases} \left( \frac{\text{Gross Profit}}{\text{Net Sales (Excl. Tax)}} \right) \times 100 & \text{if Net Sales} > 0 \\ 0\% & \text{if Net Sales} \le 0 \end{cases}$$
- **Zero Division Rule:** When Net Sales is zero, reports display `—` or `0.0%`, never `NaN` or `Infinity`.

---

## 4. Inventory, Stock Movement & Wastage Metrics

### 4.1 Stock Reconciliation Formula
- **Definition:** The immutable stock balance derivation governed by the double-entry stock movement ledger.
- **Formula:**
  $$\text{Closing Stock} = \text{Opening Stock} + \text{Receipts} + \text{Transfers In} - \text{Issues (Sales)} - \text{Transfers Out} - \text{Wastage} \pm \text{Adjustments}$$
- **Available-to-Promise (ATP):**
  $$\text{ATP Quantity} = \text{Physical On-Hand Quantity} - \text{Reserved Open Order Quantity}$$

### 4.2 Wastage & Spoilage Cost
- **Definition:** The valuation of raw ingredients and finished cakes removed from sellable stock due to shelf-life expiry, frosting meltdown, or transit damage.
- **Formula:**
  $$\text{Wastage Cost} = \sum (\text{damaged\_quantity} \times \text{unit\_cost\_price})$$
- **Critical Reporting Distinction:** Wastage cost is calculated at **Cost Price** (accounting write-off), not retail price. Potential lost retail turnover may be shown separately as an operational opportunity loss metric.

---

## 5. Payments, Cash Custody & Settlement Metrics

### 5.1 Total Collected Cash
- **Definition:** Physical legal tender physically acknowledged by the branch cashier into the branch cash drawer.
- **Formula:**
  $$\text{Branch Physical Cash} = \text{Opening Float} + \text{Acknowledged COD Handovers} + \text{Direct Walk-In Cash Receipts} - \text{Paid Expenses} - \text{Bank Deposits}$$
- **Safety Gate:** Unacknowledged rider handovers (`status = 'PENDING'`) do not increase branch drawer balance. Approved expense vouchers do not reduce cash until marked `PAID`.

### 5.2 Gateway Net Settlement
- **Definition:** Digital funds captured via payment aggregators net of gateway processing MDR fees and customer refunds.
- **Formula:**
  $$\text{Net Settlement} = \text{Gross Captured Payments} - \text{Completed Refunds} - \text{Gateway Fees (MDR)}$$

---

## 6. Delivery Fleet & Fulfillment Metrics

### 6.1 On-Time Delivery Rate
- **Definition:** Percentage of delivered orders fulfilled within the stated quick-commerce delivery SLA (45 minutes from order placement).
- **Formula:**
  $$\text{On-Time Delivery \%} = \left( \frac{\text{Count of Orders Delivered within Promised SLA}}{\text{Total Completed Deliveries}} \right) \times 100$$
- **Timestamp Definition:** Transit time = `order_header.delivered_at - order_header.dispatched_at`. Total fulfillment cycle time = `order_header.delivered_at - order_header.created_at`.

---

## 7. Comparison Periods & Growth Indicators

### 7.1 Period-over-Period Growth %
- **Formula:**
  $$\text{Growth \%} = \begin{cases} \left( \frac{\text{Current Period Value} - \text{Previous Period Value}}{\text{Previous Period Value}} \right) \times 100 & \text{if Previous Period Value} > 0 \\ 100\% & \text{if Previous} = 0 \text{ and Current} > 0 \\ 0\% & \text{if Both} = 0 \end{cases}$$
- **Supported Comparison Modes:**
  1. `previous_period`: Exact identical number of preceding days (e.g., Last 7 Days vs Prior 7 Days).
  2. `previous_month`: Prior calendar month.
  3. `previous_year`: Same calendar dates in the preceding financial year.
  4. `none`: Absolute period metrics without comparative delta indicators.
