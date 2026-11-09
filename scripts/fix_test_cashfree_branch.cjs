const fs = require('fs');

const path = 'cakes2home-main/cakes2home-main/scripts/test_phase5_cashfree_lifecycle.cjs';
let content = fs.readFileSync(path, 'utf8');

content = content.replaceAll("'branch_koramangala'", "'br_indiranagar_01'");
content = content.replaceAll("'prod_test_cf'", "'prod_01KXYMAJKNWZCFXJHESPTZE01G'");

fs.writeFileSync(path, content, 'utf8');
console.log('Updated test_phase5_cashfree_lifecycle.cjs with valid branch and product IDs');

