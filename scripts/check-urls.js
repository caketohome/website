const fs = require('fs');
const path = require('path');

const frontendEnv = fs.readFileSync(path.join(__dirname, '../frontend/.env'), 'utf8');
const backendUrlLine = frontendEnv.split('\n').find(l => l.startsWith('NEXT_PUBLIC_BACKEND_URL='));
console.log('Frontend configured backend target:', backendUrlLine ? backendUrlLine.trim() : 'NOT SET');

const backendEnv = fs.readFileSync(path.join(__dirname, '../backend/.env'), 'utf8');
const portLine = backendEnv.split('\n').find(l => l.startsWith('PORT=') || l.startsWith('MEDUSA_BACKEND_URL=') || l.startsWith('BACKEND_URL='));
console.log('Backend explicit port config:', portLine ? portLine.trim() : 'NO PORT EXPLICITLY SET (defaults to 9000)');
