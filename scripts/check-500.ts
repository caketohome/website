async function check500() {
  const res = await fetch("http://localhost:3000/products/prod_1");
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response text:", text);
}
check500();
