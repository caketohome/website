const fs = require('fs');
const content = fs.readFileSync('frontend/src/app/api/v1/[...path]/route.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('export async function PUT') || line.includes('export async function DELETE') || line.includes('export async function POST')) {
    console.log(`L${i+1}: ${line.trim()}`);
  }
});
