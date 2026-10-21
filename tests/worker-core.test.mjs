import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {marked} from 'marked';
import hljs from 'highlight.js';
const core=vm.runInNewContext(fs.readFileSync(new URL('../src/worker-core.js',import.meta.url),'utf8')+';workerDomainCore()',{marked,hljs,structuredClone,Date,Map,Set,Blob});
core.configure({lang:'en'});
const root='00000000-0000-4000-8000-000000000000';
test('iterative tree handles deep chains, duplicate/missing ids, cycles and branch choices',()=>{
  const messages=Array.from({length:12000},(_,i)=>({uuid:String(i),parent_message_uuid:i?String(i-1):root,text:'message'}));
  assert.equal(core.tree({chat_messages:messages}).ids.length,12000);
  const anomalous=[{uuid:'a',parent_message_uuid:'b'},{uuid:'b',parent_message_uuid:'a'},{uuid:'a'},{}];
  assert.equal(new Set(core.tree({chat_messages:anomalous},'full').ids).size,4);
  const conv={chat_messages:[{uuid:'a',parent_message_uuid:root},{uuid:'b',parent_message_uuid:'a',text:'left'},{uuid:'c',parent_message_uuid:'a',text:'right'},{uuid:'d',parent_message_uuid:'b'}]};
  assert.deepEqual(Array.from(core.tree(conv).ids),[0,1,3]);
  assert.deepEqual(Array.from(core.tree(conv,'longest',{a:1}).ids),[0,2]);
});
test('search strips markdown syntax but includes original code, thinking and Unicode',()=>{
  const fields=core.searchFields({content:[{type:'text',text:'**bold** [link](https://example.invalid)\n\n```js\nconst needle = "中文🙂";\n```'},{type:'thinking',thinking:'thought needle'}]});
  assert.ok(fields[0].text.includes('bold'));
  assert.ok(!fields[0].text.includes('**'));
  assert.ok(!fields[0].text.includes('https://'));
  assert.ok(fields[0].text.includes('const needle = "中文🙂";'));
  assert.equal(fields[1].text,'thought needle');
  const duplicate={text:'same body',content:[{type:'text',text:'same body'}]};
  assert.equal(core.searchFields(duplicate).length,1);
  assert.equal(core.prepare(duplicate).text,undefined);
  assert.deepEqual(Array.from(core.matches('İ中文🙂tail','tail'),hit=>[hit.offset,hit.length]),[[5,4]]);
  assert.deepEqual(Array.from(core.matches('İ中文🙂tail','i'),hit=>[hit.offset,hit.length]),[[0,1],[7,1]]);
});
test('preview masks and caps findings; full exports and PDF preserve giant content',async()=>{
  const conv={name:'Synthetic',chat_messages:[{content:[{type:'text',text:Array.from({length:130},(_,i)=>`user${i}@example.invalid`).join('\n')}]}]};
  const preview=await core.redactAsync(structuredClone(conv),'scp',true,async()=>{},true);
  assert.ok(preview.total>=130);assert.equal(preview.matches.length,100);assert.equal('conv' in preview,false);
  assert.ok(!JSON.stringify(preview).includes('user0@example.invalid'));
  const text='```js\n'+'const value=1;\n'.repeat(8000)+'// FINAL_SENTINEL\n```';
  const message={content:[{type:'text',text}]};
  assert.ok(core.prepare(message).content[0].text.length<=32768);
  assert.equal(core.prepare(message,{},true).content[0].text,text);
  assert.ok(core.prepare(message,{},true).content[0]._html.includes('FINAL_SENTINEL'));
  const markdown=await core.markdown({chat_messages:[message]},'longest',{},async()=>{});
  assert.ok(markdown.includes('FINAL_SENTINEL'));
});
test('worker Markdown preserves HTML/link/image security rules',()=>{
  const result=core.prepare({text:'<script>alert(1)</script>\n\n[x](javascript:alert%281%29) ![remote](https://example.invalid/a.png)'})._html;
  assert.ok(!result.includes('<script>'));
  assert.ok(!/href="javascript:/i.test(result));
  assert.ok(!/src="https:\/\/example.invalid/.test(result));
});
test('quality scans keep repetition, missing-parent and empty-message counts',async()=>{
  const result=await core.quality({messages:[{uuid:'a',sender:'assistant',text:'same'},{uuid:'b',parent_message_uuid:'a',sender:'assistant',text:'same'},{uuid:'c',parent_message_uuid:'missing',sender:'human',content:[]}]},async()=>{});
  assert.equal(result.counts.repeated,1);assert.equal(result.counts.orphan,1);assert.equal(result.counts.empty,1);
});
