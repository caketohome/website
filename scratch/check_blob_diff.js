const fs = require('fs');
const { execSync } = require('child_process');

const gitExe = 'C:\\Users\\alexc\\.gemini\\mingit\\cmd\\git.exe';
const blobSha = execSync(`"${gitExe}" hash-object -w scratch/test_candidate2_accounting_types.ts`).toString().trim();
console.log('Blob SHA:', blobSha);

// Diff between 39d1981:frontend/src/lib/types/accounting.types.ts and the blob
const diffStat = execSync(`"${gitExe}" diff --stat 39d1981:frontend/src/lib/types/accounting.types.ts ${blobSha}`).toString();
console.log('Diff stat:\n' + diffStat);

const diff = execSync(`"${gitExe}" diff 39d1981:frontend/src/lib/types/accounting.types.ts ${blobSha}`).toString();
console.log('Diff content:\n' + diff);
