const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'forensic_c7_6_step3_data.json'), 'utf8'));

const series = {
  '1xxx (ASSETS)': data.accounts.filter(a => a.code.startsWith('1')),
  '2xxx (LIABILITIES)': data.accounts.filter(a => a.code.startsWith('2')),
  '3xxx (EQUITY)': data.accounts.filter(a => a.code.startsWith('3')),
  '4xxx (REVENUE)': data.accounts.filter(a => a.code.startsWith('4')),
  '5xxx (EXPENSE)': data.accounts.filter(a => a.code.startsWith('5')),
};

for (const [name, accs] of Object.entries(series)) {
  console.log(`\n=== ${name} (Total: ${accs.length}) ===`);
  const grps = accs.filter(a => a.is_group);
  const leaves = accs.filter(a => !a.is_group);
  console.log(`  Groups (${grps.length}): ${grps.map(g => `${g.code}:${g.name}`).join(' | ')}`);
  console.log(`  Leaves (${leaves.length}): ${leaves.map(l => `${l.code}:${l.name}`).slice(0, 5).join(' | ')} ... (+${Math.max(0, leaves.length - 5)} more)`);
}
