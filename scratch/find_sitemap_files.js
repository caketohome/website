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
    } else if (file.includes(match)) {
      results.push(fullPath);
    }
  });
  return results;
}

console.log('Sitemap files:', findFiles('frontend/src', 'sitemap'));
console.log('Robots files:', findFiles('frontend/src', 'robots'));
