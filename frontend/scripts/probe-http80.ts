async function checkHttp() {
  try {
    const res = await fetch("http://198.54.117.242", {
      headers: { "Host": "n8n.caketohome.com" },
      signal: AbortSignal.timeout(5000)
    });
    console.log("HTTP 80 Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log("Body preview:", text.slice(0, 500));
  } catch (err: any) {
    console.error("HTTP 80 Error:", err.message);
  }
}
checkHttp();
