const fs = require('fs');
const path = require('path');

const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'forensic_dump.json'), 'utf8'));

// Print all journal lines grouped by branch
const glByBranch = {};
dump.journal_lines.forEach(jl => {
  if (jl.is_reversed) return;
  if (jl.voucher_status && jl.voucher_status !== 'POSTED') return;
  if (jl.account_code !== '1111') return;

  const b = jl.branch_id || 'UNKNOWN';
  if (!glByBranch[b]) glByBranch[b] = 0;
  glByBranch[b] += parseFloat(jl.debit_amount || 0) - parseFloat(jl.credit_amount || 0);
});

console.log("GL 1111 by Branch:");
console.table(glByBranch);

// Print all sessions drawer cash by branch (both OPEN and CLOSED)
const drawerByBranch = {};
const closedByBranch = {};
dump.sessions.forEach(s => {
  const b = s.branch_id || 'UNKNOWN';
  if (!drawerByBranch[b]) drawerByBranch[b] = 0;
  if (!closedByBranch[b]) closedByBranch[b] = 0;

  if (s.status === 'OPEN') {
    let cash = parseFloat(s.opening_float || 0);
    const movs = dump.movements.filter(m => m.teller_session_id === s.id);
    movs.forEach(m => {
      if (m.direction === 'IN') cash += parseFloat(m.amount);
      if (m.direction === 'OUT') cash -= parseFloat(m.amount);
    });
    drawerByBranch[b] += cash;
  } else if (s.status === 'SETTLED' || s.status === 'CLOSED') {
    closedByBranch[b] += parseFloat(s.closing_count || 0);
  }
});

console.log("Open Drawer Cash by Branch:");
console.table(drawerByBranch);

console.log("Closed Session Count by Branch:");
console.table(closedByBranch);
