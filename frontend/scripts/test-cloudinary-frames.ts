/**
 * Test and validate Cloudinary frame URLs for frames 1 to 39
 */

async function testFrames() {
  console.log("Testing Cloudinary frame URL formats...");

  const framesToTest = [1, 2, 10, 20, 30, 38, 39];

  for (const f of framesToTest) {
    const padded = String(f).padStart(4, "0");
    const urls = [
      `https://res.cloudinary.com/r0k56n3j/image/upload/f_auto,q_auto/v1786881616/frames1_${padded}.jpg`,
      `https://res.cloudinary.com/r0k56n3j/image/upload/f_auto,q_auto/frames1_${padded}.jpg`,
      `https://res.cloudinary.com/r0k56n3j/image/upload/v1786881616/frames1_${padded}.jpg`,
      `https://res.cloudinary.com/r0k56n3j/image/upload/frames1_${padded}.jpg`,
      `https://res.cloudinary.com/r0k56n3j/image/upload/v1786881629/frames1_${padded}.jpg`,
    ];

    console.log(`\n--- Frame ${padded} ---`);
    for (const url of urls) {
      try {
        const res = await fetch(url, { method: "HEAD" });
        console.log(`[${res.status}] ${url}`);
      } catch (err: any) {
        console.log(`[ERR] ${url}: ${err.message}`);
      }
    }
  }

  console.log("\nTesting all frames 1 through 39 with primary URL format:");
  let successCount = 0;
  for (let f = 1; f <= 39; f++) {
    const padded = String(f).padStart(4, "0");
    const primaryUrl = `https://res.cloudinary.com/r0k56n3j/image/upload/f_auto,q_auto/frames1_${padded}.jpg`;
    try {
      const res = await fetch(primaryUrl, { method: "HEAD" });
      if (res.status === 200) {
        successCount++;
      } else {
        console.log(`Frame ${padded} status: ${res.status} at ${primaryUrl}`);
      }
    } catch (err: any) {
      console.log(`Frame ${padded} fetch failed: ${err.message}`);
    }
  }
  console.log(`Summary: ${successCount} / 39 frames accessible (status 200 OK) with f_auto,q_auto/frames1_XXXX.jpg`);
}

testFrames();
