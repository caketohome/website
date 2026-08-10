async function checkResponsiveStyles() {
  const res = await fetch('http://localhost:3000/');
  const html = await res.text();
  
  console.log("HTML Length:", html.length);
  console.log("Contains grid-template-columns:", html.includes("grid-template-columns"));
  console.log("Contains min-height:", html.includes("min-height"));
  console.log("Contains <img> tags:", (html.match(/<img/g) || []).length);
  console.log("Contains alt text:", html.includes("alt="));
  console.log("Contains Best Sellers heading:", html.includes("Best-Selling Cakes"));
}

checkResponsiveStyles().catch(console.error);
