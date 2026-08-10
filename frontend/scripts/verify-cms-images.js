async function checkCmsImages() {
  const res = await fetch('http://localhost:3000/');
  const html = await res.text();
  
  const imgMatches = html.match(/<img[^>]+>/g) || [];
  console.log(`Total <img> tags rendered: ${imgMatches.length}`);
  
  const heroImgs = imgMatches.filter(img => img.includes('photo-1578985545062-69928b1d9587') || img.includes('photo-'));
  console.log(`CMS / Catalog images found: ${heroImgs.length}`);
  
  heroImgs.slice(0, 5).forEach((img, i) => {
    console.log(`Image ${i+1}: ${img}`);
  });
}

checkCmsImages().catch(console.error);
