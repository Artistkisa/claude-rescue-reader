import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const core=vm.runInNewContext(fs.readFileSync(new URL('../src/worker-core.js',import.meta.url),'utf8')+';workerDomainCore()',{structuredClone,Map,Set,Blob});
const sample=text=>({name:'Synthetic',chat_messages:[{uuid:'m',sender:'human',content:[{type:'text',text}]}]});
const text=result=>result.conv.chat_messages[0].content[0].text;

test('provider credentials, JWTs, private keys and authorization headers are covered',()=>{
  const secrets=['gh'+'p_'+'a'.repeat(30),'github_'+'pat_'+'b'.repeat(30),'gl'+'pat-'+'c'.repeat(20),'xox'+'b-'+'d'.repeat(20),'npm'+'_'+'e'.repeat(30),'AS'+'IA'+'A'.repeat(16),'sk_'+'live_'+'f'.repeat(24),'sk-'+'ant-'+'g'.repeat(24),'eyJ'+'a'.repeat(12)+'.'+'b'.repeat(12)+'.'+'c'.repeat(12),'Basic '+'a'.repeat(20),'-----BEGIN '+'ENCRYPTED PRIVATE KEY-----\nsynthetic\n-----END '+'ENCRYPTED PRIVATE KEY-----'];
  const result=text(core.redactConversation(sample(secrets.join('\n'))));for(const secret of secrets)assert.ok(!result.includes(secret),secret.slice(0,8));
  const unclosed='-----BEGIN '+'OPENSSH PRIVATE KEY-----\nsynthetic unfinished key';assert.ok(!text(core.redactConversation(sample(unclosed))).includes('synthetic unfinished'));
  const cookies=text(core.redactConversation(sample('Cookie: session=synthetic; csrftoken=other\nSet-Cookie: session=another; HttpOnly\nnext paragraph')));assert.ok(!cookies.includes('synthetic'));assert.ok(!cookies.includes('another'));assert.ok(cookies.includes('next paragraph'));
  const hooks=['https://hooks.slack.com/services/'+'T_SYNTHETIC/B_SYNTHETIC/not-a-real-secret','https://discord.com/api/webhooks/'+'123456/synthetic-not-real','https://api.telegram.org/bot'+'123456:synthetic_not_real'];const redacted=text(core.redactConversation(sample(hooks.join('\n'))));for(const hook of hooks)assert.ok(!redacted.includes(hook));
});

test('download tokens, signed query values, fragments and connection credentials are redacted',()=>{
  const input='https://claude.ai/export/synthetic/download/private-download-token\nhttps://example.invalid/f?X-Amz-Signature=private-signature&safe=visible#access_token=fragment-value\npostgresql://user:pa%40ss@db.example.invalid/test\nhttps://alice:password@host.invalid/';
  const result=core.redactConversation(sample(input)),out=text(result);for(const secret of ['private-download-token','private-signature','fragment-value','user:pa%40ss','alice:password'])assert.ok(!out.includes(secret));assert.ok(out.includes('safe=visible'));assert.ok(out.includes('db.example.invalid'));assert.ok(result.stats['下载令牌']);
});

test('quoted Unicode secrets, short passwords and numeric sensitive fields are removed',()=>{
  const conv=sample('password="短 口令"\nclient_secret: abc\napi_key = "punctuation!@#$%"\nordinary: safe');conv.chat_messages[0].structured_content={password:1234,authorization:'opaque',deviceId:987654321,user_id:87654321,nested:{refresh_token:'x'}};
  const result=core.redactConversation(conv),raw=JSON.stringify(result.conv);for(const secret of ['短 口令','abc','punctuation!@#$%','1234','opaque'])assert.ok(!raw.includes(secret));assert.equal(result.conv.chat_messages[0].structured_content.nested.refresh_token,'[REDACTED:凭据或令牌]');assert.ok(raw.includes('ordinary: safe'));
  assert.ok(!raw.includes('987654321'));assert.ok(!raw.includes('87654321'));
});

test('overlapping matches are replaced once without scanning generated placeholders',()=>{
  const address='synthetic@example.invalid',result=core.redactConversation(sample('email='+address),'standard',true,{customTerms:[address,'synthetic']});assert.equal(result.total,1);assert.equal(text(result),'email=[REDACTED:邮箱]');assert.equal(Object.values(result.stats).reduce((a,b)=>a+b,0),1);
});

test('consistent aliases and literal custom terms retain repeated relationships and original input',async()=>{
  const conv=sample('Alice Alice Bob C++ <tag> Alice'),before=JSON.stringify(conv),options={customTerms:['Alice','Bob','C++','<tag>']};
  const result=core.redactConversation(conv,'pseudonym',false,options),out=text(result);assert.equal(out,'[ID_1] [ID_1] [ID_2] [ID_3] [ID_4] [ID_1]');assert.equal(JSON.stringify(conv),before);
  const asynchronous=await core.redactAsync(structuredClone(conv),'pseudonym',false,async()=>{},false,options);assert.equal(text(asynchronous),out);assert.equal(asynchronous.total,result.total);
  assert.throws(()=>core.redactConversation(conv,'standard',false,{customTerms:['x'.repeat(257)]}),/limit/);
});

test('strict rules cover IPv6, MAC, international phones and Luhn cards without masking ordinary numbers',()=>{
  const input='2001:db8::1234\n00:1a:2b:3c:4d:5e\n+44 7700 900123\n4111 1111 1111 1111\n12345678901234567\n2026-10-21\n12:34:56\nhttps://docs.example.invalid/reference';
  const standard=text(core.redactConversation(sample(input))),strict=text(core.redactConversation(sample(input),'standard',true));assert.ok(standard.includes('2001:db8'));assert.ok(standard.includes('docs.example.invalid'));assert.ok(!standard.includes('+44 7700'));for(const value of ['2001:db8::1234','00:1a:2b:3c:4d:5e','4111 1111 1111 1111','docs.example.invalid'])assert.ok(!strict.includes(value));for(const value of ['12345678901234567','2026-10-21','12:34:56'])assert.ok(strict.includes(value),value);
});

test('preview is fully masked, bounds samples, sanitizes dynamic keys and counts all findings',async()=>{
  const conv=sample(Array.from({length:140},(_,i)=>'person'+i+'@example.invalid').join('\n'));conv.chat_messages[0].structured_content={'secret-key@example.invalid':'ordinary'};
  const preview=await core.redactAsync(structuredClone(conv),'standard',false,async()=>{},true);assert.equal(preview.total,141);assert.equal(preview.matches.length,100);assert.ok(!JSON.stringify(preview).includes('secret-key'));assert.ok(!JSON.stringify(preview).includes('person0'));assert.equal(preview.conv,undefined);assert.ok(preview.matches.every(m=>/^█+ \(\d+\)$/.test(m.preview)));
  const exported=core.redactConversation(conv);assert.equal(exported.total,141);assert.ok(!JSON.stringify(exported.conv).includes('secret-key@example.invalid'));
});

test('new content fields and binary attachments are scanned without retaining original image data',()=>{
  const conv=sample('ordinary');conv.chat_messages[0].attachments=[{file_name:'picture.png',data:'synthetic-private-pixels'}];conv.chat_messages[0].content.push({type:'injected_prompt_block',prompt:'hidden@example.invalid'},{type:'thinking',summaries:[{summary:'summary@example.invalid'}]},{type:'image',source:{data:'private-base64-pixels'}});
  const result=core.redactConversation(conv),raw=JSON.stringify(result.conv);for(const value of ['synthetic-private-pixels','hidden@example.invalid','summary@example.invalid','private-base64-pixels'])assert.ok(!raw.includes(value));assert.equal(result.conv.chat_messages[0].attachments[0]._redactedMedia,true);assert.ok(result.stats['内嵌二进制']);
});

test('long unmatched Unicode text and many email hits avoid quadratic scans',()=>{
  const started=performance.now(),body='合成测试文本'.repeat(10000)+'\n'+Array.from({length:10000},(_,i)=>'synthetic'+i+'@example.invalid').join('\n');const result=core.redactConversation(sample(body),'standard',true);assert.equal(result.stats['邮箱'],10000);assert.ok(performance.now()-started<3000);assert.equal(result.matches.length,100);
});
