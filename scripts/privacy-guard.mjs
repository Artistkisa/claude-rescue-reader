import {addedDiff,changedFiles} from './git-diff-utils.mjs';

const failures=[];
const forbiddenNames=/(^|\/)(conversations|memories|users)\.json$|(^|\/)projects\/[^/]+\.json$|scan(?:-output|-result)?\.(json|txt|log)$/i;
for(const row of changedFiles()){
  const [,file]=row.match(/^\S+\s+(.+)$/)||[];
  if(file&&forbiddenNames.test(file)&&!/^tests\/fixtures\/synthetic-/i.test(file))failures.push(`Forbidden export-like file: ${file}`);
}
const added=addedDiff().split(/\r?\n/).filter(l=>l.startsWith('+')&&!l.startsWith('+++')).map(l=>l.slice(1));
const secretPatterns=[
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token',/\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['Bearer token',/\bBearer\s+[A-Za-z0-9._~+\/-]{20,}/i],
  ['AWS access key',/\bAKIA[0-9A-Z]{16}\b/]
];
for(const line of added){
  for(const [name,re] of secretPatterns)if(re.test(line))failures.push(`Possible ${name} in added line`);
  if(!/SENSITIVE_PATTERNS|Local paths|本地路径|privacy-guard|absolute path/i.test(line)&&/(?:[A-Z]:\\Users\\[^\\\s]+|[A-Z]:\\(?:others|projects)\\|\/Users\/[A-Za-z0-9._-]+\/|\/home\/[A-Za-z0-9._-]+\/)/.test(line))failures.push('Personal absolute path found in added line');
}
if(failures.length){console.error([...new Set(failures)].map(x=>`- ${x}`).join('\n'));process.exit(1);}
console.log('privacy guard passed');
