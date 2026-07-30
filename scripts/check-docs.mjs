import fs from 'node:fs';
import path from 'node:path';

const failures=[],warnings=[];
for(const file of['CODE_OF_CONDUCT.md','CONTRIBUTING.md','SECURITY.md','.github/PULL_REQUEST_TEMPLATE.md','.github/ISSUE_TEMPLATE/bug_report.yml','.github/ISSUE_TEMPLATE/feature_request.yml','.github/ISSUE_TEMPLATE/config.yml'])if(!fs.existsSync(file))failures.push(`community health file missing: ${file}`);
for(const file of['README.md','README.en.md']){
  const text=fs.readFileSync(file,'utf8');
  if(!/^# Claude Rescue Reader/m.test(text))failures.push(`${file}: main title missing`);
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
for(const [file,text] of [['README.md',zh],['README.en.md',en]]){
  const badgeCount=(text.match(/^\[!\[/gm)||[]).length;
  if(badgeCount!==6)failures.push(`${file}: expected 6 high-signal badges, found ${badgeCount}`);
  for(const workflow of['viewer-validation.yml','browser-smoke.yml','privacy-guard.yml','release-verify.yml'])if(!text.includes(workflow))failures.push(`${file}: workflow badge missing: ${workflow}`);
  for(const token of['workflow-demo.gif','docs/benchmarks/readme-performance.json','scripts/benchmark-readme-performance.mjs'])if(!text.includes(token))failures.push(`${file}: README evidence link missing: ${token}`);
  for(const asset of['viewer.html','claude-rescue-reader-offline.zip'])if(!text.includes(`releases/latest/download/${asset}`))failures.push(`${file}: direct release download missing: ${asset}`);
  if(text.includes('releases/latest/download/claude-rescue-reader.zip'))failures.push(`${file}: redundant standard ZIP link should stay out of the README hero`);
}
const benchmark=JSON.parse(fs.readFileSync('docs/benchmarks/readme-performance.json','utf8'));
for(const result of benchmark.results){
  const expected=[result.sizeMiB,result.cpuThrottle,result.median.initialListMs,result.median.openConversationMs,result.median.searchMs];
  if(expected.some(value=>typeof value!=='number'||!Number.isFinite(value)))failures.push(`benchmark report has invalid values for ${result.sizeMiB} MiB`);
  const rowEn=`| ${result.sizeMiB} MiB | ${result.cpuThrottle}× | ${(result.median.initialListMs/1000).toFixed(2)} s | ${(result.median.openConversationMs/1000).toFixed(2)} s | ${(result.median.searchMs/1000).toFixed(2)} s |`;
  const rowZh=`| ${result.sizeMiB} MiB | ${result.cpuThrottle}× | ${(result.median.initialListMs/1000).toFixed(2)} 秒 | ${(result.median.openConversationMs/1000).toFixed(2)} 秒 | ${(result.median.searchMs/1000).toFixed(2)} 秒 |`;
  if(!en.includes(rowEn))failures.push(`README.en.md: benchmark row is stale for ${result.sizeMiB} MiB`);
  if(!zh.includes(rowZh))failures.push(`README.md: benchmark row is stale for ${result.sizeMiB} MiB`);
}
if(warnings.length)console.warn(warnings.join('\n'));
if(failures.length){console.error(failures.map(x=>`- ${x}`).join('\n'));process.exit(1);}
console.log('documentation checks passed');
