const fs = require('fs');
const path = require('path');

const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'forensic_dump.json'), 'utf8'));

console.log("=== SESSIONS DUMP ===");
dump.sessions.forEach(s => {
  console.log(`Session: ${s.id} | Branch: ${s.branch_id} (${s.branch_name}) | Status: ${s.status} | OpenFloat: ${s.opening_float} | Expected: ${s.expected_cash} | Closing: ${s.closing_count} | Var: ${s.variance} | Voucher: ${s.settlement_voucher_id}`);
});

console.log("\n=== MOVEMENTS DUMP ===");
dump.movements.forEach(m => {
  console.log(`Mov: ${m.id} | Sess: ${m.teller_session_id} | Branch: ${m.branch_id} | Dir: ${m.direction} | Type: ${m.movement_type} | Amt: ${m.amount} | Src: ${m.source_type}:${m.source_id} | Narration: ${m.narration}`);
});

console.log("\n=== HANDOVERS DUMP ===");
dump.handovers.forEach(h => {
  console.log(`HO: ${h.id} (${h.handover_number}) | Branch: ${h.branch_id} | Sess: ${h.teller_session_id} | Status: ${h.status} | Exp: ${h.expected_amount} | Decl: ${h.declared_amount} | Ack: ${h.acknowledged_amount} | Vch: ${h.settlement_voucher_id} | Mov: ${h.teller_movement_id}`);
});
