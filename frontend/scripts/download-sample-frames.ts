/**
 * Download sample frames directly to artifacts directory
 */
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\494e1f14-65a8-4093-9062-5bdf6f901811";

async function downloadSampleFrames() {
  const samples = [1, 20, 39];
  for (const s of samples) {
    const padded = String(s).padStart(4, "0");
    const url = `https://res.cloudinary.com/r0k56n3j/image/upload/f_auto,q_auto/v1786881616/frames1_${padded}.jpg`;
    console.log(`Downloading ${url}...`);
    const res = await fetch(url);
    const buffer = Buffer.from(await res.arrayBuffer());
    const filePath = path.join(ARTIFACT_DIR, `cloudinary_raw_frame_${padded}.jpg`);
    fs.writeFileSync(filePath, buffer);
    console.log(`Saved ${filePath} (${buffer.length} bytes)`);
  }
}

downloadSampleFrames();
