const https = require('https');

async function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode || 0);
    }).on('error', () => resolve(0));
  });
}

async function run() {
  console.log('Testing Cloudinary frame URLs (1 to 112)...');
  const results = [];
  
  // Test in parallel batches of 15
  for (let i = 1; i <= 112; i += 15) {
    const batch = [];
    for (let j = i; j < Math.min(i + 15, 113); j++) {
      const pad = String(j).padStart(4, '0');
      const urlAuto = `https://res.cloudinary.com/r0k56n3j/image/upload/f_auto,q_auto/frames1_${pad}.jpg`;
      const urlPlain = `https://res.cloudinary.com/r0k56n3j/image/upload/frames1_${pad}.jpg`;
      batch.push((async () => {
        const statusAuto = await checkUrl(urlAuto);
        const statusPlain = statusAuto === 200 ? 200 : await checkUrl(urlPlain);
        return { frame: j, statusAuto, statusPlain };
      })());
    }
    const batchRes = await Promise.all(batch);
    results.push(...batchRes);
  }

  const okAuto = results.filter(r => r.statusAuto === 200).length;
  const okPlain = results.filter(r => r.statusPlain === 200).length;
  const failed = results.filter(r => r.statusAuto !== 200 && r.statusPlain !== 200).map(r => r.frame);

  console.log(`Summary:`);
  console.log(`  f_auto,q_auto: ${okAuto} / 112 (status 200 OK)`);
  console.log(`  plain / auto: ${okPlain} / 112 (status 200 OK)`);
  if (failed.length > 0) {
    console.log(`  Failed frames:`, failed);
  } else {
    console.log(`  All 112 frames verified 100% accessible!`);
  }
}

run();
