const fs = require('fs');

const content = fs.readFileSync('C:/Users/alexc/.gemini/antigravity/brain/ef41ec32-eb13-410b-aac0-36f4fec20a16/scratch/phase4_prompt_full.txt', 'utf8');

const lines = content.split('\n');
console.log('Total lines:', lines.length);

const headings = [];
lines.forEach((line, idx) => {
  if (line.startsWith('#')) {
    headings.push({ line: idx + 1, text: line });
  }
});

console.log('Headings found:');
headings.forEach(h => console.log(`L${h.line}: ${h.text}`));

