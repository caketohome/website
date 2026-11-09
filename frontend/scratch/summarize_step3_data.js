const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'forensic_c7_6_step3_data.json'), 'utf8'));

console.log("=== ACCOUNT COLUMNS ===");
data.accountColumns.forEach(c => console.log(`  ${c.column_name.padEnd(20)} ${c.data_type.padEnd(15)} nullable: ${c.is_nullable.padEnd(5)} default: ${c.column_default}`));

console.log("\n=== CONSTRAINTS ===");
data.accountConstraints.forEach(c => console.log(`  [${c.contype}] ${c.conname}: ${c.def}`));

console.log("\n=== INDEXES ===");
data.accountIndexes.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

console.log("\n=== TRIGGERS (accounting_account & related) ===");
data.triggers.forEach(t => console.log(`  table: ${t.event_object_table} | trigger: ${t.trigger_name} | event: ${t.event_manipulation} | timing: ${t.action_timing}`));

console.log("\n=== PG TRIGGERS ON accounting_account ===");
data.pgTriggers.forEach(t => console.log(`  ${t.tgname} -> ${t.proname} (enabled: ${t.tgenabled})`));

console.log("\n=== FOREIGN KEYS INVOLVING accounting_account ===");
data.accountForeignKeys.forEach(fk => console.log(`  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (on delete: ${fk.delete_rule}, on update: ${fk.update_rule})`));

console.log("\n=== TYPE / SUBTYPE / IS_GROUP BREAKDOWN ===");
data.typeSummary.forEach(ts => console.log(`  ${ts.type.padEnd(12)} | is_group: ${String(ts.is_group).padEnd(5)} | subtype: ${(ts.subtype || 'NULL').padEnd(25)} | count: ${ts.count}`));

console.log("\n=== POSTED ACCOUNTS USAGE ===");
data.postedAccounts.forEach(pa => console.log(`  ${pa.code} - ${pa.name} (${pa.type}/${pa.subtype}): lines=${pa.line_count}, cc_lines=${pa.cc_count}, Dr=${pa.total_dr}, Cr=${pa.total_cr}`));
