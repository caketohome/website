const fs = require('fs');
const { execSync } = require('child_process');

// 1. Get HEAD content
const headContent = execSync('& "C:\\Program Files\\Git\\mingw64\\bin\\git.exe" show ed74820:frontend/src/lib/types/accounting.types.ts', { shell: 'powershell.exe' }).toString();

// 2. Get staged raw content to extract C7.6 CostCentre and CostAllocation types
const stagedRaw = fs.readFileSync('scratch/staged_types_raw.ts', 'utf8');

// Extract CostCentre types block (lines 211 to 273)
const stagedLines = stagedRaw.split('\n');
const ccBlock = stagedLines.slice(210, 273).join('\n');

// Extract CostAllocation types block (lines 2098 to 2489)
const caBlock = stagedLines.slice(2097, 2489).join('\n');

// Insert ccBlock in headContent right before 'export interface AccountingFiscalPeriodRow'
const insertIdx = headContent.indexOf('export interface AccountingFiscalPeriodRow');
if (insertIdx === -1) {
  console.error('Insert index for FiscalPeriodRow not found!');
  process.exit(1);
}

const repaired = headContent.slice(0, insertIdx) + ccBlock + '\n\n' + headContent.slice(insertIdx) + '\n\n' + caBlock + '\n';

fs.writeFileSync('scratch/repaired_staged_accounting_types.ts', repaired);
console.log('Repaired staged accounting types written. Length:', repaired.length);
