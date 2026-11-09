const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'forensic_c7_6_step3_data.json'), 'utf8'));

console.log("=== ALL 100 ACCOUNTS LISTING ===");
console.log(
  "CODE".padEnd(8) +
  "TYPE".padEnd(10) +
  "SUBTYPE".padEnd(22) +
  "GRP".padEnd(6) +
  "LVL".padEnd(5) +
  "NAME"
);
console.log("-".repeat(80));

data.accounts.forEach(a => {
  console.log(
    a.code.padEnd(8) +
    a.type.padEnd(10) +
    a.subtype.padEnd(22) +
    (a.is_group ? "GRP" : "LEAF").padEnd(6) +
    String(a.level).padEnd(5) +
    "  ".repeat(a.level - 1) + a.name
  );
});
