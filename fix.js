import fs from 'fs';
const dir = 'src/app/pages/';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
for (const file of files) {
  let content = fs.readFileSync(dir + file, 'utf8');
  content = content.replace(/\\`/g, '`').replace(/\\\$/g, '$');
  fs.writeFileSync(dir + file, content);
}
console.log('Fixed files');
