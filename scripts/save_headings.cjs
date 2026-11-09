const fs = require('fs');

const content = fs.readFileSync('C:/Users/alexc/.gemini/antigravity/brain/ef41ec32-eb13-410b-aac0-36f4fec20a16/scratch/phase4_prompt_full.txt', 'utf8');
const lines = content.split('\n');

let out = [];
lines.forEach((line, idx) => {
  if (line.startsWith('#')) {
    out.push(`L${idx + 1}: ${line}`);
  }
});

fs.writeFileSync('C:/Users/alexc/.gemini/antigravity/brain/ef41ec32-eb13-410b-aac0-36f4fec20a16/scratch/prompt_headings.txt', out.join('\n'));
console.log('Total headings:', out.length);

