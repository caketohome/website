async function debugHomepage500() {
  console.log("=== DEBUGGING HOMEPAGE 500 INTERNAL SERVER ERROR ===");
  try {
    const res = await fetch("http://localhost:3000/");
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response text snippet (first 1000 chars):\n", text.slice(0, 1000));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

debugHomepage500();
