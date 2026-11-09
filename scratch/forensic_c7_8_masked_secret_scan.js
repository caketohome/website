// Masked secret-pattern scan of specific untracked files (prints file:line:type only, never the secret).
const fs = require('fs');
const files = [
  'CHECKPOINTS/prg01-production-connection-verification.md',
  'CHECKPOINTS/prg01-step2-production-architecture-and-provisioning-runbook.md',
  'frontend/scratch/inspect_triggers.js',
  'frontend/scratch/test_phase_c7_7_step7c_api.js',
  'frontend/scratch/test_tx.js',
  'scratch/capture_db_baseline.js',
  'scratch/capture_db_baseline_v2.js',
  'scratch/capture_db_baseline_v3.js',
  'scratch/check_order_schema.js',
];
const pats = {
  pg_url_with_password: /postgres(ql)?:\/\/[^\s'"`:]+:[^\s'"`@]+@/,
  stripe_or_razorpay_live: /sk_live_|rzp_live/,
  jwt_like: /eyJhbGciOi/,
  supabase_service_role: /SUPABASE_SERVICE_ROLE/,
  aws_key: /AKIA[0-9A-Z]{12,}/,
};
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    for (const [name, re] of Object.entries(pats)) {
      if (re.test(l)) {
        const isPlaceholder = /(user|username|USER|\[?password\]?|PASSWORD|<[^>]+>|\*\*\*|xxx|example)/.test((l.match(re) || [''])[0]);
        console.log(`${f}:${i + 1}  ${name}  ${isPlaceholder ? '(looks like placeholder)' : '(LOOKS REAL - review)'}`);
      }
    }
  });
}
