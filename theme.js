const fs = require('fs');
const path = require('path');

const replacements = {
  // Backgrounds
  'bg-slate-50': 'bg-slate-950',
  'bg-white': 'bg-slate-900',
  'hover:bg-slate-50': 'hover:bg-slate-800/50',
  'hover:bg-slate-100': 'hover:bg-slate-800',
  
  // Texts
  'text-slate-900': 'text-white',
  'text-slate-800': 'text-slate-200',
  'text-slate-700': 'text-slate-300',
  'text-slate-600': 'text-slate-300',
  'text-slate-500': 'text-slate-400',
  'placeholder-slate-400': 'placeholder-slate-500',
  'placeholder:text-slate-400': 'placeholder:text-slate-500',
  
  // Borders
  'border-slate-200': 'border-slate-800',
  'border-slate-300': 'border-slate-700',
  'divide-slate-200': 'divide-slate-800',
  'ring-slate-200': 'ring-slate-800',
  
  // Semantic colors - Red
  'bg-red-50': 'bg-red-950/30',
  'text-red-700': 'text-red-400',
  'text-red-600': 'text-red-400',
  'border-red-200': 'border-red-900/50',
  'hover:bg-red-100': 'hover:bg-red-900/50',
  
  // Semantic colors - Amber
  'bg-amber-50': 'bg-amber-950/30',
  'text-amber-700': 'text-amber-400',
  'border-amber-200': 'border-amber-900/50',
  
  // Semantic colors - Green
  'bg-green-50': 'bg-green-950/30',
  'text-green-700': 'text-green-400',
  'border-green-200': 'border-green-900/50',
  
  // Semantic colors - Blue
  'bg-blue-50': 'bg-blue-950/30',
  'text-blue-700': 'text-blue-400',
  'border-blue-200': 'border-blue-900/50',
  'text-blue-600': 'text-blue-500',
  'text-blue-500': 'text-blue-500', // ensure it doesn't get messed up if I replace 600
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  for (const [find, replace] of Object.entries(replacements)) {
    // using regex with word boundary or quote boundary to avoid partial replacements
    // e.g. text-slate-500 shouldn't be matched by text-slate-50 if it existed (though bg-slate-50 might)
    const regex = new RegExp(`(?<=["'\\s{]|\\\`)${find}(?=["'\\s}]|\\\`)`, 'g');
    content = content.replace(regex, replace);
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
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
