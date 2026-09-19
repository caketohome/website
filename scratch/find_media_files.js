const fs = require('fs');
const path = require('path');

function findFiles(dir, match) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, match));
    } else if (file.toLowerCase().includes(match)) {
      results.push(fullPath);
    }
  });
  return results;
}

console.log('Media files:', findFiles('frontend/src', 'media'));
console.log('Image files:', findFiles('frontend/src', 'image'));
