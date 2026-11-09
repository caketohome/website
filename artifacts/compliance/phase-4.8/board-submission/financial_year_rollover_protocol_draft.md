# FINANCIAL YEAR ROLLOVER PROTOCOL DRAFT (BDR-11)
**Cut-Over Timing:** April 1st, 00:00:00 Indian Standard Time (IST, UTC+5:30).  

## Rollover Mechanics
1. On April 1st 00:00:00 IST, system initializes new sequence entry for upcoming FY (`27-28`).
2. Starting sequence resets to 1.
3. In-flight transactions before midnight retain previous FY notation (`26-27`).
4. Automated check asserts zero overlap across financial years.
