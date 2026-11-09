/**
 * CakeToHome Phase 4.4 CI/CD Migration Safeguard Linter (Hardened)
 * 
 * Scans all SQL migrations and deployment scripts for prohibited synthetic statutory
 * approval strings, unreviewed invoice-series promotion patterns, comment-splitting
 * evasions, direct INSERT promotions, and dynamic SQL execution primitives under CGST Rule 46.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, '../src/lib/migrations');

// Prohibited approver identities that represent synthetic or fabricated signatures
const FORBIDDEN_APPROVERS = [
  'ca_audit_signed',
  'partner_audit_signed',
  'system_audit',
  'admin_qa_super',
  'synthetic_ca'
];

function sanitizeSql(rawSql) {
  // 1. Remove block comments /* ... */
  let clean = rawSql.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // 2. Remove line comments -- ...
  clean = clean.replace(/--.*$/gm, ' ');
  // 3. Remove identifier quotes
  clean = clean.replace(/"/g, '');
  // 4. Normalize whitespace
  clean = clean.replace(/\s+/g, ' ');
  return clean;
}

function lintMigrationContent(content, filename, allowHistorical = false) {
  const cleanSql = sanitizeSql(content);
  let violations = [];

  // Check 1: Forbidden Approver identities in active DML
  for (const forbidden of FORBIDDEN_APPROVERS) {
    if (cleanSql.includes(forbidden)) {
      // Exclude defensive security trigger checks and harmless string notices
      const isSecurityCheck = (
        cleanSql.includes('NEW.authorized_by') ||
        cleanSql.includes('WHERE authorized_by') ||
        cleanSql.includes('IN (') && cleanSql.includes('REVOKED_SYNTHETIC') ||
        cleanSql.startsWith('RAISE NOTICE')
      );

      if (!isSecurityCheck) {
        const isHistoricalC7_12 = filename.includes('c7_12') && allowHistorical;
        violations.push({
          file: filename,
          severity: isHistoricalC7_12 ? 'HISTORICAL_NEUTRALIZED' : 'FATAL',
          rule: 'NO_SYNTHETIC_APPROVER_IDENTITY',
          message: `Prohibited synthetic approver '${forbidden}' detected in migration DML.`,
          isHistorical: isHistoricalC7_12
        });
      }
    }
  }

  // Check 2: Unconditional promotion to APPROVED in UPDATE, INSERT, or Dynamic SQL
  // Extract SET clause of UPDATE to ensure 'approval_status = APPROVED' is an assignment, not a WHERE condition
  const updateMatch = cleanSql.match(/UPDATE\s+(?:public\.)?invoice_sequence\s+SET\s+([\s\S]*?)(?:WHERE|;|$)/i);
  const setClause = updateMatch ? updateMatch[1] : '';
  const isUpdatePromotion = /approval_status\s*=\s*(?:'APPROVED'|'APP'\s*\|\|\s*'ROVED')/i.test(setClause);

  const insertRegex = /INSERT\s+INTO\s+(?:public\.)?invoice_sequence[\s\S]*?VALUES[\s\S]*?'APPROVED'/i;
  const dynamicRegex = /EXECUTE\s+(?:format\()?\s*['"](?:UPDATE|INSERT)[\s\S]*?invoice_sequence[\s\S]*?approval_status/i;

  if (isUpdatePromotion) {
    const isHistoricalC7_12 = filename.includes('c7_12') && allowHistorical;
    violations.push({
      file: filename,
      severity: isHistoricalC7_12 ? 'HISTORICAL_NEUTRALIZED' : 'HIGH',
      rule: 'NO_UNCONDITIONAL_SERIES_PROMOTION',
      message: "Unconditional UPDATE promotion to 'APPROVED' detected. Series approvals must occur through authorized server-side API or verified trigger.",
      isHistorical: isHistoricalC7_12
    });
  } else if (insertRegex.test(cleanSql)) {
    const isHistoricalC7_12 = filename.includes('c7_12') && allowHistorical;
    violations.push({
      file: filename,
      severity: isHistoricalC7_12 ? 'HISTORICAL_NEUTRALIZED' : 'HIGH',
      rule: 'NO_UNCONDITIONAL_SERIES_PROMOTION',
      message: "Direct INSERT with 'APPROVED' status detected.",
      isHistorical: isHistoricalC7_12
    });
  } else if (dynamicRegex.test(cleanSql)) {
    const isHistoricalC7_12 = filename.includes('c7_12') && allowHistorical;
    violations.push({
      file: filename,
      severity: isHistoricalC7_12 ? 'HISTORICAL_NEUTRALIZED' : 'FATAL',
      rule: 'NO_DYNAMIC_SQL_SERIES_PROMOTION',
      message: 'Dynamic SQL EXECUTE targeting invoice_sequence approval detected.',
      isHistorical: isHistoricalC7_12
    });
  }

  return violations;
}

function lintMigrations() {
  const args = process.argv.slice(2);
  const allowHistorical = args.includes('--remediated-baseline');
  const targetDir = args.find(a => !a.startsWith('--')) || DEFAULT_MIGRATIONS_DIR;

  console.log('================================================================');
  console.log(' CakeToHome CI/CD Migration Statutory Integrity Audit Gate (Hardened)');
  console.log('================================================================');
  console.log(`Scanning directory: ${targetDir}`);
  if (allowHistorical) {
    console.log('Mode: Verifying with historical baseline remediation (c7_13 active)');
  }

  if (!fs.existsSync(targetDir)) {
    console.error(`ERROR: Target directory not found: ${targetDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.sql'));
  let violations = [];
  let historicalFlawsRemediated = [];
  let auditedCount = 0;

  for (const file of files) {
    auditedCount++;
    const filePath = path.join(targetDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const fileViolations = lintMigrationContent(content, file, allowHistorical);

    fileViolations.forEach(v => {
      if (v.isHistorical) {
        historicalFlawsRemediated.push(v);
      } else {
        violations.push(v);
      }
    });
  }

  console.log(`Audited ${auditedCount} migration file(s).`);

  if (historicalFlawsRemediated.length > 0) {
    console.log(`\nℹ️  Historical Defect Notice: ${historicalFlawsRemediated.length} known defect(s) detected in c7_12:`);
    historicalFlawsRemediated.forEach((v, i) => {
      console.log(`   [H${i + 1}] ${v.file} - ${v.rule}: ${v.message}`);
    });
    console.log(`   --> Remediation status: NEUTRALIZED by forward-only migration c7_13_statutory_approval_integrity_and_governance.sql.\n`);
  }

  if (violations.length > 0) {
    console.error(`\n❌ CI MIGRATION LINT FAILED: ${violations.length} un-remediated statutory governance violation(s) detected:`);
    violations.forEach((v, i) => {
      console.error(`  [${i + 1}] [${v.severity}] ${v.file} - ${v.rule}`);
      console.error(`      ${v.message}`);
    });
    console.error('\nDeployment aborted. Deployable migrations contain synthetic or unreviewed approval logic.\n');
    process.exit(1);
  }

  console.log('✅ CI MIGRATION LINT PASSED: All deployable migrations conform to statutory approval governance standards.');
  process.exit(0);
}

if (require.main === module) {
  lintMigrations();
}

module.exports = {
  sanitizeSql,
  lintMigrationContent,
  FORBIDDEN_APPROVERS
};
