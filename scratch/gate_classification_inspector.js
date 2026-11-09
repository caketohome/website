const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const git = 'C:/Users/alexc/.gemini/mingit/cmd/git.exe';

// 1. Analyze 44 tracked modified files
const trackedRaw = execSync(`${git} status --porcelain=v1 -uno`, { encoding: 'utf8' });
const trackedLines = trackedRaw.trim().split('\n').filter(Boolean);

const numstatRaw = execSync(`${git} diff --numstat`, { encoding: 'utf8' });
const numstatMap = {};
for (const line of numstatRaw.trim().split('\n')) {
  if (!line) continue;
  const [add, del, file] = line.split('\t');
  numstatMap[file] = { add: parseInt(add, 10), del: parseInt(del, 10) };
}

function classifyTracked(file) {
  if (file === 'frontend/src/lib/api-engine.ts' ||
      file === 'frontend/src/app/api/v1/admin/branches/route.ts' ||
      file === 'frontend/src/lib/db-persistence.ts') {
    return 'Unclassified / Core Platform (Phase 5C & Branch Auth)';
  }
  if (file.includes('bank-account') || file.includes('bank-deposit') || file.includes('bank-reconciliation') || file.includes('bank-statement')) {
    return 'Phase B (Banking Master & Reconciliation)';
  }
  if (file.includes('expense')) {
    return 'Phase C5 (Expense Posting & Reversals)';
  }
  if (file.includes('teller') || file.includes('cash')) {
    return 'Phase C3/C7.5 (Teller Management & Branch Cash)';
  }
  if (file.includes('cost-centre') || file.includes('cost-allocation')) {
    return 'Phase C7.6 (Cost Centre & Allocation)';
  }
  if (file.includes('gifting')) {
    return 'Phase C7.7 (Corporate Gifting)';
  }
  if (file.includes('accounting-voucher') || file.includes('accounting-journal') || file.includes('accounting-work-queue') ||
      file.includes('customer-receipt') || file.includes('purchase-payment') || file.includes('purchase-posting') ||
      file.includes('sales-posting') || file.includes('sales-return') || file.includes('order-lifecycle-service') ||
      file.includes('gateway-payout') || file.includes('gateway-settlement') ||
      file.includes('accounting.types.ts') || file.includes('purchase.types.ts')) {
    return 'Phase C1-C4 (Core Accounting / AR / AP / Journals)';
  }
  if (file.includes('CHECKPOINTS') || file.includes('FREEZE')) {
    return 'Documentation & Checkpoints';
  }
  if (file.includes('customer.repository.ts') || file.includes('customer.ts')) {
    return 'Customer Data Layer';
  }
  if (file.includes('staff-access-control.ts') || file.includes('AdminSidebar.tsx') ||
      file.includes('admin-tabs.tsx') || file.includes('dashboard/page.tsx')) {
    return 'Admin Shell, Navigation & RBAC Registry';
  }
  if (file === 'frontend/src/app/api/v1/[...path]/route.ts') {
    return 'Shared API Router Monolith';
  }
  if (file.includes('types/index.ts') || file.includes('repositories/index.ts') ||
      file.includes('services/index.ts') || file.includes('types/domain.ts')) {
    return 'Shared Index / Domain Types';
  }
  return 'Other Modified';
}

const trackedClassified = {};
for (const line of trackedLines) {
  const file = line.substring(3).trim();
  const cat = classifyTracked(file);
  if (!trackedClassified[cat]) trackedClassified[cat] = [];
  trackedClassified[cat].push({ file, stat: numstatMap[file] || { add: 0, del: 0 } });
}

// 2. Analyze untracked files
const untrackedRaw = execSync(`${git} ls-files -o --exclude-standard`, { encoding: 'utf8' });
const untrackedFiles = untrackedRaw.trim().split('\n').filter(Boolean);

function classifyUntracked(f) {
  if (f.startsWith('frontend/scratch/')) return 'frontend/scratch/ (Test Suites & Verification Artifacts)';
  if (f.startsWith('scratch/')) return 'scratch/ (Test Suites, Baselines & Forensic Scripts)';
  if (f.startsWith('screenshots/') || f.startsWith('frontend/screenshots/') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')) {
    return 'Screenshots & Visual Evidence';
  }
  if (f.startsWith('CHECKPOINTS/acceptance-test-evidence/')) {
    return 'CHECKPOINTS/acceptance-test-evidence/ (Regression Evidence JSON)';
  }
  if (f.startsWith('CHECKPOINTS/')) {
    if (f.includes('c7-7')) return 'CHECKPOINTS/ (Phase C7.7 Checkpoints)';
    if (f.includes('c7-6')) return 'CHECKPOINTS/ (Phase C7.6 Checkpoints)';
    if (f.includes('c7-8') || f.includes('c7-9') || f.includes('c7-14')) return 'CHECKPOINTS/ (Phase C7.8-C7.14 Roadmap & Discovery)';
    return 'CHECKPOINTS/ (Prior Phase Checkpoints & Production Runbooks)';
  }
  if (f.startsWith('frontend/CHECKPOINTS/')) {
    return 'frontend/CHECKPOINTS/ (Frontend Phase Checkpoints)';
  }
  if (f.startsWith('backend/src/migrations/')) {
    return 'backend/src/migrations/ (Phase A, B, C, C7.7 SQL Migrations)';
  }
  if (f.startsWith('frontend/migrate_')) {
    return 'frontend/ (Standalone Migration Runners)';
  }
  if (f.startsWith('frontend/src/')) {
    if (f.includes('corporate-gifting')) return 'frontend/src/ (Phase C7.7 Gifting Subsystem)';
    if (f.includes('cost-allocation') || f.includes('cost-centre')) return 'frontend/src/ (Phase C7.6 Cost Allocation Subsystem)';
    if (f.includes('bills-payable') || f.includes('bills-receivable')) return 'frontend/src/ (Phase C7.2/C7.4 Bills Subsystem)';
    if (f.includes('teller') || f.includes('vault') || f.includes('branch-cash')) return 'frontend/src/ (Phase C3/C7.5 Teller & Cash Subsystem)';
    if (f.includes('manual-journal')) return 'frontend/src/ (Phase C6 Manual Journal Subsystem)';
    if (f.includes('company') || f.includes('gst-registration')) return 'frontend/src/ (Phase A Company & GST Master)';
    if (f.includes('bank-accounts')) return 'frontend/src/ (Phase B Bank Master)';
    return 'frontend/src/ (Other Domain Components)';
  }
  if (f.startsWith('frontend/scripts/')) return 'frontend/scripts/ (E2E & Audit Scripts)';
  if (f === 'FREEZE.md') return 'Project Root Governance (FREEZE.md)';
  if (f === 'frontend/baseline_db_snapshot.json') return 'Baseline DB Snapshot';
  return 'Other Untracked';
}

const untrackedClassified = {};
for (const f of untrackedFiles) {
  const cat = classifyUntracked(f);
  if (!untrackedClassified[cat]) untrackedClassified[cat] = [];
  untrackedClassified[cat].push(f);
}

// 3. Secret Pattern Scan on Untracked Files
const secretPatterns = {
  pg_url_with_password: /postgres(ql)?:\/\/[^\s'"`:]+:[^\s'"`@]+@/,
  stripe_or_razorpay_live: /sk_live_|rzp_live/,
  jwt_like: /eyJhbGciOi/,
  supabase_service_role: /SUPABASE_SERVICE_ROLE/,
  aws_access_key: /AKIA[0-9A-Z]{16}/,
  hardcoded_password_literal: /password\s*[:=]\s*["'][^"']{6,}["']/i
};

const secretFindings = [];
for (const f of untrackedFiles) {
  // Only scan text files
  if (f.match(/\.(png|jpg|webp|ico|gz|zip)$/i)) continue;
  if (!fs.existsSync(f)) continue;
  try {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      for (const [pName, reg] of Object.entries(secretPatterns)) {
        if (reg.test(line)) {
          // Check if placeholder
          const isPlaceholder = /(user|username|USER|\[?password\]?|PASSWORD|<[^>]+>|\*\*\*|xxx|example|your_|process\.env)/i.test(line);
          secretFindings.push({
            file: f,
            line: idx + 1,
            pattern: pName,
            isPlaceholder,
            // DO NOT store the secret or line content!
            length: line.length
          });
        }
      }
    });
  } catch (e) {
    // skip binary or unreadable
  }
}

const report = {
  summary: {
    trackedModifiedCount: trackedLines.length,
    untrackedCount: untrackedFiles.length,
    secretFindingsCount: secretFindings.length,
    realSecretFindingsCount: secretFindings.filter(s => !s.isPlaceholder).length
  },
  trackedClassified,
  untrackedClassifiedSummary: Object.fromEntries(
    Object.entries(untrackedClassified).map(([k, v]) => [k, v.length])
  ),
  untrackedClassified,
  secretFindings
};

fs.writeFileSync('scratch/gate_classification_report.json', JSON.stringify(report, null, 2));
console.log('Report written to scratch/gate_classification_report.json');
console.log('Tracked modified:', report.summary.trackedModifiedCount);
console.log('Untracked files:', report.summary.untrackedCount);
console.log('Secret findings:', report.summary.secretFindingsCount, `(${report.summary.realSecretFindingsCount} potential non-placeholders)`);
