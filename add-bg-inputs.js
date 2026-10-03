const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Replace <input className="w-full border border-slate-700..."
  // with <input className="w-full border border-slate-700 bg-slate-950 text-white..."
  content = content.replace(/(<(?:input|select|textarea)[^>]*className=["'][^"']*)(["'])/g, (match, p1, p2) => {
    let classes = p1;
    if (!classes.includes('bg-')) {
      classes += ' bg-slate-950 text-white';
    }
    return classes + p2;
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated form elements in: ${filePath}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      processFile(fullPath);
    }
  }
}

processDirectory(path.join(__dirname, 'app'));
processDirectory(path.join(__dirname, 'components'));
