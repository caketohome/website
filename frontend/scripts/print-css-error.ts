async function printCss404() {
  const res = await fetch("http://localhost:3000/_next/static/css/app/layout.css");
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Full Body:\n", text);
}

printCss404();
