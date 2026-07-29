import fs from 'node:fs';
import path from 'node:path';

const failures=[],warnings=[];
for(const file of['README.md','README.en.md']){
  const text=fs.readFileSync(file,'utf8');
  if(!/^# Claude Export History Viewer/m.test(text))failures.push(`${file}: main title missing`);
  if(!/viewer\.html/.test(text))failures.push(`${file}: viewer.html download/open reference missing`);
  if(!/MIT/.test(text))failures.push(`${file}: license reference missing`);
  for(const m of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
    const target=m[1].trim().replace(/^<|>$/g,'');
    if(/^(?:https?:|mailto:|#)/i.test(target)){if(/^https?:/i.test(target))warnings.push(`${file}: external link not fetched: ${target}`);continue;}
    const local=decodeURIComponent(target.split('#')[0]);if(local&&!fs.existsSync(path.resolve(path.dirname(file),local)))failures.push(`${file}: missing local link ${local}`);
  }
}
const zh=fs.readFileSync('README.md','utf8'),en=fs.readFileSync('README.en.md','utf8');
for(const token of['viewer.html','LICENSE','Claude'])if(!zh.includes(token)||!en.includes(token))failures.push(`README parity token missing: ${token}`);
if(warnings.length)console.warn(warnings.join('\n'));
if(failures.length){console.error(failures.map(x=>`- ${x}`).join('\n'));process.exit(1);}
console.log('documentation checks passed');
