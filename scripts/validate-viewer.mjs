import fs from 'node:fs';

const html=fs.readFileSync('viewer.html','utf8');
const worker=fs.readFileSync('src/analytics-worker.js','utf8').trim();
const failures=[];
const fail=m=>failures.push(m);

if(/^(<<<<<<<|=======|>>>>>>>) /m.test(html))fail('Git conflict marker found in viewer.html');
for(const marker of['// BEGIN GENERATED ANALYTICS WORKER','// END GENERATED ANALYTICS WORKER'])if(!html.includes(marker))fail(`Missing generated marker: ${marker}`);
const generated=html.match(/\/\/ BEGIN GENERATED ANALYTICS WORKER[^\r\n]*\r?\n([\s\S]*?)\r?\n\/\/ END GENERATED ANALYTICS WORKER/);
if(!generated)fail('Embedded analytics worker section was not found');
else if(generated[1].trim().replace(/\r\n/g,'\n')!==worker.replace(/\r\n/g,'\n'))fail('viewer.html embedded worker differs from src/analytics-worker.js');

const ids=[...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]);
const duplicateIds=[...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))];
if(duplicateIds.length)fail(`Duplicate DOM ids: ${duplicateIds.join(', ')}`);
for(const id of['file-input','zip-input','messages','conv-list','drop-overlay','custom-stopwords-input'])if(!ids.includes(id))fail(`Required DOM id missing: ${id}`);

for(const [index,match] of [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
  if(/\bsrc\s*=/.test(match[1]))continue;
  try{new Function(match[2]);}catch(err){fail(`Inline script ${index+1} syntax error: ${err.message}`);}
}

if(failures.length){console.error(failures.map(x=>`- ${x}`).join('\n'));process.exit(1);}
console.log(`viewer validation passed (${ids.length} ids, embedded worker synchronized)`);
