import fs from 'node:fs';
import {changedFiles} from './git-diff-utils.mjs';

const failures=[],eventPath=process.env.GITHUB_EVENT_PATH;
if(eventPath&&fs.existsSync(eventPath)){
  const event=JSON.parse(fs.readFileSync(eventPath,'utf8')),pr=event.pull_request;
  if(pr){if(!pr.title?.trim())failures.push('PR title is required');if(!pr.body?.trim())failures.push('PR description is required');}
}
const rows=changedFiles(),paths=[];
for(const row of rows){const m=row.match(/^(\S+)\s+(.+)$/);if(!m)continue;const [,status,file]=m;paths.push(file);
  if(/(?:^|\/)(?:tmp|temp|output|results?)(?:\/|$)|\.(?:tmp|log|bak|swp)$/i.test(file))failures.push(`Temporary file is not allowed: ${file}`);
  if(/(?:^|\/)\.tmp-fixture(?:\/|$)/.test(file))failures.push(`Private fixture directory is not allowed: ${file}`);
  if(/^tests\/fixtures\//.test(file)&&!/synthetic|fixture/i.test(file))failures.push(`Fixture must be clearly synthetic: ${file}`);
  if(status.startsWith('A')){try{const size=fs.statSync(file).size;if(size>5*1024*1024)failures.push(`New file exceeds 5 MiB: ${file}`);}catch(err){failures.push(`Unable to inspect new file: ${file} (${err.message})`);}}
}
if(paths.includes('src/analytics-worker.js')&&!paths.includes('viewer.html'))failures.push('Worker source changed without rebuilding viewer.html');
for(const file of paths.filter(f=>/\.(?:html|js|mjs|md|yml|yaml|json|ps1)$/i.test(f))){try{if(/^(?:<<<<<<<[^\r\n]*|=======|>>>>>>>[^\r\n]*)\r?$/m.test(fs.readFileSync(file,'utf8')))failures.push(`Conflict marker found: ${file}`);}catch{}}
if(failures.length){console.error([...new Set(failures)].map(x=>`- ${x}`).join('\n'));process.exit(1);}
console.log(`PR policy passed (${paths.length} changed files)`);
