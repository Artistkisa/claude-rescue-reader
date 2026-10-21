import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../src/redaction-rules.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../src/worker-core.js',import.meta.url),'utf8');
const core=vm.runInNewContext(source+';workerDomainCore()',{structuredClone,Map,Set,Blob});
const rules=vm.runInNewContext(source+';redactionRules()');
const sample=text=>({name:'Synthetic',chat_messages:[{content:[{type:'text',text}]}]});
const run=(text,options={},style='standard')=>core.redactConversation(sample(text),style,false,options);
const body=r=>r.conv.chat_messages[0].content[0].text;

export const categories=[
  {label:'姓名 / Names',positive:['我叫 张三。','我的名字是李小明。','My name is Alice Smith.'],negative:['我叫什么名字？','示例：我叫张三。','我的名字是变量。']},
  {label:'地址 / Addresses',positive:['寄到北京市春风路18号。','我住在春风街20号。','My address is 42 Fiction Road.'],negative:['我的住址是什么？','示例：寄到北京市春风路18号。','My address is somewhere quiet.']},
  {label:'单位 / Organizations',positive:['目前就读于星河大学。','我在星河科技公司工作。','I work at Fiction Labs.'],negative:['我在研究大学课程。','学校如何选择？','I work at home.']},
  {label:'社交 / Social',positive:['我的微信号是fiction_user。','我的QQ是12345678。','My social handle is fictional_user.'],negative:['微信是什么？','示例：我的微信是fiction_user。','My social handle is short.']},
  {label:'口令 / Passphrases',positive:['登录密码是fiction-pass。','临时口令为fiction-pass。','My login password is fiction-pass.'],negative:['登录密码是什么？','如何设置临时口令？','temporary passphrase is how?']},
  {label:'联系方式 / Contact',positive:['reach me at 020 1234 5678.','联系我请拨打020 1234 5678。','contact me at 020 4321 5678.'],negative:['reach me at the library.','联系我用邮件。','contact me at which number?']},
  {label:'混淆格式 / Obfuscated formats',positive:['fiction [at] example [dot] invalid','fiction(at)example(dot)invalid','１３８ ００１２ ３４５６'],negative:['fiction [at] a place','123 4567 8901','１３２４']}
];
for(const group of categories)test('synthetic precision/recall: '+group.label,()=>{
  for(const input of group.positive){const result=run(input);assert.ok(result.total>0,'miss: '+input);assert.equal(result.complete,true);}
  for(const input of group.negative)assert.equal(run(input).total,0,'false positive: '+input);
});

test('weak candidates are independent, opt in, masked and do not weaken credentials',()=>{
  const input='联系人：张三。\n公司：星河科技公司。\n地址：春风路18号。';
  const normal=run(input),included=run(input,{includeContextCandidates:true});
  assert.equal(normal.total,0);assert.equal(normal.candidateTotal,3);assert.equal(body(normal),input);
  assert.equal(included.total,3);assert.equal(included.candidateTotal,0);assert.ok(!body(included).includes('张三'));
  assert.ok(normal.matches.every(m=>m.evidence==='candidate'&&m.applied===false));assert.ok(!JSON.stringify(normal.matches).includes('星河'));
  const secret='gh'+'p_'+'x'.repeat(32);assert.ok(!body(run('示例：'+secret)).includes(secret));
});

test('provider labels, passport variants, supervisor and spaced social phrases regressions',()=>{
  const secret='fiction-'+ 'x'.repeat(30);
  assert.ok(!body(run('Cohere key: '+secret)).includes(secret));
  const passport=core.redactConversation(sample('护照号：E87654321'),'standard',true);assert.ok(!body(passport).includes('E87654321'));
  const input='导师是赵小云教授。\n我的 Twitter 是 @fictional_user。\n姓名：钱小明。';
  const base=run(input),opted=run(input,{includeContextCandidates:true});assert.equal(base.total,1);assert.equal(base.candidateTotal,2);assert.equal(opted.total,3);
  assert.ok(!body(base).includes('@fictional_user'));assert.ok(body(base).includes('赵小云'));assert.ok(!body(opted).includes('赵小云'));
});

test('quoted curl headers remove secrets while preserving the public command target',()=>{
  for(const quote of ['"',"'"]){const secret='fiction-'+ 'x'.repeat(30),input='curl -H '+quote+'Authorization: Bearer '+secret+quote+' https://public.example.invalid',result=body(run(input));assert.ok(!result.includes(secret));assert.ok(result.includes(quote+' https://public.example.invalid'));}
  assert.ok(!body(run('Authorization: Bearer "fiction-value"')).includes('fiction-value'));
  assert.ok(!body(run('Cookie: session=fiction; other=value')).includes('fiction'));
});

test('generic statements stay readable while category-specific formatting variants are removed',()=>{
  for(const input of ['我叫外卖。','我在这家公司。','My name is Anonymous.'])assert.equal(run(input).total,0);
  for(const input of ['fiction [at] example.invalid','fiction＠example．invalid','1 3 8 0 0 1 2 3 4 5 6'])assert.equal(run(input).total,1);
});

test('normalization maps fullwidth, separators and zero widths to original Unicode offsets',()=>{
  const input='🙂 ＡＬＰＨＡ-ＰＥＲＳＯＮ / Alpha\u200bPerson / alphaperson 🙂';
  const options={customTerms:['AlphaPerson'],customSimilarity:true};
  const result=run(input,options);assert.equal(result.total,3);assert.equal(body(result),'🙂 [REDACTED:自定义敏感词] / [REDACTED:自定义敏感词] / [REDACTED:自定义敏感词] 🙂');
  assert.equal(run(input,{customTerms:['AlphaPerson']}).total,0);
  assert.equal(run('ａｂｃ abc',{customTerms:['abc'],customSimilarity:true}).total,1);
  assert.equal(run('ＡＢＣＤ ABCD abce',{customTerms:['abcd'],customSimilarity:true}).total,2);
  assert.equal(run('ab\ncd',{customTerms:['abcd'],customSimilarity:true}).total,0);
  assert.equal(run('a'+' '.repeat(513)+'bcd',{customTerms:['abcd'],customSimilarity:true}).total,0);
});

test('similarity uses both Dice and edit gates with short and long word limits',()=>{
  assert.ok(rules.dice([... 'abcdefghijk'],[...'abcdefghijx'])>=0.85);
  assert.equal(run('abcdefghijx',{customTerms:['abcdefghijk'],customSimilarity:true}).total,1);
  assert.equal(run('abxdxfghijk',{customTerms:['abcdefghijk'],customSimilarity:true}).total,0);
  assert.equal(run('abcxefgh',{customTerms:['abcdefgh'],customSimilarity:true}).total,0);
  assert.equal(run('abcdefgX',{customTerms:['abcdefgh'],customSimilarity:false}).total,0);
  const long='abcdefghijklmnopqrstuvwx';assert.equal(run('abcdefghijklmnopqrstuvyz',{customTerms:[long],customSimilarity:true}).total,1);
  const huge='a'.repeat(129);assert.equal(run('a'.repeat(128)+'b',{customTerms:[huge],customSimilarity:true}).total,0);
  assert.equal(run('Ａ'.repeat(129),{customTerms:[huge],customSimilarity:true}).total,1);
});

test('normalization, edit distance and aliases preserve distinct originals and do not mask surrounding words',()=>{
  const input='AlphaPerson AlphaPerson alphaperson abcdefghijx end';
  const result=run(input,{customTerms:['AlphaPerson','abcdefghijk'],customSimilarity:true},'pseudonym');
  assert.equal(body(result),'[ID_1] [ID_1] [ID_2] [ID_3] end');
  const overlapping=run('fiction@example.invalid',{customTerms:['fiction@example.invalid'],customSimilarity:true});assert.equal(overlapping.total,1);
});

test('window ownership handles context triggers and Unicode matches across boundaries',()=>{
  for(const length of [31740,31742,31743,31744,31745,32250,32765]){
    const prefix='。'.repeat(length),result=run(prefix+'我叫张三。🙂ＡＬＰＨＡＰＥＲＳＯＮ。',{customTerms:['AlphaPerson'],customSimilarity:true});
    assert.equal(result.total,2,'boundary '+length);assert.equal(body(result),prefix+'我叫[REDACTED:个人姓名]。🙂[REDACTED:自定义敏感词]。');
  }
  assert.equal(run('my name is\nAlice Smith.').total,0);
  // The first ownership interval ends before the first chunk does. A short
  // trailing interval still gets its own iteration; it must never be skipped.
  const tail=run('。'.repeat(31750)+'ＡＬＰＨＡＰＥＲＳＯＮ',{customTerms:['AlphaPerson'],customSimilarity:true});assert.equal(tail.total,1);assert.equal(body(tail).slice(31750),'[REDACTED:自定义敏感词]');
});

test('oversubscribed similarity is explicit, bounded, cancellable, and independent of normal scans',async()=>{
  const input=('abcdefghijx ').repeat(1000),options={customTerms:['abcdefghijk'],customSimilarity:true};
  const result=run(input,options);assert.equal(result.complete,false);assert.ok(result.matches.length<=100);
  assert.equal(run(input,{...options,customSimilarity:false}).complete,true);
  let checkpoints=0;
  await assert.rejects(core.redactAsync(sample(input),'standard',false,async()=>{if(++checkpoints>5)throw new Error('cancelled');},true,options),/cancelled/);
  const started=performance.now(),terms=Array.from({length:100},(_,i)=>'sensitiveValue'+i),large=sample('普通合成正文🙂。'.repeat(30000));
  const preview=await core.redactAsync(large,'standard',false,async()=>{},true,{customTerms:terms,customSimilarity:true});
  assert.equal(preview.complete,true);assert.ok(performance.now()-started<3000);assert.equal(preview.conv,undefined);
});

test('all four option combinations share preview/export counts across every text field',async()=>{
  for(const includeContextCandidates of [false,true])for(const customSimilarity of [false,true]){
    const options={includeContextCandidates,customSimilarity,customTerms:['AlphaPerson']},conv=sample('联系人：张三。 ＡＬＰＨＡＰＥＲＳＯＮ');
    conv.name='联系人：张三。';conv.chat_messages[0].content.push({type:'thinking',thinking:'公司：星河科技公司。'},{type:'injected_prompt_block',prompt:'ＡＬＰＨＡＰＥＲＳＯＮ'},{type:'tool_result',content:'地址：春风路18号。'});
    conv.chat_messages[0].attachments=[{file_name:'ＡＬＰＨＡＰＥＲＳＯＮ.md',description:'联系人：李四。'}];
    const result=core.redactConversation(conv,'standard',false,options),preview=await core.redactAsync(structuredClone(conv),'standard',false,async()=>{},true,options);
    assert.equal(result.total,preview.total);assert.equal(result.candidateTotal,preview.candidateTotal);assert.equal(JSON.stringify(result.matches),JSON.stringify(preview.matches));
    assert.equal(result.total,(includeContextCandidates?5:0)+(customSimilarity?3:0));assert.equal(result.candidateTotal,includeContextCandidates?0:5);
    assert.ok(!JSON.stringify(preview).includes('星河'));
  }
});
