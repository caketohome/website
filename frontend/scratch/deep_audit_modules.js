const fs = require('fs');
const path = require('path');

const libDir = path.join(__dirname, '../src/lib');

function scanFile(filePath, patterns) {
  const content = fs.readFileSync(filePath, 'utf8');
  const results = {};
  for (const [key, regex] of Object.entries(patterns)) {
    const matches = content.match(regex);
    results[key] = matches ? matches.length : 0;
  }
  return results;
}

console.log('=== FORENSIC SCAN OF LIB SERVICES AND REPOSITORIES ===\n');

// 1. Check repositories for direct PostgreSQL query usage
const reposDir = path.join(libDir, 'repositories');
const repoFiles = fs.readdirSync(reposDir).filter(f => f.endsWith('.ts'));

console.log(`Auditing ${repoFiles.length} repositories in src/lib/repositories/...`);
const repoAudit = [];
repoFiles.forEach(f => {
  const p = path.join(reposDir, f);
  const content = fs.readFileSync(p, 'utf8');
  const usesDbQuery = content.includes('dbQuery') || content.includes('dbTransaction') || content.includes('client.query');
  const usesMemoryStore = content.includes('memoryStore') || content.includes('ApiEngine');
  const usesMock = content.toLowerCase().includes('mock') || content.includes('DEFAULT_');
  repoAudit.push({ file: f, usesDbQuery, usesMemoryStore, usesMock });
});

console.log('Repositories using memoryStore/ApiEngine (potential dual-state or cache):');
repoAudit.filter(r => r.usesMemoryStore).forEach(r => console.log(`  - ${r.file}`));

console.log('\nRepositories NOT using dbQuery (pure in-memory or external):');
repoAudit.filter(r => !r.usesDbQuery).forEach(r => console.log(`  - ${r.file}`));

// 2. Check services for persistence patterns
const servicesDir = path.join(libDir, 'services');
const serviceFiles = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts'));

console.log(`\nAuditing ${serviceFiles.length} services in src/lib/services/...`);
const serviceAudit = [];
serviceFiles.forEach(f => {
  const p = path.join(servicesDir, f);
  const content = fs.readFileSync(p, 'utf8');
  const usesDbQuery = content.includes('dbQuery') || content.includes('dbTransaction') || content.includes('client.query');
  const usesRepo = content.includes('Repository');
  const usesMemoryStore = content.includes('memoryStore') || content.includes('ApiEngine');
  serviceAudit.push({ file: f, usesDbQuery, usesRepo, usesMemoryStore });
});

console.log('Services using direct memoryStore/ApiEngine:');
serviceAudit.filter(s => s.usesMemoryStore).forEach(s => console.log(`  - ${s.file}`));

console.log('\nServices that do NOT use dbQuery OR Repository:');
serviceAudit.filter(s => !s.usesDbQuery && !s.usesRepo).forEach(s => console.log(`  - ${s.file}`));

// 3. Scan api-engine.ts for modules that bypass PostgreSQL completely
console.log('\nAuditing api-engine.ts persistence coverage...');
const apiEnginePath = path.join(libDir, 'api-engine.ts');
const apiContent = fs.readFileSync(apiEnginePath, 'utf8');

// Check what arrays are in memoryStore
const storeDataMatch = apiContent.match(/interface StoreData\s*\{([\s\S]*?)\}/);
if (storeDataMatch) {
  const storeProps = storeDataMatch[1].split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('//') && l.includes(':'))
    .map(l => l.split(':')[0].trim());
  console.log(`StoreData has ${storeProps.length} entity keys in memoryStore.`);
  
  // Check which keys are hydrated in db-persistence.ts
  const dbPersistPath = path.join(libDir, 'db-persistence.ts');
  const dbPersistContent = fs.readFileSync(dbPersistPath, 'utf8');
  
  const unhydrated = [];
  storeProps.forEach(prop => {
    if (!dbPersistContent.includes(`targetStore.${prop}`) && !dbPersistContent.includes(`targetStore['${prop}']`)) {
      unhydrated.push(prop);
    }
  });
  console.log(`\nKeys in memoryStore with NO database hydration in db-persistence.ts (${unhydrated.length}):`);
  unhydrated.forEach(k => console.log(`  - ${k}`));
}
