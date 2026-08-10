async function checkHtml() {
  const res = await fetch('http://localhost:3000/');
  const html = await res.text();
  console.log('HTML Length:', html.length);
  console.log('Has Hero Headline:', html.includes('Handcrafted Gourmet Cakes Delivered in 2 Hours'));
  console.log('Has Best Sellers:', html.includes('Best-Selling Cakes'));
  console.log('Has FAQs:', html.includes('Frequently Asked Questions'));
  console.log('Has ALT Text:', html.includes('alt='));
  console.log('Has localhost in img src:', /src=["']http:\/\/localhost/i.test(html));
  console.log('Has data:image in img src:', /src=["']data:image/i.test(html));
}

checkHtml().catch(console.error);
