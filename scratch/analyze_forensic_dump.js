const fs = require('fs');
const path = require('path');

const dump = JSON.parse(fs.readFileSync(path.join(__dirname, 'forensic_dump.json'), 'utf8'));

console.log("===============================================================================");
console.log("   CAKETOHOME ERP — FORENSIC ACCOUNTING AUDIT ANALYSIS");
console.log("===============================================================================\n");

// 1. Group journal lines by branch and account
const branchMap = {};
dump.branches.forEach(b => {
  branchMap[b.id] = {
    id: b.id,
    name: b.name,
    code: b.code,
    is_open: b.is_open,
    jl_1111: [],
    jl_1114: [],
    jl_1122: [],
    sessions: [],
    movements: [],
    vault_movements: [],
    handovers: [],
    gl_1111: 0,
    gl_1114: 0,
    gl_1122: 0,
    active_drawer_cash: 0,
    vault_cash: 0,
    closed_sessions_count: 0,
    closed_sessions_closing_sum: 0,
    closed_sessions_variance_sum: 0,
    total_physical_custody: 0,
    variance: 0,
    causes: []
  };
});

// Add branch_id = null or unassigned branch if any
branchMap['UNKNOWN'] = {
  id: 'UNKNOWN',
  name: 'Unassigned / Global',
  code: 'UNKNOWN',
  is_open: false,
  jl_1111: [],
  jl_1114: [],
  jl_1122: [],
  sessions: [],
  movements: [],
  vault_movements: [],
  handovers: [],
  gl_1111: 0,
  gl_1114: 0,
  gl_1122: 0,
  active_drawer_cash: 0,
  vault_cash: 0,
  closed_sessions_count: 0,
  closed_sessions_closing_sum: 0,
  closed_sessions_variance_sum: 0,
  total_physical_custody: 0,
  variance: 0,
  causes: []
};

// Populate journal lines
let total_gl_1111_debit = 0;
let total_gl_1111_credit = 0;
let total_gl_1114_debit = 0;
let total_gl_1114_credit = 0;
let total_gl_1122_debit = 0;
let total_gl_1122_credit = 0;

dump.journal_lines.forEach(jl => {
  // Only consider posted and non-reversed entries
  if (jl.is_reversed) return;
  // If voucher is present, must be POSTED
  if (jl.voucher_status && jl.voucher_status !== 'POSTED') return;

  const bId = jl.branch_id || 'UNKNOWN';
  if (!branchMap[bId]) {
    branchMap[bId] = {
      id: bId,
      name: `External/Unmapped Branch (${bId})`,
      code: bId,
      is_open: false,
      jl_1111: [],
      jl_1114: [],
      jl_1122: [],
      sessions: [],
      movements: [],
      vault_movements: [],
      handovers: [],
      gl_1111: 0,
      gl_1114: 0,
      gl_1122: 0,
      active_drawer_cash: 0,
      vault_cash: 0,
      closed_sessions_count: 0,
      closed_sessions_closing_sum: 0,
      closed_sessions_variance_sum: 0,
      total_physical_custody: 0,
      variance: 0,
      causes: []
    };
  }

  const d = parseFloat(jl.debit_amount || 0);
  const c = parseFloat(jl.credit_amount || 0);
  const net = d - c;

  if (jl.account_code === '1111') {
    branchMap[bId].jl_1111.push(jl);
    branchMap[bId].gl_1111 += net;
    total_gl_1111_debit += d;
    total_gl_1111_credit += c;
  } else if (jl.account_code === '1114') {
    branchMap[bId].jl_1114.push(jl);
    branchMap[bId].gl_1114 += net;
    total_gl_1114_debit += d;
    total_gl_1114_credit += c;
  } else if (jl.account_code === '1122') {
    branchMap[bId].jl_1122.push(jl);
    branchMap[bId].gl_1122 += net;
    total_gl_1122_debit += d;
    total_gl_1122_credit += c;
  }
});

// Sessions
dump.sessions.forEach(s => {
  const bId = s.branch_id || 'UNKNOWN';
  if (branchMap[bId]) {
    branchMap[bId].sessions.push(s);
  }
});

// Movements
dump.movements.forEach(m => {
  const bId = m.branch_id || 'UNKNOWN';
  if (branchMap[bId]) {
    branchMap[bId].movements.push(m);
  }
});

// Vault movements
dump.vault_movements.forEach(vm => {
  const bId = vm.branch_id || 'UNKNOWN';
  if (branchMap[bId]) {
    branchMap[bId].vault_movements.push(vm);
    const amt = parseFloat(vm.amount || 0);
    if (vm.direction === 'IN') branchMap[bId].vault_cash += amt;
    else if (vm.direction === 'OUT') branchMap[bId].vault_cash -= amt;
  }
});

// Handovers
dump.handovers.forEach(h => {
  const bId = h.branch_id || 'UNKNOWN';
  if (branchMap[bId]) {
    branchMap[bId].handovers.push(h);
  }
});

// Compute active drawer cash per branch
Object.values(branchMap).forEach(b => {
  // Find open sessions
  const openSessions = b.sessions.filter(s => s.status === 'OPEN');
  let drawerTotal = 0;

  openSessions.forEach(os => {
    let sCash = parseFloat(os.opening_float || 0);
    const sMovs = b.movements.filter(m => m.teller_session_id === os.id);
    sMovs.forEach(m => {
      const amt = parseFloat(m.amount || 0);
      if (m.direction === 'IN') sCash += amt;
      else if (m.direction === 'OUT') sCash -= amt;
    });
    drawerTotal += sCash;
  });

  b.active_drawer_cash = drawerTotal;

  // Closed / settled sessions
  const closedSessions = b.sessions.filter(s => s.status === 'CLOSED' || s.status === 'SETTLED');
  b.closed_sessions_count = closedSessions.length;
  closedSessions.forEach(cs => {
    b.closed_sessions_closing_sum += parseFloat(cs.closing_count || 0);
    b.closed_sessions_variance_sum += parseFloat(cs.variance || 0);
  });

  b.total_physical_custody = b.active_drawer_cash + b.vault_cash;
  b.variance = b.gl_1111 - b.total_physical_custody;
});

console.log("=== GLOBAL GL TOTALS ===");
console.log(`GL 1111 (Cash in Hand): Debit=₹${total_gl_1111_debit.toFixed(2)}, Credit=₹${total_gl_1111_credit.toFixed(2)}, Net=₹${(total_gl_1111_debit - total_gl_1111_credit).toFixed(2)}`);
console.log(`GL 1114 (Petty Cash):   Debit=₹${total_gl_1114_debit.toFixed(2)}, Credit=₹${total_gl_1114_credit.toFixed(2)}, Net=₹${(total_gl_1114_debit - total_gl_1114_credit).toFixed(2)}`);
console.log(`GL 1122 (Undeposited):  Debit=₹${total_gl_1122_debit.toFixed(2)}, Credit=₹${total_gl_1122_credit.toFixed(2)}, Net=₹${(total_gl_1122_debit - total_gl_1122_credit).toFixed(2)}`);

// Filter branches with any activity
const activeBranches = Object.values(branchMap).filter(b => 
  b.gl_1111 !== 0 || b.gl_1114 !== 0 || b.gl_1122 !== 0 || 
  b.active_drawer_cash !== 0 || b.sessions.length > 0 || 
  b.movements.length > 0 || b.handovers.length > 0
);

console.log(`\nActive Branches Count: ${activeBranches.length}`);
console.table(activeBranches.map(b => ({
  id: b.id,
  name: b.name.substring(0, 30),
  GL_1111: b.gl_1111.toFixed(2),
  GL_1114: b.gl_1114.toFixed(2),
  GL_1122: b.gl_1122.toFixed(2),
  ActiveDrawer: b.active_drawer_cash.toFixed(2),
  VaultCash: b.vault_cash.toFixed(2),
  PhysicalTotal: b.total_physical_custody.toFixed(2),
  Variance: b.variance.toFixed(2),
  ClosedSess: b.closed_sessions_count,
  ClosedCountSum: b.closed_sessions_closing_sum.toFixed(2),
  ClosedVarSum: b.closed_sessions_variance_sum.toFixed(2)
})));

// Save active branches detailed summary
fs.writeFileSync(path.join(__dirname, 'active_branches_summary.json'), JSON.stringify(activeBranches, null, 2));
console.log("\nSaved active_branches_summary.json");
