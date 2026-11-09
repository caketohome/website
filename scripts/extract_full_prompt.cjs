const fs = require('fs');
const readline = require('readline');

async function extractFullPrompt() {
  const filePath = 'C:/Users/alexc/.gemini/antigravity/brain/ef41ec32-eb13-410b-aac0-36f4fec20a16/.system_generated/logs/transcript_full.jsonl';
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (entry.step_index === 7861 && entry.type === 'USER_INPUT') {
      fs.writeFileSync('C:/Users/alexc/.gemini/antigravity/brain/ef41ec32-eb13-410b-aac0-36f4fec20a16/scratch/phase4_prompt_full.txt', entry.content);
      console.log('Saved full prompt, length:', entry.content.length);
      break;
    }
  }
}

extractFullPrompt().catch(console.error);

