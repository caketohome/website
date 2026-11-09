const fs = require('fs');
const readline = require('readline');

async function findPrompt() {
  const filePath = 'C:/Users/alexc/.gemini/antigravity/brain/ef41ec32-eb13-410b-aac0-36f4fec20a16/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lastUserStep = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (entry.type === 'USER_INPUT') {
      lastUserStep = entry;
    }
  }

  console.log('Last user step index:', lastUserStep ? lastUserStep.step_index : 'none');
  if (lastUserStep && lastUserStep.content) {
    console.log('Content preview:', lastUserStep.content.slice(0, 500));
    fs.writeFileSync('C:/Users/alexc/.gemini/antigravity/brain/ef41ec32-eb13-410b-aac0-36f4fec20a16/scratch/phase4_prompt.txt', lastUserStep.content);
    console.log('Wrote full prompt to scratch/phase4_prompt.txt');
  }
}

findPrompt().catch(console.error);

