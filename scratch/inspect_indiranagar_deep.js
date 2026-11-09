const fs = require('fs');
const path = require('path');

const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'forensic_dump.json'), 'utf8'));

console.log("=== INDIRANAGAR SESSIONS ===");
const indiSessions = dump.sessions.filter(s => s.branch_id === 'br_indiranagar');
console.table(indiSessions.map(s => ({
  id: s.id,
  status: s.status,
  open_float: s.opening_float,
  expected: s.expected_cash,
  closing_count: s.closing_count,
  variance: s.variance,
  vch: s.settlement_voucher_id,
  created: s.created_at
})));

console.log("\n=== INDIRANAGAR MOVEMENTS ===");
const indiMovs = dump.movements.filter(m => m.branch_id === 'br_indiranagar');
console.table(indiMovs.map(m => ({
  id: m.id,
  sess: m.teller_session_id,
  dir: m.direction,
  type: m.movement_type,
  amt: m.amount,
  src: `${m.source_type}:${m.source_id}`,
  narration: m.narration
})));

console.log("\n=== INDIRANAGAR JOURNAL LINES (1111, 1114, 1122) ===");
const indiJL = dump.journal_lines.filter(jl => jl.branch_id === 'br_indiranagar');
console.table(indiJL.map(jl => ({
  entry_no: jl.entry_no,
  vch_no: jl.voucher_no,
  type: jl.voucher_type,
  acc: jl.account_code,
  debit: jl.debit_amount,
  credit: jl.credit_amount,
  narration: jl.line_narration
})));
