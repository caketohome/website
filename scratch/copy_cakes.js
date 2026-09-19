const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\alexc\\.gemini\\antigravity-ide\\brain\\e9ad1d9e-34b0-4eef-a4e6-c860749d8c3c';
const dstDir = path.join(__dirname, '../frontend/public/images');

const truffle = path.join(srcDir, 'belgian_truffle_cake_1789543439877.jpg');
const redVelvet = path.join(srcDir, 'red_velvet_cake_1789543483284.jpg');
const strawberry = path.join(srcDir, 'strawberry_cake_1789543502362.jpg');

const mappings = [
  { src: truffle, dst: 'belgian-truffle.jpg' },
  { src: truffle, dst: 'chocolate-cake.jpg' },
  { src: redVelvet, dst: 'red-velvet-heart.jpg' },
  { src: strawberry, dst: 'strawberry-cake.jpg' },
  { src: strawberry, dst: 'default-cake.jpg' },
  { src: truffle, dst: 'placeholder-cake.jpg' },
  { src: truffle, dst: 'default-og-cake.jpg' }
];

for (const m of mappings) {
  const target = path.join(dstDir, m.dst);
  fs.copyFileSync(m.src, target);
  const stat = fs.statSync(target);
  console.log(`Copied ${m.dst}: ${stat.size} bytes`);
}
