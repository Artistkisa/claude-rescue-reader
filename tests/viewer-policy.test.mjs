import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {viewerPolicy,viewerPolicySources} from '../scripts/viewer-policy.mjs';

const fixture=extra=>'<meta http-equiv="Content-Security-Policy" content="">\n<script>\nconst artifactBootstrap=String.raw`\nconsole.log("local\\nscript");\n`;\n'+extra+'\n</script>';
const hash=source=>"'sha256-"+createHash('sha256').update(source).digest('base64')+"'";

test('policy hashes exact main and static raw bootstrap bytes across line endings',()=>{
  const html=fixture('const closing="<\\/script>";');
  const [main,bootstrap]=viewerPolicySources(html);
  assert.equal(bootstrap,'\nconsole.log("local\\nscript");\n');
  const policy=viewerPolicy(html);
  assert.ok(policy.includes(hash(main)));
  assert.ok(policy.includes(hash(bootstrap)));
  assert.equal(viewerPolicy(html.replace(/\n/g,'\r\n')).replace(/\r\n/g,'\n'),policy);
  assert.equal(viewerPolicy(policy),policy);
});

test('policy generation fails closed on missing, additional or truncated script blocks',()=>{
  for(const html of [
    fixture('').replace('<script>','<script src="external.js">'),
    fixture('')+'<script></script>',
    fixture('const closing="</script>";'),
    fixture('/* </script> */'),
    fixture('').replace('</script>',''),
    fixture('const broken=;')
  ])assert.throws(()=>viewerPolicy(html),/script/);
});

test('policy rejects missing, duplicate and dynamic Artifact templates and missing CSP',()=>{
  const html=fixture('');
  for(const changed of [
    html.replace('artifactBootstrap','otherBootstrap'),
    fixture('const artifactBootstrap=String.raw`other`;'),
    html.replace('local','${"dynamic"}'),
    html.replace('local','\\`'),
    html.replace('local','` + `'),
    html.replace(/<meta[^>]*>/,'')
  ])assert.throws(()=>viewerPolicy(changed),/bootstrap|Artifact|script syntax|CSP/);
  assert.ok(viewerPolicy(html,{offline:true}).includes("'self'"));
  assert.ok(!viewerPolicy(html,{offline:true}).includes('https://cdn.jsdelivr.net'));
});
